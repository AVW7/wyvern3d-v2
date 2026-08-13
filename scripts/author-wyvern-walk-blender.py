"""Author the relaxed quadrupedal-wing carrier for the new-rig ``walk`` action.

Run inside Blender through ``scripts/author-wyvern-walk.py``.  This writes only
the six wing-chain rotations on the existing, fully baked 36-frame walk action;
the gait, body bob, neck and tail keep their authored values.

The axes are measured, rather than inferred from the bone names:

* local X raises both wings, so it is shared by left and right;
* local Z sweeps the pair in opposite directions, so it is mirrored.

The pose deliberately keeps the wing knuckles down as the front limbs, matching
the vendor walk.  The two sides settle on alternating steps (at most 0.9 degrees
at the shoulder), rather than flapping.  It should read as a relaxed quadruped,
not a grounded wyvern preparing to fly.
"""

from __future__ import annotations

import argparse
import math
import sys

try:
    import bpy  # type: ignore
    from mathutils import Euler  # type: ignore
except ImportError:
    bpy = None  # type: ignore
    Euler = None  # type: ignore


ARMATURE = "WyvernRig"
MESH = "WyvernMesh"
ACTION = "walk"
FPS = 24

# (base local-X lift, mirrored local-Z sweep, local-X sway amplitude, phase lag)
# Local X raises both wing chains.  The positive base keeps the knuckles near
# the foot plane, and the two per-side phase lags put those knuckles down on
# alternating steps.  Local Z is mirrored: it sweeps the wings back without
# collapsing them into a flight fold.
WINGS = {
    "L_WingShoulder": (3.5, 30.0, 0.9, 4.62),
    "R_WingShoulder": (3.5, -30.0, 0.9, -0.40),
    "L_WingElbow": (0.8, 0.0, 0.45, 4.20),
    "R_WingElbow": (0.8, 0.0, 0.45, -0.82),
    "L_WingWrist": (0.4, 0.0, 0.25, 3.80),
    "R_WingWrist": (0.4, 0.0, 0.25, -1.22),
}


def armature() -> bpy.types.Object:
    arm = bpy.data.objects.get(ARMATURE)
    if arm is None or arm.type != "ARMATURE":
        raise SystemExit(f"armature {ARMATURE!r} not found")
    return arm


def bind(arm: bpy.types.Object, action: bpy.types.Action) -> None:
    if arm.animation_data is None:
        arm.animation_data_create()
    arm.animation_data.action = action
    if action.slots:
        arm.animation_data.action_slot = action.slots[0]


def author() -> None:
    arm = armature()
    action = bpy.data.actions.get(ACTION)
    if action is None:
        raise SystemExit(f"action {ACTION!r} not found")
    missing = sorted(set(WINGS) - set(arm.pose.bones.keys()))
    if missing:
        raise SystemExit(f"wing bones missing from {ARMATURE}: {', '.join(missing)}")

    bind(arm, action)
    first, last = (round(value) for value in action.frame_range)
    if last <= first:
        raise SystemExit(f"{ACTION!r} has an invalid frame range {tuple(action.frame_range)}")

    # Two gentle settling cycles follow the two alternating foot-pair steps in
    # this 36-frame gait.  The final frame repeats the first exactly, preserving
    # the loop seam.
    for frame in range(first, last + 1):
        bpy.context.scene.frame_set(frame)
        phase = 4.0 * math.pi * (frame - first) / (last - first)
        for name, (lift, fold, sway, lag) in WINGS.items():
            pose_bone = arm.pose.bones[name]
            pose_bone.rotation_mode = "QUATERNION"
            pose_bone.rotation_quaternion = Euler(
                (math.radians(lift + sway * math.sin(phase - lag)), 0.0, math.radians(fold)),
                "XYZ",
            ).to_quaternion()
            pose_bone.keyframe_insert(
                data_path="rotation_quaternion", frame=frame, group=name
            )

    # Keep the explicitly authored channels smooth and prevent Bezier handles
    # from introducing an unmeasured overshoot between the 24-fps samples.
    for layer in action.layers:
        for strip in layer.strips:
            if strip.type != "KEYFRAME":
                continue
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    bone = curve.data_path.split('"')[1] if '"' in curve.data_path else ""
                    if bone not in WINGS:
                        continue
                    if not curve.data_path.endswith("rotation_quaternion"):
                        continue
                    for key in curve.keyframe_points:
                        key.interpolation = "BEZIER"
                        key.handle_left_type = "AUTO_CLAMPED"
                        key.handle_right_type = "AUTO_CLAMPED"
                    curve.update()

    action.use_frame_range = True
    action.frame_start, action.frame_end = float(first), float(last)
    action.use_fake_user = True
    print(
        f"authored {ACTION}: relaxed quadrupedal {last - first + 1}-frame wing carrier "
        f"({first}..{last})"
    )


def measure_ground_clearance() -> None:
    """Print the skin's true low point; bone ends are not a clearance proxy."""
    arm = armature()
    mesh = bpy.data.objects.get(MESH)
    action = bpy.data.actions[ACTION]
    if mesh is None or mesh.type != "MESH":
        raise SystemExit(f"mesh {MESH!r} not found")
    bind(arm, action)
    first, last = (round(value) for value in action.frame_range)
    lowest = (float("inf"), first, -1)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for frame in range(first, last + 1):
        bpy.context.scene.frame_set(frame)
        evaluated = mesh.evaluated_get(depsgraph)
        for vertex in evaluated.data.vertices:
            z = (evaluated.matrix_world @ vertex.co).z
            if z < lowest[0]:
                lowest = (z, frame, vertex.index)
    source_vertex = mesh.data.vertices[lowest[2]]
    groups = ", ".join(
        f"{mesh.vertex_groups[weight.group].name}={weight.weight:.3f}"
        for weight in source_vertex.groups
    )
    print(
        f"walk ground min {lowest[0]:.2f} rig units at frame {lowest[1]} "
        f"({groups})"
    )


def export(path: str) -> None:
    arm = armature()
    mesh = bpy.data.objects.get(MESH)
    if mesh is None or mesh.type != "MESH":
        raise SystemExit(f"mesh {MESH!r} not found")
    for obj in bpy.context.scene.objects:
        obj.select_set(obj in (arm, mesh))
    bpy.context.view_layer.objects.active = arm
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_skins=True,
        export_apply=False,
        export_yup=True,
        export_optimize_animation_size=False,
    )
    print(f"exported {path}")


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--save", action="store_true", help="write the .blend source")
    parser.add_argument("--export", default="", metavar="PATH", help="write a GLB")
    args, _ = parser.parse_known_args(argv)

    bpy.context.scene.render.fps = FPS
    author()
    measure_ground_clearance()
    if args.export:
        export(args.export)
    if args.save:
        bpy.ops.wm.save_mainfile()
        print(f"saved {bpy.data.filepath}")


if __name__ == "__main__":
    main()
