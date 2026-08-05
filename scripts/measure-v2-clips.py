#!/usr/bin/env python3
"""Measure all 16 repaired-rig clips and compare against v1 source clips.
Runs in Blender via MCP. Reports key animation metrics.
"""
import bpy, math, mathutils, json

ARM = bpy.data.objects.get("WyvernRig")
MESH = bpy.data.objects.get("WyvernMesh")

def vec_sub(a, b):
    return (a[0]-b[0], a[1]-b[1], a[2]-b[2])

def vec_dist(a, b):
    return math.sqrt(sum((a[i]-b[i])**2 for i in range(3)))

def vec_cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])

def vec_norm(a):
    l = math.sqrt(sum(x*x for x in a))
    return tuple(x/l for x in a) if l > 0 else (0,0,0)

def angle_between(v1, v2):
    """Angle in degrees between two vectors."""
    d = sum(a*b for a, b in zip(v1, v2))
    n1 = math.sqrt(sum(x*x for x in v1))
    n2 = math.sqrt(sum(x*x for x in v2))
    if n1 == 0 or n2 == 0:
        return 0.0
    c = max(-1, min(1, d / (n1 * n2)))
    return math.degrees(math.acos(c))

def bone_world(arm, bone_name, get_tail=False):
    pb = arm.pose.bones.get(bone_name)
    if not pb:
        return None
    pt = pb.tail if get_tail else pb.head
    co = arm.matrix_world @ pt
    return (co.x, co.y, co.z)

def measure_clip(arm, action, n_samples=24):
    """Sample a clip and compute key metrics."""
    arm.animation_data.action = action
    f0, f1 = int(action.frame_range[0]), int(action.frame_range[1])
    if f1 <= f0:
        f1 = f0 + 1

    samples = []
    for i in range(n_samples):
        t = f0 + (f1 - f0) * i / max(n_samples - 1, 1)
        frame = int(round(t))
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()

        l_tip = bone_world(arm, "L_WingFinger1", get_tail=True)
        r_tip = bone_world(arm, "R_WingFinger1", get_tail=True)
        l_sh = bone_world(arm, "L_WingShoulder")
        r_sh = bone_world(arm, "R_WingShoulder")
        head = bone_world(arm, "Head")
        tail_tip = bone_world(arm, "Tail10", get_tail=True)
        pelvis = bone_world(arm, "Body")
        l_foot = bone_world(arm, "L_Toes", get_tail=True)
        r_foot = bone_world(arm, "R_Toes", get_tail=True)
        neck2 = bone_world(arm, "Neck2")
        jaw = bone_world(arm, "Jaw", get_tail=True)

        # Wing elevation: angle of shoulder→tip vector above horizontal (XZ plane)
        def elev(tip, sh):
            v = vec_sub(tip, sh)
            h = math.sqrt(v[0]**2 + v[2]**2)
            return math.degrees(math.atan2(v[1], h)) if h > 0 else 0

        l_elev = elev(l_tip, l_sh)
        r_elev = elev(r_tip, r_sh)

        # Wing extension
        l_ext = vec_dist(l_tip, l_sh)
        r_ext = vec_dist(r_tip, r_sh)

        # Body axis: head→tail pitch
        body_v = vec_sub(head, tail_tip)
        body_axis = math.degrees(math.atan2(-body_v[1], math.sqrt(body_v[0]**2 + body_v[2]**2)))

        # Foot drop (pelvis z minus foot z)
        l_drop = pelvis[1] - l_foot[1]
        r_drop = pelvis[1] - r_foot[1]

        samples.append({
            'frame': frame,
            'l_elev': round(l_elev, 1),
            'r_elev': round(r_elev, 1),
            'l_ext': round(l_ext, 1),
            'r_ext': round(r_ext, 1),
            'body_axis': round(body_axis, 1),
            'l_drop': round(l_drop, 1),
            'r_drop': round(r_drop, 1),
            'l_tip': [round(x,1) for x in l_tip],
            'r_tip': [round(x,1) for x in r_tip],
            'pelvis': [round(x,1) for x in pelvis],
        })

    # Compute summary
    l_elevs = [s['l_elev'] for s in samples]
    r_elevs = [s['r_elev'] for s in samples]
    body_axes = [s['body_axis'] for s in samples]
    l_drops = [s['l_drop'] for s in samples]
    r_drops = [s['r_drop'] for s in samples]

    # Symmetry: wingtip distance after reflecting left through sagittal plane
    sym_errors = []
    for s in samples:
        lt = s['l_tip']
        rt = s['r_tip']
        p = s['pelvis']
        lt_rel = vec_sub(lt, p)
        rt_rel = vec_sub(rt, p)
        reflected = (-lt_rel[0], lt_rel[1], lt_rel[2])
        sym_errors.append(vec_dist(reflected, rt_rel))

    # Loop seam: first vs last sample
    seam_rot = max(
        abs(samples[0]['l_elev'] - samples[-1]['l_elev']),
        abs(samples[0]['r_elev'] - samples[-1]['r_elev']),
    )
    seam_pelvis = vec_dist(samples[0]['pelvis'], samples[-1]['pelvis'])

    return {
        'frames': [f0, f1],
        'duration_s': round((f1 - f0) / 24.0, 2),
        'elev_L_range': round(max(l_elevs) - min(l_elevs), 1),
        'elev_R_range': round(max(r_elevs) - min(r_elevs), 1),
        'elev_L_max': max(l_elevs),
        'elev_L_min': min(l_elevs),
        'elev_R_max': max(r_elevs),
        'elev_R_min': min(r_elevs),
        'body_axis_mean': round(sum(body_axes)/len(body_axes), 1),
        'body_axis_range': round(max(body_axes) - min(body_axes), 1),
        'foot_drop_L': round(sum(l_drops)/len(l_drops), 1),
        'foot_drop_R': round(sum(r_drops)/len(r_drops), 1),
        'symmetry_max': round(max(sym_errors), 2),
        'symmetry_mean': round(sum(sym_errors)/len(sym_errors), 2),
        'seam_rot': round(seam_rot, 2),
        'seam_pelvis': round(seam_pelvis, 2),
        'samples': samples,
    }


# === Measure all 16 v2 clips ===
results = {}
for action in sorted(bpy.data.actions, key=lambda a: a.name):
    try:
        results[action.name] = measure_clip(ARM, action, n_samples=24)
    except Exception as e:
        results[action.name] = {'error': str(e)}

bpy.context.scene.frame_set(0)
print("=== MEASUREMENT RESULTS ===")
print(json.dumps(results, indent=2))
result = results
