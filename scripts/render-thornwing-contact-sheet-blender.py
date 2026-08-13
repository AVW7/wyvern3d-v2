#!/usr/bin/env python3
"""Blender-side renderer used by render-thornwing-contact-sheet.py."""

from __future__ import annotations

import argparse
import math
import pathlib
import sys

import bpy
from mathutils import Vector

CLIPS = ("idle", "walk", "takeoff", "cruise", "land", "attack", "death")
DEFAULT_SAMPLES = (0.0, 0.25, 0.5, 0.75, 1.0)
# Cruise has two beats, so quarter-duration sampling would hit the same wing
# phase five times. These samples show neutral, downstroke, neutral, upstroke,
# and neutral across one complete beat instead.
SAMPLES = {"cruise": (0.0, 0.125, 0.25, 0.375, 0.5)}
VIEW_OFFSET = Vector((2.8, -4.2, 2.10))


def arguments() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=pathlib.Path, required=True)
    parser.add_argument("--output-dir", type=pathlib.Path, required=True)
    return parser.parse_args(argv)


def bind(armature: bpy.types.Object, action: bpy.types.Action) -> None:
    if armature.animation_data is None:
        armature.animation_data_create()
    armature.animation_data.action = action
    if getattr(action, "slots", None):
        armature.animation_data.action_slot = action.slots[0]


def add_area(name: str, location: tuple[float, float, float], energy: float, size: float, color: tuple[float, float, float]) -> None:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    light = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(light)
    light.location = location


def skin_center(mesh: bpy.types.Object) -> Vector:
    graph = bpy.context.evaluated_depsgraph_get()
    graph.update()
    evaluated = mesh.evaluated_get(graph)
    data = evaluated.to_mesh()
    try:
        low = Vector((math.inf, math.inf, math.inf))
        high = Vector((-math.inf, -math.inf, -math.inf))
        for vertex in data.vertices:
            point = evaluated.matrix_world @ vertex.co
            low.x, low.y, low.z = min(low.x, point.x), min(low.y, point.y), min(low.z, point.z)
            high.x, high.y, high.z = max(high.x, point.x), max(high.y, point.y), max(high.z, point.z)
        return (low + high) * 0.5
    finally:
        evaluated.to_mesh_clear()


def main() -> None:
    args = arguments()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(args.model))
    armature = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
    mesh = next(
        obj for obj in bpy.context.scene.objects
        if obj.type == "MESH" and any(modifier.type == "ARMATURE" for modifier in obj.modifiers)
    )
    actions = {action.name: action for action in bpy.data.actions if action.name in CLIPS}

    camera_data = bpy.data.cameras.new("CAM-ThornwingReview")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 3.15
    camera = bpy.data.objects.new("CAM-ThornwingReview", camera_data)
    bpy.context.collection.objects.link(camera)
    bpy.context.scene.camera = camera

    add_area("Key", (3.5, -4.0, 4.5), 1050, 4.0, (1.0, 0.92, 0.78))
    add_area("Fill", (-3.5, -1.5, 2.5), 700, 5.0, (0.65, 0.78, 1.0))
    add_area("Rim", (0.0, 4.0, 4.0), 1200, 3.0, (0.72, 0.92, 0.74))

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 256
    scene.render.resolution_y = 256
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.world.color = (0.008, 0.012, 0.018)

    for clip in CLIPS:
        action = actions[clip]
        bind(armature, action)
        start, end = (round(value) for value in action.frame_range)
        fractions = SAMPLES.get(clip, DEFAULT_SAMPLES)
        for index, fraction in enumerate(fractions):
            scene.frame_set(start + round((end - start) * fraction))
            center = skin_center(mesh)
            camera.location = center + VIEW_OFFSET
            camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
            scene.render.filepath = str(args.output_dir / f"{clip}-{index}.png")
            bpy.ops.render.render(write_still=True)
    print(f"rendered {len(CLIPS) * 5} Thornwing review frames")


if __name__ == "__main__":
    main()
