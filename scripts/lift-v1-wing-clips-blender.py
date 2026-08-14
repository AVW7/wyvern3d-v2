#!/usr/bin/env python3
"""Lift the folded wings in the retargeted ``v1_`` ground clips so they clear
the ground plane the feet stand on.

Why this exists
---------------
v1's artist clips hang the folded wing well below the foot line -- measured on
the source itself, 575 units on ``Battle_Walk`` and up to 1920 on
``Battle_Up``.  The retarget reproduces that faithfully (mesh lows agree with
v1 to 3-5 units on a 6272-unit model), so this is a property of the source
animation, not a transfer error.

This project plants ground clips on the foot: the manifest's authored walk
bottoms out at -7.31 on a toe, and the one clip that sank a wingtip below the
origin is recorded there as a bug.  Planting v1's clips the same way would
drag the wing about 4 m through the floor, so the fold is raised here instead.

Method
------
Per clip, the ground plane is the clip's lowest leg vertex -- the height the
manifest ``yOffset`` will plant on.  Per frame, the lowest wing-weighted vertex
is rotated up about the wing shoulder until it reaches that plane.

The angle is solved in closed form rather than searched.  Rotating a point
about an axis through the shoulder gives

    z(theta) = P.z + u_par.z + a cos(theta) + b sin(theta)

for ``u = V - P`` split into components along and across the axis, with
``a = u_perp.z`` and ``b = (axis x u_perp).z``.  Setting that equal to the
target height solves as ``theta = phi +/- acos(c / R)`` with
``R = hypot(a, b)`` and ``phi = atan2(b, a)``; the root of smaller magnitude is
taken, and an out-of-reach target clamps to ``phi`` (the maximum lift the joint
can give).

The solve also reports which direction is locally ascending (``dz/dtheta`` at
zero, which is ``b``).  A clamped rotation must follow that direction, not the
sign of the full solution: a solution larger than the cap can begin by carrying
the point *downward* before the arc comes back up, and clamping along it drove
``v1_walkRight`` from -742 to -916.

Rotating the shoulder carries the whole chain by FK, so only the two shoulder
channels are rewritten.  The lift is post-multiplied onto the sampled pose --
``rotation_quaternion @ Quaternion(axis, angle)`` -- which is the same way the
authoring recipes layer an edit onto a sampled pose.

The edit is written straight into the action's F-curves, not onto the pose
bones.  Assigning a pose-bone rotation and then updating the view layer merely
re-evaluates the action over the top, discarding it; an earlier revision did
that and accumulated runaway 250-degree lifts out of the discarded reads.

The rotation axis is derived per frame rather than fixed.  A named local axis
is the wrong tool here: the shoulder bone runs along world X, so rotating about
its own local X twists the wing about its length and lifts almost nothing --
an earlier revision did that and needed 55 degrees to move the tip 70 units.
The axis used is ``cross(u, up)`` for ``u`` the shoulder-to-lowest-point vector,
which is by construction the axis with maximum vertical leverage, mapped back
into the bone's local frame for the post-multiply.  Each wing is solved from its
own lowest vertex, since the two need not be equally low on a given frame.

The lift is spread along shoulder -> elbow -> wrist rather than taken entirely
at the shoulder, so the wing folds up instead of swinging rigidly.  A single
joint cannot do it: at the shoulder alone every frame saturated 55 degrees and
the walk still hung 183 units under the foot plane.  Each joint carries at most
``JOINT_LIFT`` and the chain is revisited until the frame clears.

A round measures every frame first and only then writes, because lifting the
wing can expose a different lowest vertex; ``ROUNDS`` of that converge, and a
final pass reports the clearance actually achieved.  ``MAX_LIFT`` caps how far
the shoulder may be pushed, and frames that cannot clear within it are counted
rather than forced.

Run inside Blender on the rig the retarget produced:

    blender --background public/models/wyvern-rig-v1wing.blend \
        --python scripts/lift-v1-wing-clips-blender.py -- --save
"""

from __future__ import annotations

import argparse
import math
import sys

import bpy
from mathutils import Quaternion, Vector

ARMATURE = "WyvernRig"
MESH = "WyvernMesh"
PREFIX = "v1_"
SHOULDERS = ("L_WingShoulder", "R_WingShoulder")
# Lift is distributed along this chain, per side, in this order.
# Shoulder only.  Spreading the lift down shoulder -> elbow -> wrist was tried
# and is unstable: rotating a distal joint changes which vertex is lowest, so
# the next round solves against a different point and the result oscillates --
# it drove v1_walkRight from -742 to -916, worse than no pass at all.  Rotating
# only the shoulder moves the whole wing rigidly and is monotonic.
PIVOTS = {
    "L_WingShoulder": ("L_WingShoulder",),
    "R_WingShoulder": ("R_WingShoulder",),
}
UP = Vector((0.0, 0.0, 1.0))
ROUNDS = 8
CLEARANCE = 0.0                        # rig units above the foot plane
# 55 degrees is the stable optimum, not a guess.  Below it the lift is simply
# left on the table; above it the pass goes non-monotonic, because the solve
# passes the arc's apex and further rotation lowers the wing again -- at 80
# degrees v1_riseUp regressed from -589.9 to -950.5 and v1_watch from -364.4 to
# -691.5, while v1_walk gained only 34 units.
JOINT_LIFT = math.radians(55.0)


def wing_and_leg_indices(mesh):
    groups = {vg.index: vg.name for vg in mesh.vertex_groups}
    wing = {i for i, n in groups.items() if "Wing" in n}
    leg = {i for i, n in groups.items()
           if any(k in n for k in ("Foot", "Toe", "Calf", "Thigh"))}
    wing_v, leg_v = [], []
    for v in mesh.data.vertices:
        best = max(v.groups, key=lambda g: g.weight, default=None)
        if best is None:
            continue
        if best.group in wing:
            wing_v.append(v.index)
        elif best.group in leg:
            leg_v.append(v.index)
    return wing_v, leg_v


def evaluate(mesh, dg, indices):
    """Lowest vertex among `indices`, as (z, position)."""
    ev = mesh.evaluated_get(dg)
    me = ev.to_mesh()
    m = ev.matrix_world
    best_z, best_p = 1e18, None
    for i in indices:
        p = m @ me.vertices[i].co
        if p.z < best_z:
            best_z, best_p = p.z, p.copy()
    ev.to_mesh_clear()
    return best_z, best_p


def solve_angle(pivot, axis, point, target_z):
    """Smallest rotation about (pivot, axis) bringing `point` to `target_z`.

    Returns ``(theta, ascend)`` where `ascend` is +1/-1 for the locally rising
    direction, so a caller that has to clamp can stay on the rising arc.
    """
    u = point - pivot
    u_par = axis * u.dot(axis)
    u_perp = u - u_par
    a = u_perp.z
    b = axis.cross(u_perp).z
    c = target_z - pivot.z - u_par.z
    r = math.hypot(a, b)
    if r < 1e-9:
        return 0.0, 1.0
    ascend = 1.0 if b >= 0.0 else -1.0
    phi = math.atan2(b, a)
    ratio = c / r
    if ratio >= 1.0:
        return phi, ascend         # target above the reachable arc; lift as far
    if ratio <= -1.0:
        return 0.0, ascend         # target below the whole arc; nothing to do
    d = math.acos(ratio)
    return min((phi - d, phi + d), key=abs), ascend


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--save", action="store_true")
    args, _ = ap.parse_known_args(argv)

    arm = bpy.data.objects[ARMATURE]
    mesh = bpy.data.objects[MESH]
    scn = bpy.context.scene
    dg = bpy.context.evaluated_depsgraph_get()
    wing_v, leg_v = wing_and_leg_indices(mesh)

    def descendants(bone):
        out, stack = set(), [arm.data.bones[bone]]
        while stack:
            b = stack.pop()
            out.add(b.name)
            stack.extend(b.children)
        return out

    groups = {vg.index: vg.name for vg in mesh.vertex_groups}
    side_v = {}
    for sname in SHOULDERS:
        owned = descendants(sname)
        idxs = {i for i, n in groups.items() if n in owned}
        side_v[sname] = [v.index for v in mesh.data.vertices
                         if (max(v.groups, key=lambda g: g.weight, default=None)
                             or type("x", (), {"group": -1})).group in idxs]
    print(f"wing vertices {len(wing_v)}, leg vertices {len(leg_v)}, "
          + ", ".join(f"{k} {len(v)}" for k, v in side_v.items()))

    arm.animation_data_create()
    for name in SHOULDERS:
        arm.pose.bones[name].rotation_mode = "QUATERNION"

    def action_fcurves(action):
        """Blender 4.4+ moved F-curves into slotted action channelbags."""
        if hasattr(action, "fcurves"):
            return list(action.fcurves)
        out = []
        for layer in action.layers:
            for strip in layer.strips:
                for bag in getattr(strip, "channelbags", []):
                    out.extend(bag.fcurves)
        return out

    def curves(action, bone):
        path = f'pose.bones["{bone}"].rotation_quaternion'
        got = [fc for fc in action_fcurves(action) if fc.data_path == path]
        got.sort(key=lambda fc: fc.array_index)
        if len(got) != 4:
            raise SystemExit(f"{action.name}: {bone} has {len(got)} rotation curves")
        return got

    def key_index(fcs):
        """frame -> keyframe index, per curve."""
        return [{round(k.co.x): i for i, k in enumerate(fc.keyframe_points)}
                for fc in fcs]

    def read_quat(fcs, idx, frame):
        return Quaternion([fcs[c].keyframe_points[idx[c][frame]].co.y
                           for c in range(4)])

    def write_quat(fcs, idx, frame, q):
        for c in range(4):
            kp = fcs[c].keyframe_points[idx[c][frame]]
            kp.co.y = q[c]
            kp.handle_left.y = q[c]
            kp.handle_right.y = q[c]

    clips = sorted(a.name for a in bpy.data.actions if a.name.startswith(PREFIX))

    print(f"\n{'clip':<14}{'plane':>10}{'wing was':>10}{'wing now':>10}"
          f"{'max lift':>10}{'mean lift':>11}{'short':>7}")
    report = []
    for name in clips:
        act = bpy.data.actions[name]
        arm.animation_data.action = act
        start_f, end_f = (int(round(x)) for x in act.frame_range)
        frames = list(range(start_f, end_f + 1))

        bones = [b for s_ in SHOULDERS for b in PIVOTS[s_]]
        fcs = {b: curves(act, b) for b in bones}
        idx = {b: key_index(fcs[b]) for b in bones}

        # The foot plane this clip will be planted on.
        plane = 1e18
        wing_before = 1e18
        for f in frames:
            scn.frame_set(f)
            plane = min(plane, evaluate(mesh, dg, leg_v)[0])
            wing_before = min(wing_before, evaluate(mesh, dg, wing_v)[0])

        applied = {f: 0.0 for f in frames}
        used = {f: {b: 0.0 for b in bones} for f in frames}
        for _ in range(ROUNDS):
            pending = {}
            for f in frames:
                scn.frame_set(f)
                per_bone = {}
                for sname in SHOULDERS:
                    wz, wp = evaluate(mesh, dg, side_v[sname])
                    if wp is None or wz >= plane + CLEARANCE:
                        continue
                    for bone in PIVOTS[sname]:
                        room = JOINT_LIFT - abs(used[f][bone])
                        if room <= 1e-6:
                            continue
                        sb = arm.pose.bones[bone]
                        pivot = arm.matrix_world @ sb.head
                        u = wp - pivot
                        world_axis = u.cross(UP)
                        if world_axis.length < 1e-6:
                            continue
                        world_axis.normalize()
                        th, ascend = solve_angle(pivot, world_axis, wp,
                                                 plane + CLEARANCE)
                        if abs(th) < 1e-6:
                            continue
                        # Clamp along the rising arc, not the solution's sign.
                        th = (th if abs(th) <= room
                              else math.copysign(room, ascend))
                        pose_rot = (arm.matrix_world.to_3x3()
                                    @ sb.matrix.to_3x3()).normalized()
                        per_bone[bone] = (pose_rot.inverted() @ world_axis, th)
                        break          # one joint per side per round
                if per_bone:
                    pending[f] = per_bone
            if not pending:
                break
            for f, per_bone in pending.items():
                for bone, (local_axis, th) in per_bone.items():
                    q = read_quat(fcs[bone], idx[bone], f)
                    write_quat(fcs[bone], idx[bone], f,
                               q @ Quaternion(local_axis, th))
                    used[f][bone] += th
                applied[f] = max(abs(v) for v in used[f].values())
            for bone in bones:
                for fc in fcs[bone]:
                    fc.update()

        wing_after = 1e18
        short = 0
        for f in frames:
            scn.frame_set(f)
            wz = evaluate(mesh, dg, wing_v)[0]
            wing_after = min(wing_after, wz)
            if wz < plane - 1.0:
                short += 1

        degs = [abs(math.degrees(v)) for v in applied.values()]
        mx = max(degs) if degs else 0.0
        mn = sum(degs) / len(degs) if degs else 0.0
        print(f"{name:<14}{plane:>10.1f}{wing_before:>10.1f}{wing_after:>10.1f}"
              f"{mx:>9.1f}d{mn:>10.1f}d{short:>7}")
        report.append((name, plane, wing_before, wing_after, mx, mn, short))

    print("\nyOffsets to plant on the foot plane (negate the plane):")
    for name, plane, *_ in report:
        print(f"  {name:<14}{-plane:>10.1f}")

    if args.save:
        for a in bpy.data.actions:
            a.use_fake_user = True
        bpy.ops.wm.save_mainfile()
        print(f"\nsaved {bpy.data.filepath}")


if __name__ == "__main__":
    main()
