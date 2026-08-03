#!/usr/bin/env python3
"""
Extract selected props from the vendor asset packs into one shared GLB.

Why this exists
---------------
The Poly Perfect packs ship as single monolithic .gltf showcase scenes — every
prop in the catalogue, laid out in a grid, with each mesh's buffers inlined as
base64 data URIs. The nature pack alone is 690 MB. Nothing is shippable as-is.

Why Python and not tsx
----------------------
690 MB exceeds V8's maximum string length (~512 MB), so Node cannot read the
source file at all, let alone JSON.parse it. CPython has no such limit. This is
an offline build step over files outside the repo, run when the prop selection
changes — not part of dev/build/test — so the language mismatch is contained.

What it produces
----------------
public/models/<out>.glb — one GLB holding every selected prop as a named
top-level node, sharing one material and one embedded palette texture. One
request, one texture, and every prop batches against every other prop.

Nodes are named by our own logical id (`forge.furnace`), never the vendor name,
so re-sourcing a prop is a change to asset-sources.json and nothing else.

Vendor meshes are authored in centimetres but are not consistently placed: some
rest on y=0, some straddle it, some are terrain-scale set pieces. Each prop is
therefore re-anchored on extraction — centred in x/z, resting on y=0 — via the
output node's TRS, so the scene can place a prop at a position and have it
stand there. `scale` and `sink` in asset-sources.json override that per prop.

All of this is cosmetic fitting. Gameplay dimensions live in src/core/data and
are never read from a model.

Usage:
    python3 scripts/extract-assets.py                 # build every target
    python3 scripts/extract-assets.py --list nature Fir_Tree
"""

from __future__ import annotations

import base64
import json
import re
import struct
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SOURCES = json.loads((REPO / "scripts" / "asset-sources.json").read_text())
ASSET_ROOT = Path(SOURCES["sourceRoot"]).expanduser()
OUT_DIR = REPO / "public" / "models"

# glTF component type -> bytes per component.
COMPONENT_SIZE = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
COMPONENT_COUNT = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}

# TANGENT is dead weight: the palette material has no normal map. Dropping it
# saves roughly a quarter of the vertex payload.
KEEP_ATTRIBUTES = ("POSITION", "NORMAL", "TEXCOORD_0")

_packs: dict[str, dict] = {}


def load_pack(name: str) -> dict:
    if name not in _packs:
        rel = SOURCES["packs"][name]["gltf"]
        path = ASSET_ROOT / rel
        print(f"  reading {rel} ({path.stat().st_size / 1e6:.0f} MB)…", flush=True)
        _packs[name] = json.loads(path.read_text())
    return _packs[name]


def mesh_nodes(doc: dict) -> dict[str, dict]:
    return {n["name"]: n for n in doc["nodes"] if n.get("mesh") is not None and n.get("name")}


def read_buffer(doc: dict, index: int) -> bytes:
    uri = doc["buffers"][index].get("uri", "")
    if not uri.startswith("data:"):
        raise SystemExit(f"buffer {index} is not an embedded data URI — unsupported")
    return base64.b64decode(uri.split(",", 1)[1])


def accessor_bytes(doc: dict, accessor: dict) -> bytes:
    """The accessor's elements as a tightly packed byte string."""
    view = doc["bufferViews"][accessor["bufferView"]]
    stride = view.get("byteStride")
    element = COMPONENT_SIZE[accessor["componentType"]] * COMPONENT_COUNT[accessor["type"]]
    if stride is not None and stride != element:
        raise SystemExit("interleaved bufferView — de-interleaving is not implemented")

    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    return read_buffer(doc, view["buffer"])[start : start + element * accessor["count"]]


class GlbBuilder:
    """Accumulates primitives into a single-buffer glTF, then packs it as a GLB."""

    def __init__(self) -> None:
        self.blob = bytearray()
        self.views: list[dict] = []
        self.accessors: list[dict] = []
        self.meshes: list[dict] = []
        self.nodes: list[dict] = []

    def _add_view(self, data: bytes, target: int | None = None) -> int:
        # glTF requires bufferView offsets aligned to 4 bytes.
        while len(self.blob) % 4:
            self.blob.append(0)
        view = {"buffer": 0, "byteOffset": len(self.blob), "byteLength": len(data)}
        if target is not None:
            view["target"] = target
        self.blob += data
        self.views.append(view)
        return len(self.views) - 1

    def _add_accessor(self, doc: dict, src: dict, target: int) -> int:
        view = self._add_view(accessor_bytes(doc, src), target)
        acc = {
            "bufferView": view,
            "componentType": src["componentType"],
            "count": src["count"],
            "type": src["type"],
        }
        # Palette UVs in the Poly Perfect packs are stored as normalized
        # unsigned integers. Without this flag glTFLoader reads them as large
        # raw integer coordinates, making almost every surface sample the same
        # (green) edge texel of the palette.
        if src.get("normalized"):
            acc["normalized"] = True
        # POSITION accessors must keep min/max; harmless elsewhere.
        if "min" in src:
            acc["min"], acc["max"] = src["min"], src["max"]
        self.accessors.append(acc)
        return len(self.accessors) - 1

    def add_prop(self, doc: dict, node: dict, prop_id: str, scale: float, sink: float) -> tuple[int, list[float]]:
        primitives = []
        lo = [float("inf")] * 3
        hi = [float("-inf")] * 3

        for prim in doc["meshes"][node["mesh"]]["primitives"]:
            attributes = {}
            for name, idx in prim["attributes"].items():
                if name not in KEEP_ATTRIBUTES:
                    continue
                src = doc["accessors"][idx]
                if name == "POSITION":
                    lo = [min(lo[i], src["min"][i]) for i in range(3)]
                    hi = [max(hi[i], src["max"][i]) for i in range(3)]
                attributes[name] = self._add_accessor(doc, src, 34962)
            out = {"attributes": attributes, "material": 0}
            if "indices" in prim:
                out["indices"] = self._add_accessor(doc, doc["accessors"][prim["indices"]], 34963)
            # The Poly Perfect packs use TRIANGLE_STRIP (5). Omitting this
            # silently defaults the output to TRIANGLES (4), producing invalid
            # topology and, on some WebGL drivers, a lost graphics context.
            if "mode" in prim:
                out["mode"] = prim["mode"]
            primitives.append(out)

        # Re-anchor: centre in x/z, rest on y=0, then sink by the requested depth.
        self.meshes.append({"name": prop_id, "primitives": primitives})
        self.nodes.append(
            {
                "name": prop_id,
                "mesh": len(self.meshes) - 1,
                "scale": [scale, scale, scale],
                "translation": [
                    -(lo[0] + hi[0]) / 2 * scale,
                    -lo[1] * scale - sink,
                    -(lo[2] + hi[2]) / 2 * scale,
                ],
            }
        )

        size = [(hi[i] - lo[i]) * scale for i in range(3)]
        cost = sum(
            self.views[a["bufferView"]]["byteLength"]
            for p in primitives
            for a in (
                self.accessors[i]
                for i in list(p["attributes"].values()) + ([p["indices"]] if "indices" in p else [])
            )
        )
        return cost, size

    def write(self, path: Path, palette_png: bytes) -> None:
        image_view = self._add_view(palette_png)
        doc = {
            "asset": {"version": "2.0", "generator": "wyvern3d extract-assets"},
            "scene": 0,
            "scenes": [{"nodes": list(range(len(self.nodes)))}],
            "nodes": self.nodes,
            "meshes": self.meshes,
            "accessors": self.accessors,
            "bufferViews": self.views,
            "buffers": [{"byteLength": len(self.blob)}],
            "images": [{"bufferView": image_view, "mimeType": "image/png"}],
            "samplers": [{"magFilter": 9728, "minFilter": 9987}],  # NEAREST: it's a palette
            "textures": [{"sampler": 0, "source": 0}],
            "materials": [
                {
                    "name": "PP_Palette",
                    "pbrMetallicRoughness": {
                        "baseColorTexture": {"index": 0},
                        "metallicFactor": 0.0,
                        "roughnessFactor": 0.85,
                    },
                }
            ],
        }

        json_chunk = json.dumps(doc, separators=(",", ":")).encode()
        json_chunk += b" " * (-len(json_chunk) % 4)
        bin_chunk = bytes(self.blob) + b"\0" * (-len(self.blob) % 4)

        total = 12 + 8 + len(json_chunk) + 8 + len(bin_chunk)
        with path.open("wb") as f:
            f.write(struct.pack("<III", 0x46546C67, 2, total))
            f.write(struct.pack("<II", len(json_chunk), 0x4E4F534A))
            f.write(json_chunk)
            f.write(struct.pack("<II", len(bin_chunk), 0x004E4942))
            f.write(bin_chunk)


def build(target: dict) -> None:
    print(f"\n{target['out']}")
    builder = GlbBuilder()
    missing: list[str] = []
    rows: list[tuple[str, int, list[float]]] = []

    # Props are grouped by pack so each 80-700 MB source is parsed once.
    for pack in sorted({p["pack"] for p in target["props"]}):
        doc = load_pack(pack)
        by_name = mesh_nodes(doc)
        suffix = SOURCES["packs"][pack]["nodeSuffix"]
        pack_scale = SOURCES["packs"][pack]["scale"]

        for prop in target["props"]:
            if prop["pack"] != pack:
                continue
            node = by_name.get(prop["node"] + suffix)
            if node is None:
                missing.append(f"{prop['id']}  ->  {prop['node']}  [{pack}]")
                continue
            cost, size = builder.add_prop(
                doc,
                node,
                prop["id"],
                pack_scale * prop.get("scale", 1.0),
                prop.get("sink", 0.0),
            )
            rows.append((prop["id"], cost, size))

    if missing:
        raise SystemExit("\nnode names not found in source pack:\n  " + "\n  ".join(missing))

    palette = (ASSET_ROOT / SOURCES["packs"][target["palette"]]["palette"]).read_bytes()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"{target['out']}.glb"
    builder.write(out, palette)

    print(f"  {'KB':>7}  {'w × h × d (m)':>22}  prop")
    for prop_id, cost, size in sorted(rows, key=lambda r: r[0]):
        dims = " × ".join(f"{v:5.2f}" for v in size)
        print(f"  {cost / 1024:7.1f}  {dims:>22}  {prop_id}")
    print(f"\n  => {out.relative_to(REPO)}  {out.stat().st_size / 1024:.0f} KB, {len(rows)} props")


def list_props(pack: str, pattern: str) -> None:
    """Print canonical prop names matching a pattern.

    The packs duplicate every mesh once per placement in the showcase scene
    (`PP_Grass_16`, `PP_Grass_16_1`, `PP_Grass_16_2`, … all identical geometry).
    Only the un-suffixed name is a distinct prop, so that is all this lists.
    """
    doc = load_pack(pack)
    suffix = SOURCES["packs"][pack]["nodeSuffix"]
    rx = re.compile(pattern, re.I)
    names = {
        n[: -len(suffix)] if suffix and n.endswith(suffix) else n
        for n in mesh_nodes(doc)
    }
    canonical = sorted(n for n in names if re.search(r"_\d{2}$", n) and rx.search(n))
    for name in canonical:
        print(name)
    print(f"\n{len(canonical)} canonical props matching /{pattern}/ in {pack}")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--list":
        list_props(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "")
    else:
        for target in SOURCES["targets"]:
            build(target)
