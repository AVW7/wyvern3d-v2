"""Promote v1's strike captures into shipping ``attack`` variants.

    /Applications/Blender.app/Contents/MacOS/Blender -b \
        public/models/wyvern-rig-v1wing.blend \
        -P scripts/author-wyvern-attack-variants-blender.py -- --save

One attack reads as a tic. `GameModel` picks from a `StateClips` array by the
model's `seed`, so a roster of wyverns striking at once no longer swings in
lockstep, and the two sources are deliberately different in kind:

    attack     authored (author-wyvern-attack-blender.py) -- 1.500 s, fast
    attack2    v1 `Battle_Attack06` -- 3.333 s planted snap-bite
    attackAir2 v1 `Battle_Attack04` -- 3.333 s airborne strike

The v1 pair comes in through `retarget-v1-ground-clips-blender.py`, which must
have run first and left `v1_attackSnap` / `v1_attackAir` in the blend; this
script only copies them under gameplay names and normalises them.

Normalising means two things, both of which the shipped clips already obey and
`validate-wyvern-clips.mjs` gates:

* the first key sits on frame 0, so three.js does not clamp the opening frame
  for 1/24 s on every play;
* the root does not translate -- the sim owns the actor's world position, so any
  `RootMotion` channel is dropped rather than left to fight it.

`Battle_Attack01`, v1's rearing two-beat, is deliberately not promoted: at 195
frames it is 8.1 s, three times too long for a combat tell, and the only way to
fit it is a 3x retime that reads as a fast-forward rather than a strike.
"""

from __future__ import annotations

import sys

try:
    import bpy  # type: ignore
except ImportError:  # pragma: no cover - only importable inside Blender
    bpy = None  # type: ignore


ARMATURE = "WyvernRig"

# source capture -> shipping action name
VARIANTS = {
    "v1_attackSnap": "attack2",
    "v1_attackAir": "attackAir2",
}

ROOT_BONES = ("Root", "RootMotion")


def channelbag(action):
    for layer in action.layers:
        for strip in layer.strips:
            if strip.type != "KEYFRAME":
                continue
            for bag in strip.channelbags:
                return bag
    return None


def normalise(action) -> dict:
    bag = channelbag(action)
    if bag is None:
        raise SystemExit(f"{action.name} has no keyframes")

    dropped = 0
    for curve in list(bag.fcurves):
        bone = curve.data_path.split('"')[1] if '"' in curve.data_path else ""
        if bone in ROOT_BONES:
            bag.fcurves.remove(curve)
            dropped += 1

    first = min(
        key.co.x for curve in bag.fcurves for key in curve.keyframe_points
    )
    if first:
        for curve in bag.fcurves:
            for key in curve.keyframe_points:
                key.co.x -= first
                key.handle_left.x -= first
                key.handle_right.x -= first
            curve.update()

    last = max(
        key.co.x for curve in bag.fcurves for key in curve.keyframe_points
    )
    action.use_frame_range = True
    action.frame_start, action.frame_end = 0.0, float(last)
    action.use_fake_user = True
    return {"shifted_by": first, "frames": int(last) + 1, "root_curves_dropped": dropped}


def promote() -> dict:
    arm = bpy.data.objects.get(ARMATURE)
    if arm is None or arm.type != "ARMATURE":
        raise SystemExit(f"armature {ARMATURE!r} not found")

    report = {}
    for source_name, target_name in VARIANTS.items():
        source = bpy.data.actions.get(source_name)
        if source is None:
            raise SystemExit(
                f"{source_name!r} not in this blend -- run "
                "retarget-v1-ground-clips-blender.py --clips attackSnap,attackAir first"
            )
        existing = bpy.data.actions.get(target_name)
        if existing is not None:
            bpy.data.actions.remove(existing)
        copy = source.copy()
        copy.name = target_name
        report[target_name] = {"source": source_name, **normalise(copy)}
    return report


if __name__ == "__main__":
    print(promote())
    if "--save" in sys.argv:
        bpy.ops.wm.save_mainfile()
        print("saved mainfile")
