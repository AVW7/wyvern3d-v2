"""Add subtle, loop-safe membrane flex to the repaired Wyvern rig's actions.

The main flight and ground authoring scripts drive the structural wing chain.
This pass keys the four membrane bones as secondary deformation so their motion
follows the stroke instead of remaining rigid/static in exported GLB actions.
"""

import bpy
import math
from mathutils import Quaternion

ARM = bpy.data.objects["WyvernRig"]
R = math.radians
MEMBRANES = (
    ("L_WingMembrane1", 1.0, 1.00),
    ("L_WingMembrane2", 1.0, 0.62),
    ("R_WingMembrane1", -1.0, 1.00),
    ("R_WingMembrane2", -1.0, 0.62),
)
LOOPING_FLIGHT = {"cruise", "scout", "hover", "speed", "glide", "dive", "bankLeft", "bankRight"}

for action in bpy.data.actions:
    ARM.animation_data.action = action
    start, end = (int(v) for v in action.frame_range)
    duration = max(1, end - start)
    # Keep grounded clips quiet; flight gets a visibly elastic, but subordinate flex.
    amplitude = 4.5 if action.name in LOOPING_FLIGHT else 2.0
    # Four samples complete a whole wave: frame 0 == terminal frame for loop seams.
    samples = (0.0, 0.25, 0.50, 0.75, 1.0)

    for fraction in samples:
        frame = round(start + duration * fraction)
        wave = math.sin(fraction * math.tau)
        # Slightly delayed membrane 2 preserves a travelling ripple.
        for bone_name, side, scale in MEMBRANES:
            bone = ARM.pose.bones.get(bone_name)
            if bone is None:
                continue
            phase = wave if bone_name.endswith("1") else math.sin(fraction * math.tau - 0.38)
            bone.rotation_mode = "QUATERNION"
            bone.rotation_quaternion = Quaternion((0.0, 0.0, R(side * amplitude * scale * phase)))
            bone.location = (0.0, 0.0, 0.0)
            bone.keyframe_insert(data_path="rotation_quaternion", frame=frame)
            bone.keyframe_insert(data_path="location", frame=frame)

result = {
    "actions": len(bpy.data.actions),
    "membranes": [name for name, _, _ in MEMBRANES],
}
