import bpy, math
from mathutils import Quaternion

ARM = bpy.data.objects.get("WyvernRig")
R = math.radians

if bpy.context.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')
bpy.context.view_layer.objects.active = ARM
ARM.select_set(True)
bpy.ops.object.mode_set(mode='POSE')

# Delete all old actions
for action in list(bpy.data.actions):
    bpy.data.actions.remove(action)

def reset_pose():
    for pb in ARM.pose.bones:
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = Quaternion((1, 0, 0, 0))
        pb.location = (0, 0, 0)

def new_action(name):
    action = bpy.data.actions.new(name)
    ARM.animation_data_create()
    ARM.animation_data.action = action
    reset_pose()
    return action

def kf(bone_name, frame, rot_euler=(0,0,0), loc=(0,0,0)):
    pb = ARM.pose.bones.get(bone_name)
    if not pb:
        return
    pb.rotation_mode = 'QUATERNION'
    q = Quaternion(rot_euler)
    pb.rotation_quaternion = q
    pb.location = loc
    pb.keyframe_insert(data_path="rotation_quaternion", frame=frame)
    pb.keyframe_insert(data_path="location", frame=frame)

# AXIS CONVENTION (probed on WyvernRig):
# Wing Shoulder X: +UP/-DOWN (symmetric across L/R)
# Wing Shoulder Z: L: +fwd/-back, R: +back/-fwd (antisymmetric)
# Body/RootMotion X: +nose-down/-nose-up
# Tail1 X: +up/-down

# === CRUISE (48 frames, 3 beats, level flight) ===
new_action("cruise")
BEAT = 16
for beat in range(4):
    f = beat * BEAT
    kf('L_WingShoulder', f, rot_euler=(R(35), 0, R(-5)))
    kf('R_WingShoulder', f, rot_euler=(R(35), 0, R(5)))
    kf('L_WingElbow', f, rot_euler=(R(-8), 0, 0))
    kf('R_WingElbow', f, rot_euler=(R(-8), 0, 0))
    kf('L_WingShoulder', f + BEAT//2, rot_euler=(R(-35), 0, R(5)))
    kf('R_WingShoulder', f + BEAT//2, rot_euler=(R(-35), 0, R(-5)))
    kf('L_WingElbow', f + BEAT//2, rot_euler=(R(12), 0, 0))
    kf('R_WingElbow', f + BEAT//2, rot_euler=(R(12), 0, 0))
    kf('Body', f, loc=(0, 0, R(-3)))
    kf('Body', f + BEAT//2, loc=(0, 0, R(3)))
    kf('Neck1', f, rot_euler=(R(-2), 0, 0))
    kf('Neck1', f + BEAT//2, rot_euler=(R(2), 0, 0))
    kf('Neck2', f + 2, rot_euler=(R(-1.5), 0, 0))
    kf('Neck2', f + BEAT//2 + 2, rot_euler=(R(1.5), 0, 0))
    kf('Tail1', f + 4, rot_euler=(R(-1.5), 0, 0))
    kf('Tail1', f + BEAT//2 + 4, rot_euler=(R(1.5), 0, 0))

kf('L_Thigh', 0, rot_euler=(R(-20), 0, 0))
kf('R_Thigh', 0, rot_euler=(R(-20), 0, 0))
kf('L_Calf', 0, rot_euler=(R(40), 0, 0))
kf('R_Calf', 0, rot_euler=(R(40), 0, 0))
kf('L_Thigh', 48, rot_euler=(R(-20), 0, 0))
kf('R_Thigh', 48, rot_euler=(R(-20), 0, 0))
kf('L_Calf', 48, rot_euler=(R(40), 0, 0))
kf('R_Calf', 48, rot_euler=(R(40), 0, 0))
print("cruise done")

# === SCOUT (96 frames, 2 beats, slow loiter) ===
new_action("scout")
BEAT_S = 48
for beat in range(3):
    f = beat * BEAT_S
    kf('L_WingShoulder', f, rot_euler=(R(38), 0, R(-8)))
    kf('R_WingShoulder', f, rot_euler=(R(38), 0, R(8)))
    kf('L_WingElbow', f, rot_euler=(R(-10), 0, 0))
    kf('R_WingElbow', f, rot_euler=(R(-10), 0, 0))
    kf('L_WingShoulder', f + BEAT_S//2, rot_euler=(R(-38), 0, R(8)))
    kf('R_WingShoulder', f + BEAT_S//2, rot_euler=(R(-38), 0, R(-8)))
    kf('L_WingElbow', f + BEAT_S//2, rot_euler=(R(15), 0, 0))
    kf('R_WingElbow', f + BEAT_S//2, rot_euler=(R(15), 0, 0))
    kf('Body', f, loc=(0, 0, R(-2)))
    kf('Body', f + BEAT_S//2, loc=(0, 0, R(2)))
    kf('Neck1', f, rot_euler=(R(-1.5), 0, 0))
    kf('Neck1', f + BEAT_S//2, rot_euler=(R(1.5), 0, 0))
    kf('Tail1', f + 6, rot_euler=(R(-1), 0, 0))
    kf('Tail1', f + BEAT_S//2 + 6, rot_euler=(R(1), 0, 0))

kf('Body', 0, rot_euler=(R(-8), 0, 0))
kf('Body', 96, rot_euler=(R(-8), 0, 0))
kf('L_Thigh', 0, rot_euler=(R(-18), 0, 0))
kf('R_Thigh', 0, rot_euler=(R(-18), 0, 0))
kf('L_Calf', 0, rot_euler=(R(35), 0, 0))
kf('R_Calf', 0, rot_euler=(R(35), 0, 0))
kf('L_Thigh', 96, rot_euler=(R(-18), 0, 0))
kf('R_Thigh', 96, rot_euler=(R(-18), 0, 0))
kf('L_Calf', 96, rot_euler=(R(35), 0, 0))
kf('R_Calf', 96, rot_euler=(R(35), 0, 0))
print("scout done")

# === SPEED (36 frames, fast cruise, nose-down) ===
new_action("speed")
BEAT_SP = 12
for beat in range(4):
    f = beat * BEAT_SP
    kf('L_WingShoulder', f, rot_euler=(R(28), 0, R(-3)))
    kf('R_WingShoulder', f, rot_euler=(R(28), 0, R(3)))
    kf('L_WingShoulder', f + BEAT_SP//2, rot_euler=(R(-28), 0, R(3)))
    kf('R_WingShoulder', f + BEAT_SP//2, rot_euler=(R(-28), 0, R(-3)))
    kf('Body', f, loc=(0, 0, R(-2)))
    kf('Body', f + BEAT_SP//2, loc=(0, 0, R(2)))
    kf('Neck1', f, rot_euler=(R(1), 0, 0))
    kf('Neck1', f + BEAT_SP//2, rot_euler=(R(-1), 0, 0))

kf('Body', 0, rot_euler=(R(7), 0, 0))
kf('Body', 36, rot_euler=(R(7), 0, 0))
kf('L_Thigh', 0, rot_euler=(R(-25), 0, 0))
kf('R_Thigh', 0, rot_euler=(R(-25), 0, 0))
kf('L_Calf', 0, rot_euler=(R(45), 0, 0))
kf('R_Calf', 0, rot_euler=(R(45), 0, 0))
kf('L_Thigh', 36, rot_euler=(R(-25), 0, 0))
kf('R_Thigh', 36, rot_euler=(R(-25), 0, 0))
kf('L_Calf', 36, rot_euler=(R(45), 0, 0))
kf('R_Calf', 36, rot_euler=(R(45), 0, 0))
print("speed done")

# === HOVER (60 frames, 4 beats, nose-up 30 degrees) ===
new_action("hover")
BEAT_H = 15
for beat in range(5):
    f = beat * BEAT_H
    kf('L_WingShoulder', f, rot_euler=(R(50), 0, R(-10)))
    kf('R_WingShoulder', f, rot_euler=(R(50), 0, R(10)))
    kf('L_WingElbow', f, rot_euler=(R(-12), 0, 0))
    kf('R_WingElbow', f, rot_euler=(R(-12), 0, 0))
    kf('L_WingShoulder', f + BEAT_H//2, rot_euler=(R(-50), 0, R(10)))
    kf('R_WingShoulder', f + BEAT_H//2, rot_euler=(R(-50), 0, R(-10)))
    kf('L_WingElbow', f + BEAT_H//2, rot_euler=(R(18), 0, 0))
    kf('R_WingElbow', f + BEAT_H//2, rot_euler=(R(18), 0, 0))
    kf('Body', f, loc=(0, 0, R(-4)))
    kf('Body', f + BEAT_H//2, loc=(0, 0, R(4)))

kf('Body', 0, rot_euler=(R(-30), 0, 0))
kf('Body', 60, rot_euler=(R(-30), 0, 0))
kf('Neck1', 0, rot_euler=(R(10), 0, 0))
kf('Neck2', 0, rot_euler=(R(8), 0, 0))
kf('Neck1', 60, rot_euler=(R(10), 0, 0))
kf('Neck2', 60, rot_euler=(R(8), 0, 0))
kf('L_Thigh', 0, rot_euler=(R(10), 0, 0))
kf('R_Thigh', 0, rot_euler=(R(10), 0, 0))
kf('L_Calf', 0, rot_euler=(R(-5), 0, 0))
kf('R_Calf', 0, rot_euler=(R(-5), 0, 0))
kf('L_Thigh', 60, rot_euler=(R(10), 0, 0))
kf('R_Thigh', 60, rot_euler=(R(10), 0, 0))
kf('L_Calf', 60, rot_euler=(R(-5), 0, 0))
kf('R_Calf', 60, rot_euler=(R(-5), 0, 0))
kf('Tail1', 0, rot_euler=(R(-5), 0, 0))
kf('Tail1', 60, rot_euler=(R(-5), 0, 0))
print("hover done")

# === GLIDE / SOAR (96 frames, held wings, no flap) ===
new_action("glide")
WING_HOLD = R(15)
for f in range(0, 97, 24):
    ripple = R(3) * math.sin(f * math.pi / 24)
    kf('L_WingShoulder', f, rot_euler=(WING_HOLD + ripple, 0, R(-15)))
    kf('R_WingShoulder', f, rot_euler=(WING_HOLD + ripple, 0, R(15)))
    kf('L_WingWrist', f, rot_euler=(ripple * 0.5, 0, 0))
    kf('R_WingWrist', f, rot_euler=(ripple * 0.5, 0, 0))

kf('L_WingElbow', 0, rot_euler=(R(-5), 0, 0))
kf('R_WingElbow', 0, rot_euler=(R(-5), 0, 0))
kf('Body', 0, rot_euler=(R(-3), 0, 0))
kf('Body', 96, rot_euler=(R(-3), 0, 0))
kf('L_Thigh', 0, rot_euler=(R(-22), 0, 0))
kf('R_Thigh', 0, rot_euler=(R(-22), 0, 0))
kf('L_Calf', 0, rot_euler=(R(38), 0, 0))
kf('R_Calf', 0, rot_euler=(R(38), 0, 0))
kf('L_Thigh', 96, rot_euler=(R(-22), 0, 0))
kf('R_Thigh', 96, rot_euler=(R(-22), 0, 0))
kf('L_Calf', 96, rot_euler=(R(38), 0, 0))
kf('R_Calf', 96, rot_euler=(R(38), 0, 0))
kf('Neck1', 0, rot_euler=(R(-3), 0, 0))
kf('Neck2', 0, rot_euler=(R(-2), 0, 0))
kf('Neck1', 96, rot_euler=(R(-3), 0, 0))
kf('Neck2', 96, rot_euler=(R(-2), 0, 0))
kf('Tail1', 0, rot_euler=(R(-2), 0, 0))
kf('Tail1', 96, rot_euler=(R(-2), 0, 0))
print("glide done")

# === DIVE (48 frames, held folded wings, nose-down) ===
new_action("dive")
WING_FOLD = R(-25)
for f in range(0, 49, 16):
    ripple = R(1.5) * math.sin(f * math.pi / 16)
    kf('L_WingShoulder', f, rot_euler=(WING_FOLD + ripple, 0, R(20)))
    kf('R_WingShoulder', f, rot_euler=(WING_FOLD + ripple, 0, R(-20)))

kf('L_WingElbow', 0, rot_euler=(R(35), 0, 0))
kf('R_WingElbow', 0, rot_euler=(R(35), 0, 0))
kf('Body', 0, rot_euler=(R(25), 0, 0))
kf('Body', 48, rot_euler=(R(25), 0, 0))
kf('L_Thigh', 0, rot_euler=(R(-28), 0, 0))
kf('R_Thigh', 0, rot_euler=(R(-28), 0, 0))
kf('L_Calf', 0, rot_euler=(R(50), 0, 0))
kf('R_Calf', 0, rot_euler=(R(50), 0, 0))
kf('L_Thigh', 48, rot_euler=(R(-28), 0, 0))
kf('R_Thigh', 48, rot_euler=(R(-28), 0, 0))
kf('L_Calf', 48, rot_euler=(R(50), 0, 0))
kf('R_Calf', 48, rot_euler=(R(50), 0, 0))
kf('Tail1', 0, rot_euler=(R(8), 0, 0))
kf('Tail1', 48, rot_euler=(R(8), 0, 0))
kf('Neck1', 0, rot_euler=(R(5), 0, 0))
kf('Neck1', 48, rot_euler=(R(5), 0, 0))
print("dive done")

# === BANK LEFT (48 frames) ===
new_action("bankLeft")
BEAT_B = 16
for beat in range(4):
    f = beat * BEAT_B
    kf('L_WingShoulder', f, rot_euler=(R(20), 0, R(-5)))
    kf('L_WingShoulder', f + BEAT_B//2, rot_euler=(R(-20), 0, R(5)))
    kf('R_WingShoulder', f, rot_euler=(R(45), 0, R(10)))
    kf('R_WingShoulder', f + BEAT_B//2, rot_euler=(R(-45), 0, R(-10)))
    kf('L_WingElbow', f, rot_euler=(R(-5), 0, 0))
    kf('R_WingElbow', f, rot_euler=(R(-10), 0, 0))
    kf('L_WingElbow', f + BEAT_B//2, rot_euler=(R(8), 0, 0))
    kf('R_WingElbow', f + BEAT_B//2, rot_euler=(R(15), 0, 0))
    kf('Body', f, loc=(0, 0, R(-2)))
    kf('Body', f + BEAT_B//2, loc=(0, 0, R(2)))

kf('Neck2', 0, rot_euler=(0, R(-8), 0))
kf('Neck2', 48, rot_euler=(0, R(-8), 0))
kf('Tail1', 0, rot_euler=(0, 0, R(5)))
kf('Tail1', 48, rot_euler=(0, 0, R(5)))
kf('L_Thigh', 0, rot_euler=(R(-20), 0, 0))
kf('R_Thigh', 0, rot_euler=(R(-20), 0, 0))
kf('L_Calf', 0, rot_euler=(R(40), 0, 0))
kf('R_Calf', 0, rot_euler=(R(40), 0, 0))
kf('L_Thigh', 48, rot_euler=(R(-20), 0, 0))
kf('R_Thigh', 48, rot_euler=(R(-20), 0, 0))
kf('L_Calf', 48, rot_euler=(R(40), 0, 0))
kf('R_Calf', 48, rot_euler=(R(40), 0, 0))
print("bankLeft done")

# === BANK RIGHT (48 frames) ===
new_action("bankRight")
for beat in range(4):
    f = beat * BEAT_B
    kf('R_WingShoulder', f, rot_euler=(R(20), 0, R(5)))
    kf('R_WingShoulder', f + BEAT_B//2, rot_euler=(R(-20), 0, R(-5)))
    kf('L_WingShoulder', f, rot_euler=(R(45), 0, R(-10)))
    kf('L_WingShoulder', f + BEAT_B//2, rot_euler=(R(-45), 0, R(10)))
    kf('R_WingElbow', f, rot_euler=(R(-5), 0, 0))
    kf('L_WingElbow', f, rot_euler=(R(-10), 0, 0))
    kf('R_WingElbow', f + BEAT_B//2, rot_euler=(R(8), 0, 0))
    kf('L_WingElbow', f + BEAT_B//2, rot_euler=(R(15), 0, 0))
    kf('Body', f, loc=(0, 0, R(-2)))
    kf('Body', f + BEAT_B//2, loc=(0, 0, R(2)))

kf('Neck2', 0, rot_euler=(0, R(8), 0))
kf('Neck2', 48, rot_euler=(0, R(8), 0))
kf('Tail1', 0, rot_euler=(0, 0, R(-5)))
kf('Tail1', 48, rot_euler=(0, 0, R(-5)))
kf('L_Thigh', 0, rot_euler=(R(-20), 0, 0))
kf('R_Thigh', 0, rot_euler=(R(-20), 0, 0))
kf('L_Calf', 0, rot_euler=(R(40), 0, 0))
kf('R_Calf', 0, rot_euler=(R(40), 0, 0))
kf('L_Thigh', 48, rot_euler=(R(-20), 0, 0))
kf('R_Thigh', 48, rot_euler=(R(-20), 0, 0))
kf('L_Calf', 48, rot_euler=(R(40), 0, 0))
kf('R_Calf', 48, rot_euler=(R(40), 0, 0))
print("bankRight done")

result = {'status': 'Flight clips authored', 'actions': [a.name for a in bpy.data.actions]}
