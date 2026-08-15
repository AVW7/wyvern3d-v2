"""Export the rebuilt gothic wing to a candidate GLB.

Only the 18 gameplay actions ship. The ``v1_*`` captures are reference records
kept in the blend, exactly as the shipped wyvern.glb keeps none of them --
except where one has been promoted under a gameplay name, which is how
``attack2`` and ``attackAir2`` (v1's `Battle_Attack06` and `Battle_Attack04`)
reach the manifest. See ``author-wyvern-attack-variants-blender.py``.
"""
from __future__ import annotations
import argparse, sys, bpy

GAMEPLAY = {
    "attack", "bankLeft", "bankRight", "breath", "cruise", "death", "dive",
    "glide", "hover", "idle", "land", "rest", "scout", "speed", "takeoff", "walk",
    "attack2", "attackAir2",
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

for mat in bpy.data.materials:
    if hasattr(mat, "blend_method"):
        mat.blend_method = "OPAQUE"
    if hasattr(mat, "shadow_method"):
        mat.shadow_method = "OPAQUE"
    if mat.use_nodes and mat.node_tree:
        for n in mat.node_tree.nodes:
            if n.type == "BSDF_PRINCIPLED":
                for inp in n.inputs:
                    if inp.name == "Alpha":
                        for link in list(inp.links):
                            mat.node_tree.links.remove(link)
                        inp.default_value = 1.0

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
