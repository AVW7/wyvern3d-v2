"""Measure one action on the clean wyvern rig, in displayed metres.

Runs inside Blender. `scripts/author-wyvern-idle.py` drives it; it is also
usable on its own to inspect any action in `public/models/wyvern-rig.blend`:

    /Applications/Blender.app/Contents/MacOS/Blender -b \
        public/models/wyvern-rig.blend -P scripts/measure-wyvern-clip-blender.py \
        -- --action idle

Everything here is a *measurement*. The rig's axis conventions were probed on
the live armature rather than reasoned about, because on this rig a local +X
pitches the neck down but lifts the tail, and `Body.location[2]` points at the
floor. See AXES below.
"""

from __future__ import annotations

import argparse
import json
import math
import sys

import bpy

# Metres per rig unit — WYVERN_FIT in src/render/assets/manifest.ts. Every
# distance this script reports is already multiplied by it, so the numbers are
# directly comparable to the v1 catalogue's displayed metres.
FIT = 0.0072

ARMATURE = "WyvernRig"

# Probed on the live rig at +0.2 rad, reading world displacement of a chain-tip
# marker. Recorded here because every one of them contradicts a plausible guess:
#
#   Spine*/Neck*/Head  local +X pitches the head DOWN, +Z yaws toward -X
#   Tail1..Tail10      local +X lifts the tail UP  (opposite sense to the spine,
#                      because the tail runs +Y while the neck runs -Y)
#   Wing shoulder/elbow/wrist
#                      local +X raises BOTH wings (symmetric)
#                      local +Z sweeps them in OPPOSITE directions (antisymmetric)
#   Body.location      local +Z is world DOWN, local +Y is world -Y
AXES = "probed 2026-08-04; see docstring"


def arguments() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--action", default="idle")
    parser.add_argument("--out", default="")
    # Tolerant: Blender hands the same `--` argv to every -P script in the run.
    args, _ = parser.parse_known_args(argv)
    return args


def armature() -> bpy.types.Object:
    obj = bpy.data.objects.get(ARMATURE)
    if obj is None or obj.type != "ARMATURE":
        raise SystemExit(f"armature {ARMATURE!r} not found")
    return obj


def _posed(arm: bpy.types.Object):
    return arm.evaluated_get(bpy.context.evaluated_depsgraph_get()).pose.bones


def head(arm, name):
    return (arm.matrix_world @ _posed(arm)[name].head).copy()


def tail(arm, name):
    return (arm.matrix_world @ _posed(arm)[name].tail).copy()


def sample(arm) -> dict[str, float]:
    """One frame of v1-comparable channels. Distances in displayed metres."""
    body = head(arm, "Body")
    out: dict[str, float] = {"pelvis_up": body.z * FIT}

    # The animal faces -Y, so negate to get a positive forward reach.
    d = tail(arm, "Head") - body
    out["head_fwd"], out["head_lat"], out["head_up"] = -d.y * FIT, d.x * FIT, d.z * FIT
    d = tail(arm, "Tail10") - body
    out["tail_back"], out["tail_lat"], out["tail_up"] = d.y * FIT, d.x * FIT, d.z * FIT

    v = tail(arm, "Spine3") - head(arm, "Spine1")
    out["body_axis_deg"] = math.degrees(math.atan2(v.z, math.hypot(v.x, v.y)))
    # World pitch of the skull itself. An idle's head counter-rotates against
    # the chest to stay level, so this should stay well under the arc the snout
    # sweeps; a large value here means the head is nodding, not stabilising.
    v = tail(arm, "Head") - head(arm, "Head")
    out["head_pitch_deg"] = math.degrees(math.atan2(v.z, math.hypot(v.x, v.y)))

    for side in "LR":
        shoulder = head(arm, f"{side}_WingShoulder")
        w = tail(arm, f"{side}_WingFinger1_end") - shoulder
        out[f"wing_elev_{side}"] = math.degrees(math.atan2(w.z, math.hypot(w.x, w.y)))
        # Positive azimuth = swept toward the tail, mirrored so the two sides are
        # directly comparable; an idle should hold both wings at the same value.
        out[f"wing_azim_{side}"] = math.degrees(math.atan2(w.y, abs(w.x)))
        out[f"wing_span_{side}"] = w.length * FIT

    out["wing_elev_bias"] = out["wing_elev_L"] - out["wing_elev_R"]
    out["wing_azim_bias"] = out["wing_azim_L"] - out["wing_azim_R"]
    # All three foot axes, because a planted idle is gated on the feet not
    # sliding as well as not lifting. v1's reference idle slides its hips 0.11 m
    # fore-and-aft, which is a real artifact rather than something to reproduce.
    for side in "LR":
        toe = tail(arm, f"{side}_Toes")
        out[f"foot_{side}_up"] = toe.z * FIT
        out[f"foot_{side}_fwd"] = -toe.y * FIT
        out[f"foot_{side}_lat"] = toe.x * FIT
    out["lowest_bone_up"] = min(
        (arm.matrix_world @ pb.tail).z for pb in _posed(arm)
    ) * FIT
    return out


def pose_vector(arm) -> list[float]:
    out: list[float] = []
    for pb in _posed(arm):
        out += list(pb.location) + list(pb.rotation_euler)
    return out


def moving_bones(action) -> dict[str, list[str]]:
    """Bones whose channels actually vary, and by how much."""
    moved: dict[str, list[str]] = {}
    for layer in action.layers:
        for strip in layer.strips:
            if strip.type != "KEYFRAME":
                continue
            for bag in strip.channelbags:
                for fc in bag.fcurves:
                    values = [k.co[1] for k in fc.keyframe_points]
                    spread = max(values) - min(values)
                    if spread <= 1e-6:
                        continue
                    name = fc.data_path.split('"')[1]
                    channel = fc.data_path.rsplit(".", 1)[-1]
                    axis = "XYZ"[fc.array_index] if fc.array_index < 3 else "?"
                    unit = "deg" if "rotation" in channel else "u"
                    amount = math.degrees(spread) if unit == "deg" else spread
                    moved.setdefault(name, []).append(
                        f"{channel[:3]}.{axis} {amount:.2f}{unit}"
                    )
    return moved


def measure(action_name: str) -> dict:
    arm = armature()
    action = bpy.data.actions.get(action_name)
    if action is None:
        raise SystemExit(f"action {action_name!r} not found")

    if arm.animation_data is None:
        arm.animation_data_create()
    arm.animation_data.action = action
    if action.slots:
        arm.animation_data.action_slot = action.slots[0]

    first, last = int(action.frame_range[0]), int(action.frame_range[1])
    series, seam = [], []
    for frame in range(first, last + 1):
        bpy.context.scene.frame_set(frame)
        series.append(sample(arm))
        if frame in (first, last):
            seam.append(pose_vector(arm))

    stats: dict = {}
    for key in series[0]:
        values = [s[key] for s in series]
        stats[key] = {
            "min": round(min(values), 4),
            "max": round(max(values), 4),
            "range": round(max(values) - min(values), 4),
        }

    def path(*keys: str) -> float:
        total = 0.0
        for a, b in zip(series, series[1:]):
            total += math.dist([a[k] for k in keys], [b[k] for k in keys])
        return round(total, 4)

    fps = bpy.context.scene.render.fps
    moved = moving_bones(action)
    return {
        "action": action_name,
        "frames": last - first + 1,
        "duration_s": round((last - first) / fps, 3),
        "fps": fps,
        "channels": stats,
        "head_path": path("head_fwd", "head_lat", "head_up"),
        "tail_tip_path": path("tail_back", "tail_lat", "tail_up"),
        # Max per-channel difference between the first and last frame's pose.
        # docs/WYVERN_ANIMATIONS.md calls a clip loopable under 0.05.
        "loop_seam_max": round(max(abs(a - b) for a, b in zip(*seam)), 5),
        "moving_bones": {k: sorted(v) for k, v in sorted(moved.items())},
        "moving_bone_count": len(moved),
    }


def main() -> None:
    args = arguments()
    report = measure(args.action)
    text = json.dumps(report, indent=2)
    if args.out:
        with open(args.out, "w") as handle:
            handle.write(text + "\n")
    print("<<<REPORT>>>")
    print(text)


if __name__ == "__main__":
    main()
