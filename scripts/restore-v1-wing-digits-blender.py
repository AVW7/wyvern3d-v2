#!/usr/bin/env python3
"""Graft v1's articulated wing hand back onto the clean v2 ``WyvernRig``.

Why this exists
---------------
The v2 rig rebuild collapsed each wing from v1's six three-phalanx digits
(plus a three-bone batten chain per digit, out in the membrane field) into
three single-bone digits, and re-weighted the trailing membrane sheet onto two
``*_WingMembrane*`` bones parented to the **elbow** rather than to the digits.

Measured consequence on the shipped rig: folding the three digits 70 degrees
about the wrist displaces digit-driven vertices by 586 units on average, but
membrane-driven vertices by only 70.  The sheet does not follow the fold, so
the wing cannot shrink or expand -- it is a rigid card that the spars swing
through.  In v1 that same sheet is skinned to ``Finger32`` / ``Finger42``, the
distal phalanges, which is exactly why v1's artist clips read correctly.

What this does
--------------
v1 and v2 share one mesh (27,162 vs 27,164 vertices, matched to a 0.4-unit
residual on a 6,272-unit model), so this is a mechanical transfer, not an
artistic reconstruction:

1. Import v1 (``drogon-decompressed.glb``) alongside the open v2 rig.
2. Solve v1 -> v2 as the exact similarity ``(x, y, z) -> 100 * (x, -z, y)``
   (verified against both mesh centroids and RMS radius).
3. Graft every load-bearing bone of v1's ``Bip002-{L,R}-Hand`` subtree into
   ``WyvernRig`` under the existing ``{L,R}_WingWrist``, renamed to the
   project's ``L_*``/``R_*`` convention.
4. Rebuild the skin weights of wing-dominated vertices straight from v1,
   mapping proximal v1 bones onto the v2 bones that already carry the
   existing actions.

Bones carrying no weight in the wing region are skipped, which drops v1's
degenerate ``*_end`` leaves (the glTF importer lands them on the origin).

The existing v2 shoulder/elbow/wrist bones are left untouched, so the 16
authored actions keep their carrier animation.  Only the distal hand changes.

Run inside Blender with ``wyvern-rig.blend`` open:

    exec(open("scripts/restore-v1-wing-digits-blender.py").read())

It does not save; inspect, then save deliberately.
"""

from __future__ import annotations

import math

import bpy
from mathutils import Vector, kdtree

V1_GLB = "/Users/ajadvanwyk/wyvern3d-v2/public/models/drogon-decompressed.glb"
ARMATURE = "WyvernRig"
MESH = "WyvernMesh"

# v1 -> v2: uniform 100x with a +90 degree rotation about X.
SCALE = 100.0

# v2 wing bones distal to the wrist, replaced wholesale by the graft.
V2_DISTAL = (
    "{S}_WingFinger1", "{S}_WingFinger1_end",
    "{S}_WingFinger2", "{S}_WingFinger2_end",
    "{S}_WingFinger3", "{S}_WingFinger3_end",
    "{S}_WingClaw", "{S}_WingMembrane1", "{S}_WingMembrane2",
)

# v1 bones that already have a v2 counterpart; their weights are remapped
# rather than grafted, so existing action channels keep driving them.
#
# These pairings are measured head-to-head distances (0.4 units each), NOT
# inferred from the names -- and the names actively mislead.  The v2 rig is
# shifted one joint outboard of anatomy: its "Shoulder" sits on v1's clavicle,
# its "Elbow" on the shoulder joint, and its "Wrist" on the elbow.  Pairing by
# name instead puts every proximal weight one joint too far inboard.
PROXIMAL = {
    "Bip002-{S}-Clavicle": "{S}_WingShoulder",
    "Bip002-{S}-UpperArm": "{S}_WingElbow",
    "Bip002-{S}-Forearm": "{S}_WingWrist",
}

# v1's hand has no v2 counterpart at all (nearest is the wrist, 558 units
# away), so it is grafted rather than remapped.  Dropping it costs the digits
# their carrier rotation and drifts the fingertips by up to ~1245 units
# mid-stride, because the whole digit fan then hangs off the elbow.
HAND = "Bip002-{S}-Hand"
SPINE = {"Bip002-Spine3": "Spine3", "Bip002-Spine2": "Spine2", "Bip002-Spine1": "Spine1"}

# A vertex is rebuilt only if this much of its v1 weight sits on the wing.
WING_DOMINANCE = 0.5
WEIGHT_EPS = 0.004


def rot(v: Vector) -> Vector:
    """Rotate a v1 direction into v2 space (no scale)."""
    return Vector((v.x, -v.z, v.y))


def to_v2(p: Vector) -> Vector:
    """Map a v1 world position into v2 rig space."""
    return Vector((p.x * SCALE, -p.z * SCALE, p.y * SCALE))


def strip(name: str) -> str:
    """``Bip002-L-Finger32_055`` -> ``Bip002-L-Finger32``."""
    return name.rsplit("_", 1)[0] if "_" in name else name


def import_v1():
    # The glTF importer reads ``context.object`` unconditionally, which is
    # unset straight after ``open_mainfile``.  Give it something to look at.
    if bpy.context.view_layer.objects.active is None:
        bpy.context.view_layer.objects.active = bpy.data.objects[ARMATURE]
    before = {o.name for o in bpy.data.objects}
    bpy.ops.import_scene.gltf(filepath=V1_GLB)
    new = [o for o in bpy.data.objects if o.name not in before]
    arm = next(o for o in new if o.type == "ARMATURE")
    meshes = [o for o in new if o.type == "MESH" and len(o.vertex_groups) > 0]
    return arm, meshes, new


def build_correspondence(v1_meshes):
    """KD-tree over v1 vertices expressed in v2 space."""
    entries = []
    for obj in v1_meshes:
        mat = obj.matrix_world
        for vert in obj.data.vertices:
            entries.append((obj, vert.index, to_v2(mat @ vert.co)))
    tree = kdtree.KDTree(len(entries))
    for i, (_, _, pos) in enumerate(entries):
        tree.insert(pos, i)
    tree.balance()
    return tree, entries


def graft_name(v1_name: str, side: str) -> str:
    """Rename a v1 wing bone to the project's convention."""
    base = strip(v1_name)
    token = base.replace(f"Bip002-{side}-", "")
    if token == "Hand":
        return f"{side}_WingHand"
    if token.startswith("Finger"):
        rest = token[len("Finger"):]
        digit = rest[0]
        phalanx = rest[1:] or "0"
        return f"{side}_WingD{digit}P{phalanx}"
    # Bone040 etc: membrane battens, numbered per chain when parented below.
    return f"{side}_WingBatten{token.replace('Bone', '')}"


def collect_subtree(arm, root_name):
    root = arm.data.bones.get(root_name)
    if root is None:
        return []
    out = []
    stack = [root]
    while stack:
        bone = stack.pop()
        out.append(bone)
        stack.extend(bone.children)
    return out


def run():
    v2_arm = bpy.data.objects[ARMATURE]
    v2_mesh = bpy.data.objects[MESH]
    v1_arm, v1_meshes, imported = import_v1()

    tree, entries = build_correspondence(v1_meshes)
    v1_groups = {o.name: {g.index: g.name for g in o.vertex_groups} for o in v1_meshes}
    m1 = v1_arm.matrix_world

    # ---- resolve v1 hand subtrees, keeping only weight-bearing bones -------
    hand_roots = {}
    for bone in v1_arm.data.bones:
        base = strip(bone.name)
        for side in ("L", "R"):
            if base == f"Bip002-{side}-Hand":
                hand_roots[side] = bone.name
    subtree = {s: collect_subtree(v1_arm, r) for s, r in hand_roots.items()}

    used = set()
    for obj in v1_meshes:
        for vert in obj.data.vertices:
            for grp in vert.groups:
                if grp.weight > 0.02:
                    used.add(v1_groups[obj.name][grp.group])

    graft = {}   # v1 bone name -> new v2 bone name
    for side, bones in subtree.items():
        for bone in bones:
            # the hand is grafted too -- v2 has no bone at its position
            if bone.name not in used and bone.name != hand_roots[side]:
                continue
            graft[bone.name] = graft_name(bone.name, side)

    # ---- create the grafted bones ----------------------------------------
    prev_mode = bpy.context.object.mode if bpy.context.object else "OBJECT"
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.objects.active = v2_arm
    bpy.ops.object.mode_set(mode="EDIT")
    eb = v2_arm.data.edit_bones

    # drop the v2 distal bones the graft supersedes
    removed = []
    for side in ("L", "R"):
        for pat in V2_DISTAL:
            name = pat.format(S=side)
            if name in eb:
                eb.remove(eb[name])
                removed.append(name)

    created = {}
    for v1_name, new_name in graft.items():
        src = v1_arm.data.bones[v1_name]
        bone = eb.new(new_name)
        bone.head = to_v2(m1 @ src.head_local)
        bone.tail = to_v2(m1 @ src.tail_local)
        if (bone.tail - bone.head).length < 1e-4:
            bone.tail = bone.head + Vector((0.0, 0.0, 1.0))
        bone.align_roll(rot((m1.to_3x3() @ src.z_axis).normalized()))
        created[v1_name] = bone.name

    # parent within the graft, or onto the existing wrist at the root
    for v1_name, new_name in created.items():
        src = v1_arm.data.bones[v1_name]
        parent = src.parent
        target = None
        while parent is not None:
            if parent.name in created:
                target = created[parent.name]
                break
            base = strip(parent.name)
            side = "L" if "-L-" in parent.name else "R"
            hit = next((v for k, v in PROXIMAL.items()
                        if k.format(S=side) == base), None)
            if hit:
                target = hit.format(S=side)
                break
            parent = parent.parent
        if target and target in eb:
            eb[new_name].parent = eb[target]
            eb[new_name].use_connect = False

    bpy.ops.object.mode_set(mode="OBJECT")

    # ---- rebuild wing weights from v1 ------------------------------------
    name_map = dict(created)
    for side in ("L", "R"):
        for v1pat, v2pat in PROXIMAL.items():
            name_map[v1pat.format(S=side)] = v2pat.format(S=side)
    for a, b in SPINE.items():
        name_map[a] = b

    wing_bones = {strip(n) for n in graft}
    for side in ("L", "R"):
        wing_bones.add(f"Bip002-{side}-Hand")

    for name in set(name_map.values()):
        if name not in v2_mesh.vertex_groups:
            v2_mesh.vertex_groups.new(name=name)
    vg = v2_mesh.vertex_groups
    m2 = v2_mesh.matrix_world

    rebuilt = 0
    residuals = []
    for vert in v2_mesh.data.vertices:
        _, idx, dist = tree.find(m2 @ vert.co)
        obj, vi, _ = entries[idx]
        src = obj.data.vertices[vi]
        weights = {}
        total = 0.0
        wing_mass = 0.0
        for grp in src.groups:
            raw = v1_groups[obj.name].get(grp.group)
            if not raw or grp.weight <= 0.0:
                continue
            total += grp.weight
            if strip(raw) in wing_bones:
                wing_mass += grp.weight
            key = raw if raw in name_map else strip(raw)
            tgt = name_map.get(key) or name_map.get(strip(raw))
            if tgt:
                weights[tgt] = weights.get(tgt, 0.0) + grp.weight
        if total <= 0.0 or wing_mass / total < WING_DOMINANCE:
            continue
        residuals.append(dist)
        for name in set(name_map.values()):
            if name in vg:
                vg[name].remove([vert.index])
        norm = sum(weights.values())
        if norm <= 0.0:
            continue
        for name, w in weights.items():
            w /= norm
            if w >= WEIGHT_EPS:
                vg[name].add([vert.index], w, "REPLACE")
        rebuilt += 1

    for obj in imported:
        bpy.data.objects.remove(obj, do_unlink=True)
    # Drop v1's 52 imported actions too.  Leaving them behind makes a later
    # re-import collide and get ``.001``-suffixed, which silently breaks
    # name-based clip lookup in the retarget pass.
    for act in list(bpy.data.actions):
        if act.users == 0 and "DaenerysDragon" in act.name:
            bpy.data.actions.remove(act)

    return {
        "removed_v2_bones": sorted(removed),
        "grafted_bones": len(created),
        "grafted_sample": sorted(created.values())[:12],
        "vertices_rebuilt": rebuilt,
        "match_residual_mean": round(sum(residuals) / len(residuals), 3) if residuals else None,
        "match_residual_max": round(max(residuals), 3) if residuals else None,
        "bones_total": len(v2_arm.data.bones),
    }


result = run()
print(result)
