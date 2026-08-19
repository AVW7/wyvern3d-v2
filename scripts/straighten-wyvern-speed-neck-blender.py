"""Align and straighten the wyvern neck, head, and tail in the 'speed' flight clip.

Sets:
  - Neck/Head: Head pitched straight forward (0.0 deg) with streamlined cervical transition
  - Tail: Tail1..Tail10 aligned along the streamlined torso line trailing straight behind the body

Run with:
    /Applications/Blender.app/Contents/MacOS/Blender --background public/models/wyvern-rig-v1wing.blend \
        --python scripts/straighten-wyvern-speed-neck-blender.py -- --save

    /Applications/Blender.app/Contents/MacOS/Blender --background public/models/wyvern-rig.blend \
        --python scripts/straighten-wyvern-speed-neck-blender.py -- --save
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Quaternion

ARMATURE = "WyvernRig"
ACTION_NAME = "speed"

# Solved Euler X rotations (in degrees) for the speed clip:
NECK_HEAD_EULER_X = {
    "Neck1": -4.0,   # world pitch = -3.05 deg (streamlined transition from Spine3)
    "Neck2": -24.4,  # world pitch = -0.91 deg (straight cervical line)
    "Head":  -5.88,  # world pitch = +0.00 deg (horizontal forward gaze)
}

TAIL_EULER_X = {
    "Tail1":  +15.9, # world pitch = -5.0 deg (smooth exit from pelvis)
    "Tail2":  -12.4, # world pitch = +4.0 deg
    "Tail3":   -9.0, # world pitch = +5.0 deg (straight streamlined body line)
    "Tail4":   -3.8, # world pitch = +5.0 deg
    "Tail5":   -2.4, # world pitch = +5.0 deg
    "Tail6":   -7.4, # world pitch = +5.0 deg
    "Tail7":   -4.9, # world pitch = +5.0 deg
    "Tail8":  +10.2, # world pitch = +5.0 deg
    "Tail9":   +6.7, # world pitch = +5.0 deg
    "Tail10":  +6.3, # world pitch = +5.0 deg
}


def arguments() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--save", action="store_true", help="Save the active .blend file")
    args, _ = parser.parse_known_args(argv)
    return args


def main() -> None:
    args = arguments()
    arm = bpy.data.objects.get(ARMATURE)
    if arm is None or arm.type != "ARMATURE":
        raise SystemExit(f"Armature {ARMATURE!r} not found")

    act = bpy.data.actions.get(ACTION_NAME)
    if act is None:
        raise SystemExit(f"Action {ACTION_NAME!r} not found in {bpy.data.filepath}")

    arm.animation_data_create()
    arm.animation_data.action = act
    if act.slots:
        arm.animation_data.action_slot = act.slots[0]

    f_start = int(act.frame_range[0])
    f_end = int(act.frame_range[1])

    # Convert Euler angles to quaternions
    target_quats = {}
    for bname, x_deg in {**NECK_HEAD_EULER_X, **TAIL_EULER_X}.items():
        target_quats[bname] = Euler((math.radians(x_deg), 0, 0), "XYZ").to_quaternion()
        pb = arm.pose.bones.get(bname)
        if pb:
            pb.rotation_mode = "QUATERNION"

    for f in range(f_start, f_end + 1):
        bpy.context.scene.frame_set(f)
        for bname, quat in target_quats.items():
            pb = arm.pose.bones.get(bname)
            if pb:
                pb.rotation_quaternion = quat
                pb.keyframe_insert(data_path="rotation_quaternion", frame=f)

    # Validate the resulting pitch
    bpy.context.scene.frame_set(0)
    bpy.context.view_layer.update()

    print(f"\n[align-speed-flight] Verified bone pitch in {bpy.data.filepath} for action '{ACTION_NAME}':")
    for bname in ["Body", "Spine3", "Neck1", "Neck2", "Head"] + [f"Tail{i}" for i in range(1, 11)]:
        pb = arm.pose.bones.get(bname)
        if pb:
            hw = arm.matrix_world @ pb.head
            tw = arm.matrix_world @ pb.tail
            v = (tw - hw).normalized()
            pitch = math.degrees(math.atan2(v.z, math.sqrt(v.x**2 + v.y**2)))
            print(f"  {bname:7s}: world pitch = {pitch:+.2f} deg, dir=({v.x:.3f}, {v.y:.3f}, {v.z:.3f})")

    if args.save:
        bpy.ops.wm.save_mainfile()
        print(f"[align-speed-flight] Saved {bpy.data.filepath}")


if __name__ == "__main__":
    main()
