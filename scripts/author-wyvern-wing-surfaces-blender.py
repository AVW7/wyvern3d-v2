#!/usr/bin/env python3
"""Layer state-specific spar and membrane motion onto the wyvern actions.

The prior export animated only shoulder/elbow transforms.  Its membrane and
finger bones were static in every state, so the whole wing behaved as a rigid
card.  This script preserves the existing carrier animation and adds a small,
phase-delayed surface response to the wrist, three spars, and two membrane
bones on each side.

The axes were probed against the live skinned mesh (see
``probe-wyvern-wing-axes-blender.py``), not inferred from bone names:

* local +X billows both sides up together;
* local +Z sweeps the left side forward and the right side backward, so it
  must be negated on the right to be a symmetric surface flex.

All loop profiles complete whole cycles and therefore return exactly to their
first pose.  One-shot profiles use a raised-cosine pulse; death deliberately
keeps its final sag because that action is held after it completes.
"""

from __future__ import annotations

import argparse
import json
import math
import sys

import bpy
from mathutils import Euler, Quaternion


ARMATURE = "WyvernRig"
FPS = 24
SIDES = ("L", "R")
PARTS = ("Wrist", "Finger1", "Finger2", "Finger3", "Membrane1", "Membrane2")
PROFILE_PROPERTY = "wyvern_surface_response_profile"
WALK_KNUCKLE_PROPERTY = "wyvern_walk_knuckle_response"
WALK_KNUCKLE_SWAY_DEG = 1.2
GROUND_ELBOW_REVERSAL_PROPERTY = "wyvern_ground_elbow_direction_reversed"
GROUND_ELBOW_REVERSAL_ACTIONS = ("idle", "walk", "rest")

# Degrees.  The configuration is deliberately about distinct flight states,
# not a single flutter copied over every clip:
#
# - cruise / hover / speed follow their powered wingbeat cadence;
# - scout uses an economical, broad surface response;
# - banks differentially trim the two wing surfaces via their existing carrier
#   while this layer supplies the small trailing ripple;
# - glide and dive use wind-load ripple rather than a powered flap;
# - takeoff, landing, attack and breath brace and release once;
# - idle/walk keep a barely perceptible settle; rest remains intentionally
#   still, so sleeping is not mistaken for nervous flight readiness.
#
# ``pulse`` changes a one-shot's envelope from a looping sinusoid to a
# raised-cosine 0 -> 1 -> 0 motion.  ``settle`` is a one-way terminal sag.
PROFILES = {
    "idle":    {"cycles": 2, "wrist": (0.18, 0.12), "fingers": (0.18, 0.24, 0.30), "membranes": (0.28, 0.42), "sweep": 0.12},
    "walk":    {"cycles": 2, "wrist": (0.16, 0.10), "fingers": (0.14, 0.20, 0.24), "membranes": (0.24, 0.34), "sweep": 0.10},
    "cruise":  {"cycles": 2, "wrist": (0.90, 0.65), "fingers": (0.95, 1.25, 1.50), "membranes": (1.65, 2.25), "sweep": 0.70},
    "scout":   {"cycles": 2, "wrist": (0.65, 0.48), "fingers": (0.70, 0.95, 1.15), "membranes": (1.20, 1.65), "sweep": 0.52},
    "bankLeft":  {"cycles": 3, "wrist": (0.70, 0.55), "fingers": (0.75, 1.00, 1.20), "membranes": (1.30, 1.80), "sweep": 0.64},
    "bankRight": {"cycles": 3, "wrist": (0.70, 0.55), "fingers": (0.75, 1.00, 1.20), "membranes": (1.30, 1.80), "sweep": 0.64},
    "hover":   {"cycles": 4, "wrist": (1.20, 0.88), "fingers": (1.25, 1.65, 2.00), "membranes": (2.10, 2.90), "sweep": 0.95},
    "glide":   {"cycles": 2, "wrist": (0.38, 0.28), "fingers": (0.42, 0.58, 0.72), "membranes": (0.75, 1.05), "sweep": 0.32},
    "dive":    {"cycles": 3, "wrist": (0.50, 0.38), "fingers": (0.55, 0.72, 0.88), "membranes": (0.95, 1.30), "sweep": 0.44},
    "speed":   {"cycles": 5, "wrist": (0.72, 0.50), "fingers": (0.78, 1.02, 1.25), "membranes": (1.35, 1.88), "sweep": 0.58},
    "attack":  {"cycles": 1, "wrist": (0.72, 0.55), "fingers": (0.76, 1.00, 1.25), "membranes": (1.35, 1.85), "sweep": 0.60, "pulse": True},
    "breath":  {"cycles": 1, "wrist": (0.35, 0.26), "fingers": (0.38, 0.50, 0.62), "membranes": (0.68, 0.92), "sweep": 0.28, "pulse": True},
    "takeoff": {"cycles": 2, "wrist": (1.15, 0.84), "fingers": (1.20, 1.58, 1.92), "membranes": (2.00, 2.75), "sweep": 0.90},
    "land":    {"cycles": 1, "wrist": (0.88, 0.66), "fingers": (0.92, 1.20, 1.48), "membranes": (1.55, 2.15), "sweep": 0.72, "pulse": True},
    "death":   {"cycles": 1, "wrist": (2.10, 0.78), "fingers": (2.25, 2.90, 3.55), "membranes": (3.70, 5.10), "sweep": 1.10, "settle": True},
}

# A trailing membrane must lag the wrist and its supporting spar.  The far
# spar lags most, turning a bulk rotation into a surface wave.
PHASES = {
    "Wrist": 0.00,
    "Finger1": 0.24,
    "Finger2": 0.44,
    "Finger3": 0.68,
    "Membrane1": 0.52,
    "Membrane2": 0.86,
}


def bind(armature, action):
    armature.animation_data_create()
    armature.animation_data.action = action
    if action.slots:
        armature.animation_data.action_slot = action.slots[0]


def wave(profile, time, phase):
    """State envelope, exact at the boundaries of looped actions."""
    if profile.get("settle"):
        # The death action is one-shot and held, so the wing surface ends loose
        # rather than returning to its living tension.
        return 0.5 - 0.5 * math.cos(math.pi * time)
    if profile.get("pulse"):
        return math.sin(math.pi * time) * math.sin(math.pi * time + phase * 0.18)
    return math.sin(2.0 * math.pi * profile["cycles"] * time - phase)


def local_delta(profile, side, part, time):
    """A local rotation added after the existing authored value."""
    response = wave(profile, time, PHASES[part])
    # A little out-of-phase sweep prevents the surface from moving as six
    # locked planks while still keeping the left/right silhouette mirrored.
    sweep_response = wave(profile, time, PHASES[part] + 0.62)
    if part == "Wrist":
        billow, sweep = profile["wrist"]
    elif part.startswith("Finger"):
        billow = profile["fingers"][int(part[-1]) - 1]
        sweep = profile["sweep"] * (0.62 + 0.11 * int(part[-1]))
    else:
        billow = profile["membranes"][int(part[-1]) - 1]
        sweep = profile["sweep"] * (0.82 + 0.18 * int(part[-1]))
    side_sweep = sweep if side == "L" else -sweep
    return Euler(
        (math.radians(billow * response), 0.0, math.radians(side_sweep * sweep_response)),
        "XYZ",
    ).to_quaternion()


def target_names():
    return tuple(f"{side}_Wing{part}" for side in SIDES for part in PARTS)


def set_linear_interpolation(action, targets):
    """Dense frame keys should evaluate to the sampled pose, with no overshoot."""
    for layer in action.layers:
        for strip in layer.strips:
            if strip.type != "KEYFRAME":
                continue
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    if '"' not in curve.data_path:
                        continue
                    bone = curve.data_path.split('"')[1]
                    if bone not in targets or not curve.data_path.endswith("rotation_quaternion"):
                        continue
                    for key in curve.keyframe_points:
                        key.interpolation = "LINEAR"
                    curve.update()


def author_action(armature, action, profile):
    bind(armature, action)
    first, last = (round(value) for value in action.frame_range)
    if last <= first:
        raise SystemExit(f"{action.name}: invalid frame range {tuple(action.frame_range)}")
    targets = target_names()
    missing = sorted(set(targets) - set(armature.pose.bones.keys()))
    if missing:
        raise SystemExit(f"{action.name}: missing wing bones: {', '.join(missing)}")

    # Capture the imported, fully-baked local rotations before replacing any
    # surface track. This keeps action-specific wrist posing intact. If this
    # action already carries a response from this script, first subtract that
    # recorded response; re-running the command then replaces the layer rather
    # than adding the same flex a second time.
    previous_profile = action.get(PROFILE_PROPERTY)
    previous_profile = json.loads(previous_profile) if previous_profile else None
    bases = {}
    for frame in range(first, last + 1):
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        time = (frame - first) / (last - first)
        bases[frame] = {}
        for name in targets:
            rotation = armature.pose.bones[name].rotation_quaternion.copy()
            if previous_profile:
                side, part = name.split("_Wing", 1)
                rotation = rotation @ local_delta(
                    previous_profile, side, part, time,
                ).inverted()
            bases[frame][name] = rotation

    previous = {}
    for frame in range(first, last + 1):
        bpy.context.scene.frame_set(frame)
        time = (frame - first) / (last - first)
        for side in SIDES:
            for part in PARTS:
                name = f"{side}_Wing{part}"
                pose_bone = armature.pose.bones[name]
                pose_bone.rotation_mode = "QUATERNION"
                rotation = bases[frame][name] @ local_delta(profile, side, part, time)
                if name in previous:
                    rotation.make_compatible(previous[name])
                pose_bone.rotation_quaternion = rotation
                pose_bone.keyframe_insert(
                    data_path="rotation_quaternion", frame=frame, group=name
                )
                previous[name] = rotation.copy()

    set_linear_interpolation(action, targets)
    action.use_frame_range = True
    action.frame_start, action.frame_end = float(first), float(last)
    action[PROFILE_PROPERTY] = json.dumps(profile, sort_keys=True)
    print(f"authored {action.name}: wing surface response on {len(targets)} bones")


def author_walk_knuckles(armature, action):
    """Keep the fully folded walk wings as alternating front-limb supports.

    The closed-wing pose is intentionally not a strict mirror during walking:
    the two knuckles alternate contact.  This only adds a tiny local-X carrier
    offset to the already-authored shoulder pose, preserving its tailward fold
    and the finger/membrane response written above.
    """
    first, last = (round(value) for value in action.frame_range)
    names = ("L_WingShoulder", "R_WingShoulder")
    previous_sway = float(action.get(WALK_KNUCKLE_PROPERTY, 0.0))
    bases = {}
    for frame in range(first, last + 1):
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        time = (frame - first) / (last - first)
        phase = math.sin(math.tau * time)
        bases[frame] = {}
        for name in names:
            side = 1.0 if name.startswith("L_") else -1.0
            rotation = armature.pose.bones[name].rotation_quaternion.copy()
            if previous_sway:
                rotation = rotation @ Euler(
                    (math.radians(-side * previous_sway * phase), 0.0, 0.0), "XYZ",
                ).to_quaternion()
            bases[frame][name] = rotation

    previous = {}
    for frame in range(first, last + 1):
        bpy.context.scene.frame_set(frame)
        time = (frame - first) / (last - first)
        phase = math.sin(math.tau * time)
        for name in names:
            side = 1.0 if name.startswith("L_") else -1.0
            rotation = bases[frame][name] @ Euler(
                (math.radians(side * WALK_KNUCKLE_SWAY_DEG * phase), 0.0, 0.0), "XYZ",
            ).to_quaternion()
            if name in previous:
                rotation.make_compatible(previous[name])
            bone = armature.pose.bones[name]
            bone.rotation_mode = "QUATERNION"
            bone.rotation_quaternion = rotation
            bone.keyframe_insert(data_path="rotation_quaternion", frame=frame, group=name)
            previous[name] = rotation.copy()

    set_linear_interpolation(action, names)
    action[WALK_KNUCKLE_PROPERTY] = WALK_KNUCKLE_SWAY_DEG
    print(f"authored walk: {WALK_KNUCKLE_SWAY_DEG:.1f}° alternating wing-knuckle carrier")


def author():
    armature = bpy.data.objects.get(ARMATURE)
    if armature is None or armature.type != "ARMATURE":
        raise SystemExit(f"armature {ARMATURE!r} not found")
    for name, profile in PROFILES.items():
        action = bpy.data.actions.get(name)
        if action is None:
            raise SystemExit(f"action {name!r} not found")
        author_action(armature, action, profile)
        if name == "walk":
            author_walk_knuckles(armature, action)



def export(path):
    armature = bpy.data.objects.get(ARMATURE)
    mesh = bpy.data.objects.get("WyvernMesh")
    if mesh is None or mesh.type != "MESH":
        raise SystemExit("mesh 'WyvernMesh' not found")
    for obj in bpy.context.scene.objects:
        obj.select_set(obj in (armature, mesh))
    bpy.context.view_layer.objects.active = armature
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_skins=True,
        export_apply=False,
        export_yup=True,
        export_optimize_animation_size=False,
    )
    print(f"exported {path}")


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--save", action="store_true", help="write the .blend source")
    parser.add_argument("--export", default="", metavar="PATH", help="write a GLB")
    args, _ = parser.parse_known_args(argv)
    bpy.context.scene.render.fps = FPS
    author()
    if args.export:
        export(args.export)
    if args.save:
        bpy.ops.wm.save_mainfile()
        print(f"saved {bpy.data.filepath}")


if __name__ == "__main__":
    main()
