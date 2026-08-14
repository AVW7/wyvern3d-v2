#!/usr/bin/env python3
"""Retarget v1's artist-authored ground clips onto the grafted v2 ``WyvernRig``.

Run this *after* ``restore-v1-wing-digits-blender.py``, on the rig it produced
(``wyvern-rig-v1wing.blend``).  The graft is what makes this worth doing: with
v1's six three-phalanx digits back on the wing, a retargeted clip can carry the
membrane fold that the three-bone v2 wing physically could not represent.

Geometry
--------
Two measured facts make this exact rather than approximate:

1. ``R3 @ M1rot == Identity`` -- the v1 armature's own world matrix already
   carries the Y-up -> Z-up rotation, and composing it with the v1 -> v2 map
   cancels out.  v2 rig space *is* v1's raw glTF space, and the residual scale
   is ``100 * 0.01 == 1``.  So a v1 pose bone's armature-space rotation needs
   no conversion at all.
2. Rest orientations still differ.  The 66 grafted wing bones were built from
   v1's transformed head/tail/roll and align to under 10 degrees, but the 34
   original v2 bones sit roughly 90 degrees off their v1 counterparts (a 3ds
   Max Biped convention against the v2 rebuild's).

So a raw orientation copy would be wrong: it would drag each v2 bone off the
rest pose its skinning is bound to.  Every bone therefore goes through a
rest-delta instead --

    D             = v1_posed_rot @ v1_rest_rot^-1        (world-space delta)
    desired_rot   = D @ v2_rest_rot

-- which reduces to an identity transfer on the grafted bones, where the two
rest frames already agree.  One uniform code path covers both groups.

The local basis is then solved analytically up the parent chain rather than by
round-tripping the depsgraph per bone:

    posed(b) = posed(parent) @ rest_offset(b) @ basis(b)
    basis(b) = rot( posed(parent) @ rest_offset(b) )^-1 @ desired_rot(b)

``basis`` is rotation-only, so bone translations stay at their rest values and
nothing stretches.  v1's clips carry no root motion, so no translation channel
needs transferring.

Bone pairing is solved by rest position, not by name -- the two rigs disagree
on naming (v2 ``Spine1`` sits at v1 ``Bip002-Spine``, and v2 ``Neck1`` at v1
``Bip002-Spine3``), but their rest positions coincide to well under a unit.
Degenerate v1 leaves, which the glTF importer lands on the origin, are excluded
so they cannot win a nearest-position match.

Output actions are prefixed ``v1_`` so the 16 existing authored actions are
left untouched for comparison.

Run inside Blender, in two steps (the glTF importer reads ``context.object``,
which is unset immediately after ``open_mainfile``):

    exec(open("scripts/retarget-v1-ground-clips-blender.py").read())

It does not save.
"""

from __future__ import annotations

import bpy
from mathutils import Matrix, Vector

V1_GLB = "/Users/ajadvanwyk/wyvern3d-v2/public/models/drogon-decompressed.glb"
ARMATURE = "WyvernRig"

SCALE = 100.0
MAX_PAIR_DISTANCE = 60.0   # rig units; the true pairs land under ~1
PREFIX = "v1_"

# v1 clip substring -> action name on the v2 rig.
GROUND_CLIPS = {
    "Battle_Stand": "stand",
    "Battle_Walk": "walk",
    "Battle_WalkL": "walkLeft",
    "Battle_WalkR": "walkRight",
    "Battle_TurnL90": "turnLeft",
    "Battle_TurnR90": "turnRight",
    "Battle_Up": "riseUp",
    "Battle_Down": "goDown",
    "Neutural_Watch": "watch",
    "Neutural_Roar": "roar",
    "Neutural_BackKick": "backKick",
}


def to_v2(p: Vector) -> Vector:
    return Vector((p.x * SCALE, -p.z * SCALE, p.y * SCALE))


def import_v1():
    if bpy.context.view_layer.objects.active is None:
        bpy.context.view_layer.objects.active = bpy.data.objects[ARMATURE]
    before = {o.name for o in bpy.data.objects}
    actions_before = {a.name for a in bpy.data.actions}
    bpy.ops.import_scene.gltf(filepath=V1_GLB)
    new = [o for o in bpy.data.objects if o.name not in before]
    arm = next(o for o in new if o.type == "ARMATURE")
    acts = [a for a in bpy.data.actions if a.name not in actions_before]
    if not acts:
        # A previous script in this session may already have imported v1 and
        # left its actions behind, in which case this import's copies collide
        # and Blender suffixes them.  Fall back to every non-output action.
        acts = [a for a in bpy.data.actions if not a.name.startswith(PREFIX)]
    return arm, new, acts


def find_clip(actions, needle):
    """Locate a v1 action, tolerating Blender's ``.001`` collision suffixes."""
    for act in actions:
        name = act.name
        tail = name.rsplit(".", 1)
        if len(tail) == 2 and tail[1].isdigit():
            name = tail[0]
        if name.endswith(needle):
            return act
    return None


# v2's ``Jaw`` is deliberately left unpaired.  Position-pairing puts its nearest
# v1 neighbour 68 units away, past the threshold, and v1's only actually
# jaw-named bone (``B_Face_Jaw_00``) measures 1046 units off -- it belongs to a
# separate face rig parked near the origin, not to the posed body skeleton.
# Pairing it would wrench the jaw across the head, so the jaw simply holds its
# rest pose and ``v1_roar`` carries no mouth motion.  Fixing that needs a real
# jaw source, not a nearest-neighbour guess.
OVERRIDES: dict[str, str] = {}

# ``Root`` and ``RootMotion`` are v2-only control bones with no v1 counterpart,
# and both sit on the origin -- where v1's degenerate ``*_end`` leaves also land
# once the importer collapses them.  Left to nearest-position matching they pair
# with ``Bip002-Tail8_end`` at 0.4 units and inherit a meaningless rotation that
# swings the entire body by +/-550 units.  They hold their rest pose instead.
EXCLUDE_V2 = {"Root", "RootMotion"}

# Rotation-only transfer keeps bone lengths honest, but it also pins the hips:
# v1's pelvis bobs through each stride, and dropping that makes the walk float.
# The bone paired to v1's pelvis therefore also receives translation -- as a
# delta from its own rest position, so it carries the bob without inheriting
# v1's absolute placement.
ROOT_TRANSLATION = "Bip002-Pelvis"

# v1's posed data does not share the space its bind pose is in, and this
# rotation is what reconciles them.  Measured on ``Battle_Walk``: the bind pose
# spans 6280 x 1100 x 4380, while frame 20 of the clip spans 2400 x 4200 x 1700
# -- tallest along Y, so the posed dragon's up-axis is Y where the bind's is Z.
#
# Because the offset is global and constant, one rotation applied to every
# bone's target world orientation rigidly counter-rotates the whole FK chain,
# which is the correction needed.
#
# Do not remove it on the strength of matching v1's imported pose.  It is true
# that ``R_FIX`` equals ``_rootJoint``'s rest ``matrix_local``, and true that
# dropping it brings posed joint heads to within 15 units (mean, over 103 bones)
# of ``to_v2(m1 @ v1_pose_bone.head)`` against 1801 with it.  That comparison is
# circular: the reference is v1's imported posed data, which carries the very
# rotation being corrected, so matching it exactly reproduces the fault.  Built
# that way and viewed in the Model Library, the walk stands the dragon on its
# tail while the authored clips in the same GLB render correctly.  Judge this
# one on a render, not on a residual.
#
# Keeping it is not a fix either, and this script does not currently produce a
# usable ground clip.  Rendered side-on from the same camera that draws the
# authored ``rest`` as a coherent dragon, ``v1_walk`` built WITH ``R_FIX`` is
# contorted -- hind legs splayed upward, torso twisted, wings inside out.  So
# the two known configurations fail differently rather than one being right:
# without the rotation the pose is rigidly rotated 90 degrees, with it the pose
# is mangled.  That points at the transfer itself, not at a missing constant,
# and the next person here should start from a render of a single frame rather
# than from any positional residual.
R_FIX = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))


def pair_bones(v1_arm, v2_arm):
    """Match v2 bones to v1 bones by rest position, skipping degenerate leaves."""
    m1 = v1_arm.matrix_world
    cands = []
    for b in v1_arm.data.bones:
        head = to_v2(m1 @ b.head_local)
        tail = to_v2(m1 @ b.tail_local)
        if (tail - head).length < 1e-3:
            continue                      # importer leaf, collapsed
        if head.length < 1.0:
            continue                      # parked on (or beside) the origin
        if "_end" in b.name:
            continue                      # importer-synthesised leaf
        cands.append((b, head))

    pairs = {}
    for b in v2_arm.data.bones:
        if not cands:
            break
        if b.name in EXCLUDE_V2:
            continue
        best, dist = min(
            ((c, (h - b.head_local).length) for c, h in cands),
            key=lambda e: e[1],
        )
        if dist <= MAX_PAIR_DISTANCE:
            pairs[b.name] = (best.name, round(dist, 2))

    for v2_name, v1_name in OVERRIDES.items():
        if v2_name in v2_arm.data.bones and v1_name in v1_arm.data.bones:
            head = to_v2(m1 @ v1_arm.data.bones[v1_name].head_local)
            dist = (head - v2_arm.data.bones[v2_name].head_local).length
            pairs[v2_name] = (v1_name, round(dist, 2))
    return pairs


def hierarchy_order(arm):
    out = []
    stack = [b for b in arm.data.bones if b.parent is None]
    while stack:
        b = stack.pop(0)
        out.append(b)
        stack.extend(b.children)
    return out


def run():
    v2 = bpy.data.objects[ARMATURE]
    v1, imported, v1_actions = import_v1()
    scn = bpy.context.scene

    pairs = pair_bones(v1, v2)
    order = hierarchy_order(v2)

    # cached rest data
    v1_rest_rot = {
        n: v1.data.bones[n].matrix_local.to_3x3().normalized()
        for n, _ in pairs.values()
    }
    m1 = v1.matrix_world
    hip = next((v2n for v2n, (v1n, _) in pairs.items()
                if v1n.startswith(ROOT_TRANSLATION)), None)
    hip_rest = (to_v2(m1 @ v1.data.bones[pairs[hip][0]].matrix_local.to_translation())
                if hip else None)
    v2_rest = {b.name: b.matrix_local for b in v2.data.bones}
    rest_offset = {}
    for b in order:
        rest_offset[b.name] = (
            v2_rest[b.parent.name].inverted() @ v2_rest[b.name]
            if b.parent else v2_rest[b.name]
        )

    v2.animation_data_create()
    v1.animation_data_create()
    for pb in v2.pose.bones:
        pb.rotation_mode = "QUATERNION"

    built = []
    for needle, slug in GROUND_CLIPS.items():
        src = find_clip(v1_actions, needle)
        if src is None:
            built.append({"clip": slug, "status": "v1 clip not found"})
            continue
        v1.animation_data.action = src
        start, end = (int(v) for v in src.frame_range)

        dst = bpy.data.actions.new(PREFIX + slug)
        dst.use_fake_user = True
        v2.animation_data.action = dst

        for frame in range(start, end + 1):
            scn.frame_set(frame)
            posed = {}
            for b in order:
                parent_posed = posed[b.parent.name] if b.parent else Matrix.Identity(4)
                base = parent_posed @ rest_offset[b.name]
                basis = Matrix.Identity(4)
                hit = pairs.get(b.name)
                if hit:
                    v1_name = hit[0]
                    v1_pb = v1.pose.bones[v1_name]
                    delta = (v1_pb.matrix.to_3x3().normalized()
                             @ v1_rest_rot[v1_name].inverted())
                    desired = R_FIX @ delta @ v2_rest[b.name].to_3x3().normalized()
                    local = base.to_3x3().normalized().inverted() @ desired
                    basis = local.to_4x4()
                    pb = v2.pose.bones[b.name]
                    pb.rotation_quaternion = local.to_quaternion()
                    pb.keyframe_insert("rotation_quaternion", frame=frame)
                    if b.name == hip:
                        bob = R_FIX @ (to_v2(m1 @ v1_pb.matrix.to_translation())
                                       - hip_rest)
                        target = v2_rest[b.name].to_translation() + bob
                        offset = (base.to_3x3().normalized().inverted()
                                  @ (target - base.to_translation()))
                        basis.translation = offset
                        pb.location = offset
                        pb.keyframe_insert("location", frame=frame)
                posed[b.name] = base @ basis

        built.append({"clip": PREFIX + slug, "frames": end - start + 1,
                      "source": src.name.split("|")[-1]})

    v2.animation_data.action = None
    for pb in v2.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)

    for obj in imported:
        bpy.data.objects.remove(obj, do_unlink=True)
    for act in v1_actions:
        if act.users == 0:
            bpy.data.actions.remove(act)

    worst = sorted(pairs.items(), key=lambda kv: -kv[1][1])[:6]
    return {
        "paired_bones": len(pairs),
        "unpaired": [b.name for b in v2.data.bones if b.name not in pairs],
        "worst_pair_distances": worst,
        "clips": built,
    }


result = run()
print(result)
