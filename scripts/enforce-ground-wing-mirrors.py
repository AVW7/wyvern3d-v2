"""Enforce reflected local wing-chain poses on ground clips that must be symmetric.

The repaired rig uses symmetric local X rotations and antisymmetric local Z
rotations across the wing pair. Walk is excluded because its wing-knuckle gait
is intentionally asymmetric; flight banks are authored separately as a pair.
"""

import bpy
from mathutils import Quaternion

ARM = bpy.data.objects["WyvernRig"]
LEFT = (
    "L_WingShoulder", "L_WingElbow", "L_WingWrist",
    "L_WingFinger1", "L_WingFinger2", "L_WingFinger3",
)
RIGHT = (
    "R_WingShoulder", "R_WingElbow", "R_WingWrist",
    "R_WingFinger1", "R_WingFinger2", "R_WingFinger3",
)
SYMMETRIC_GROUND_ACTIONS = ("rest", "attack", "breath", "takeoff", "land", "death")

for action_name in SYMMETRIC_GROUND_ACTIONS:
    action = bpy.data.actions.get(action_name)
    if action is None:
        continue
    ARM.animation_data.action = action
    # Use the full authored wing-key union, so this changes no temporal cadence.
    # Blender 5 stores curves in action layers/channel bags rather than the
    # former Action.fcurves collection.
    channel_bag = action.layers[0].strips[0].channelbag(action.slots[0])
    frames = sorted({
        round(point.co.x)
        for curve in channel_bag.fcurves
        if "Wing" in curve.data_path
        for point in curve.keyframe_points
    })
    for frame in frames:
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        for left_name, right_name in zip(LEFT, RIGHT):
            left = ARM.pose.bones[left_name]
            right = ARM.pose.bones[right_name]
            source = left.rotation_quaternion.normalized()
            right.rotation_mode = "QUATERNION"
            # Reflect the quaternion directly. Reconstructing through Euler
            # creates an unwanted Y term whenever X and Z are both non-zero.
            # Measured rig convention: X symmetric; Y/Z antisymmetric.
            right.rotation_quaternion = Quaternion((source.w, source.x, -source.y, -source.z))
            right.location = left.location.copy()
            right.keyframe_insert(data_path="rotation_quaternion", frame=frame)
            right.keyframe_insert(data_path="location", frame=frame)

bpy.ops.wm.save_mainfile()
result = {"mirrored_actions": list(SYMMETRIC_GROUND_ACTIONS)}
