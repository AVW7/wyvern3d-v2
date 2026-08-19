"""Author natural, organic tail movement for speed, bankLeft, bankRight, and dive flight clips.

Applies:
  1. speed: Streamlined forward line with flowing traveling wave (Euler X) and aerodynamic stabilization (Euler Z)
  2. bankLeft: Aerodynamic S-curve rudder counter-balance (Euler Z) with rhythmic wingbeat breathing (Euler X + Z)
  3. bankRight: Exact symmetric mirror of bankLeft (negated Euler Z, identical Euler X)
  4. dive: Aerodynamic slipstream trail with high-speed air resistance flutter / ripple wave

Run with:
    /Applications/Blender.app/Contents/MacOS/Blender --background public/models/wyvern-rig-v1wing.blend \
        --python scripts/author-wyvern-tail-flight-blender.py -- --save
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Quaternion

ARMATURE = "WyvernRig"
TAIL_BONES = [f"Tail{i}" for i in range(1, 11)]

# ==============================================================================
# BASE POSTURES (Euler XYZ in degrees)
# ==============================================================================

# SPEED: Streamlined horizontal line trailing behind the body
SPEED_BASE_EULER_X = {
    "Tail1":  +15.9,
    "Tail2":  -12.4,
    "Tail3":   -9.0,
    "Tail4":   -3.8,
    "Tail5":   -2.4,
    "Tail6":   -7.4,
    "Tail7":   -4.9,
    "Tail8":  +10.2,
    "Tail9":   +6.7,
    "Tail10":  +6.3,
}

# BANK LEFT: Aerodynamic rudder arc to the outside of the turn (Euler Z > 0 sweeps right)
# Smooth curvature from base to tip to counterbalance the left bank and left head lean
BANK_LEFT_BASE_EULER_Z = {
    "Tail1":   +1.5,
    "Tail2":   +3.0,
    "Tail3":   +4.2,
    "Tail4":   +4.8,
    "Tail5":   +5.2,
    "Tail6":   +4.6,
    "Tail7":   +3.8,
    "Tail8":   +3.0,
    "Tail9":   +2.2,
    "Tail10":  +1.8,
}
BANK_LEFT_BASE_EULER_X = {
    "Tail1":   +8.0,
    "Tail2":   -6.0,
    "Tail3":   -4.0,
    "Tail4":   -2.0,
    "Tail5":   -1.0,
    "Tail6":   -2.0,
    "Tail7":   -1.5,
    "Tail8":   +3.0,
    "Tail9":   +2.0,
    "Tail10":  +1.5,
}

# DIVE: Smooth streamlined arch following the steep dive plunge trajectory
DIVE_BASE_EULER_X = {
    "Tail1":  +14.0,
    "Tail2":  -10.0,
    "Tail3":   -6.0,
    "Tail4":   -3.0,
    "Tail5":   -1.5,
    "Tail6":   -2.0,
    "Tail7":   -1.0,
    "Tail8":   +4.0,
    "Tail9":   +3.0,
    "Tail10":  +2.5,
}


def animate_speed_tail(arm: bpy.types.Object, act: bpy.types.Action) -> None:
    """Speed: 36 frames loop (0..35/36), 3 wingbeat cycles, fast forward propulsion wave."""
    f_start = int(act.frame_range[0])
    f_end = int(act.frame_range[1])
    span = f_end - f_start
    # Determine base period
    total_period = span if span in (36, 48, 120, 144) else (span if span % 3 == 0 else span + 1)
    beats = 3 if total_period in (36, 48, 72, 144) else 4

    for f in range(f_start, f_end + 1):
        bpy.context.scene.frame_set(f)
        # Normalized cycle: exactly 0.0 at f_start, exactly 1.0 if f == f_start + total_period
        t_phase = ((f - f_start) % total_period) / float(total_period)

        for idx, bname in enumerate(TAIL_BONES):
            pb = arm.pose.bones.get(bname)
            if not pb:
                continue
            pb.rotation_mode = "QUATERNION"

            base_x = SPEED_BASE_EULER_X.get(bname, 0.0)
            base_z = 0.0

            # Traveling wave phase delay down the tail
            phase_lag = idx * 0.38
            # Amplitude grows down the chain (subtle at root, organic whip at tip)
            amp_decay = 0.35 + (idx / 9.0) * 0.75
            amp_x = 3.0 * amp_decay  # ~1.0 deg at Tail1, ~3.3 deg at Tail10
            amp_z = 0.6 * amp_decay  # subtle lateral aerodynamic tracking

            # Pitch wave: 3 cycles per loop
            delta_x = amp_x * math.sin(t_phase * 2 * math.pi * beats - phase_lag)
            # Lateral stabilizer sway: 1 cycle per loop
            delta_z = amp_z * math.sin(t_phase * 2 * math.pi * 1 - phase_lag)

            euler = Euler((
                math.radians(base_x + delta_x),
                0.0,
                math.radians(base_z + delta_z),
            ), "XYZ")
            pb.rotation_quaternion = euler.to_quaternion()
            pb.keyframe_insert(data_path="rotation_quaternion", frame=f)


def animate_bank_tail(arm: bpy.types.Object, act: bpy.types.Action, side: str) -> None:
    """Bank Left / Right: 48 frames loop (3 beats), rudder arc + wingbeat breathing."""
    f_start = int(act.frame_range[0])
    f_end = int(act.frame_range[1])
    span = f_end - f_start
    total_period = span if span in (36, 48, 144) else (span if span % 3 == 0 else span + 1)
    beats = 3

    # side == 'L' -> rudder to right (positive Z); side == 'R' -> rudder to left (negative Z)
    z_sign = +1.0 if side == "L" else -1.0

    for f in range(f_start, f_end + 1):
        bpy.context.scene.frame_set(f)
        t_phase = ((f - f_start) % total_period) / float(total_period)

        for idx, bname in enumerate(TAIL_BONES):
            pb = arm.pose.bones.get(bname)
            if not pb:
                continue
            pb.rotation_mode = "QUATERNION"

            base_x = BANK_LEFT_BASE_EULER_X.get(bname, 0.0)
            base_z = z_sign * BANK_LEFT_BASE_EULER_Z.get(bname, 0.0)

            # Phase lag down the tail
            phase_lag = idx * 0.32
            amp_decay = 0.35 + (idx / 9.0) * 0.75
            amp_x = 2.4 * amp_decay
            amp_z = 1.2 * amp_decay

            # Pitch wave: 3 cycles per loop
            delta_x = amp_x * math.sin(t_phase * 2 * math.pi * beats - phase_lag)
            # Rudder flexing: 3 cycles per loop (breathing with the banking stroke)
            delta_z = z_sign * amp_z * math.cos(t_phase * 2 * math.pi * beats - phase_lag)

            euler = Euler((
                math.radians(base_x + delta_x),
                0.0,
                math.radians(base_z + delta_z),
            ), "XYZ")
            pb.rotation_quaternion = euler.to_quaternion()
            pb.keyframe_insert(data_path="rotation_quaternion", frame=f)


def animate_dive_tail(arm: bpy.types.Object, act: bpy.types.Action) -> None:
    """Dive: 48 frames loop, steep aerodynamic streamline with high-speed wind flutter."""
    f_start = int(act.frame_range[0])
    f_end = int(act.frame_range[1])
    span = f_end - f_start
    total_period = span if span in (36, 48, 144) else (span if span % 4 == 0 else span + 1)
    flutter_cycles = 4  # High frequency air resistance ripple

    for f in range(f_start, f_end + 1):
        bpy.context.scene.frame_set(f)
        t_phase = ((f - f_start) % total_period) / float(total_period)

        for idx, bname in enumerate(TAIL_BONES):
            pb = arm.pose.bones.get(bname)
            if not pb:
                continue
            pb.rotation_mode = "QUATERNION"

            base_x = DIVE_BASE_EULER_X.get(bname, 0.0)
            base_z = 0.0  # Centered neutral yaw

            phase_lag = idx * 0.42
            # Distal bones flutter more in the slipstream
            amp_decay = 0.2 + (idx / 9.0) * 0.85
            amp_x = 2.2 * amp_decay
            amp_z = 0.8 * amp_decay

            # High-speed trailing air flutter (4 cycles across the loop)
            delta_x = amp_x * math.sin(t_phase * 2 * math.pi * flutter_cycles - phase_lag)
            delta_z = amp_z * math.sin(t_phase * 2 * math.pi * flutter_cycles - phase_lag + 1.2)

            euler = Euler((
                math.radians(base_x + delta_x),
                0.0,
                math.radians(base_z + delta_z),
            ), "XYZ")
            pb.rotation_quaternion = euler.to_quaternion()
            pb.keyframe_insert(data_path="rotation_quaternion", frame=f)


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

    # 1. speed
    act_speed = bpy.data.actions.get("speed")
    if act_speed:
        arm.animation_data_create().action = act_speed
        animate_speed_tail(arm, act_speed)
        print("[author-tail] Authored dynamic tail wave for 'speed'")

    # 2. bankLeft
    act_bank_l = bpy.data.actions.get("bankLeft")
    if act_bank_l:
        arm.animation_data_create().action = act_bank_l
        animate_bank_tail(arm, act_bank_l, side="L")
        print("[author-tail] Authored dynamic tail rudder for 'bankLeft'")

    # 3. bankRight
    act_bank_r = bpy.data.actions.get("bankRight")
    if act_bank_r:
        arm.animation_data_create().action = act_bank_r
        animate_bank_tail(arm, act_bank_r, side="R")
        print("[author-tail] Authored dynamic tail rudder for 'bankRight'")

    # 4. dive
    act_dive = bpy.data.actions.get("dive")
    if act_dive:
        arm.animation_data_create().action = act_dive
        animate_dive_tail(arm, act_dive)
        print("[author-tail] Authored dynamic tail flutter for 'dive'")

    if args.save:
        bpy.ops.wm.save_mainfile()
        print(f"[author-tail] Saved {bpy.data.filepath}")


if __name__ == "__main__":
    main()
