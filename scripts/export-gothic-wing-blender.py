"""Export the rebuilt gothic wing to a candidate GLB.

Only the 16 gameplay actions ship. The 11 ``v1_*`` captures are reference
records kept in the blend, exactly as the shipped wyvern.glb keeps none of them.
"""
from __future__ import annotations
import argparse, sys, bpy

GAMEPLAY = {
    "attack", "bankLeft", "bankRight", "breath", "cruise", "death", "dive",
    "glide", "hover", "idle", "land", "rest", "scout", "speed", "takeoff", "walk",
}

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
parser = argparse.ArgumentParser()
parser.add_argument("--out", required=True)
args = parser.parse_args(argv)

for action in list(bpy.data.actions):
    if action.name not in GAMEPLAY:
        bpy.data.actions.remove(action)

for obj in bpy.data.objects:
    obj.select_set(obj.name in {"WyvernRig", "WyvernMesh"})
bpy.context.view_layer.objects.active = bpy.data.objects["WyvernRig"]

bpy.ops.export_scene.gltf(
    filepath=args.out,
    export_format="GLB",
    use_selection=True,
    export_animations=True,
    export_animation_mode="ACTIONS",
    export_bake_animation=False,
    export_optimize_animation_size=False,
    export_yup=True,
    export_skins=True,
    export_apply=False,
)
print(f"[export] wrote {args.out}")
