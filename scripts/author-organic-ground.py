import bpy, math
from mathutils import Quaternion

ARM = bpy.data.objects.get("WyvernRig")
R = math.radians

if bpy.context.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')
bpy.context.view_layer.objects.active = ARM
ARM.select_set(True)
bpy.ops.object.mode_set(mode='POSE')

# Keep flight clips, delete only ground clips
for name in ['idle', 'walk', 'rest', 'attack', 'breath', 'takeoff', 'land', 'death']:
    old = bpy.data.actions.get(name)
    if old:
        bpy.data.actions.remove(old)

def reset_pose():
    for pb in ARM.pose.bones:
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = Quaternion((1, 0, 0, 0))
        pb.location = (0, 0, 0)

def new_action(name):
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    ARM.animation_data_create()
    ARM.animation_data.action = action
    reset_pose()
    return action

def kf(name, frame, rot=(0,0,0), loc=(0,0,0)):
    pb = ARM.pose.bones.get(name)
    if not pb: return
    pb.rotation_mode = 'QUATERNION'
    pb.rotation_quaternion = Quaternion(rot)
    pb.location = loc
    pb.keyframe_insert(data_path="rotation_quaternion", frame=frame)
    pb.keyframe_insert(data_path="location", frame=frame)

WING_BONES_L = ['L_WingShoulder', 'L_WingElbow', 'L_WingWrist',
                'L_WingFinger1', 'L_WingFinger2', 'L_WingFinger3']
WING_BONES_R = ['R_WingShoulder', 'R_WingElbow', 'R_WingWrist',
                'R_WingFinger1', 'R_WingFinger2', 'R_WingFinger3']
TAIL_BONES = ['Tail1','Tail2','Tail3','Tail4','Tail5','Tail6','Tail7','Tail8','Tail9','Tail10']

def kf_wing_fold(frame: int, up: float=35, sweep: float=30, elbow: float=45,
                 wrist: float=8, f1: float=14, f2: float=11, f3: float=8,
                 fold: float=1.0):
    # Quadrupedal ground posture: high shoulder arch peak, elbow dropped to ground, inner claw supporting weight.
    for side in ['L', 'R']:
        zs = -sweep if side == 'R' else sweep
        w_z = 25.0 * fold if side == 'R' else -25.0 * fold
        f1z = -f1 if side == 'R' else f1
        f2z = -f2 if side == 'R' else f2
        f3z = -f3 if side == 'R' else f3
        bones = WING_BONES_L if side == 'L' else WING_BONES_R
        rots = [(R(up), 0, R(zs)),
                (R(elbow), 0, 0),
                (R(wrist), 0, R(w_z)),
                (R(-48 * fold), 0, R(f1z)),
                (R(-36 * fold), 0, R(f2z)),
                (R(-24 * fold), 0, R(f3z))]
        for bn, rt in zip(bones, rots):
            pb = ARM.pose.bones.get(bn)
            if pb:
                pb.rotation_mode = 'QUATERNION'
                pb.rotation_quaternion = Quaternion(rt)
                pb.location = (0,0,0)
                pb.keyframe_insert(data_path="rotation_quaternion", frame=frame)
                pb.keyframe_insert(data_path="location", frame=frame)

# === IDLE (144f, 6s, 25 bones multi-harmonic) ===
import os, subprocess
exec(open('scripts/author-wyvern-idle-blender.py').read())
idle_act = build(armature())
idle_act.use_fake_user = True
print("  idle done")

# === WALK (59f / 2.458s, quadrupedal with wing knuckle contact & v1 landmark keyframes) ===
new_action("walk")
WALK_F = 59
for f in range(0, WALK_F + 1, 1):
    t = f / WALK_F  # 0..1
    # Phase cycle: 0..2*pi
    cycle = t * 2 * math.pi
    
    # Weight transfer & sway based on measured v1 landmarks
    step_l = math.sin(cycle)
    step_r = math.sin(cycle + math.pi)
    bob = math.sin(2 * cycle)
    
    # Lateral pelvis sway matching v1 landmarks (+1.08 -> -0.56 -> +1.31 -> +1.13)
    pelvis_sway = 1.2 * math.sin(cycle + 0.4)
    pelvis_lift = 1.5 * math.sin(2 * cycle)

    # Body weight transfer & quadrupedal nose-down pitch (-7.0° mean)
    kf('Body', f, loc=(R(pelvis_sway), 0, R(pelvis_lift)), rot=(R(-7.0 + 1.8 * bob), R(1.5 * step_l), 0))
    kf('Spine1', f, rot=(R(1.2 * bob), 0, 0))
    kf('Spine2', f, rot=(R(0.8 * bob), 0, 0))
    kf('Spine3', f, rot=(R(0.4 * bob), 0, 0))

    # Wing knuckles alternate stance contact
    l_sh = -20 + 6 * step_l
    r_sh = -20 + 6 * step_r
    l_sw = 22 + 4 * step_l
    r_sw = -22 - 4 * step_r
    for side, sh_x, sw_z in [('L', l_sh, l_sw), ('R', r_sh, r_sw)]:
        bones = WING_BONES_L if side == 'L' else WING_BONES_R
        step_val = step_l if side == 'L' else step_r
        rots = [(R(sh_x), 0, R(sw_z)), (R(28 + 4 * step_val), 0, 0), (R(5), 0, 0),
                (0, 0, R(10)), (0, 0, R(8)), (0, 0, R(6))]
        for bn, rt in zip(bones, rots):
            pb = ARM.pose.bones.get(bn)
            if pb:
                pb.rotation_mode = 'QUATERNION'
                pb.rotation_quaternion = Quaternion(rt)
                pb.location = (0,0,0)
                pb.keyframe_insert(data_path="rotation_quaternion", frame=f)
                pb.keyframe_insert(data_path="location", frame=f)

    # Hind limbs: alternating stance/swing
    kf('L_Thigh', f, rot=(R(12 * step_l), 0, 0))
    kf('R_Thigh', f, rot=(R(12 * step_r), 0, 0))
    kf('L_Calf', f, rot=(R(-16 * step_l), 0, 0))
    kf('R_Calf', f, rot=(R(-16 * step_r), 0, 0))
    kf('L_Foot', f, rot=(R(4 * step_l), 0, 0))
    kf('R_Foot', f, rot=(R(4 * step_r), 0, 0))

    # Toe articulation: splay on stance (step < 0), curl on swing (step > 0)
    l_toe_curl = R(28 * step_l) if step_l > 0 else R(12 * step_l)
    r_toe_curl = R(28 * step_r) if step_r > 0 else R(12 * step_r)
    kf('L_Toes', f, rot=(l_toe_curl, 0, 0))
    kf('R_Toes', f, rot=(r_toe_curl, 0, 0))

    # Head bob & neck counter-sway
    kf('Neck1', f, rot=(R(2.0 * bob), R(-1.2 * step_l), 0))
    kf('Neck2', f, rot=(R(1.2 * bob), R(-0.8 * step_l), 0))
    kf('Head', f, rot=(R(0.8 * bob), 0, 0))

    # Tail counterbalance sway
    for ti, tb in enumerate(TAIL_BONES):
        decay = 1.0 - ti * 0.07
        kf(tb, f, rot=(0, 0, R(2.2 * step_l * decay)))

print("  walk done")

# === REST (144f, low injured panting) ===
new_action("rest")
for f in range(0, 145, 3):
    pant = math.sin(f * 2 * math.pi / 24)  # 6 pant cycles in 144f
    breath = math.sin(f * 2 * math.pi / 144)

    kf('Body', f, rot=(R(8 + 0.5 * breath), 0, 0),
       loc=(0, R(-50), R(-3 + 2 * pant)))
    kf('Spine1', f, rot=(R(3 + 0.3 * breath), 0, 0))
    kf('Spine2', f, rot=(R(2 + 0.2 * breath), 0, 0))
    kf('Spine3', f, rot=(R(1 + 0.1 * breath), 0, 0))

    # Panting jaw
    kf('Jaw', f, rot=(R(-12 + 8 * abs(pant)), 0, 0))

    # Head and neck counter-motion
    kf('Neck1', f, rot=(R(-2 + 1.5 * breath), 0, 0))
    kf('Neck2', f, rot=(R(-1 + 1.0 * breath), 0, 0))
    kf('Head', f, rot=(R(-0.5 + 0.5 * breath), R(0.3 * pant), 0))

    # Folded wings, settled
    kf_wing_fold(f, up=-20 + 0.5 * breath, sweep=30, elbow=35)

    # Tail drift
    for ti, tb in enumerate(TAIL_BONES):
        decay = 1.0 - ti * 0.08
        kf(tb, f, rot=(R(-1 + 0.5 * breath * decay), 0, R(0.3 * pant * decay)))

    # Legs relaxed
    kf('L_Thigh', f, rot=(R(15 + 0.3 * breath), 0, 0))
    kf('R_Thigh', f, rot=(R(15 + 0.3 * breath), 0, 0))
    kf('L_Calf', f, rot=(R(-20 + 0.2 * breath), 0, 0))
    kf('R_Calf', f, rot=(R(-20 + 0.2 * breath), 0, 0))

print("  rest done")

# === ATTACK (80f / 3.333s, v1 Battle_Attack06 snap-bite landmarks) ===
new_action("attack")
ATTACK_F = 80
for f in range(0, ATTACK_F + 1, 2):
    t = f / ATTACK_F
    if t < 0.25:
        # Phase 1 (f0-f20): Wind-up rear back & jaw open anticipation
        s = t / 0.25
        kf('Body', f, rot=(R(-18 * s), 0, 0), loc=(0, R(12 * s), R(-4 * s)))
        kf('Neck1', f, rot=(R(-25 * s), 0, 0))
        kf('Neck2', f, rot=(R(-20 * s), 0, 0))
        kf('Jaw', f, rot=(R(-15 * s), 0, 0))
        kf('Head', f, rot=(R(-5 * s), 0, 0))
        kf('L_Toes', f, rot=(R(-18 * s), 0, 0))
        kf('R_Toes', f, rot=(R(-18 * s), 0, 0))
    elif t < 0.50:
        # Phase 2 (f20-f40): Lunge forward, head thrust low & snap bite
        s = (t - 0.25) / 0.25
        kf('Body', f, rot=(R(-18 + 28 * s), 0, 0), loc=(0, R(12 - 24 * s), R(-4 + 8 * s)))
        kf('Neck1', f, rot=(R(-20 + 50 * s), 0, 0))
        kf('Neck2', f, rot=(R(-15 + 40 * s), 0, 0))
        kf('Jaw', f, rot=(R(-15 - 35 * (1 - s)), 0, 0))  # Jaw snaps shut at f40
        kf('Head', f, rot=(R(12 * s), 0, 0))
        kf('L_Toes', f, rot=(R(-18 - 18 * s), 0, 0))
        kf('R_Toes', f, rot=(R(-18 - 18 * s), 0, 0))
    elif t < 0.75:
        # Phase 3 (f40-f60): Impact hold & bite follow-through
        s = (t - 0.50) / 0.25
        kf('Body', f, rot=(R(10 - 2 * s), 0, 0), loc=(0, R(-12 + 2 * s), R(4 - 1 * s)))
        kf('Neck1', f, rot=(R(30 - 5 * s), 0, 0))
        kf('Neck2', f, rot=(R(25 - 5 * s), 0, 0))
        kf('Jaw', f, rot=(R(-45 + 10 * s), 0, 0))
        kf('Head', f, rot=(R(12 - 2 * s), 0, 0))
        kf('L_Toes', f, rot=(R(-36 + 6 * s), 0, 0))
        kf('R_Toes', f, rot=(R(-36 + 6 * s), 0, 0))
    else:
        # Phase 4 (f60-f80): Smooth recovery to neutral stance
        s = (t - 0.75) / 0.25
        kf('Body', f, rot=(R(8 - 8 * s), 0, 0), loc=(0, R(-10 + 10 * s), R(3 - 3 * s)))
        kf('Neck1', f, rot=(R(25 - 25 * s), 0, 0))
        kf('Neck2', f, rot=(R(20 - 20 * s), 0, 0))
        kf('Jaw', f, rot=(R(-35 + 35 * s), 0, 0))
        kf('Head', f, rot=(R(10 - 10 * s), 0, 0))
        kf('L_Toes', f, rot=(R(-30 + 30 * s), 0, 0))
        kf('R_Toes', f, rot=(R(-30 + 30 * s), 0, 0))

    kf_wing_fold(f, up=-15 + 4 * math.sin(f * math.pi / 10))

print("  attack done")

# === BREATH (48f, breath weapon) ===
new_action("breath")
for f in range(0, 49, 3):
    t = f / 48
    if t < 0.25:
        # Idle
        kf('Body', f, rot=(0, 0, 0))
        kf('Neck1', f, rot=(0, 0, 0))
        kf('Neck2', f, rot=(0, 0, 0))
        kf('Jaw', f, rot=(0, 0, 0))
        kf('L_Toes', f, rot=(0, 0, 0))
        kf('R_Toes', f, rot=(0, 0, 0))
    elif t < 0.5:
        # Wind-up
        s = (t - 0.25) / 0.25
        kf('Body', f, rot=(R(-10 * s), 0, 0))
        kf('Neck1', f, rot=(R(-15 * s), 0, 0))
        kf('Neck2', f, rot=(R(-10 * s), 0, 0))
        kf('Jaw', f, rot=(R(-5 * s), 0, 0))
        kf('L_Toes', f, rot=(R(-10 * s), 0, 0))
        kf('R_Toes', f, rot=(R(-10 * s), 0, 0))
    elif t < 0.85:
        # Held forward thrust (flame window)
        s = (t - 0.5) / 0.35
        kf('Body', f, rot=(R(-10 + 15 * s), 0, 0))
        kf('Neck1', f, rot=(R(-15 + 35 * s), 0, 0))
        kf('Neck2', f, rot=(R(-10 + 25 * s), 0, 0))
        kf('Jaw', f, rot=(R(-5 - 30 * s), 0, 0))
        kf('Head', f, rot=(R(5 * s), 0, 0))
        kf('L_Toes', f, rot=(R(-25), 0, 0))
        kf('R_Toes', f, rot=(R(-25), 0, 0))
    else:
        # Recover
        s = (t - 0.85) / 0.15
        kf('Body', f, rot=(R(5 - 5 * s), 0, 0))
        kf('Neck1', f, rot=(R(20 - 20 * s), 0, 0))
        kf('Neck2', f, rot=(R(15 - 15 * s), 0, 0))
        kf('Jaw', f, rot=(R(-35 + 35 * s), 0, 0))
        kf('Head', f, rot=(R(5 - 5 * s), 0, 0))
        kf('L_Toes', f, rot=(R(-25 + 25 * s), 0, 0))
        kf('R_Toes', f, rot=(R(-25 + 25 * s), 0, 0))

    kf_wing_fold(f, up=-15 + 2 * math.sin(f * math.pi / 6))

print("  breath done")

# === TAKEOFF (72f, crouch -> unfurl -> downstroke) ===
new_action("takeoff")
for f in range(0, 73, 3):
    t = f / 72
    if t < 0.2:
        # Crouch, folded
        s = t / 0.2
        kf('Body', f, rot=(R(10 * s), 0, 0), loc=(0, 0, R(-5 * s)))
        for side in ['L', 'R']:
            bones = WING_BONES_L if side == 'L' else WING_BONES_R
            zs = R(30) if side == 'L' else R(-30)
            rots = [(R(-30 * s), 0, zs * s if s > 0 else R(0)), (R(40 * s), 0, 0), (R(5), 0, R(-18 * s)),
                    (R(-32 * s),0,0),(R(-20 * s),0,0),(R(-12 * s),0,0)]
            for bn, rt in zip(bones, rots):
                pb = ARM.pose.bones.get(bn)
                if pb:
                    pb.rotation_mode = 'QUATERNION'
                    pb.rotation_quaternion = Quaternion(rt)
                    pb.keyframe_insert(data_path="rotation_quaternion", frame=f)
                    pb.keyframe_insert(data_path="location", frame=f)
        kf('L_Thigh', f, rot=(R(-20 * s), 0, 0))
        kf('R_Thigh', f, rot=(R(-20 * s), 0, 0))
        kf('Neck1', f, rot=(R(5 * s), 0, 0))
    elif t < 0.4:
        # Unfurl
        s = (t - 0.2) / 0.2
        kf('Body', f, rot=(R(10 - 15 * s), 0, 0), loc=(0, 0, R(-5 + 5 * s)))
        for side in ['L', 'R']:
            bones = WING_BONES_L if side == 'L' else WING_BONES_R
            zs = R(-5) if side == 'L' else R(5)
            rots = [(R(-30 + 40 * s), 0, R(30 - 50 * s) if side == 'L' else R(-30 + 50 * s)),
                    (R(40 - 40 * s), 0, 0), (R(0), 0, R(-18 * (1 - s))),
                    (R(-32 * (1 - s)),0,0),(R(-20 * (1 - s)),0,0),(R(-12 * (1 - s)),0,0)]
            for bn, rt in zip(bones, rots):
                pb = ARM.pose.bones.get(bn)
                if pb:
                    pb.rotation_mode = 'QUATERNION'
                    pb.rotation_quaternion = Quaternion(rt)
                    pb.keyframe_insert(data_path="rotation_quaternion", frame=f)
                    pb.keyframe_insert(data_path="location", frame=f)
        kf('Neck1', f, rot=(R(5 - 15 * s), 0, 0))
    elif t < 0.65:
        # Big downstroke
        s = (t - 0.4) / 0.25
        kf('Body', f, rot=(R(-5 - 5 * s), 0, 0), loc=(0, 0, R(5 * s)))
        for side in ['L', 'R']:
            bones = WING_BONES_L if side == 'L' else WING_BONES_R
            zs = R(-30 + 20 * s) if side == 'L' else R(30 - 20 * s)
            rots = [(R(10 - 60 * s), 0, zs), (R(-15 * s), 0, 0), (R(-5 * s), 0, R(-8 * (1 - s))),
                    (R(-14 * (1 - s)),0,R(-10 * s)),(R(-8 * (1 - s)),0,R(-8 * s)),
                    (R(-5 * (1 - s)),0,R(-6 * s))]
            for bn, rt in zip(bones, rots):
                pb = ARM.pose.bones.get(bn)
                if pb:
                    pb.rotation_mode = 'QUATERNION'
                    pb.rotation_quaternion = Quaternion(rt)
                    pb.keyframe_insert(data_path="rotation_quaternion", frame=f)
                    pb.keyframe_insert(data_path="location", frame=f)
        kf('Neck1', f, rot=(R(-10 + 5 * s), 0, 0))
        kf('L_Thigh', f, rot=(R(-20 + 5 * s), 0, 0))
        kf('R_Thigh', f, rot=(R(-20 + 5 * s), 0, 0))
    else:
        # Spread, settle into cruise
        s = (t - 0.65) / 0.35
        kf('Body', f, rot=(R(-10), 0, 0), loc=(0, 0, R(5 + 5 * s)))
        for side in ['L', 'R']:
            bones = WING_BONES_L if side == 'L' else WING_BONES_R
            zs = R(-20 + 15 * s) if side == 'L' else R(20 - 15 * s)
            rots = [(R(-50 + 70 * s), 0, zs), (R(-15 + 10 * s), 0, R(-5 * (1 - s))),
                    (R(-10 * (1 - s)),0,R(-10 + 5 * s)),(R(-6 * (1 - s)),0,R(-8 + 4 * s)),
                    (R(-4 * (1 - s)),0,R(-6 + 3 * s))]
            for bn, rt in zip(bones, rots):
                pb = ARM.pose.bones.get(bn)
                if pb:
                    pb.rotation_mode = 'QUATERNION'
                    pb.rotation_quaternion = Quaternion(rt)
                    pb.keyframe_insert(data_path="rotation_quaternion", frame=f)
                    pb.keyframe_insert(data_path="location", frame=f)
        kf('Neck1', f, rot=(R(-5 - 2 * s), 0, 0))
        kf('Tail1', f, rot=(R(-5 * s), 0, 0))

print("  takeoff done")

# === LAND (72f, airborne braking -> contact -> fold) ===
new_action("land")
for f in range(0, 73, 3):
    t = f / 72
    if t < 0.33:
        # Airborne braking
        s = t / 0.33
        kf('Body', f, rot=(R(-20 + 10 * s), 0, 0), loc=(0, 0, R(10 - 5 * s)))
        for side in ['L', 'R']:
            bones = WING_BONES_L if side == 'L' else WING_BONES_R
            zs = R(-45 + 15 * s) if side == 'L' else R(45 - 15 * s)
            rots = [(R(20 + 20 * s), 0, zs), (R(-5), 0, 0), (R(-3), 0, R(-3 * s)),
                    (R(-5 * s),0,R(5)),(R(-3 * s),0,R(4)),(R(-2 * s),0,R(3))]
            for bn, rt in zip(bones, rots):
                pb = ARM.pose.bones.get(bn)
                if pb:
                    pb.rotation_mode = 'QUATERNION'
                    pb.rotation_quaternion = Quaternion(rt)
                    pb.keyframe_insert(data_path="rotation_quaternion", frame=f)
                    pb.keyframe_insert(data_path="location", frame=f)
        kf('Neck1', f, rot=(R(10 * s), 0, 0))
        kf('L_Thigh', f, rot=(R(-10 + 25 * s), 0, 0))
        kf('R_Thigh', f, rot=(R(-10 + 25 * s), 0, 0))
        kf('L_Calf', f, rot=(R(20 - 30 * s), 0, 0))
        kf('R_Calf', f, rot=(R(20 - 30 * s), 0, 0))
    elif t < 0.66:
        # Contact, legs absorb
        s = (t - 0.33) / 0.33
        kf('Body', f, rot=(R(-10 + 15 * s), 0, 0), loc=(0, 0, R(5 - 7 * s)))
        for side in ['L', 'R']:
            bones = WING_BONES_L if side == 'L' else WING_BONES_R
            rots = [(R(40 - 50 * s), 0, R(-30 + 60 * s) if side == 'L' else R(30 - 60 * s)),
                    (R(-5 + 35 * s), 0, 0), (R(-3 + 8 * s), 0, R(-12 * s)),
                    (R(-22 * s),0,R(5 + 5 * s)),(R(-14 * s),0,R(4 + 4 * s)),
                    (R(-8 * s),0,R(3 + 3 * s))]
            for bn, rt in zip(bones, rots):
                pb = ARM.pose.bones.get(bn)
                if pb:
                    pb.rotation_mode = 'QUATERNION'
                    pb.rotation_quaternion = Quaternion(rt)
                    pb.keyframe_insert(data_path="rotation_quaternion", frame=f)
                    pb.keyframe_insert(data_path="location", frame=f)
        kf('Neck1', f, rot=(R(10 - 5 * s), 0, 0))
        kf('L_Thigh', f, rot=(R(15 - 15 * s), 0, 0))
        kf('R_Thigh', f, rot=(R(15 - 15 * s), 0, 0))
    else:
        # Fold, settle to idle
        s = (t - 0.66) / 0.34
        kf('Body', f, rot=(R(5 - 5 * s), 0, 0), loc=(0, 0, R(-2 + 2 * s)))
        kf_wing_fold(f, up=-10 - 5 * s, sweep=25 + 20 * s, elbow=20 + 10 * s, fold=0.7 + 0.3 * s)
        kf('Neck1', f, rot=(R(5 - 5 * s), 0, 0))
        kf('Tail1', f, rot=(R(0), 0, 0))

print("  land done")

# === DEATH (96f, collapse) ===
new_action("death")
for f in range(0, 97, 3):
    t = f / 96
    if t < 0.25:
        # Death throe: rear back
        s = t / 0.25
        kf('Body', f, rot=(R(-20 * s), 0, 0), loc=(0, R(-20 * s), R(5 * s)))
        kf('Neck1', f, rot=(R(-25 * s), 0, 0))
        kf('Neck2', f, rot=(R(-20 * s), 0, 0))
        kf('Jaw', f, rot=(R(-40 * s), 0, 0))
        kf_wing_fold(f, up=-15 + 15 * s, sweep=20 - 10 * s, elbow=30 - 10 * s)
        # Wings start to spread in spasm
        for side in ['L', 'R']:
            bones = WING_BONES_L if side == 'L' else WING_BONES_R
            zs = R(-10 + 20 * s) if side == 'L' else R(10 - 20 * s)
            rots = [(R(0 + 30 * s), 0, zs), (R(20 - 20 * s), 0, 0), (R(0), 0, 0),
                    (0,0,0),(0,0,0),(0,0,0)]
            for bn, rt in zip(bones, rots):
                pb = ARM.pose.bones.get(bn)
                if pb:
                    pb.rotation_mode = 'QUATERNION'
                    pb.rotation_quaternion = Quaternion(rt)
                    pb.keyframe_insert(data_path="rotation_quaternion", frame=f)
                    pb.keyframe_insert(data_path="location", frame=f)
    elif t < 0.6:
        # Spasm: wings fully spread
        s = (t - 0.25) / 0.35
        tremor = 3 * math.sin(f * math.pi / 3)
        kf('Body', f, rot=(R(-30 + 10 * s + tremor), 0, R(tremor * 0.3)), 
           loc=(0, R(-20 + 10 * s), R(5 - 10 * s)))
        kf('Neck1', f, rot=(R(-35 + 10 * s), R(tremor * 0.2), 0))
        kf('Jaw', f, rot=(R(-60 + 10 * s), 0, 0))
        for side in ['L', 'R']:
            bones = WING_BONES_L if side == 'L' else WING_BONES_R
            zs = R(10 - 20 * s + tremor * 0.3) if side == 'L' else R(-10 + 20 * s - tremor * 0.3)
            rots = [(R(30 - 20 * s + tremor), 0, zs), (R(0), 0, 0), (R(-5 * s), 0, 0),
                    (0,0,R(-5 * s)),(0,0,R(-4 * s)),(0,0,R(-3 * s))]
            for bn, rt in zip(bones, rots):
                pb = ARM.pose.bones.get(bn)
                if pb:
                    pb.rotation_mode = 'QUATERNION'
                    pb.rotation_quaternion = Quaternion(rt)
                    pb.keyframe_insert(data_path="rotation_quaternion", frame=f)
                    pb.keyframe_insert(data_path="location", frame=f)
    else:
        # Collapse: terminal pose
        s = (t - 0.6) / 0.4
        kf('Body', f, rot=(R(-20 + 65 * s), 0, 0), loc=(0, R(-10 - 90 * s), R(-5 - 25 * s)))
        kf('Neck1', f, rot=(R(-25 + 55 * s), 0, 0))
        kf('Neck2', f, rot=(R(-10 + 30 * s), 0, 0))
        kf('Jaw', f, rot=(R(-50 + 40 * s), 0, 0))
        # Wings fold in death
        kf_wing_fold(f, up=-45, sweep=40, elbow=50)
        kf('Tail1', f, rot=(R(10 + 10 * s), 0, R(-8 * s)))
        for ti, tb in enumerate(TAIL_BONES[1:], 1):
            decay = 1.0 - ti * 0.08
            kf(tb, f, rot=(R(5 * decay + tremor * 0.2 if t < 0.7 else 5 * decay), 0,
                                 R(-5 * decay * s)))
        kf('L_Thigh', f, rot=(R(30 * s), 0, 0))
        kf('R_Thigh', f, rot=(R(30 * s), 0, 0))
        kf('L_Calf', f, rot=(R(-20 * s), 0, 0))
        kf('R_Calf', f, rot=(R(-20 * s), 0, 0))
        kf('L_Toes', f, rot=(R(30 * (1 - s) - 15 * s), 0, 0))
        kf('R_Toes', f, rot=(R(30 * (1 - s) - 15 * s), 0, 0))

print("  death done")
bpy.ops.wm.save_mainfile()
result = {'status': 'All 16 clips authored', 'actions': sorted([a.name for a in bpy.data.actions])}
