"""Re-author the ``attack`` action on the repaired rig as a committed bite.

Run inside Blender against **both** authoring blends -- `wyvern-rig.blend`
feeds `wyvern.glb`, and `wyvern-rig-v1wing.blend` is what
`pnpm assets:gothic-wing` retargets into the shipped `wyvern-gothic.glb`, so
authoring only the first leaves gameplay on the old performance:

    for blend in wyvern-rig wyvern-rig-v1wing; do \
      /Applications/Blender.app/Contents/MacOS/Blender -b \
        "public/models/$blend.blend" \
        -P scripts/author-wyvern-attack-blender.py -- --save ; done

What it replaces. The shipped ``attack`` was 81 frames -- 3.333 s -- of which the
last 40 were a slow drift back to neutral, and its wings moved 11.1 degrees of
elevation across the whole clip. As a battle tell that reads as a stretch, not a
strike: the sim's attack lands on one tick while the clip is still winding up.

What it authors instead, on the same 24 fps rig, in 36 frames (1.500 s):

    f0      neutral
    f0-f9   wind-up      head and chest rear back, jaw parts, wings flare up
    f9-f15  strike       0.250 s of chest-forward, head-down commitment
    f15-f18 bite         jaw snaps shut on the deepest head pose
    f18-f33 recovery     eased back to exactly neutral, held to f36

Frame 0 and frame 36 are both the identity pose. That matters twice over: the
manifest plays this through the one-shot action channel with a 0.16 s
``fadeIn`` on ``attackAir``, so a wound-up first frame pops on the blend in, and
``GameModel`` only clears a tell when a ``loop: false`` clip finishes, so the
last frame is what the base locomotion state is blended back out of.

Axes are the ones probed on this rig (see ``docs/WYVERN_CLIP_AUDIT.md``), not
guessed:

* ``Neck*``/``Head`` local +X pitches the head **down**, so the wind-up is
  negative and the strike positive;
* ``Jaw`` local -X opens, measured on the shipped clip's own -45 degree gape;
* ``Tail*`` local +X lifts the tail, so it lifts as the head drops;
* wing shoulder/elbow/wrist local +X raises **both** wings.

Only local X is authored. The antisymmetric Z channel is left at the bind value
the clip already held, which keeps the left/right wingtip mirror at the rig's
0.0009 m floor by construction rather than by repair, and keeps the wing fold
identical to what the gothic retarget stage expects (``attack`` is not one of
the clips ``graft-v1-wing-clips-blender.py`` rebuilds).
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
ACTION = "attack"
FPS = 24
FRAMES = 36

# frame -> degrees of local X, per bone. Every column starts and ends at 0.
#            f0   f9(wind) f15(strike) f18(bite) f33
KEYS = {
    "Body":        (0.0, -15.0,  11.0,   8.0, 0.0),
    "Neck1":       (0.0, -24.0,  32.0,  30.0, 0.0),
    "Neck2":       (0.0, -18.0,  26.0,  24.0, 0.0),
    "Head":        (0.0, -12.0,  30.0,  26.0, 0.0),
    # Negative opens. The gape peaks a frame before the head bottoms out and is
    # shut by the bite key, which is the readable half of the tell.
    "Jaw":         (0.0, -20.0, -48.0,  -4.0, 0.0),

    # The wings mantle: up and open on the wind-up, then back toward the folded
    # bind pose through the strike. Amplitude decays outboard along the chain.
    # They deliberately never go below neutral -- the chest pitches forward at
    # the same time, and a negative shoulder on top of that put the leading
    # finger tip 8.8 m under the rig origin, which is under the ground plane for
    # a clip the manifest plants at yOffset 0.
    #
    # Only the three bones the two authoring rigs share are keyed. The digits
    # below the wrist differ completely between them -- `wyvern-rig.blend` has
    # three fingers and two membrane bones per side, `wyvern-rig-v1wing.blend`
    # six three-phalanx digits plus battens -- and they inherit the shoulder
    # anyway. Leaving them alone also keeps the gothic wing pipeline the sole
    # author of that chain.
    "L_WingShoulder": (0.0, 22.0, 4.0, 2.0, 0.0),
    "R_WingShoulder": (0.0, 22.0, 4.0, 2.0, 0.0),
    "L_WingElbow":    (0.0, 14.0, 2.5, 1.2, 0.0),
    "R_WingElbow":    (0.0, 14.0, 2.5, 1.2, 0.0),
    "L_WingWrist":    (0.0,  9.0, 1.6, 0.8, 0.0),
    "R_WingWrist":    (0.0,  9.0, 1.6, 0.8, 0.0),

    # Counterweight: the tail lifts as the head drops, building outboard.
    # Halved from the first pass: at full amplitude the ten-bone chain summed to
    # 20.6 units of tail-tip lift against the head's 6.8, and the counterweight
    # read as thethe primary motion of the clip.
    "Tail1": (0.0, -0.7,  2.0,  1.5, 0.0),
    "Tail2": (0.0, -0.9,  2.5,  1.9, 0.0),
    "Tail3": (0.0, -1.0,  3.0,  2.3, 0.0),
    "Tail4": (0.0, -1.1,  3.5,  2.6, 0.0),
    "Tail5": (0.0, -1.0,  3.2,  2.4, 0.0),
    "Tail6": (0.0, -0.7,  2.5,  1.8, 0.0),
}

# Wing and tail chains trail the forequarters rather than snapping with them.
LAG = {"Wing": 2, "Tail": 3}

# The last authored pose lands at 33, three frames short of the clip, so the
# lagged wing and tail chains have resolved to neutral by the final frame too.
BASE_FRAMES = (0, 9, 15, 18, 33)


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

    if arm.animation_data is None:
        arm.animation_data_create()
    arm.animation_data.action = action
    if action.slots:
        arm.animation_data.action_slot = action.slots[0]

    previous: dict[str, object] = {}
    for frame in range(FRAMES + 1):
        for bone, values in KEYS.items():
            lag = lag_for(bone)
            angle = sample(values, frame - lag)
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
        "duration_s": round((FRAMES) / FPS, 3),
        "bones": len(KEYS),
    }


def sample(values: tuple, frame: float) -> float:
    """Piecewise ease between the five authored poses, clamped at both ends."""
    if frame <= BASE_FRAMES[0]:
        return values[0]
    if frame >= BASE_FRAMES[-1]:
        return values[-1]
    for index in range(len(BASE_FRAMES) - 1):
        start, end = BASE_FRAMES[index], BASE_FRAMES[index + 1]
        if start <= frame <= end:
            t = (frame - start) / (end - start)
            # Smoothstep, so the strike accelerates out of the wind-up and the
            # recovery settles rather than arriving at constant speed.
            eased = t * t * (3.0 - 2.0 * t)
            return values[index] + (values[index + 1] - values[index]) * eased
    return values[-1]


if __name__ == "__main__":
    print(author())
    if "--save" in sys.argv:
        bpy.ops.wm.save_mainfile()
        print("saved mainfile")
