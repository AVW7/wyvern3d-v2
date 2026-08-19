"""Graft v1's wing performances onto the grounded gameplay clips.

    pnpm assets:gothic-wing   (runs as the stage after retargeting)

The gameplay clips do not fold the wing. Measured on the shipped rig: `idle`
folds 0%, `rest` 0%, `walk` 1% -- the animal walks with its wings held out for
the whole cycle. That was a rig limit before (the old membrane could not close)
and is now only a missing performance, because v1's own grounded captures are
in this blend, keyed on the same digits the rebuilt wing uses.

Each graft names its source. This is the per-clip rebuild
WYVERN_V1_REAUTHORING_SOURCE_OF_TRUTH.md asks for -- a named v1 performance for
a named target -- not the bulk channel-for-channel retarget it forbids.

    idle    <- v1_stand    settled, wings tucked
    rest    <- v1_stand    same stance; rest is the longer, stiller read
    walk    <- v1_walk     the quadrupedal gait, wing knuckles contacting
    takeoff <- v1_riseUp   the unfold and first beat
    land    <- v1_goDown   the close onto the ground
    cruise  <- v1_flightBeat  one measured wingbeat, repeated three times
    scout   <- v1_flightBeat  the same beat at two-per-loop
    hover   <- v1_flightBeat  the same beat at four-per-loop
    speed   <- v1_flightBeat  the same beat at four per five seconds

The powered flight loops are the reason `window` and `beats` exist. Measured on
the shipped rig, `cruise` carries a 5.3-degree wing-elevation stroke against
v1's 107.8, and its frames 0 and N sit 1474 rig units below every other frame --
a one-frame wingtip drop of about ten metres on every loop wrap. `scout` has the
same shape at 27.4 degrees. They are rebuilt here from v1's own cycle rather
than retuned, exactly as the v1 recipe built `Sanct_Cruise`.

`Battle_Down02` is a landing, and only frames 40-66 of it are a cruise cycle;
the rest arrives welded to a 37-degree torso flare. `window` selects that cycle
and `beats` repeats it, which is what sets each mode's cadence.

`retime` rewrites the target's own keyframes onto a new frame count first, so
the whole `phaseGroup: "flight"` family lands on v1's 6.000 s / three-beat
measure. That grouping is only coherent when its members share a duration *and*
a beat count: GameModel resumes a crossfaded loop at `normalizedPhase *
clip.duration`, so two clips of equal cadence but unequal length still hand off
mid-stroke. Shipped, cruise ran 2.000 s at 1.000 Hz against the banks' 1.958 s
at 1.532 -- 53.2% apart, and the one failure `validate-wyvern-clips.mjs`
reported on the model.

Only the wing chain is grafted. Torso, neck, tail and legs keep whatever the
gameplay clip already authored, so this changes what the wings do and nothing
else about the performance.

Source and target durations differ, so the source is sampled across its own
range remapped onto the target's. For a looping target the sample wraps at the
end rather than running to the source's last frame, which is what closes the
loop -- the validator gates the seam at 0.05 rad and an unwrapped tail fails it.
"""
from __future__ import annotations
import argparse, json, sys
from dataclasses import dataclass
import bpy

# v1's cruise cycle inside `v1_flightBeat`, and the family measure every powered
# loop is cut to. Both come from the v1 authoring recipe and its signature
# record: `Sanct_Cruise`, `Sanct_BankL` and `Sanct_BankR` are 6.000 s with three
# 48-frame beats, `Sanct_Scout` two 72-frame beats, `Sanct_Hover` four 36-frame
# beats, and `Sanct_Speed` four 30-frame beats over 5.000 s.
BEAT_WINDOW = (40, 66)
FLIGHT_FRAMES = 144
SPEED_FRAMES = 120

# (target, source, loops, mirror)
#
# `mirror` reflects the left wing onto the right, making the pose symmetric by
# construction. It is off for `walk` alone: the gait alternates its wing-knuckle
# contacts like the vendor's quadrupedal walk, so a symmetric walk is a wrong
# walk -- `validate-wyvern-clips.mjs` holds it to a *minimum* asymmetry of 0.1 m
# for exactly that reason, and mirroring it locked the knuckles together at
# 0.001. The other four are symmetric acts and read as broken without it.
@dataclass(frozen=True)
class Graft:
    """One named v1 performance onto one named gameplay clip.

    `window` limits which source frames are sampled; `beats` repeats that window
    across the target; `retime` rescales the target's own non-wing keyframes
    onto a new frame count before anything is sampled.

    `fold_digits` replaces the sampled hand and digits with the measured closed
    pose, leaving the arm chain to carry the performance.

    `body` takes the source's torso, neck and legs as well, so the target *is*
    the v1 performance rather than a gameplay clip wearing its wings.
    """
    target: str
    source: str
    loops: bool
    mirror: bool
    window: tuple[int, int] | None = None
    beats: int = 1
    retime: int | None = None
    fold_digits: bool = False
    body: bool = False


GRAFTS = [
    # The two settled stances, both from v1's `Battle_Stand`. `idle` is
    # whole-body -- the gameplay clip underneath was never this stance, it kept
    # its own authored torso and legs and only wore v1's wings. Mirrored on the
    # wing and as-authored on the body, per the note in the sampling loop.
    #
    # `idle` does NOT fold its digits, and that is the point of it: a settled
    # dragon in v1 stands with the wing held out, not stowed, and `idle` is the
    # clip that has to read as v1's stance. Folding it was costing the match for
    # almost nothing measurable -- the fold moved idle's wing low point from -319
    # to -316 rig units, three units on a 2000-unit animal, because `v1_stand`'s
    # digits are already near-shut and the fold pose IS the most-closed frame of
    # that same capture. `rest` keeps the fold: it is the longer, stiller read
    # where a stowed wing is the right silhouette, and nothing compares it to v1.
    #
    # The fold, where it is used, stops at the hand on purpose. Extending it to
    # the wrist was tried for exactly the fault it looked like it should cure --
    # the settled knuckle drifting on the ground, 0.099 on `idle` and 0.107 on
    # `rest` against v1's own 0.046 -- and it made both worse, 0.145 and 0.167.
    # Pinning the hand to the forearm does not damp the contact; it hands the
    # contact the forearm's whole swing. An earlier revision of this file reached
    # the same conclusion by a different route, so this is twice-measured:
    # whatever moves that knuckle is upstream of the wrist, in the stance itself.
    Graft("idle", "v1_stand", True, True, body=True),
    Graft("rest", "v1_stand", True, True, fold_digits=True),
    # The one whole-clip graft. Torso, neck, legs and the wing all come from
    # `v1_walk` -- v1's `Battle_Walk`, retargeted -- because v1 is the only source
    # that has this gait: a true quadruped walking on its front wing knuckles
    # alongside the hind feet, with the wing closed. That transfer only became
    # usable when `retarget-v1-ground-clips-blender.py` had its inverted bone-axis
    # constant fixed; measured on the corrected retarget, the feet are the lowest
    # part of the animal (-181 rig units), the folded wing knuckle rides 108 units
    # above them, and the tail rises 499 -> 1013 down its length instead of being
    # driven 1602 units through the floor.
    #
    # The tail is the one chain left out, and it is left out here rather than in
    # the retarget: v2 has ten tail bones to v1's nine, so the pairing compresses
    # and `Tail1` doubles the pelvis rotation. The gameplay clip's own authored
    # tail wave reads better than the compressed transfer.
    #
    # Unmirrored, and the only clip that must be. The gait alternates its
    # wing-knuckle contacts, so a symmetric walk is a wrong walk --
    # `validate-wyvern-clips.mjs` holds it to a *minimum* asymmetry of 0.1 m for
    # exactly that reason, and mirroring it locked the knuckles together at 0.001.
    # No synthetic half-cycle offset is needed either: v1 carries the offset in
    # the same channels as the leg contacts it belongs to.
    #
    # The digits are still folded, because the arm chain transfers from v1 but the
    # rebuilt digits do not close with it.
    Graft("walk", "v1_walk", True, False, fold_digits=True, body=True),
    Graft("takeoff", "v1_riseUp", False, True),
    Graft("land", "v1_goDown", False, True),
    # The powered flight family, all cut from the one measured cycle so their
    # strokes are the same mechanics at different cadences.
    Graft("cruise", "v1_flightBeat", True, True,
          window=BEAT_WINDOW, beats=3, retime=FLIGHT_FRAMES),
    Graft("scout", "v1_flightBeat", True, True,
          window=BEAT_WINDOW, beats=2, retime=FLIGHT_FRAMES),
    Graft("hover", "v1_flightBeat", True, True,
          window=BEAT_WINDOW, beats=4, retime=FLIGHT_FRAMES),
    Graft("speed", "v1_flightBeat", True, True,
          window=BEAT_WINDOW, beats=4, retime=SPEED_FRAMES),
    # `dive` is a held-wing mode, not a powered one: v1's `Sanct_Dive` measures
    # a 7.4-degree elevation range and no wingbeat cycle at all. Shipped it read
    # 29.6 degrees plus a 24.5-degree frame-zero spike, so it is rebuilt as a
    # single held source frame -- f62, the tightest wrist fold in the window,
    # which is the frame the v1 recipe holds for a stoop. A zero-width window
    # samples that one frame at every target frame, so the loop is exact and
    # there is no seam to jump.
    Graft("dive", "v1_flightBeat", True, True,
          window=(62, 62), retime=FLIGHT_FRAMES),
    # The two banks keep the differential they were authored with -- a bank is
    # the one place the wings are meant to disagree -- and are only retimed onto
    # the family measure. Their three beats over 47 frames become three over
    # 144, which is v1's 48-frame beat exactly.
    Graft("bankLeft", None, True, False, retime=FLIGHT_FRAMES),
    Graft("bankRight", None, True, False, retime=FLIGHT_FRAMES),
]


def arguments():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args(argv)


STANCE_ACTION = "v1_stand"
# The hand and digits. The arm chain is left out on purpose, the same choice
# `bake-gothic-fold-blender.py` documents: v1's grounded stance carries the wing
# against the body from the hand outward, and folding the shoulder too would
# fight the gait the graft just wrote.
FOLD_PREFIXES = ("L_WingHand", "L_WingD")


def wingspan(armature) -> float:
    """Tip-to-tip across the leading spars, in rig units."""
    left = armature.pose.bones["L_WingD0P2"]
    right = armature.pose.bones["R_WingD0P2"]
    m = armature.matrix_world
    return ((m @ left.tail) - (m @ right.tail)).length


def fold_pose(armature, prefixes) -> dict:
    """The closed hand/digit pose, from the most-closed frame of v1's stance.

    Why the grounded clips need this at all: v1's wing performance transfers as
    arm-chain rotations, but the rebuilt digits do not close with it, so the
    membrane stays a broad open sheet. The lift pass then swings that sheet up
    to clear the foot plane and it curtains over the flank -- the drape. Closing
    the digits first makes the wing compact, so the lift has far less to raise.

    Measured, not chosen, exactly as the runtime table is baked: every frame of
    the stance is spanned and the narrowest wins.
    """
    action = bpy.data.actions.get(STANCE_ACTION)
    if action is None:
        raise SystemExit(f"{STANCE_ACTION} is not in this blend")
    previous = armature.animation_data.action if armature.animation_data else None
    armature.animation_data_create().action = action
    start, end = (int(v) for v in action.frame_range)
    best_frame, best_span = start, None
    for frame in range(start, end + 1):
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        span = wingspan(armature)
        if best_span is None or span < best_span:
            best_frame, best_span = frame, span
    bpy.context.scene.frame_set(best_frame)
    bpy.context.view_layer.update()
    pose = {}
    for bone in armature.pose.bones:
        if not bone.name.startswith(prefixes):
            continue
        q = bone.rotation_quaternion.normalized().copy()
        pose[bone.name] = q
        # The rebuilt rig's left and right rests mirror to exactly 0.0, so the
        # sagittal reflection is a plain component flip.
        mirrored = q.copy()
        mirrored.y = -q.y
        mirrored.z = -q.z
        pose["R_" + bone.name[2:]] = mirrored
    armature.animation_data.action = previous
    print(f"[fold] {STANCE_ACTION} f{best_frame}: span {best_span:.0f}, "
          f"{len(pose)} bones")
    return pose


def retime(action, frames: int) -> dict:
    """Rescale every keyframe in `action` onto `frames`, preserving shape.

    A uniform scale of the x axis, applied to handles as well as co-ordinates --
    leaving the bezier handles behind stretches the curve between keys into a
    different arc than the one that was authored.

    These actions carry a *manual* frame range (`use_frame_range`), and both the
    glTF exporter and `action.frame_range` read that in preference to the keys.
    Scaling the keyframes alone therefore moved them to 0..144 and then had the
    clip exported back at its old length, with the wing graft sampled against
    the stale span. The manual range has to move with them.
    """
    start, end = (float(v) for v in action.frame_range)
    span = end - start
    if span <= 0:
        raise SystemExit(f"{action.name} has no frame range")
    scale = frames / span
    if abs(scale - 1.0) < 1e-9:
        return {"from": span, "to": frames, "scale": 1.0}
    bag = channelbag(action)
    if bag is None:
        raise SystemExit(f"{action.name} has no channelbag")
    for fcurve in bag.fcurves:
        for key in fcurve.keyframe_points:
            for point in (key.handle_left, key.co, key.handle_right):
                point.x = start + (point.x - start) * scale
        fcurve.update()
    if action.use_frame_range:
        # End first: Blender clamps start against the current end, so raising
        # the end before the start keeps the assignment from being rejected.
        action.frame_end = start + frames
        action.frame_start = start
    return {"from": span, "to": frames, "scale": round(scale, 4)}


def bone_of(fcurve) -> str:
    return fcurve.data_path.split('"')[1] if '"' in fcurve.data_path else ""


def translating_bones(action, bones: set) -> set:
    """Which of `bones` the source actually translates -- only v1's `Body`.

    It matters because the body bob is a location channel, and a rotation-only
    transfer leaves the target's own bob under v1's gait.
    """
    bag = channelbag(action)
    return {
        bone_of(fcurve) for fcurve in bag.fcurves
        if fcurve.data_path.endswith("location") and bone_of(fcurve) in bones
    }


def channelbag(action):
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                return bag
    return None


def main() -> None:
    args = arguments()
    report: dict = {}
    armature = bpy.data.objects["WyvernRig"]
    # The panel battens are excluded. v1 had no equivalent -- they replaced its
    # globally-numbered battens -- so grafting writes a constant zero over them
    # and the membrane goes dead, which the validator catches as a static bone.
    # Their existing channels came from the Membrane1/2 retarget and carry the
    # flutter, so leaving them alone is what keeps the membrane alive.
    wing = [
        b.name for b in armature.pose.bones
        if b.name.startswith(("L_Wing", "R_Wing")) and "Panel" not in b.name
    ]
    left = [name for name in wing if name.startswith("L_")]
    # What a `body` graft adds: everything except the panel battens, which stay
    # out for the reason above -- v1 has no channels for them, so transferring
    # would leave the membrane dead.
    #
    # The tail is in, and holding it out was a mistake. The worry was that v2's
    # ten tail bones pair onto v1's nine, but the pairing is only off at the very
    # base: `Tail2`..`Tail10` map in order onto v1's `Tail`..`Tail8`, and `Tail1`
    # takes the pelvis, which is where a tail base belongs anyway. What the
    # exclusion actually produced was worse than the compression it avoided --
    # `walk` took its `Body` from v1 while keeping the tail that had been authored
    # against the old one, so the tail hung off a root it was never posed against
    # and dropped 144 rig units through the foot plane. Measured on the retarget,
    # v1's own tail sits +404 above the feet.
    body = [
        b.name for b in armature.pose.bones
        if b.name not in set(wing) and "Panel" not in b.name
    ]
    report["wing_bones"] = len(wing)
    report["body_bones"] = len(body)

    grafted = {}
    folded: dict = {}
    for graft in GRAFTS:
        target_name, source_name = graft.target, graft.source
        loops, mirror = graft.loops, graft.mirror
        target = bpy.data.actions.get(target_name)
        if target is None:
            raise SystemExit(f"missing action: {target_name}")

        retimed = retime(target, graft.retime) if graft.retime else None

        # A retime-only entry rescales the clip and keeps its authored wings.
        if source_name is None:
            grafted[target_name] = {"source": None, "retimed": retimed}
            continue

        source = bpy.data.actions.get(source_name)
        if source is None:
            raise SystemExit(f"missing action: {source_name}")

        # A `body` graft widens the transfer to every non-panel, non-tail bone,
        # sampled through the same wrapping resample as the wing -- which is what
        # closes the loop. Copied raw, v1's body bob does not return to its
        # frame-0 value and the seam reads 8.5 rig units.
        bones = wing + body if graft.body else list(wing)
        moving = translating_bones(source, set(bones)) if graft.body else set()

        target_start, target_end = (int(v) for v in target.frame_range)
        if graft.window:
            source_start, source_end = graft.window
        else:
            source_start, source_end = (int(v) for v in source.frame_range)
        span = target_end - target_start
        if span <= 0:
            raise SystemExit(f"{target_name} has no frame range")

        # Sample the source first, with the target action detached, so nothing
        # reads a pose that is half one clip and half the other.
        armature.animation_data_create().action = source
        samples = []
        locations: list = []
        for index in range(span + 1):
            # A looping target wraps: its last frame samples the source's first,
            # so the seam closes on exactly the pose it opened with.
            # `beats` repeats the window: the phase runs 0..1 once per beat,
            # so three beats sample the same cycle three times across the target.
            # A looping target wraps at the end, so its last frame samples the
            # window's first and the seam closes on the pose it opened with.
            progress = (index % span) / span if loops else index / span
            t = (progress * graft.beats) % 1.0 if graft.beats > 1 else progress
            frame = source_start + t * (source_end - source_start)
            # Sample at the fractional frame, not the nearest whole one.
            # Rounding stair-steps any resample whose source and target lengths
            # differ: `idle` and `rest` stretch 121 source frames onto 145, so a
            # rounded sample holds one pose for two frames and then jumps, and
            # the contact velocity that produces is twice v1's own. Measured on
            # the stance clips, rounding put the foot p95 at 0.031 against v1's
            # 0.015 and the knuckle at 0.105 against 0.046. `walk` resamples
            # almost 1:1 (60 onto 59) and was clean either way, which is what
            # localised this.
            whole = int(frame // 1)
            bpy.context.scene.frame_set(whole, subframe=frame - whole)
            bpy.context.view_layer.update()
            # Sampled from the left wing and mirrored onto the right. v1's
            # captures are lopsided performances -- its own rig was asymmetric --
            # and grafted as-authored they put `takeoff` 20.4 m out of mirror
            # against a 0.25 m limit. A grounded stance and a takeoff are
            # symmetric acts, so the reflection is the correct reading, and it
            # makes symmetry structural here exactly as it is in the rig.
            pose = {}
            locations.append({
                name: armature.pose.bones[name].location.copy() for name in moving
            })
            # `mirror` reflects the wing only. The torso, neck and legs a `body`
            # graft brings over are taken as authored: most of them (`Body`,
            # `Spine*`, `Neck*`, `Head`) have no left/right twin to reflect onto,
            # and reflecting the legs would erase the weight shift that makes a
            # stance read as standing rather than posed.
            if graft.body:
                for name in body:
                    pose[name] = armature.pose.bones[name].rotation_quaternion.copy()
            if not mirror:
                for name in wing:
                    pose[name] = armature.pose.bones[name].rotation_quaternion.copy()
                samples.append(pose)
                continue
            for name in left:
                q = armature.pose.bones[name].rotation_quaternion.copy()
                pose[name] = q
                # Blender order is (w, x, y, z); the sagittal mirror negates the
                # y and z components.
                mirrored = q.copy()
                mirrored.y = -q.y
                mirrored.z = -q.z
                pose["R_" + name[2:]] = mirrored
            samples.append(pose)

        if graft.fold_digits:
            folded = folded or fold_pose(armature, FOLD_PREFIXES)
            for pose in samples:
                for name, quaternion in folded.items():
                    if name in pose:
                        pose[name] = quaternion.copy()

        # Drop the target's existing wing channels, then write the sampled ones.
        armature.animation_data.action = target
        bag = channelbag(target)
        removed = 0
        if bag is not None:
            for fcurve in list(bag.fcurves):
                if '"' not in fcurve.data_path:
                    continue
                if fcurve.data_path.split('"')[1] in set(bones):
                    bag.fcurves.remove(fcurve)
                    removed += 1

        for index, pose in enumerate(samples):
            frame = target_start + index
            bpy.context.scene.frame_set(frame)
            for name, quaternion in pose.items():
                bone = armature.pose.bones[name]
                bone.rotation_mode = "QUATERNION"
                bone.rotation_quaternion = quaternion
                bone.keyframe_insert("rotation_quaternion", frame=frame)
            for name, translation in locations[index].items():
                bone = armature.pose.bones[name]
                bone.location = translation
                bone.keyframe_insert("location", frame=frame)
        grafted[target_name] = {
            "source": source_name, "frames": span + 1,
            "channels_replaced": removed, "loops": loops, "mirrored": mirror,
            "window": list(graft.window) if graft.window else None,
            "beats": graft.beats, "retimed": retimed,
            "folded_digits": graft.fold_digits,
            "whole_body": graft.body,
            "translated_bones": sorted(moving),
        }

    report["grafted"] = grafted
    armature.animation_data.action = None
    bpy.ops.wm.save_as_mainfile(filepath=args.out)
    with open(args.report, "w", encoding="utf8") as handle:
        json.dump(report, handle, indent=2, sort_keys=True)
    for name, info in grafted.items():
        if info["source"] is None:
            print(f"[graft] {name} retimed only ({info['retimed']})")
            continue
        print(f"[graft] {name} <- {info['source']} "
              f"({info['frames']} frames, {info['channels_replaced']} channels replaced, "
              f"{info['beats']} beat(s), window {info['window']})")


main()
