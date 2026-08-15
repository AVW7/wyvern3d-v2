"""Rebuild the wyvern's wing as one correct, mirrored gothic wing.

Runs inside Blender. Driven by ``scripts/build-gothic-wing.py``.

The input blend carries two disjoint wing rigs. The 16 gameplay clips key
``WingFinger*``/``WingMembrane*``; the 11 ``v1_*`` captures key ``WingD*``/
``WingBatten*``; and 1130 mesh vertices are weighted to both, so half the wing
is always at rest fighting the half that moves. This collapses them to one.

What is kept: the arm chain (Root/Shoulder/Elbow/Wrist/Hand) is already exactly
mirrored and correctly placed, as are every digit phalanx *head*. Those are the
authored data and they are good.

What is rebuilt:

  spars    Every phalanx tail is a ~55-unit stub pointing nowhere while its
           child's head sits ~900 units away, so bone length, direction and roll
           are all meaningless. Each tail is re-aimed at its child's head; the
           terminal phalanx extrapolates along its own segment to the membrane's
           measured leading edge.
  battens  Rebuilt from scratch. The originals aim across the body -- one left
           batten tail lands at x=-203, on the other wing -- and left and right
           carry different numbers (040-054 vs 055-069), so they can never be
           mirrored by name. The replacements are named per panel and per side.
  mirror   The right wing is not authored. It is derived from the left by
           negating X, which makes symmetry structural rather than something a
           test has to catch afterwards.

Axis convention, measured from this rig rather than taken from NEW_RIG_SPEC.md,
which states the opposite and is wrong: -Y is forward (Head y=-547, Tail10
y=+2930), +Z is up, +X is the LEFT wing (L_Foot x=+229).
"""

from __future__ import annotations

import argparse
import json
import math
import sys

import bpy
from mathutils import Vector

# The five spars, leading edge to trailing edge, plus the thumb claw. Ordering
# is by the fan's own geometry (D0's tip is furthest forward at y=-819, D4's
# furthest aft at y=+289), not by the numbers in the names.
SPARS = ["D0", "D1", "D2", "D3", "D4"]
THUMB = "D5"
PHALANGES = ["P0", "P1", "P2"]
# One panel per gap between adjacent spars. The trailing panel (D4 to the body)
# is deliberately absent: it is carried by the torso and leg weights, not by a
# batten, and giving it one would fight them.
PANELS = list(zip(SPARS, SPARS[1:]))
# Battens per panel. Two lets a panel arch -- one control near the spar roots
# and one out toward the tips -- which is the whole point of a gothic wing:
# each panel is its own arch, not a shared sheet.
BATTENS_PER_PANEL = 2
# Fraction of the way across a panel that a batten sits. 0.5 is the midline.
BATTEN_SPAN = 0.5
# Where along the spar each batten's root and tip sit, as a fraction of spar
# length from the knuckle.
BATTEN_STATIONS = [(0.30, 0.62), (0.62, 0.96)]

OLD_WING_BONES = ("WingFinger", "WingMembrane", "WingClaw")
JUNK_OBJECTS = ("Icosphere", "_WingDiagnosisCamera", "_WingRenderCam")


def log(message: str) -> None:
    print(f"[gothic] {message}")


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser.add_argument("--out", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args(argv)


def edit_bones(armature):
    return armature.data.edit_bones


def spar_chain(bones, side: str, digit: str) -> list:
    return [bones.get(f"{side}_Wing{digit}{p}") for p in PHALANGES]


def repair_spars(bones, side: str, report: dict) -> None:
    """Aim every phalanx tail at its child's head; extrapolate the tip."""
    for digit in SPARS + [THUMB]:
        chain = spar_chain(bones, side, digit)
        if any(bone is None for bone in chain):
            raise SystemExit(f"missing phalanx in {side}_Wing{digit}")
        for index in range(len(chain) - 1):
            chain[index].tail = chain[index + 1].head
        # The terminal phalanx has no child to aim at. Continue along the
        # segment it makes with its parent, at that segment's own length, which
        # lands the leading spar at x~3150 against a membrane measured to 3136.
        last, previous = chain[-1], chain[-2]
        direction = (last.head - previous.head)
        if direction.length < 1e-6:
            raise SystemExit(f"degenerate terminal phalanx {last.name}")
        last.tail = last.head + direction
        report.setdefault("spar_length", {})[f"{side}_{digit}"] = round(
            sum((b.tail - b.head).length for b in chain), 1
        )


def spar_point(bones, side: str, digit: str, t: float) -> Vector:
    """A point a fraction `t` along a spar, measured from the knuckle."""
    chain = spar_chain(bones, side, digit)
    points = [chain[0].head] + [bone.tail for bone in chain]
    lengths = [(points[i + 1] - points[i]).length for i in range(len(points) - 1)]
    total = sum(lengths)
    target = max(0.0, min(1.0, t)) * total
    for index, length in enumerate(lengths):
        if target <= length or index == len(lengths) - 1:
            share = target / length if length > 1e-9 else 0.0
            return points[index].lerp(points[index + 1], min(1.0, share))
        target -= length
    return points[-1]


def build_battens(bones, side: str, report: dict) -> list[str]:
    """One batten chain per inter-spar panel, spanning the membrane.

    A batten runs from a station on the leading spar to a station further out,
    displaced toward the trailing spar. Parenting to the leading spar and not to
    the hand is what makes the panel follow its own arch when the digit sweeps.
    """
    created = []
    for panel_index, (leading, trailing) in enumerate(PANELS):
        parent_name = None
        for batten_index in range(BATTENS_PER_PANEL):
            root_t, tip_t = BATTEN_STATIONS[batten_index]
            root = spar_point(bones, side, leading, root_t).lerp(
                spar_point(bones, side, trailing, root_t), BATTEN_SPAN
            )
            tip = spar_point(bones, side, leading, tip_t).lerp(
                spar_point(bones, side, trailing, tip_t), BATTEN_SPAN
            )
            if (tip - root).length < 1e-6:
                raise SystemExit(f"degenerate batten on panel {panel_index} {side}")
            name = f"{side}_WingPanel{panel_index}_{batten_index}"
            bone = bones.new(name)
            bone.head = root
            bone.tail = tip
            bone.parent = bones.get(parent_name) if parent_name else bones.get(
                f"{side}_Wing{leading}P0"
            )
            bone.use_connect = False
            parent_name = name
            created.append(name)
    report.setdefault("battens", {})[side] = created
    return created


def mirror_left_to_right(bones, report: dict) -> None:
    """Derive every right wing bone from its left twin by negating X.

    Symmetry becomes a property of how the rig is built rather than a threshold
    a validator has to police after the fact -- which is the failure mode this
    project has hit repeatedly (37.7 degrees of stroke asymmetry shipped once).
    """
    mirrored = 0
    for bone in list(bones):
        if not bone.name.startswith("L_Wing"):
            continue
        twin = bones.get("R_" + bone.name[2:])
        if twin is None:
            twin = bones.new("R_" + bone.name[2:])
        twin.head = Vector((-bone.head.x, bone.head.y, bone.head.z))
        twin.tail = Vector((-bone.tail.x, bone.tail.y, bone.tail.z))
        twin.roll = -bone.roll
        twin.use_connect = False
        mirrored += 1
    # Parenting is done in a second pass: a twin's parent may not have existed
    # during the first.
    for bone in list(bones):
        if not bone.name.startswith("L_Wing"):
            continue
        twin = bones.get("R_" + bone.name[2:])
        if bone.parent is None:
            twin.parent = None
        elif bone.parent.name.startswith("L_Wing"):
            twin.parent = bones.get("R_" + bone.parent.name[2:])
        else:
            twin.parent = bones.get(bone.parent.name)  # Spine3, shared
    report["mirrored_bones"] = mirrored


def drop_old_wing(armature, mesh, report: dict) -> None:
    """Delete the superseded wing bones and their vertex groups."""
    bpy.ops.object.mode_set(mode="EDIT")
    bones = edit_bones(armature)
    removed = []
    for bone in list(bones):
        if any(token in bone.name for token in OLD_WING_BONES):
            removed.append(bone.name)
            bones.remove(bone)
    # Stale battens: every name from the broken generation.
    for bone in list(bones):
        if "WingBatten" in bone.name:
            removed.append(bone.name)
            bones.remove(bone)
    report["removed_bones"] = sorted(removed)
    report["removed_bone_count"] = len(removed)
    bpy.ops.object.mode_set(mode="OBJECT")
    # The batten bones go, but their vertex groups stay for now: they hold 484
    # units of authored v1 weight across 1127 vertices, and the weighting stage
    # transfers that onto the panel bones that replace them. Deleting the groups
    # here would throw that weight away and leave the membrane to be guessed at.
    report["removed_vertex_groups"] = 0


def verify(armature, report: dict) -> list[str]:
    """Numeric gates. These are the point of the rebuild, not a formality."""
    problems = []
    bones = armature.data.bones
    worst_mirror = 0.0
    worst_name = None
    for bone in bones:
        if not bone.name.startswith("L_Wing"):
            continue
        twin = bones.get("R_" + bone.name[2:])
        if twin is None:
            problems.append(f"{bone.name} has no right-side twin")
            continue
        for ours, theirs in ((bone.head_local, twin.head_local),
                             (bone.tail_local, twin.tail_local)):
            delta = max(
                abs(ours.x + theirs.x), abs(ours.y - theirs.y), abs(ours.z - theirs.z)
            )
            if delta > worst_mirror:
                worst_mirror, worst_name = delta, bone.name
    report["worst_mirror_delta"] = round(worst_mirror, 6)
    report["worst_mirror_bone"] = worst_name
    if worst_mirror > 1e-3:
        problems.append(
            f"wings are not mirrored: {worst_name} is off by {worst_mirror:.4f}"
        )
    stubs = [
        b.name for b in bones
        if b.name.startswith(("L_Wing", "R_Wing")) and b.length < 20.0
    ]
    report["stub_bones"] = stubs
    if stubs:
        problems.append(f"{len(stubs)} wing bone(s) shorter than 20 units: {stubs[:5]}")
    strays = [
        b.name for b in bones
        if b.name.startswith("L_Wing") and b.tail_local.x < -1.0
    ] + [
        b.name for b in bones
        if b.name.startswith("R_Wing") and b.tail_local.x > 1.0
    ]
    report["cross_body_bones"] = strays
    if strays:
        problems.append(f"{len(strays)} wing bone(s) point across the body: {strays[:5]}")
    return problems


def main() -> None:
    args = arguments()
    report: dict = {}

    for name in JUNK_OBJECTS:
        obj = bpy.data.objects.get(name)
        if obj:
            bpy.data.objects.remove(obj, do_unlink=True)

    armature = bpy.data.objects["WyvernRig"]
    mesh = bpy.data.objects["WyvernMesh"]
    report["bones_before"] = len(armature.data.bones)

    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode="EDIT")
    bones = edit_bones(armature)

    repair_spars(bones, "L", report)
    build_battens(bones, "L", report)
    mirror_left_to_right(bones, report)

    bpy.ops.object.mode_set(mode="OBJECT")
    drop_old_wing(armature, mesh, report)

    report["bones_after"] = len(armature.data.bones)
    problems = verify(armature, report)
    report["problems"] = problems

    bpy.ops.wm.save_as_mainfile(filepath=args.out)
    with open(args.report, "w", encoding="utf8") as handle:
        json.dump(report, handle, indent=2, sort_keys=True)

    log(f"bones {report['bones_before']} -> {report['bones_after']}")
    log(f"worst mirror delta {report['worst_mirror_delta']}")
    if problems:
        for problem in problems:
            log(f"PROBLEM {problem}")
        raise SystemExit(1)
    log("gothic wing rebuilt clean")


main()
