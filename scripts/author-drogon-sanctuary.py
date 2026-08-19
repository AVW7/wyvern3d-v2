"""Author the Drogon sanctuary animation sidecar inside Blender.

Run this from the imported Drogon working file. The script samples measured,
existing full-body poses and turns them into short, purpose-built sanctuary
actions. It never overwrites or exports the vendor GLB.

The generated actions intentionally have short names. Blender truncates two of
the vendor action names at 63 characters, which is why the base asset is
reference-only and these additions ship in a separate sidecar.
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field, replace
from math import radians
from pathlib import Path
from mathutils import Matrix, Quaternion, Vector

import bpy


PREFIX = "SKM_DaenerysDragon|DaenerysDragon_"
STAND = "SKM_DaenerysDragon|AA_DaenerysDragon_Battle_Stand"
UP = f"{PREFIX}Battle_Up"
ATTACK = f"{PREFIX}Battle_Attack06"
BREATH = f"{PREFIX}Battle_Skill03"
GROGGY = f"{PREFIX}Damage_GroggyLoop"
ROAR = f"{PREFIX}Neutural_Roar"
WATCH = f"{PREFIX}Neutural_Watch"
# Cruise is sampled from the landing clip, not from a skill clip. Measured on
# the same rig (see validation/wyvern-animations/BUILD_NOTES.md), Battle_Down02
# has a left/right wingtip symmetry error of 1.49 against Battle_Skill11_L's
# 18.9, an 83-degree stroke, a body axis within 13 degrees of horizontal, and a
# pelvis that does not move on any of its 112 frames. Sampling one frame of an
# asymmetric swoop is what left the previous cruise loops with mismatched wings
# and a 27-degree twitch instead of a wingbeat.
CRUISE_SOURCE = f"{PREFIX}Battle_Down02"
FLIGHT_ROOT = "Bip002_06"

# One complete wingbeat inside Battle_Down02, frames 40 to 66. Elevation is the
# angle of the shoulder-to-wingtip vector above horizontal; the cycle runs
# mid-downstroke -> bottom (f45) -> top (f61) -> mid-downstroke.
#
# Chosen by measuring every candidate cycle in the clip rather than by eye. It
# carries the widest stroke plane of any of them - 53.9 degrees of wingtip
# azimuth against 33.8 for the bottom-to-bottom cycle and 41.1 for f28-f55 - and
# its two endpoints hold nearly the same wing pose (3.1 degrees of elevation,
# 3.8 of azimuth and 0.2 of extension apart), so the wrap back to the opening
# key is a continuation of the artist's motion rather than a snap.
BEAT_BASE_FRAME = 40
BEAT_START = 40
BEAT_END = 66

# Source frame -> that frame's measured wingtip elevation, in degrees.
#
# Nine landmarks, selected greedily to minimise the reconstruction error of the
# three wing channels that carry the beat - elevation, stroke-plane azimuth and
# wing extension. They reproduce the artist's own curves to a mean of 1.0
# degrees. The four landmarks these replaced managed 5.6, and that gap is the
# whole defect: between four keys 12 frames apart, Blender's AUTO_CLAMPED bezier
# invents a smooth arc that is not the artist's, which flattened the stroke
# plane from 53.9 degrees to 40.5 and all but removed the wrist fold on the
# recovery stroke. Amplitude was never the problem - elevation range already
# measured 84.6 against the source's 81.4.
BEAT_LANDMARKS = (
    (40, -26.0),
    (43, -49.4),
    (45, -51.6),
    (48, -35.0),
    (52, -2.4),
    (55, 9.3),
    (59, 23.5),
    (61, 28.7),
    (63, 16.5),
)

# Midpoint and half-amplitude of the cycle's elevation, from its own measured
# extremes: -52.7 at frame 44 and +28.7 at frame 61. Normalising a landmark
# about these gives +1 at the top of the stroke and -1 at the bottom, which is
# what drives both the bank differential and the secondary body response.
BEAT_ELEV_MID = -12.0
BEAT_ELEV_HALF = 40.7

# The two frames the unpowered modes hold, taken from the same f40-f66 window
# and chosen by reading the trace rather than by eye:
#
#   f42  elev -42.1  ext 17.30   the window's true extension maximum - but at
#                               the bottom of a downstroke, so it is a power
#                               pose, not a glide one
#   f55  elev  +9.3  ext 16.80   within 0.5 of that maximum and only 9 degrees
#                               above level: extended *and* flat, which is what
#                               a soaring wing is
#   f62  elev +26.9  ext 11.10   the tightest wrist fold in the window
#
# Regenerate with `pnpm assets:analyze-clips --trace Battle_Down02` and read
# the extL column; do not guess these.
HOLD_EXTENDED_FRAME = 55
HOLD_FOLDED_FRAME = 62

# Wing chains in hierarchy order, parent first. Mirroring assigns armature-space
# matrices, so a parent must be placed before its children.
def _wing_chain(side: str, suffixes: tuple[str, ...]) -> tuple[str, ...]:
    root, fingers = suffixes[:4], suffixes[4:]
    names = [
        f"Bip002-{side}-{part}_{suffix}"
        for part, suffix in zip(("Clavicle", "UpperArm", "Forearm", "Hand"), root)
    ]
    for index, group in enumerate(zip(fingers[::3], fingers[1::3], fingers[2::3])):
        names.extend(
            f"Bip002-{side}-Finger{index}{tail}_{suffix}"
            for tail, suffix in zip(("", "1", "2"), group)
        )
    return tuple(names)


WING_L = _wing_chain(
    "L",
    (
        "049", "050", "051", "052",
        "071", "072", "073",
        "065", "066", "067",
        "059", "060", "061",
        "053", "054", "055",
        "077", "078", "079",
        "083", "084", "085",
    ),
)
WING_R = _wing_chain(
    "R",
    (
        "086", "087", "088", "089",
        "0108", "0109", "0110",
        "0102", "0103", "0104",
        "096", "097", "098",
        "090", "091", "092",
        "0114", "0115", "0116",
        "0120", "0121", "0122",
    ),
)

# The membrane is driven by a *second* chain hanging off each finger root, as a
# sibling of the finger itself: Finger0 carries Bone049/050/051, Finger1 carries
# Bone046/047/048, and so on. Those bones deform the same surface as the finger
# chain, so mirroring the fingers without them leaves the membrane holding a pose
# that no longer matches the fingers it spans, and the shared surface tears into
# overlapping sheets on the destination wing - measured as 278 triangles
# stretched past 5x their bind length, 99% of them on one side, in every clip
# that mirrors. Finger5 has no membrane chain on either wing.
MEMBRANE_L = (
    "Bone049_074", "Bone050_075", "Bone051_076",   # Finger0
    "Bone046_068", "Bone047_069", "Bone048_070",   # Finger1
    "Bone043_062", "Bone044_063", "Bone045_064",   # Finger2
    "Bone040_056", "Bone041_057", "Bone042_058",   # Finger3
    "Bone052_080", "Bone053_081", "Bone054_082",   # Finger4
)
MEMBRANE_R = (
    "Bone064_0111", "Bone065_0112", "Bone066_0113",  # Finger0
    "Bone061_0105", "Bone062_0106", "Bone063_0107",  # Finger1
    "Bone058_099", "Bone059_0100", "Bone060_0101",   # Finger2
    "Bone055_093", "Bone056_094", "Bone057_095",     # Finger3
    "Bone067_0117", "Bone068_0118", "Bone069_0119",  # Finger4
)

# Appended, not interleaved: mirror_wing needs every parent placed before its
# children, and each membrane chain hangs off a finger root already listed above.
WING_L = WING_L + MEMBRANE_L
WING_R = WING_R + MEMBRANE_R

# The rig is mirrored across X in armature space: L-Clavicle sits at x=+83.77
# and R-Clavicle at x=-83.77. A transform M reflected through that plane is
# S @ M @ S, which stays a proper rotation because det(S)^2 = 1.
SAGITTAL = Matrix.Diagonal((-1.0, 1.0, 1.0, 1.0))

ACTION_NAMES = (
    "Sanct_Sleep",
    "Sanct_Rest",
    "Sanct_Sit",
    "Sanct_SitLoop",
    "Sanct_Rise",
    "Sanct_Eat",
    "Sanct_Breathe",
    "Sanct_BreatheAir",
    "Sanct_HuntGrip",
    "Sanct_HuntCarry",
    "Sanct_HuntFinish",
    "Sanct_Drink",
    "Sanct_Groom",
    "Sanct_PerchGrip",
    "Sanct_Cruise",
    "Sanct_Scout",
    "Sanct_BankL",
    "Sanct_BankR",
    "Sanct_Hover",
    "Sanct_Speed",
    "Sanct_Soar",
    "Sanct_Dive",
    "Sanct_Climb",
    "Sanct_Nuzzle",
    "Sanct_Calm",
    "Sanct_PickUp",
    "Sanct_Drop",
)
PRESERVED_ACTION_NAMES = ()

NECK = (
    "Bip002-Neck_012",
    "Bip002-Neck1_013",
    "Bip002-Neck2_014",
    "Bip002-Head_015",
)
# Despite its imported name, Bip002-Ponytail1 is the dragon's lower-head/jaw
# control. The tempting B_Face_Jaw belongs to the rider's Bip001 skeleton: an
# MCP mesh-weight probe places it around the human head, while this bone owns
# 4,220 vertices across Drogon's lower muzzle and turns 42 degrees during the
# artist's snap-bite. Keep the measured control here so bite/chew edits reach
# the creature the clip is authored for.
JAW = "Bip002-Ponytail1_016"
TOES = tuple(
    name
    for side in ("L", "R")
    for name in (
        f"Bip002-{side}-Toe0_{'0189' if side == 'L' else '0203'}",
        f"Bip002-{side}-Toe1_{'0192' if side == 'L' else '0205'}",
        f"Bip002-{side}-Toe2_{'0195' if side == 'L' else '0208'}",
        f"Bip002-{side}-Toe3_{'0198' if side == 'L' else '0211'}",
    )
)
TAIL = (
    "Bip002-Tail1_0215",
    "Bip002-Tail2_0216",
    "Bip002-Tail3_0217",
    "Bip002-Tail4_0218",
    "Bip002-Tail5_0219",
    "Bip002-Tail6_01",
)
SPINE = (
    "Bip002-Spine_08",
    "Bip002-Spine1_09",
    "Bip002-Spine2_010",
    "Bip002-Spine3_011",
)
HIND_LEGS = {
    "L": (
        "Bip002-L-Thigh_0186",
        "Bip002-L-Calf_0187",
        "Bip002-L-Foot_0188",
    ),
    "R": (
        "Bip002-R-Thigh_0201",
        "Bip002-R-Calf_00",
        "Bip002-R-Foot_0202",
    ),
}


@dataclass(frozen=True)
class RotationEdit:
    bone: str
    axis: tuple[float, float, float]
    angle: float


@dataclass(frozen=True)
class LocationEdit:
    bone: str
    delta: tuple[float, float, float]


@dataclass(frozen=True)
class PoseKey:
    dest: int
    source: str
    frame: int
    rotations: tuple[RotationEdit, ...] = field(default_factory=tuple)
    locations: tuple[LocationEdit, ...] = field(default_factory=tuple)
    #: Wing side to copy onto the other, mirrored, after the edits are applied.
    #: `"L"` overwrites the right wing with the left one's reflection. Use it
    #: whenever the sampled source pose is not already symmetric — a per-side
    #: flap delta cannot cancel a baseline asymmetry, it only offsets it.
    mirror: str | None = None
    #: Hind limb to copy onto the other, mirrored, on the same terms. Stated
    #: separately from `mirror` rather than inherited from it, because the two
    #: chains are answering different questions: the wing mirror removes a
    #: sampled *wingbeat's* asymmetry, this one removes the frozen base pose's.
    #: Grounded recipes leave it unset - their legs are planted and
    #: contact-driven, so left and right are meant to differ.
    mirror_legs: str | None = None
    #: Rotations applied *after* mirroring. Any deliberate left/right asymmetry
    #: belongs here: an edit in `rotations` that touches a wing chain would be
    #: overwritten by the mirror that follows it.
    post_rotations: tuple[RotationEdit, ...] = field(default_factory=tuple)
    #: Optional `(action, frame)` supplying every bone *except* the wing chains,
    #: so `source`/`frame` contribute the wingbeat alone.
    #:
    #: This is the layering model in docs/FLIGHT_ANIMATION_DEVELOPMENT.md made
    #: literal: primary posture from one steady frame, propulsion cycle from the
    #: beat's own landmarks. Flight needs it because the vendor cruise source is
    #: a *landing*, and its wingbeat cannot be lifted out whole. Measured on the
    #: rig across frames 40-66, the pelvis pitches from -50.7 to -88.0 degrees
    #: while the spine counter-rotates to keep the head-to-tail line level, so
    #: sampling the whole body would bake a 37-degree torso flare into a cruise
    #: loop and snap it back at the seam. Holding only the flight root instead
    #: is worse, not better: that leaves the spine's counter-rotation
    #: uncompensated and swings the body line from 2.2 to 39.6 degrees over one
    #: beat. The two are one authored gesture, so the body comes from one frame
    #: or the beat comes with a flare.
    body: tuple[str, int] | None = None


@dataclass(frozen=True)
class ActionRecipe:
    name: str
    role: str
    loop: bool
    keys: tuple[PoseKey, ...]


#: The neck chain's two useful bend axes, probed on the rig at the grounded poses
#: these recipes actually sample — `Neutural_Watch` f60 and f120 and
#: `Battle_Attack06` f20 — rather than reasoned about. Per 0.30 rad distributed
#: over the chain, and consistent across all three:
#:
#:   local Z   dz -0.42 .. -0.59   head down (and back)     <- `down`
#:   local Y   dx -0.12 .. -0.72   head to the rig's right  <- `side`
#:   local X   dx +0.05 .. +0.10   nothing useful
#:
#: Both arguments used to name the wrong one: `down` drove local X, which moves
#: the head a tenth of a unit sideways, and `side` drove local Z, which lowers
#: it. So every grounded recipe below had its two neck layers swapped, with one
#: of them inert — the groom's "turn back to preen the folded wing" was lowering
#: the head 1.5 units and turning it nowhere.
NECK_DOWN_AXIS = (0.0, 0.0, 1.0)
NECK_SIDE_AXIS = (0.0, 1.0, 0.0)


def neck_bend(side: float = 0.0, down: float = 0.0) -> tuple[RotationEdit, ...]:
    """Distribute a gentle local-space bend over the four-bone neck chain.

    Positive `down` lowers the muzzle; positive `side` turns the head toward the
    rig's right (-x). Neither axis is pure — the neck's local frame is rotated
    against the world, so `down` carries the head backwards as well and `side`
    carries it forwards — but each is the dominant contributor to its own
    direction at every pose these recipes sample.
    """
    edits: list[RotationEdit] = []
    weights = (0.22, 0.28, 0.30, 0.20)
    for bone, weight in zip(NECK, weights, strict=True):
        if down:
            edits.append(RotationEdit(bone, NECK_DOWN_AXIS, down * weight))
        if side:
            edits.append(RotationEdit(bone, NECK_SIDE_AXIS, side * weight))
    return tuple(edits)


def jaw_open(amount: float) -> tuple[RotationEdit, ...]:
    return (RotationEdit(JAW, (1.0, 0.0, 0.0), amount),)


#: The hind limb's sagittal flexion axis, and the toe fan's, probed on the rig at
#: the flight base pose (`Sanct_Cruise` f0, which is `Battle_Down02` f40) rather
#: than reasoned about. Per 0.30 rad, measured on the foot head and the toe tips:
#:
#:   thigh  local Z   foot 1.32 forward and up      local X  0.82, down the limb
#:   calf   local Z   foot 0.84 forward and down    local X  *exactly 0.000*
#:   foot   local Z   toe tip 0.43 forward and up   local X  0.44, but see below
#:   toes   local Z   -0.50 rad spreads the fan (outer-toe span 1.54 -> 1.73) and
#:                    drops the tips 0.44; +0.50 gathers it (span -> 1.15)
#:   toes   local X   +-40 deg of `toe_deg` for <=0.09 of span change - inert
#:
#: Two things this replaces. `hind_leg_pulse` drove local X with *mirrored* signs;
#: local X runs down each limb, so it twisted rather than folded, and the calf's
#: contribution to foot position was identically zero. And left and right take the
#: **same** local Z sign - both chains' local Z points at world -x - so mirroring
#: the sign cancels the fold, exactly as it once cancelled the banks.
LIMB_FLEX_AXIS = (0.0, 0.0, 1.0)


def toe_curl(amount: float) -> tuple[RotationEdit, ...]:
    """Close or open the claw fan. Positive gathers and lifts, negative spreads.

    Positive is the grip: the toes draw together and the tips rise, which is what
    every grounded caller here wants when it presses a claw into soil or wraps a
    perch. Negative opens the fan and drops the tips, which is the reach - a
    landing flare or a strike. The magnitudes predate the axis fix and are kept:
    they were tuned against a channel that moved a number without moving the
    silhouette, so they now do for the first time what their names say.
    """
    return tuple(RotationEdit(name, LIMB_FLEX_AXIS, amount) for name in TOES)


def torso_recoil(amount: float) -> tuple[RotationEdit, ...]:
    """Compress the ribcage without moving the planted pelvis or feet.

    A live MCP probe on the stand pose measured local Z as the sagittal axis on
    every spine segment: +0.20 rad lifts the head 0.65 units and draws it back
    1.72 units at Spine1. Local X was lateral and local Y primarily yawed it.
    Keeping the pelvis out of this edit lets the hind feet retain their source
    contacts while a bite or swallow still travels through the body.
    """
    weights = (0.12, 0.25, 0.34, 0.29)
    return tuple(
        RotationEdit(bone, SAGITTAL_AXIS, amount * weight)
        for bone, weight in zip(SPINE, weights, strict=True)
    )


#: Hip, knee and ankle shares of a tuck. The opposed hip/knee signs are what make
#: it a fold rather than a swing: the hip alone carries the foot forward as well
#: as up (0.81 forward for 0.63 of lift at these weights), and the knee's
#: counter-flex buys the lift back without the drift. Measured across four
#: candidate weightings at the flight base pose, per unit of `amount`:
#:
#:   (0.34, -0.22, 0.16)   foot_drop 4.26 -> 3.64, but 0.81 forward   <- old shape
#:   (0.34, -0.45, 0.16)   foot_drop 4.26 -> 3.31, 0.26 forward
#:   (0.45, -0.60, 0.20)   foot_drop 4.26 -> 2.96, 0.27 forward       <- chosen
#:   (0.22, -0.55, 0.14)   foot_drop 4.26 -> 3.19, 0.34 *aft*
#:
#: The chosen shape gives the widest usable travel - `amount` 0 to 1.4 sweeps
#: foot_drop from 4.26 to 2.36 - while holding fore/aft drift under 0.3 units, so
#: the legs come up under the hips instead of swinging out under the chest.
TUCK_WEIGHTS = (0.45, -0.60, 0.20)


def hind_leg_tuck(amount: float) -> tuple[RotationEdit, ...]:
    """Fold both hind legs up along the body line, or let them hang.

    Positive tucks: the hip draws the knee up and forward, the knee folds the
    shank back, and the ankle extends, which lowers `foot_drop`. Negative lets
    the legs down into the hanging carriage hover and touchdown need.

    Both sides take the *same* sign. Their local Z axes both point at world -x,
    so one sign moves both feet the same way; the mirrored signs this replaced
    cancelled the fold to 0.04 units of travel on a 44-unit creature.
    """
    if amount == 0.0:
        return ()
    return tuple(
        RotationEdit(bone, LIMB_FLEX_AXIS, amount * weight)
        for side in ("L", "R")
        for bone, weight in zip(HIND_LEGS[side], TUCK_WEIGHTS, strict=True)
    )


def wing_float_sides(
    left_amount: float,
    right_amount: float,
) -> tuple[RotationEdit, ...]:
    """Pose each primary wing chain independently."""
    return tuple(
        RotationEdit(f"Bip002-{side}-{part}_{suffix}", (1.0, 0.0, 0.0), amount)
        for side, suffixes, amount in (
            ("L", ("049", "050", "051"), left_amount),
            ("R", ("086", "087", "088"), right_amount),
        )
        for part, suffix in zip(
            ("Clavicle", "UpperArm", "Forearm"),
            suffixes,
            strict=True,
        )
    )


def tail_bend(side: float) -> tuple[RotationEdit, ...]:
    """Counterbalance a bank across the flexible tail chain."""
    weights = (0.12, 0.18, 0.22, 0.20, 0.17, 0.11)
    return tuple(
        RotationEdit(bone, (0.0, 1.0, 0.0), side * weight)
        for bone, weight in zip(TAIL, weights, strict=True)
    )


#: Where a lateral neck lean stops costing wingtip symmetry.
#:
#: "The wing clavicles are children of the neck" is true, but only of the
#: *proximal* neck. Probed at the flight base pose by leaning each subset and
#: reading the wingtips back:
#:
#:   all four bones, 0.12 total   head 0.28 lateral, each wingtip 0.39, symErr +0.6
#:   all four bones, 0.30 total   head 0.71 lateral, each wingtip 0.96, symErr +2.0
#:   Neck2 + Head,   0.30 total   head 0.29 lateral, wingtips 0.000, symErr 0.000
#:   Neck2 + Head,   0.60 total   head 0.57 lateral, wingtips 0.000, symErr 0.000
#:
#: So the whole constraint lives on `Neck` and `Neck1`, and a lean placed below
#: them is free. That is what lets this be an amplitude a viewer can see rather
#: than the 0.055 rad the four-bone version was capped at — which bought 0.13
#: units of head travel while adding 0.20 of symmetry error, the worse half of
#: the trade.
#:
#: `Head` carries its share for the gaze, not for the reach: the head bone's own
#: origin is the measured point, so rotating it is invisible to `head_reach` by
#: construction (0.000 on every channel at 0.70 rad). Only `Neck2` and above
#: translate it.
NECK_LEAN_WEIGHTS = (0.55, 0.45)

#: The bank's lateral head lean, in radians across `NECK_LEAN_WEIGHTS`.
#:
#: Sized against the tail it opposes rather than picked. The tail swings 1.61
#: units to the turn's outside; the head sits far closer to the roll axis, and
#: `Neck2` moves it about 1.75 units per radian, so 0.40 puts roughly 0.38 units
#: of head travel on the inside. That is three times what the old four-bone
#: `neck_bank` managed on the wrong side, and it costs nothing on the wings.
BANK_NECK_LEAN = 0.40


def neck_lean(side: float) -> tuple[RotationEdit, ...]:
    """Lean the head laterally into a turn, without swinging the wings.

    Positive `side` turns the head toward the rig's right (−x), matching
    `neck_bend`; both are on `NECK_SIDE_AXIS`, which was measured, not assumed —
    the obvious local X does not turn the head at all.

    Callers pass the *inside* of the turn. This replaces `neck_bank`, which
    spread the same edit over all four neck bones and, at `bank * 0.055`, leaned
    the head to the turn's **outside**: `bank` is +1 for left, so a left turn
    drove `side` positive and sent the head to the rig's right. Measured on the
    shipped clips, `Sanct_BankL` held `head_reach.lateral` at −0.04 and
    `Sanct_BankR` at +0.22 against cruise's +0.09 — the head following the tail's
    counterbalance instead of opposing it. The pose contract asks for the
    opposite: the tail swings to the outside as a rudder, the head looks into the
    turn.
    """
    if side == 0.0:
        return ()
    return tuple(
        RotationEdit(bone, NECK_SIDE_AXIS, side * weight)
        for bone, weight in zip(NECK[2:], NECK_LEAN_WEIGHTS, strict=True)
    )


#: The neck and tail chains both bend in the sagittal plane about their own
#: local Z. Measured on the rig rather than assumed: at 0.30 rad distributed
#: over the chain, local Z moves the head 0.45 down and 0.56 back, while local X
#: moves it 0.245 sideways and local Y 0.69 sideways. The tail answers the same
#: axis far harder - 1.46 up for that 0.30 rad, against the 1.77 sideways on
#: local Y that `tail_bend` already uses for a bank's counterbalance.
#:
#: Positive lowers the head and raises the tail.
SAGITTAL_AXIS = (0.0, 0.0, 1.0)

#: Bob amplitudes in radians, distributed across each chain. They differ by so
#: much because the two chains have very different leverage: most of the head's
#: 10.6-unit reach is chest rather than neck, so a radian of neck bend moves it
#: only 1.5 units, while a radian of tail bend moves the tail tip 4.9.
NECK_BOB = 0.30
TAIL_BOB = 0.12


def body_response(
    stroke: float,
    neck_stroke: float | None = None,
    tail_stroke: float | None = None,
) -> tuple[RotationEdit, ...]:
    """Answer the wingbeat down the body as a travelling wave, not in unison.

    `stroke` is +1 at the top of the beat and -1 at the bottom, and drives the
    chest — torso recoil and the legs' share of the beat — because that is where
    the wings attach.

    `neck_stroke` and `tail_stroke` are the same normalised elevation read one
    and two measured landmarks earlier. That delay is the whole point:
    `docs/FLIGHT_ANIMATION_DEVELOPMENT.md` asks forward flight for "overlapping
    secondary motion (head lags behind the power stroke phase by ~1 landmark)",
    and until now only the tail lagged while the neck moved on the same frame as
    the wings. A chain that answers a driver in unison reads as one rigid part;
    each link arriving a landmark later is what makes it read as a neck and a
    tail hung off a chest.

    Both default to `stroke`, which is the unison behaviour the unpowered
    held-wing modes want — they have no propulsion cycle to lag behind.
    """
    if neck_stroke is None:
        neck_stroke = stroke
    if tail_stroke is None:
        tail_stroke = stroke
    if stroke == 0.0 and neck_stroke == 0.0 and tail_stroke == 0.0:
        return ()
    return (
        torso_recoil(0.08 * stroke)
        # 0.06 against the old 0.18: that amplitude was chosen while the helper
        # was on the limb's own long axis and bought 0.04 units of travel, so it
        # could be as large as it liked. On the flexion axis 0.06 is already
        # 0.16 of peak-to-peak foot travel, which is a secondary response to the
        # beat rather than a second gesture competing with the per-mode carriage.
        + hind_leg_tuck(0.06 * stroke)
        + tuple(
            RotationEdit(bone, SAGITTAL_AXIS, amount * phase * weight)
            for bones, weights, amount, phase in (
                # One landmark behind the chest for the neck, two for the tail.
                # Each link absorbs the power stroke a beat-fraction after the
                # one in front of it, and the repeated first key still closes
                # every loop exactly because the lag is a table lookup on the
                # same landmark list, not a time offset.
                (NECK, (0.22, 0.28, 0.30, 0.20), NECK_BOB, neck_stroke),
                (TAIL, (0.12, 0.18, 0.22, 0.20, 0.17, 0.11), TAIL_BOB, tail_stroke),
            )
            for bone, weight in zip(bones, weights, strict=True)
        )
    )


def grounded_breath(stroke: float, neck_amount: float, tail_amount: float) -> tuple[RotationEdit, ...]:
    """Move the curled neck and tail with a slow grounded inhale/exhale.

    The low groggy pose already supplies the whole-body curl. Moving its pelvis
    would make a planted wyvern slide, and its shoulder chain hangs from the
    neck, so the known sagittal axes are the only safe place to make the breath
    readable. `stroke` is -1 at the settled exhale and +1 at the inhale.
    """
    if stroke == 0.0:
        return ()
    return tuple(
        RotationEdit(bone, SAGITTAL_AXIS, amount * stroke * weight)
        for bones, weights, amount in (
            (NECK, (0.22, 0.28, 0.30, 0.20), neck_amount),
            (TAIL, (0.12, 0.18, 0.22, 0.20, 0.17, 0.11), tail_amount),
        )
        for bone, weight in zip(bones, weights, strict=True)
    )


#: Measured pitch axis of the animated body root, in its own local space.
#: Verified by rotating a posed rig and reading the head-to-tail angle back:
#: local Y by -32 degrees takes the body from 13.4 to 45.4 degrees nose-up,
#: while local X only yaws it (the head swings +-5.7 in X for no pitch change)
#: and local Z only rolls it. The previous recipe rotated this root about local
#: X by 74 degrees intending a forward flight line; that was a yaw.
BODY_PITCH_AXIS = (0.0, 1.0, 0.0)


def cruise_body_pose(pitch_deg: float = 0.0) -> tuple[RotationEdit, ...]:
    """Trim the authored body axis at the rig's animated body root.

    Negative is nose-up. The cruise source already carries a near-horizontal
    body line, so unlike the previous steep single-frame sample this needs no
    correction at all by default. Any trim here is the *authored* primary
    posture (layer 1); responsive pitch stays in the runtime (layer 4) and must
    not be used to compensate for a wrong baseline.
    """
    if pitch_deg == 0.0:
        return ()
    return (RotationEdit(FLIGHT_ROOT, BODY_PITCH_AXIS, radians(pitch_deg)),)


def tail_pitch(body_pitch_deg: float) -> tuple[RotationEdit, ...]:
    """Trim tail elevation in accordance with flight direction & body pitch.

    Positive body_pitch_deg is nose-down (dive/speed), flexing local Z on the tail
    chain to lift the tail tip upward along the stoop line. Negative body_pitch_deg
    is nose-up (hover/climb), flexing local Z negatively to lower the tail tip
    downward for pitch stability and braking.
    """
    if body_pitch_deg == 0.0:
        return ()
    weights = (0.12, 0.18, 0.22, 0.20, 0.17, 0.11)
    amount = radians(body_pitch_deg) * 0.35
    return tuple(
        RotationEdit(bone, SAGITTAL_AXIS, amount * weight)
        for bone, weight in zip(TAIL, weights, strict=True)
    )


def flight_detail(
    bank: int = 0,
    stroke: float = 0.0,
    body_pitch: float = 0.0,
    neck_stroke: float | None = None,
    tail_stroke: float | None = None,
    neck_down: float = 0.0,
    leg_tuck: float = 0.0,
    toe_pose: float = 0.0,
) -> tuple[RotationEdit, ...]:
    """Body, neck, limb and tail layers for a flight key, applied before mirroring.

    The wingbeat itself comes from the sampled source frame rather than from a
    hand-authored rotation, so this carries the primary posture trim, the beat's
    secondary body response, speed-dependent neck straightening, the mode's limb
    carriage, and the turn's neck/tail counter-motion. None of these bones live in
    a wing chain, so the mirror that follows leaves them intact. `bank` is +1 for
    left and -1 for right.
    Whole-model roll stays in the runtime — authoring it here as well would double the roll.

    `leg_tuck` and `toe_pose` are the mode's *static* limb carriage — layer 1 of
    the layering model, held for the whole loop. The beat's own leg response is a
    much smaller term inside `body_response`, and the two compose: the legs
    breathe with the stroke around whatever carriage the mode asked for.
    """
    return (
        cruise_body_pose(body_pitch)
        + body_response(stroke, neck_stroke, tail_stroke)
        + neck_bend(down=neck_down)
        # Negated: `bank` is +1 for left and positive `side` turns the head to
        # the rig's right, so the head only reaches the *inside* of the turn
        # with the sign flipped. The tail keeps its own sign and swings to the
        # outside, which is the counterbalance the pose contract asks for.
        + neck_lean(-bank * BANK_NECK_LEAN)
        + tail_bend(bank * 0.22)
        + tail_pitch(body_pitch)
        + hind_leg_tuck(leg_tuck)
        + toe_curl(toe_pose)
    )


#: How far the shoulder chain has to turn for one degree of left/right wingtip
#: elevation difference. Measured with the mirror applied, across the beat:
#: 0.12 rad gives 23.6 degrees of bias and 0.25 rad gives 42.2, so ~143 deg/rad.
BANK_DEGREES_PER_RADIAN_BIAS = 143.0

#: Level flight keeps a 2.8-degree residual elevation bias that no edit here can
#: remove for free. The wings are not mirror images at rest — L-Hand sits at
#: z=-3.36 against R-Hand's +4.13 — so copying one wing's local basis onto the
#: other reproduces its motion and still leaves the tips that far apart. The
#: obvious fix, a small equal-sign trim, cancels the bias and buys it back as
#: stroke asymmetry: 0.019 rad takes cruise from 2.76 to -0.41 degrees of bias
#: but from -1.4 to -4.2 of asymmetry, and hover to -8.2. No trim value clears
#: both channels on both clips, so the residual is left in and
#: `clip-contracts.json` carries a bound derived from it instead.


def bank_wings(bank: int, roll: float = 0.18) -> tuple[RotationEdit, ...]:
    """Turn the wings, after the mirror."""
    if bank == 0:
        return ()
    amount = -bank * roll
    return wing_float_sides(amount, amount)


def flight_keys(
    bank: int = 0,
    beats: int = 3,
    beat_frames: int = 48,
    body_pitch: float = 0.0,
    neck_down: float = -0.10,
    leg_tuck: float = 1.0,
    toe_pose: float = 0.18,
) -> tuple[PoseKey, ...]:
    """Sample one measured wingbeat and repeat it into a seamless loop.

    Every key names its own source frame, so the cycle is the artist's own wing
    mechanics rather than a rotation guessed on top of one static pose. Only the
    wing chains come from those frames; `body` holds the rest of the rig at
    `BEAT_BASE_FRAME`, because the source is a landing and its beat arrives
    welded to a 37-degree torso flare. See `PoseKey.body`.

    Each landmark keeps its own share of the beat — the destination fraction is
    just where that frame sits inside the source cycle — so the artist's timing
    survives the retiming to `beat_frames`. Nothing here decides which half of
    the stroke gets more time; the source already did.

    The last key repeats the first key's source frame and edits exactly, so the
    loop closes bit-for-bit and the sidecar's endpoint validator stays happy.
    Both banks call this with the same cadence, which is what makes their shared
    `phaseGroup: "flight"` safe.
    """
    span = BEAT_END - BEAT_START
    keys: list[PoseKey] = []
    for beat in range(beats):
        for landmark_index, (source_frame, elevation) in enumerate(BEAT_LANDMARKS):
            stroke, neck_stroke, tail_stroke = (
                (BEAT_LANDMARKS[landmark_index - lag][1] - BEAT_ELEV_MID) / BEAT_ELEV_HALF
                for lag in (0, 1, 2)
            )
            fraction = (source_frame - BEAT_START) / span
            keys.append(
                PoseKey(
                    round((beat + fraction) * beat_frames),
                    CRUISE_SOURCE,
                    source_frame,
                    flight_detail(
                        bank=bank,
                        stroke=stroke,
                        body_pitch=body_pitch,
                        neck_stroke=neck_stroke,
                        tail_stroke=tail_stroke,
                        neck_down=neck_down,
                        leg_tuck=leg_tuck,
                        toe_pose=toe_pose,
                    ),
                    mirror="R",
                    mirror_legs="L",
                    post_rotations=bank_wings(bank),
                    body=(CRUISE_SOURCE, BEAT_BASE_FRAME),
                )
            )
    keys.append(replace(keys[0], dest=beats * beat_frames))
    return tuple(keys)


def hunt_carry_keys() -> tuple[PoseKey, ...]:
    """Powered carry loop with a deliberately frozen neck and closed jaw.

    Carry uses the same measured three-beat wing cycle as cruise, but it does
    not inherit cruise's secondary neck bob: the prey attachment follows the
    head, so even a restrained bob reads as the carcass being shaken loose.
    The complete non-wing body comes from one measured flight frame and the
    same neck/jaw edits are applied at every landmark. World translation remains
    the director's job, exactly like every other flight loop.
    """
    span = BEAT_END - BEAT_START
    hold = neck_bend(down=0.16) + jaw_open(-0.22)
    keys: list[PoseKey] = []
    for beat in range(3):
        for landmark_index, (source_frame, elevation) in enumerate(BEAT_LANDMARKS):
            fraction = (source_frame - BEAT_START) / span
            stroke = (elevation - BEAT_ELEV_MID) / BEAT_ELEV_HALF
            tail_stroke = (
                BEAT_LANDMARKS[landmark_index - 2][1] - BEAT_ELEV_MID
            ) / BEAT_ELEV_HALF
            keys.append(
                PoseKey(
                    round((beat + fraction) * 48),
                    CRUISE_SOURCE,
                    source_frame,
                    # Neck held at zero, so the carried prey does not shake: only
                    # the tail takes the beat, at the same two-landmark lag the
                    # rest of the flight family now uses.
                    hold
                    + body_response(0.0, 0.0, tail_stroke)
                    # Carry legs stay extended under the prey, so no static tuck
                    # here — only a heavier share of the beat than cruise gets.
                    # No `mirror_legs` either: the two legs are gripping a carcass
                    # between them, which is a contact pose like the grounded
                    # clips, not the free-hanging symmetry the flight family wants.
                    # 0.18 against the old 0.55 for the same reason `body_response`
                    # came down: on the flexion axis this is now ~0.47 of
                    # peak-to-peak foot travel, a grip working against the load.
                    + hind_leg_tuck(0.18 * stroke)
                    + toe_curl(0.30),
                    mirror="R",
                    body=(CRUISE_SOURCE, BEAT_BASE_FRAME),
                )
            )
    keys.append(replace(keys[0], dest=144))
    return tuple(keys)


def held_wing_keys(
    source_frame: int,
    body_pitch: float,
    trim: float = 0.06,
    stroke: float = 0.25,
    frames: int = 144,
    neck_down: float = 0.0,
    leg_tuck: float = 1.0,
    toe_pose: float = 0.18,
) -> tuple[PoseKey, ...]:
    """Hold one measured wing pose and breathe it, with no propulsion cycle."""
    phases = (
        (0, 0.0, 0.0),
        (frames // 4, 1.0, stroke),
        (frames // 2, 0.0, 0.0),
        (3 * frames // 4, -1.0, -stroke),
        (frames, 0.0, 0.0),
    )
    return tuple(
        PoseKey(
            dest,
            CRUISE_SOURCE,
            source_frame,
            cruise_body_pose(body_pitch)
            + neck_bend(down=neck_down)
            + body_response(bob)
            + hind_leg_tuck(leg_tuck)
            + toe_curl(toe_pose),
            mirror="R",
            mirror_legs="L",
            post_rotations=wing_float_sides(trim * lift, -trim * lift),
            body=(CRUISE_SOURCE, BEAT_BASE_FRAME),
        )
        for dest, lift, bob in phases
    )


RECIPES = (
    ActionRecipe(
        "Sanct_Sleep",
        "curled, closed-jaw sleep with two slow breaths",
        True,
        (
            # Damage_GroggyLoop's curl is the right sleeping silhouette, but
            # its 90-degree jaw is an injured pant. Close it, then breathe only
            # through the measured neck/tail axes so the planted pelvis stays
            # still and the folded wings do not read as a flight beat.
            PoseKey(0, GROGGY, 0, jaw_open(-1.35) + grounded_breath(-1.0, 0.13, 0.05)),
            PoseKey(30, GROGGY, 15, jaw_open(-1.35) + grounded_breath(1.0, 0.13, 0.05)),
            PoseKey(60, GROGGY, 30, jaw_open(-1.35) + grounded_breath(-1.0, 0.13, 0.05)),
            PoseKey(90, GROGGY, 45, jaw_open(-1.35) + grounded_breath(1.0, 0.13, 0.05)),
            PoseKey(120, GROGGY, 0, jaw_open(-1.35) + grounded_breath(-1.0, 0.13, 0.05)),
        ),
    ),
    ActionRecipe(
        "Sanct_Rest",
        "injured, wakeful low rest with a slow open-mouth breath",
        True,
        (
            # Rest remains visibly awake: its jaw stays partly open and its
            # head lifts a little on the inhale, unlike the closed-jaw sleep.
            PoseKey(0, GROGGY, 0, jaw_open(-0.75) + neck_bend(down=-0.06) + grounded_breath(-1.0, 0.21, 0.08)),
            PoseKey(24, GROGGY, 10, jaw_open(-0.72) + neck_bend(down=-0.05) + grounded_breath(-0.2, 0.21, 0.08)),
            PoseKey(48, GROGGY, 20, jaw_open(-0.68) + neck_bend(down=-0.04) + grounded_breath(0.65, 0.21, 0.08)),
            PoseKey(72, GROGGY, 30, jaw_open(-0.65) + neck_bend(down=-0.03) + grounded_breath(1.0, 0.21, 0.08)),
            PoseKey(96, GROGGY, 40, jaw_open(-0.68) + neck_bend(down=-0.04) + grounded_breath(0.3, 0.21, 0.08)),
            PoseKey(120, GROGGY, 50, jaw_open(-0.72) + neck_bend(down=-0.05) + grounded_breath(-0.65, 0.21, 0.08)),
            PoseKey(144, GROGGY, 0, jaw_open(-0.75) + neck_bend(down=-0.06) + grounded_breath(-1.0, 0.21, 0.08)),
        ),
    ),
    ActionRecipe(
        "Sanct_Sit",
        "settle from rest into an upright sit",
        False,
        (
            PoseKey(0, STAND, 0),
            PoseKey(16, ROAR, 90),
            PoseKey(32, ROAR, 120),
            PoseKey(48, ROAR, 135),
        ),
    ),
    ActionRecipe(
        "Sanct_SitLoop",
        "upright seated breathing loop",
        True,
        (
            PoseKey(0, ROAR, 135),
            PoseKey(24, ROAR, 145),
            PoseKey(48, ROAR, 135),
            PoseKey(72, ROAR, 125),
            PoseKey(96, ROAR, 135),
        ),
    ),
    ActionRecipe(
        "Sanct_Rise",
        "rise from the seated pose back to rest",
        False,
        (
            PoseKey(0, ROAR, 135),
            PoseKey(16, ROAR, 120),
            PoseKey(32, ROAR, 90),
            PoseKey(48, STAND, 0),
        ),
    ),
    ActionRecipe(
        "Sanct_Eat",
        "grounded bite, tear, chew and swallow loop with mantling wings",
        True,
        (
            PoseKey(0, ATTACK, 0, neck_bend(down=0.18) + torso_recoil(0.02) + wing_float_sides(0.02, 0.02)),
            PoseKey(24, WATCH, 60, neck_bend(down=0.30) + torso_recoil(-0.05) + toe_curl(0.08) + wing_float_sides(0.03, 0.03)),
            PoseKey(48, ATTACK, 20, neck_bend(down=0.38) + jaw_open(0.24) + torso_recoil(-0.12) + toe_curl(0.16) + wing_float_sides(0.04, 0.04)),
            PoseKey(60, ATTACK, 40, neck_bend(down=0.46) + jaw_open(-0.12) + torso_recoil(0.10) + toe_curl(0.22) + wing_float_sides(0.05, 0.05)),
            PoseKey(72, ATTACK, 52, neck_bend(side=0.10, down=0.44) + jaw_open(0.12) + torso_recoil(0.04) + tail_bend(-0.08) + toe_curl(0.18) + wing_float_sides(0.05, 0.05)),
            PoseKey(84, ATTACK, 52, neck_bend(side=-0.10, down=0.42) + jaw_open(-0.14) + torso_recoil(-0.03) + tail_bend(0.08) + toe_curl(0.18) + wing_float_sides(0.05, 0.05)),
            PoseKey(102, ATTACK, 40, neck_bend(down=0.45) + jaw_open(0.16) + torso_recoil(-0.07) + toe_curl(0.15) + wing_float_sides(0.04, 0.04)),
            PoseKey(114, ATTACK, 52, neck_bend(down=0.43) + jaw_open(-0.12) + torso_recoil(0.07) + toe_curl(0.20) + wing_float_sides(0.04, 0.04)),
            PoseKey(132, ATTACK, 68, neck_bend(down=0.30) + jaw_open(0.05) + torso_recoil(0.04) + toe_curl(0.12) + wing_float_sides(0.03, 0.03)),
            PoseKey(156, WATCH, 60, neck_bend(down=0.20) + jaw_open(-0.06) + torso_recoil(0.12) + toe_curl(0.06) + wing_float_sides(0.02, 0.02)),
            PoseKey(174, ATTACK, 20, neck_bend(down=0.28) + jaw_open(0.12) + torso_recoil(-0.06) + toe_curl(0.10) + wing_float_sides(0.02, 0.02)),
            PoseKey(192, ATTACK, 0, neck_bend(down=0.18) + torso_recoil(0.02) + wing_float_sides(0.02, 0.02)),
        ),
    ),
    ActionRecipe(
        "Sanct_Breathe",
        "grounded deep chest intake, rearing lunge, wide jaw flame sweep and recovery",
        False,
        (
            PoseKey(0, ROAR, 0, neck_bend(down=0.10) + torso_recoil(0.04) + wing_float_sides(0.08, 0.08)),
            PoseKey(20, ROAR, 30, neck_bend(down=-0.15) + jaw_open(0.25) + torso_recoil(-0.22) + toe_curl(0.18) + wing_float_sides(0.18, 0.18)),
            PoseKey(40, ROAR, 90, neck_bend(down=0.28, side=-0.14) + jaw_open(0.55) + torso_recoil(0.24) + tail_bend(0.10) + toe_curl(0.24) + wing_float_sides(0.22, 0.22)),
            PoseKey(60, ROAR, 120, neck_bend(down=0.32, side=0.14) + jaw_open(0.55) + torso_recoil(0.22) + tail_bend(-0.10) + toe_curl(0.24) + wing_float_sides(0.22, 0.22)),
            PoseKey(80, ROAR, 150, neck_bend(down=0.22) + jaw_open(0.28) + torso_recoil(0.08) + toe_curl(0.14) + wing_float_sides(0.14, 0.14)),
            PoseKey(108, STAND, 0),
        ),
    ),
    ActionRecipe(
        "Sanct_BreatheAir",
        "airborne intake, pitch-down muzzle tilt, wide jaw flame sweep and recovery",
        False,
        (
            PoseKey(0, CRUISE_SOURCE, 20, cruise_body_pose(0.0) + wing_float_sides(0.12, 0.12), mirror="R"),
            PoseKey(20, CRUISE_SOURCE, 35, cruise_body_pose(0.05) + neck_bend(down=-0.10) + jaw_open(0.28) + torso_recoil(-0.18) + wing_float_sides(0.16, 0.16), mirror="R"),
            PoseKey(40, CRUISE_SOURCE, 50, cruise_body_pose(0.12) + neck_bend(down=0.28, side=-0.16) + jaw_open(0.52) + torso_recoil(0.20) + tail_bend(0.12) + wing_float_sides(0.18, 0.18), mirror="R"),
            PoseKey(60, CRUISE_SOURCE, 65, cruise_body_pose(0.12) + neck_bend(down=0.30, side=0.16) + jaw_open(0.52) + torso_recoil(0.18) + tail_bend(-0.12) + wing_float_sides(0.18, 0.18), mirror="R"),
            PoseKey(76, CRUISE_SOURCE, 80, cruise_body_pose(0.05) + neck_bend(down=0.18) + jaw_open(0.20) + torso_recoil(0.06) + wing_float_sides(0.14, 0.14), mirror="R"),
            PoseKey(96, CRUISE_SOURCE, 100, cruise_body_pose(0.0) + wing_float_sides(0.12, 0.12), mirror="R"),
        ),
    ),
    ActionRecipe(
        "Sanct_HuntGrip",
        "reach, bite and brace the prey for takeoff",
        False,
        (
            PoseKey(0, ATTACK, 0),
            PoseKey(18, ATTACK, 20, neck_bend(down=0.20) + jaw_open(0.24) + torso_recoil(-0.05) + toe_curl(0.08)),
            PoseKey(36, ATTACK, 40, neck_bend(down=0.38) + jaw_open(0.38) + torso_recoil(-0.14) + toe_curl(0.16)),
            PoseKey(48, ATTACK, 52, neck_bend(down=0.44) + jaw_open(-0.18) + torso_recoil(0.12) + toe_curl(0.28)),
            PoseKey(60, ATTACK, 52, neck_bend(down=0.30) + jaw_open(-0.22) + torso_recoil(0.06) + tail_bend(0.05) + toe_curl(0.24)),
            PoseKey(72, ATTACK, 68, neck_bend(down=0.16) + jaw_open(-0.22) + torso_recoil(0.02) + toe_curl(0.18)),
        ),
    ),
    ActionRecipe(
        "Sanct_HuntCarry",
        "powered carry flight with a braced neck and stable prey grip",
        True,
        hunt_carry_keys(),
    ),
    ActionRecipe(
        "Sanct_HuntFinish",
        "swallow, lift the head, scan and settle back to idle",
        False,
        (
            PoseKey(0, ATTACK, 68, neck_bend(down=0.18) + jaw_open(-0.12) + torso_recoil(-0.04) + toe_curl(0.16) + wing_float_sides(0.10, 0.10)),
            PoseKey(24, WATCH, 60, neck_bend(down=0.16) + jaw_open(-0.05) + torso_recoil(0.10) + toe_curl(0.12) + wing_float_sides(0.06, 0.06)),
            PoseKey(44, WATCH, 120, neck_bend(down=-0.04) + jaw_open(0.08) + torso_recoil(0.16) + toe_curl(0.08)),
            PoseKey(64, WATCH, 180, neck_bend(side=0.20, down=-0.02) + torso_recoil(0.04) + tail_bend(-0.10) + toe_curl(0.04)),
            PoseKey(84, WATCH, 240, neck_bend(side=-0.20, down=-0.02) + torso_recoil(0.02) + tail_bend(0.10) + toe_curl(0.02)),
            PoseKey(104, WATCH, 60, neck_bend(down=0.05) + torso_recoil(-0.02)),
            PoseKey(120, STAND, 0),
        ),
    ),
    ActionRecipe(
        "Sanct_PickUp",
        "airborne stoop snatch: pitch down, extend neck/talons, clamp prey and pull up into carry",
        False,
        (
            PoseKey(0, CRUISE_SOURCE, 20, cruise_body_pose(0.0) + wing_float_sides(0.12, 0.12), mirror="R"),
            PoseKey(18, ATTACK, 20, cruise_body_pose(0.12) + neck_bend(down=0.25) + jaw_open(0.35) + toe_curl(0.12) + torso_recoil(-0.10) + wing_float_sides(0.16, 0.16), mirror="R"),
            PoseKey(36, ATTACK, 40, cruise_body_pose(0.18) + neck_bend(down=0.45) + jaw_open(0.48) + toe_curl(0.28) + torso_recoil(-0.15) + wing_float_sides(0.18, 0.18), mirror="R"),
            PoseKey(48, ATTACK, 52, cruise_body_pose(0.05) + neck_bend(down=0.28) + jaw_open(-0.25) + toe_curl(0.32) + torso_recoil(0.18) + wing_float_sides(0.14, 0.14), mirror="R"),
            PoseKey(72, CRUISE_SOURCE, 68, cruise_body_pose(0.0) + neck_bend(down=0.16) + jaw_open(-0.22) + toe_curl(0.24) + wing_float_sides(0.12, 0.12), mirror="R"),
        ),
    ),
    ActionRecipe(
        "Sanct_Drop",
        "airborne release from height: flare wings, thrust neck down, open jaw/claws, drop prey and recover flight trim",
        False,
        (
            PoseKey(0, CRUISE_SOURCE, 20, cruise_body_pose(0.0) + neck_bend(down=0.16) + jaw_open(-0.22) + toe_curl(0.24) + wing_float_sides(0.12, 0.12), mirror="R"),
            PoseKey(18, CRUISE_SOURCE, 35, cruise_body_pose(-0.08) + neck_bend(down=0.10) + jaw_open(-0.18) + toe_curl(0.20) + wing_float_sides(0.18, 0.18), mirror="R"),
            PoseKey(32, CRUISE_SOURCE, 50, cruise_body_pose(0.10) + neck_bend(down=0.35) + jaw_open(0.48) + toe_curl(-0.10) + torso_recoil(0.20) + wing_float_sides(0.16, 0.16), mirror="R"),
            PoseKey(52, CRUISE_SOURCE, 70, cruise_body_pose(0.04) + neck_bend(down=0.08) + jaw_open(-0.05) + toe_curl(0.0) + torso_recoil(0.05) + wing_float_sides(0.14, 0.14), mirror="R"),
            PoseKey(72, CRUISE_SOURCE, 85, cruise_body_pose(0.0) + wing_float_sides(0.12, 0.12), mirror="R"),
        ),
    ),
    ActionRecipe(
        "Sanct_Drink",
        "lower the muzzle and lap",
        True,
        (
            PoseKey(0, STAND, 0),
            PoseKey(24, WATCH, 60, neck_bend(down=0.18)),
            PoseKey(48, ATTACK, 20, neck_bend(down=0.28)),
            PoseKey(72, ATTACK, 20, neck_bend(down=0.34) + jaw_open(0.08)),
            PoseKey(84, ATTACK, 20, neck_bend(down=0.32) + jaw_open(-0.04)),
            PoseKey(96, ATTACK, 20, neck_bend(down=0.34) + jaw_open(0.08)),
            PoseKey(120, WATCH, 60, neck_bend(down=0.18)),
            PoseKey(144, STAND, 0),
        ),
    ),
    ActionRecipe(
        "Sanct_Groom",
        "turn back to preen the folded wing",
        True,
        (
            PoseKey(0, WATCH, 0),
            PoseKey(36, WATCH, 120, neck_bend(side=0.35, down=0.08)),
            PoseKey(
                72,
                WATCH,
                180,
                neck_bend(side=0.75, down=0.18) + jaw_open(0.08),
            ),
            PoseKey(
                96,
                WATCH,
                210,
                neck_bend(side=0.82, down=0.22) + jaw_open(-0.04),
            ),
            PoseKey(
                120,
                WATCH,
                240,
                neck_bend(side=0.75, down=0.18) + jaw_open(0.08),
            ),
            PoseKey(156, WATCH, 300, neck_bend(side=0.30, down=0.06)),
            PoseKey(192, WATCH, 0),
        ),
    ),
    ActionRecipe(
        "Sanct_PerchGrip",
        "subtle talon grip while perched",
        True,
        (
            PoseKey(0, STAND, 0),
            PoseKey(18, STAND, 15, toe_curl(0.08)),
            PoseKey(36, STAND, 30, toe_curl(0.22)),
            PoseKey(54, STAND, 45, toe_curl(0.10)),
            PoseKey(72, STAND, 0),
        ),
    ),
    # Limb carriage across the flight family, from
    # docs/FLIGHT_ANIMATION_DEVELOPMENT.md's per-mode table. Two rules govern the
    # numbers: every aerodynamic mode tucks, and hover is the one that hangs, so
    # their `foot_drop` bands must not overlap — that separation is what makes the
    # silhouettes readable, and what `clip-contracts.json` gates. Toe sign follows
    # the same split: positive gathers the fan for flight, negative opens it for
    # the touchdown hover is always one beat away from.
    #
    # All eight also carry `mirror_legs="L"`. The carriage numbers below are a
    # *pair* of legs, and without the mirror they were only ever one: the frozen
    # base pose's own 0.72-unit left/right foot difference rode through every one
    # of them. See `mirror_hind_leg` for the probe and the choice of direction.
    ActionRecipe(
        "Sanct_Cruise",
        "level cruise loop, three symmetric wingbeats sampled from Battle_Down02 f40-f66",
        True,
        flight_keys(
            beats=3, beat_frames=48, body_pitch=0.0, neck_down=-0.12,
            leg_tuck=1.0, toe_pose=0.18,
        ),
    ),
    ActionRecipe(
        "Sanct_Scout",
        "slow loitering search loop, two symmetric wingbeats on a slight nose-up trim",
        True,
        # Loitering, not commuting: the legs ride a little looser than cruise.
        flight_keys(
            beats=2, beat_frames=72, body_pitch=-6.0, neck_down=0.02,
            leg_tuck=0.85, toe_pose=0.14,
        ),
    ),
    ActionRecipe(
        "Sanct_BankL",
        "left bank with lowered inside wing and tail counterbalance",
        True,
        # "Remain tucked & streamlined" — a bank is cruise plus a turn, so its
        # limb carriage must match cruise's exactly or the shared phaseGroup
        # would hand a visible leg pop across the crossfade.
        flight_keys(bank=1, neck_down=-0.12, leg_tuck=1.0, toe_pose=0.18),
    ),
    ActionRecipe(
        "Sanct_BankR",
        "right bank with lowered inside wing and tail counterbalance",
        True,
        flight_keys(bank=-1, neck_down=-0.12, leg_tuck=1.0, toe_pose=0.18),
    ),
    ActionRecipe(
        "Sanct_Hover",
        "upright near-zero-speed hover, four faster wingbeats, legs hanging",
        True,
        # The one mode that hangs. Negative tuck lets the legs down below the
        # dropped hips, and the claw fan opens for a touchdown that may be one
        # beat away.
        #
        # -0.7 rather than the -0.15 this started at: hover's own -30 deg root
        # pitch already swings the feet up toward the pelvis, so a token negative
        # tuck measured 3.54 against cruise's 2.95 and the two silhouettes were
        # barely half a unit apart. The pitch has to be paid back before the hang
        # begins.
        flight_keys(
            beats=4, beat_frames=36, body_pitch=-30.0, neck_down=0.22,
            leg_tuck=-0.7, toe_pose=-0.30,
        ),
    ),
    ActionRecipe(
        "Sanct_Speed",
        "fast powered cruise: four beats in five seconds on a flattened body line",
        True,
        flight_keys(
            beats=4, beat_frames=30, body_pitch=11.0, neck_down=-0.22,
            leg_tuck=1.5, toe_pose=0.35,
        ),
    ),
    ActionRecipe(
        "Sanct_Soar",
        "unpowered glide: wings held extended and level, no propulsion cycle",
        True,
        held_wing_keys(
            HOLD_EXTENDED_FRAME, body_pitch=4.0, neck_down=-0.08,
            leg_tuck=0.95, toe_pose=0.18,
        ),
    ),
    ActionRecipe(
        "Sanct_Dive",
        "steep nose-down stoop: wings held at the tightest fold in the beat",
        True,
        # Tucked tight against the abdomen: the stoop is the most streamlined
        # silhouette in the family, so it carries the deepest tuck.
        held_wing_keys(
            HOLD_FOLDED_FRAME, body_pitch=30.0, trim=0.04, neck_down=-0.14,
            leg_tuck=1.6, toe_pose=0.35,
        ),
    ),
    ActionRecipe(
        "Sanct_Climb",
        "ascending power flight: four strong wingbeats on an aggressive nose-up climb trim",
        True,
        flight_keys(
            beats=4, beat_frames=36, body_pitch=-18.0, neck_down=0.08,
            leg_tuck=1.2, toe_pose=0.25,
        ),
    ),
    ActionRecipe(
        "Sanct_Nuzzle",
        "lower the head into a gentle nuzzle and return",
        False,
        (
            PoseKey(0, STAND, 0),
            PoseKey(18, WATCH, 45, neck_bend(down=0.10)),
            PoseKey(42, WATCH, 85, neck_bend(side=0.14, down=0.24)),
            PoseKey(
                60,
                WATCH,
                100,
                neck_bend(side=0.20, down=0.38) + jaw_open(0.03),
            ),
            PoseKey(78, WATCH, 65, neck_bend(side=0.10, down=0.18)),
            PoseKey(96, STAND, 0),
        ),
    ),
    ActionRecipe(
        "Sanct_Calm",
        "folded-wing settle with lowered head and slow exhale",
        False,
        (
            PoseKey(0, STAND, 0),
            PoseKey(24, WATCH, 60, neck_bend(down=0.08)),
            PoseKey(48, WATCH, 120, neck_bend(down=0.20)),
            PoseKey(72, WATCH, 180, neck_bend(down=0.25) + jaw_open(0.05)),
            PoseKey(96, WATCH, 240, neck_bend(down=0.14) + jaw_open(0.02)),
            PoseKey(120, STAND, 0),
        ),
    ),
)


def action_fcurves(action: bpy.types.Action):
    """Return f-curves for legacy and slotted Blender actions."""
    try:
        return list(action.fcurves)
    except AttributeError:
        curves = []
        for layer in action.layers:
            for strip in layer.strips:
                for slot in action.slots:
                    channelbag = strip.channelbag(slot)
                    if channelbag:
                        curves.extend(channelbag.fcurves)
        return curves


def targeted_bones(actions: list[bpy.types.Action]) -> list[str]:
    names: set[str] = set()
    pattern = re.compile(r'pose\.bones\["(.+?)"\]')
    for action in actions:
        for fcurve in action_fcurves(action):
            match = pattern.search(fcurve.data_path)
            if match:
                names.add(match.group(1))
    return sorted(names)


def sample_pose(
    armature: bpy.types.Object,
    scene: bpy.types.Scene,
    identity: tuple[str, int],
) -> dict[str, tuple]:
    """Snapshot one frame of one source action off the sampling armature."""
    name, frame = identity
    action = bpy.data.actions[name]
    armature.animation_data.action = action
    # Blender 4.4+ evaluates nothing until a slot is bound, and the auto-pick
    # only fires when the slot name matches this object. A missed binding
    # samples the rest pose and looks like a subtly wrong animation rather than
    # an error.
    slots = getattr(action, "slots", None)
    if slots:
        armature.animation_data.action_slot = slots[0]
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    return snapshot_pose(armature)


def wing_overlay(
    base: dict[str, tuple],
    wings: dict[str, tuple],
) -> dict[str, tuple]:
    """Hang one frame's wing chains off another frame's body.

    Both chains carry their membrane bones, so the surface they span travels
    with the fingers that stretch it. A pose bone's basis is expressed in its
    own rest frame, so a wing lifted out of one frame and set on another body
    keeps its shape and simply follows the new torso.
    """
    merged = dict(base)
    for name in WING_L + WING_R:
        if name in wings:
            merged[name] = wings[name]
    return merged


def snapshot_pose(armature: bpy.types.Object) -> dict[str, tuple]:
    return {
        bone.name: (
            bone.location.copy(),
            bone.rotation_quaternion.copy(),
            bone.scale.copy(),
        )
        for bone in armature.pose.bones
    }


def edited_pose(
    pose: dict[str, tuple],
    rotations: tuple[RotationEdit, ...],
    locations: tuple[LocationEdit, ...],
) -> dict[str, tuple]:
    result = {
        name: (location.copy(), rotation.copy(), scale.copy())
        for name, (location, rotation, scale) in pose.items()
    }
    for edit in rotations:
        if edit.bone not in result:
            raise KeyError(f"Missing pose bone for rotation edit: {edit.bone}")
        location, rotation, scale = result[edit.bone]
        delta = Quaternion(Vector(edit.axis).normalized(), edit.angle)
        result[edit.bone] = (location, rotation @ delta, scale)
    for edit in locations:
        if edit.bone not in result:
            raise KeyError(f"Missing pose bone for location edit: {edit.bone}")
        location, rotation, scale = result[edit.bone]
        result[edit.bone] = (location + Vector(edit.delta), rotation, scale)
    return result


def set_pose(armature: bpy.types.Object, pose: dict[str, tuple]) -> None:
    for name, (location, rotation, scale) in pose.items():
        bone = armature.pose.bones.get(name)
        if not bone:
            continue
        bone.rotation_mode = "QUATERNION"
        bone.location = location
        bone.rotation_quaternion = rotation
        bone.scale = scale


def mirror_chain(
    armature: bpy.types.Object,
    left: tuple[str, ...],
    right: tuple[str, ...],
    source_side: str,
    label: str,
) -> None:
    """Overwrite one limb chain with the reflection of its opposite number.

    Copy the *local* pose delta, never the armature-space matrix. This rig's
    sides are not mirror images at rest: reflecting the right wing's world
    positions lands up to 7.6 units from where the left wing actually sits
    (L-Hand rests at z=-3.36, R-Hand at z=+4.13), on a body ~23 wide. Driving
    the left bones to those reflected matrices drags them off their own rest
    pose and away from the mesh bound to them, which tore the membrane into
    overlapping sheets. A pose bone's basis is already expressed in its own rest
    frame, and both sides share one axis convention - each bone's local offset
    runs down +X - so copying the basis straight across reproduces the same
    motion while each limb keeps its own rest geometry.

    The side-to-side axis in these bones' local frames is Z, not X: the
    clavicles branch off the neck at local z=+96.3 (left) and z=-65.0 (right),
    while every bone's own length runs down +X on both sides. Reflecting across
    the plane perpendicular to local Z sends a rotation about (x, y, z) to one
    about (x, y, -z) with the angle negated, which is (w, -x, -y, z); the
    location mirrors on the same axis.

    Chains must be listed parent first, and both sides must use the same local
    convention. `HIND_LEGS` qualifies on both counts: `LIMB_FLEX_AXIS` is local
    Z on each side, so a rotation about it is *preserved* by this reflection and
    the mode's tuck survives the mirror unchanged.
    """
    if source_side not in ("L", "R"):
        raise ValueError(f"mirror side must be L or R, got {source_side!r}")
    pairs = zip(left, right) if source_side == "L" else zip(right, left)
    for source_name, dest_name in pairs:
        source = armature.pose.bones.get(source_name)
        dest = armature.pose.bones.get(dest_name)
        if source is None or dest is None:
            raise KeyError(f"Missing {label} bone for mirror: {source_name} / {dest_name}")
        dest.rotation_mode = "QUATERNION"
        q = source.rotation_quaternion
        dest.rotation_quaternion = Quaternion((q.w, -q.x, -q.y, q.z))
        dest.location = Vector((source.location.x, source.location.y, -source.location.z))
        dest.scale = source.scale.copy()
    bpy.context.view_layer.update()


def mirror_wing(armature: bpy.types.Object, source_side: str) -> None:
    """Overwrite one wing chain with the reflection of the other."""
    mirror_chain(armature, WING_L, WING_R, source_side, "wing")


def mirror_hind_leg(armature: bpy.types.Object, source_side: str) -> None:
    """Overwrite one hind limb with the reflection of the other.

    The flight family needs this because `PoseKey.body` freezes every non-wing
    bone at one vendor frame, and that frame - `Battle_Down02` f40, a landing -
    is itself asymmetric: `foot_drop` measures 4.263 on the left against 3.544 on
    the right. Nothing in the recipes authors that gap, but every flight clip
    inherited it, and on a symmetric cruise loop 0.63-1.05 units of left/right
    foot difference reads as a broken model rather than as a pose.

    Probed live on the rig, the same component-wise local mirror the wings use
    cuts the residual from 0.72 to about 0.12 - the same order the wings already
    accept, and the two directions are equally good at it: R onto L lands
    3.419/3.544, L onto R lands 4.263/4.383. The direction is therefore chosen on
    a different channel. `foot_drop` is measured on the *left* foot alone and is
    what every mode's limb-carriage band in `clip-contracts.json` is derived from
    (cruise 2.95, hover 4.15, dive 2.20), so the recipes mirror L onto R: the
    tuned foot keeps its measured carriage and only the drifting one moves. R
    onto L would shift the whole family down 0.72 and put cruise, scout, glide
    and hover outside their own bands for no gain in symmetry.

    Toes are deliberately not in the chain. They are children of the foot, so
    they follow it, and the probe that validated this mirror covered
    Thigh/Calf/Foot only.
    """
    mirror_chain(armature, HIND_LEGS["L"], HIND_LEGS["R"], source_side, "hind leg")


def apply_rotations(
    armature: bpy.types.Object,
    rotations: tuple[RotationEdit, ...],
) -> None:
    """Compose extra local rotations onto the armature's current pose."""
    for edit in rotations:
        bone = armature.pose.bones.get(edit.bone)
        if bone is None:
            raise KeyError(f"Missing pose bone for rotation edit: {edit.bone}")
        bone.rotation_mode = "QUATERNION"
        bone.rotation_quaternion = bone.rotation_quaternion @ Quaternion(
            Vector(edit.axis).normalized(), edit.angle
        )
    bpy.context.view_layer.update()


def align_quaternions(
    armature: bpy.types.Object,
    bone_names: list[str],
    previous: dict[str, Quaternion],
) -> None:
    """Keep each bone's quaternion in the same hemisphere as its last key.

    q and -q are the same rotation, but Blender interpolates the four
    components as independent F-curves rather than slerping. If consecutive keys
    land on opposite hemispheres the curve travels the long way round, and the
    bone swings through a pose nobody authored.

    This bites hardest on mirrored bones: reflecting a pose can flip the sign of
    the result, so a mirrored wing keys perfectly at every keyframe and then
    tears itself apart between them — measured here as exactly 0.00 wingtip
    symmetry error on keys and up to 29.9 in between.
    """
    for name in bone_names:
        bone = armature.pose.bones.get(name)
        if not bone:
            continue
        current = bone.rotation_quaternion
        last = previous.get(name)
        if last is not None and last.dot(current) < 0.0:
            bone.rotation_quaternion = Quaternion(
                (-current.w, -current.x, -current.y, -current.z)
            )
        previous[name] = bone.rotation_quaternion.copy()


def key_pose(
    armature: bpy.types.Object,
    bone_names: list[str],
    frame: int,
) -> None:
    for name in bone_names:
        bone = armature.pose.bones.get(name)
        if not bone:
            continue
        bone.keyframe_insert("location", frame=frame, group=name)
        bone.keyframe_insert("rotation_quaternion", frame=frame, group=name)
        bone.keyframe_insert("scale", frame=frame, group=name)


def source_glb_argument() -> Path | None:
    """Read an optional decompressed vendor GLB used to restore source actions."""
    if "--" not in sys.argv:
        return None
    args = sys.argv[sys.argv.index("--") + 1 :]
    if "--source-glb" not in args:
        return None
    index = args.index("--source-glb")
    if index + 1 >= len(args):
        raise RuntimeError("--source-glb requires a path")
    return Path(args[index + 1]).expanduser().resolve()


def import_source_actions(required: set[str]) -> list[bpy.types.Object]:
    """Import a decompressed base GLB when the armature-only blend lacks sources."""
    missing = sorted(required - set(bpy.data.actions.keys()))
    if not missing:
        return []

    source_glb = source_glb_argument()
    if not source_glb or not source_glb.is_file():
        raise RuntimeError(
            "Missing source actions and no decompressed --source-glb was provided: "
            f"{missing}"
        )

    objects_before = set(bpy.data.objects)
    result = bpy.ops.import_scene.gltf(filepath=str(source_glb))
    if "FINISHED" not in result:
        raise RuntimeError(f"Failed to import source GLB: {source_glb}")

    still_missing = sorted(required - set(bpy.data.actions.keys()))
    if still_missing:
        raise RuntimeError(f"Imported source GLB lacks actions: {still_missing}")
    return [obj for obj in bpy.data.objects if obj not in objects_before]


def remove_imported_source(imported_objects: list[bpy.types.Object]) -> None:
    """Return the editable source to its armature-only, generated-action form."""
    for obj in imported_objects:
        bpy.data.objects.remove(obj, do_unlink=True)

    for action in list(bpy.data.actions):
        if action.name not in ACTION_NAMES:
            bpy.data.actions.remove(action)

    for collection in (
        bpy.data.meshes,
        bpy.data.materials,
        bpy.data.images,
        bpy.data.textures,
        bpy.data.cameras,
        bpy.data.lights,
        bpy.data.armatures,
    ):
        for datablock in list(collection):
            if datablock.users == 0:
                collection.remove(datablock)


def main() -> dict:
    scene = bpy.context.scene
    armatures = [obj for obj in scene.objects if obj.type == "ARMATURE"]
    if len(armatures) != 1:
        raise RuntimeError(f"Expected one armature, found {len(armatures)}")
    armature = armatures[0]
    armature.animation_data_create()

    recipes_to_author = tuple(
        recipe
        for recipe in RECIPES
        if recipe.name not in PRESERVED_ACTION_NAMES
        or bpy.data.actions.get(recipe.name) is None
    )
    print(f"authoring:{','.join(recipe.name for recipe in recipes_to_author)}")
    source_names = sorted(
        {key.source for recipe in recipes_to_author for key in recipe.keys}
        | {
            key.body[0]
            for recipe in recipes_to_author
            for key in recipe.keys
            if key.body is not None
        }
    )
    imported_objects = import_source_actions(set(source_names))
    imported_armatures = [obj for obj in imported_objects if obj.type == "ARMATURE"]
    if imported_objects and len(imported_armatures) != 1:
        raise RuntimeError(
            f"Expected one imported source armature, found {len(imported_armatures)}"
        )
    sample_armature = imported_armatures[0] if imported_armatures else armature
    sample_armature.animation_data_create()
    source_actions = [bpy.data.actions[name] for name in source_names]
    bone_names = sorted([b.name for b in armature.pose.bones])
    if len(bone_names) < 200:
        raise RuntimeError(f"Expected at least 200 animated bones, found {len(bone_names)}")

    samples: dict[tuple[str, int], dict[str, tuple]] = {}
    for recipe in recipes_to_author:
        for key in recipe.keys:
            identities = [(key.source, key.frame)]
            if key.body is not None:
                identities.append(key.body)
            for identity in identities:
                if identity not in samples:
                    samples[identity] = sample_pose(sample_armature, scene, identity)

    remove_imported_source(imported_objects)

    for name in (recipe.name for recipe in recipes_to_author):
        old = bpy.data.actions.get(name)
        if old:
            bpy.data.actions.remove(old)

    generated = []
    for recipe in recipes_to_author:
        action = bpy.data.actions.new(recipe.name)
        action.use_fake_user = True
        action.use_frame_range = True
        action.frame_start = recipe.keys[0].dest
        action.frame_end = recipe.keys[-1].dest
        action["wyvern_role"] = recipe.role
        action["wyvern_loop"] = recipe.loop
        action["wyvern_source"] = "CC-BY-4.0 Drogon poses, remixed for Wyvern3D"
        armature.animation_data.action = action

        previous_quaternions: dict[str, Quaternion] = {}
        for key in recipe.keys:
            sampled = samples[(key.source, key.frame)]
            if key.body is not None:
                sampled = wing_overlay(samples[key.body], sampled)
            pose = edited_pose(sampled, key.rotations, key.locations)
            set_pose(armature, pose)
            if key.mirror:
                # mirror_wing reads armature-space matrices, which only reflect
                # the basis values set_pose just wrote after a depsgraph flush.
                bpy.context.view_layer.update()
                mirror_wing(armature, key.mirror)
            if key.mirror_legs:
                bpy.context.view_layer.update()
                mirror_hind_leg(armature, key.mirror_legs)
            if key.post_rotations:
                apply_rotations(armature, key.post_rotations)
            align_quaternions(armature, bone_names, previous_quaternions)
            key_pose(armature, bone_names, key.dest)

        for fcurve in action_fcurves(action):
            for point in fcurve.keyframe_points:
                point.interpolation = "BEZIER"
                point.handle_left_type = "AUTO_CLAMPED"
                point.handle_right_type = "AUTO_CLAMPED"

        generated.append(
            {
                "name": action.name,
                "role": recipe.role,
                "loop": recipe.loop,
                "frames": [recipe.keys[0].dest, recipe.keys[-1].dest],
                "target_bones": len(bone_names),
                "fcurves": len(action_fcurves(action)),
            }
        )

    armature.animation_data.action = bpy.data.actions[ACTION_NAMES[0]]
    scene.frame_start = 0
    scene.frame_end = 192
    scene.frame_set(0)
    bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath, check_existing=False)
    return {
        "blend": bpy.data.filepath,
        "armature": armature.name,
        "source_actions": source_names,
        "generated": generated,
    }


if __name__ == "__main__":
    result = main()
