"""Audit and repair the authored wyvern clips, inside Blender.

`scripts/audit-wyvern-clips.py` drives this. It reports on every action in
`public/models/wyvern-rig.blend`, and with `--fix` applies three repairs that
were each diagnosed by measurement rather than by eye:

 1. left/right wing mirroring   (7 clips)
 2. loop seams that do not close (3 clips)
 3. clips whose first key sits at frame 1 rather than 0 (15 clips)

Axis conventions are MEASURED, not assumed
------------------------------------------
Same probe as `author-wyvern-idle-blender.py`, and the reason this bug exists:

    Wing shoulder/elbow/wrist   local +X raises BOTH wings   (symmetric)
                                local +Z sweeps them APART   (antisymmetric)

So a mirrored pose shares `X` across the two sides and must NEGATE `Z`. Seven
clips gave both wings the same `Z`, which folds one wing forward across the
chest and the other back. `rest` was the worst at 116.8 degrees apart.

Which side survives the repair
------------------------------
Negating either side zeroes the asymmetry, but the two choices keep opposite
poses, so the choice is not arbitrary. It was made by building both variants and
measuring the resulting sweep in the body's own frame, against two references
measured on clips that are already correct:

    idle    +37.3 .. +38.5 deg   a folded wing, swept back toward the tail
    cruise  -11.6 .. -11.1 deg   an extended wing at the neutral Z of zero

A grounded clip has to settle near idle, because that is what it blends to. The
losing variant in every case put both wings 40-70 degrees FORWARD across the
chest. `MIRROR_SOURCE` records the winner and the number that chose it.
"""

from __future__ import annotations

import argparse
import json
import math
import sys

import bpy

ARMATURE = "WyvernRig"
FIT = 0.0072  # metres per rig unit; WYVERN_FIT in src/render/assets/manifest.ts

# Wing channels are mirrored on Z and shared on X. Index into rotation_euler.
ANTISYMMETRIC = 2  # Z
SYMMETRIC = 0      # X

# The side whose curve is authoritative; the other side is rebuilt as its exact
# negation. Each entry records the measured sweep of the winner and the loser,
# in the body's own frame, in degrees. Positive is swept back toward the tail.
MIRROR_SOURCE = {
    # settles to +19.1 back into idle; keeping L settled at -41.3, a 79 deg pop
    "attack": "R",
    # holds -1.2, just back of the -11.3 neutral; keeping R held -21.3, forward
    "breath": "L",
    # opens at +49.7 near idle's +38; keeping R opened at -71.1
    "death": "L",
    # brakes forward then ends +19.1 back into idle; keeping L ended -41.3
    "land": "R",
    # +47.7, a tight fold; keeping L gave -69.2, both wings across the chest
    "rest": "R",
    # opens and closes +29.3 near idle's +38; keeping R opened at -51.3
    "takeoff": "L",
    # +19.1 back, matching rest's fold; keeping L gave -41.3, forward
    "walk": "R",
}

# Loop seams. Every one of these is a single stray key on the body bob: the
# clip's other channels all close on their own, and in each case one endpoint is
# an obvious outlier against the clip's own pattern. `first` moves the first key
# onto the last's value, `last` moves the last onto the first's.
#
#   walk   Body.loc.Z  1:+1.029 9:+0.025 18:+0.050 27:+0.076 36:+0.101
#          Frames 9..36 are a clean ramp; frame 1 is 40x the next key and is
#          verbatim idle's unrelated first Body.loc.Y value. Drop the outlier.
#   rest   Body.loc.Z  1:+0.419 30:+8 60:0 90:-8 120:0
#          A textbook 0,+8,0,-8,0 bob with a stray first key. Drop the outlier.
#   speed  Body.loc.Z  1:+2.524 9:+1.236 18:-2.253 27:+2.869 36:-2.975
#          No cycle structure at either end, so neither endpoint is the outlier.
#          Close it the way the idle generator does, last key onto the first.
SEAM_FIXES = {
    "walk": [("Body", "location", 2, "first")],
    "rest": [("Body", "location", 2, "first")],
    "speed": [("Body", "location", 2, "last")],
}

# What the manifest plays on a loop. A looping clip's last frame must reproduce
# its first; docs/WYVERN_ANIMATIONS.md calls a clip loopable under 0.05.
#
# Exempt, all one-shots: `land`, `takeoff` and `death` end somewhere other than
# they started by design, and `attack`/`breath` are the action-channel tells,
# which have to be one-shots so GameModel can report them finished. `breath`
# happens to close cleanly anyway; `attack` does not, and does not need to.
LOOPING = {
    "idle", "walk", "rest", "cruise", "scout",
    "bankLeft", "bankRight", "hover", "glide", "dive", "speed",
}
SEAM_THRESHOLD = 0.05

# Deliberately asymmetric: a bank beats the outboard wing deeper than the
# inboard one. Verified rather than repaired — the two clips are exact L/R
# swaps of each other, key for key, and they carry no Z at all.
ASYMMETRIC_BY_DESIGN = {"bankLeft", "bankRight", "walk"}


def armature() -> bpy.types.Object:
    obj = bpy.data.objects.get(ARMATURE)
    if obj is None or obj.type != "ARMATURE":
        raise SystemExit(f"armature {ARMATURE!r} not found")
    return obj


def fcurves(action):
    for layer in action.layers:
        for strip in layer.strips:
            if strip.type != "KEYFRAME":
                continue
            for bag in strip.channelbags:
                for fcurve in bag.fcurves:
                    yield fcurve


def bone_of(fcurve) -> str | None:
    return fcurve.data_path.split('"')[1] if '"' in fcurve.data_path else None


def wing_curves(action, index: int) -> dict[str, object]:
    out = {}
    for fcurve in fcurves(action):
        bone = bone_of(fcurve)
        if bone is None or "Wing" not in bone:
            continue
        if "rotation_euler" in fcurve.data_path and fcurve.array_index == index:
            out[bone] = fcurve
    return out


def reset_pose(arm) -> None:
    """Zero every pose bone.

    Most clips key only 2-8 of the 56 bones, so without this an unkeyed bone
    silently carries the previously evaluated action's pose into the next
    measurement. It is what made a first pass report a residual asymmetry on
    clips whose wings were already exactly mirrored.
    """
    for pose_bone in arm.pose.bones:
        pose_bone.location = (0.0, 0.0, 0.0)
        pose_bone.rotation_euler = (0.0, 0.0, 0.0)
        pose_bone.rotation_quaternion = (1.0, 0.0, 0.0, 0.0)
        pose_bone.scale = (1.0, 1.0, 1.0)


def bind(arm, action) -> tuple[int, int]:
    reset_pose(arm)
    if arm.animation_data is None:
        arm.animation_data_create()
    arm.animation_data.action = action
    if action.slots:
        arm.animation_data.action_slot = action.slots[0]
    return int(action.frame_range[0]), int(action.frame_range[1])


def mirror_residual(arm, action) -> float:
    """Worst left-vs-right wingtip mismatch over the clip, in displayed metres.

    Measured in the Body bone's own frame, not the world: `death` rolls
    RootMotion 90/45/30 degrees, and a world-space or armature-space comparison
    of a tumbling body reports a 36 m mismatch on a pose that is exactly
    symmetric. In the body frame the same clip measures 0.0013 m.
    """
    first, last = bind(arm, action)
    worst = 0.0
    for frame in range(first, last + 1):
        bpy.context.scene.frame_set(frame)
        pose = arm.evaluated_get(bpy.context.evaluated_depsgraph_get()).pose.bones
        inv = pose["Body"].matrix.inverted()
        left = inv @ pose["L_WingFinger1_end"].tail
        right = inv @ pose["R_WingFinger1_end"].tail
        worst = max(worst, math.dist((-left.x, left.y, left.z), tuple(right)) * FIT)
    return worst


def loop_seam(arm, action) -> float:
    """Max per-channel difference between the first and last frame's pose."""
    first, last = bind(arm, action)
    poses = []
    for frame in (first, last):
        bpy.context.scene.frame_set(frame)
        pose = arm.evaluated_get(bpy.context.evaluated_depsgraph_get()).pose.bones
        poses.append([v for pb in pose for v in (*pb.location, *pb.rotation_euler)])
    return max(abs(a - b) for a, b in zip(*poses))


def pairing(action) -> dict[str, str]:
    """How each wing channel relates across the two sides."""
    out = {}
    for label, index in (("Z", ANTISYMMETRIC), ("X", SYMMETRIC)):
        curves = wing_curves(action, index)
        for bone, fcurve in curves.items():
            if not bone.startswith("L_"):
                continue
            twin = curves.get("R_" + bone[2:])
            if twin is None:
                out[f"{bone}.{label}"] = "R_MISSING"
                continue
            left = [k.co[1] for k in fcurve.keyframe_points]
            right = [k.co[1] for k in twin.keyframe_points]
            times_match = [k.co[0] for k in fcurve.keyframe_points] == [
                k.co[0] for k in twin.keyframe_points
            ]
            if not times_match or len(left) != len(right):
                out[f"{bone}.{label}"] = "KEYTIMES_DIFFER"
            elif max(abs(v) for v in left + right) < 1e-9:
                # Flat zero on both sides is mirrored and symmetric at once, so
                # it is never the defect. Most clips key all three rotation
                # axes and leave two of them at zero.
                out[f"{bone}.{label}"] = "ZERO"
            elif max(abs(a - b) for a, b in zip(left, right)) < 1e-9:
                out[f"{bone}.{label}"] = "IDENTICAL"
            elif max(abs(a + b) for a, b in zip(left, right)) < 1e-9:
                out[f"{bone}.{label}"] = "MIRRORED"
            else:
                out[f"{bone}.{label}"] = "OTHER"
    return out


def apply_mirror(action, source: str) -> list[str]:
    """Rebuild the non-source side's Z curves as the exact negation of source."""
    keep = f"{source}_"
    flip = "R_" if source == "L" else "L_"
    curves = wing_curves(action, ANTISYMMETRIC)
    touched = []
    for bone, fcurve in sorted(curves.items()):
        if not bone.startswith(flip):
            continue
        twin = curves.get(keep + bone[2:])
        if twin is None:
            continue
        while fcurve.keyframe_points:
            fcurve.keyframe_points.remove(fcurve.keyframe_points[0], fast=True)
        fcurve.keyframe_points.add(len(twin.keyframe_points))
        for dst, src in zip(fcurve.keyframe_points, twin.keyframe_points):
            dst.co = (src.co[0], -src.co[1])
            # Negating the value flips the curve vertically: the handles keep
            # their frame and negate their value, and stay on their own side.
            dst.handle_left = (src.handle_left[0], -src.handle_left[1])
            dst.handle_right = (src.handle_right[0], -src.handle_right[1])
            dst.interpolation = src.interpolation
            dst.handle_left_type = src.handle_left_type
            dst.handle_right_type = src.handle_right_type
        fcurve.update()
        touched.append(bone)
    return touched


def apply_seam(action, fixes) -> list[str]:
    touched = []
    for bone, prop, index, endpoint in fixes:
        target = None
        for fcurve in fcurves(action):
            if bone_of(fcurve) == bone and fcurve.data_path.endswith(prop):
                if fcurve.array_index == index:
                    target = fcurve
        if target is None:
            raise SystemExit(f"{action.name}: no {bone}.{prop}[{index}] to close")
        points = sorted(target.keyframe_points, key=lambda k: k.co[0])
        if endpoint == "first":
            moved, value = points[0], points[-1].co[1]
        else:
            moved, value = points[-1], points[0].co[1]
        before = moved.co[1]
        moved.co = (moved.co[0], value)
        moved.handle_left = (moved.handle_left[0], value)
        moved.handle_right = (moved.handle_right[0], value)
        target.update()
        touched.append(f"{bone}.{prop}[{index}] {endpoint} {before:+.4f} -> {value:+.4f}")
    return touched


def shift_to_frame_zero(action) -> float:
    """Move every key so the clip's first lands on frame 0.

    The glTF exporter writes a key's time as frame/fps, so a clip starting at
    frame 1 has no key before t=1/24 and three.js clamps to the first pose for
    that opening frame -- a 42 ms hitch on every loop. Relative timing across
    channels is preserved: the shift is one number for the whole action.
    """
    curves = [fc for fc in fcurves(action) if len(fc.keyframe_points)]
    if not curves:
        return 0.0
    first = min(k.co[0] for fc in curves for k in fc.keyframe_points)
    if first == 0.0:
        return 0.0
    for fcurve in curves:
        for key in fcurve.keyframe_points:
            key.co = (key.co[0] - first, key.co[1])
            key.handle_left = (key.handle_left[0] - first, key.handle_left[1])
            key.handle_right = (key.handle_right[0] - first, key.handle_right[1])
        fcurve.update()
    last = max(k.co[0] for fc in curves for k in fc.keyframe_points)
    action.use_frame_range = True
    action.frame_start, action.frame_end = 0.0, last
    return first


def audit(arm) -> dict:
    report = {}
    for action in sorted(bpy.data.actions, key=lambda a: a.name):
        relations = pairing(action)
        broken = sorted(k for k, v in relations.items() if k.endswith(".Z") and v == "IDENTICAL")
        first = min(
            (k.co[0] for fc in fcurves(action) for k in fc.keyframe_points),
            default=0.0,
        )
        report[action.name] = {
            "first_key_frame": first,
            "wing_pairing": relations,
            "shared_Z_channels": broken,
            "mirror_residual_m": round(mirror_residual(arm, action), 5),
            "loop_seam_max": round(loop_seam(arm, action), 5),
            "loops": action.name in LOOPING,
        }
    return report


def verify(report: dict) -> list[str]:
    problems = []
    for name, entry in sorted(report.items()):
        if entry["shared_Z_channels"] and name not in ASYMMETRIC_BY_DESIGN:
            problems.append(f"{name}: wing Z still shared on {entry['shared_Z_channels']}")
        if name not in ASYMMETRIC_BY_DESIGN and entry["mirror_residual_m"] > 0.25:
            problems.append(
                f"{name}: wings asymmetric by {entry['mirror_residual_m']:.3f} m"
            )
        if entry["loops"] and entry["loop_seam_max"] > SEAM_THRESHOLD:
            problems.append(
                f"{name}: loop seam {entry['loop_seam_max']:.3f} > {SEAM_THRESHOLD}"
            )
        if entry["first_key_frame"] != 0.0:
            problems.append(f"{name}: first key at frame {entry['first_key_frame']:g}, not 0")
    return problems


def sanitize_materials() -> None:
    for mat in bpy.data.materials:
        if hasattr(mat, "blend_method"):
            mat.blend_method = "OPAQUE"
        if hasattr(mat, "shadow_method"):
            mat.shadow_method = "OPAQUE"
        if mat.use_nodes and mat.node_tree:
            for n in mat.node_tree.nodes:
                if n.type == "BSDF_PRINCIPLED":
                    for inp in n.inputs:
                        if inp.name == "Alpha":
                            for link in list(inp.links):
                                mat.node_tree.links.remove(link)
                            inp.default_value = 1.0


def export(path: str) -> None:
    """Write the GLB. Only the wyvern rig and its mesh -- the file also holds the
    old vendor armature and scratch armatures, and exporting those would change
    the joint set the manifest and `rigBones.ts` are written to."""
    sanitize_materials()
    arm = armature()
    reset_pose(arm)
    for obj in bpy.context.scene.objects:
        obj.select_set(obj.name in (ARMATURE, "WyvernMesh"))
    bpy.context.view_layer.objects.active = arm
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_skins=True,
        export_apply=False,
        export_yup=True,
        # Off to match how wyvern.glb was originally written, so an unrelated
        # clip stays byte-identical and the diff stays reviewable.
        export_optimize_animation_size=False,
    )
    print(f"exported {path}")


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--fix", action="store_true", help="apply the repairs")
    parser.add_argument("--save", action="store_true", help="write the .blend back")
    parser.add_argument("--export", default="", metavar="PATH", help="write a GLB")
    parser.add_argument("--out", default="", help="write the audit JSON here")
    args, _ = parser.parse_known_args(argv)

    arm = armature()
    bpy.context.scene.render.fps = 24

    if args.fix:
        for name, source in sorted(MIRROR_SOURCE.items()):
            action = bpy.data.actions.get(name)
            if action is None:
                raise SystemExit(f"action {name!r} not found")
            touched = apply_mirror(action, source)
            print(f"mirrored {name}: kept {source}, rebuilt {', '.join(touched)}")
        for name, fixes in sorted(SEAM_FIXES.items()):
            action = bpy.data.actions.get(name)
            if action is None:
                raise SystemExit(f"action {name!r} not found")
            for note in apply_seam(action, fixes):
                print(f"closed {name}: {note}")
        for action in sorted(bpy.data.actions, key=lambda a: a.name):
            shift = shift_to_frame_zero(action)
            if shift:
                print(f"shifted {action.name}: {shift:+g} frames to start at 0")

    report = audit(arm)
    problems = verify(report)

    if args.out:
        with open(args.out, "w") as handle:
            json.dump(report, handle, indent=2)
    print("<<<REPORT>>>")
    print(json.dumps(report, indent=2))
    print("<<<PROBLEMS>>>")
    print(json.dumps(problems, indent=2))

    if args.fix and problems:
        raise SystemExit(f"{len(problems)} problem(s) remain after repair")

    if args.export:
        export(args.export)
    if args.save:
        bpy.ops.wm.save_mainfile()
        print(f"saved {bpy.data.filepath}")


if __name__ == "__main__":
    main()
