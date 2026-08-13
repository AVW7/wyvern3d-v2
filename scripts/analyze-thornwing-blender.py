#!/usr/bin/env python3
"""Blender-side numeric analyzer for Thornwing animation contracts."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import pathlib
import sys

import bpy
from mathutils import Vector

FPS = 24
LOOPING = {"idle", "walk", "cruise"}


def arguments() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=pathlib.Path, required=True)
    parser.add_argument("--source", type=pathlib.Path, required=True)
    parser.add_argument("--output", type=pathlib.Path, required=True)
    return parser.parse_args(argv)


def bind(armature: bpy.types.Object, action: bpy.types.Action) -> None:
    if armature.animation_data is None:
        armature.animation_data_create()
    armature.animation_data.action = action
    if getattr(action, "slots", None):
        armature.animation_data.action_slot = action.slots[0]


def world_head(armature: bpy.types.Object, name: str) -> Vector:
    bpy.context.view_layer.update()
    evaluated = armature.evaluated_get(bpy.context.evaluated_depsgraph_get())
    return evaluated.matrix_world @ evaluated.pose.bones[name].head


def world_tail(armature: bpy.types.Object, name: str) -> Vector:
    bpy.context.view_layer.update()
    evaluated = armature.evaluated_get(bpy.context.evaluated_depsgraph_get())
    return evaluated.matrix_world @ evaluated.pose.bones[name].tail


def elevation(vector: Vector) -> float:
    return math.degrees(math.atan2(vector.z, math.hypot(vector.x, vector.y)))


def peak_count(values: list[float]) -> int:
    if len(values) < 3:
        return 0
    threshold = (min(values) + max(values)) * 0.5
    return sum(
        1 for index in range(1, len(values) - 1)
        if values[index] > threshold and values[index] >= values[index - 1] and values[index] > values[index + 1]
    )


def stats(values: list[float]) -> dict[str, float]:
    low, high = min(values), max(values)
    return {
        "min": round(low, 5), "max": round(high, 5),
        "mean": round(sum(values) / len(values), 5), "range": round(high - low, 5),
    }


def skin_low(mesh: bpy.types.Object) -> float:
    graph = bpy.context.evaluated_depsgraph_get()
    graph.update()
    evaluated = mesh.evaluated_get(graph)
    data = evaluated.to_mesh()
    try:
        return min((evaluated.matrix_world @ vertex.co).z for vertex in data.vertices)
    finally:
        evaluated.to_mesh_clear()


def pose(armature: bpy.types.Object) -> dict[str, tuple[float, ...]]:
    return {
        bone.name: tuple(bone.location) + tuple(bone.rotation_quaternion) + tuple(bone.scale)
        for bone in armature.pose.bones
    }


def heads(armature: bpy.types.Object) -> dict[str, Vector]:
    bpy.context.view_layer.update()
    evaluated = armature.evaluated_get(bpy.context.evaluated_depsgraph_get())
    return {
        bone.name: evaluated.matrix_world @ bone.head.copy()
        for bone in evaluated.pose.bones
    }


def measure(armature: bpy.types.Object, mesh: bpy.types.Object, action: bpy.types.Action) -> dict:
    bind(armature, action)
    start, end = (round(value) for value in action.frame_range)
    wing_left: list[float] = []
    wing_right: list[float] = []
    body_axis: list[float] = []
    root_points: list[Vector] = []
    clearances: list[float] = []
    endpoint_heads: dict[int, dict[str, Vector]] = {}
    endpoint_pose: dict[int, dict[str, tuple[float, ...]]] = {}
    for frame in range(start, end + 1):
        bpy.context.scene.frame_set(frame)
        left = world_tail(armature, "L_WingFinger1_end") - world_head(armature, "L_WingShoulder")
        right = world_tail(armature, "R_WingFinger1_end") - world_head(armature, "R_WingShoulder")
        wing_left.append(elevation(left))
        wing_right.append(elevation(right))
        body = world_head(armature, "Head") - world_head(armature, "Tail1")
        body_axis.append(elevation(body))
        root_points.append(world_head(armature, "RootMotion"))
        clearances.append(skin_low(mesh))
        if frame in (start, end):
            endpoint_heads[frame] = heads(armature)
            endpoint_pose[frame] = pose(armature)

    first_heads, last_heads = endpoint_heads[start], endpoint_heads[end]
    displacements = [(first_heads[name] - last_heads[name]).length for name in first_heads]
    first_pose, last_pose = endpoint_pose[start], endpoint_pose[end]
    basis_max = max(
        abs(before - after)
        for name in first_pose
        for before, after in zip(first_pose[name], last_pose[name])
    )
    root_origin = root_points[0]
    root_distances = [(point - root_origin).length for point in root_points]
    left_stats, right_stats = stats(wing_left), stats(wing_right)
    samples = wing_left[:-1] if action.name in LOOPING else wing_left
    beats = peak_count(samples)
    duration = (end - start) / FPS

    return {
        "frames": [start, end],
        "frame_count": end - start + 1,
        "duration_s": round(duration, 5),
        "loop": {
            "pose_mean": round(sum(displacements) / len(displacements), 7),
            "pose_max": round(max(displacements), 7),
            "basis_max": round(basis_max, 7),
            "loops": max(displacements, default=0.0) < 0.01 and basis_max < 0.01,
        },
        "ground_clearance": {
            "start": round(clearances[0], 6),
            "end": round(clearances[-1], 6),
            "min": round(min(clearances), 6),
            "max": round(max(clearances), 6),
        },
        "wing_elevation_left_deg": left_stats,
        "wing_elevation_right_deg": right_stats,
        "wing_stroke": {
            "left_range_deg": left_stats["range"],
            "right_range_deg": right_stats["range"],
            "range_difference_deg": round(abs(left_stats["range"] - right_stats["range"]), 5),
            "beats": beats,
            "cadence_hz": round(beats / duration, 5) if duration else 0.0,
        },
        "body_axis_deg": stats(body_axis),
        "root_path": {
            "start": {
                axis: round(getattr(root_origin, axis), 7)
                for axis in "xyz"
            },
            "max_distance": round(max(root_distances), 7),
            "span": {
                axis: round(max(getattr(point, axis) for point in root_points) - min(getattr(point, axis) for point in root_points), 7)
                for axis in "xyz"
            },
        },
    }


def main() -> None:
    args = arguments()
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(args.model))
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and any(mod.type == "ARMATURE" for mod in obj.modifiers)]
    if len(armatures) != 1 or len(meshes) != 1:
        raise SystemExit(f"expected one armature/mesh, found {len(armatures)}/{len(meshes)}")
    armature, mesh = armatures[0], meshes[0]
    actions = {action.name: action for action in bpy.data.actions if action.name in {"idle", "walk", "takeoff", "cruise", "land", "attack", "death"}}
    if len(actions) != 7:
        raise SystemExit(f"expected seven actions, found {sorted(actions)}")
    model = {
        "bytes": args.model.stat().st_size,
        "sha256": hashlib.sha256(args.model.read_bytes()).hexdigest(),
        "vertices": len(mesh.data.vertices),
        "triangles": sum(len(poly.vertices) - 2 for poly in mesh.data.polygons),
        "joints": len(armature.data.bones),
        "max_vertex_weights": max(len(vertex.groups) for vertex in mesh.data.vertices),
        "materials": len(mesh.data.materials),
    }
    report = {
        "schema": "thornwing_clip_signature.v1",
        "source": "public/models/thornwing.glb",
        "input": {
            "source": "public/models/library/forest-wyvern-display.glb",
            "sha256": hashlib.sha256(args.source.read_bytes()).hexdigest(),
        },
        "model": model,
        "clips": {name: measure(armature, mesh, actions[name]) for name in sorted(actions)},
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
