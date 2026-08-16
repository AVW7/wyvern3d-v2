"""Re-author the ``breath`` action on the repaired rig as a sustained fire jet.

Run inside Blender against **both** authoring blends -- `wyvern-rig.blend`
feeds `wyvern.glb`, and `wyvern-rig-v1wing.blend` is what
`pnpm assets:gothic-wing` retargets into the shipped `wyvern-gothic.glb`, so
authoring only the first leaves gameplay on the old performance:

    for blend in wyvern-rig wyvern-rig-v1wing; do \
      /Applications/Blender.app/Contents/MacOS/Blender -b \
        "public/models/$blend.blend" \
        -P scripts/author-wyvern-breath-blender.py -- --save ; done

What it replaces. Measured on the shipped 48-frame clip:

* **frames 0-12 are dead air.** Body, both neck links, head, jaw and tail hold
  their frame-0 value exactly; the only motion in the first half-second is the
  wing carrier's 2.5 degree idle flutter. `breath` is dispatched through the
  one-shot action channel, where being a legible *tell* is the entire job.
* **the gape is small and late.** It peaks 31.8 degrees off the closed jaw at
  t = 1.63 s, against the re-authored `attack` bite's 48.1. `BreathVFX` ignites
  on the same frame the action starts and restarts its 0.85 s burst for as long
  as the action holds, so fire pours out of a shut mouth for the first 1.15 s --
  58% of the clip.
* **the jet aims at the ground.** The exhale sweeps the head down through 68
  degrees and holds the widest gape at 47.7 degrees *below* horizontal.
  `BreathVFX` points the jet along the last-neck-to-skull tangent, and
  `tryBreath` in `core/combat/encounter.ts` tests a strictly horizontal cone out
  to `breathRange`, so the fire was drawn nowhere near what it damaged.
* **nothing braces.** `Tail1` and `Tail5` hold one value for all 49 frames, and
  the wings never leave their idle flutter, so the animal absorbs no recoil.

What it authors instead, on the same 24 fps rig, in the same 48 frames (2.000 s,
inside combat's 2.2 s `BREATH_INTERVAL`):

    f0       neutral
    f0-f7    inhale     chest swells and rears, neck draws up and back, jaw
                        parts, wings mantle open, toes splay to plant
    f7-f11   ignition   jaw snaps to full gape as the neck drops onto the aim
    f11-f34  jet        0.958 s held wide and level, drifting up under recoil
    f34-f40  cutoff     jaw shuts, head follows through down
    f40-f45  recovery   eased back to exactly neutral
    f45-f48  hold       lets the lagged wing and tail chains resolve

Frame 0 and frame 48 are both the identity pose, for the same two reasons as
`attack`: the action channel crossfades in, so a wound-up first frame pops, and
``GameModel`` only clears a tell when a ``loop: false`` clip finishes, so the
last frame is what the base locomotion state is blended back out of.

Axes are the ones probed on this rig (see ``docs/WYVERN_CLIP_AUDIT.md``):

* ``Spine*``/``Neck*``/``Head`` local +X pitches the head **down**, so the
  inhale is negative and the follow-through positive;
* ``Jaw`` local -X opens, calibrated against `attack`'s -48 degree bite;
* ``Tail*`` local +X lifts the tail;
* wing shoulder/elbow/wrist local +X raises **both** wings;
* ``L_Toes``/``R_Toes`` local -X splays the foot into a braced stance, which is
  the value stage 4.99 authored here and this keeps.

**Where the jet points is solved, not guessed.** Probed on the armature, every
bone from ``Body`` through ``Neck2`` moves the skull tangent by exactly -1.0
degree per +1 degree of local X, and ``Head`` moves it by 0.0 -- it rotates the
skull below the measurement's origin. So

    aim = BIND_AIM - sum(Body, Spine1, Spine2, Spine3, Neck1, Neck2)

with ``BIND_AIM`` measured at -14.32 degrees. That bind aim is already the line
a grounded wyvern needs: its head sits 793 rig units up (5.71 m at
``WYVERN_FIT``), so -14.32 degrees reaches a ground target's torso at 16.5 m --
the middle of the 14-18 m `breathRange` band in ``core/data/config.ts``. The jet
therefore holds a chain sum near zero and drifts a few degrees *up* across the
window as recoil accumulates, instead of sweeping 68 degrees past neutral.

Only local X is authored. The antisymmetric Z channel is left at the bind value,
which keeps the left/right wingtip mirror at the rig's 0.0009 m floor by
construction rather than by repair, and keeps the wing fold identical to what
the gothic retarget stage expects (``breath`` is not one of the clips
``graft-v1-wing-clips-blender.py`` rebuilds).
"""

from __future__ import annotations

import math
import sys

try:
    import bpy  # type: ignore
    from mathutils import Euler  # type: ignore
except ImportError:  # pragma: no cover - only importable inside Blender
    bpy = None  # type: ignore
    Euler = None  # type: ignore


ARMATURE = "WyvernRig"
ACTION = "breath"
FPS = 24
FRAMES = 48

# `author-wyvern-wing-surfaces-blender.py` stamps the surface-response layer it
# added onto the action, and subtracts that recorded layer before re-applying so
# a second run replaces the flex rather than doubling it. Wiping the curves below
# removes the layer but not the stamp, so the marker has to go with them --
# otherwise the next surface pass subtracts a response that is no longer there
# and bakes its negative into the carrier.
SURFACE_RESPONSE_PROPERTY = "wyvern_surface_response_profile"

# The seven authored poses, in frames. The last lands at 45, three short of the
# clip, so the lagged wing and tail chains have resolved to neutral by f48 too.
BASE_FRAMES = (0, 7, 11, 22, 34, 40, 45)

# frame -> degrees of local X, per bone. Every column starts and ends at 0.
#                  f0  f7 inhale  f11 ignite  f22 jet  f34 jet-end  f40 cut  f45
KEYS = {
    # Aim chain. The column sums are 0 / -30 / 0 / -3 / -6 / +8 / 0, which puts
    # the jet at -14.3 degrees on ignition and lets recoil walk it up to -8.3 by
    # the end of the window. The inhale's -30 throws the muzzle to +15.7, well
    # clear of the aim line, so the drop onto it reads as the commitment.
    "Body":   (0.0,  -8.0,  -4.0,  -5.0,  -7.0,   0.0, 0.0),
    "Spine1": (0.0,  -3.0,  -1.0,  -1.0,  -2.0,   0.0, 0.0),
    "Spine2": (0.0,  -2.0,  -1.0,  -1.0,  -1.0,   0.0, 0.0),
    "Neck1":  (0.0, -11.0,   4.0,   3.0,   3.0,   3.0, 0.0),
    "Neck2":  (0.0,  -6.0,   2.0,   1.0,   1.0,   1.0, 0.0),

    # The skull rides 4.96 degrees below the tangent the jet is drawn along, so
    # -5 through the window aligns the muzzle with its own fire. It contributes
    # nothing to the aim itself.
    "Head":   (0.0,  -6.0,  -5.0,  -5.0,  -5.0,   0.0, 0.0),

    # Negative opens. -50 is the widest gape in the set by design -- `attack`'s
    # bite peaks at -48 -- and unlike the bite it is *held*, because the burst it
    # covers is a sustained stream rather than a snap.
    "Jaw":    (0.0, -16.0, -50.0, -49.0, -47.0,  -8.0, 0.0),

    # The wings mantle open and stay open for the length of the jet: a braced
    # threat display, not the attack's momentary flare. Amplitude decays outboard
    # at the same 1 / 0.64 / 0.41 ratio the strike uses.
    #
    # Only the three bones the two authoring rigs share are keyed. The digits
    # below the wrist differ completely between them -- `wyvern-rig.blend` has
    # three fingers and two membrane bones per side, `wyvern-rig-v1wing.blend`
    # six three-phalanx digits plus battens -- and they inherit the shoulder
    # anyway. Every value is positive, for the reason the strike documents: the
    # chest pitches back here, and a negative shoulder on top of that drops the
    # leading finger tip below the ground plane.
    "L_WingShoulder": (0.0, 26.0, 30.0, 28.0, 24.0, 10.0, 0.0),
    "R_WingShoulder": (0.0, 26.0, 30.0, 28.0, 24.0, 10.0, 0.0),
    "L_WingElbow":    (0.0, 17.0, 19.0, 18.0, 15.0,  6.0, 0.0),
    "R_WingElbow":    (0.0, 17.0, 19.0, 18.0, 15.0,  6.0, 0.0),
    "L_WingWrist":    (0.0, 11.0, 12.0, 11.0, 10.0,  4.0, 0.0),
    "R_WingWrist":    (0.0, 11.0, 12.0, 11.0, 10.0,  4.0, 0.0),

    # Counterweight, built outboard and kept small for the reason the strike
    # records: this is a ten-bone chain, and at full amplitude its tip travels
    # further than the head it is supposed to be answering. It dips as the head
    # rears, then streams up and back against the recoil.
    "Tail1": (0.0, -1.0, 0.6, 1.2, 1.6, 0.0, 0.0),
    "Tail2": (0.0, -1.2, 0.8, 1.5, 2.0, 0.0, 0.0),
    "Tail3": (0.0, -1.3, 0.9, 1.7, 2.2, 0.0, 0.0),
    "Tail4": (0.0, -1.2, 0.8, 1.6, 2.1, 0.0, 0.0),
    "Tail5": (0.0, -0.9, 0.6, 1.2, 1.6, 0.0, 0.0),
    "Tail6": (0.0, -0.6, 0.4, 0.8, 1.1, 0.0, 0.0),

    # Braced stance, held for the whole jet. -25 is the splay stage 4.99
    # authored on this clip and the firmest in the set, which is what a planted
    # animal leaning into its own recoil should read as.
    "L_Toes": (0.0, -18.0, -25.0, -25.0, -25.0, -8.0, 0.0),
    "R_Toes": (0.0, -18.0, -25.0, -25.0, -25.0, -8.0, 0.0),
}

# Wing and tail chains trail the forequarters rather than snapping with them.
LAG = {"Wing": 2, "Tail": 3}

# A held pose is not a still one. Across the jet window only, these channels
# carry three cycles of a small sine on top of the eased value -- the chug of a
# sustained exhale. sin(3*pi*u) is zero at both ends of the window, so nothing
# is discontinuous at the beats either side of it.
TREMOR = {"Jaw": 2.0, "Neck2": 1.0}
TREMOR_WINDOW = (11, 34)
TREMOR_CYCLES = 3


def lag_for(bone: str) -> int:
    for needle, frames in LAG.items():
        if needle in bone:
            return frames
    return 0


def armature() -> "bpy.types.Object":
    arm = bpy.data.objects.get(ARMATURE)
    if arm is None or arm.type != "ARMATURE":
        raise SystemExit(f"armature {ARMATURE!r} not found")
    return arm


def fcurves(action: "bpy.types.Action"):
    for layer in action.layers:
        for strip in layer.strips:
            if strip.type != "KEYFRAME":
                continue
            for bag in strip.channelbags:
                for curve in tuple(bag.fcurves):
                    yield bag, curve


def sample(values: tuple, frame: float) -> float:
    """Piecewise ease between the authored poses, clamped at both ends."""
    if frame <= BASE_FRAMES[0]:
        return values[0]
    if frame >= BASE_FRAMES[-1]:
        return values[-1]
    for index in range(len(BASE_FRAMES) - 1):
        start, end = BASE_FRAMES[index], BASE_FRAMES[index + 1]
        if start <= frame <= end:
            t = (frame - start) / (end - start)
            # Smoothstep, so the gape snaps out of the inhale and the recovery
            # settles rather than arriving at constant speed.
            eased = t * t * (3.0 - 2.0 * t)
            return values[index] + (values[index + 1] - values[index]) * eased
    return values[-1]


def tremor_for(bone: str, frame: float) -> float:
    amplitude = TREMOR.get(bone)
    if amplitude is None:
        return 0.0
    start, end = TREMOR_WINDOW
    if frame <= start or frame >= end:
        return 0.0
    u = (frame - start) / (end - start)
    return amplitude * math.sin(TREMOR_CYCLES * math.pi * u)


def author() -> dict:
    arm = armature()
    action = bpy.data.actions.get(ACTION)
    if action is None:
        raise SystemExit(f"action {ACTION!r} not found")
    missing = sorted(set(KEYS) - set(arm.pose.bones.keys()))
    if missing:
        raise SystemExit(f"bones missing from {ARMATURE}: {', '.join(missing)}")

    # The old performance is replaced outright, including its Body.location
    # drift -- the sim owns the actor's position, so a battle tell must not
    # translate the root.
    for bag, curve in fcurves(action):
        bag.fcurves.remove(curve)
    if SURFACE_RESPONSE_PROPERTY in action:
        del action[SURFACE_RESPONSE_PROPERTY]

    if arm.animation_data is None:
        arm.animation_data_create()
    arm.animation_data.action = action
    if action.slots:
        arm.animation_data.action_slot = action.slots[0]

    previous: dict[str, object] = {}
    for frame in range(FRAMES + 1):
        for bone, values in KEYS.items():
            lag = lag_for(bone)
            angle = sample(values, frame - lag) + tremor_for(bone, frame - lag)
            pose_bone = arm.pose.bones[bone]
            pose_bone.rotation_mode = "QUATERNION"
            pose_bone.rotation_quaternion = Euler(
                (math.radians(angle), 0.0, 0.0), "XYZ"
            ).to_quaternion()
            if bone in previous:
                pose_bone.rotation_quaternion.make_compatible(previous[bone])
            previous[bone] = pose_bone.rotation_quaternion.copy()
            pose_bone.keyframe_insert(
                data_path="rotation_quaternion", frame=frame, group=bone
            )

    for _, curve in fcurves(action):
        for key in curve.keyframe_points:
            key.interpolation = "BEZIER"
            key.handle_left_type = "AUTO_CLAMPED"
            key.handle_right_type = "AUTO_CLAMPED"
        curve.update()

    action.use_frame_range = True
    action.frame_start, action.frame_end = 0.0, float(FRAMES)
    action.use_fake_user = True
    bpy.context.scene.render.fps = FPS
    arm.animation_data.action = None
    bpy.context.scene.frame_set(0)
    return {
        "action": ACTION,
        "frames": FRAMES + 1,
        "duration_s": round(FRAMES / FPS, 3),
        "bones": len(KEYS),
    }


if __name__ == "__main__":
    print(author())
    if "--save" in sys.argv:
        bpy.ops.wm.save_mainfile()
        print("saved mainfile")
