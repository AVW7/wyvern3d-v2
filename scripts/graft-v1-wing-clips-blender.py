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
import bpy

# (target, source, loops, mirror)
#
# `mirror` reflects the left wing onto the right, making the pose symmetric by
# construction. It is off for `walk` alone: the gait alternates its wing-knuckle
# contacts like the vendor's quadrupedal walk, so a symmetric walk is a wrong
# walk -- `validate-wyvern-clips.mjs` holds it to a *minimum* asymmetry of 0.1 m
# for exactly that reason, and mirroring it locked the knuckles together at
# 0.001. The other four are symmetric acts and read as broken without it.
GRAFTS = [
    ("idle", "v1_stand", True, True),
    ("rest", "v1_stand", True, True),
    ("walk", "v1_walk", True, False),
    ("takeoff", "v1_riseUp", False, True),
    ("land", "v1_goDown", False, True),
]


def arguments():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args(argv)


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
    report["wing_bones"] = len(wing)

    grafted = {}
    for target_name, source_name, loops, mirror in GRAFTS:
        target = bpy.data.actions.get(target_name)
        source = bpy.data.actions.get(source_name)
        if target is None or source is None:
            raise SystemExit(f"missing action: {target_name} or {source_name}")

        target_start, target_end = (int(v) for v in target.frame_range)
        source_start, source_end = (int(v) for v in source.frame_range)
        span = target_end - target_start
        if span <= 0:
            raise SystemExit(f"{target_name} has no frame range")

        # Sample the source first, with the target action detached, so nothing
        # reads a pose that is half one clip and half the other.
        armature.animation_data_create().action = source
        samples = []
        for index in range(span + 1):
            # A looping target wraps: its last frame samples the source's first,
            # so the seam closes on exactly the pose it opened with.
            t = (index % span) / span if loops else index / span
            frame = source_start + t * (source_end - source_start)
            bpy.context.scene.frame_set(int(round(frame)))
            bpy.context.view_layer.update()
            # Sampled from the left wing and mirrored onto the right. v1's
            # captures are lopsided performances -- its own rig was asymmetric --
            # and grafted as-authored they put `takeoff` 20.4 m out of mirror
            # against a 0.25 m limit. A grounded stance and a takeoff are
            # symmetric acts, so the reflection is the correct reading, and it
            # makes symmetry structural here exactly as it is in the rig.
            pose = {}
            if not mirror:
                samples.append({
                    name: armature.pose.bones[name].rotation_quaternion.copy()
                    for name in wing
                })
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

        # Drop the target's existing wing channels, then write the sampled ones.
        armature.animation_data.action = target
        bag = channelbag(target)
        removed = 0
        if bag is not None:
            for fcurve in list(bag.fcurves):
                if '"' not in fcurve.data_path:
                    continue
                if fcurve.data_path.split('"')[1] in set(wing):
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
        grafted[target_name] = {
            "source": source_name, "frames": span + 1,
            "channels_replaced": removed, "loops": loops, "mirrored": mirror,
        }

    report["grafted"] = grafted
    armature.animation_data.action = None
    bpy.ops.wm.save_as_mainfile(filepath=args.out)
    with open(args.report, "w", encoding="utf8") as handle:
        json.dump(report, handle, indent=2, sort_keys=True)
    for name, info in grafted.items():
        print(f"[graft] {name} <- {info['source']} "
              f"({info['frames']} frames, {info['channels_replaced']} channels replaced)")


main()
