#!/usr/bin/env python3
"""Create the Thornwing rig, skin, seven actions, and web GLB in Blender.

The committed optimized display GLB is the only input. The mesh is bound in its
authored display pose, then every action supplies a balanced runtime carrier.
Grounded actions receive a measured visual RootMotion correction so the runtime
does not need a large static lift that makes alternate gait frames hover. No
external .blend or million-triangle Meshy source is required.

Coordinate contract: +X left, -Y forward, +Z up. Pose rotations are quaternion
keys made from local XYZ Euler deltas. The custom front legs supplement the
canonical runtime bone names used by gaze, tail, hind-leg, and flight layers.
"""

from __future__ import annotations

import argparse
import math
import pathlib
import sys
from collections.abc import Callable

import bpy
from mathutils import Euler, Vector

FPS = 24
ARMATURE = "ThornwingRig"
MESH = "GEO-Thornwing"

CLIPS = {
    "idle": 144,
    "walk": 48,
    "takeoff": 48,
    "cruise": 72,
    "land": 48,
    "attack": 36,
    "death": 72,
}


def arguments() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=pathlib.Path, required=True)
    parser.add_argument("--output", type=pathlib.Path, required=True)
    return parser.parse_args(argv)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.armatures, bpy.data.actions):
        for item in list(block):
            block.remove(item)


def import_mesh(source: pathlib.Path) -> bpy.types.Object:
    bpy.ops.import_scene.gltf(filepath=str(source))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(meshes) != 1:
        raise SystemExit(f"expected one source mesh, found {len(meshes)}")
    mesh = meshes[0]
    mesh.name = MESH
    mesh.data.name = f"{MESH}-mesh"
    bpy.context.view_layer.objects.active = mesh
    mesh.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    for polygon in mesh.data.polygons:
        polygon.use_smooth = True
    return mesh


def create_rig() -> tuple[bpy.types.Object, set[str]]:
    data = bpy.data.armatures.new(ARMATURE)
    armature = bpy.data.objects.new(ARMATURE, data)
    bpy.context.collection.objects.link(armature)
    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    deform: set[str] = set()

    def bone(
        name: str,
        head: tuple[float, float, float],
        tail: tuple[float, float, float],
        parent: str | None = None,
        use_deform: bool = True,
    ) -> None:
        edit = data.edit_bones.new(name)
        edit.head = head
        edit.tail = tail
        edit.use_deform = use_deform
        if parent:
            edit.parent = data.edit_bones[parent]
        if use_deform:
            deform.add(name)

    bone("Root", (0, 0, -0.86), (0, 0, -0.76), use_deform=False)
    bone("RootMotion", (0, 0, -0.76), (0, 0, -0.66), "Root", False)
    bone("Body", (0, 0.27, -0.16), (0, 0.14, -0.02), "RootMotion")
    bone("Spine1", (0, 0.14, -0.02), (0, 0.02, 0.09), "Body")
    bone("Spine2", (0, 0.02, 0.09), (0, -0.11, 0.20), "Spine1")
    bone("Spine3", (0, -0.11, 0.20), (0, -0.25, 0.32), "Spine2")
    bone("Neck1", (0, -0.25, 0.32), (0, -0.38, 0.49), "Spine3")
    bone("Neck2", (0, -0.38, 0.49), (0, -0.54, 0.63), "Neck1")
    bone("Head", (0, -0.54, 0.63), (0, -0.77, 0.62), "Neck2")
    bone("Jaw", (0, -0.58, 0.58), (0, -0.79, 0.53), "Head")

    tail_points = [
        (0.00, 0.27, -0.16), (0.04, 0.40, -0.22), (0.16, 0.53, -0.29),
        (0.34, 0.66, -0.36), (0.55, 0.71, -0.43), (0.73, 0.60, -0.49),
        (0.82, 0.39, -0.54), (0.81, 0.14, -0.58), (0.70, -0.10, -0.60),
        (0.51, -0.31, -0.61), (0.29, -0.48, -0.60),
    ]
    for index in range(10):
        bone(
            f"Tail{index + 1}", tail_points[index], tail_points[index + 1],
            "Body" if index == 0 else f"Tail{index}",
        )

    def paired(prefix: str, side: str) -> str:
        return f"{side}_{prefix}"

    for side, sign in (("L", 1.0), ("R", -1.0)):
        wing = {
            "WingRoot": ((0.12 * sign, -0.18, 0.29), (0.18 * sign, -0.17, 0.29), "Spine3", False),
            "WingShoulder": ((0.18 * sign, -0.17, 0.29), (0.34 * sign, -0.13, 0.22), paired("WingRoot", side), True),
            "WingElbow": ((0.34 * sign, -0.13, 0.22), (0.50 * sign, -0.06, 0.02), paired("WingShoulder", side), True),
            "WingWrist": ((0.50 * sign, -0.06, 0.02), (0.63 * sign, 0.04, -0.27), paired("WingElbow", side), True),
        }
        for name, (head, tail, parent, use_deform) in wing.items():
            bone(paired(name, side), head, tail, parent, use_deform)
        fingers = [
            ("WingFinger1", (0.63 * sign, 0.04, -0.27), (0.78 * sign, 0.13, -0.64), "WingWrist"),
            ("WingFinger1_end", (0.78 * sign, 0.13, -0.64), (0.84 * sign, 0.22, -0.82), "WingFinger1"),
            ("WingFinger2", (0.61 * sign, 0.07, -0.25), (0.66 * sign, 0.25, -0.61), "WingWrist"),
            ("WingFinger2_end", (0.66 * sign, 0.25, -0.61), (0.66 * sign, 0.39, -0.82), "WingFinger2"),
            ("WingFinger3", (0.58 * sign, 0.09, -0.23), (0.51 * sign, 0.36, -0.58), "WingWrist"),
            ("WingFinger3_end", (0.51 * sign, 0.36, -0.58), (0.42 * sign, 0.53, -0.76), "WingFinger3"),
            ("WingClaw", (0.61 * sign, 0.01, -0.22), (0.71 * sign, -0.04, -0.37), "WingWrist"),
            ("WingMembrane1", (0.34 * sign, -0.10, 0.17), (0.39 * sign, 0.22, -0.31), "WingShoulder"),
            ("WingMembrane2", (0.39 * sign, 0.22, -0.31), (0.28 * sign, 0.48, -0.64), "WingMembrane1"),
        ]
        for name, head, tail, parent in fingers:
            bone(paired(name, side), head, tail, paired(parent, side))

        bone(paired("LegRoot", side), (0.12 * sign, 0.20, -0.11), (0.17 * sign, 0.21, -0.16), "Body", False)
        bone(paired("Thigh", side), (0.17 * sign, 0.21, -0.16), (0.24 * sign, 0.31, -0.39), paired("LegRoot", side))
        bone(paired("Calf", side), (0.24 * sign, 0.31, -0.39), (0.25 * sign, 0.48, -0.62), paired("Thigh", side))
        bone(paired("Foot", side), (0.25 * sign, 0.48, -0.62), (0.27 * sign, 0.54, -0.80), paired("Calf", side))
        bone(paired("Toes", side), (0.27 * sign, 0.54, -0.80), (0.30 * sign, 0.42, -0.85), paired("Foot", side))

        bone(paired("FrontLegRoot", side), (0.12 * sign, -0.20, 0.10), (0.18 * sign, -0.22, 0.04), "Spine3", False)
        bone(paired("FrontUpper", side), (0.18 * sign, -0.22, 0.04), (0.25 * sign, -0.30, -0.22), paired("FrontLegRoot", side))
        bone(paired("FrontLower", side), (0.25 * sign, -0.30, -0.22), (0.29 * sign, -0.39, -0.54), paired("FrontUpper", side))
        bone(paired("FrontFoot", side), (0.29 * sign, -0.39, -0.54), (0.32 * sign, -0.48, -0.80), paired("FrontLower", side))

    bpy.ops.object.mode_set(mode="OBJECT")
    return armature, deform


def point_segment_distance(point: Vector, head: Vector, tail: Vector) -> float:
    segment = tail - head
    length_sq = segment.length_squared
    if length_sq == 0:
        return (point - head).length
    amount = max(0.0, min(1.0, (point - head).dot(segment) / length_sq))
    return (point - (head + segment * amount)).length


def skin(mesh: bpy.types.Object, armature: bpy.types.Object, deform: set[str]) -> None:
    """Assign smooth proximity weights, pruned and normalized to four bones."""
    segments = {
        name: (armature.data.bones[name].head_local.copy(), armature.data.bones[name].tail_local.copy())
        for name in sorted(deform)
    }
    groups = {name: mesh.vertex_groups.new(name=name) for name in segments}
    for vertex in mesh.data.vertices:
        point = vertex.co
        distances: list[tuple[float, str]] = []
        for name, (head, tail) in segments.items():
            distance = point_segment_distance(point, head, tail)
            if name.startswith("L_") and point.x < -0.025:
                distance += 0.32
            elif name.startswith("R_") and point.x > 0.025:
                distance += 0.32
            distances.append((distance, name))
        nearest = sorted(distances)[:4]
        raw = [(1.0 / max(0.012, distance) ** 3.0, name) for distance, name in nearest]
        total = sum(weight for weight, _ in raw)
        for weight, name in raw:
            groups[name].add([vertex.index], weight / total, "REPLACE")
    modifier = mesh.modifiers.new("ThornwingArmature", "ARMATURE")
    modifier.object = armature
    mesh.parent = armature
    print(f"skinned {len(mesh.data.vertices)} vertices to {len(segments)} deform bones (max 4 weights)")


def apply_neutral_rest_pose(
    armature: bpy.types.Object,
    neutral: dict[str, tuple[float, float, float]],
) -> None:
    """Declare the already-baked balanced derivative pose as its new rest."""
    for bone in armature.pose.bones:
        bone.rotation_mode = "QUATERNION"
        bone.rotation_quaternion = Euler(neutral.get(bone.name, (0.0, 0.0, 0.0)), "XYZ").to_quaternion()
        bone.location = (0.0, 0.0, 0.0)
        bone.scale = (1.0, 1.0, 1.0)
    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)
    bpy.ops.object.mode_set(mode="POSE")
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    print("applied symmetric neutral rest pose")


def freeze_neutral_skin(mesh: bpy.types.Object) -> None:
    """Bake the posed derivative's vertices before making the pose the rest.

    Applying only the armature pose updates bind matrices and can leave the
    rendered skin byte-for-byte in its old display stance. Freezing evaluated
    coordinates first makes the neutral result observable while the committed
    source GLB remains untouched.
    """
    graph = bpy.context.evaluated_depsgraph_get()
    graph.update()
    evaluated = mesh.evaluated_get(graph)
    posed = evaluated.to_mesh()
    try:
        if len(posed.vertices) != len(mesh.data.vertices):
            raise SystemExit("neutral bake changed vertex count")
        world_to_local = mesh.matrix_world.inverted()
        for source, target in zip(posed.vertices, mesh.data.vertices):
            target.co = world_to_local @ (evaluated.matrix_world @ source.co)
        mesh.data.update()
    finally:
        evaluated.to_mesh_clear()
    print("baked neutral derivative vertices")


def bind_action(armature: bpy.types.Object, action: bpy.types.Action) -> None:
    if armature.animation_data is None:
        armature.animation_data_create()
    armature.animation_data.action = action
    if getattr(action, "slots", None):
        armature.animation_data.action_slot = action.slots[0]


def skin_low(mesh: bpy.types.Object) -> float:
    """Return the lowest evaluated skinned vertex in scene coordinates."""
    graph = bpy.context.evaluated_depsgraph_get()
    graph.update()
    evaluated = mesh.evaluated_get(graph)
    data = evaluated.to_mesh()
    try:
        return min((evaluated.matrix_world @ vertex.co).z for vertex in data.vertices)
    finally:
        evaluated.to_mesh_clear()


def begin_action(armature: bpy.types.Object, name: str) -> bpy.types.Action:
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    if armature.animation_data is None:
        armature.animation_data_create()
    armature.animation_data.action = action
    slot = action.slots.new(id_type="OBJECT", name=ARMATURE)
    armature.animation_data.action_slot = slot
    layer = action.layers.new(name)
    strip = layer.strips.new(type="KEYFRAME")
    strip.channelbags.new(slot)
    return action


def smoothstep(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def author_actions(armature: bpy.types.Object) -> None:
    pose_names = [bone.name for bone in armature.pose.bones]

    def build(name: str, frames: int, pose: Callable[[float, int], tuple[dict[str, tuple[float, float, float]], dict[str, tuple[float, float, float]]]]) -> None:
        action = begin_action(armature, name)
        for frame in range(frames + 1):
            t = frame / frames
            rotations, locations = pose(t, frame)
            for bone_name in pose_names:
                bone = armature.pose.bones[bone_name]
                bone.rotation_mode = "QUATERNION"
                xyz = rotations.get(bone_name, (0.0, 0.0, 0.0))
                bone.rotation_quaternion = Euler(xyz, "XYZ").to_quaternion()
                bone.location = locations.get(bone_name, (0.0, 0.0, 0.0))
                bone.keyframe_insert("rotation_quaternion", frame=frame, group=bone_name)
                bone.keyframe_insert("location", frame=frame, group=bone_name)
        action.use_frame_range = True
        action.frame_start = 0.0
        action.frame_end = float(frames)
        for layer in action.layers:
            for strip in layer.strips:
                if not hasattr(strip, "channelbags"):
                    continue
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        for key in curve.keyframe_points:
                            key.interpolation = "BEZIER"
                            key.handle_left_type = "AUTO_CLAMPED"
                            key.handle_right_type = "AUTO_CLAMPED"
        print(f"authored {name}: {frames} frames / {frames / FPS:.2f}s")

    def idle(t: float, _frame: int):
        phase = math.tau * t
        rotations = {
            "Spine2": (math.radians(1.8) * math.sin(phase), 0, 0),
            "Neck1": (math.radians(-2.0) * math.sin(phase - 0.4), 0, math.radians(1.2) * math.sin(phase * 0.5)),
            "Neck2": (math.radians(2.4) * math.sin(phase - 0.65), 0, 0),
            "Head": (math.radians(1.4) * math.sin(phase - 0.9), 0, math.radians(2.0) * math.sin(phase * 0.5)),
            "L_WingShoulder": (0, math.radians(1.5) * math.sin(phase - 0.2), 0),
            "R_WingShoulder": (0, -math.radians(1.5) * math.sin(phase - 0.2), 0),
        }
        for index in range(1, 11):
            rotations[f"Tail{index}"] = (0, 0, math.radians(1.6) * math.sin(phase - index * 0.23))
        return rotations, {"Body": (0, 0, 0.008 * math.sin(phase))}

    def walk(t: float, _frame: int):
        phase = math.tau * t
        rotations: dict[str, tuple[float, float, float]] = {
            "Body": (math.radians(6), 0, 0),
            "Spine1": (math.radians(2.0) * math.sin(phase * 2), 0, 0),
            "Neck1": (math.radians(-3.0) * math.sin(phase * 2 - 0.4), 0, math.radians(2.0) * math.sin(phase)),
            "Head": (math.radians(2.0) * math.sin(phase * 2 - 0.8), 0, -math.radians(2.0) * math.sin(phase)),
        }
        for side, sign in (("L", 1.0), ("R", -1.0)):
            diagonal = phase + (0 if side == "L" else math.pi)
            hind = math.sin(diagonal)
            front = math.sin(diagonal + math.pi)
            rotations[f"{side}_Thigh"] = (math.radians(18) * hind, 0, math.radians(2) * sign)
            rotations[f"{side}_Calf"] = (math.radians(-14) * max(0.0, -hind), 0, 0)
            rotations[f"{side}_Foot"] = (math.radians(10) * max(0.0, hind), 0, 0)
            rotations[f"{side}_FrontUpper"] = (math.radians(17) * front, 0, -math.radians(2) * sign)
            rotations[f"{side}_FrontLower"] = (math.radians(-13) * max(0.0, -front), 0, 0)
            rotations[f"{side}_FrontFoot"] = (math.radians(8) * max(0.0, front), 0, 0)
            rotations[f"{side}_WingShoulder"] = (0, math.radians(2.2) * math.sin(phase * 2) * sign, 0)
        for index in range(1, 11):
            rotations[f"Tail{index}"] = (0, 0, math.radians(2.5) * math.sin(phase - index * 0.18))
        return rotations, {"Body": (0, 0, 0.018 * (1.0 - math.cos(phase * 2)))}

    def cruise(t: float, _frame: int):
        phase = math.tau * 2.0 * t
        rotations: dict[str, tuple[float, float, float]] = {
            # The source is an upright display pose. Rotating the carrier about
            # local +X establishes the long, near-horizontal flight body line.
            "Body": (math.radians(34), 0, 0),
            "Spine1": (math.radians(-3), 0, 0),
            "Neck1": (math.radians(8) + math.radians(2) * math.sin(phase - 0.5), 0, 0),
            "Neck2": (math.radians(-5) + math.radians(1.5) * math.sin(phase - 0.8), 0, 0),
        }
        stroke = math.radians(58) * math.sin(phase)
        recover = math.radians(12) * math.cos(phase)
        for side, sign in (("L", 1.0), ("R", -1.0)):
            rotations[f"{side}_WingShoulder"] = (0, stroke * sign, recover * sign)
            rotations[f"{side}_WingElbow"] = (0, -stroke * 0.35 * sign, -recover * 0.5 * sign)
            rotations[f"{side}_WingWrist"] = (0, stroke * 0.18 * sign, recover * 0.35 * sign)
            rotations[f"{side}_Thigh"] = (math.radians(-18), 0, 0)
            rotations[f"{side}_Calf"] = (math.radians(28), 0, 0)
            rotations[f"{side}_FrontUpper"] = (math.radians(-16), 0, 0)
            rotations[f"{side}_FrontLower"] = (math.radians(24), 0, 0)
        for index in range(1, 11):
            rotations[f"Tail{index}"] = (math.radians(-2), 0, math.radians(2.2) * math.sin(phase - index * 0.22))
        return rotations, {}

    def takeoff(t: float, _frame: int):
        lift = smoothstep(t)
        power = math.sin(math.pi * min(1.0, t * 1.4))
        rotations: dict[str, tuple[float, float, float]] = {
            "Body": (math.radians(-4 + 38 * lift), 0, 0),
            "Neck1": (math.radians(-12 + 22 * lift), 0, 0),
            "Neck2": (math.radians(8 - 12 * lift), 0, 0),
        }
        for side, sign in (("L", 1.0), ("R", -1.0)):
            rotations[f"{side}_WingShoulder"] = (
                0,
                math.radians(-28 * (1 - lift) + 84 * power) * sign,
                math.radians(8 + 4 * lift) * sign,
            )
            rotations[f"{side}_WingElbow"] = (0, math.radians(20 * (1 - lift) - 30 * power) * sign, 0)
            rotations[f"{side}_Thigh"] = (math.radians(25 - 42 * lift), 0, 0)
            rotations[f"{side}_Calf"] = (math.radians(-25 + 53 * lift), 0, 0)
            rotations[f"{side}_FrontUpper"] = (math.radians(22 - 38 * lift), 0, 0)
            rotations[f"{side}_FrontLower"] = (math.radians(24 * lift), 0, 0)
        return rotations, {}

    def land(t: float, _frame: int):
        settle = smoothstep(t)
        flare = math.sin(math.pi * t)
        rotations: dict[str, tuple[float, float, float]] = {
            "Body": (math.radians(34 * (1 - settle)), 0, 0),
            "Neck1": (math.radians(10 * (1 - settle)), 0, 0),
            "Neck2": (math.radians(-4 * (1 - settle)), 0, 0),
        }
        for side, sign in (("L", 1.0), ("R", -1.0)):
            rotations[f"{side}_WingShoulder"] = (
                0,
                math.radians(54 * flare) * sign,
                math.radians(12 * (1 - settle)) * sign,
            )
            rotations[f"{side}_WingElbow"] = (0, math.radians(-22 * flare) * sign, 0)
            rotations[f"{side}_Thigh"] = (math.radians(-18 * (1 - settle)), 0, 0)
            rotations[f"{side}_Calf"] = (math.radians(28 * (1 - settle)), 0, 0)
            rotations[f"{side}_FrontUpper"] = (math.radians(-16 * (1 - settle)), 0, 0)
            rotations[f"{side}_FrontLower"] = (math.radians(24 * (1 - settle)), 0, 0)
        return rotations, {}

    def attack(t: float, _frame: int):
        if t < 0.35:
            gesture = -smoothstep(t / 0.35)
        elif t < 0.72:
            gesture = -1.0 + 2.0 * smoothstep((t - 0.35) / 0.37)
        else:
            gesture = 1.0 - smoothstep((t - 0.72) / 0.28)
        rotations = {
            "Spine2": (math.radians(-7) * gesture, 0, 0),
            "Neck1": (math.radians(18) * gesture, 0, 0),
            "Neck2": (math.radians(24) * gesture, 0, 0),
            "Head": (math.radians(-12) * gesture, 0, 0),
            "Jaw": (math.radians(34) * max(0.0, gesture), 0, 0),
        }
        return rotations, {"Body": (0, -0.06 * max(0.0, gesture), 0)}

    def death(t: float, _frame: int):
        fall = smoothstep(t)
        recoil = math.sin(math.pi * min(1.0, t * 2.5)) * (1.0 - fall)
        rotations: dict[str, tuple[float, float, float]] = {
            "Body": (math.radians(12) * recoil, math.radians(8) * fall, math.radians(78) * fall),
            "Spine2": (math.radians(-10) * recoil, 0, 0),
            "Neck1": (math.radians(20) * fall, 0, math.radians(-14) * fall),
            "Neck2": (math.radians(28) * fall, 0, math.radians(-10) * fall),
            "Jaw": (math.radians(28) * fall, 0, 0),
        }
        for side, sign in (("L", 1.0), ("R", -1.0)):
            rotations[f"{side}_WingShoulder"] = (0, math.radians(28) * fall * sign, math.radians(18) * fall * sign)
            rotations[f"{side}_Thigh"] = (math.radians(18) * fall, 0, 0)
            rotations[f"{side}_FrontUpper"] = (math.radians(-20) * fall, 0, 0)
        for index in range(1, 11):
            rotations[f"Tail{index}"] = (0, 0, math.radians(2.5 * index) * fall)
        return rotations, {"Body": (0, 0, -0.18 * fall)}

    for name, frames, pose in (
        ("idle", CLIPS["idle"], idle), ("walk", CLIPS["walk"], walk),
        ("takeoff", CLIPS["takeoff"], takeoff), ("cruise", CLIPS["cruise"], cruise),
        ("land", CLIPS["land"], land), ("attack", CLIPS["attack"], attack),
        ("death", CLIPS["death"], death),
    ):
        build(name, frames, pose)
    armature.animation_data.action = None


def align_grounded_actions(armature: bpy.types.Object, mesh: bpy.types.Object) -> None:
    """Bake cosmetic ground alignment without giving gameplay root authority.

    Idle, walk, attack, and death keep their lowest skinned point on the local
    ground plane at every authored frame. Takeoff starts planted and releases
    its correction after the push; landing acquires the correction as it
    settles. Cruise stays at the authored flight origin and is therefore the
    only clip whose RootMotion must remain exactly still.
    """

    actions = {action.name: action for action in bpy.data.actions if action.name in CLIPS}
    root = armature.pose.bones["RootMotion"]

    def influence(name: str, t: float) -> float:
        if name == "cruise":
            return 0.0
        if name == "takeoff":
            return 1.0 - smoothstep((t - 0.30) / 0.70)
        if name == "land":
            return smoothstep(t)
        return 1.0

    for name in CLIPS:
        action = actions[name]
        bind_action(armature, action)
        start, end = (round(value) for value in action.frame_range)
        corrections: list[float] = []
        for frame in range(start, end + 1):
            bpy.context.scene.frame_set(frame)
            amount = max(0.0, -skin_low(mesh)) * influence(name, (frame - start) / (end - start))
            # RootMotion points along scene +Z, so Blender's bone-local Y is
            # the measured vertical translation channel for this armature.
            root.location.y += amount
            root.keyframe_insert("location", frame=frame, group="RootMotion")
            corrections.append(root.location.y)

        # A keyed correction on every frame should interpolate monotonically;
        # cubic handles can otherwise dip between the validator's samples.
        for layer in action.layers:
            for strip in layer.strips:
                if not hasattr(strip, "channelbags"):
                    continue
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        if "RootMotion" in curve.data_path and curve.data_path.endswith("location"):
                            for key in curve.keyframe_points:
                                key.interpolation = "LINEAR"
        print(
            f"aligned {name}: RootMotion.localY {min(corrections):.4f}..{max(corrections):.4f}"
        )
    armature.animation_data.action = None


def export(armature: bpy.types.Object, mesh: bpy.types.Object, output: pathlib.Path) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    armature.select_set(True)
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = armature
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output), export_format="GLB", use_selection=True,
        export_animations=True, export_animation_mode="ACTIONS",
        export_skins=True, export_apply=False, export_yup=True,
        export_optimize_animation_size=False, export_image_format="AUTO",
    )
    print(f"exported {output}")


def main() -> None:
    args = arguments()
    bpy.context.scene.render.fps = FPS
    clear_scene()
    mesh = import_mesh(args.source)
    armature, deform = create_rig()
    skin(mesh, armature, deform)
    # Apply the balanced carrier to the *derivative* geometry, then declare the
    # same pose as rest so frame-zero actions do not double-transform it.
    neutral = {
        "Body": (math.radians(14), 0.0, 0.0),
        "L_LegRoot": (math.radians(-10), 0.0, 0.0),
        "R_LegRoot": (math.radians(-10), 0.0, 0.0),
        "L_Thigh": (math.radians(8), 0.0, math.radians(2)),
        "R_Thigh": (math.radians(8), 0.0, math.radians(-2)),
        "L_Calf": (math.radians(-8), 0.0, 0.0),
        "R_Calf": (math.radians(-8), 0.0, 0.0),
        "L_FrontLegRoot": (math.radians(-10), 0.0, 0.0),
        "R_FrontLegRoot": (math.radians(-10), 0.0, 0.0),
        "L_FrontUpper": (math.radians(6), 0.0, math.radians(-2)),
        "R_FrontUpper": (math.radians(6), 0.0, math.radians(2)),
        "L_FrontLower": (math.radians(-6), 0.0, 0.0),
        "R_FrontLower": (math.radians(-6), 0.0, 0.0),
    }
    for bone in armature.pose.bones:
        bone.rotation_mode = "QUATERNION"
        bone.rotation_quaternion = Euler(neutral.get(bone.name, (0.0, 0.0, 0.0)), "XYZ").to_quaternion()
    freeze_neutral_skin(mesh)
    apply_neutral_rest_pose(armature, neutral)
    author_actions(armature)
    align_grounded_actions(armature, mesh)
    export(armature, mesh, args.output)


if __name__ == "__main__":
    main()
