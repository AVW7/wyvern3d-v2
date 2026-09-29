"""Standardized glTF / GLB exporter for Wyvern assets.

Enforces game-ready export flags, material alpha sanitization,
and strict selection isolation so helper objects and lights are never exported.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Sequence


def sanitize_materials(bpy: Any) -> None:
    """Ensure materials are opaque and free of invalid alpha connections."""
    for mat in bpy.data.materials:
        if hasattr(mat, "blend_method"):
            mat.blend_method = "OPAQUE"
        if hasattr(mat, "shadow_method"):
            mat.shadow_method = "OPAQUE"
        if getattr(mat, "use_nodes", False) and mat.node_tree:
            for node in mat.node_tree.nodes:
                if node.type == "BSDF_PRINCIPLED":
                    for inp in node.inputs:
                        if inp.name == "Alpha":
                            for link in list(inp.links):
                                mat.node_tree.links.remove(link)
                            inp.default_value = 1.0


def export_wyvern_glb(
    bpy: Any,
    output_path: str | Path,
    export_objects: Sequence[str] = ("WyvernRig", "WyvernMesh"),
) -> Path:
    """Export the designated rig and mesh to GLB with strict game engine settings."""
    sanitize_materials(bpy)

    scene = bpy.context.scene
    # Deselect all
    for obj in scene.objects:
        obj.select_set(False)

    target_objects = []
    for name in export_objects:
        obj = bpy.data.objects.get(name)
        if obj and obj.name in scene.objects:
            obj.select_set(True)
            target_objects.append(obj)

    if not target_objects:
        raise ValueError(f"None of the requested export objects exist in scene: {export_objects}")

    # Set the armature active
    armature = next((o for o in target_objects if o.type == "ARMATURE"), target_objects[0])
    bpy.context.view_layer.objects.active = armature

    out_file = Path(output_path).resolve()
    out_file.parent.mkdir(parents=True, exist_ok=True)

    bpy.ops.export_scene.gltf(
        filepath=str(out_file),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_skins=True,
        export_apply=False,
        export_yup=True,
        # Constant keyframe preservation:
        export_optimize_animation_size=False,
    )

    return out_file
