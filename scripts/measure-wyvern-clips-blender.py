"""Measure every action on the clean wyvern rig, in displayed metres.

Runs inside Blender. `scripts/author-wyvern-clips.py` drives it:

    /Applications/Blender.app/Contents/MacOS/Blender -b \
        public/models/wyvern-rig.blend \
        -P scripts/measure-wyvern-clips-blender.py -- --out signatures.json

This is the gate's data source. `src/render/assets/animationContracts.test.ts`
asserts the output against `validation/wyvern-animations/wyvern-clip-contracts.json`,
so a clip regression lands as a readable per-channel diff rather than as
something someone has to notice in a render.

The channel that matters most is `wing_symmetry_error`. Seven of the sixteen
clips this replaces shipped a wing dislocated from its mirror — `walk` held its
left tip 1879 units fore of its right — and nothing in the build could see it,
because the previous gate was skipped and the previous signature file still
described the vendor rig. It is measured as the reflected wingtip distance over
the semispan, so it is scale-free and directly comparable between clips.

Everything here is a *measurement*. The rig's axis conventions were probed on
the live armature rather than reasoned about; see
`scripts/author-wyvern-clips-blender.py` for the table.
"""

from __future__ import annotations

import argparse
import json
import math
import sys

import bpy

# Metres per rig unit — WYVERN_FIT in src/render/assets/manifest.ts.
FIT = 0.0072

ARMATURE = "WyvernRig"

# Bones that carry the wing beyond shoulder and elbow. The old clips never
# moved any of them, so the wing was a two-segment paddle; the contract counts
# them to keep that from coming back.
DISTAL_WING = (
    "WingWrist", "WingFinger1", "WingFinger2", "WingFinger3",
    "WingMembrane1", "WingMembrane2", "WingClaw",
)


def arguments() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="")
    parser.add_argument("--only", default="")
    args, _ = parser.parse_known_args(argv)
    return args


def armature() -> bpy.types.Object:
    obj = bpy.data.objects.get(ARMATURE)
    if obj is None or obj.type != "ARMATURE":
        raise SystemExit(f"armature {ARMATURE!r} not found")
    return obj


def _posed(arm):
    return arm.evaluated_get(bpy.context.evaluated_depsgraph_get()).pose.bones


def head(arm, name):
    return (arm.matrix_world @ _posed(arm)[name].head).copy()


def tail(arm, name):
    return (arm.matrix_world @ _posed(arm)[name].tail).copy()


def sample(arm) -> dict[str, float]:
    """One frame of channels. Distances in displayed metres."""
    body = head(arm, "Body")
    out: dict[str, float] = {"pelvis_up": body.z * FIT}

    # The animal faces -Y, so negate to get a positive forward reach.
    d = tail(arm, "Head") - body
    out["head_fwd"], out["head_lat"], out["head_up"] = -d.y * FIT, d.x * FIT, d.z * FIT
    d = tail(arm, "Tail10") - body
    out["tail_back"], out["tail_lat"], out["tail_up"] = d.y * FIT, d.x * FIT, d.z * FIT

    v = tail(arm, "Spine3") - head(arm, "Spine1")
    out["body_axis_deg"] = math.degrees(math.atan2(v.z, math.hypot(v.x, v.y)))
    v = tail(arm, "Head") - head(arm, "Head")
    out["head_pitch_deg"] = math.degrees(math.atan2(v.z, math.hypot(v.x, v.y)))

    for side in "LR":
        shoulder = head(arm, f"{side}_WingShoulder")
        w = tail(arm, f"{side}_WingFinger1_end") - shoulder
        out[f"wing_elev_{side}"] = math.degrees(math.atan2(w.z, math.hypot(w.x, w.y)))
        out[f"wing_azim_{side}"] = math.degrees(math.atan2(w.y, abs(w.x)))
        out[f"wing_span_{side}"] = w.length * FIT

    out["wing_elev_bias"] = out["wing_elev_L"] - out["wing_elev_R"]
    out["wing_azim_bias"] = out["wing_azim_L"] - out["wing_azim_R"]

    # Scale-free left/right mismatch: reflect the left wingtip through x=0 and
    # measure how far it lands from the right one, over the semispan.
    lt = tail(arm, "L_WingFinger1_end")
    rt = tail(arm, "R_WingFinger1_end")
    semispan = max(abs(lt.x), abs(rt.x), 1e-6)
    out["wing_symmetry_error"] = (
        abs(lt.x + rt.x) + abs(lt.y - rt.y) + abs(lt.z - rt.z)
    ) / semispan

    # Wing knuckles as ground contacts. This creature is a quadruped that walks
    # on its wing knuckles: measured on v1, `Battle_Walk` plants them at 0.64
    # against a foot floor of 0.15, and `Battle_Stand` puts the knuckle BELOW
    # the foot (1.86 vs 1.99). A grounded clip whose knuckles float is a wyvern
    # walking like a bird.
    for side in "LR":
        knuckle = tail(arm, f"{side}_WingFinger1")
        out[f"knuckle_{side}_up"] = knuckle.z * FIT
        out[f"knuckle_{side}_fwd"] = -knuckle.y * FIT
        out[f"wrist_{side}_up"] = tail(arm, f"{side}_WingWrist").z * FIT

    for side in "LR":
        toe = tail(arm, f"{side}_Toes")
        out[f"foot_{side}_up"] = toe.z * FIT
        out[f"foot_{side}_fwd"] = -toe.y * FIT
        out[f"foot_{side}_lat"] = toe.x * FIT

    # The one number Stage 1 of docs/WYVERN_RIG_V2_PLAN.md is solving for.
    out["knuckle_above_toe"] = (
        min(out["knuckle_L_up"], out["knuckle_R_up"])
        - min(out["foot_L_up"], out["foot_R_up"])
    )
    out["foot_symmetry_error"] = (
        abs(tail(arm, "L_Toes").x + tail(arm, "R_Toes").x)
        + abs(tail(arm, "L_Toes").y - tail(arm, "R_Toes").y)
        + abs(tail(arm, "L_Toes").z - tail(arm, "R_Toes").z)
    ) * FIT

    lowest = min(_posed(arm), key=lambda pb: (arm.matrix_world @ pb.tail).z)
    out["lowest_bone_up"] = (arm.matrix_world @ lowest.tail).z * FIT
    out["_lowest_bone"] = lowest.name

    # Both ground contacts per side, mirrored on the left, for `gait_mirror`.
    lk, rk = tail(arm, "L_WingFinger1"), tail(arm, "R_WingFinger1")
    lt, rt = tail(arm, "L_Toes"), tail(arm, "R_Toes")
    out["_gait"] = {
        "mirror_L_knuckle": [-lk.x, lk.y, lk.z],
        "R_knuckle": [rk.x, rk.y, rk.z],
        "mirror_L_toe": [-lt.x, lt.y, lt.z],
        "R_toe": [rt.x, rt.y, rt.z],
    }
    return out


def lowest_vertex(mesh_obj) -> float:
    """Lowest *skinned vertex*, in displayed metres.

    This — not the lowest bone tail — is what `yOffset` in `manifest.ts` plants
    a ground clip on, because it is what visibly touches the floor. The two
    disagree by metres on this rig: a folded wingtip's bone tail sits well below
    the membrane's actual geometry.
    """
    dg = bpy.context.evaluated_depsgraph_get()
    ev = mesh_obj.evaluated_get(dg)
    mesh = ev.to_mesh()
    m = mesh_obj.matrix_world
    z = min((m @ v.co).z for v in mesh.vertices)
    ev.to_mesh_clear()
    return z * FIT


def pose_vector(arm) -> list[float]:
    out: list[float] = []
    for pb in _posed(arm):
        out += list(pb.location) + list(pb.rotation_euler)
    return out


def moving_bones(action) -> dict[str, float]:
    """Bone -> largest channel spread, in degrees for rotation."""
    moved: dict[str, float] = {}
    for layer in action.layers:
        for strip in layer.strips:
            if strip.type != "KEYFRAME":
                continue
            for bag in strip.channelbags:
                for fc in bag.fcurves:
                    if '"' not in fc.data_path:
                        continue
                    values = [k.co[1] for k in fc.keyframe_points]
                    spread = max(values) - min(values)
                    if spread <= 1e-6:
                        continue
                    name = fc.data_path.split('"')[1]
                    channel = fc.data_path.rsplit(".", 1)[-1]
                    amount = math.degrees(spread) if "rotation" in channel else spread
                    moved[name] = max(moved.get(name, 0.0), amount)
    return moved


def gait_mirror(frames) -> dict:
    """How well the right side reproduces the left, allowing a phase shift.

    Instantaneous left/right symmetry is the wrong test for a gait. A correct
    alternating walk is *deliberately* asymmetric at every instant — v1 plants
    each hind foot with the opposite wing knuckle — so `wing_symmetry_error`
    reads 1.3 on a good walk and would read the same on a dislocated one.

    What a correct gait does have is that the right limb traces the left one's
    path, delayed. This searches every whole-frame shift for the one making the
    mirrored left limb match the right, and reports the residual and the shift.

    **Each contact pair is searched separately**, and that is load-bearing: with
    diagonal couplets 0.36 of a cycle apart, the feet and the knuckles need
    OPPOSITE shifts (+0.36 and -0.36), so no single shift fits and a combined
    search reports a spurious 0.107 on a correct walk. Per pair, each is clean.
    """
    n = len(frames)
    out = {}
    for pair, keys in (("foot", ("mirror_L_toe", "R_toe")),
                       ("knuckle", ("mirror_L_knuckle", "R_knuckle"))):
        left_key, right_key = keys
        best, best_shift = float("inf"), 0
        for shift in range(n):
            total = 0.0
            for i in range(n):
                total += math.dist(frames[i][left_key], frames[(i + shift) % n][right_key])
            if total / n < best:
                best, best_shift = total / n, shift
        span = max(abs(f[left_key][0]) for f in frames) or 1.0
        out[pair] = {"error": round(best / span, 4), "shift": round(best_shift / n, 3)}
    out["error"] = max(out["foot"]["error"], out["knuckle"]["error"])
    return out


def cadence(series, key: str, duration: float) -> dict:
    """Wingbeats per loop and in Hz, from mean crossings of the elevation."""
    values = [s[key] for s in series]
    mean = sum(values) / len(values)
    centred = [v - mean for v in values]
    beats = sum(1 for i in range(1, len(centred))
                if centred[i - 1] <= 0 < centred[i])
    return {
        "beats": beats,
        "cadence_hz": round(beats / duration, 3) if duration else 0.0,
        "stroke_deg": round(max(values) - min(values), 2),
    }


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

    mesh_obj = bpy.data.objects.get("WyvernMesh")
    first, last = int(action.frame_range[0]), int(action.frame_range[1])
    # Skinned-vertex sampling evaluates the whole 21.6k-vertex mesh, so it runs
    # on a stride; the low point moves slowly enough that every 4th frame finds
    # it to well within the tolerance yOffset is quoted at.
    stride = max(1, (last - first) // 16)
    series, seam, floor = [], [], []
    for frame in range(first, last + 1):
        bpy.context.scene.frame_set(frame)
        series.append(sample(arm))
        if mesh_obj is not None and (frame - first) % stride == 0:
            floor.append((lowest_vertex(mesh_obj), frame))
        if frame in (first, last):
            seam.append(pose_vector(arm))

    lowest_names = sorted({s.pop("_lowest_bone") for s in series})
    gait_frames = [s.pop("_gait") for s in series]
    stats: dict = {}
    for key in series[0]:
        values = [s[key] for s in series]
        stats[key] = {
            "min": round(min(values), 4),
            "max": round(max(values), 4),
            "range": round(max(values) - min(values), 4),
        }

    def path(*ks: str) -> float:
        total = 0.0
        for a, b in zip(series, series[1:]):
            total += math.dist([a[k] for k in ks], [b[k] for k in ks])
        return round(total, 4)

    fps = bpy.context.scene.render.fps
    duration = (last - first) / fps
    moved = moving_bones(action)
    distal = sorted(n for n in moved
                    if any(n.endswith(d) for d in DISTAL_WING))

    return {
        "action": action_name,
        "frames": last - first + 1,
        "duration_s": round(duration, 3),
        "fps": fps,
        "channels": stats,
        "cycle": cadence(series, "wing_elev_L", duration),
        "gait_mirror": gait_mirror(gait_frames),
        "head_path": path("head_fwd", "head_lat", "head_up"),
        "tail_tip_path": path("tail_back", "tail_lat", "tail_up"),
        # docs/WYVERN_ANIMATIONS.md calls a clip loopable under 0.05.
        "loop_seam_max": round(max(abs(a - b) for a, b in zip(*seam)), 5),
        # What actually touches the floor, and the yOffset that plants it.
        "lowest_vertex_up": round(min(floor)[0], 4) if floor else None,
        "lowest_vertex_frame": min(floor)[1] if floor else None,
        "plant_offset_units": round(-min(floor)[0] / FIT) if floor else None,
        "lowest_bones": lowest_names,
        "moving_bones": {k: round(v, 2) for k, v in sorted(moved.items())},
        "moving_bone_count": len(moved),
        # The wing past the elbow. Zero here means a two-segment paddle.
        "distal_wing_bones": distal,
        "distal_wing_bone_count": len(distal),
    }


# One-shot -> the loop the manifest chains it into, via `next`.
CHAINS = {"takeoff": "cruise", "land": "idle"}


def pose_at(action_name: str, frame_index: int) -> list[float] | None:
    """Pose vector at a frame index counted from the action's own start."""
    arm = armature()
    action = bpy.data.actions.get(action_name)
    if action is None:
        return None
    if arm.animation_data is None:
        arm.animation_data_create()
    arm.animation_data.action = action
    if action.slots:
        arm.animation_data.action_slot = action.slots[0]
    first, last = int(action.frame_range[0]), int(action.frame_range[1])
    bpy.context.scene.frame_set(last if frame_index < 0 else first + frame_index)
    return pose_vector(arm)


def chain_seams() -> dict:
    """How far each one-shot's final pose sits from the pose it hands off to.

    `fly -> airborne` and `land -> idle` are chained by the manifest, so a
    mismatch here is a visible pop on every launch and every homecoming. The
    author script eases the tail of each one-shot into its target, and this is
    what proves it did.
    """
    out = {}
    for source, target in CHAINS.items():
        end = pose_at(source, -1)
        start = pose_at(target, 0)
        if end is None or start is None:
            continue
        out[f"{source}->{target}"] = round(
            max(abs(a - b) for a, b in zip(end, start)), 5)
    return out


def main() -> None:
    args = arguments()
    wanted = [c.strip() for c in args.only.split(",") if c.strip()]
    names = sorted(a.name for a in bpy.data.actions
                   if not wanted or a.name in wanted)
    clips = {name: measure(name) for name in names}
    report = {"schema": "wyvern_clip_signature.v2",
              "about": "measured on public/models/wyvern-rig.blend; "
                       "regenerate with pnpm assets:wyvern-clips --measure",
              "fit_metres_per_unit": FIT,
              "chain_seams": chain_seams(),
              "clips": clips}
    text = json.dumps(report, indent=2, sort_keys=True)
    if args.out:
        with open(args.out, "w") as handle:
            handle.write(text + "\n")
        print(f"wrote {args.out}")
    print("<<<REPORT>>>")
    for name, sig in report["clips"].items():
        c = sig["cycle"]
        sym = sig["channels"]["wing_symmetry_error"]["max"]
        print(f"{name:<10} {sig['duration_s']:>5.2f}s "
              f"beats={c['beats']:<2} {c['cadence_hz']:>5.2f}Hz "
              f"stroke={c['stroke_deg']:>6.1f}d sym={sym:>7.3f} "
              f"bones={sig['moving_bone_count']:<3} distal={sig['distal_wing_bone_count']:<2} "
              f"seam={sig['loop_seam_max']:.4f}")


if __name__ == "__main__":
    main()
