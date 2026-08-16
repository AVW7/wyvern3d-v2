import bpy, math
from mathutils import Quaternion, Euler
import random

ARM = bpy.data.objects.get("WyvernRig")
R = math.radians

if bpy.context.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')
bpy.context.view_layer.objects.active = ARM
ARM.select_set(True)
bpy.ops.object.mode_set(mode='POSE')

for action in list(bpy.data.actions):
    bpy.data.actions.remove(action)

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

WING_BONES_L = ['L_WingShoulder', 'L_WingElbow', 'L_WingWrist',
                'L_WingFinger1', 'L_WingFinger2', 'L_WingFinger3']
WING_BONES_R = ['R_WingShoulder', 'R_WingElbow', 'R_WingWrist',
                'R_WingFinger1', 'R_WingFinger2', 'R_WingFinger3']
TAIL_BONES = ['Tail1', 'Tail2', 'Tail3', 'Tail4', 'Tail5', 'Tail6',
              'Tail7', 'Tail8', 'Tail9', 'Tail10']
NECK_BONES = ['Neck1', 'Neck2', 'Head']
SPINE_BONES = ['Spine1', 'Spine2', 'Spine3']
LEG_BONES_L = ['L_Thigh', 'L_Calf', 'L_Foot', 'L_Toes']
LEG_BONES_R = ['R_Thigh', 'R_Calf', 'R_Foot', 'R_Toes']

# Local axis facts from the live-rig probe:
# - Shoulder X: symmetric lift; Shoulder Z: antisymmetric fore/aft sweep.
# - Wrist Z and Finger1 X: the meaningful folding/extension controls.
# Right wing mirrors only the Z components.
def wing_rot(shoulder_x, shoulder_z, elbow_x, wrist_x, wrist_z,
             finger1_x, finger1_z, finger2_x, finger2_z, finger3_x, finger3_z):
    return {
        'shoulder': (R(shoulder_x), 0, R(shoulder_z)),
        'elbow': (R(elbow_x), 0, 0),
        'wrist': (R(wrist_x), 0, R(wrist_z)),
        'finger1': (R(finger1_x), 0, R(finger1_z)),
        'finger2': (R(finger2_x), 0, R(finger2_z)),
        'finger3': (R(finger3_x), 0, R(finger3_z)),
    }

def mirror_wing(rot):
    return {
        'shoulder': (rot['shoulder'][0], 0, -rot['shoulder'][2]),
        'elbow': rot['elbow'],
        'wrist': (rot['wrist'][0], 0, -rot['wrist'][2]),
        'finger1': (rot['finger1'][0], 0, -rot['finger1'][2]),
        'finger2': (rot['finger2'][0], 0, -rot['finger2'][2]),
        'finger3': (rot['finger3'][0], 0, -rot['finger3'][2]),
    }

def kf_wing(side, rot, frame):
    bones = WING_BONES_L if side == 'L' else WING_BONES_R
    keys = ['shoulder', 'elbow', 'wrist', 'finger1', 'finger2', 'finger3']
    for bone, key in zip(bones, keys):
        pb = ARM.pose.bones.get(bone)
        if pb:
            pb.rotation_mode = 'QUATERNION'
            pb.rotation_quaternion = Quaternion(rot[key])
            pb.location = (0, 0, 0)
            pb.keyframe_insert(data_path="rotation_quaternion", frame=frame)
            pb.keyframe_insert(data_path="location", frame=frame)

def kf_bone(name, frame, rot_euler=(0,0,0), loc=(0,0,0)):
    pb = ARM.pose.bones.get(name)
    if not pb: return
    pb.rotation_mode = 'QUATERNION'
    pb.rotation_quaternion = Quaternion(rot_euler)
    pb.location = loc
    pb.keyframe_insert(data_path="rotation_quaternion", frame=frame)
    pb.keyframe_insert(data_path="location", frame=frame)

def kf_chain(bone_names, frame, rot_eulers):
    for name, rot in zip(bone_names, rot_eulers):
        kf_bone(name, frame, rot_euler=rot)

def sample_wingbeat(t, up_amp, dn_amp, sweep_up, sweep_dn, elbow_up, elbow_dn,
                    wrist_amp, f1_amp, f2_amp, f3_amp):
    # t goes 0..1 within one beat. 0=up, 0.5=down, 1=up
    # Non-uniform: downstroke is faster (0.3 of cycle), upstroke slower (0.7)
    # Downstroke: t in [0, 0.3], upstroke: t in [0.3, 1.0]
    if t < 0.3:
        # Downstroke: rapid, powerful
        s = t / 0.3  # 0..1
        # Ease-in (accelerate into downstroke)
        s_eased = s * s
        shoulder_x = up_amp + (dn_amp - up_amp) * s_eased
        shoulder_z = sweep_up + (sweep_dn - sweep_up) * s_eased
        elbow_x = elbow_up + (elbow_dn - elbow_up) * s_eased
    else:
        # Upstroke: slower, recovery
        s = (t - 0.3) / 0.7  # 0..1
        # Ease-out (decelerate then accelerate at top)
        s_eased = 0.5 - 0.5 * math.cos(s * math.pi)
        shoulder_x = dn_amp + (up_amp - dn_amp) * s_eased
        shoulder_z = sweep_dn + (sweep_up - sweep_dn) * s_eased
        elbow_x = elbow_dn + (elbow_up - elbow_dn) * s_eased

    # The recovery fold is structural, not noise: wrist Z + Finger1 X
    # shorten the span while the wing is high, then open it for the power stroke.
    # This was measured on the live rig: negative Finger1 X visibly retracts span.
    recovery_fold = 0.5 + 0.5 * math.cos(t * 2 * math.pi)
    wrist_x = wrist_amp * math.sin(t * 2 * math.pi - 0.3)
    wrist_z = -18.0 * recovery_fold
    f1_x = -32.0 * recovery_fold
    f2_x = -20.0 * recovery_fold
    f3_x = -12.0 * recovery_fold

    # Membrane tips trail further with a smaller lateral ripple.
    f1_z = f1_amp * math.sin(t * 2 * math.pi - 0.5)
    f2_z = f2_amp * math.sin(t * 2 * math.pi - 0.7)
    f3_z = f3_amp * math.sin(t * 2 * math.pi - 0.9)

    return wing_rot(
        shoulder_x, shoulder_z, elbow_x, wrist_x, wrist_z,
        f1_x, f1_z, f2_x, f2_z, f3_x, f3_z,
    )


def author_flight_loop(name, total_frames, beats, body_pitch_deg,
                      up_amp, dn_amp, sweep_up, sweep_dn,
                      elbow_up, elbow_dn, wrist_amp,
                      f1_amp, f2_amp, f3_amp,
                      leg_tuck_deg, neck_reach_deg,
                      tail_counter_amp=1.5, body_bob=3.0,
                      is_bank=False, bank_side=None,
                      inside_up_amp=None, inside_dn_amp=None,
                      outside_up_amp=None, outside_dn_amp=None):
    new_action(name)

    beat_len = total_frames / beats
    # Dense sampling: 8 samples per beat (matching v1's ~28 kfs / 3 beats = ~9/beat)
    samples_per_beat = 8

    for beat in range(beats + 1):
        for sub in range(samples_per_beat if beat < beats else 1):
            t_global = beat + sub / samples_per_beat
            if t_global > beats:
                continue
            frame = int(round(t_global * beat_len))
            if frame > total_frames:
                frame = total_frames

            # Normalized position within the beat
            t = sub / samples_per_beat if beat < beats else 0.0

            if is_bank and bank_side:
                # Asymmetric wing strokes
                if bank_side == 'L':
                    # Left = inside (smaller), Right = outside (larger)
                    l_rot = sample_wingbeat(t, inside_up_amp, inside_dn_amp,
                                           sweep_up*0.5, sweep_dn*0.5,
                                           elbow_up*0.6, elbow_dn*0.6,
                                           wrist_amp*0.5, f1_amp*0.5, f2_amp*0.5, f3_amp*0.5)
                    r_rot = mirror_wing(sample_wingbeat(t, outside_up_amp, outside_dn_amp,
                                           sweep_up, sweep_dn,
                                           elbow_up, elbow_dn,
                                           wrist_amp, f1_amp, f2_amp, f3_amp))
                else:
                    l_rot = sample_wingbeat(t, outside_up_amp, outside_dn_amp,
                                           sweep_up, sweep_dn,
                                           elbow_up, elbow_dn,
                                           wrist_amp, f1_amp, f2_amp, f3_amp)
                    r_rot = mirror_wing(sample_wingbeat(t, inside_up_amp, inside_dn_amp,
                                           sweep_up*0.5, sweep_dn*0.5,
                                           elbow_up*0.6, elbow_dn*0.6,
                                           wrist_amp*0.5, f1_amp*0.5, f2_amp*0.5, f3_amp*0.5))
            else:
                l_rot = sample_wingbeat(t, up_amp, dn_amp, sweep_up, sweep_dn,
                                       elbow_up, elbow_dn, wrist_amp,
                                       f1_amp, f2_amp, f3_amp)
                r_rot = mirror_wing(l_rot)

            kf_wing('L', l_rot, frame)
            kf_wing('R', r_rot, frame)

            # Body: rotation (static pitch) + location (bob) MUST be keyed
            # together — separate calls clobber each other's quaternion/loc.
            bob_z = body_bob * math.sin(t * 2 * math.pi - math.pi)
            kf_bone('Body', frame, rot_euler=(R(body_pitch_deg), 0, 0), loc=(0, 0, R(bob_z)))

    # Neck chain: lag the wingbeat, overlapping motion
    for beat in range(beats + 1):
        for sub in range(4):
            t = beat + sub / 4
            if t > beats: continue
            frame = int(round(t * beat_len))
            t_norm = sub / 4 if beat < beats else 0

            neck1_x = neck_reach_deg * 0.5 * math.sin(t_norm * 2 * math.pi - 0.4)
            neck2_x = neck_reach_deg * 0.3 * math.sin(t_norm * 2 * math.pi - 0.6)
            head_x = neck_reach_deg * 0.2 * math.sin(t_norm * 2 * math.pi - 0.8)

            kf_bone('Neck1', frame, rot_euler=(R(neck1_x), 0, 0))
            kf_bone('Neck2', frame, rot_euler=(R(neck2_x), 0, 0))
            kf_bone('Head', frame, rot_euler=(R(head_x), 0, 0))

    # Tail chain: wave propagation, lagging 2 beats behind
    for tail_idx, tail_bone in enumerate(TAIL_BONES):
        phase_offset = tail_idx * 0.15
        amp_decay = 1.0 - tail_idx * 0.08
        for beat in range(beats + 1):
            for sub in range(4):
                t = beat + sub / 4
                if t > beats: continue
                frame = int(round(t * beat_len))
                t_norm = sub / 4 if beat < beats else 0

                tail_x = tail_counter_amp * amp_decay * math.sin(t_norm * 2 * math.pi - 1.0 - phase_offset)
                tail_z = tail_counter_amp * 0.5 * amp_decay * math.sin(t_norm * 2 * math.pi - 1.2 - phase_offset)
                kf_bone(tail_bone, frame, rot_euler=(R(tail_x), 0, R(tail_z)))

    # Spine: subtle recoil following the downstroke
    for beat in range(beats + 1):
        for sub in range(4):
            t = beat + sub / 4
            if t > beats: continue
            frame = int(round(t * beat_len))
            t_norm = sub / 4 if beat < beats else 0
            recoil = 1.5 * math.sin(t_norm * 2 * math.pi - 0.2)
            kf_bone('Spine2', frame, rot_euler=(R(recoil), 0, 0))
            kf_bone('Spine3', frame, rot_euler=(R(recoil * 0.6), 0, 0))

    # Legs: flight tuck with slight rhythmic pulse
    for beat in range(2):
        frame = beat * total_frames // 2 if beats >= 2 else 0
        for bone_l, bone_r in zip(LEG_BONES_L, LEG_BONES_R):
            kf_bone(bone_l, frame, rot_euler=(R(leg_tuck_deg), 0, 0) if 'Thigh' in bone_l else
                    (R(-leg_tuck_deg * 0.4), 0, 0) if 'Calf' in bone_l else
                    (R(leg_tuck_deg * 0.1), 0, 0))
            kf_bone(bone_r, frame, rot_euler=(R(leg_tuck_deg), 0, 0) if 'Thigh' in bone_r else
                    (R(-leg_tuck_deg * 0.4), 0, 0) if 'Calf' in bone_r else
                    (R(leg_tuck_deg * 0.1), 0, 0))

    # Ensure leg endpoints are keyed at total_frames
    for bone_l, bone_r in zip(LEG_BONES_L, LEG_BONES_R):
        kf_bone(bone_l, total_frames, rot_euler=(R(leg_tuck_deg), 0, 0) if 'Thigh' in bone_l else
                (R(-leg_tuck_deg * 0.4), 0, 0) if 'Calf' in bone_l else
                (R(leg_tuck_deg * 0.1), 0, 0))
        kf_bone(bone_r, total_frames, rot_euler=(R(leg_tuck_deg), 0, 0) if 'Thigh' in bone_r else
                (R(-leg_tuck_deg * 0.4), 0, 0) if 'Calf' in bone_r else
                (R(leg_tuck_deg * 0.1), 0, 0))

    if is_bank and bank_side:
        # Head leans into turn, tail counterbalances
        lean = R(8) if bank_side == 'L' else R(-8)
        tail_counter = -lean
        kf_bone('Neck2', 0, rot_euler=(0, lean, 0))
        kf_bone('Neck2', total_frames, rot_euler=(0, lean, 0))
        kf_bone('Tail5', 0, rot_euler=(0, 0, tail_counter))
        kf_bone('Tail5', total_frames, rot_euler=(0, 0, tail_counter))

    print(f"  {name} done ({total_frames}f, {beats} beats)")


# ============================================================
# FLIGHT CLIPS
# ============================================================

# CRUISE: 6s, 3 beats, level. v1: 84° elev range, 2.6° pitch, 0.5 Hz
author_flight_loop("cruise",
    total_frames=144, beats=3, body_pitch_deg=0,
    up_amp=55, dn_amp=-55, sweep_up=-28, sweep_dn=28,
    elbow_up=-10, elbow_dn=18,
    wrist_amp=8, f1_amp=15, f2_amp=12, f3_amp=10,
    leg_tuck_deg=-22, neck_reach_deg=4,
    tail_counter_amp=1.5, body_bob=3.0)

# SCOUT: 6s, 2 beats, slow loiter. v1: 0.333 Hz, +8° pitch
author_flight_loop("scout",
    total_frames=144, beats=2, body_pitch_deg=-8,
    up_amp=58, dn_amp=-58, sweep_up=-28, sweep_dn=28,
    elbow_up=-12, elbow_dn=22,
    wrist_amp=10, f1_amp=20, f2_amp=16, f3_amp=12,
    leg_tuck_deg=-18, neck_reach_deg=5,
    tail_counter_amp=1.2, body_bob=2.5)

# HOVER: 6s, 4 beats, nose-up 35°. v1: 32° nose-up, high amplitude
author_flight_loop("hover",
    total_frames=144, beats=4, body_pitch_deg=-25,
    up_amp=65, dn_amp=-65, sweep_up=-30, sweep_dn=30,
    elbow_up=-15, elbow_dn=25,
    wrist_amp=12, f1_amp=25, f2_amp=20, f3_amp=15,
    leg_tuck_deg=12, neck_reach_deg=15,
    tail_counter_amp=3.0, body_bob=5.0)

# SPEED: 3s, 3 beats, nose-down. v1: 0.8 Hz, -7° pitch
author_flight_loop("speed",
    total_frames=72, beats=3, body_pitch_deg=15,
    up_amp=35, dn_amp=-35, sweep_up=-14, sweep_dn=14,
    elbow_up=-8, elbow_dn=12,
    wrist_amp=6, f1_amp=10, f2_amp=8, f3_amp=6,
    leg_tuck_deg=-28, neck_reach_deg=0,
    tail_counter_amp=1.0, body_bob=2.0)

# BANK LEFT: 6s, 3 beats, asymmetric
author_flight_loop("bankLeft",
    total_frames=144, beats=3, body_pitch_deg=0,
    up_amp=50, dn_amp=-50, sweep_up=-65, sweep_dn=65,
    elbow_up=-10, elbow_dn=15,
    wrist_amp=8, f1_amp=15, f2_amp=12, f3_amp=10,
    leg_tuck_deg=-20, neck_reach_deg=4,
    tail_counter_amp=1.5, body_bob=3.0,
    is_bank=True, bank_side='L',
    inside_up_amp=30, inside_dn_amp=-30,
    outside_up_amp=60, outside_dn_amp=-60)

# BANK RIGHT: mirror
author_flight_loop("bankRight",
    total_frames=144, beats=3, body_pitch_deg=0,
    up_amp=50, dn_amp=-50, sweep_up=-65, sweep_dn=65,
    elbow_up=-10, elbow_dn=15,
    wrist_amp=8, f1_amp=15, f2_amp=12, f3_amp=10,
    leg_tuck_deg=-20, neck_reach_deg=4,
    tail_counter_amp=1.5, body_bob=3.0,
    is_bank=True, bank_side='R',
    inside_up_amp=30, inside_dn_amp=-30,
    outside_up_amp=60, outside_dn_amp=-60)

# GLIDE: 6s, held wings, wind ripple (no beat cycle)
new_action("glide")
GLIDE_FRAMES = 144
for f in range(0, GLIDE_FRAMES + 1, 6):
    ripple = 3.0 * math.sin(f * math.pi / 18)
    gust = 2.0 * math.sin(f * math.pi / 11 + 0.5)

    l_rot = wing_rot(
        15 + ripple, -15 + gust * 0.3, -5 + ripple * 0.3,
        ripple * 0.5, -8 + gust * 0.2,
        -10 + ripple * 0.5, ripple * 0.4,
        -6 + ripple * 0.3, ripple * 0.3,
        -4 + ripple * 0.2, ripple * 0.2,
    )
    r_rot = mirror_wing(l_rot)
    kf_wing('L', l_rot, f)
    kf_wing('R', r_rot, f)

    # Subtle body and neck response to gust
    kf_bone('Body', f, rot_euler=(R(13 + gust * 0.2), 0, 0), loc=(0, 0, R(gust * 0.5)))
    kf_bone('Neck1', f, rot_euler=(R(-3 + ripple * 0.3), 0, 0))
    kf_bone('Neck2', f, rot_euler=(R(-2 + ripple * 0.2), 0, 0))

    # Tail wind sway
    for ti, tb in enumerate(TAIL_BONES):
        decay = 1.0 - ti * 0.05
        kf_bone(tb, f, rot_euler=(R(-2 + ripple * 0.3 * decay), 0, R(gust * 0.3 * decay)))

    # Leg tuck
    if f == 0 or f == GLIDE_FRAMES:
        for bl, br in zip(LEG_BONES_L, LEG_BONES_R):
            kf_bone(bl, f, rot_euler=(R(-24), 0, 0) if 'Thigh' in bl else (R(38), 0, 0))
            kf_bone(br, f, rot_euler=(R(-24), 0, 0) if 'Thigh' in br else (R(38), 0, 0))

print("  glide done")

# DIVE: 4s, held folded wings, nose-down
new_action("dive")
DIVE_FRAMES = 96
for f in range(0, DIVE_FRAMES + 1, 6):
    ripple = 1.5 * math.sin(f * math.pi / 12)
    l_rot = wing_rot(
        -25 + ripple, 20 + ripple * 0.2, 35 + ripple * 0.3,
        ripple * 0.3, -24,
        -35, ripple * 0.2,
        -22, ripple * 0.2,
        -14, ripple * 0.1,
    )
    r_rot = mirror_wing(l_rot)
    kf_wing('L', l_rot, f)
    kf_wing('R', r_rot, f)

    kf_bone('Body', f, rot_euler=(R(25), 0, 0), loc=(0, 0, R(ripple * 0.3)))
    kf_bone('Neck1', f, rot_euler=(R(5 + ripple * 0.2), 0, 0))
    kf_bone('Tail1', f, rot_euler=(R(8 + ripple * 0.3), 0, 0))

    if f == 0 or f == DIVE_FRAMES:
        for bl, br in zip(LEG_BONES_L, LEG_BONES_R):
            kf_bone(bl, f, rot_euler=(R(-30), 0, 0) if 'Thigh' in bl else (R(50), 0, 0))
            kf_bone(br, f, rot_euler=(R(-30), 0, 0) if 'Thigh' in br else (R(50), 0, 0))

print("  dive done")
bpy.ops.wm.save_mainfile()
result = {'status': 'Flight clips authored', 'actions': sorted([a.name for a in bpy.data.actions])}
