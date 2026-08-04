"""Re-author the repaired-rig ``rest`` loop after the jaw-hinge migration."""

from __future__ import annotations

import math

import bpy
from mathutils import Euler


ARMATURE = "WyvernRig"
ACTION = "rest"
JAW = "Jaw"
FPS = 24
PERIOD = 144  # 6 s, matching canonical Sanct_Rest.
OPEN = math.radians(8.6)
CLOSED = math.radians(3.4)


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


def author() -> dict:
    arm = bpy.data.objects.get(ARMATURE)
    action = bpy.data.actions.get(ACTION)
    if arm is None or arm.type != "ARMATURE" or action is None:
        raise SystemExit("missing WyvernRig or rest action")
    if JAW not in arm.pose.bones:
        raise SystemExit("rest requires the repaired Jaw bone")

    start, end = (round(value) for value in action.frame_range)
    if start != 0 or end <= start:
        raise SystemExit(f"unexpected rest frame range {tuple(action.frame_range)}")
    scale = PERIOD / end

    # The current low body, head, leg, tail and folded-wing pose already has
    # the right rest intent. Retiming it gives the pant the source's six-second
    # cadence without inventing a second, competing body cycle.
    for _, curve in fcurves(action):
        if jaw_path(curve):
            continue
        for key in curve.keyframe_points:
            key.co.x *= scale
            key.handle_left.x *= scale
            key.handle_right.x *= scale
        curve.update()

    for bag, curve in tuple(fcurves(action)):
        if jaw_path(curve):
            bag.fcurves.remove(curve)

    arm.animation_data_create()
    arm.animation_data.action = action
    if action.slots:
        arm.animation_data.action_slot = action.slots[0]
    jaw = arm.pose.bones[JAW]
    jaw.rotation_mode = "QUATERNION"
    previous = None
    for frame in range(PERIOD + 1):
        phase = frame / PERIOD
        # Open at the seam, compress at half-cycle: 5.2 degrees of pant range,
        # matching Sanct_Rest's 5.71-degree jaw envelope without copying its
        # incompatible jaw basis.
        angle = CLOSED + (OPEN - CLOSED) * (0.5 + 0.5 * math.cos(2 * math.pi * phase))
        jaw.location = (0.0, 0.0, 0.0)
        jaw.rotation_quaternion = Euler((angle, 0.0, 0.0), "XYZ").to_quaternion()
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
    action.use_frame_range = True
    action.frame_start, action.frame_end = 0.0, float(PERIOD)
    bpy.context.scene.render.fps = FPS
    arm.animation_data.action = None
    bpy.context.scene.frame_set(0)
    return {"frames": [0, PERIOD], "jaw_open_deg": round(math.degrees(OPEN), 2), "jaw_closed_deg": round(math.degrees(CLOSED), 2)}


if __name__ == "__main__":
    print(author())
