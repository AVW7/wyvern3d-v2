"""Measure every wyvern clip on one rig and emit a machine-readable signature.

Runs inside Blender, headless, driven by `scripts/analyze-clips.py`. It imports,
measures and exits: the vendor GLB is never re-exported and the tracked
`assets/blender/drogon-sanctuary.blend` is never saved.

The load-bearing idea is **one rig, all clips**. The decompressed vendor GLB
supplies the skinned armature and its 52 actions; the authored `Sanct_*` actions
are appended out of the tracked `.blend` with `bpy.data.libraries.load`, which is
safe because the sidecar build already asserts that every authored channel
targets a node present in the base. Vendor and authored clips are therefore
measured on identical geometry in identical units, which the previous two-path
split could not do — the tracked `.blend` is armature-only and the shipped
sidecar's joints import as Empties, so neither can be posed against a skin.

That is also what makes `ground_clearance` available for authored clips: the
number is the lowest point of the *evaluated skin*, and only this scene has one.

Sampling has three rates, each chosen by what it costs:

- every frame, for pose-bone channels and the ASCII traces;
- 48 evenly spaced frames for the summary statistics, matching the sample count
  the retired `survey-flight-clips.py` used so its published numbers reproduce
  exactly (path length and swept arc are both sample-count dependent);
- 48 evenly spaced frames for ground clearance too, which is a deliberate
  increase over the 13 the catalogue in `docs/WYVERN_ANIMATIONS.md` was built
  from. The minimum of a sparse sample over-estimates clearance, and clearance
  is what sets `yOffset` — a pose whose lowest frame falls between samples ships
  as a model sunk into the ground. `--clearance-samples 13` reproduces the
  original catalogue numbers exactly, which is how this tool was validated.

Both sets are subsets of the native frames, so one pass over the clip produces
all of them.
"""

from __future__ import annotations

import argparse
import json
import math
import struct
import sys
import traceback
from pathlib import Path

import bpy
import numpy
from mathutils import Vector

SCHEMA = "wyvern_clip_signature.v1"

# Wingtip is the last membrane finger joint, not the hand: the hand barely moves
# while the membrane sweeps, which is the whole point of the measurement.
TIP_L = "Bip002-L-Finger32_end_0243"
TIP_R = "Bip002-R-Finger32_end_0254"
SHOULDER_L = "Bip002-L-UpperArm_050"
SHOULDER_R = "Bip002-R-UpperArm_087"
PELVIS = "Bip002-Pelvis_07"
HEAD = "Bip002-Head_015"
TAIL = "Bip002-Tail6_01"
FOOT_L = "Bip002-L-Foot_0188"
FOOT_R = "Bip002-R-Foot_0202"
FLIGHT_ROOT = "Bip002_06"
# Mesh-weight and motion probes identify the imported "Ponytail1" control as
# Drogon's lower head/jaw. B_Face_Jaw belongs to the rider's Bip001 skeleton
# and measured a human mouth while the dragon remained unchanged.
JAW = "Bip002-Ponytail1_016"
TOE = "Bip002-L-Toe0_0189"

TRACKED = (
    TIP_L,
    TIP_R,
    SHOULDER_L,
    SHOULDER_R,
    PELVIS,
    HEAD,
    TAIL,
    FOOT_L,
    FOOT_R,
)

FPS = 24
SUMMARY_SAMPLES = 48
CLEARANCE_SAMPLES = 48

#: A clip whose wing elevation swings less than this is not a wingbeat cycle, so
#: reporting a cadence for it would be reading noise as rhythm.
CYCLE_MIN_RANGE_DEG = 15.0

#: `docs/WYVERN_ANIMATIONS.md` calls a clip loopable under this mean per-bone
#: displacement between its first and last frame, on a 44-unit creature.
LOOP_TOLERANCE = 0.25


def arguments() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--sidecar-blend", type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument(
        "--clearance-samples",
        type=int,
        default=CLEARANCE_SAMPLES,
        help="Frames per clip to evaluate the skin on. 13 reproduces the original catalogue.",
    )
    parser.add_argument(
        "--trace",
        action="append",
        default=[],
        help="Clip name or suffix to dump per-frame channels for. Repeatable.",
    )
    return parser.parse_args(argv)


def glb_animation_names(path: Path) -> list[str]:
    """Clip names as the *runtime* sees them, before Blender truncates them.

    Blender caps action names at 63 characters and two vendor clips exceed it,
    so the Blender action name is not a usable key. The manifest keys off these
    names, so the report must too.
    """
    data = path.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2 or length != len(data):
        raise SystemExit(f"invalid GLB header: {path}")
    offset = 12
    while offset < len(data):
        size, kind = struct.unpack_from("<I4s", data, offset)
        if kind == b"JSON":
            document = json.loads(data[offset + 8 : offset + 8 + size].decode("utf-8"))
            return [
                animation["name"]
                for animation in document.get("animations", [])
                if animation.get("name")
            ]
        offset += 8 + size
    raise SystemExit(f"no JSON chunk: {path}")


def only_armature() -> bpy.types.Object:
    armatures = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]
    if len(armatures) != 1:
        raise SystemExit(f"expected exactly one armature, found {len(armatures)}")
    return armatures[0]


def skinned_meshes() -> list[bpy.types.Object]:
    """Only meshes actually deformed by the armature.

    `read_factory_settings(use_empty=True)` clears the scene but leaves the
    startup file's Cube as an orphaned datablock in `bpy.data.objects`. Reading
    meshes from there put a static box spanning z −1..+1 into every clearance
    measurement, which silently clamped the reported maximum to −1.00 for every
    pose whose own skin never reaches that low.
    """
    return [
        obj
        for obj in bpy.context.scene.objects
        if obj.type == "MESH"
        and any(modifier.type == "ARMATURE" for modifier in obj.modifiers)
    ]


def append_authored_actions(blend: Path) -> list[str]:
    """Pull the authored actions out of the tracked source without opening it."""
    names: list[str] = []
    with bpy.data.libraries.load(str(blend), link=False) as (source, destination):
        names = sorted(name for name in source.actions if name.startswith("Sanct_"))
        # A fresh list: Blender rewrites the list it is handed in place, turning
        # the names into loaded datablocks once the block exits.
        destination.actions = list(names)
    return names


def bind(armature: bpy.types.Object, action: bpy.types.Action) -> None:
    if armature.animation_data is None:
        armature.animation_data_create()
    armature.animation_data.action = action
    # Blender 4.4+ evaluates nothing until a slot is bound. Assigning `.action`
    # auto-picks a slot only when its name matches this object, which is false
    # for the appended actions — they were authored against a different object
    # name — so they silently evaluated as a static rest pose without this.
    slots = getattr(action, "slots", None)
    if slots:
        armature.animation_data.action_slot = slots[0]


def even_frames(start: int, end: int, count: int) -> list[int]:
    if count <= 1 or end <= start:
        return [start]
    return [start + round((end - start) * i / (count - 1)) for i in range(count)]


def stat(values: list[float]) -> dict[str, float]:
    if not values:
        return {}
    low, high = min(values), max(values)
    return {
        "min": round(low, 2),
        "max": round(high, 2),
        "mean": round(sum(values) / len(values), 2),
        "range": round(high - low, 2),
    }


def series_range(values: list[float]) -> float:
    return max(values) - min(values) if values else 0.0


def span(points: list[Vector]) -> dict[str, float]:
    if not points:
        return {}
    return {
        "x": round(max(p.x for p in points) - min(p.x for p in points), 3),
        "y": round(max(p.y for p in points) - min(p.y for p in points), 3),
        "z": round(max(p.z for p in points) - min(p.z for p in points), 3),
    }


def path_length(points: list[Vector]) -> float:
    return round(sum((b - a).length for a, b in zip(points, points[1:])), 3)


def swept_arc(tips: list[Vector], shoulders: list[Vector]) -> float:
    """Widest angle the wingtip subtends at the shoulder across the clip.

    This is the honest stroke amplitude. A bounding-box chord inflates with any
    body translation; an angle at the shoulder does not.
    """
    if not tips or not shoulders:
        return 0.0
    arms = [(t - s) for t, s in zip(tips, shoulders)]
    arms = [a.normalized() for a in arms if a.length > 1e-6]
    widest = 0.0
    for i, a in enumerate(arms):
        for b in arms[i + 1 :]:
            widest = max(widest, math.degrees(math.acos(max(-1.0, min(1.0, a.dot(b))))))
    return round(widest, 1)


def wrap180(degrees: float) -> float:
    return (degrees + 180.0) % 360.0 - 180.0


def relative_to_first(values: list[float]) -> list[float]:
    """Wrapped deviation from the clip's opening frame.

    Raw roll is useless as a contract channel: this rig sits near ±180° on most
    clips, so a pose that never rolls at all reports a 355° range purely from
    the wrap. What a cruise contract actually needs to assert is "the authored
    clip does not roll the body, because the runtime supplies roll" — which is a
    statement about deviation, not absolute value.
    """
    if not values:
        return []
    return [wrap180(value - values[0]) for value in values]


def upward_crossings(values: list[float]) -> int:
    """Count cycles by upward crossings of the mean.

    Peak-finding needs a prominence threshold and mis-handles a loop whose first
    and last frames are the same pose. Mean crossings need neither: a clean
    three-beat loop crosses upward exactly three times.
    """
    if len(values) < 3:
        return 0
    mean = sum(values) / len(values)
    centred = [v - mean for v in values]
    return sum(1 for a, b in zip(centred, centred[1:]) if a <= 0.0 < b)


def frame_channels(
    armature: bpy.types.Object,
) -> tuple[dict[str, Vector], dict[str, float]]:
    """Read every tracked bone and derived scalar at the current frame."""
    graph = bpy.context.evaluated_depsgraph_get()
    graph.update()
    evaluated = armature.evaluated_get(graph)
    world = evaluated.matrix_world

    points: dict[str, Vector] = {}
    for name in TRACKED:
        bone = evaluated.pose.bones.get(name)
        if bone is not None:
            points[name] = world @ bone.head.copy()

    scalars: dict[str, float] = {}

    tip, shoulder = points.get(TIP_L), points.get(SHOULDER_L)
    if tip is not None and shoulder is not None:
        arm = tip - shoulder
        scalars["wing_elev_L"] = math.degrees(math.atan2(arm.z, math.hypot(arm.x, arm.y)))
        scalars["wing_azimuth_L"] = math.degrees(math.atan2(arm.y, arm.x))
        scalars["wing_extension_L"] = arm.length

    tip_r, shoulder_r = points.get(TIP_R), points.get(SHOULDER_R)
    if tip_r is not None and shoulder_r is not None:
        arm = tip_r - shoulder_r
        scalars["wing_elev_R"] = math.degrees(math.atan2(arm.z, math.hypot(arm.x, arm.y)))
        scalars["wing_extension_R"] = arm.length

    if "wing_elev_L" in scalars and "wing_elev_R" in scalars:
        # Signed, unlike `symmetry_error`: a bank needs one wing measurably
        # lower than the other, and a cruise loop needs them level. A magnitude
        # cannot tell "banking left" from "banking right", so the contracts need
        # the sign.
        scalars["wing_elev_bias"] = scalars["wing_elev_L"] - scalars["wing_elev_R"]

    head, tail = points.get(HEAD), points.get(TAIL)
    if head is not None and tail is not None:
        delta = head - tail
        scalars["body_axis_deg"] = math.degrees(
            math.atan2(delta.z, math.hypot(delta.x, delta.y))
        )

    pelvis = points.get(PELVIS)
    if pelvis is not None:
        if head is not None:
            scalars["head_reach_horizontal"] = math.hypot(
                head.x - pelvis.x, head.y - pelvis.y
            )
            scalars["head_reach_vertical"] = head.z - pelvis.z
            # Signed, same convention as `tail_lateral`: +x is the rig's left.
            # The pose contract has always said a banking wyvern "looks/leans
            # into the turn", and nothing measured it — `head_reach` had only a
            # horizontal magnitude, which cannot tell a left lean from a right
            # one any more than an unsigned tail offset could. It is the head
            # bone's own origin, so it moves only when a bone *above* it in the
            # neck chain bends; a rotation of the head bone itself is invisible
            # here by construction (probed: 0.000 on every channel at 0.70 rad).
            scalars["head_lateral"] = head.x - pelvis.x
        if tail is not None:
            scalars["tail_reach_horizontal"] = math.hypot(
                tail.x - pelvis.x, tail.y - pelvis.y
            )
            scalars["tail_reach_vertical"] = tail.z - pelvis.z
            # Signed, and +x is the rig's left (L-Clavicle sits at x=+83.77).
            # A bank's tail counterbalance is a direction, not a magnitude: the
            # tail must swing to the *outside* of the turn, which is the
            # opposite side from the dropped wing.
            scalars["tail_lateral"] = tail.x - pelvis.x
        foot = points.get(FOOT_L)
        if foot is not None:
            scalars["foot_drop"] = pelvis.z - foot.z
        foot_r = points.get(FOOT_R)
        if foot_r is not None:
            scalars["foot_drop_R"] = pelvis.z - foot_r.z
        if foot is not None and foot_r is not None:
            # Signed, and the reason it exists: `foot_drop` had only ever been
            # measured on the left foot, so a right leg driven with the wrong
            # sign was invisible to the gate — which is exactly the defect the
            # tuck axis fix corrects one chain over. The vendor base pose is
            # itself asymmetric (4.26 left against 3.54 right at the flight base
            # frame), so this is a drift guard, not a zero target.
            scalars["foot_asymmetry"] = (pelvis.z - foot.z) - (pelvis.z - foot_r.z)

    root = evaluated.pose.bones.get(FLIGHT_ROOT)
    if root is not None:
        # Roll about the rig's forward axis, in the flight root's own frame.
        quaternion = root.matrix.to_quaternion()
        scalars["root_roll_deg"] = math.degrees(quaternion.to_euler("YXZ").y)

    jaw = evaluated.pose.bones.get(JAW)
    if jaw is not None:
        # Basis, not world: "how far open" is a delta from the rest pose.
        scalars["jaw_deg"] = math.degrees(jaw.matrix_basis.to_euler().x)

    toe = evaluated.pose.bones.get(TOE)
    if toe is not None:
        # Basis, not world, so claw pressure is reviewable independently from the
        # source pose's whole-leg motion.
        #
        # Two axes, because the original probe named the wrong one. Local X — what
        # `toe_deg` reads — swings the whole fan together: +-40 deg of this number
        # for under 0.09 of change in outer-toe span, so it can move a long way
        # without the silhouette moving at all. Local Z is the axis that opens and
        # closes the claw: -0.50 rad spreads the fan from 1.54 to 1.73 and drops
        # the tips 0.44, +0.50 gathers it to 1.15. `toe_deg` is kept because the
        # grounded contracts are calibrated against it; `toe_curl_deg` is the one
        # a flight contract should gate.
        basis = toe.matrix_basis.to_euler()
        scalars["toe_deg"] = math.degrees(basis.x)
        scalars["toe_curl_deg"] = math.degrees(basis.z)

    if tip is not None and tip_r is not None:
        # Reflect the left wingtip through the sagittal plane and compare it to
        # the right one. The rig is mirrored across X, so a symmetric pose scores
        # near zero.
        #
        # This *reflects* (-tip.x) rather than comparing magnitudes
        # (|tip.x| - |tip_r.x|). The two agree exactly whenever each wing is on
        # its own side, which is why every published number is unchanged — but
        # the magnitude form scores two wings stacked on the *same* side as
        # perfectly symmetric, so it cannot detect the one failure that looks
        # like a duplicated wing.
        scalars["symmetry_error"] = math.sqrt(
            (-tip.x - tip_r.x) ** 2
            + (tip.y - tip_r.y) ** 2
            + (tip.z - tip_r.z) ** 2
        )

    if pelvis is not None:
        # Signed, so "which side is this wing on" is readable directly rather
        # than inferred. Left is +x on this rig.
        if tip is not None:
            scalars["wingtip_lateral_L"] = tip.x - pelvis.x
        if tip_r is not None:
            scalars["wingtip_lateral_R"] = tip_r.x - pelvis.x

    return points, scalars


def skin_low_point(
    meshes: list[bpy.types.Object],
    balance: list[float],
) -> float | None:
    """Lowest point of the posed skin, relative to the model origin.

    This measures how far the silhouette reaches below the rig origin, not
    altitude — none of these clips translate their root. A large negative number
    means the pose is wide and low-reaching, which is what decides `yOffset` and
    whether the geometry passes through terrain.

    Vertices come out through `foreach_get` into one numpy buffer rather than a
    Python loop. Both are correct; at 27k verts across 65 clips the Python loop
    is the difference between sampling 13 frames per clip and sampling 48, and
    the minimum of a sparse sample is an over-estimate of ground clearance.
    """
    graph = bpy.context.evaluated_depsgraph_get()
    graph.update()
    lowest: float | None = None
    for mesh_object in meshes:
        evaluated = mesh_object.evaluated_get(graph)
        mesh = evaluated.to_mesh()
        try:
            count = len(mesh.vertices)
            if not count:
                continue
            flat = numpy.empty(count * 3, dtype=numpy.float64)
            mesh.vertices.foreach_get("co", flat)
            matrix = numpy.array(evaluated.matrix_world)
            world = flat.reshape(-1, 3) @ matrix[:3, :3].T + matrix[:3, 3]
            low = float(world[:, 2].min())
            if lowest is None or low < lowest:
                lowest = low
            # Skin-level left/right balance, on the largest mesh only.
            # Everything else in this report samples *bones*, and bones are not
            # what renders: this rig's wing weights differ by up to 63% between
            # sides, so a bit-perfect bone mirror still deforms into two
            # different wings. This counts how much geometry each side throws
            # past |x| = 2 — equal for a genuinely symmetric silhouette.
            if count > 15000:
                x = world[:, 0]
                left = int((x > 2.0).sum())
                right = int((x < -2.0).sum())
                total = left + right
                if total:
                    balance.append((left - right) / total)
        finally:
            evaluated.to_mesh_clear()
    return lowest


def pose_basis(armature: bpy.types.Object) -> dict[str, tuple[float, ...]]:
    return {
        bone.name: tuple(bone.location)
        + tuple(bone.rotation_quaternion)
        + tuple(bone.scale)
        for bone in armature.pose.bones
    }


def bone_heads(armature: bpy.types.Object) -> dict[str, Vector]:
    graph = bpy.context.evaluated_depsgraph_get()
    graph.update()
    evaluated = armature.evaluated_get(graph)
    world = evaluated.matrix_world
    return {bone.name: world @ bone.head.copy() for bone in evaluated.pose.bones}


def measure(
    armature: bpy.types.Object,
    meshes: list[bpy.types.Object],
    action: bpy.types.Action,
    clearance_samples: int = CLEARANCE_SAMPLES,
) -> tuple[dict, list[dict]]:
    scene = bpy.context.scene
    bind(armature, action)

    start, end = (int(round(v)) for v in action.frame_range)
    frames = list(range(start, end + 1))
    summary_frames = set(even_frames(start, end, SUMMARY_SAMPLES))
    clearance_frames = set(even_frames(start, end, clearance_samples))

    trace: list[dict] = []
    series: dict[str, list[float]] = {}
    tracks: dict[str, list[Vector]] = {name: [] for name in TRACKED}
    clearances: list[float] = []
    skin_balance: list[float] = []
    endpoints: dict[int, dict[str, Vector]] = {}
    endpoint_basis: dict[int, dict[str, tuple[float, ...]]] = {}

    for frame in frames:
        scene.frame_set(frame)
        points, scalars = frame_channels(armature)

        row = {"f": frame}
        row.update({key: round(value, 2) for key, value in scalars.items()})
        trace.append(row)

        if frame in summary_frames:
            for key, value in scalars.items():
                series.setdefault(key, []).append(value)
            for name, point in points.items():
                tracks[name].append(point)

        if frame in clearance_frames:
            low = skin_low_point(meshes, skin_balance)
            if low is not None:
                clearances.append(low)

        if frame in (start, end):
            endpoints[frame] = bone_heads(armature)
            endpoint_basis[frame] = pose_basis(armature)

    first, last = endpoints.get(start, {}), endpoints.get(end, {})
    shared = sorted(set(first) & set(last))
    displacements = [(first[name] - last[name]).length for name in shared]
    basis_first = endpoint_basis.get(start, {})
    basis_last = endpoint_basis.get(end, {})
    basis_delta = max(
        (
            abs(a - b)
            for name in set(basis_first) & set(basis_last)
            for a, b in zip(basis_first[name], basis_last[name])
        ),
        default=0.0,
    )
    pose_mean = sum(displacements) / len(displacements) if displacements else 0.0

    elevations = series.get("wing_elev_L", [])
    native_elevations = [row["wing_elev_L"] for row in trace if "wing_elev_L" in row]
    cycle = None
    if elevations and (max(elevations) - min(elevations)) >= CYCLE_MIN_RANGE_DEG:
        # A looping clip repeats its first pose on its last frame; counting that
        # duplicate would report one beat too many.
        loopable = pose_mean < LOOP_TOLERANCE
        sampled = native_elevations[:-1] if loopable and len(native_elevations) > 1 else native_elevations
        beats = upward_crossings(sampled)
        if beats:
            duration = len(sampled) / FPS
            cycle = {
                "beats": beats,
                "cadence_hz": round(beats / duration, 3) if duration else 0.0,
                "beat_frames": round(len(sampled) / beats, 1),
            }

    signature = {
        "blender_action": action.name,
        "frames": [start, end],
        "frame_count": len(frames),
        "duration_s": round((end - start) / FPS, 3),
        "summary_samples": len(summary_frames),
        "clearance_samples": len(clearances),
        "body_axis_deg": stat(series.get("body_axis_deg", [])),
        "root_roll_deg": stat(series.get("root_roll_deg", [])),
        "root_roll_delta_deg": stat(relative_to_first(series.get("root_roll_deg", []))),
        "wing_elev_L": stat(series.get("wing_elev_L", [])),
        "wing_elev_R": stat(series.get("wing_elev_R", [])),
        "wing_elev_bias": stat(series.get("wing_elev_bias", [])),
        "wing_azimuth_L": stat(series.get("wing_azimuth_L", [])),
        "wing_extension_L": stat(series.get("wing_extension_L", [])),
        "wing_extension_R": stat(series.get("wing_extension_R", [])),
        "foot_drop": stat(series.get("foot_drop", [])),
        "foot_drop_R": stat(series.get("foot_drop_R", [])),
        "foot_asymmetry": stat(series.get("foot_asymmetry", [])),
        "head_reach": {
            "horizontal": stat(series.get("head_reach_horizontal", [])),
            "vertical": stat(series.get("head_reach_vertical", [])),
            "lateral": stat(series.get("head_lateral", [])),
        },
        "tail_reach": {
            "horizontal": stat(series.get("tail_reach_horizontal", [])),
            "vertical": stat(series.get("tail_reach_vertical", [])),
            "lateral": stat(series.get("tail_lateral", [])),
        },
        "jaw_deg": stat(series.get("jaw_deg", [])),
        "toe_deg": stat(series.get("toe_deg", [])),
        "toe_curl_deg": stat(series.get("toe_curl_deg", [])),
        "symmetry_error": stat(series.get("symmetry_error", [])),
        "pelvis": {
            "span": span(tracks[PELVIS]),
            "path": path_length(tracks[PELVIS]),
            "height": stat([p.z for p in tracks[PELVIS]]),
        },
        "wingtip_L": {
            "span": span(tracks[TIP_L]),
            "path": path_length(tracks[TIP_L]),
            "stroke_arc_deg": swept_arc(tracks[TIP_L], tracks[SHOULDER_L]),
            "lateral": stat(series.get("wingtip_lateral_L", [])),
        },
        "wingtip_R": {
            "span": span(tracks[TIP_R]),
            "path": path_length(tracks[TIP_R]),
            "stroke_arc_deg": swept_arc(tracks[TIP_R], tracks[SHOULDER_R]),
            "lateral": stat(series.get("wingtip_lateral_R", [])),
        },
        # Signed difference in how far each wing sweeps. A bank is supposed to
        # be a *deformation*: the two wings work differently. A rigid rotation
        # bolted onto a symmetric cycle shifts both wings without changing how
        # far either one travels, so this is what separates an authored
        # directional layer from an offset. Symmetric modes must sit near zero.
        "wing_stroke_asymmetry": round(
            series_range(series.get("wing_elev_L", []))
            - series_range(series.get("wing_elev_R", [])),
            2,
        ),
        "tail_tip": {"span": span(tracks[TAIL])},
        "skin_side_balance": stat([v * 100 for v in skin_balance]),
        "ground_clearance": {
            "min": round(min(clearances), 2) if clearances else None,
            "max": round(max(clearances), 2) if clearances else None,
        },
        "loop": {
            "pose_mean": round(pose_mean, 3),
            "pose_max": round(max(displacements), 3) if displacements else 0.0,
            "basis_max": round(basis_delta, 6),
            "loops": pose_mean < LOOP_TOLERANCE,
        },
        "cycle": cycle,
    }
    return signature, trace


TRACE_COLUMNS = (
    ("elevL", "wing_elev_L"),
    ("elevR", "wing_elev_R"),
    ("azimL", "wing_azimuth_L"),
    ("extL", "wing_extension_L"),
    ("body", "body_axis_deg"),
    ("roll", "root_roll_deg"),
    ("footDr", "foot_drop"),
    ("headH", "head_reach_horizontal"),
    ("headLt", "head_lateral"),
    ("tailH", "tail_reach_horizontal"),
    ("symEr", "symmetry_error"),
)


def print_trace(clip: str, signature: dict, trace: list[dict]) -> None:
    """Per-frame channels as text, which is the point of the whole tool.

    A contact sheet cannot be diffed, searched, or asserted against. This can.
    The bar tracks wing elevation because that is the propulsion cycle: three
    clean rises and falls is a three-beat loop, and a flat bar is a clip with no
    wingbeat in it at all.
    """
    start, end = signature["frames"]
    print(f"\ntrace {clip}")
    print(f"  frames {start}..{end} @ {FPS}fps = {signature['duration_s']}s", end="")
    if signature["cycle"]:
        cycle = signature["cycle"]
        print(f"  ·  {cycle['beats']} beats, {cycle['cadence_hz']}Hz", end="")
    print()
    header = "  frame" + "".join(f"{label:>8}" for label, _ in TRACE_COLUMNS)
    print(header + "  wing elevation -90..+90")
    for row in trace:
        cells = "".join(f"{row.get(key, float('nan')):>8.1f}" for _, key in TRACE_COLUMNS)
        elevation = row.get("wing_elev_L")
        bar = ""
        if elevation is not None:
            filled = max(0, min(48, int((elevation + 90.0) / 180.0 * 48)))
            bar = "·" * filled + "#"
        print(f"  {row['f']:5}{cells}  {bar}")


SUMMARY_COLUMNS = (
    ("s", lambda s: f"{s['duration_s']:6.2f}"),
    ("fr", lambda s: f"{s['frame_count'] - 1:5}"),
    ("arc", lambda s: f"{s['wingtip_L']['stroke_arc_deg']:6.1f}"),
    ("elevRange", lambda s: f"{s['wing_elev_L'].get('range', 0):9.1f}"),
    ("body", lambda s: f"{s['body_axis_deg'].get('mean', 0):6.1f}"),
    ("roll", lambda s: f"{s['root_roll_delta_deg'].get('range', 0):6.1f}"),
    ("symErr", lambda s: f"{s['symmetry_error'].get('mean', 0):7.2f}"),
    ("wingBias", lambda s: f"{s['wing_elev_bias'].get('mean', 0):8.2f}"),
    ("strokeAsym", lambda s: f"{s['wing_stroke_asymmetry']:10.2f}"),
    ("skinBal%", lambda s: f"{s['skin_side_balance'].get('mean', 0):9.2f}"),
    ("pelvis", lambda s: f"{s['pelvis']['path']:7.2f}"),
    ("footDr", lambda s: f"{s['foot_drop'].get('mean', 0):7.2f}"),
    (
        "clearance",
        lambda s: (
            f"{s['ground_clearance']['min']:6.2f}..{s['ground_clearance']['max']:6.2f}"
            if s["ground_clearance"]["min"] is not None
            else " " * 14
        ),
    ),
    ("loopErr", lambda s: f"{s['loop']['pose_mean']:8.2f}"),
    ("beats", lambda s: f"{s['cycle']['beats']:6}" if s["cycle"] else "     ·"),
)


def short(clip: str) -> str:
    """Drop the vendor prefix so the table stays readable in a terminal."""
    for prefix in (
        "SKM_DaenerysDragon|DaenerysDragon_",
        "SKM_DaenerysDragon|AA_DaenerysDragon_",
    ):
        if clip.startswith(prefix):
            return clip[len(prefix) :]
    return clip


def print_summary(report: dict[str, dict]) -> None:
    header = "".join(
        f"{label:>{max(7, len(label) + 1)}}" for label, _ in SUMMARY_COLUMNS
    )
    print(f"\n{'clip':34}{header}")
    for clip in sorted(report):
        signature = report[clip]
        cells = "".join(render(signature) for _, render in SUMMARY_COLUMNS)
        print(f"{short(clip):34}{cells}")


def main() -> None:
    args = arguments()

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(args.source))
    armature = only_armature()
    meshes = skinned_meshes()
    if not meshes:
        raise SystemExit("no skinned mesh imported; ground clearance is unmeasurable")

    vendor_names = glb_animation_names(args.source)
    authored: list[str] = []
    if args.sidecar_blend:
        authored = append_authored_actions(args.sidecar_blend)

    by_name = {action.name: action for action in bpy.data.actions}
    resolved: dict[str, tuple[str, bpy.types.Action]] = {}
    missing: list[str] = []
    for name in vendor_names:
        # Blender truncates action names at 63 characters and two vendor clips
        # exceed it. The GLB keeps the full name and the manifest keys off it,
        # so the report must key off it too.
        action = by_name.get(name) or by_name.get(name[:63])
        if action is None:
            missing.append(name)
            continue
        resolved[name] = ("vendor", action)
    for name in authored:
        action = by_name.get(name)
        if action is not None:
            resolved[name] = ("sidecar", action)

    if missing:
        raise SystemExit(f"vendor clips absent from the imported scene: {missing}")

    print(
        f"measuring {len(resolved)} clips "
        f"({sum(1 for kind, _ in resolved.values() if kind == 'vendor')} vendor, "
        f"{len(authored)} authored) on {len(armature.pose.bones)} bones, "
        f"{len(meshes)} skinned meshes"
    )

    report: dict[str, dict] = {}
    traces: dict[str, list[dict]] = {}
    for index, clip in enumerate(sorted(resolved), start=1):
        kind, action = resolved[clip]
        print(f"  [{index:2}/{len(resolved)}] {clip}", flush=True)
        signature, trace = measure(armature, meshes, action, args.clearance_samples)
        signature["source"] = kind
        report[clip] = signature
        traces[clip] = trace

    document = {
        "schema": SCHEMA,
        "fps": FPS,
        "summary_samples": SUMMARY_SAMPLES,
        "clearance_samples": args.clearance_samples,
        "bones": len(armature.pose.bones),
        "source_glb": args.source.name,
        "sidecar_blend": args.sidecar_blend.name if args.sidecar_blend else None,
        "clips": {clip: report[clip] for clip in sorted(report)},
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(document, indent=2, sort_keys=True) + "\n")
    print(f"\nwrote {args.out}")

    print_summary(report)

    for wanted in args.trace:
        matches = [clip for clip in sorted(report) if clip.endswith(wanted) or clip == wanted]
        if not matches:
            print(f"\ntrace: no clip matching {wanted!r}")
            continue
        for clip in matches:
            print_trace(clip, report[clip], traces[clip])


try:
    main()
except BaseException:
    # Blender exits 0 on an unhandled script exception, which would let the
    # driver report success over a stale or missing report. Fail loudly.
    traceback.print_exc()
    sys.exit(1)
