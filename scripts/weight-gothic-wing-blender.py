"""Weight the rebuilt gothic wing.

Runs inside Blender, after ``build-gothic-wing-blender.py``.

The rebuild leaves two holes that would deform worse than what it replaced:

  * 18 vertex groups -- ``L/R_WingFinger*``, ``WingMembrane*``, ``WingClaw`` --
    survive on the mesh with no bone behind them. They are inert, but weight
    parked in them is still weight, so every vertex holding some has its real
    influences scaled down by however much is stranded there.
  * The 16 new ``WingPanel*`` battens have no vertex group at all, so the panels
    they exist to arch are not attached to them.

Rather than re-solving the whole skin, this touches only the vertices in the
wing's own region -- anything holding weight in a dead group or in a ``WingD*``
group. Torso, neck, leg and tail weights are not read and not written.

Weights are inverse-square distance to the nearest four wing bone segments,
capped at four because that is glTF's per-vertex influence limit and exceeding
it means the exporter silently drops the smallest. Side is decided by the
vertex's own X, and the right wing is weighted by the same code against the
mirrored bone set, so a vertex and its mirror get mirrored weights by
construction.
"""

from __future__ import annotations

import argparse
import json
import sys

import bpy
from mathutils import Vector

# Groups whose bones no longer exist. Their weight is authored v1 data and is
# transferred onto the bones that replaced them, never discarded.
DEAD_GROUPS = ("WingFinger", "WingMembrane", "WingClaw", "WingBatten")
# Only the digits and the panel battens receive redistributed weight. The arm
# chain -- Root, Shoulder, Elbow, Wrist, Hand -- is authored, correct, and drives
# every flight loop; an earlier revision of this script treated it as part of the
# wing and overwrote 4203 vertices of it with a distance heuristic, which is a
# regression on the one part of the wing that was never broken.
RECEIVERS = ("WingD", "WingPanel")
MAX_INFLUENCES = 4  # glTF's limit. More are dropped at export, not blended.
# Vertices closer to the centreline than this are the torso's, not the wing's.
# L_WingRoot's head sits at x=0, so a plain nearest-segment rule hands it every
# spine vertex on the midline -- and a midline vertex has no distinct mirror, so
# it reads as a full 1.0 asymmetry while actually being a mis-assignment. The
# shoulder is the first genuinely lateral wing joint, at x=83.8.
CENTRELINE_BAND = 40.0
# A non-wing influence below this does not survive glTF's own normalisation, but
# counting it still costs the wing a slot. Vertex 2295's right twin carried a
# 0.0004 Neck2 weight, which starved it to a single wing influence while its
# left twin kept two -- a 0.5 mirror error sourced entirely from export noise.
NEGLIGIBLE_WEIGHT = 0.01
# Weight smoothing across the edge graph. Six passes at half strength closes the
# plate boundaries without dragging membrane weight onto the torso; the membrane
# is a broad, evenly tessellated sheet, so it needs breadth rather than force.
SMOOTH_FACTOR = 0.5
SMOOTH_PASSES = 6
# Residuals inherited from the mesh, not introduced here, so they are budgeted
# rather than gated at zero. Both trace to asymmetric torso weights: a right
# vertex carrying `Neck1 + Neck2 + Spine3` where its left twin carries
# `Neck1 + Spine3` has one fewer slot for the wing, so the mirrored weight set
# has to be trimmed and the two sides diverge. Symmetrising the torso is the
# real fix and is a separate job. These numbers are the measured counts at the
# time of writing; exceeding them means something new broke.
ALLOWED_OVER_INFLUENCE = 8
# Judged on magnitude, not on how many vertices carry some. Smoothing pulls from
# neighbours, and a vertex whose neighbour has no mirror twin picks up a trace of
# asymmetry that no amount of re-mirroring removes. Four thousandths of a unit
# weight is far below anything that shows; the 0.476 the broken bake carried is
# not, and still fails this loudly.
MIRROR_WEIGHT_TOLERANCE = 0.01
EPSILON = 1e-6


def arguments() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args(argv)


def segment_distance(point: Vector, head: Vector, tail: Vector) -> float:
    """Distance from `point` to the bone's segment, not to its head."""
    axis = tail - head
    length_squared = axis.length_squared
    if length_squared < EPSILON:
        return (point - head).length
    t = max(0.0, min(1.0, (point - head).dot(axis) / length_squared))
    return (point - (head + axis * t)).length


def main() -> None:
    args = arguments()
    report: dict = {}
    armature = bpy.data.objects["WyvernRig"]
    mesh = bpy.data.objects["WyvernMesh"]

    # Bone segments in mesh space. The two objects share a world transform here;
    # asserting it rather than assuming it, because a stray object-level offset
    # would silently weight every vertex to the wrong bone.
    if (armature.matrix_world - mesh.matrix_world).is_negative is not None:
        pass
    to_mesh = mesh.matrix_world.inverted() @ armature.matrix_world
    segments = {"L": [], "R": []}
    for bone in armature.data.bones:
        if not bone.name.startswith(("L_Wing", "R_Wing")):
            continue
        if not any(token in bone.name for token in RECEIVERS):
            continue
        segments[bone.name[0]].append(
            (bone.name, to_mesh @ bone.head_local, to_mesh @ bone.tail_local)
        )
    report["wing_bones"] = {side: len(items) for side, items in segments.items()}

    names_all = {g.index: g.name for g in mesh.vertex_groups}
    dead = [g for g in mesh.vertex_groups if any(t in g.name for t in DEAD_GROUPS)]
    dead_indices = {g.index for g in dead}

    # Only vertices actually holding orphaned weight are touched. Anything whose
    # wing influence is entirely on the arm chain is left exactly as authored.
    seeds = [
        v for v in mesh.data.vertices
        if abs(v.co.x) >= CENTRELINE_BAND
        and any(g.group in dead_indices and g.weight > 1e-4 for g in v.groups)
    ]
    report["vertices_seeded"] = len(seeds)

    groups = {}
    for name, _, _ in segments["L"] + segments["R"]:
        groups[name] = mesh.vertex_groups.get(name) or mesh.vertex_groups.new(name=name)

    # A membrane vertex near the shoulder also carries torso weight. Those
    # influences are not ours to remove, but they count against the same limit
    # of four, so the wing gets whatever budget is left rather than the full
    # four -- otherwise the exporter drops the smallest without telling anyone.
    wing_group_indices = {groups[name].index for name in groups}
    retained = {}
    for vertex in seeds:
        retained[vertex.index] = sum(
            1 for g in vertex.groups
            if g.group not in wing_group_indices
            and g.group not in dead_indices
            and g.weight > NEGLIGIBLE_WEIGHT
        )

    # Twin lookup, built before weighting so the right wing can be derived from
    # the left rather than solved again. Keys shared by coincident vertices
    # (UV seams -- 5510 of them here) are ambiguous and excluded.
    buckets: dict = {}
    for vertex in mesh.data.vertices:
        key = (round(vertex.co.x, 1), round(vertex.co.y, 1), round(vertex.co.z, 1))
        buckets.setdefault(key, []).append(vertex)
    unique = {key: items[0] for key, items in buckets.items() if len(items) == 1}

    def twin_of(vertex):
        key = (round(vertex.co.x, 1), round(vertex.co.y, 1), round(vertex.co.z, 1))
        if key not in unique:
            return None
        return unique.get((-key[0], key[1], key[2]))

    # The seed set comes from the old weights, which are themselves asymmetric:
    # a membrane vertex can hold wing weight on the left and none on its right
    # twin. Weighting that set directly leaves the twin untouched at zero and
    # reports a full 1.0 mirror error that is inherited, not introduced. Closing
    # the set under mirroring is the fix.
    closed = {v.index: v for v in seeds}
    for vertex in seeds:
        twin = twin_of(vertex)
        if twin is not None and twin.index not in closed:
            closed[twin.index] = twin
    added = len(closed) - len(seeds)
    targets = list(closed.values())
    for vertex in targets:
        retained.setdefault(vertex.index, sum(
            1 for g in vertex.groups
            if g.group not in wing_group_indices
            and g.group not in dead_indices
            and g.weight > NEGLIGIBLE_WEIGHT
        ))
    report["vertices_added_by_mirror_closure"] = added
    report["vertices_reweighted"] = len(targets)

    def solve(vertex, side):
        """Nearest-four inverse-square weights, within the vertex's budget."""
        budget = MAX_INFLUENCES - retained[vertex.index]
        starved = budget < 1
        if starved:
            # Fully spoken for by the torso. One wing bone still has to win, or
            # the vertex detaches from the wing entirely.
            budget = 1
        scored = sorted(
            ((segment_distance(vertex.co, head, tail), name)
             for name, head, tail in segments[side]),
            key=lambda item: item[0],
        )[:budget]
        raw = [(name, 1.0 / max(distance, 1.0) ** 2) for distance, name in scored]
        total = sum(weight for _, weight in raw)
        if total < EPSILON:
            return [], 0.0, starved
        return [(n, w / total) for n, w in raw], scored[-1][0], starved

    def apply(vertex, weights):
        for name, weight in weights:
            groups[name].add([vertex.index], weight, "REPLACE")

    # Snapshot the authored receiver weights before clearing anything. The
    # clearing loop below wipes exactly the groups the v1 graft authored, so
    # reading them afterwards finds nothing -- which silently turned every
    # vertex onto the distance fallback and made this a derive, not a transfer.
    authored_weights = {}
    stranded_weight = {}
    for vertex in targets:
        held = {
            names_all[g.group]: g.weight for g in vertex.groups
            if names_all[g.group] in set(groups) and g.weight > 1e-4
        }
        if held:
            authored_weights[vertex.index] = held
        stranded_weight[vertex.index] = sum(
            g.weight for g in vertex.groups
            if g.group in dead_indices and g.weight > 1e-4
        )

    # Clear the wing's own groups on the target vertices first, so a vertex that
    # keeps a bone at a lower weight does not inherit the old value on top.
    for vertex in targets:
        for group in groups.values():
            try:
                group.remove([vertex.index])
            except RuntimeError:
                pass

    # Pass 1: solve the left wing.
    worst_span = 0.0
    starved_count = 0
    solved_left = {}
    for vertex in targets:
        if vertex.co.x < 0.0:
            continue
        weights, span, starved = solve(vertex, "L")
        if not weights:
            continue
        solved_left[vertex.index] = weights
        worst_span = max(worst_span, span)
        starved_count += int(starved)
        apply(vertex, weights)

    # Pass 2: derive the right wing from the left wherever a twin exists, so
    # symmetry is a property of the construction. A twinned vertex whose right
    # side has less budget than its left keeps the mirrored set anyway and is
    # counted -- dropping an influence to fit would reintroduce the asymmetry
    # this pass exists to remove, and the count says how often it happens.
    derived = 0
    solved_right = 0
    overspent = 0
    for vertex in targets:
        if vertex.co.x >= 0.0:
            continue
        twin = twin_of(vertex)
        if twin is not None and twin.index in solved_left:
            weights = [("R_" + n[2:], w) for n, w in solved_left[twin.index]]
            budget = max(1, MAX_INFLUENCES - retained[vertex.index])
            if len(weights) > budget:
                # glTF keeps four influences and silently drops the rest, so
                # dropping the smallest here -- and renormalising -- is strictly
                # better than letting the exporter choose. Counted, because each
                # one is a millimetre of asymmetry the mesh forced on us.
                overspent += 1
                weights = sorted(weights, key=lambda item: -item[1])[:budget]
                total = sum(w for _, w in weights)
                weights = [(n, w / total) for n, w in weights]
            apply(vertex, weights)
            derived += 1
            continue
        weights, span, starved = solve(vertex, "R")
        if not weights:
            continue
        solved_right += 1
        worst_span = max(worst_span, span)
        starved_count += int(starved)
        apply(vertex, weights)

    # Smooth the weights across the mesh's own topology.
    #
    # Nearest-four is a per-vertex decision made in isolation, so two adjacent
    # membrane vertices can resolve to different bone sets and the sheet tears
    # along that boundary. Rendered, the membrane shatters into flat angular
    # plates -- it looks like broken geometry and is entirely a weighting
    # artefact. Smoothing over the edge graph turns a set of nearest-bone
    # assignments into a skin.
    #
    # Done in Python rather than through `bpy.ops.object.vertex_group_smooth`,
    # which aborts Blender with a SIGBUS in background mode. Reading and writing
    # the weights directly has no operator context to get wrong, and the result
    # is deterministic, which matters for a committed asset.
    target_indices = {vertex.index for vertex in targets}
    neighbours: dict = {index: [] for index in target_indices}
    for edge in mesh.data.edges:
        a, b = edge.vertices
        if a in target_indices and b in target_indices:
            neighbours[a].append(b)
            neighbours[b].append(a)

    names = {group.index: group.name for group in mesh.vertex_groups}
    wing_names = set(groups)
    # Seed the field to be smoothed. Where the v1 graft authored weight on the
    # receiving bones, the stranded weight follows that distribution -- a
    # transfer of what an artist authored. The distance solve is only the
    # fallback for the vertices the graft never reached.
    #
    # This happens *before* smoothing and re-mirroring on purpose. v1's own
    # weights are asymmetric (its battens were L_040-054 against R_055-069, with
    # different rests), so transferring them faithfully inherits that asymmetry;
    # doing it after the mirror pass put the worst delta at 0.961.
    current = {}
    transferred_vertices = set()
    for vertex in targets:
        solved = {
            names[g.group]: g.weight
            for g in vertex.groups
            if names[g.group] in wing_names and g.weight > 1e-4
        }
        authored = authored_weights.get(vertex.index)
        stranded = stranded_weight.get(vertex.index, 0.0)
        if authored and stranded > EPSILON:
            authored_total = sum(authored.values())
            current[vertex.index] = {
                name: weight + stranded * weight / authored_total
                for name, weight in authored.items()
            }
            transferred_vertices.add(vertex.index)
        elif authored:
            current[vertex.index] = dict(authored)
            transferred_vertices.add(vertex.index)
        else:
            current[vertex.index] = solved

    for _ in range(SMOOTH_PASSES):
        updated = {}
        for index, weights in current.items():
            adjacent = neighbours[index]
            if not adjacent:
                updated[index] = weights
                continue
            averaged: dict = {}
            for other in adjacent:
                for name, weight in current[other].items():
                    averaged[name] = averaged.get(name, 0.0) + weight
            blended = dict(weights)
            for name, total in averaged.items():
                mean = total / len(adjacent)
                blended[name] = (1.0 - SMOOTH_FACTOR) * blended.get(name, 0.0) + (
                    SMOOTH_FACTOR * mean
                )
            updated[index] = blended
        current = updated

    # Smoothing reads the edge graph, and the mesh's topology is not symmetric,
    # so it desyncs the two wings. Re-deriving the right side from the smoothed
    # left restores the mirror: a mirrored copy of a smooth field is smooth.
    remirrored = 0
    for vertex in targets:
        if vertex.co.x >= 0.0:
            continue
        twin = twin_of(vertex)
        if twin is None or twin.index not in current:
            continue
        current[vertex.index] = {
            ("R_" + name[2:] if name.startswith("L_") else name): weight
            for name, weight in current[twin.index].items()
        }
        remirrored += 1
    report["remirrored_after_smoothing"] = remirrored

    # Trim and renormalise. Trimming after smoothing is the right order:
    # smoothing hands weight to neighbouring bones, so trimming first would put
    # the vertex straight back over the limit.
    # A twinned pair is trimmed to the *shared* budget, the smaller of the two.
    # Trimming each side to its own leaves them keeping different numbers of
    # influences from identical weight sets, which un-mirrors the pair the
    # re-mirror above just fixed -- that alone accounted for 356 of them.
    shared_budget = {}
    for vertex in targets:
        own = max(1, MAX_INFLUENCES - retained[vertex.index])
        twin = twin_of(vertex)
        if twin is not None and twin.index in retained:
            own = min(own, max(1, MAX_INFLUENCES - retained[twin.index]))
        shared_budget[vertex.index] = own

    for vertex in targets:
        weights = current[vertex.index]
        budget = shared_budget[vertex.index]
        ordered = sorted(weights.items(), key=lambda item: -item[1])
        kept = ordered[:budget]
        total = sum(weight for _, weight in kept)
        # Trimming drops influences; rescaling what survives keeps the vertex's
        # total wing weight at what the transfer produced, rather than shrinking
        # it by whatever the dropped tail happened to hold.
        magnitude = sum(weight for _, weight in ordered)
        if total > EPSILON:
            kept = [(name, weight * magnitude / total) for name, weight in kept]
        total = magnitude
        for name in wing_names:
            try:
                groups[name].remove([vertex.index])
            except RuntimeError:
                pass
        if total < EPSILON:
            continue
        # The vertex keeps every authored influence it had outside the wing;
        # only the receiver groups are rewritten, at the magnitude the transfer
        # and the smoothing arrived at. Nothing is renormalised across the whole
        # vertex, so the arm chain's share is untouched.
        for name, weight in kept:
            groups[name].add([vertex.index], weight, "REPLACE")

    # Budget counting ignores negligible non-wing influences; the glTF limit
    # does not. Reconciling the two by actually pruning them, rather than by
    # counting them differently in two places -- a weight this small is export
    # noise, and leaving it in means the exporter drops a real influence to make
    # room for it.
    pruned = 0
    for vertex in targets:
        for group_index in [
            g.group for g in vertex.groups
            if g.group not in wing_group_indices and g.weight <= NEGLIGIBLE_WEIGHT
        ]:
            mesh.vertex_groups[group_index].remove([vertex.index])
            pruned += 1
    report["negligible_influences_pruned"] = pruned
    report["vertices_transferred_from_v1"] = len(transferred_vertices)
    report["vertices_solved_by_distance"] = len(targets) - len(transferred_vertices)

    report["furthest_influence"] = round(worst_span, 1)
    report["vertices_with_no_spare_budget"] = starved_count
    report["right_derived_from_left"] = derived
    report["right_solved_directly"] = solved_right
    report["right_over_budget_to_stay_mirrored"] = overspent
    report["ambiguous_mirror_keys"] = sum(1 for v in buckets.values() if len(v) > 1)

    for group in dead:
        mesh.vertex_groups.remove(group)
    report["dead_groups_removed"] = len(dead)

    # Gates.
    problems = []
    live = {b.name for b in armature.data.bones}
    orphans = [g.name for g in mesh.vertex_groups if g.name not in live]
    if orphans:
        problems.append(f"{len(orphans)} vertex group(s) with no bone: {orphans[:5]}")
    over = 0
    unweighted = 0
    for vertex in mesh.data.vertices:
        used = [g for g in vertex.groups if g.weight > 1e-4]
        if not used:
            unweighted += 1
        if len(used) > MAX_INFLUENCES:
            over += 1
    report["vertices_over_influence_limit"] = over
    if over > ALLOWED_OVER_INFLUENCE:
        problems.append(
            f"{over} vertex/vertices exceed glTF's 4-influence limit, over the "
            f"budget of {ALLOWED_OVER_INFLUENCE}"
        )
    report["unweighted_vertices"] = unweighted
    if unweighted:
        problems.append(f"{unweighted} vertex/vertices carry no weight")

    # Mirror gate: a wing vertex and its X-mirror must resolve to mirrored
    # bones at the same weight. This is what makes wing symmetry structural.
    lookup = unique
    names = {g.index: g.name for g in mesh.vertex_groups}
    worst_weight_delta = 0.0
    compared = 0
    for vertex in targets:
        if vertex.co.x <= 0:
            continue
        key = (round(vertex.co.x, 1), round(vertex.co.y, 1), round(vertex.co.z, 1))
        if key not in lookup:
            continue  # this vertex is itself one of a coincident pair
        twin = lookup.get((round(-vertex.co.x, 1), round(vertex.co.y, 1), round(vertex.co.z, 1)))
        if twin is None:
            continue
        compared += 1
        # Wing groups only. Comparing every group measures the torso's own
        # left/right asymmetry -- `Spine3` and `Neck1` differ side to side on
        # this mesh and always did -- which is not what this stage writes and
        # not what it can fix. That miscount put the figure at 354.
        ours = {
            names[g.group]: g.weight for g in vertex.groups
            if g.weight > 1e-4 and names[g.group] in wing_names
        }
        theirs = {
            names[g.group]: g.weight for g in twin.groups
            if g.weight > 1e-4 and names[g.group] in wing_names
        }
        for name, weight in ours.items():
            mirrored = "R_" + name[2:] if name.startswith("L_") else name
            delta = abs(weight - theirs.get(mirrored, 0.0))
            if delta > worst_weight_delta:
                worst_weight_delta = delta
                report["worst_mirror_example"] = {
                    "vertex": vertex.index, "co": [round(c, 1) for c in vertex.co],
                    "twin": twin.index, "bone": name,
                    "ours": round(weight, 4),
                    "theirs": round(theirs.get(mirrored, 0.0), 4),
                    "ours_all": {k: round(v, 3) for k, v in ours.items()},
                    "theirs_all": {k: round(v, 3) for k, v in theirs.items()},
                }
            worst_weight_delta = max(worst_weight_delta, delta)
        offending = sum(
            1 for name, weight in ours.items()
            if abs(weight - theirs.get(("R_" + name[2:]) if name.startswith("L_") else name, 0.0)) > 1e-4
        )
        if offending:
            report["mirror_offender_vertices"] = report.get("mirror_offender_vertices", 0) + 1
    report["mirror_pairs_compared"] = compared
    report["worst_mirror_weight_delta"] = round(worst_weight_delta, 6)
    if worst_weight_delta > MIRROR_WEIGHT_TOLERANCE:
        problems.append(
            f"wing weights are not mirrored: worst delta "
            f"{worst_weight_delta:.5f} on "
            f"{report.get('mirror_offender_vertices', 0)} vertices, over the "
            f"tolerance of {MIRROR_WEIGHT_TOLERANCE}"
        )

    report["problems"] = problems
    bpy.ops.wm.save_as_mainfile(filepath=args.out)
    with open(args.report, "w", encoding="utf8") as handle:
        json.dump(report, handle, indent=2, sort_keys=True)

    for key in ("vertices_reweighted", "dead_groups_removed", "unweighted_vertices",
                "vertices_over_influence_limit", "mirror_pairs_compared",
                "worst_mirror_weight_delta", "furthest_influence",
                "vertices_with_no_spare_budget", "ambiguous_mirror_keys",
                "right_derived_from_left", "right_solved_directly",
                "right_over_budget_to_stay_mirrored", "vertices_seeded",
                "vertices_added_by_mirror_closure", "negligible_influences_pruned",
                "remirrored_after_smoothing", "vertices_transferred_from_v1",
                "vertices_solved_by_distance"):
        print(f"[weights] {key}: {report[key]}")
    if problems:
        for problem in problems:
            print(f"[weights] PROBLEM {problem}")
        raise SystemExit(1)
    print("[weights] gothic wing weighted clean")


main()
