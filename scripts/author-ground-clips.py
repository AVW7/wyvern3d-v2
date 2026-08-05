import bpy, math
from mathutils import Quaternion

ARM = bpy.data.objects.get("WyvernRig")
R = math.radians

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

# Ground clip amplitudes derived from v1 source measurements:
# Battle_Stand (idle): planted, ~1.5 unit breath oscillation
# Battle_Walk: quadrupedal, wing knuckles participate
# Sanct_Rest: low injured rest, panting jaw
# Battle_Attack06: planted snap-bite, rear then thrust
# Battle_Skill03: breath wind-up then forward thrust
# Battle_Up: takeoff crouch to unfurl to downstroke
# Battle_Down02: airborne landing, terminal matches takeoff opening
# Death: collapse in place

# === IDLE (144 frames, planted breathing with wing settle) ===
new_action("idle")
BREATH_CYCLES = 4
CYCLE_LEN = 36  # frames per breath cycle
for cyc in range(BREATH_CYCLES + 1):
    f = cyc * CYCLE_LEN
    # Breathing: slight body rise/fall
    kf('Body', f, loc=(0, 0, 0))
    kf('Body', f + CYCLE_LEN//2, loc=(0, 0, R(1.5)))
    # Neck settles with breath
    kf('Neck1', f, rot_euler=(R(1), 0, 0))
    kf('Neck1', f + CYCLE_LEN//2, rot_euler=(R(-1), 0, 0))
    # Folded wings settle slightly
    kf('L_WingShoulder', f, rot_euler=(R(-15), 0, R(25)))
    kf('R_WingShoulder', f, rot_euler=(R(-15), 0, R(-25)))
    kf('L_WingElbow', f, rot_euler=(R(30), 0, 0))
    kf('R_WingElbow', f, rot_euler=(R(30), 0, 0))
    kf('L_WingShoulder', f + CYCLE_LEN//2, rot_euler=(R(-14), 0, R(24)))
    kf('R_WingShoulder', f + CYCLE_LEN//2, rot_euler=(R(-14), 0, R(-24)))
    # Head attention drift
    kf('Head', f, rot_euler=(0, R(0.5), 0))
    kf('Head', f + CYCLE_LEN//2, rot_euler=(0, R(-0.5), 0))
    # Tail drift
    kf('Tail1', f, rot_euler=(0, 0, R(0.5)))
    kf('Tail1', f + CYCLE_LEN//2, rot_euler=(0, 0, R(-0.5)))

print("idle done")

# === WALK (36 frames, quadrupedal with wing knuckle contact) ===
new_action("walk")
STEP = 18  # 2 steps in 36 frames
# Wing knuckles alternate contact: L steps while R holds, then vice versa
for step in range(3):
    f = step * STEP
    # Left side forward step
    kf('L_WingShoulder', f, rot_euler=(R(-25), 0, R(15)))
    kf('L_WingShoulder', f + STEP//2, rot_euler=(R(-20), 0, R(20)))
    kf('R_WingShoulder', f, rot_euler=(R(-20), 0, R(-20)))
    kf('R_WingShoulder', f + STEP//2, rot_euler=(R(-25), 0, R(-15)))
    # Right side forward step (counter-phase)
    kf('R_WingShoulder', f + STEP//4, rot_euler=(R(-22), 0, R(-18)))
    kf('L_WingShoulder', f + STEP//4 + STEP//2, rot_euler=(R(-22), 0, R(18)))
    # Body weight transfer
    kf('Body', f, loc=(0, 0, R(2)))
    kf('Body', f + STEP//2, loc=(0, 0, R(-1)))
    # Legs alternate
    kf('L_Thigh', f, rot_euler=(R(5), 0, 0))
    kf('L_Thigh', f + STEP//2, rot_euler=(R(-10), 0, 0))
    kf('R_Thigh', f, rot_euler=(R(-10), 0, 0))
    kf('R_Thigh', f + STEP//2, rot_euler=(R(5), 0, 0))
    # Head bob
    kf('Neck1', f, rot_euler=(R(1), 0, 0))
    kf('Neck1', f + STEP//2, rot_euler=(R(-1), 0, 0))
    # Tail sway
    kf('Tail1', f, rot_euler=(0, 0, R(1.5)))
    kf('Tail1', f + STEP//2, rot_euler=(0, 0, R(-1.5)))

# Folded wing base
kf('L_WingElbow', 0, rot_euler=(R(25), 0, 0))
kf('R_WingElbow', 0, rot_euler=(R(25), 0, 0))
kf('L_WingElbow', 36, rot_euler=(R(25), 0, 0))
kf('R_WingElbow', 36, rot_euler=(R(25), 0, 0))
print("walk done")

# === REST (144 frames, low injured rest with panting jaw) ===
new_action("rest")
PANT_CYC = 24  # 6 pant cycles in 144 frames
# Low body posture
kf('Body', 0, rot_euler=(R(8), 0, 0), loc=(0, R(-50), 0))
kf('Body', 144, rot_euler=(R(8), 0, 0), loc=(0, R(-50), 0))

for cyc in range(7):
    f = cyc * PANT_CYC
    # Panting jaw
    kf('Jaw', f, rot_euler=(R(-15), 0, 0))
    kf('Jaw', f + PANT_CYC//2, rot_euler=(R(-8), 0, 0))
    # Laboured breath
    kf('Body', f, loc=(0, R(-50), R(-2)))
    kf('Body', f + PANT_CYC//2, loc=(0, R(-50), R(1)))
    # Head and tail counter-motion
    kf('Neck1', f, rot_euler=(R(-2), 0, 0))
    kf('Neck1', f + PANT_CYC//2, rot_euler=(R(1), 0, 0))
    kf('Tail1', f, rot_euler=(R(-1), 0, 0))
    kf('Tail1', f + PANT_CYC//2, rot_euler=(R(0.5), 0, 0))

# Folded wings, settled
kf('L_WingShoulder', 0, rot_euler=(R(-20), 0, R(30)))
kf('R_WingShoulder', 0, rot_euler=(R(-20), 0, R(-30)))
kf('L_WingElbow', 0, rot_euler=(R(35), 0, 0))
kf('R_WingElbow', 0, rot_euler=(R(35), 0, 0))
kf('L_WingShoulder', 144, rot_euler=(R(-20), 0, R(30)))
kf('R_WingShoulder', 144, rot_euler=(R(-20), 0, R(-30)))
kf('L_WingElbow', 144, rot_euler=(R(35), 0, 0))
kf('R_WingElbow', 144, rot_euler=(R(35), 0, 0))
# Legs relaxed, planted
kf('L_Thigh', 0, rot_euler=(R(15), 0, 0))
kf('R_Thigh', 0, rot_euler=(R(15), 0, 0))
kf('L_Calf', 0, rot_euler=(R(-20), 0, 0))
kf('R_Calf', 0, rot_euler=(R(-20), 0, 0))
kf('L_Thigh', 144, rot_euler=(R(15), 0, 0))
kf('R_Thigh', 144, rot_euler=(R(15), 0, 0))
kf('L_Calf', 144, rot_euler=(R(-20), 0, 0))
kf('R_Calf', 144, rot_euler=(R(-20), 0, 0))
print("rest done")

# === ATTACK (24 frames, planted snap-bite) ===
new_action("attack")
# Frame 0: wind-up pose (rear back)
kf('Body', 0, rot_euler=(R(-15), 0, 0))
kf('Neck1', 0, rot_euler=(R(-20), 0, 0))
kf('Neck2', 0, rot_euler=(R(-15), 0, 0))
kf('Jaw', 0, rot_euler=(R(-10), 0, 0))
# Frame 8: thrust forward
kf('Body', 8, rot_euler=(R(10), 0, 0))
kf('Neck1', 8, rot_euler=(R(25), 0, 0))
kf('Neck2', 8, rot_euler=(R(20), 0, 0))
kf('Jaw', 8, rot_euler=(R(-30), 0, 0))
kf('Head', 8, rot_euler=(R(10), 0, 0))
# Frame 16: recovery
kf('Body', 16, rot_euler=(R(-5), 0, 0))
kf('Neck1', 16, rot_euler=(R(0), 0, 0))
kf('Neck2', 16, rot_euler=(R(-5), 0, 0))
kf('Jaw', 16, rot_euler=(R(-5), 0, 0))
# Frame 24: settle back
kf('Body', 24, rot_euler=(R(0), 0, 0))
kf('Neck1', 24, rot_euler=(R(0), 0, 0))
kf('Neck2', 24, rot_euler=(R(0), 0, 0))
kf('Jaw', 24, rot_euler=(R(0), 0, 0))

# Folded wings throughout
for f in [0, 8, 16, 24]:
    kf('L_WingShoulder', f, rot_euler=(R(-15), 0, R(20)))
    kf('R_WingShoulder', f, rot_euler=(R(-15), 0, R(-20)))
    kf('L_WingElbow', f, rot_euler=(R(25), 0, 0))
    kf('R_WingElbow', f, rot_euler=(R(25), 0, 0))

# Planted legs
kf('L_Thigh', 0, rot_euler=(R(0), 0, 0))
kf('R_Thigh', 0, rot_euler=(R(0), 0, 0))
kf('L_Thigh', 24, rot_euler=(R(0), 0, 0))
kf('R_Thigh', 24, rot_euler=(R(0), 0, 0))
print("attack done")

# === BREATH (48 frames, planted breath weapon wind-up to thrust) ===
new_action("breath")
# Frame 0: idle
kf('Body', 0, rot_euler=(R(0), 0, 0))
kf('Neck1', 0, rot_euler=(R(0), 0, 0))
kf('Jaw', 0, rot_euler=(R(0), 0, 0))
# Frame 12: wind-up (rear back, chest expand)
kf('Body', 12, rot_euler=(R(-10), 0, 0))
kf('Neck1', 12, rot_euler=(R(-15), 0, 0))
kf('Neck2', 12, rot_euler=(R(-10), 0, 0))
kf('Jaw', 12, rot_euler=(R(-5), 0, 0))
# Frame 24: held forward thrust (flame window)
kf('Body', 24, rot_euler=(R(5), 0, 0))
kf('Neck1', 24, rot_euler=(R(20), 0, 0))
kf('Neck2', 24, rot_euler=(R(15), 0, 0))
kf('Jaw', 24, rot_euler=(R(-35), 0, 0))
kf('Head', 24, rot_euler=(R(5), 0, 0))
# Frame 36: hold thrust
kf('Body', 36, rot_euler=(R(5), 0, 0))
kf('Neck1', 36, rot_euler=(R(18), 0, 0))
kf('Neck2', 36, rot_euler=(R(13), 0, 0))
kf('Jaw', 36, rot_euler=(R(-30), 0, 0))
# Frame 48: recover
kf('Body', 48, rot_euler=(R(0), 0, 0))
kf('Neck1', 48, rot_euler=(R(0), 0, 0))
kf('Neck2', 48, rot_euler=(R(0), 0, 0))
kf('Jaw', 48, rot_euler=(R(0), 0, 0))

# Folded wings throughout
for f in [0, 12, 24, 36, 48]:
    kf('L_WingShoulder', f, rot_euler=(R(-15), 0, R(22)))
    kf('R_WingShoulder', f, rot_euler=(R(-15), 0, R(-22)))
    kf('L_WingElbow', f, rot_euler=(R(28), 0, 0))
    kf('R_WingElbow', f, rot_euler=(R(28), 0, 0))
    kf('L_Thigh', f, rot_euler=(R(0), 0, 0))
    kf('R_Thigh', f, rot_euler=(R(0), 0, 0))
print("breath done")

# === TAKEOFF (60 frames, crouch to unfurl to downstroke) ===
new_action("takeoff")
# Phase 1 (f0-15): crouch, folded
kf('Body', 0, rot_euler=(R(10), 0, 0), loc=(0, 0, R(-5)))
kf('L_WingShoulder', 0, rot_euler=(R(-30), 0, R(30)))
kf('R_WingShoulder', 0, rot_euler=(R(-30), 0, R(-30)))
kf('L_WingElbow', 0, rot_euler=(R(40), 0, 0))
kf('R_WingElbow', 0, rot_euler=(R(40), 0, 0))
kf('L_Thigh', 0, rot_euler=(R(-20), 0, 0))
kf('R_Thigh', 0, rot_euler=(R(-20), 0, 0))
kf('L_Calf', 0, rot_euler=(R(30), 0, 0))
kf('R_Calf', 0, rot_euler=(R(30), 0, 0))
# Phase 2 (f15-30): unfurl wings, body rising
kf('Body', 15, rot_euler=(R(-5), 0, 0), loc=(0, 0, R(0)))
kf('L_WingShoulder', 15, rot_euler=(R(10), 0, R(-5)))
kf('R_WingShoulder', 15, rot_euler=(R(10), 0, R(5)))
kf('L_WingElbow', 15, rot_euler=(R(0), 0, 0))
kf('R_WingElbow', 15, rot_euler=(R(0), 0, 0))
kf('Neck1', 15, rot_euler=(R(-10), 0, 0))
# Phase 3 (f30-45): big downstroke
kf('Body', 30, rot_euler=(R(-10), 0, 0), loc=(0, 0, R(5)))
kf('L_WingShoulder', 30, rot_euler=(R(50), 0, R(-15)))
kf('R_WingShoulder', 30, rot_euler=(R(50), 0, R(15)))
kf('Neck1', 30, rot_euler=(R(-5), 0, 0))
# Phase 4 (f45-60): spread, extended (terminal flight pose)
kf('Body', 45, rot_euler=(R(-15), 0, 0), loc=(0, 0, R(8)))
kf('L_WingShoulder', 45, rot_euler=(R(0), 0, R(-10)))
kf('R_WingShoulder', 45, rot_euler=(R(0), 0, R(10)))

kf('Body', 60, rot_euler=(R(-10), 0, 0), loc=(0, 0, R(10)))
kf('L_WingShoulder', 60, rot_euler=(R(20), 0, R(-10)))
kf('R_WingShoulder', 60, rot_euler=(R(20), 0, R(10)))
kf('L_WingElbow', 60, rot_euler=(R(-5), 0, 0))
kf('R_WingElbow', 60, rot_euler=(R(-5), 0, 0))
kf('Neck1', 60, rot_euler=(R(-3), 0, 0))
kf('L_Thigh', 60, rot_euler=(R(-15), 0, 0))
kf('R_Thigh', 60, rot_euler=(R(-15), 0, 0))
kf('L_Calf', 60, rot_euler=(R(30), 0, 0))
kf('R_Calf', 60, rot_euler=(R(30), 0, 0))
kf('Tail1', 60, rot_euler=(R(-5), 0, 0))
print("takeoff done")

# === LAND (72 frames, airborne braking to ground settle) ===
new_action("land")
# Phase 1 (f0-24): airborne, wings spread braking
kf('Body', 0, rot_euler=(R(-20), 0, 0), loc=(0, 0, R(10)))
kf('L_WingShoulder', 0, rot_euler=(R(20), 0, R(-10)))
kf('R_WingShoulder', 0, rot_euler=(R(20), 0, R(10)))
kf('L_WingElbow', 0, rot_euler=(R(-5), 0, 0))
kf('R_WingElbow', 0, rot_euler=(R(-5), 0, 0))
kf('L_Thigh', 0, rot_euler=(R(-10), 0, 0))
kf('R_Thigh', 0, rot_euler=(R(-10), 0, 0))
kf('L_Calf', 0, rot_euler=(R(20), 0, 0))
kf('R_Calf', 0, rot_euler=(R(20), 0, 0))
# Phase 2 (f24-48): approach, legs extend
kf('Body', 24, rot_euler=(R(-10), 0, 0), loc=(0, 0, R(5)))
kf('L_WingShoulder', 24, rot_euler=(R(40), 0, R(-15)))
kf('R_WingShoulder', 24, rot_euler=(R(40), 0, R(15)))
kf('Neck1', 24, rot_euler=(R(10), 0, 0))
kf('L_Thigh', 24, rot_euler=(R(15), 0, 0))
kf('R_Thigh', 24, rot_euler=(R(15), 0, 0))
kf('L_Calf', 24, rot_euler=(R(-10), 0, 0))
kf('R_Calf', 24, rot_euler=(R(-10), 0, 0))
# Phase 3 (f48-72): contact, fold wings, settle to idle
kf('Body', 48, rot_euler=(R(5), 0, 0), loc=(0, 0, R(-2)))
kf('L_WingShoulder', 48, rot_euler=(R(-10), 0, R(15)))
kf('R_WingShoulder', 48, rot_euler=(R(-10), 0, R(-15)))
kf('Neck1', 48, rot_euler=(R(5), 0, 0))
kf('L_Thigh', 48, rot_euler=(R(5), 0, 0))
kf('R_Thigh', 48, rot_euler=(R(5), 0, 0))

kf('Body', 72, rot_euler=(R(0), 0, 0), loc=(0, 0, R(0)))
kf('L_WingShoulder', 72, rot_euler=(R(-15), 0, R(25)))
kf('R_WingShoulder', 72, rot_euler=(R(-15), 0, R(-25)))
kf('L_WingElbow', 72, rot_euler=(R(30), 0, 0))
kf('R_WingElbow', 72, rot_euler=(R(30), 0, 0))
kf('Neck1', 72, rot_euler=(R(0), 0, 0))
kf('L_Thigh', 72, rot_euler=(R(0), 0, 0))
kf('R_Thigh', 72, rot_euler=(R(0), 0, 0))
kf('L_Calf', 72, rot_euler=(R(0), 0, 0))
kf('R_Calf', 72, rot_euler=(R(0), 0, 0))
kf('Tail1', 72, rot_euler=(R(0), 0, 0))
print("land done")

# === DEATH (96 frames, collapse in place) ===
new_action("death")
# Phase 1 (f0-24): rear back in death throe
kf('Body', 0, rot_euler=(R(-20), 0, 0))
kf('Neck1', 0, rot_euler=(R(-25), 0, 0))
kf('Jaw', 0, rot_euler=(R(-40), 0, 0))
kf('L_WingShoulder', 0, rot_euler=(R(-15), 0, R(20)))
kf('R_WingShoulder', 0, rot_euler=(R(-15), 0, R(-20)))
# Phase 2 (f24-60): wings spread in spasm
kf('Body', 24, rot_euler=(R(-30), 0, 0))
kf('Neck1', 24, rot_euler=(R(-35), 0, 0))
kf('Jaw', 24, rot_euler=(R(-60), 0, 0))
kf('L_WingShoulder', 24, rot_euler=(R(30), 0, R(-10)))
kf('R_WingShoulder', 24, rot_euler=(R(30), 0, R(10)))
kf('Tail1', 24, rot_euler=(R(-10), 0, R(10)))
# Phase 3 (f60-96): collapse, terminal pose
kf('Body', 60, rot_euler=(R(30), 0, 0), loc=(0, R(-80), R(-20)))
kf('Neck1', 60, rot_euler=(R(20), 0, 0))
kf('Jaw', 60, rot_euler=(R(-20), 0, 0))
kf('L_WingShoulder', 60, rot_euler=(R(-40), 0, R(35)))
kf('R_WingShoulder', 60, rot_euler=(R(-40), 0, R(-35)))
kf('L_WingElbow', 60, rot_euler=(R(45), 0, 0))
kf('R_WingElbow', 60, rot_euler=(R(45), 0, 0))
kf('Tail1', 60, rot_euler=(R(15), 0, R(-5)))

kf('Body', 96, rot_euler=(R(45), 0, 0), loc=(0, R(-100), R(-30)))
kf('Neck1', 96, rot_euler=(R(30), 0, 0))
kf('Neck2', 96, rot_euler=(R(20), 0, 0))
kf('Jaw', 96, rot_euler=(R(-10), 0, 0))
kf('L_WingShoulder', 96, rot_euler=(R(-45), 0, R(40)))
kf('R_WingShoulder', 96, rot_euler=(R(-45), 0, R(-40)))
kf('L_WingElbow', 96, rot_euler=(R(50), 0, 0))
kf('R_WingElbow', 96, rot_euler=(R(50), 0, 0))
kf('Tail1', 96, rot_euler=(R(20), 0, R(-8)))
kf('L_Thigh', 96, rot_euler=(R(30), 0, 0))
kf('R_Thigh', 96, rot_euler=(R(30), 0, 0))
kf('L_Calf', 96, rot_euler=(R(-20), 0, 0))
kf('R_Calf', 96, rot_euler=(R(-20), 0, 0))
print("death done")

result = {'status': 'All clips authored', 'actions': sorted([a.name for a in bpy.data.actions])}
