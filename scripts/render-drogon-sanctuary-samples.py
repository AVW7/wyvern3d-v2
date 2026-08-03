"""Render five consistent quality-gate samples for every sanctuary action.

Run in Blender with a decompressed copy of the base GLB. The generated PNGs are
temporary inputs to the animation-quality-gate contact-sheet tool; only the
combined sheet and its report belong in validation/wyvern-animations.
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from itertools import product

from mathutils import Vector


ACTION_NAMES = (
    "Sanct_Sleep",
    "Sanct_Rest",
    "Sanct_Sit",
    "Sanct_SitLoop",
    "Sanct_Rise",
    "Sanct_Eat",
    "Sanct_HuntGrip",
    "Sanct_HuntCarry",
    "Sanct_HuntFinish",
    "Sanct_Drink",
    "Sanct_Groom",
    "Sanct_PerchGrip",
    "Sanct_Cruise",
    "Sanct_Scout",
    "Sanct_BankL",
    "Sanct_BankR",
    "Sanct_Hover",
    "Sanct_Speed",
    "Sanct_Soar",
    "Sanct_Dive",
    "Sanct_Nuzzle",
    "Sanct_Calm",
)


def arguments() -> argparse.Namespace:
    blender_args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-glb", type=Path, required=True)
    parser.add_argument("--sidecar-blend", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument(
        "--use-open-sidecar",
        action="store_true",
        help="Keep the currently open sidecar blend; intended for interactive validation.",
    )
    return parser.parse_args(blender_args)


def samples(action: bpy.types.Action) -> list[int]:
    start, end = (int(round(value)) for value in action.frame_range)
    return [
        round(start + (end - start) * step / 4)
        for step in range(5)
    ]


def skinned_meshes(scene: bpy.types.Scene) -> list[bpy.types.Object]:
    result = []
    for obj in scene.objects:
        if obj.type != "MESH":
            continue
        if obj.parent and obj.parent.type == "ARMATURE":
            result.append(obj)
            continue
        if any(modifier.type == "ARMATURE" for modifier in obj.modifiers):
            result.append(obj)
    return result


def evaluated_bounds(
    objects: list[bpy.types.Object],
) -> tuple[Vector, Vector]:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    lower = Vector((math.inf, math.inf, math.inf))
    upper = Vector((-math.inf, -math.inf, -math.inf))
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            matrix = evaluated.matrix_world
            for vertex in mesh.vertices:
                point = matrix @ vertex.co
                lower.x = min(lower.x, point.x)
                lower.y = min(lower.y, point.y)
                lower.z = min(lower.z, point.z)
                upper.x = max(upper.x, point.x)
                upper.y = max(upper.y, point.y)
                upper.z = max(upper.z, point.z)
        finally:
            evaluated.to_mesh_clear()
    return lower, upper


def assign_action(armature: bpy.types.Object, action: bpy.types.Action) -> None:
    """Bind an action and its Blender 4.4+ slot to the imported armature."""
    armature.animation_data.action = action
    if hasattr(armature.animation_data, "action_slot") and len(action.slots) == 1:
        armature.animation_data.action_slot = action.slots[0]


def main() -> None:
    args = arguments()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    if not args.use_open_sidecar:
        bpy.ops.wm.read_factory_settings(use_empty=True)
    objects_before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(args.source_glb.resolve()))
    scene = bpy.context.scene
    imported_objects = [obj for obj in scene.objects if obj not in objects_before]
    armatures = [obj for obj in imported_objects if obj.type == "ARMATURE"]
    if len(armatures) != 1:
        raise RuntimeError(f"Expected one imported armature, found {len(armatures)}")
    armature = armatures[0]
    meshes = [obj for obj in skinned_meshes(scene) if obj in imported_objects]
    if not meshes:
        raise RuntimeError("No skinned meshes found in source GLB")

    for obj in scene.objects:
        if obj.type == "MESH" and obj not in meshes:
            obj.hide_render = True

    if not args.use_open_sidecar:
        with bpy.data.libraries.load(str(args.sidecar_blend.resolve())) as (
            available,
            requested,
        ):
            missing = sorted(set(ACTION_NAMES) - set(available.actions))
            if missing:
                raise RuntimeError(f"Sidecar blend lacks actions: {missing}")
            requested.actions = list(ACTION_NAMES)
    else:
        missing = sorted(set(ACTION_NAMES) - set(bpy.data.actions.keys()))
        if missing:
            raise RuntimeError(f"Open sidecar blend lacks actions: {missing}")

    actions = {name: bpy.data.actions[name] for name in ACTION_NAMES}
    armature.animation_data_create()

    all_bounds = []
    ground_z = {}
    for name in ACTION_NAMES:
        assign_action(armature, actions[name])
        action_bounds = []
        for frame in samples(actions[name]):
            scene.frame_set(frame)
            bpy.context.view_layer.update()
            bounds = evaluated_bounds(meshes)
            all_bounds.append(bounds)
            action_bounds.append(bounds)
        ground_z[name] = min(lower.z for lower, _ in action_bounds)

    lower = Vector(
        tuple(min(bounds[0][axis] for bounds in all_bounds) for axis in range(3))
    )
    upper = Vector(
        tuple(max(bounds[1][axis] for bounds in all_bounds) for axis in range(3))
    )
    center = (lower + upper) * 0.5

    camera_data = bpy.data.cameras.new("QualityGateCamera")
    camera = bpy.data.objects.new("QualityGateCamera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera_data.type = "ORTHO"
    camera.location = center + Vector((-75.0, -75.0, 38.0))
    camera.rotation_mode = "QUATERNION"
    camera.rotation_quaternion = (center - camera.location).to_track_quat("-Z", "Y")
    bpy.context.view_layer.update()

    view = camera.matrix_world.inverted()
    projected = [
        view
        @ Vector(
            (
                upper.x if choose_x else lower.x,
                upper.y if choose_y else lower.y,
                upper.z if choose_z else lower.z,
            )
        )
        for choose_x, choose_y, choose_z in product((False, True), repeat=3)
    ]
    aspect = 16 / 9
    camera_data.ortho_scale = max(
        max(point.y for point in projected) - min(point.y for point in projected),
        (
            max(point.x for point in projected)
            - min(point.x for point in projected)
        )
        / aspect,
    ) * 1.18

    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    scene.display.shading.show_shadows = True
    scene.display.shading.show_cavity = True
    scene.display.shading.cavity_type = "WORLD"
    scene.display.shading.background_type = "WORLD"
    scene.display.shading.show_specular_highlight = True
    for obj in meshes:
        obj.color = (0.54, 0.58, 0.64, 1.0)

    scene.render.resolution_x = 480
    scene.render.resolution_y = 270
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False

    rendered = []
    for name in ACTION_NAMES:
        assign_action(armature, actions[name])
        for frame in samples(actions[name]):
            scene.frame_set(frame)
            bpy.context.view_layer.update()
            path = args.output_dir / f"{name}__f{frame:03d}.png"
            scene.render.filepath = str(path)
            bpy.ops.render.render(write_still=True)
            rendered.append(str(path))

    print(f"rendered:{len(rendered)} output:{args.output_dir}")
    for name in ACTION_NAMES:
        print(f"ground-z:{name}:{ground_z[name]:+.3f}")


if __name__ == "__main__":
    main()
