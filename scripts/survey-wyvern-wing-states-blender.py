#!/usr/bin/env python3
"""Report how much every wing joint actually moves in each wyvern action.

Run through Blender so the result accounts for imported quaternion tracks and
parent transforms; inspecting F-curves alone is not reliable for this rig.
"""

import bpy
import json
import math
import sys


CLIPS = {
    "attack", "bankLeft", "bankRight", "breath", "cruise", "death", "dive",
    "glide", "hover", "idle", "land", "rest", "scout", "speed", "takeoff", "walk",
}


def rotation_distance_degrees(a, b):
    """Smallest angular difference between two evaluated pose orientations."""
    return math.degrees(a.rotation_difference(b).angle)


def main():
    scene = bpy.context.scene
    armature = next(
        obj for obj in bpy.data.objects
        if obj.type == "ARMATURE" and "L_WingShoulder" in obj.pose.bones
    )
    wing_bones = sorted(
        pose_bone.name for pose_bone in armature.pose.bones
        if "Wing" in pose_bone.name
    )
    actions = sorted(
        (action for action in bpy.data.actions if action.name in CLIPS),
        key=lambda action: action.name,
    )
    report = {"wing_bones": wing_bones, "actions": {}}

    armature.animation_data_create()
    for action in actions:
        armature.animation_data.action = action
        start, end = (round(value) for value in action.frame_range)
        first, previous = {}, {}
        rotation_range, motion_path = ({bone: 0.0 for bone in wing_bones} for _ in range(2))

        for frame in range(start, end + 1):
            scene.frame_set(frame)
            bpy.context.view_layer.update()
            for bone_name in wing_bones:
                # matrix_basis isolates the bone's authored local delta.  The world
                # matrix includes every moving parent and would falsely report a
                # membrane as active whenever only the shoulder is flapping.
                orientation = armature.pose.bones[bone_name].matrix_basis.to_quaternion()
                if bone_name not in first:
                    first[bone_name] = orientation.copy()
                else:
                    rotation_range[bone_name] = max(
                        rotation_range[bone_name],
                        rotation_distance_degrees(first[bone_name], orientation),
                    )
                if bone_name in previous:
                    motion_path[bone_name] += rotation_distance_degrees(previous[bone_name], orientation)
                previous[bone_name] = orientation.copy()

        report["actions"][action.name] = {
            "frames": [start, end],
            "rotation_range_degrees": {
                bone: round(rotation_range[bone], 2) for bone in wing_bones
            },
            "motion_path_degrees": {
                bone: round(motion_path[bone], 2) for bone in wing_bones
            },
        }

    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
