"""Blender-side exporter used by build-sidecar.py.

This file is intentionally tiny: validation belongs in the outer build script,
while Blender only selects the armature hierarchy and writes a meshless GLB.
"""

from __future__ import annotations

import pathlib
import sys

import bpy


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if len(argv) != 1:
        raise SystemExit("expected output GLB path after --")
    output = pathlib.Path(argv[0]).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    if len(armatures) != 1:
        raise RuntimeError(f"expected one armature, found {len(armatures)}")

    bpy.ops.object.select_all(action="DESELECT")
    armatures[0].select_set(True)
    bpy.context.view_layer.objects.active = armatures[0]

    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_nla_strips=False,
        export_force_sampling=False,
        export_skins=False,
        export_def_bones=False,
        export_rest_position_armature=True,
        export_materials="NONE",
        export_cameras=False,
        export_lights=False,
        export_extras=True,
    )
    print(f"exported:{output}")


if __name__ == "__main__":
    main()
