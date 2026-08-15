"""Bake the grounded gothic wing fold pose from the rebuilt rig.

    pnpm assets:gothic-fold

Emits `src/render/wingFoldPose.ts`.

Source is v1's own grounded stance, which survives in the rebuilt blend as the
`v1_*` capture actions keyed on the `WingD*` digits. Nothing is invented here:
the frame chosen is the one where the wing is most closed, measured, not picked.

Why this replaces the previous bake
-----------------------------------
The old table was generated against the batten rig the rebuild replaced, and
it was not mirrored. `L_WingD0P0` held a 161-degree rotation where
`R_WingD0P0` held 63, and `L_WingD4P0` held 179 against the right's 31. Applied
at full weight on a rig where both sides resolve, that folds one wing shut and
leaves the other open -- the crumpled wing mass the lab showed.

Its generation note explains why it came out that way: the mirror was done in
world space and re-solved by FK, because "quaternion component flips were tried
first and none of them worked". They did not work because the *rig* was not
mirrored -- the old battens aimed across the body and left and right carried
different names and different rests. On the rebuilt rig the rests mirror to
exactly 0.0, so the plain component flip is correct, and the right side is
derived from the left by (x, -y, -z, w) rather than solved separately.

The `WingPanel*` battens are deliberately absent from the table. They carry the
membrane between spars and have no v1 counterpart to take a pose from; leaving
them out means the fold moves the hand and digits and lets the panels follow the
skin, which is what they exist to do.
"""
from __future__ import annotations
import argparse, json, sys
import bpy

STANCE_ACTION = "v1_stand"
# The digits and the hand. The arm chain is left out on purpose: v1's grounded
# stance carries the wing against the body from the hand outward, and folding
# the shoulder as well fights whatever ground clip is playing underneath.
PREFIXES = ("L_WingHand", "L_WingD")


def arguments():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args(argv)


def wingspan(armature) -> float:
    """Tip-to-tip distance across the leading spars, in rig units."""
    left = armature.pose.bones["L_WingD0P2"]
    right = armature.pose.bones["R_WingD0P2"]
    return (
        (armature.matrix_world @ left.tail) - (armature.matrix_world @ right.tail)
    ).length


def main() -> None:
    args = arguments()
    report: dict = {}
    armature = bpy.data.objects["WyvernRig"]
    action = bpy.data.actions.get(STANCE_ACTION)
    if action is None:
        raise SystemExit(f"{STANCE_ACTION} is not in this blend")

    armature.animation_data_create().action = action
    start, end = (int(v) for v in action.frame_range)

    # Rest span, for the comparison the fold is judged on.
    bpy.context.scene.frame_set(start)
    for bone in armature.pose.bones:
        bone.rotation_quaternion = (1.0, 0.0, 0.0, 0.0)
    bpy.context.view_layer.update()
    rest_span = wingspan(armature)

    # The most-closed frame, measured rather than chosen.
    best_frame, best_span = start, None
    for frame in range(start, end + 1):
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        span = wingspan(armature)
        if best_span is None or span < best_span:
            best_frame, best_span = frame, span
    report["stance_action"] = STANCE_ACTION
    report["frame_chosen"] = best_frame
    report["rest_span"] = round(rest_span, 1)
    report["folded_span"] = round(best_span, 1)
    report["fold_ratio"] = round(best_span / rest_span, 3)

    bpy.context.scene.frame_set(best_frame)
    bpy.context.view_layer.update()

    pose = {}
    for bone in armature.pose.bones:
        if not bone.name.startswith(PREFIXES):
            continue
        q = bone.rotation_quaternion.normalized()  # Blender order: w, x, y, z
        # three.js order, and the right side is the sagittal mirror of the left.
        pose[bone.name] = (q.x, q.y, q.z, q.w)
        pose["R_" + bone.name[2:]] = (q.x, -q.y, -q.z, q.w)
    report["bones"] = len(pose)

    # Gate: applying the table must close the wing and stay symmetric.
    for bone in armature.pose.bones:
        bone.rotation_quaternion = (1.0, 0.0, 0.0, 0.0)
    for name, (x, y, z, w) in pose.items():
        bone = armature.pose.bones.get(name)
        if bone:
            bone.rotation_mode = "QUATERNION"
            bone.rotation_quaternion = (w, x, y, z)
    bpy.context.view_layer.update()
    applied_span = wingspan(armature)
    report["applied_span"] = round(applied_span, 1)

    left = armature.matrix_world @ armature.pose.bones["L_WingD0P2"].tail
    right = armature.matrix_world @ armature.pose.bones["R_WingD0P2"].tail
    asymmetry = max(abs(left.x + right.x), abs(left.y - right.y), abs(left.z - right.z))
    report["tip_asymmetry"] = round(asymmetry, 4)

    problems = []
    if applied_span >= rest_span * 0.85:
        problems.append(
            f"fold barely closes the wing: {applied_span:.0f} against a rest "
            f"span of {rest_span:.0f}"
        )
    if asymmetry > 1.0:
        problems.append(f"folded wingtips are {asymmetry:.1f} units apart from mirrored")
    # The asymmetry figure above reads identically whether the wings are tucked
    # or folded straight through each other and out the far side, so the side of
    # the body each tip ends on is checked separately.
    report["folded_tip_x"] = [round(left.x, 1), round(right.x, 1)]
    if left.x <= 0 or right.x >= 0:
        problems.append(
            f"folded wingtips cross the body: left at x={left.x:.0f}, "
            f"right at x={right.x:.0f}"
        )
    report["problems"] = problems

    lines = [
        "/**",
        " * The grounded \"gothic\" wing pose, as per-bone LOCAL rotations.",
        " *",
        " * GENERATED by scripts/bake-gothic-fold-blender.py. Do not hand-edit;",
        " * re-run `pnpm assets:gothic-fold` instead.",
        " *",
        f" * Source: the `{STANCE_ACTION}` capture on the rebuilt rig, frame "
        f"{best_frame} -- the",
        " * most-closed frame of v1's own grounded stance, found by measuring the",
        f" * span on every frame rather than by picking one. It closes the wing from",
        f" * {rest_span:.0f} rig units to {best_span:.0f}.",
        " *",
        " * Quaternions are in three.js order (x, y, z, w); Blender emits",
        " * (w, x, y, z) and these were converted at generation time.",
        " *",
        " * The right side is the left mirrored by (x, -y, -z, w). That plain",
        " * component flip is correct here and was not on the rig this replaces:",
        " * the rebuilt wing's left and right rests mirror to exactly 0.0, so the",
        " * sagittal reflection is a pure sign change. Folded wingtips land",
        f" * {asymmetry:.4f} units from mirrored.",
        " *",
        " * The hand and digits only. The arm chain is excluded so the fold does",
        " * not fight the ground clip's own shoulder, and the `WingPanel*` battens",
        " * are excluded so the membrane follows the spars rather than being posed.",
        " *",
        " * These are absolute local rotations, not offsets: the runtime slerps",
        " * from the clip's own wing rotation toward these, so weight 0 leaves the",
        " * authored clip untouched.",
        " */",
        "export const GOTHIC_WING_POSE: Record<string, [number, number, number, number]> = {",
    ]
    for name in sorted(pose):
        x, y, z, w = pose[name]
        lines.append(f"  {name}: [{x:.9f}, {y:.9f}, {z:.9f}, {w:.9f}],")
    lines.append("}")
    with open(args.out, "w", encoding="utf8") as handle:
        handle.write("\n".join(lines) + "\n")
    with open(args.report, "w", encoding="utf8") as handle:
        json.dump(report, handle, indent=2, sort_keys=True)

    for key in ("frame_chosen", "rest_span", "folded_span", "applied_span",
                "tip_asymmetry", "folded_tip_x", "bones"):
        print(f"[fold] {key}: {report[key]}")
    for problem in problems:
        print(f"[fold] PROBLEM {problem}")
    if problems:
        raise SystemExit(1)
    print(f"[fold] wrote {args.out}")


main()
