#!/usr/bin/env python3
"""Build and validate the meshless Drogon sanctuary animation sidecar.

The load-bearing assertion is target-name compatibility: every sidecar channel
must resolve to a node that already exists in public/models/drogon.glb. A
renamed bone otherwise fails silently in three.js as a frozen body part.
"""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import shutil
import struct
import subprocess
import tempfile


ROOT = pathlib.Path(__file__).resolve().parents[1]
BLEND = ROOT / "assets/blender/drogon-sanctuary.blend"
BASE = ROOT / "public/models/drogon.glb"
DEST = ROOT / "public/models/drogon-sanctuary.glb"
EXPORT_SCRIPT = ROOT / "scripts/export-drogon-sidecar-blender.py"
REPORT = ROOT / "validation/wyvern-animations/sidecar-build-report.json"
EXPECTED_ACTIONS = {
    "Sanct_Calm",
    "Sanct_Rest",
    "Sanct_Drink",
    "Sanct_Eat",
    "Sanct_Breathe",
    "Sanct_BreatheAir",
    "Sanct_HuntGrip",
    "Sanct_HuntCarry",
    "Sanct_HuntFinish",
    "Sanct_Cruise",
    "Sanct_Scout",
    "Sanct_BankL",
    "Sanct_Speed",
    "Sanct_Soar",
    "Sanct_Dive",
    "Sanct_Climb",
    "Sanct_BankR",
    "Sanct_Groom",
    "Sanct_Hover",
    "Sanct_Nuzzle",
    "Sanct_PerchGrip",
    "Sanct_Rise",
    "Sanct_Sit",
    "Sanct_SitLoop",
    "Sanct_Sleep",
    "Sanct_PickUp",
    "Sanct_Drop",
}


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--from-export",
        type=pathlib.Path,
        help="Validate and install a GLB exported by an already-running Blender session.",
    )
    return parser.parse_args()


def blender_binary() -> pathlib.Path:
    configured = os.environ.get("BLENDER")
    candidates = [
        pathlib.Path(configured).expanduser() if configured else None,
        pathlib.Path(shutil.which("blender")) if shutil.which("blender") else None,
        pathlib.Path("/Applications/Blender.app/Contents/MacOS/Blender"),
    ]
    for candidate in candidates:
        if candidate and candidate.is_file():
            return candidate
    raise SystemExit("Blender not found; set BLENDER to its executable")


def split_glb(path: pathlib.Path) -> dict:
    data = path.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2 or length != len(data):
        raise AssertionError(f"invalid GLB header: {path}")
    offset = 12
    while offset < len(data):
        size, kind = struct.unpack_from("<I4s", data, offset)
        payload = data[offset + 8 : offset + 8 + size]
        if kind == b"JSON":
            return json.loads(payload.decode("utf-8"))
        offset += 8 + size
    raise AssertionError(f"no JSON chunk: {path}")


LOOPING_ACTIONS = frozenset(
    {
        "Sanct_BankL",
        "Sanct_BankR",
        "Sanct_Drink",
        "Sanct_Eat",
        "Sanct_HuntCarry",
        "Sanct_Cruise",
        "Sanct_Rest",
        "Sanct_Scout",
        "Sanct_Dive",
        "Sanct_Climb",
        "Sanct_Groom",
        "Sanct_Soar",
        "Sanct_Speed",
        "Sanct_Hover",
        "Sanct_PerchGrip",
        "Sanct_SitLoop",
        "Sanct_Sleep",
    }
)


def _glb_chunks(data: bytearray) -> tuple[dict, int, int, int]:
    """Return (document, json offset, json size, binary offset)."""
    chunks, offset = {}, 12
    while offset < len(data):
        size, kind = struct.unpack_from("<I4s", data, offset)
        chunks[kind] = (offset + 8, size)
        offset += 8 + size
    json_at, json_size = chunks[b"JSON"]
    return (
        json.loads(bytes(data[json_at : json_at + json_size]).decode("utf-8")),
        json_at,
        json_size,
        chunks[b"BIN\x00"][0],
    )


def smooth_loop_seams(path: pathlib.Path) -> int:
    """Give looping clips the velocity they cruise at across the loop point.

    A loop needs matching velocity at the seam, not just a matching pose. Blender
    flattens the first and last handle of every F-curve, so each of these clips
    leaves the exporter starting and ending at exactly zero velocity while
    running at 0.15-0.18 in between: the wingbeat eases to a dead stop at the
    loop point and lurches back into motion once per cycle. The existing endpoint
    check cannot see it, because the two ends agree - they are both wrong.

    Because the first and last keys hold the same pose, the seam is a single
    point of the cycle, and its tangent is the central difference across the
    wrap: the key after it, minus the key before it, over their combined spacing.
    """
    data = bytearray(path.read_bytes())
    doc, _, _, bin_at = _glb_chunks(data)
    widths = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}

    def window(accessor: dict) -> tuple[int, int, int]:
        view = doc["bufferViews"][accessor["bufferView"]]
        width = widths[accessor["type"]]
        base = bin_at + view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
        return base, view.get("byteStride") or width * 4, width

    adjusted = 0
    for animation in doc.get("animations", []):
        if animation.get("name") not in LOOPING_ACTIONS:
            continue
        for sampler in animation.get("samplers", []):
            if sampler.get("interpolation") != "CUBICSPLINE":
                continue
            output = doc["accessors"][sampler["output"]]
            times = doc["accessors"][sampler["input"]]
            if output.get("componentType") != 5126 or times.get("componentType") != 5126:
                continue
            keys = output["count"] // 3
            if keys < 3:
                continue

            t_base, t_stride, _ = window(times)
            at = lambda k: struct.unpack_from("<f", data, t_base + k * t_stride)[0]
            span = (at(1) - at(0)) + (at(keys - 1) - at(keys - 2))
            if span <= 0.0:
                continue

            base, stride, width = window(output)
            fmt = f"<{width}f"
            element = lambda index: struct.unpack_from(fmt, data, base + index * stride)
            after, before = element(1 * 3 + 1), element((keys - 2) * 3 + 1)
            seam = tuple((a - b) / span for a, b in zip(after, before))

            # Cap the seam at the channel's own fastest interior motion. The
            # difference across the wrap is a fair tangent while a channel keeps
            # moving, but on one that is nearly static inside the clip it is
            # dominated by slow drift and lands far above anything the channel
            # ever does - 17.9x on the tail root, 926x on a SitLoop bone. Left
            # uncapped that trades the stall for a whip in the same frame.
            interior = max(
                (
                    sum(component * component for component in element(index)) ** 0.5
                    for key in range(1, keys - 1)
                    for index in (key * 3, key * 3 + 2)
                ),
                default=0.0,
            )
            length = sum(component * component for component in seam) ** 0.5
            if interior <= 0.0:
                continue
            if length > interior:
                seam = tuple(component * interior / length for component in seam)

            # The out-tangent of the first key drives the clip's opening velocity
            # and the in-tangent of the last key its closing one. The remaining
            # two never affect playback, but the first and last key hold the same
            # pose at the same point of the cycle, so the same tangent belongs on
            # all four - and writing all four keeps the endpoint check in
            # validate-sidecar-runtime.mjs comparing like with like, since it
            # tests the whole element, tangents included.
            for index in (0, 2, (keys - 1) * 3, (keys - 1) * 3 + 2):
                struct.pack_into(fmt, data, base + index * stride, *seam)
            adjusted += 1

    if adjusted:
        path.write_bytes(bytes(data))
    return adjusted


def repair_quaternion_continuity(path: pathlib.Path) -> int:
    """Re-align exported rotation keys onto a single quaternion hemisphere.

    q and -q are the same orientation, so the sign a quaternion is written with
    carries no pose information - but it decides which way round the runtime
    interpolates to the next key. Blender's glTF exporter canonicalises the sign
    per key, which is lossless pose-wise and destroys that continuity: the blend
    holds 0 opposed neighbours across all 292 quaternion groups, and the GLB it
    writes holds 48 in glide alone, including both wing clavicles and the tail
    root at dot -0.999. Every keyframe still measures correct, which is why the
    clip signatures pass; between keys the wingtips swing out through the torso
    and the tail throws across the body. Flipping the sign back here changes no
    pose and restores the short path.
    """
    data = bytearray(path.read_bytes())
    chunks, offset = {}, 12
    while offset < len(data):
        size, kind = struct.unpack_from("<I4s", data, offset)
        chunks[kind] = (offset + 8, size)
        offset += 8 + size
    json_at, json_size = chunks[b"JSON"]
    bin_at, _ = chunks[b"BIN\x00"]
    doc = json.loads(bytes(data[json_at : json_at + json_size]).decode("utf-8"))

    flipped = 0
    for animation in doc.get("animations", []):
        for channel in animation.get("channels", []):
            if channel["target"]["path"] != "rotation":
                continue
            sampler = animation["samplers"][channel["sampler"]]
            accessor = doc["accessors"][sampler["output"]]
            if accessor.get("componentType") != 5126 or accessor.get("type") != "VEC4":
                continue
            view = doc["bufferViews"][accessor["bufferView"]]
            base = bin_at + view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
            stride = view.get("byteStride") or 16
            # CUBICSPLINE stores in-tangent, value, out-tangent per key; the
            # tangents are derivatives of the value and must flip with it.
            span = 3 if sampler.get("interpolation") == "CUBICSPLINE" else 1
            count = accessor["count"]
            value_at = lambda k: base + (k * span + (1 if span == 3 else 0)) * stride
            for key in range(1, count // span):
                previous = struct.unpack_from("<4f", data, value_at(key - 1))
                current = struct.unpack_from("<4f", data, value_at(key))
                if sum(p * c for p, c in zip(previous, current)) >= 0.0:
                    continue
                for part in range(span):
                    at = base + (key * span + part) * stride
                    struct.pack_into(
                        "<4f", data, at, *(-v for v in struct.unpack_from("<4f", data, at))
                    )
                flipped += 1
    if flipped:
        path.write_bytes(bytes(data))
    return flipped


def validate(base: dict, sidecar: dict) -> dict:
    action_names = {animation.get("name") for animation in sidecar.get("animations", [])}
    assert action_names == EXPECTED_ACTIONS, sorted(action_names)

    for forbidden in ("meshes", "skins", "materials", "textures", "images"):
        assert not sidecar.get(forbidden), f"sidecar unexpectedly contains {forbidden}"

    sidecar_nodes = sidecar.get("nodes", [])
    sidecar_names = [node.get("name") for node in sidecar_nodes if node.get("name")]
    assert len(sidecar_names) == len(set(sidecar_names)), "sidecar node names are not unique"
    assert not any(name.endswith(".001") for name in sidecar_names), sidecar_names

    base_names = {node.get("name") for node in base.get("nodes", []) if node.get("name")}
    target_names: set[str] = set()
    channel_counts: dict[str, int] = {}
    paths: set[str] = set()
    for animation in sidecar["animations"]:
        channels = animation.get("channels", [])
        channel_counts[animation["name"]] = len(channels)
        assert channels, animation["name"]
        for channel in channels:
            target = channel["target"]
            node_name = sidecar_nodes[target["node"]].get("name")
            assert node_name, (animation["name"], target)
            target_names.add(node_name)
            paths.add(target["path"])

    missing_targets = sorted(target_names - base_names)
    assert not missing_targets, f"animation targets absent from base GLB: {missing_targets}"
    assert paths <= {"translation", "rotation", "scale"}, sorted(paths)

    return {
        "base": str(BASE.relative_to(ROOT)),
        "sidecar": str(DEST.relative_to(ROOT)),
        "blend": str(BLEND.relative_to(ROOT)),
        "animations": sorted(action_names),
        "animation_count": len(action_names),
        "channel_counts": channel_counts,
        "target_node_count": len(target_names),
        "all_targets_exist_in_base": True,
        "meshless": True,
        "skinless": True,
        "sidecar_node_count": len(sidecar_nodes),
        "size_bytes": DEST.stat().st_size,
    }


def main() -> None:
    args = arguments()
    for required in (BLEND, BASE, EXPORT_SCRIPT):
        if not required.exists():
            raise SystemExit(f"missing required input: {required}")

    if args.from_export:
        staged = args.from_export.expanduser().resolve()
        if not staged.is_file():
            raise SystemExit(f"missing Blender export: {staged}")
        DEST.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(staged, DEST)
    else:
        with tempfile.TemporaryDirectory() as temporary:
            staged = pathlib.Path(temporary) / DEST.name
            subprocess.run(
                [
                    str(blender_binary()),
                    "--background",
                    str(BLEND),
                    "--python",
                    str(EXPORT_SCRIPT),
                    "--",
                    str(staged),
                ],
                check=True,
            )
            DEST.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(staged, DEST)

    # Order matters: the seam tangent is a difference of pose values, so the
    # hemisphere pass has to settle their signs before it is measured.
    hemisphere_flips = repair_quaternion_continuity(DEST)
    seams_smoothed = smooth_loop_seams(DEST)

    report = validate(split_glb(BASE), split_glb(DEST))
    report["hemisphere_flips_repaired"] = hemisphere_flips
    report["loop_seams_smoothed"] = seams_smoothed
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(
        f"built:{DEST.relative_to(ROOT)} "
        f"{report['size_bytes'] / (1024 * 1024):.2f}MB "
        f"clips:{report['animation_count']} "
        f"targets:{report['target_node_count']}"
    )


if __name__ == "__main__":
    main()
