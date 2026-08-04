"""Reverse WyvernRig's lower-jaw bone about its real skull hinge.

The initial repaired rig placed ``Jaw.head`` at the snout tip and its tail in
the skull.  That makes every mouth rotation pivot from the wrong end.  This
repair reverses the edit-bone direction, then bakes every existing jaw pose
back onto the corrected rest bone so the 16 current actions keep their posed
lower muzzle exactly where it was.  A clip can then deliberately re-author a
real mouth action on the new hinge.

Run this in a disposable or saved Blender scene before exporting.  It changes
only the Jaw rest bone and the Jaw tracks in the named runtime actions.
"""

from __future__ import annotations

import bpy


ARMATURE = "WyvernRig"
JAW = "Jaw"
ACTIONS = (
    "idle", "walk", "rest", "takeoff", "land", "cruise", "scout",
    "bankLeft", "bankRight", "hover", "glide", "dive", "speed",
    "attack", "breath", "death",
)


def armature() -> bpy.types.Object:
    arm = bpy.data.objects.get(ARMATURE)
    if arm is None or arm.type != "ARMATURE":
        raise SystemExit(f"missing armature {ARMATURE!r}")
    if JAW not in arm.pose.bones or JAW not in arm.data.bones:
        raise SystemExit(f"{ARMATURE!r} has no {JAW!r} bone")
    return arm


def bind(arm: bpy.types.Object, action: bpy.types.Action) -> None:
    arm.animation_data_create()
    arm.animation_data.action = action
    if action.slots:
        arm.animation_data.action_slot = action.slots[0]


def fcurves(action: bpy.types.Action):
    for layer in action.layers:
        for strip in layer.strips:
            if strip.type != "KEYFRAME":
                continue
            for bag in strip.channelbags:
                for curve in tuple(bag.fcurves):
                    yield bag, curve


def jaw_path(curve) -> bool:
    return f'pose.bones["{JAW}"]' in curve.data_path


def capture_poses(arm: bpy.types.Object) -> dict[str, dict[int, object]]:
    scene = bpy.context.scene
    captured: dict[str, dict[int, object]] = {}
    for name in ACTIONS:
        action = bpy.data.actions.get(name)
        if action is None:
            raise SystemExit(f"missing expected action {name!r}")
        bind(arm, action)
        first, last = (round(value) for value in action.frame_range)
        captured[name] = {}
        for frame in range(first, last + 1):
            scene.frame_set(frame)
            captured[name][frame] = arm.pose.bones[JAW].matrix.copy()
    return captured


def reverse_rest_bone(arm: bpy.types.Object) -> tuple[tuple[float, ...], tuple[float, ...]]:
    """Move the jaw's head to its current skull-side tail and vice versa."""
    bpy.ops.object.mode_set(mode="OBJECT") if bpy.context.object.mode != "OBJECT" else None
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    jaw = arm.data.edit_bones[JAW]
    old_head, old_tail = jaw.head.copy(), jaw.tail.copy()
    jaw.head, jaw.tail = old_tail, old_head
    bpy.ops.object.mode_set(mode="POSE")
    return tuple(old_head), tuple(old_tail)


def clear_jaw_tracks(action: bpy.types.Action) -> None:
    for bag, curve in tuple(fcurves(action)):
        if jaw_path(curve):
            bag.fcurves.remove(curve)


def bake_preserved_poses(arm: bpy.types.Object, captured: dict[str, dict[int, object]]) -> None:
    scene = bpy.context.scene
    for name, frames in captured.items():
        action = bpy.data.actions[name]
        clear_jaw_tracks(action)
        bind(arm, action)
        jaw = arm.pose.bones[JAW]
        jaw.rotation_mode = "QUATERNION"
        previous = None
        for frame, matrix in frames.items():
            scene.frame_set(frame)
            jaw.matrix = matrix
            if previous is not None:
                jaw.rotation_quaternion.make_compatible(previous)
            previous = jaw.rotation_quaternion.copy()
            jaw.keyframe_insert(data_path="location", frame=frame, group=JAW)
            jaw.keyframe_insert(data_path="rotation_quaternion", frame=frame, group=JAW)
            jaw.keyframe_insert(data_path="scale", frame=frame, group=JAW)
        for _, curve in fcurves(action):
            if jaw_path(curve):
                for key in curve.keyframe_points:
                    key.interpolation = "LINEAR"
                curve.update()


def max_pose_error(arm: bpy.types.Object, captured: dict[str, dict[int, object]]) -> float:
    scene = bpy.context.scene
    worst = 0.0
    for name, frames in captured.items():
        bind(arm, bpy.data.actions[name])
        for frame, expected in frames.items():
            scene.frame_set(frame)
            actual = arm.pose.bones[JAW].matrix
            worst = max(
                worst,
                max(
                    abs(a - b)
                    for actual_row, expected_row in zip(actual, expected)
                    for a, b in zip(actual_row, expected_row)
                ),
            )
    return worst


def repair() -> dict:
    arm = armature()
    captured = capture_poses(arm)
    old_head, old_tail = reverse_rest_bone(arm)
    bake_preserved_poses(arm, captured)
    error = max_pose_error(arm, captured)
    if error > 1e-3:
        raise SystemExit(f"jaw pose preservation failed: max matrix error {error:.6f}")
    arm.animation_data.action = None
    bpy.context.scene.frame_set(0)
    return {
        "old_head": old_head,
        "old_tail": old_tail,
        "new_head": tuple(arm.data.bones[JAW].head_local),
        "new_tail": tuple(arm.data.bones[JAW].tail_local),
        "max_pose_error": error,
    }


if __name__ == "__main__":
    print(repair())
