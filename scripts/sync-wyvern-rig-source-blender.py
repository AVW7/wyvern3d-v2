"""Refresh the editable WyvernRig source from the shipped GLB.

The Blender source predates the action-channel and export repairs in
``public/models/wyvern.glb``.  Do not export it directly: doing so would discard
those shipped repairs.  This one-time synchronizer imports the current runtime
asset, promotes its rig, mesh and actions to the canonical source names, and
restores the metadata used by the wing-surface recipe.

This is intentionally a synchronization, not an authoring pass.  The runtime
GLB is the newer artifact: it already contains the repaired frame-zero starts,
walk carrier, and surface response.  Re-running either authoring recipe during
the import would layer or overwrite those poses while merely trying to bring the
editable source up to date.
"""

from __future__ import annotations

import argparse
import json
import re
import runpy
import sys
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[1]
RUNTIME_GLB = ROOT / "public/models/wyvern.glb"
SURFACE_RECIPE = ROOT / "scripts/author-wyvern-wing-surfaces-blender.py"


def base_name(name: str) -> str:
    return re.sub(r"\.\d{3}$", "", name)


def import_runtime_rig() -> None:
    before_objects = set(bpy.data.objects)
    before_actions = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=str(RUNTIME_GLB))

    imported_objects = [obj for obj in bpy.data.objects if obj not in before_objects]
    imported_actions = [action for action in bpy.data.actions if action not in before_actions]
    imported_armatures = [obj for obj in imported_objects if obj.type == "ARMATURE"]
    imported_armature = next(
        (obj for obj in imported_armatures if "L_WingShoulder" in obj.pose.bones),
        None,
    )
    imported_meshes = [obj for obj in imported_objects if obj.type == "MESH"]
    imported_mesh = next(
        (
            obj
            for obj in imported_meshes
            if any(
                modifier.type == "ARMATURE" and modifier.object is imported_armature
                for modifier in obj.modifiers
            )
        ),
        None,
    )
    if imported_armature is None or imported_mesh is None:
        raise SystemExit(
            "runtime GLB did not import the expected WyvernRig; armatures: "
            + ", ".join(
                f"{obj.name} ({len(obj.pose.bones)} bones)" for obj in imported_armatures
            )
        )

    imported_bases = {base_name(action.name) for action in imported_actions}
    for name in ("WyvernRig", "WyvernMesh"):
        old = bpy.data.objects.get(name)
        if old is not None:
            bpy.data.objects.remove(old, do_unlink=True)
    for action in list(bpy.data.actions):
        if action not in imported_actions and action.name in imported_bases:
            bpy.data.actions.remove(action)

    imported_armature.name = "WyvernRig"
    imported_mesh.name = "WyvernMesh"
    canonical = bpy.data.objects.get("WyvernRig")
    if canonical is not imported_armature:
        actual = canonical.name if canonical is not None else "<missing>"
        raise SystemExit(
            f"could not promote imported armature to WyvernRig (got {actual}, "
            f"imported {imported_armature.name})"
        )
    required = {"L_WingShoulder", "R_WingShoulder", "L_WingElbow", "R_WingElbow"}
    missing = sorted(required - set(imported_armature.pose.bones.keys()))
    if missing:
        raise SystemExit(
            f"imported WyvernRig lacks {', '.join(missing)}; first bones are "
            f"{', '.join(list(imported_armature.pose.bones.keys())[:8])}"
        )
    for action in imported_actions:
        action.name = base_name(action.name)
        action.use_fake_user = True


def restore_surface_response_metadata() -> None:
    """Restore recipe metadata that glTF intentionally does not serialize.

    The surface action tracks are already present in ``wyvern.glb``.  The
    recipe's custom action property records which response was baked, so a
    future re-run can subtract that response before applying its replacement
    instead of double-layering it.
    """
    recipe = runpy.run_path(str(SURFACE_RECIPE), run_name="surface_metadata")
    property_name = recipe["PROFILE_PROPERTY"]
    for name, profile in recipe["PROFILES"].items():
        action = bpy.data.actions.get(name)
        if action is None:
            raise SystemExit(f"runtime asset is missing expected surface action {name!r}")
        action[property_name] = json.dumps(profile, sort_keys=True)


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--export",
        default="",
        metavar="PATH",
        help="optionally re-export the synchronized source to this path",
    )
    parser.add_argument("--save", action="store_true")
    args, _ = parser.parse_known_args(argv)
    if not RUNTIME_GLB.is_file():
        raise SystemExit(f"missing runtime asset: {RUNTIME_GLB}")

    import_runtime_rig()
    restore_surface_response_metadata()
    if args.export:
        recipe = runpy.run_path(str(SURFACE_RECIPE), run_name="surface_export")
        recipe["export"](args.export)
    if args.save:
        bpy.ops.wm.save_mainfile()
        print(f"saved {bpy.data.filepath}")


if __name__ == "__main__":
    main()
