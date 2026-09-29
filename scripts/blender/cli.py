"""Unified CLI runner for Blender headless automation and asset verification.

Usage:
  blender --background <file.blend> --python scripts/blender/cli.py -- <subcommand> [options]

Subcommands:
  audit-glb       Verify an exported GLB against the machine-readable rig contract.
  audit-scene     Verify the open Blender file hierarchy, bones, and actions.
  organize        Organize objects into standard role collections (00 Rig, 10 Geometry, etc.).
  probe           Run live mesh-evaluated axis displacement probe on specific bones.
  export          Sanitize materials and export to game-ready GLB.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

# Add scripts/blender to sys.path if not present
BLENDER_PKG_DIR = Path(__file__).resolve().parent
if str(BLENDER_PKG_DIR) not in sys.path:
    sys.path.insert(0, str(BLENDER_PKG_DIR))

from contract import CONTRACT_PATH, load_contract


def _ensure_bpy():
    try:
        import bpy
        return bpy
    except ImportError:
        print("Error: This subcommand requires running inside Blender (e.g. blender -b -P scripts/blender/cli.py -- ...)", file=sys.stderr)
        sys.exit(1)


def cmd_audit_glb(args: argparse.Namespace) -> int:
    from audit_glb import audit
    contract = load_contract(args.manifest)
    target = Path(args.glb).resolve()
    report = audit(target, contract)
    out_json = json.dumps(report, indent=2, sort_keys=True)
    if args.json_out:
        Path(args.json_out).write_text(out_json + "\n")
    else:
        print(out_json)
    return 0 if report.get("passed", False) else 1


def cmd_audit_scene(args: argparse.Namespace) -> int:
    bpy = _ensure_bpy()
    from audit_scene import build_report
    contract = load_contract(args.manifest)
    source_glb = Path(args.source_glb).resolve() if args.source_glb else None
    report = build_report(bpy, contract, source_glb)
    out_json = json.dumps(report, indent=2, sort_keys=True)
    if args.json_out:
        Path(args.json_out).write_text(out_json + "\n")
    else:
        print(out_json)
    return 1 if report.get("errors") else 0


def cmd_organize(args: argparse.Namespace) -> int:
    bpy = _ensure_bpy()
    from organize_review_scene import organize_scene
    contract = load_contract(args.manifest)
    scene = bpy.context.scene
    result = organize_scene(scene, bpy, contract)
    if args.out:
        out_path = Path(args.out).resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(out_path))
        result["saved_copy"] = str(out_path)
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


def cmd_probe(args: argparse.Namespace) -> int:
    bpy = _ensure_bpy()
    from core.context import get_armature_and_mesh
    from rigging.probe import probe_bone_axes

    armature, mesh = get_armature_and_mesh(bpy, args.armature)
    bones = args.bones if args.bones else [
        f"{side}_Wing{part}"
        for side in ("L", "R")
        for part in ("Wrist", "D0P0", "D1P0", "D2P0", "Panel0_0", "Panel1_0")
    ]

    report = probe_bone_axes(
        bpy=bpy,
        armature=armature,
        mesh=mesh,
        bone_names=bones,
        action_name=args.action,
        frame=args.frame,
        nudge_radians=args.nudge,
    )

    out_json = json.dumps(report, indent=2, sort_keys=True)
    if args.json_out:
        Path(args.json_out).write_text(out_json + "\n")
    else:
        print(out_json)
    return 0


def cmd_export(args: argparse.Namespace) -> int:
    bpy = _ensure_bpy()
    from export.gltf import export_wyvern_glb
    out_path = Path(args.out).resolve()
    export_wyvern_glb(bpy, out_path, export_objects=args.objects)
    print(f"Successfully exported GLB to: {out_path}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="cli.py",
        description="Unified CLI runner for Blender headless automation and asset verification",
    )
    subparsers = parser.add_subparsers(dest="subcommand", required=True)

    # audit-glb
    p_aglb = subparsers.add_parser("audit-glb", help="Verify GLB against rig contract")
    p_aglb.add_argument("glb", help="Path to glTF / GLB file")
    p_aglb.add_argument("--manifest", type=Path, default=CONTRACT_PATH, help="Path to rig contract JSON")
    p_aglb.add_argument("--json-out", type=Path, help="Write output to JSON file")
    p_aglb.set_defaults(func=cmd_audit_glb)

    # audit-scene
    p_ascene = subparsers.add_parser("audit-scene", help="Verify open scene against rig contract")
    p_ascene.add_argument("--manifest", type=Path, default=CONTRACT_PATH, help="Path to rig contract JSON")
    p_ascene.add_argument("--source-glb", type=Path, help="Optional source asset to hash-check")
    p_ascene.add_argument("--json-out", type=Path, help="Write output to JSON file")
    p_ascene.set_defaults(func=cmd_audit_scene)

    # organize
    p_org = subparsers.add_parser("organize", help="Organize scene into role collections")
    p_org.add_argument("--manifest", type=Path, default=CONTRACT_PATH, help="Path to rig contract JSON")
    p_org.add_argument("--out", type=Path, help="Target new .blend path")
    p_org.set_defaults(func=cmd_organize)

    # probe
    p_probe = subparsers.add_parser("probe", help="Probe bone axis displacement on evaluated mesh")
    p_probe.add_argument("--armature", default="WyvernRig", help="Name of armature object")
    p_probe.add_argument("--action", default=None, help="Action name to evaluate")
    p_probe.add_argument("--frame", type=int, default=0, help="Frame number to evaluate")
    p_probe.add_argument("--nudge", type=float, default=0.1, help="Nudge angle in radians")
    p_probe.add_argument("--bones", nargs="*", help="List of bone names to probe")
    p_probe.add_argument("--json-out", type=Path, help="Write output to JSON file")
    p_probe.set_defaults(func=cmd_probe)

    # export
    p_exp = subparsers.add_parser("export", help="Export scene to GLB")
    p_exp.add_argument("--out", required=True, type=Path, help="Output .glb filepath")
    p_exp.add_argument("--objects", nargs="+", default=["WyvernRig", "WyvernMesh"], help="Objects to include")
    p_exp.set_defaults(func=cmd_export)

    return parser


def main() -> int:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
