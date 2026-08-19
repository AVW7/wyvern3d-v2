"""Retarget the 16 gameplay clips' orphaned wing channels onto the gothic spars.

Runs inside Blender, after ``weight-gothic-wing-blender.py``.

The gameplay clips key ``WingFinger1-3``, ``WingMembrane1-2`` and ``WingClaw``,
none of which exist any more, so every wing channel in every gameplay state
currently animates nothing. The arm chain (Shoulder/Elbow/Wrist) kept its names
and is untouched -- and since the flight loops drive the wing almost entirely
from the arm, this is not the disaster the missing bones make it look like.

Measured motion on the orphaned channels, across all 16 clips:

    WingFinger1   48.8 deg   land / death / takeoff only
    WingFinger2   36.7 deg   same three
    WingFinger3   24.5 deg   same three
    WingMembrane2 11.0 deg   flight loops, a subtle flutter
    WingMembrane1  7.1 deg   flight loops
    WingClaw       0.0 deg   never animated in any clip
    *_end          0.0 deg   never animated in any clip

So the fingers are the wing *fold*, and the membrane pair is flight flutter.
``WingClaw`` and the six ``_end`` bones are dead channels and are dropped rather
than mapped -- carrying a 0.0-degree channel forward would only invite someone
to assume it means something.

This is not the bulk retarget WYVERN_V1_REAUTHORING_SOURCE_OF_TRUTH.md forbids.
That ban is on transferring the 78 v1 source performances onto v2 channel-for-
channel. This is the opposite direction and a far narrower claim: v2's own
already-approved clips, whose wing channels lost their bones underneath them,
reconnected to the spars that replaced those bones.

Mapping, by position in the fan rather than by name. The old rig had three spars
where the gothic hand has five, so the two outer old spars each drive a pair:

    Finger1 -> D0, D1     leading edge
    Finger2 -> D2         middle
    Finger3 -> D3, D4     trailing edge
    Membrane1 -> Panel*_0 inboard battens
    Membrane2 -> Panel*_1 outboard battens

Transfer is by world-space delta, not by copying local rotations. The two rigs
disagree about rest orientation -- the gothic spars were given real tails and
rolls, the old stubs had neither -- so a local copy would apply a correct angle
about the wrong axis. What carries across is how far the old bone rotated *from
its own rest*, re-expressed in the new bone's frame.
"""

from __future__ import annotations

import argparse
import json
import sys

import bpy
from mathutils import Matrix

MAP = {
    "WingFinger1": ["WingD0P0", "WingD1P0"],
    "WingFinger2": ["WingD2P0"],
    "WingFinger3": ["WingD3P0", "WingD4P0"],
    "WingMembrane1": ["WingPanel0_0", "WingPanel1_0", "WingPanel2_0", "WingPanel3_0"],
    "WingMembrane2": ["WingPanel0_1", "WingPanel1_1", "WingPanel2_1", "WingPanel3_1"],
}
DEAD = ("WingClaw", "WingFinger1_end", "WingFinger2_end", "WingFinger3_end")
SIDES = ("L", "R")


def arguments():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--reference", required=True, help="wyvern.glb, the old rig")
    parser.add_argument("--out", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args(argv)


def channelbag(action):
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                return bag
    return None


def keyed_bones(action) -> set:
    bag = channelbag(action)
    if bag is None:
        return set()
    return {fc.data_path.split('"')[1] for fc in bag.fcurves if '"' in fc.data_path}


def main() -> None:
    args = arguments()
    report: dict = {}

    target = bpy.data.objects["WyvernRig"]
    existing = {o.name for o in bpy.data.objects}
    bpy.ops.import_scene.gltf(filepath=args.reference)
    imported = [o for o in bpy.data.objects if o.name not in existing]
    reference = next(o for o in imported if o.type == "ARMATURE")
    report["reference_bones"] = len(reference.data.bones)

    # The reference arrives with its own copies of the 16 actions. Match them to
    # the target's by name; the imported ones carry a suffix if names collided.
    reference_actions = {}
    for action in bpy.data.actions:
        if not action.users:
            continue
        reference_actions.setdefault(action.name.split(".")[0], []).append(action)

    transferred = {}
    skipped = []
    for target_action in [a for a in bpy.data.actions if "." not in a.name]:
        candidates = reference_actions.get(target_action.name, [])
        source = next((a for a in candidates if a is not target_action), None)
        if source is None:
            skipped.append(target_action.name)
            continue

        keyed = keyed_bones(source)
        live = [
            (side, old, new)
            for side in SIDES
            for old, news in MAP.items()
            for new in news
            if f"{side}_{old}" in keyed
        ]
        if not live:
            skipped.append(target_action.name)
            continue

        reference.animation_data_create().action = source
        target.animation_data_create().action = target_action
        start, end = (int(v) for v in source.frame_range)

        moved = 0
        for frame in range(start, end + 1):
            bpy.context.scene.frame_set(frame)
            for side, old, new in live:
                source_bone = reference.pose.bones.get(f"{side}_{old}")
                target_bone = target.pose.bones.get(f"{side}_{new}")
                if source_bone is None or target_bone is None:
                    continue
                rest_source = source_bone.bone.matrix_local
                # How far this bone has turned from its own rest, in armature
                # space. Translation is deliberately discarded: the spars are a
                # rotation-only chain and letting a stub's offset through would
                # tear the membrane off the hand.
                delta = (source_bone.matrix @ rest_source.inverted()).to_quaternion()
                # Re-expressed in the target's own rest frame, which makes the
                # result a plain local rotation. Assigning `pose_bone.matrix`
                # instead would be armature-space and therefore depend on the
                # parent's already-evaluated pose -- an ordering dependency that
                # needs a view-layer update per bone and, without one, silently
                # reads a stale parent. That is what tore the loop seams open
                # (cruise 1.199 rad) and desynced the two banks from each other.
                rest_rotation = target_bone.bone.matrix_local.to_quaternion()
                target_bone.rotation_mode = "QUATERNION"
                target_bone.rotation_quaternion = (
                    rest_rotation.inverted() @ delta @ rest_rotation
                )
                target_bone.keyframe_insert("rotation_quaternion", frame=frame)
                moved += 1
        transferred[target_action.name] = len(live)

    report["transferred"] = transferred
    report["skipped"] = sorted(skipped)

    # Strip the dead channels rather than leaving them keyed to nothing. This
    # covers the v1_* capture clips as well: they key the broken batten
    # generation, whose bones aimed across the body and could not be mirrored,
    # so those channels have nothing to reconnect to. The rest of each v1
    # performance -- torso, neck, tail, legs, arm chain -- is left intact.
    removed = 0
    for action in list(bpy.data.actions):
        bag = channelbag(action)
        if bag is None:
            continue
        for fcurve in list(bag.fcurves):
            if '"' not in fcurve.data_path:
                continue
            bone = fcurve.data_path.split('"')[1]
            if (
                "WingBatten" in bone
                or any(bone.endswith(tail) for tail in DEAD)
                or any(bone.endswith(old) for old in MAP)
            ):
                bag.fcurves.remove(fcurve)
                removed += 1
    report["dead_fcurves_removed"] = removed

    for obj in imported:
        bpy.data.objects.remove(obj, do_unlink=True)
    for action in [a for a in bpy.data.actions if "." in a.name]:
        bpy.data.actions.remove(action)

    # Gate: no gameplay clip may key a bone that does not exist.
    live_bones = {b.name for b in target.data.bones}
    problems = []
    for action in bpy.data.actions:
        missing = sorted(keyed_bones(action) - live_bones)
        if missing:
            problems.append(f"{action.name} keys {len(missing)} absent bone(s): {missing[:4]}")
    report["problems"] = problems

    # Unbinding the action is not enough: `matrix_basis` is pose state, not
    # animation, so every bone this stage posed stays posed once the action is
    # gone -- and that state is what gets saved into the blend.
    #
    # It shipped that way, and the damage was not confined to the wing. This
    # blend carried 89 stale pose bones, among them `RootMotion` at 0.262 rad.
    # No clip animates `RootMotion` -- it is a v2-only control bone -- so nothing
    # downstream ever overwrote it, and a 15-degree tilt at the root of the
    # skeleton was applied to every clip in the model from here on. Measured on
    # `v1_stand` either side of this stage, it dropped the head 449 rig units and
    # the feet 177: far from the root moves further, which is why it read as a
    # head-drop rather than as the whole-body tilt it is.
    #
    # `retarget-v1-ground-clips-blender.py` already ends this way. So does this
    # one now.
    target.animation_data.action = None
    for pose_bone in target.pose.bones:
        pose_bone.matrix_basis = Matrix.Identity(4)
    bpy.ops.wm.save_as_mainfile(filepath=args.out)
    with open(args.report, "w", encoding="utf8") as handle:
        json.dump(report, handle, indent=2, sort_keys=True)

    print(f"[retarget] clips retargeted: {len(transferred)}")
    print(f"[retarget] skipped: {report['skipped']}")
    print(f"[retarget] dead fcurves removed: {removed}")
    for problem in problems:
        print(f"[retarget] PROBLEM {problem}")
    if problems:
        raise SystemExit(1)
    print("[retarget] every gameplay clip now keys live bones only")


main()
