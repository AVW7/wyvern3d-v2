"""Author every wyvern clip, inside Blender.

`scripts/author-wyvern-clips.py` drives this. It rebuilds all 16 actions on
`WyvernRig` from the tables below and exports the GLB.

Why every clip is rebuilt together
----------------------------------
The 16 clips this replaces were authored one at a time, and seven of them
shipped a visibly dislocated wing. The cause was not the animation — it was the
export. `export_animation_mode="ACTIONS"` samples *every* bone on every frame,
so a bone a clip does not key is baked at whatever pose happened to be sitting
on the armature at export time. The .blend carried a stale viewport pose
(`L_Thigh -20 deg` against `R_Thigh +15 deg`, an asymmetric stance nobody
authored), and the correlation was exact:

    keyed 46 bones -> cruise dive glide hover scout speed bankL bankR   all clean
    keyed 7..17    -> attack breath land takeoff walk death rest        all broken

So the fix is structural, not cosmetic, and it is enforced here in two places:

1. `reset_pose()` returns the armature to identity before each action is built,
   so nothing can be inherited from the session.
2. `build()` keys EVERY bone on EVERY clip. A bone a clip does not mention is
   keyed flat at zero rather than left to chance. `export_optimize_animation_size`
   then collapses those constant channels back to two keys, so the guarantee is
   free at runtime.

A clip can no longer bake a pose it did not ask for.

Axis conventions are MEASURED, not assumed
------------------------------------------
Probed on this armature at +0.2 rad, reading world displacement of a chain-tip
marker. Every one of these contradicts a plausible guess:

    Spine*/Neck*/Head    local +X pitches the head DOWN;  +Z yaws toward -X
    Tail1..Tail10        local +X lifts the tail UP  — opposite sense to the
                         spine, because the tail runs +Y and the neck runs -Y
    Wing shoulder/elbow/wrist/finger/membrane
                         local +X raises BOTH wings       (symmetric)
                         local +Z sweeps them APART       (antisymmetric)
    Legs thigh/calf/foot local +X swings the leg BACK     (symmetric)
                         local +Y/+Z move both legs the same way in world space
                                                          (antisymmetric)
    Body.location        local +Z is world DOWN, +Y is world FORWARD
    RootMotion.location  local +Y is world UP, +Z is world FORWARD

The mirroring rule that falls out of that, and the one the old clips broke:

    rotation X  is SYMMETRIC     -> same sign on both sides
    rotation Y/Z are ANTISYMMETRIC -> negate on the right

`limb_pair()` is the only place that rule is applied. Nothing else in this file
writes an `R_` channel directly, so a clip cannot get the sign wrong again.

What this rig cannot do
-----------------------
`Jaw` is not a mandible. It drives 448 verts in the upper-rear skull, while the
lower jaw's vertices were folded into `Head` during the rig build (see the note
in `src/render/rigBones.ts`). The head is a single welded island with no gap at
the mouth line, so no mouth actually opens. `breath` and `attack` are authored
from the neck, chest and head — the whole forequarters — and read as intent
rather than as a bite. Restoring a real mandible is a mesh-level repair.
"""

from __future__ import annotations

import argparse
import importlib.util
import math
import pathlib
import sys

import bpy

ARMATURE = "WyvernRig"
MESH = "WyvernMesh"
FPS = 24
DEG = math.pi / 180.0

HERE = pathlib.Path(__file__).resolve().parent

# ---------------------------------------------------------------------------
# Curve primitives. Every channel is a callable of normalised time t in [0, 1]
# returning degrees (rotation) or rig units (location).
# ---------------------------------------------------------------------------


def const(value: float):
    """A held value."""
    return lambda t: value


def harm(static: float, *terms, skew: float = 0.0):
    """Static offset plus exactly-periodic harmonics.

    `terms` are `(cycles, amplitude, phase)`. Because every cycle count is a
    whole number, t=1 reproduces t=0 to floating point and the loop is seamless
    by construction rather than by tolerance.

    `skew` bends the sine so the rise is quicker than the fall — the difference
    between a breath and a pendulum, and between a wing's power stroke and its
    recovery. Applied inside the argument, so the result stays 2*pi periodic.
    """

    def evaluate(t: float) -> float:
        total = static
        for cycles, amplitude, phase in terms:
            theta = 2.0 * math.pi * cycles * t + phase
            if skew:
                theta += skew * math.sin(theta)
            total += amplitude * math.sin(theta)
        return total

    return evaluate


def keys(points, *, loop: bool = False):
    """Piecewise smoothstep through `(t, value)` control points.

    Used for the one-shots, where the shape is a sequence of beats rather than
    an oscillator. Smoothstep rather than linear so the exported Bezier handles
    have nothing to overshoot.
    """
    pts = sorted(points)
    if loop and pts[0][1] != pts[-1][1]:
        raise ValueError("looping keys() must start and end on the same value")

    def evaluate(t: float) -> float:
        if t <= pts[0][0]:
            return pts[0][1]
        if t >= pts[-1][0]:
            return pts[-1][1]
        for (t0, v0), (t1, v1) in zip(pts, pts[1:]):
            if t0 <= t <= t1:
                if t1 == t0:
                    return v1
                u = (t - t0) / (t1 - t0)
                return v0 + (v1 - v0) * (u * u * (3.0 - 2.0 * u))
        return pts[-1][1]

    return evaluate


def add(*curves):
    """Sum of curves — a base pose plus an oscillation on top of it."""
    return lambda t: sum(c(t) for c in curves)


def scaled(curve, factor: float):
    return lambda t: curve(t) * factor


def curve(value):
    """Accept either a number or an already-built curve.

    The loops describe their poses as numbers and the one-shots as `keys(...)`,
    and both go through the same `spine()`/`neck_head()` builders, so those
    builders have to take either.
    """
    return value if callable(value) else const(float(value))


# ---------------------------------------------------------------------------
# The mirroring rule, applied in exactly one place.
# ---------------------------------------------------------------------------

SYMMETRIC_AXIS = "rx"          # same sign on both sides
ANTISYMMETRIC_AXES = ("ry", "rz", "ty", "tz")   # negated on the right


def limb_pair(bone: str, channels: dict, *, bias: dict | None = None) -> dict:
    """Emit `L_<bone>` and `R_<bone>` channels obeying the measured mirror rule.

    `bias` optionally scales the right side's amplitude, which is how the bank
    clips get an asymmetric stroke without anyone hand-writing an `R_` sign.
    """
    out = {}
    for side in ("L", "R"):
        flip = -1.0 if side == "R" else 1.0
        gain = 1.0 if bias is None else bias.get(side, 1.0)
        emitted = {}
        for axis, curve in channels.items():
            sign = flip if axis in ANTISYMMETRIC_AXES else 1.0
            emitted[axis] = scaled(curve, sign * gain) if (sign != 1.0 or gain != 1.0) else curve
        out[f"{side}_{bone}"] = emitted
    return out


def merge(*tables) -> dict:
    """Union of channel tables; later tables win per channel."""
    out: dict = {}
    for table in tables:
        for bone, channels in table.items():
            out.setdefault(bone, {}).update(channels)
    return out


# ---------------------------------------------------------------------------
# Shared motion vocabulary.
# ---------------------------------------------------------------------------

# Folded against the body. Grounded clips sit here; flight clips open out.
#
# The Z terms sweep the wing back and the X terms lift it. Both are needed:
# measured on this rig, +Z on a finger spar sweeps it back *and down*
# (dY +376, dZ -177 at +0.2 rad), so folding on Z alone drives the tip under
# the foot plane. The old clips folded shoulder and elbow only and left the
# wrist and finger spars spread, which is why `rest` needed a 7.95 m lift to
# plant — the manifest calls that "visible rather than harmless".
#
# LIFT values are chosen against `lowest_bone_up` in the measured signature:
# the tip carries ~21 m of spar, so the shoulder's lever is ~0.37 m per degree
# and the distal ones are progressively shorter.
FOLD_SHOULDER = 30.0
FOLD_ELBOW = 20.0
FOLD_WRIST = 18.0
FOLD_FINGER = 22.0

LIFT_SHOULDER = 15.0
LIFT_ELBOW = 22.0
LIFT_WRIST = 20.0
LIFT_FINGER = 14.0


def wingbeat(
    cycles: float,
    amplitude: float,
    *,
    phase: float = 0.0,
    base_elev: float = 0.0,
    sweep: float = 0.0,
    sweep_amp: float = 0.0,
    lag: float = 0.55,
    skew: float = 0.30,
    bias: dict | None = None,
    distal=(1.0, 0.46, 0.34, 0.24, 0.18),
) -> dict:
    """A wingbeat as a travelling wave down the spar.

    `distal` is the share of `amplitude` taken by shoulder, elbow, wrist,
    finger and membrane, and each joint lags the one inboard of it by `lag`
    radians. That lag is the whole point: driving the spar as one rigid lever
    is what made the old cruise read as a paddle. The outer joints trailing the
    shoulder is what produces camber on the downstroke and the flick at the top.

    The old clips moved shoulder and elbow only — wrist, all three fingers, both
    membranes and the claw never moved in any of the 16.
    """
    sh, el, wr, fi, me = distal
    skewed = dict(skew=skew)

    def elev(share: float, index: int):
        return harm(base_elev * share,
                    (cycles, amplitude * share, phase - lag * index), **skewed)

    def sweepc(share: float, index: int):
        if not sweep and not sweep_amp:
            return const(0.0)
        return harm(sweep * share,
                    (cycles, sweep_amp * share, phase - lag * index + 0.4), **skewed)

    layers = [
        ("WingShoulder", sh, 0), ("WingElbow", el, 1), ("WingWrist", wr, 2),
        ("WingFinger1", fi, 3), ("WingFinger2", fi * 0.85, 3),
        ("WingFinger3", fi * 0.7, 3),
        ("WingMembrane1", me, 4), ("WingMembrane2", me * 0.8, 4),
    ]
    tables = []
    for bone, share, index in layers:
        tables.append(limb_pair(bone, {
            "rx": elev(share, index),
            "rz": sweepc(share, index),
        }, bias=bias))
    return merge(*tables)


# ---------------------------------------------------------------------------
# The grounded stance: this animal is a QUADRUPED that walks on its wing
# knuckles.
#
# Measured on v1's `drogon.glb` with `scripts/probe-v1-walk.mjs`:
#
#     Battle_Walk    wing knuckle floor 0.64   foot floor 0.15   gap +0.49
#     Battle_Stand   wing knuckle floor 1.86   foot floor 1.99   gap -0.13
#
# The knuckles carry weight in *every* grounded clip, standing included, and the
# wrist rides high above them (`Hand` at 2.15 while the fingers reach 0.64) —
# knuckle-walking, like a bat, not a lizard with its hands flat.
#
# An earlier pass authored the grounded clips as a biped with the wings folded
# over the back. That reads as a bird and is the most visible thing about the
# model at ground level.
#
# Reaching the floor is a rotation about the fore-aft axis, and on this rig +X
# raises both wings, so the plant is strongly NEGATIVE X at the shoulder. +Z
# sweeps the wing back (probed: `L_WingWrist` +Z moves the tip +495 in Y), which
# is what makes Z the protraction axis a gait needs.
# Solved against `knuckle_above_toe` in the measured signature, not reasoned
# about: the spar is ~21 m, so a degree at the shoulder is metres at the tip and
# the first guess (-58 shoulder) drove the knuckles 9 m under the floor. Sweep
# them with `--plant NAME=VALUE`.
PLANT = {
    "shoulder": -34.0,   # swing the upper arm down and out
    "elbow": 46.0,       # fold the forearm back up, which is what lifts the wrist
    "wrist": -34.0,      # then drop the hand onto its knuckles
    "finger": 44.0,      # spars folded back over the wrist, not spread
    "sweep": 14.0,       # a little outboard, so the stance is wider than the hips
}


def plant_phase(fraction: float, cycles: float = 1) -> float:
    """Phase putting a harmonic's MINIMUM at `fraction` of the cycle.

    Both channels a stepping limb needs bottom out at the moment it plants: the
    lift axis is at its lowest, and the fore-aft axis is at its most protracted
    (because on this rig +X raises a wing and +Z sweeps it back, so "down" and
    "forward" are both the negative direction). One phase therefore drives both,
    which is the only reason the gait tables below stay readable.
    """
    return -math.pi / 2 - 2 * math.pi * cycles * fraction


def wings_planted(*, step: float = 0.0, cycles: float = 1,
                  plant_l: float = 0.0, plant_r: float = 0.5,
                  reach: float = 1.0, settle: float = 0.0,
                  trim: float = 0.0) -> dict:
    """The grounded quadrupedal stance, optionally stepping.

    `step` is the knuckle's lift amplitude in degrees — 0 for a standing pose,
    non-zero for a gait. `plant_l`/`plant_r` are the cycle fractions at which
    each knuckle touches down; the caller owns the diagonal couplet, because v1
    pairs each hind foot with the OPPOSITE wing knuckle.
    """
    def limb(fraction: float) -> dict:
        p = plant_phase(fraction, cycles)
        return {
            "WingShoulder": {
                # Lift, and protraction a quarter cycle ahead of it.
                # Biased by +step so the harmonic's MINIMUM is the plant angle
                # and the limb only ever lifts off it. Centring the oscillation
                # on the plant instead drove the knuckles 12.7 m under the floor,
                # because the plant angle is already the crossover where they
                # touch.
                "rx": harm(PLANT["shoulder"] * reach + step + trim,
                           (cycles, step, p),
                           (cycles, settle * 0.3, p + 1.9)),
                "rz": harm(PLANT["sweep"], (cycles, step * 0.55, p)),
            },
            "WingElbow": {
                "rx": harm(PLANT["elbow"] * reach + step * 0.5,
                           (cycles, step * 0.5, p + 0.12),
                           (cycles, settle * 0.5, p + 2.3)),
                "rz": harm(0.0, (cycles, step * 0.2, p + 0.3)),
            },
            "WingWrist": {
                "rx": harm(PLANT["wrist"] * reach + step * 0.7,
                           (cycles, step * 0.7, p + 0.22),
                           (cycles, settle * 0.7, p + 2.8)),
                "rz": harm(0.0, (cycles, step * 0.15, p + 0.6)),
            },
            "WingFinger1": {"rx": const(PLANT["finger"] * reach), "rz": const(6.0)},
            "WingFinger2": {"rx": const(PLANT["finger"] * 0.92 * reach), "rz": const(8.0)},
            "WingFinger3": {"rx": const(PLANT["finger"] * 0.84 * reach), "rz": const(10.0)},
            "WingMembrane1": {"rx": const(PLANT["finger"] * 0.4 * reach), "rz": const(4.0)},
            "WingMembrane2": {"rx": const(PLANT["finger"] * 0.3 * reach), "rz": const(5.0)},
            "WingClaw": {"rx": const(-12.0)},
        }

    # Left and right differ only in when they plant; `limb_pair` still owns the
    # sign rule, so nothing here writes an `R_` channel directly.
    left, right = limb(plant_l), limb(plant_r)
    out: dict = {}
    for bone in left:
        out[f"L_{bone}"] = limb_pair(bone, left[bone])[f"L_{bone}"]
        out[f"R_{bone}"] = limb_pair(bone, right[bone])[f"R_{bone}"]
    return out


def legs_gait(*, step: float = 0.0, cycles: float = 1,
              plant_l: float = 0.0, plant_r: float = 0.5,
              stance: float = -4.0) -> dict:
    """Hind limbs, stepping. Same phase convention as `wings_planted`.

    +X swings a leg BACK, so the thigh's minimum is its most protracted point —
    the same sign relationship the wing has, which is why both take
    `plant_phase` unmodified.
    """
    def limb(fraction: float) -> dict:
        p = plant_phase(fraction, cycles)
        return {
            "Thigh": {"rx": harm(stance + step, (cycles, step, p))},
            # Knee flexion is what actually lifts the foot clear, so it leads
            # the thigh slightly rather than sharing its phase.
            "Calf": {"rx": harm(step * 0.35, (cycles, step * 0.7, p + 0.9))},
            "Foot": {"rx": harm(0.0, (cycles, step * 0.5, p + 1.8))},
            "Toes": {"rx": harm(0.0, (cycles, step * 0.4, p + 2.4))},
        }

    left, right = limb(plant_l), limb(plant_r)
    out: dict = {}
    for bone in left:
        out[f"L_{bone}"] = limb_pair(bone, left[bone])[f"L_{bone}"]
        out[f"R_{bone}"] = limb_pair(bone, right[bone])[f"R_{bone}"]
    return out


def wings_folded(*, settle: float = 0.0, cycles: float = 1, phase: float = 0.0,
                 lift: float = 1.0) -> dict:
    """The grounded fold. Mirrored on Z, which is the defect this replaces.

    `lift` scales the whole X ladder, for clips that want the wing carried
    higher (`breath`, where the body is reared) or lower (`rest`).
    """
    return merge(
        limb_pair("WingShoulder", {
            "rz": const(FOLD_SHOULDER),
            "rx": harm(LIFT_SHOULDER * lift, (cycles, settle, phase)),
        }),
        limb_pair("WingElbow", {
            "rz": const(FOLD_ELBOW),
            "rx": harm(LIFT_ELBOW * lift, (cycles, settle * 0.75, phase + 0.35)),
        }),
        limb_pair("WingWrist", {
            "rz": const(FOLD_WRIST),
            "rx": harm(LIFT_WRIST * lift, (cycles, settle * 0.55, phase + 0.70)),
        }),
        # The fold the old rig never had: wrist and finger spars actually close,
        # instead of the wing staying spread while the shoulder swings back.
        limb_pair("WingFinger1", {"rz": const(FOLD_FINGER), "rx": const(LIFT_FINGER * lift)}),
        limb_pair("WingFinger2", {"rz": const(FOLD_FINGER * 1.1),
                                  "rx": const(LIFT_FINGER * 0.9 * lift)}),
        limb_pair("WingFinger3", {"rz": const(FOLD_FINGER * 1.2),
                                  "rx": const(LIFT_FINGER * 0.8 * lift)}),
        limb_pair("WingMembrane1", {"rz": const(FOLD_FINGER * 0.5),
                                    "rx": const(LIFT_FINGER * 0.5 * lift)}),
        limb_pair("WingMembrane2", {"rz": const(FOLD_FINGER * 0.6),
                                    "rx": const(LIFT_FINGER * 0.4 * lift)}),
        limb_pair("WingClaw", {"rx": const(8.0)}),
    )


def tail_wave(
    cycles: float,
    lat: float,
    vert: float,
    *,
    base_vert: float = 0.0,
    base_lat: float = 0.0,
    lag_lat: float = 0.30,
    lag_vert: float = 0.22,
    phase: float = 0.0,
) -> dict:
    """Ten-bone travelling wave. Amplitude grows toward the tip and each bone
    lags the one before it, so the shape moves down the tail and the tip trails
    the hips. Rotating only Tail1/Tail2 swings all ten as one rigid spike —
    which is what every flight clip in the old set did, when it moved the tail
    at all. Twelve of the sixteen left it completely still."""
    out = {}
    for i in range(10):
        grow = 0.35 + 0.85 * (i / 9.0)
        out[f"Tail{i + 1}"] = {
            "rz": harm(base_lat * grow,
                       (cycles, lat * grow, phase + i * lag_lat)),
            "rx": harm(base_vert * grow,
                       (cycles, vert * grow, phase + i * lag_vert)),
            "ry": const(0.0),
        }
    return out


def legs_tucked(*, thigh=42.0, calf=55.0, foot=25.0, toes=30.0, splay=6.0) -> dict:
    """Flight carriage: thighs swung back, knees folded, toes curled."""
    return merge(
        limb_pair("Thigh", {"rx": const(thigh), "rz": const(splay)}),
        limb_pair("Calf", {"rx": const(calf)}),
        limb_pair("Foot", {"rx": const(foot)}),
        limb_pair("Toes", {"rx": const(toes)}),
    )


def legs_hanging(*, thigh=8.0, calf=18.0, foot=-10.0, toes=12.0) -> dict:
    """Hover/approach carriage: legs dropped and loose under the hips."""
    return merge(
        limb_pair("Thigh", {"rx": const(thigh)}),
        limb_pair("Calf", {"rx": const(calf)}),
        limb_pair("Foot", {"rx": const(foot)}),
        limb_pair("Toes", {"rx": const(toes)}),
    )


def legs_planted(*, thigh=-5.0) -> dict:
    """Grounded stance. Symmetric by construction — the stale asymmetric stance
    (`L -20` / `R +15`) that leaked into seven clips is exactly what this
    prevents."""
    return merge(
        limb_pair("Thigh", {"rx": const(thigh)}),
        limb_pair("Calf", {"rx": const(0.0)}),
        limb_pair("Foot", {"rx": const(0.0)}),
        limb_pair("Toes", {"rx": const(0.0)}),
    )


def neck_head(
    *,
    pitch: float = 0.0,
    yaw: float = 0.0,
    head_pitch: float = 0.0,
    breathe: tuple | None = None,
    survey: tuple | None = None,
) -> dict:
    """Neck chain plus skull. `pitch` is positive-down, matching the rig.

    The head carries a counter-pitch against the neck so the skull stays level
    while the body moves under it — without it the skull rides the neck like a
    mast and the whole thing reads as a puppet.
    """
    pitchc, yawc_base, headc = curve(pitch), curve(yaw), curve(head_pitch)
    n1 = [scaled(pitchc, 0.45)]
    n2 = [scaled(pitchc, 0.55)]
    hd = [headc]
    if breathe:
        cycles, amp, phase = breathe
        n1.append(harm(0.0, (cycles, -amp * 0.35, phase + 0.45), skew=0.35))
        n2.append(harm(0.0, (cycles, -amp * 0.50, phase + 0.60), skew=0.35))
        hd.append(harm(0.0, (cycles, amp * 1.20, phase + 0.90), skew=0.35))
    if survey:
        cycles, amp, phase = survey
        yawc = [add(scaled(yawc_base, 0.4), harm(0.0, (cycles, amp * 0.5, phase))),
                add(scaled(yawc_base, 0.6), harm(0.0, (cycles, amp * 0.7, phase + 0.5))),
                harm(0.0, (cycles, -amp * 0.4, phase + 0.9))]
    else:
        yawc = [scaled(yawc_base, 0.4), scaled(yawc_base, 0.6), const(0.0)]
    return {
        "Neck1": {"rx": add(*n1), "rz": yawc[0], "ry": const(0.0)},
        "Neck2": {"rx": add(*n2), "rz": yawc[1], "ry": const(0.0)},
        "Head": {"rx": add(*hd), "rz": yawc[2], "ry": const(0.0)},
    }


def spine(pitch: float, *, breathe: tuple | None = None, roll: float = 0.0) -> dict:
    """Torso pitch spread across the three spine bones, positive = nose down.

    Spine1 deliberately carries none of it: `L_LegRoot`/`R_LegRoot` are parented
    there, so rotating it swings both legs and unplants the feet.
    """
    pitchc, rollc = curve(pitch), curve(roll)
    b2 = [scaled(pitchc, 0.45)]
    b3 = [scaled(pitchc, 0.55)]
    if breathe:
        cycles, amp, phase = breathe
        b2.append(harm(0.0, (cycles, -amp, phase + 0.15), skew=0.35))
        b3.append(harm(0.0, (cycles, -amp * 0.7, phase + 0.30), skew=0.35))
    return {
        "Spine1": {"rx": const(0.0), "ry": const(0.0), "rz": scaled(rollc, 0.3)},
        "Spine2": {"rx": add(*b2), "ry": const(0.0), "rz": scaled(rollc, 0.35)},
        "Spine3": {"rx": add(*b3), "ry": const(0.0), "rz": scaled(rollc, 0.35)},
    }


def body(*, pitch=0.0, lift=None, shift=None, roll=None, yaw=None) -> dict:
    """Pelvis. `lift` is in rig units on local Z, which points at the FLOOR."""
    return {
        "Body": {
            "rx": curve(pitch),
            "rz": curve(roll or 0.0),
            "ry": curve(yaw or 0.0),
            "tz": curve(lift or 0.0),
            "ty": curve(shift or 0.0),
            "tx": const(0.0),
        }
    }


def still() -> dict:
    """Jaw and the root chain, held. Present so every clip keys them."""
    return {
        "Jaw": {"rx": const(0.0), "ry": const(0.0), "rz": const(0.0)},
        "RootMotion": {"rx": const(0.0), "ry": const(0.0), "rz": const(0.0),
                       "tx": const(0.0), "ty": const(0.0), "tz": const(0.0)},
        "Root": {"rx": const(0.0), "ry": const(0.0), "rz": const(0.0)},
    }


# ---------------------------------------------------------------------------
# The clips.
#
# Cadence is stated per clip because the flight modes are only distinguishable
# if their wingbeats are. The old set had cruise at 0.49 Hz against a 1.5 Hz
# spec and `speed` at 3.33 Hz against a 0.8 Hz spec — the two were, if anything,
# the wrong way round.
# ---------------------------------------------------------------------------

BREATH_CYCLES = 2

# Diagonal-couplet offset, measured off v1's `Battle_Walk` at frame
# resolution: R_foot and L_knuckle both plant at 36% of the cycle while
# L_foot and R_knuckle plant at ~0%. Not 0.5 — this is an overlapping
# walk, not a trot, and the difference is visible.
COUPLET_OFFSET = 0.36


def clip_cruise() -> dict:
    """2.0 s, 3 beats = 1.50 Hz. The reference flight loop; bankLeft/bankRight
    share its cadence and phase so `phaseGroup: 'flight'` crossfades preserve
    the stroke."""
    return merge(
        spine(-2.0),
        body(pitch=1.0, lift=harm(0.0, (3, -0.9, 0.9))),
        neck_head(pitch=-4.0, head_pitch=3.0),
        wingbeat(3, 22.0, base_elev=4.0, sweep=-2.0, sweep_amp=5.0),
        tail_wave(3, 1.6, 3.2, base_vert=-2.0),
        legs_tucked(),
        still(),
    )


def clip_scout() -> dict:
    """4.0 s, 2 beats = 0.50 Hz. A deliberately slower search loop, with the
    head sweeping the ground once per cycle — the reason it is a distinct mode
    and not just a slow cruise."""
    return merge(
        spine(-1.0),
        body(pitch=1.0, lift=harm(0.0, (2, -0.7, 0.9))),
        neck_head(pitch=-2.0, head_pitch=6.0, survey=(1, 9.0, 0.0)),
        wingbeat(2, 27.0, base_elev=5.0, sweep=-3.0, sweep_amp=6.0),
        tail_wave(2, 3.4, 2.6, base_vert=-2.0),
        legs_tucked(thigh=36.0, calf=48.0),
        still(),
    )


def _bank(inside: str) -> dict:
    """Bank as an asymmetric stroke, not a baked body roll.

    The runtime already rolls the whole model (`FlightLoopState` -> procedural
    attitude), so rolling here too would double it. What the clip owes is the
    part the runtime cannot fake: the inside wing shortening and tucking while
    the outside wing extends and sweeps a longer arc, plus the head leading the
    turn and the tail trailing out of it.
    """
    outside = "R" if inside == "L" else "L"
    lead = 1.0 if inside == "L" else -1.0
    return merge(
        spine(-2.0),
        body(pitch=1.0, lift=harm(0.0, (3, -0.9, 0.9))),
        neck_head(pitch=-4.0, yaw=14.0 * lead, head_pitch=3.0),
        wingbeat(3, 22.0, base_elev=4.0, sweep=-2.0, sweep_amp=5.0,
                 bias={inside: 0.62, outside: 1.24}),
        tail_wave(3, 1.6, 3.2, base_vert=-2.0, base_lat=-7.0 * lead),
        legs_tucked(),
        still(),
    )


def clip_hover() -> dict:
    """2.5 s, 4 beats = 1.60 Hz. Nose up, weight under the wing roots, legs
    hanging, and a much wider fore-and-aft sweep than cruise — a hover holds
    station by sculling, not by flapping harder."""
    return merge(
        spine(-30.0, breathe=(2, 0.6, 0.0)),
        body(pitch=-8.0, lift=harm(0.0, (4, -1.4, 0.9))),
        neck_head(pitch=18.0, head_pitch=-10.0),
        wingbeat(4, 38.0, base_elev=6.0, sweep=-4.0, sweep_amp=18.0, lag=0.65),
        tail_wave(4, 2.2, 5.0, base_vert=14.0),
        legs_hanging(),
        still(),
    )


def clip_speed() -> dict:
    """1.5 s, 3 beats = 2.00 Hz — the fastest cadence in the set, which is what
    the mode is for. Shallow stroke, wings swept back, nose slightly down."""
    return merge(
        spine(6.0),
        body(pitch=2.0, lift=harm(0.0, (3, -0.5, 0.9))),
        neck_head(pitch=2.0, head_pitch=-4.0),
        wingbeat(3, 15.0, base_elev=2.0, sweep=14.0, sweep_amp=4.0, lag=0.40),
        tail_wave(3, 0.9, 1.8, base_vert=-6.0),
        legs_tucked(thigh=50.0, calf=64.0, toes=36.0),
        still(),
    )


def clip_glide() -> dict:
    """4.0 s, no wingbeat. Wings held extended; the only motion is a slow
    ripple through the membrane and a drifting tail. Cadence is deliberately
    zero — a glide that flaps is a slow cruise."""
    return merge(
        spine(-1.0, breathe=(1, 0.5, 0.0)),
        body(pitch=0.5, lift=harm(0.0, (1, -0.4, 0.0))),
        neck_head(pitch=-3.0, head_pitch=2.0, survey=(1, 3.5, 0.0)),
        merge(
            limb_pair("WingShoulder", {"rx": harm(6.0, (1, 1.4, 0.0)), "rz": const(-4.0)}),
            limb_pair("WingElbow", {"rx": harm(1.0, (1, 1.0, 0.5)), "rz": const(-2.0)}),
            limb_pair("WingWrist", {"rx": harm(0.0, (1, 0.9, 1.0)), "rz": const(0.0)}),
            limb_pair("WingFinger1", {"rx": harm(0.0, (1, 0.8, 1.4)), "rz": const(0.0)}),
            limb_pair("WingFinger2", {"rx": harm(0.0, (1, 0.7, 1.5)), "rz": const(0.0)}),
            limb_pair("WingFinger3", {"rx": harm(0.0, (1, 0.6, 1.6)), "rz": const(0.0)}),
            limb_pair("WingMembrane1", {"rx": harm(0.0, (2, 1.1, 0.0)), "rz": const(0.0)}),
            limb_pair("WingMembrane2", {"rx": harm(0.0, (2, 1.0, 0.4)), "rz": const(0.0)}),
            limb_pair("WingClaw", {"rx": const(4.0)}),
        ),
        tail_wave(1, 2.6, 1.4, base_vert=-3.0),
        legs_tucked(thigh=38.0, calf=50.0),
        still(),
    )


def clip_dive() -> dict:
    """2.0 s. Nose down hard, wings swept and tucked to the body, everything
    streamlined. The stroke almost vanishes — a dive is ballistic."""
    return merge(
        spine(34.0),
        body(pitch=6.0, lift=harm(0.0, (2, -0.3, 0.0))),
        neck_head(pitch=-16.0, head_pitch=-8.0),
        wingbeat(2, 5.0, base_elev=-22.0, sweep=34.0, sweep_amp=2.0, lag=0.35),
        tail_wave(2, 0.7, 1.0, base_vert=-12.0),
        legs_tucked(thigh=56.0, calf=70.0, foot=32.0, toes=40.0, splay=2.0),
        still(),
    )


def clip_walk() -> dict:
    """1.5 s stride, walked on all four limbs.

    v1's `Battle_Walk`, measured at frame resolution, is a diagonal-couplet walk:
    each hind foot plants with the OPPOSITE wing knuckle, and the two couplets
    are **0.36 of a cycle apart**, not 0.5 — an overlapping walk rather than a
    trot. Reproduced here exactly:

        L_foot + R_knuckle  plant at 0.00
        R_foot + L_knuckle  plant at 0.36

    An earlier pass authored this as a biped with the wings folded over the
    back, which reads as a bird. The wings are forelimbs; they carry the
    forequarters on the ground.
    """
    A, B = 0.0, COUPLET_OFFSET
    return merge(
        spine(2.0, breathe=(2, 0.5, 0.0), roll=0.0),
        # Pelvis answers the FOUR contacts, not two: two dips per stride from
        # the hind pair, plus a roll that follows the couplet alternation.
        body(pitch=1.5,
             lift=harm(0.0, (2, -1.4, plant_phase(A, 2))),
             roll=harm(0.0, (1, 2.2, plant_phase(A))),
             yaw=harm(0.0, (1, 1.2, plant_phase(A) + 1.4))),
        # The shoulder girdle now takes load, so the neck bobs against the
        # forelimb couplet rather than against the hind one.
        neck_head(pitch=-1.0, head_pitch=3.0,
                  breathe=(2, 0.9, 0.2), survey=(1, 2.0, plant_phase(B))),
        wings_planted(step=13.0, cycles=1, plant_l=B, plant_r=A, settle=1.0),
        tail_wave(1, 5.5, 2.2, base_vert=4.0),
        legs_gait(step=20.0, cycles=1, plant_l=A, plant_r=B, stance=-4.0),
        still(),
    )


def clip_rest() -> dict:
    """5.0 s. Lying down: pelvis lowered onto the hocks, legs folded under,
    wings closed tight, neck drawn back and head low. Only the breath moves."""
    return merge(
        spine(6.0, breathe=(BREATH_CYCLES, 1.5, 0.0)),
        body(pitch=8.0, lift=harm(66.0, (BREATH_CYCLES, -1.2, 0.1))),
        neck_head(pitch=26.0, head_pitch=-14.0, breathe=(BREATH_CYCLES, 1.4, 0.4)),
        # Lying, but the forelimbs are still folded under rather than
        # tucked over the back — `reach` shortens the plant so the knuckles
        # rest beside the chest instead of propping it up.
        wings_planted(reach=0.72, settle=0.5, cycles=BREATH_CYCLES),
        tail_wave(1, 3.0, 1.2, base_vert=1.5, base_lat=6.0),
        merge(
            limb_pair("Thigh", {"rx": const(64.0), "rz": const(14.0)}),
            limb_pair("Calf", {"rx": const(88.0)}),
            limb_pair("Foot", {"rx": const(-34.0)}),
            limb_pair("Toes", {"rx": const(10.0)}),
        ),
        still(),
    )


def clip_breath() -> dict:
    """2.0 s loop. Sustained fire breath.

    `Jaw` cannot open a mouth on this rig (see the module docstring), so the
    clip is carried by the forequarters: the chest heaves on a fast pulse, the
    neck drives forward and down along the stream, and the head shakes on a
    faster harmonic so the jet reads as continuous effort rather than a held
    pose. The one thing it must not do is look like idle with a particle
    system attached — the old clip moved exactly one bone, five degrees.
    """
    return merge(
        spine(-8.0, breathe=(4, 2.4, 0.0)),
        body(pitch=-3.0, lift=harm(0.0, (4, -0.8, 0.2)), shift=harm(-1.2, (4, 0.6, 0.0))),
        {
            "Neck1": {"rx": harm(-14.0, (4, 1.8, 0.3), (8, 0.5, 0.0)),
                      "rz": harm(0.0, (2, 1.2, 0.0)), "ry": const(0.0)},
            "Neck2": {"rx": harm(-10.0, (4, 2.2, 0.5), (8, 0.6, 0.2)),
                      "rz": harm(0.0, (2, 1.6, 0.4)), "ry": const(0.0)},
            "Head": {"rx": harm(16.0, (4, 2.6, 0.8), (8, 1.1, 0.4)),
                     "rz": harm(0.0, (2, -1.4, 0.9)), "ry": const(0.0)},
            # The small upper-skull cluster this bone does drive, worked as a
            # snarl. It is not a mouth, and it is not pretending to be one.
            "Jaw": {"rx": harm(7.0, (4, 3.0, 0.8)), "ry": const(0.0), "rz": const(0.0)},
        },
        # Reared to breathe, which swings the shoulders back and the planted
        # limbs down with them; `trim` puts the knuckles back on the floor.
        wings_planted(settle=2.2, cycles=2, trim=15.0),
        tail_wave(2, 4.5, 2.0, base_vert=6.0),
        legs_planted(thigh=-8.0),
        {"RootMotion": {"rx": const(0.0), "ry": const(0.0), "rz": const(0.0),
                        "tx": const(0.0), "ty": const(0.0), "tz": const(0.0)},
         "Root": {"rx": const(0.0), "ry": const(0.0), "rz": const(0.0)}},
    )


def clip_attack() -> dict:
    """1.0 s. Rear back, lunge, recover — and it returns to its own start, so
    the manifest can use it both as a one-shot (`attackAir`) and as a loop
    (`attack`) without a seam."""
    return merge(
        # The lunge is deliberately shallower than a full ground bite. `attack`
        # carries yOffset 0 and doubles as `attackAir`, so depth here is depth
        # *through the floor*; the read comes from the rear-back and the speed
        # of the strike, not from how far the skull travels.
        spine(keys([(0.0, 0.0), (0.30, -16.0), (0.52, 9.0), (0.75, 2.0), (1.0, 0.0)])),
        body(pitch=keys([(0.0, 0.0), (0.30, -6.0), (0.52, 4.0), (1.0, 0.0)]),
             shift=keys([(0.0, 0.0), (0.30, 2.0), (0.55, -4.0), (1.0, 0.0)])),
        {
            "Neck1": {"rx": keys([(0.0, 0.0), (0.30, -24.0), (0.52, 13.0),
                                  (0.75, 3.0), (1.0, 0.0)]),
                      "rz": const(0.0), "ry": const(0.0)},
            "Neck2": {"rx": keys([(0.0, 0.0), (0.32, -20.0), (0.54, 14.0),
                                  (0.78, 3.0), (1.0, 0.0)]),
                      "rz": const(0.0), "ry": const(0.0)},
            "Head": {"rx": keys([(0.0, 0.0), (0.34, -12.0), (0.56, 11.0),
                                 (0.80, 2.0), (1.0, 0.0)]),
                     "rz": const(0.0), "ry": const(0.0)},
            "Jaw": {"rx": keys([(0.0, 0.0), (0.30, 14.0), (0.50, 18.0),
                                (0.60, 0.0), (1.0, 0.0)]),
                    "ry": const(0.0), "rz": const(0.0)},
        },
        # Wings stay folded. An earlier pass flared them on the lunge, which
        # swung 21 m of spread spar down behind the reared body and put the
        # clip's low point 3.0 m under the floor at frame 8 — and `attack`
        # carries yOffset 0, so that is 3.0 m of wyvern inside the ground. The
        # manifest already notes this clip "is all forequarters"; the fold is
        # the same one `walk` uses, which plants at -0.52 m.
        # `attack` carries yOffset 0 and doubles as `attackAir`, so a planted
        # limb dipping under the floor here is depth through the ground.
        wings_planted(settle=2.0, cycles=1, trim=16.0),
        # Held clear of the floor: `attack` carries yOffset 0 in the manifest
        # because it also plays airborne, so anything that dips below the origin
        # here sinks the grounded bite into the ground rather than being lifted
        # out of it. The counterweight swings up on the rear-back and levels on
        # the lunge, which is the direction it wants anyway.
        {f"Tail{i + 1}": {
            "rz": const(0.0),
            "rx": keys([(0.0, 4.0 * (0.35 + 0.85 * i / 9.0)),
                        (0.30, 11.0 * (0.35 + 0.85 * i / 9.0)),
                        (0.55, 1.0 * (0.35 + 0.85 * i / 9.0)),
                        (1.0, 4.0 * (0.35 + 0.85 * i / 9.0))]),
            "ry": const(0.0)} for i in range(10)},
        merge(
            limb_pair("Thigh", {"rx": keys([(0.0, -5.0), (0.30, -12.0),
                                            (0.55, 4.0), (1.0, -5.0)])}),
            limb_pair("Calf", {"rx": keys([(0.0, 0.0), (0.30, 10.0), (1.0, 0.0)])}),
            limb_pair("Foot", {"rx": const(0.0)}),
            limb_pair("Toes", {"rx": const(0.0)}),
        ),
        {"RootMotion": {"rx": const(0.0), "ry": const(0.0), "rz": const(0.0),
                        "tx": const(0.0), "ty": const(0.0), "tz": const(0.0)},
         "Root": {"rx": const(0.0), "ry": const(0.0), "rz": const(0.0)}},
    )


def clip_takeoff() -> dict:
    """2.5 s one-shot, ground to air. Crouch, leap, two hard power strokes.

    Ends on `cruise`'s opening pose — `blend_into()` guarantees that, because
    the manifest chains `fly -> airborne` and a mismatch there is a visible pop
    on every launch.

    No root translation is baked: the scene positions airborne wyverns, so a
    baked climb would double it. The leap reads through the pelvis instead.
    """
    return merge(
        spine(keys([(0.0, 4.0), (0.20, 14.0), (0.36, -26.0), (0.60, -8.0), (1.0, -2.0)])),
        body(pitch=keys([(0.0, 2.0), (0.20, 8.0), (0.36, -14.0), (1.0, 1.0)]),
             lift=keys([(0.0, 0.0), (0.20, 34.0), (0.40, -26.0), (0.70, -8.0), (1.0, 0.0)])),
        neck_head(pitch=keys([(0.0, 2.0), (0.20, 10.0), (0.38, -18.0), (1.0, -4.0)]),
                  head_pitch=keys([(0.0, 0.0), (0.22, -6.0), (0.42, 10.0), (1.0, 3.0)])),
        # Wings: folded -> a big gathering sweep up -> two power strokes that
        # hand off at cruise's phase.
        merge(
            limb_pair("WingShoulder", {
                "rz": keys([(0.0, PLANT["sweep"]), (0.22, 4.0), (0.45, -6.0), (1.0, -2.0)]),
                "rx": keys([(0.0, PLANT["shoulder"]), (0.18, 46.0), (0.34, -34.0), (0.50, 40.0),
                            (0.66, -28.0), (0.82, 30.0), (1.0, 4.0)])}),
            limb_pair("WingElbow", {
                "rz": keys([(0.0, 0.0), (0.24, 2.0), (1.0, -1.0)]),
                "rx": keys([(0.0, PLANT["elbow"]), (0.22, 22.0), (0.38, -16.0), (0.54, 18.0),
                            (0.70, -13.0), (0.86, 14.0), (1.0, 1.8)])}),
            limb_pair("WingWrist", {
                "rz": keys([(0.0, 0.0), (0.26, 1.0), (1.0, 0.0)]),
                "rx": keys([(0.0, PLANT["wrist"]), (0.26, 16.0), (0.42, -12.0), (0.58, 13.0),
                            (0.74, -9.0), (0.90, 10.0), (1.0, 1.4)])}),
            limb_pair("WingFinger1", {
                "rz": keys([(0.0, 6.0), (0.28, 0.0), (1.0, 0.0)]),
                "rx": keys([(0.0, PLANT["finger"]), (0.30, 11.0), (0.46, -8.0), (1.0, 1.0)])}),
            limb_pair("WingFinger2", {
                "rz": keys([(0.0, 8.0), (0.28, 0.0), (1.0, 0.0)]),
                "rx": keys([(0.0, PLANT["finger"] * 0.92), (0.30, 9.0), (0.46, -7.0), (1.0, 0.9)])}),
            limb_pair("WingFinger3", {
                "rz": keys([(0.0, 10.0), (0.28, 0.0), (1.0, 0.0)]),
                "rx": keys([(0.0, PLANT["finger"] * 0.84), (0.30, 7.0), (0.46, -6.0), (1.0, 0.7)])}),
            limb_pair("WingMembrane1", {
                "rz": keys([(0.0, 4.0), (0.30, 0.0), (1.0, 0.0)]),
                "rx": keys([(0.0, PLANT["finger"] * 0.4), (0.32, 8.0), (1.0, 0.8)])}),
            limb_pair("WingMembrane2", {
                "rz": keys([(0.0, 5.0), (0.30, 0.0), (1.0, 0.0)]),
                "rx": keys([(0.0, PLANT["finger"] * 0.3), (0.32, 7.0), (1.0, 0.7)])}),
            limb_pair("WingClaw", {"rx": keys([(0.0, -12.0), (1.0, 0.0)])}),
        ),
        {f"Tail{i + 1}": {
            "rz": const(0.0),
            "rx": keys([(0.0, 0.0), (0.20, 10.0 * (0.35 + 0.85 * i / 9.0)),
                        (0.42, -14.0 * (0.35 + 0.85 * i / 9.0)),
                        (1.0, -2.0 * (0.35 + 0.85 * i / 9.0))]),
            "ry": const(0.0)} for i in range(10)},
        # Legs: compress, extend hard through the leap, then tuck.
        merge(
            limb_pair("Thigh", {
                "rx": keys([(0.0, -4.0), (0.20, 34.0), (0.34, -18.0), (0.60, 30.0), (1.0, 42.0)]),
                "rz": keys([(0.0, 0.0), (1.0, 6.0)])}),
            limb_pair("Calf", {
                "rx": keys([(0.0, 0.0), (0.20, 52.0), (0.34, -6.0), (0.60, 40.0), (1.0, 55.0)])}),
            limb_pair("Foot", {
                "rx": keys([(0.0, 0.0), (0.20, -28.0), (0.36, 24.0), (1.0, 25.0)])}),
            limb_pair("Toes", {
                "rx": keys([(0.0, 0.0), (0.22, -16.0), (0.40, 26.0), (1.0, 30.0)])}),
        ),
        still(),
    )


def clip_land() -> dict:
    """3.0 s one-shot, air to ground. Flare, reach, touch, fold.

    Ends on `idle`'s opening pose (`blend_into`), because the manifest chains
    `land -> idle` and that seam is watched every time a wyvern comes home.
    """
    return merge(
        spine(keys([(0.0, -6.0), (0.22, -34.0), (0.48, -12.0), (0.70, 6.0), (1.0, 0.0)])),
        body(pitch=keys([(0.0, 0.0), (0.22, -16.0), (0.50, -4.0), (1.0, 0.0)]),
             lift=keys([(0.0, -18.0), (0.30, -26.0), (0.55, 6.0), (0.72, -4.0), (1.0, 0.0)])),
        neck_head(pitch=keys([(0.0, -4.0), (0.24, 16.0), (0.55, -6.0), (1.0, 0.0)]),
                  head_pitch=keys([(0.0, 2.0), (0.26, -12.0), (0.58, 6.0), (1.0, 0.0)])),
        # Big cupped braking stroke, then the wings close down onto the fold.
        merge(
            limb_pair("WingShoulder", {
                "rz": keys([(0.0, -2.0), (0.25, -18.0), (0.55, 6.0), (0.78, 24.0),
                            (1.0, PLANT["sweep"])]),
                "rx": keys([(0.0, 4.0), (0.16, 44.0), (0.34, -30.0), (0.52, 34.0),
                            (0.70, 18.0), (1.0, PLANT["shoulder"])])}),
            limb_pair("WingElbow", {
                "rz": keys([(0.0, -1.0), (0.25, -14.0), (0.55, 4.0), (1.0, 0.0)]),
                "rx": keys([(0.0, 1.8), (0.20, 24.0), (0.38, -14.0), (0.56, 16.0),
                            (1.0, PLANT["elbow"])])}),
            limb_pair("WingWrist", {
                "rz": keys([(0.0, 0.0), (0.25, -10.0), (1.0, 0.0)]),
                "rx": keys([(0.0, 1.4), (0.24, 18.0), (0.42, -10.0), (1.0, PLANT["wrist"])])}),
            limb_pair("WingFinger1", {
                "rz": keys([(0.0, 0.0), (0.30, -8.0), (1.0, 6.0)]),
                "rx": keys([(0.0, 1.0), (0.28, 12.0), (1.0, PLANT["finger"])])}),
            limb_pair("WingFinger2", {
                "rz": keys([(0.0, 0.0), (0.30, -7.0), (1.0, 8.0)]),
                "rx": keys([(0.0, 0.9), (0.28, 10.0), (1.0, PLANT["finger"] * 0.92)])}),
            limb_pair("WingFinger3", {
                "rz": keys([(0.0, 0.0), (0.30, -6.0), (1.0, 10.0)]),
                "rx": keys([(0.0, 0.7), (0.28, 8.0), (1.0, PLANT["finger"] * 0.84)])}),
            limb_pair("WingMembrane1", {
                "rz": keys([(0.0, 0.0), (1.0, 4.0)]),
                "rx": keys([(0.0, 0.8), (0.30, 9.0), (1.0, PLANT["finger"] * 0.4)])}),
            limb_pair("WingMembrane2", {
                "rz": keys([(0.0, 0.0), (1.0, 5.0)]),
                "rx": keys([(0.0, 0.7), (0.30, 8.0), (1.0, PLANT["finger"] * 0.3)])}),
            limb_pair("WingClaw", {"rx": keys([(0.0, 0.0), (1.0, -12.0)])}),
        ),
        {f"Tail{i + 1}": {
            "rz": const(0.0),
            "rx": keys([(0.0, -2.0 * (0.35 + 0.85 * i / 9.0)),
                        (0.24, 16.0 * (0.35 + 0.85 * i / 9.0)),
                        (0.56, -6.0 * (0.35 + 0.85 * i / 9.0)), (1.0, 0.0)]),
            "ry": const(0.0)} for i in range(10)},
        # Legs swing forward to reach for the ground, absorb, then stand.
        merge(
            limb_pair("Thigh", {
                "rx": keys([(0.0, 42.0), (0.30, -26.0), (0.52, -16.0), (0.70, 8.0), (1.0, -5.0)]),
                "rz": keys([(0.0, 6.0), (1.0, 0.0)])}),
            limb_pair("Calf", {
                "rx": keys([(0.0, 55.0), (0.32, 8.0), (0.55, 34.0), (1.0, 0.0)])}),
            limb_pair("Foot", {
                "rx": keys([(0.0, 25.0), (0.34, -18.0), (0.56, 10.0), (1.0, 0.0)])}),
            limb_pair("Toes", {
                "rx": keys([(0.0, 30.0), (0.36, -14.0), (0.58, 6.0), (1.0, 0.0)])}),
        ),
        still(),
    )


def clip_death() -> dict:
    """4.0 s one-shot. Rear, stall, collapse sideways, settle.

    The one clip where a baked lateral roll is right: nothing else is going to
    tip the body over, and the actor is dead so no runtime attitude is fighting
    it.
    """
    fall = keys([(0.0, 0.0), (0.18, -8.0), (0.34, 6.0), (0.62, 62.0), (0.82, 74.0),
                 (1.0, 72.0)])
    return merge(
        spine(keys([(0.0, 0.0), (0.16, -22.0), (0.40, 10.0), (0.70, 26.0), (1.0, 22.0)])),
        {"Spine1": {"rx": const(0.0), "ry": const(0.0),
                    "rz": keys([(0.0, 0.0), (0.40, 4.0), (0.70, 16.0), (1.0, 15.0)])},
         "Spine2": {"rz": keys([(0.0, 0.0), (0.40, 5.0), (0.70, 18.0), (1.0, 17.0)])},
         "Spine3": {"rz": keys([(0.0, 0.0), (0.40, 5.0), (0.70, 18.0), (1.0, 17.0)])}},
        body(pitch=keys([(0.0, 0.0), (0.16, -10.0), (0.62, 18.0), (1.0, 16.0)]),
             roll=fall,
             lift=keys([(0.0, 0.0), (0.20, -14.0), (0.55, 40.0), (0.78, 96.0), (1.0, 98.0)])),
        {
            "Neck1": {"rx": keys([(0.0, 0.0), (0.16, -26.0), (0.44, 18.0),
                                  (0.74, 40.0), (1.0, 38.0)]),
                      "rz": keys([(0.0, 0.0), (0.62, 12.0), (1.0, 18.0)]), "ry": const(0.0)},
            "Neck2": {"rx": keys([(0.0, 0.0), (0.18, -20.0), (0.46, 22.0),
                                  (0.76, 44.0), (1.0, 42.0)]),
                      "rz": keys([(0.0, 0.0), (0.64, 14.0), (1.0, 20.0)]), "ry": const(0.0)},
            "Head": {"rx": keys([(0.0, 0.0), (0.20, -14.0), (0.50, 16.0),
                                 (0.80, 26.0), (1.0, 24.0)]),
                     "rz": keys([(0.0, 0.0), (0.66, -10.0), (1.0, -14.0)]), "ry": const(0.0)},
            "Jaw": {"rx": keys([(0.0, 0.0), (0.20, 16.0), (0.55, 6.0), (1.0, 2.0)]),
                    "ry": const(0.0), "rz": const(0.0)},
        },
        # Wings flail once, then splay limp.
        merge(
            limb_pair("WingShoulder", {
                "rz": keys([(0.0, PLANT["sweep"]), (0.22, -8.0), (0.60, 12.0), (1.0, 20.0)]),
                "rx": keys([(0.0, PLANT["shoulder"]), (0.20, 40.0), (0.42, -20.0), (0.70, -34.0),
                            (1.0, -30.0)])}),
            limb_pair("WingElbow", {
                "rz": keys([(0.0, 0.0), (0.24, -4.0), (1.0, 16.0)]),
                "rx": keys([(0.0, PLANT["elbow"]), (0.24, 20.0), (0.48, -14.0), (1.0, -22.0)])}),
            limb_pair("WingWrist", {
                "rz": keys([(0.0, 0.0), (0.26, 0.0), (1.0, 14.0)]),
                "rx": keys([(0.0, PLANT["wrist"]), (0.28, 14.0), (1.0, -18.0)])}),
            limb_pair("WingFinger1", {
                "rz": keys([(0.0, 6.0), (0.30, 4.0), (1.0, 18.0)]),
                "rx": keys([(0.0, PLANT["finger"]), (0.30, 10.0), (1.0, -14.0)])}),
            limb_pair("WingFinger2", {
                "rz": keys([(0.0, 8.0), (0.30, 4.0), (1.0, 19.0)]),
                "rx": keys([(0.0, PLANT["finger"] * 0.92), (0.30, 9.0), (1.0, -12.0)])}),
            limb_pair("WingFinger3", {
                "rz": keys([(0.0, 10.0), (0.30, 4.0), (1.0, 20.0)]),
                "rx": keys([(0.0, PLANT["finger"] * 0.84), (0.30, 8.0), (1.0, -10.0)])}),
            limb_pair("WingMembrane1", {
                "rz": keys([(0.0, 4.0), (1.0, 10.0)]),
                "rx": keys([(0.0, PLANT["finger"] * 0.4), (0.30, 8.0), (1.0, -8.0)])}),
            limb_pair("WingMembrane2", {
                "rz": keys([(0.0, 5.0), (1.0, 11.0)]),
                "rx": keys([(0.0, PLANT["finger"] * 0.3), (0.30, 7.0), (1.0, -7.0)])}),
            limb_pair("WingClaw", {"rx": keys([(0.0, 8.0), (1.0, 0.0)])}),
        ),
        {f"Tail{i + 1}": {
            "rz": keys([(0.0, 0.0), (0.55, 10.0 * (0.35 + 0.85 * i / 9.0)),
                        (1.0, 16.0 * (0.35 + 0.85 * i / 9.0))]),
            "rx": keys([(0.0, 0.0), (0.20, 14.0 * (0.35 + 0.85 * i / 9.0)),
                        (0.60, -10.0 * (0.35 + 0.85 * i / 9.0)),
                        (1.0, -6.0 * (0.35 + 0.85 * i / 9.0))]),
            "ry": const(0.0)} for i in range(10)},
        merge(
            limb_pair("Thigh", {
                "rx": keys([(0.0, -5.0), (0.24, -22.0), (0.60, 40.0), (1.0, 52.0)]),
                "rz": keys([(0.0, 0.0), (1.0, 12.0)])}),
            limb_pair("Calf", {"rx": keys([(0.0, 0.0), (0.30, 16.0), (1.0, 70.0)])}),
            limb_pair("Foot", {"rx": keys([(0.0, 0.0), (0.60, -20.0), (1.0, -28.0)])}),
            limb_pair("Toes", {"rx": keys([(0.0, 0.0), (0.40, 18.0), (1.0, 24.0)])}),
        ),
        still(),
    )


def clip_idle() -> dict:
    """6.0 s. Delegated to `author-wyvern-idle-blender.py`, whose parameters are
    tuned against the measured signature and are not re-derived here. Only the
    representation is converted — its `(static, harmonics)` tuples become the
    curve callables this file uses."""
    spec = importlib.util.spec_from_file_location(
        "wyvern_idle", HERE / "author-wyvern-idle-blender.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    out: dict = {}
    for bone, channels in module.clip_definition().items():
        emitted = {}
        for channel, spec_tuple in channels.items():
            emitted[channel] = (lambda s=spec_tuple, m=module:
                                (lambda t: m.evaluate(s, t * m.PERIOD)))()
        out[bone] = emitted

    # Wings come from the shared fold rather than idle's own table.
    #
    # idle folded the shoulder and elbow and left the wrist and finger spars
    # spread — the "wings never fold" defect its own docstring records. Every
    # other grounded clip here folds the full ladder, so leaving idle out left
    # `land` ending 0.46 rad away from the pose it chains into: a visible pop
    # on every homecoming, and the two clips disagreeing about where a resting
    # wing sits. One fold, used by idle, walk, rest, breath, attack and the end
    # of land, is what makes those seams meet by construction.
    #
    # The settle amplitude is idle's own (a ~0.27 deg drift on the slow
    # carrier); only the static fold pose is taken from the shared ladder.
    # The idle table names only the bones it moves; everything else is keyed
    # flat by `build()`, which is what stops a stale pose leaking in.
    return merge(out, wings_planted(settle=0.27, cycles=1), still())


CLIPS = {
    "idle":      (144, True,  clip_idle),
    "walk":      (36,  True,  clip_walk),
    "rest":      (120, True,  clip_rest),
    "cruise":    (48,  True,  clip_cruise),
    "scout":     (96,  True,  clip_scout),
    "bankLeft":  (48,  True,  lambda: _bank("L")),
    "bankRight": (48,  True,  lambda: _bank("R")),
    "hover":     (60,  True,  clip_hover),
    "speed":     (36,  True,  clip_speed),
    "glide":     (96,  True,  clip_glide),
    "dive":      (48,  True,  clip_dive),
    "breath":    (48,  True,  clip_breath),
    "attack":    (24,  True,  clip_attack),
    "takeoff":   (60,  False, clip_takeoff),
    "land":      (72,  False, clip_land),
    "death":     (96,  False, clip_death),
}

# One-shot -> the clip the manifest chains it into. The last frames are eased
# into that clip's opening pose so the handoff cannot pop.
CHAINS = {"takeoff": "cruise", "land": "idle"}
CHAIN_BLEND = 0.18   # fraction of the clip spent easing into the target


def blend_into(channels: dict, target: dict, period: int) -> dict:
    """Ease the tail of a one-shot into `target`'s t=0 pose."""
    out: dict = {}
    for bone, chans in channels.items():
        emitted = {}
        for name, curve in chans.items():
            end = target.get(bone, {}).get(name)
            if end is None:
                emitted[name] = curve
                continue
            end_value = end(0.0)

            def blended(t, c=curve, v=end_value):
                if t <= 1.0 - CHAIN_BLEND:
                    return c(t)
                u = (t - (1.0 - CHAIN_BLEND)) / CHAIN_BLEND
                s = u * u * (3.0 - 2.0 * u)
                return c(t) * (1.0 - s) + v * s

            emitted[name] = blended
        out[bone] = emitted
    return out


# ---------------------------------------------------------------------------
# Build.
# ---------------------------------------------------------------------------

CHANNEL_PATH = {
    "rx": ("rotation_euler", 0), "ry": ("rotation_euler", 1), "rz": ("rotation_euler", 2),
    "tx": ("location", 0), "ty": ("location", 1), "tz": ("location", 2),
}

# Keyed flat on every clip so nothing is ever inherited from the session.
ALL_AXES = ("rx", "ry", "rz")


def armature() -> bpy.types.Object:
    obj = bpy.data.objects.get(ARMATURE)
    if obj is None or obj.type != "ARMATURE":
        raise SystemExit(f"armature {ARMATURE!r} not found")
    return obj


def reset_pose(arm: bpy.types.Object) -> None:
    """Return every bone to identity.

    Without this, `export_animation_mode='ACTIONS'` bakes whatever pose is
    sitting on an unkeyed bone. That is the entire cause of the seven broken
    clips this script replaces.
    """
    if arm.animation_data:
        arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.rotation_mode = "XYZ"
        pb.rotation_euler = (0.0, 0.0, 0.0)
        pb.location = (0.0, 0.0, 0.0)
        pb.scale = (1.0, 1.0, 1.0)
    bpy.context.view_layer.update()


def build(arm: bpy.types.Object, name: str, period: int, channels: dict) -> bpy.types.Action:
    unknown = [b for b in channels if b not in arm.pose.bones]
    if unknown:
        raise SystemExit(f"{name}: bones not on the rig: {unknown}")

    reset_pose(arm)

    old = bpy.data.actions.get(name)
    if old is not None:
        bpy.data.actions.remove(old)
    action = bpy.data.actions.new(name)

    if arm.animation_data is None:
        arm.animation_data_create()
    arm.animation_data.action = action
    slot = action.slots.new(id_type="OBJECT", name=ARMATURE)
    arm.animation_data.action_slot = slot
    layer = action.layers.new(name)
    strip = layer.strips.new(type="KEYFRAME")
    bag = strip.channelbags.new(slot)

    # EVERY bone, not just the ones this clip mentions.
    for pb in arm.pose.bones:
        chans = dict(channels.get(pb.name, {}))
        for axis in ALL_AXES:
            chans.setdefault(axis, const(0.0))
        for key in sorted(chans):
            curve = chans[key]
            prop, index = CHANNEL_PATH[key]
            scale = DEG if prop == "rotation_euler" else 1.0
            fcurve = bag.fcurves.new(f'pose.bones["{pb.name}"].{prop}', index=index)
            fcurve.keyframe_points.add(period + 1)
            for i, point in enumerate(fcurve.keyframe_points):
                point.co = (float(i), curve(i / period) * scale)
                point.interpolation = "BEZIER"
                point.handle_left_type = "AUTO_CLAMPED"
                point.handle_right_type = "AUTO_CLAMPED"
            fcurve.update()

    action.use_frame_range = True
    action.frame_start, action.frame_end = 0.0, float(period)
    return action


def export(path: str) -> None:
    """Only the wyvern rig and its mesh — the .blend also holds the 291-bone
    vendor armature and two scratch armatures, and exporting those would change
    the joint set `manifest.ts` and `rigBones.ts` are written against."""
    for obj in bpy.context.scene.objects:
        obj.select_set(obj.name in (ARMATURE, MESH))
    bpy.context.view_layer.objects.active = armature()
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_skins=True,
        export_apply=False,
        export_yup=True,
        # ON, unlike the single-clip idle script. That script kept it off so a
        # one-clip edit would not rewrite the other fifteen and bury the diff.
        # This script rewrites all sixteen every run, so that reason is gone,
        # and the flag collapses the flat channels every clip now keys back to
        # two keys each — which is what makes "key every bone" free.
        export_optimize_animation_size=True,
    )
    print(f"exported {path}")


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--save", action="store_true", help="write the .blend back")
    parser.add_argument("--export", default="", metavar="PATH", help="write a GLB")
    parser.add_argument("--only", default="", help="comma-separated clip subset")
    parser.add_argument(
        "--plant",
        action="append",
        default=[],
        metavar="NAME=VALUE",
        help=f"override a grounded-stance angle ({', '.join(PLANT)}). Repeatable.",
    )
    args, _ = parser.parse_known_args(argv)
    for override in args.plant:
        name, _, value = override.partition("=")
        if name not in PLANT:
            raise SystemExit(f"unknown plant angle {name!r}; expected one of {list(PLANT)}")
        PLANT[name] = float(value)

    scene = bpy.context.scene
    scene.render.fps = FPS
    arm = armature()

    wanted = [c.strip() for c in args.only.split(",") if c.strip()] or list(CLIPS)
    unknown = [c for c in wanted if c not in CLIPS]
    if unknown:
        raise SystemExit(f"unknown clips: {unknown}")

    # Built once so the chain targets can be sampled at t=0.
    tables = {name: CLIPS[name][2]() for name in CLIPS}

    for name in wanted:
        period, _loop, _ = CLIPS[name]
        table = tables[name]
        if name in CHAINS:
            table = blend_into(table, tables[CHAINS[name]], period)
        build(arm, name, period, table)
        print(f"authored {name}: {period + 1} frames, {period / FPS:.2f}s, "
              f"{len(arm.pose.bones)} bones keyed")

    # Leave the rig on a clean pose so a later manual save cannot re-introduce
    # the stale-pose problem this script exists to remove.
    reset_pose(arm)
    scene.frame_start, scene.frame_end = 0, max(CLIPS[n][0] for n in wanted)

    if args.export:
        export(args.export)
    if args.save:
        bpy.ops.wm.save_mainfile()
        print(f"saved {bpy.data.filepath}")


if __name__ == "__main__":
    main()
