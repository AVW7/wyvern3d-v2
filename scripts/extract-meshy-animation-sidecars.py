#!/usr/bin/env python3
"""Extract compact, meshless animation GLBs from Meshy character exports."""

from __future__ import annotations

import json
from pathlib import Path
import struct


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/models/source/sorcerer-handler"
LEGACY_SOURCE = ROOT / "public/models/source/arcane-handler"
OUTPUT = ROOT / "public/models/arcane-handler-animations"
CLIPS = {
    "idle": (LEGACY_SOURCE / "idle.glb", "idle"),
    "walk": (SOURCE / "walking.glb", "walk"),
    "run": (SOURCE / "running.glb", "run"),
    "offer": (LEGACY_SOURCE / "offer.glb", "offer"),
    "pet": (LEGACY_SOURCE / "pet.glb", "pet"),
    "calm": (LEGACY_SOURCE / "calm.glb", "calm"),
    "inspect": (LEGACY_SOURCE / "inspect.glb", "inspect"),
}


def read_glb(path: Path) -> tuple[dict, bytes]:
    data = path.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2 or length != len(data):
        raise AssertionError(f"invalid GLB: {path}")
    doc = None
    binary = b""
    offset = 12
    while offset < len(data):
        size, kind = struct.unpack_from("<I4s", data, offset)
        payload = data[offset + 8 : offset + 8 + size]
        if kind == b"JSON":
            doc = json.loads(payload.decode("utf-8"))
        elif kind == b"BIN\x00":
            binary = payload
        offset += 8 + size
    if doc is None:
        raise AssertionError(f"missing JSON chunk: {path}")
    return doc, binary


def write_glb(path: Path, doc: dict, binary: bytes) -> None:
    encoded = json.dumps(doc, separators=(",", ":")).encode()
    encoded += b" " * ((4 - len(encoded) % 4) % 4)
    binary += b"\x00" * ((4 - len(binary) % 4) % 4)
    total = 12 + 8 + len(encoded) + (8 + len(binary) if binary else 0)
    out = bytearray(struct.pack("<4sII", b"glTF", 2, total))
    out += struct.pack("<I4s", len(encoded), b"JSON") + encoded
    if binary:
        out += struct.pack("<I4s", len(binary), b"BIN\x00") + binary
    path.write_bytes(out)


def extract(source: Path, destination: Path, clip_name: str, base_names: set[str]) -> dict:
    doc, binary = read_glb(source)
    animations = doc.get("animations", [])
    if len(animations) != 1:
        raise AssertionError(f"{source.name}: expected one animation, got {len(animations)}")
    animation = animations[0]
    animation["name"] = clip_name

    nodes = doc.get("nodes", [])
    targets = {
        nodes[channel["target"]["node"]].get("name")
        for channel in animation.get("channels", [])
    }
    missing = sorted(name for name in targets if not name or name not in base_names)
    if missing:
        raise AssertionError(f"{source.name}: targets absent from base rig: {missing}")

    used_accessors = sorted({
        sampler[key]
        for sampler in animation.get("samplers", [])
        for key in ("input", "output")
    })
    accessor_map = {old: new for new, old in enumerate(used_accessors)}
    accessors = [dict(doc["accessors"][old]) for old in used_accessors]

    used_views = sorted({accessor["bufferView"] for accessor in accessors})
    view_map = {old: new for new, old in enumerate(used_views)}
    packed = bytearray()
    views = []
    for old in used_views:
        view = dict(doc["bufferViews"][old])
        start = view.get("byteOffset", 0)
        payload = binary[start : start + view["byteLength"]]
        while len(packed) % 4:
            packed.append(0)
        view["byteOffset"] = len(packed)
        view["buffer"] = 0
        views.append(view)
        packed.extend(payload)

    for accessor in accessors:
        accessor["bufferView"] = view_map[accessor["bufferView"]]
    for sampler in animation["samplers"]:
        sampler["input"] = accessor_map[sampler["input"]]
        sampler["output"] = accessor_map[sampler["output"]]

    # Movement is controller-owned. Preserve vertical bounce but freeze the
    # Hips channel's horizontal X/Z components at their first-frame values.
    for channel in animation["channels"]:
        target = nodes[channel["target"]["node"]].get("name")
        if target != "Hips" or channel["target"]["path"] != "translation":
            continue
        sampler = animation["samplers"][channel["sampler"]]
        accessor = accessors[sampler["output"]]
        if accessor.get("componentType") != 5126 or accessor.get("type") != "VEC3":
            raise AssertionError(f"{source.name}: unsupported Hips translation accessor")
        view = views[accessor["bufferView"]]
        stride = view.get("byteStride", 12)
        start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
        first = struct.unpack_from("<3f", packed, start)
        for index in range(accessor["count"]):
            at = start + index * stride
            _, y, _ = struct.unpack_from("<3f", packed, at)
            struct.pack_into("<3f", packed, at, first[0], y, first[2])

    clean_nodes = []
    for node in nodes:
        kept = {key: value for key, value in node.items() if key not in {"mesh", "skin", "weights"}}
        clean_nodes.append(kept)

    sidecar = {
        "asset": doc["asset"],
        "scene": doc.get("scene", 0),
        "scenes": doc.get("scenes", [{"nodes": [0]}]),
        "nodes": clean_nodes,
        "animations": [animation],
        "accessors": accessors,
        "bufferViews": views,
        "buffers": [{"byteLength": len(packed)}],
    }
    destination.parent.mkdir(parents=True, exist_ok=True)
    write_glb(destination, sidecar, bytes(packed))
    return {
        "clip": clip_name,
        "channels": len(animation["channels"]),
        "targets": len(targets),
        "bytes": destination.stat().st_size,
    }


def main() -> None:
    base, _ = read_glb(SOURCE / "character.glb")
    base_names = {node.get("name") for node in base.get("nodes", []) if node.get("name")}
    reports = []
    for output_name, (source, clip_name) in CLIPS.items():
        reports.append(extract(
            source,
            OUTPUT / f"{output_name}.glb",
            clip_name,
            base_names,
        ))
    print(json.dumps(reports, indent=2))


if __name__ == "__main__":
    main()
