import bpy, math, os
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V1_GLB = os.path.join(ROOT, "public/models/drogon-decompressed.glb")
OUT_BLEND = os.path.join(ROOT, "public/models/Drogon_v1_walk.blend")

# Clear existing objects
for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)

# Import v1 GLB
bpy.ops.import_scene.gltf(filepath=V1_GLB)

arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
act = bpy.data.actions.get('SKM_DaenerysDragon|DaenerysDragon_Battle_Walk')
if arm.animation_data is None:
    arm.animation_data_create()
arm.animation_data.action = act

# Set frame range
bpy.context.scene.frame_start = 0
bpy.context.scene.frame_end = 59
bpy.context.scene.render.fps = 24

# Create Camera
cam_data = bpy.data.cameras.new('V1Cam')
cam_data.clip_end = 1000
cam_obj = bpy.data.objects.new('V1Cam', cam_data)
bpy.context.scene.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

# Camera positioned back and up to capture full dragon body (in meters)
cam_obj.location = Vector((18.0, -22.0, 12.0))
target = Vector((0.0, 0.0, 4.0))
direction = (target - cam_obj.location).normalized()
cam_obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

# Sunlight
sun_data = bpy.data.lights.new('Sun', type='SUN')
sun_data.energy = 4.0
sun_obj = bpy.data.objects.new('Sun', sun_data)
bpy.context.scene.collection.objects.link(sun_obj)
sun_obj.rotation_euler = (math.radians(50), math.radians(20), math.radians(40))

# Save blend file
bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
print(f"Saved {OUT_BLEND}")

# Render snapshot
bpy.context.scene.render.resolution_x = 1280
bpy.context.scene.render.resolution_y = 720
bpy.context.scene.frame_set(18)
bpy.context.view_layer.update()
render_path = "/Users/ajadvanwyk/.gemini/antigravity-ide/brain/ba636ecb-e2a0-4df3-be6d-fb32b3a67952/v1_drogon_walk_render.png"
bpy.context.scene.render.filepath = render_path
bpy.ops.render.render(write_still=True)
print(f"Rendered v1 frame 18 to {render_path}")
