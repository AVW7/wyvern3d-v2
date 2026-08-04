#!/usr/bin/env python3
"""Measure a local-axis nudge against the actual skinned wing surface.

This runs without saving.  A bone's roll is not legible from its name or from a
viewport gizmo, so authoring scripts should use this report before choosing a
membrane or spar axis.
"""

import bpy
import json
from mathutils import Matrix, Vector


ACTION = "glide"
FRAME = 0
NUDGE = 0.1
BONES = tuple(
    f"{side}_Wing{part}"
    for side in ("L", "R")
    for part in ("Wrist", "Finger1", "Finger2", "Finger3", "Membrane1", "Membrane2")
)


def weighted_positions(mesh, group_index):
    evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
    positions, weights = [], []
    for source_vertex, vertex in zip(mesh.data.vertices, evaluated.data.vertices):
        weight = next(
            (member.weight for member in source_vertex.groups if member.group == group_index),
            0.0,
        )
        if weight:
            positions.append(evaluated.matrix_world @ vertex.co)
            weights.append(weight)
    return positions, weights


def centroid(positions, weights):
    total = sum(weights)
    return sum((point * weight for point, weight in zip(positions, weights)), Vector()) / total


def main():
    scene = bpy.context.scene
    armature = next(
        obj for obj in bpy.data.objects
        if obj.type == "ARMATURE" and "L_WingShoulder" in obj.pose.bones
    )
    mesh = next(obj for obj in bpy.data.objects if obj.type == "MESH" and obj.parent == armature)
    action = bpy.data.actions[ACTION]
    armature.animation_data_create()
    armature.animation_data.action = action
    if action.slots:
        armature.animation_data.action_slot = action.slots[0]
    scene.frame_set(FRAME)
    bpy.context.view_layer.update()

    report = {"action": ACTION, "frame": FRAME, "nudge_radians": NUDGE, "bones": {}}
    for bone_name in BONES:
        group = mesh.vertex_groups.get(bone_name)
        if group is None:
            raise SystemExit(f"{bone_name} has no mesh vertex group")
        pose_bone = armature.pose.bones[bone_name]
        base_basis = pose_bone.matrix_basis.copy()
        base_positions, weights = weighted_positions(mesh, group.index)
        base_center = centroid(base_positions, weights)
        axes = {}
        for axis in "XYZ":
            pose_bone.matrix_basis = base_basis @ Matrix.Rotation(NUDGE, 4, axis)
            bpy.context.view_layer.update()
            positions, _ = weighted_positions(mesh, group.index)
            delta = centroid(positions, weights) - base_center
            max_displacement = max((point - initial).length for point, initial in zip(positions, base_positions))
            axes[axis] = {
                "weighted_centroid_delta": [round(value, 3) for value in delta],
                "max_vertex_displacement": round(max_displacement, 3),
            }
        pose_bone.matrix_basis = base_basis
        bpy.context.view_layer.update()
        report["bones"][bone_name] = {
            "weighted_vertex_count": len(weights),
            "axes": axes,
        }
    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
