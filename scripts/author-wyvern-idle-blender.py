"""Author the wyvern `idle` action, inside Blender.

`scripts/author-wyvern-idle.py` drives this. It replaces the `idle` action on
`WyvernRig` wholesale, from the parameter table below, and leaves every other
action untouched.

Why a generator rather than hand-keyed curves
---------------------------------------------
An idle is a sum of slow oscillators, and the thing that makes one read as alive
is that those oscillators do not share a phase: the chest leads, the neck
follows, the wings settle on their own beat, the tail trails the whole thing.
The previous clip moved five bones on one shared sine and read as a metronome.
Expressing the clip as `(cycles, amplitude, phase)` per channel makes the
phase relationships the editable surface, and makes the loop exact by
construction — every harmonic completes a whole number of cycles per loop, so
frame `PERIOD` reproduces frame 0 to floating-point.

Axis conventions are MEASURED, not assumed
------------------------------------------
Probed on this armature at +0.2 rad, reading the world displacement of a
chain-tip marker:

    Spine*/Neck*/Head   local +X pitches the head DOWN;  +Z yaws toward -X
    Tail1..Tail10       local +X lifts the tail UP  — the opposite sense to the
                        spine, because the tail runs +Y and the neck runs -Y
    Wing shoulder       local +X raises BOTH wings; grounded fold uses X-
    Wing elbow/wrist    local Z folds the spar; combined rotations are mirrored
                        directly as quaternions, not rebuilt as Euler angles
    Body.location       local +Z is world DOWN

The previous clip treated shoulder Z as the primary fold. That only swept the
wing while leaving the membrane open. A grounded fold starts with shoulder X-
and explicitly closes every weighted distal and membrane helper. The right side
is reflected from the left in quaternion space.
"""

from __future__ import annotations

import argparse
import math
import sys

try:
    import bpy  # type: ignore
    from mathutils import Euler, Quaternion  # type: ignore
except ImportError:
    bpy = None  # type: ignore
    Euler = Quaternion = None  # type: ignore

ARMATURE = "WyvernRig"
ACTION = "idle"

# 144 frames at 24 fps = 6.0 s. Keys run 0..PERIOD with the last key equal to
# the first, which is what makes the wrap seamless for three.js' LoopRepeat.
#
# Frame 0, not frame 1: the glTF exporter writes a key's time as frame/fps, so a
# clip starting at frame 1 has no key before t=1/24 and three.js clamps to the
# first pose for that opening frame — a 42 ms hitch on every loop. Starting at 0
# puts the first key at t=0 and the last at exactly 6.0 s. All production clips
# currently start at zero; this generator preserves that contract.
#
# Longer than the v1 reference idle (5.04 s) so the repeat is harder to spot.
PERIOD = 144
FPS = 24

# Harmonic cycle counts per loop. Both divide PERIOD exactly, so the composite
# is exactly periodic. BREATH is the fast one (2 per 6 s = 20 breaths/minute,
# a plausible resting rate for an animal this size); SWAY and SURVEY are the
# slow carriers that keep the wings and neck from locking to the breath.
BREATH, SWAY, TREMOR = 2, 1, 3

def wave(cycles: int, phase: float, frame_t: float, skew: float = 0.0) -> float:
    """One exactly-periodic harmonic, optionally phase-warped.

    `skew` bends the sine so the rise is quicker than the fall, which is what
    separates a breath from a pendulum. It is applied inside the argument so
    the result stays 2*pi periodic and the loop stays exact.
    """
    theta = 2.0 * math.pi * cycles * frame_t + phase
    if skew:
        theta = theta + skew * math.sin(theta)
    return math.sin(theta)


# ---------------------------------------------------------------------------
# The clip.
#
# Each entry is  bone -> channel -> (static, [(cycles, amplitude, phase), ...])
# Rotations are in DEGREES here and converted on the way in; `Body` location is
# in rig units. Amplitudes were tuned against the measured signature until the
# clip landed on the v1 `AA_DaenerysDragon_Battle_Stand` envelope — see
# docs/WYVERN_ANIMATION_BASELINE.md for what each measured channel means.
# ---------------------------------------------------------------------------

# Ribcage. The breath lives here rather than in the pelvis: putting it in the
# pelvis is what made the old clip lift both feet off the ground with every
# cycle. Negative X arches the chest upward. Each spine segment lags the one
# below it so the arch travels up the back instead of hinging in one place.
# Spine1 carries no breath on purpose: L_LegRoot/R_LegRoot are parented to it,
# so any rotation there swings both legs and unplants the feet. Spine2 and
# Spine3 sit above the leg attachment, so the arch is invisible to the stance.
SPINE = {
    "Spine1": {"rx": (0.0, [])},
    "Spine2": {"rx": (0.0, [(BREATH, -0.945, 0.15)])},
    "Spine3": {"rx": (0.0, [(BREATH, -0.656, 0.30)])},
}

# Pelvis. Deliberately tiny — a few centimetres of displayed travel, enough to
# carry the breath into the hips without unplanting the feet.
BODY = {
    "Body": {
        "rx": (0.0, [(BREATH, -0.23, 0.10)]),
        "rz": (0.0, [(SWAY, 0.23, 0.00)]),
        "tz": (0.0, [(BREATH, -0.985, 0.10)]),  # local +Z is world DOWN
        # Slow fore-and-aft weight shift. This, not the neck, is where an idle's
        # head reach actually comes from: the neck on this rig is nearly
        # straight at rest, so pitching it can only swing the skull up and down.
        # The feet ride the pelvis rigidly, so this shift is also the clip's
        # foot slide; it is held under 0.10 m, slightly less than the 0.11 m of
        # hip slide v1's own reference idle carries. On a ~3.5 m foot that is
        # about 3% of foot length and does not read at gameplay distance.
        # Removing it entirely would need 3-DOF leg IK — more machinery than an
        # idle earns, and a perfectly rigid pelvis is its own kind of stiff.
        "ty": (0.0, [(SWAY, 3.0, 0.35)]),  # local +Y is world FORWARD
    }
}

# Neck and head. Two jobs at once: the breath pushes the head up and forward on
# the inhale, and a slower survey drifts it side to side. The head then counter-
# rotates against the neck on both axes, which is how a real animal holds a
# gaze while its body moves under it — without it the skull rides the neck like
# a mast and the whole thing reads as a puppet.
NECK = {
    # The SWAY terms on Neck1/Neck2 are an opposed pair at the MEASURED
    # vertical-cancelling ratio: per radian, Neck1 lifts the snout 659 units and
    # Neck2 lifts it 482, so -0.73 : +1.00 nets to zero rise and leaves 61 units
    # per radian of pure fore-and-aft. Any other ratio pumps the head up and
    # down instead — a naive -1 : +1 measured 0.80 m of head rise against the
    # 0.39 m reference. The pair is kept modest: this rig would need an 18.8 deg
    # neck pump to reach v1's head travel on the neck alone, which reads as
    # craning, so the body's weight shift supplies the rest.
    "Neck1": {
        "rx": (0.0, [(BREATH, -0.46, 0.45), (SWAY, -1.46, 1.10)]),
        "rz": (0.0, [(SWAY, 0.200, 0.00)]),
    },
    "Neck2": {
        "rx": (0.0, [(BREATH, -0.63, 0.60), (SWAY, 2.00, 1.10)]),
        "rz": (0.0, [(SWAY, 0.336, 0.50)]),
    },
    "Head": {
        "rx": (0.0, [(BREATH, 6.334, 0.90), (SWAY, -0.68, 1.80), (TREMOR, 0.09, 0.0)]),
        "rz": (0.0, [(SWAY, -0.200, 0.90)]),
    },
}

# Wings, fully folded. These are absolute local quaternions measured on the
# clean rig against the EVALUATED SKIN, not Euler guesses or shoulder-to-tip
# distance. The old +35 degree shoulder-X / +/-30 degree Z pose merely moved a
# taut wing beside the torso: its side/front/top projected membrane area was
# 97.8% / 180.3% / 117.6% of cruise. This pose measures approximately
# 55.7% / 62.5% / 51.2% of cruise over the same 5,466 weighted wing faces.
#
# Local shoulder X- drops the wing against the body. Elbow, wrist, finger rays,
# distal finger bones, membrane struts, and the claw must all be explicitly
# authored; otherwise the root tucks while the visible membrane remains open.
# Values are stored only for the left side. The right side is reflected directly
# in quaternion space as (w, x, -y, -z), the measured mirror convention for this
# rig. Reconstructing mirrored combined rotations through Euler angles can add an
# unwanted Y component.
WING_FOLD_LEFT = {
    "L_WingRoot": (1.0, 0.0, 0.0, 0.0),
    "L_WingShoulder": (0.719340, -0.694658, 0.0, 0.0),
    "L_WingElbow": (0.534660, 0.435676, -0.508340, 0.515670),
    "L_WingWrist": (0.779975, 0.326319, -0.496899, 0.195569),
    "L_WingFinger1": (0.905604, 0.293643, -0.020185, 0.305364),
    "L_WingFinger2": (0.960126, 0.063122, 0.190884, 0.194263),
    "L_WingFinger3": (0.957662, 0.033783, 0.256605, -0.126079),
    "L_WingFinger1_end": (1.0, 0.0, 0.0, 0.0),
    "L_WingFinger2_end": (1.0, 0.0, 0.0, 0.0),
    "L_WingFinger3_end": (1.0, 0.0, 0.0, 0.0),
    "L_WingMembrane1": (0.981968, -0.052056, -0.154716, 0.095350),
    "L_WingMembrane2": (0.600352, 0.038914, -0.077891, -0.794982),
    "L_WingClaw": (0.810346, 0.564047, 0.085017, 0.134020),
}


def reflect_wing_quaternion(quaternion):
    """Reflect a left-wing local rotation onto the right-wing basis."""
    return Quaternion(
        (quaternion.w, quaternion.x, -quaternion.y, -quaternion.z)
    )


def wing_fold_quaternions() -> dict:
    """Return the complete bilateral absolute fold pose."""
    out = {}
    for left_name, components in WING_FOLD_LEFT.items():
        left = Quaternion(components).normalized()
        right_name = f"R_{left_name[2:]}"
        out[left_name] = left
        out[right_name] = reflect_wing_quaternion(left)
    return out

# Tail, as a travelling wave rather than a hinge.
#
# The old clip rotated Tail1 and Tail2 only, which swung all ten bones as one
# rigid spike and put 0.97 m of metronome wag on the tip. Here every bone gets a
# share, amplitude grows toward the tip, and each bone lags the one before it —
# so the shape moves down the tail and the tip trails the hips instead of
# leading them. LAG is per bone, in radians.
TAIL_LAG_LAT = 0.30
TAIL_LAG_VERT = 0.22
TAIL_LAT_DEG = [0.073, 0.095, 0.110, 0.125, 0.147, 0.162, 0.176, 0.191, 0.213, 0.213]
TAIL_VERT_DEG = [0.112, 0.131, 0.150, 0.187, 0.206, 0.225, 0.244, 0.281, 0.300, 0.300]


def tail_channels() -> dict:
    out = {}
    for i in range(10):
        bone = f"Tail{i + 1}"
        out[bone] = {
            "rz": (0.0, [(SWAY, TAIL_LAT_DEG[i], i * TAIL_LAG_LAT)]),
            "rx": (0.0, [(BREATH, TAIL_VERT_DEG[i], i * TAIL_LAG_VERT)]),
        }
    return out


# Hind legs hold the stance and do not move: the feet are planted, and v1's
# reference idle likewise measures zero toe motion. The -5 degree thigh pitch is
# the stance itself, carried over from the previous clip.
LEGS = {
    "L_Thigh": {"rx": (-5.0, [])},
    "R_Thigh": {"rx": (-5.0, [])},
}


# Per-group amplitude trims, applied on top of the tables above.
#
# These exist because the tables are written in whatever units read naturally
# for the channel, but the clip is judged on the MEASURED signature — head
# travel in metres, wing elevation in degrees. Tuning is therefore a sweep of
# these eight numbers against `measure-wyvern-clip-blender.py` until the clip
# lands on the v1 envelope, not an edit of thirty amplitudes by eye.
GAINS = {
    "breath_spine": 1.00,   # -> body_axis_deg range
    "breath_neck": 1.00,    # -> neck's own share of the breath lift
    # The head's counter-pitch against the chest arch, and the real lever on
    # head_up: the spine has to arch hard enough to read as breathing
    # (body_axis 2.3 deg), and that alone throws the skull 0.51 m. A resting
    # animal keeps its head roughly level while its chest heaves, so the head
    # pitches down as the chest lifts and the skull travel comes back to the
    # reference. Raising this LOWERS head_up.
    "head_level": 1.00,     # -> head_up range
    # Held at a low fixed value rather than solved. The -0.73 : +1.00 pair only
    # cancels vertical near zero; solving head_fwd on it alone drove it to a
    # +/-10 deg neck pump, where the linearisation fails and head_up blew out to
    # 0.67 m against a 0.39 m reference. Fore-and-aft is the body's job here.
    # Not solved for either. `head_fwd` is measured relative to the pelvis, so
    # no amount of body translation changes it, and this rig's neck is 98%
    # straight at rest (704 units of bone spanning 691), leaving under 0.10 m of
    # reach even fully extended. Rise and reach are geometrically locked on a
    # straight neck, so v1's 0.288 m of head reach alongside only 0.389 m of
    # rise is a property of ITS curved neck and does not port. Held low.
    "neck_reach": 1.00,     # -> head_fwd range (secondary)
    "neck_yaw": 1.00,       # -> head_lat range
    "tail_lat": 1.00,       # -> tail_lat range
    "tail_vert": 1.00,      # -> tail_up range
    "body_lift": 1.00,      # -> foot_*_up range (must stay planted)
    "body_shift": 1.00,     # -> foot_*_fwd range (must stay planted)
}


def _gain_for(group: str, channel: str, cycles: int, bone: str) -> float:
    if group == "spine" and channel == "rx":
        return GAINS["breath_spine"]
    if group == "neck":
        if channel == "rz":
            return GAINS["neck_yaw"]
        if channel == "rx":
            if cycles == TREMOR:
                return 1.0
            if cycles == SWAY:
                return GAINS["neck_reach"]
            return GAINS["head_level"] if bone == "Head" else GAINS["breath_neck"]
    if group == "tail":
        return GAINS["tail_lat"] if channel == "rz" else GAINS["tail_vert"]
    if group == "body":
        if channel == "tz":
            return GAINS["body_lift"]
        if channel == "ty":
            return GAINS["body_shift"]
    return 1.0


def clip_definition() -> dict:
    groups = (
        ("spine", SPINE),
        ("body", BODY),
        ("neck", NECK),
        ("tail", tail_channels()),
        ("legs", LEGS),
    )
    merged: dict = {}
    for group, table in groups:
        for bone, channels in table.items():
            scaled = {}
            for channel, (static, harmonics) in channels.items():
                scaled[channel] = (
                    static,
                    [
                        (cycles, amp * _gain_for(group, channel, cycles, bone), phase)
                        for cycles, amp, phase in harmonics
                    ],
                )
            merged.setdefault(bone, {}).update(scaled)
    return merged


def evaluate(spec, frame_index: int) -> float:
    """Value of one channel at `frame_index` in 0..PERIOD."""
    static, harmonics = spec
    frame_t = frame_index / PERIOD
    total = static
    for cycles, amplitude, phase in harmonics:
        skew = 0.35 if cycles == BREATH else 0.0
        total += amplitude * wave(cycles, phase, frame_t, skew)
    return total


def armature() -> bpy.types.Object:
    obj = bpy.data.objects.get(ARMATURE)
    if obj is None or obj.type != "ARMATURE":
        raise SystemExit(f"armature {ARMATURE!r} not found")
    return obj


def build(arm: bpy.types.Object) -> bpy.types.Action:
    if Euler is None or Quaternion is None:
        raise RuntimeError("this generator must run inside Blender")
    definition = clip_definition()
    folded_wings = wing_fold_quaternions()
    authored_bones = set(definition) | set(folded_wings)
    missing = [bone for bone in authored_bones if bone not in arm.pose.bones]
    if missing:
        raise SystemExit(f"bones not on the rig: {missing}")

    old = bpy.data.actions.get(ACTION)
    if old is not None:
        bpy.data.actions.remove(old)
    action = bpy.data.actions.new(ACTION)

    if arm.animation_data is None:
        arm.animation_data_create()
    arm.animation_data.action = action
    slot = action.slots.new(id_type="OBJECT", name=ARMATURE)
    arm.animation_data.action_slot = slot
    layer = action.layers.new("idle")
    strip = layer.strips.new(type="KEYFRAME")
    strip.channelbags.new(slot)

    for bone in sorted(authored_bones):
        pb = arm.pose.bones.get(bone)
        if pb:
            pb.rotation_mode = "QUATERNION"

    # Build evaluation tracks
    for f in range(PERIOD + 1):
        for bone, channels in sorted(definition.items()):
            pb = arm.pose.bones.get(bone)
            if not pb:
                continue
            
            # Evaluate location and rotation
            loc = [0.0, 0.0, 0.0]
            rot_euler = [0.0, 0.0, 0.0]
            
            for key, spec in channels.items():
                val = evaluate(spec, f)
                if key == "tx": loc[0] = val
                elif key == "ty": loc[1] = val
                elif key == "tz": loc[2] = val
                elif key == "rx": rot_euler[0] = math.radians(val)
                elif key == "ry": rot_euler[1] = math.radians(val)
                elif key == "rz": rot_euler[2] = math.radians(val)
            
            q = Euler(rot_euler, "XYZ").to_quaternion()
            pb.rotation_quaternion = q
            pb.location = loc
            pb.keyframe_insert(data_path="rotation_quaternion", frame=f)
            pb.keyframe_insert(data_path="location", frame=f)

        # The fold is absolute. Do not compose it over the old action's
        # per-frame wing rotations: those source keys are what reopened the web.
        # Spine3's breathing motion is inherited by WingRoot, so the folded
        # wings still settle with the ribcage without locally fanning open.
        for bone, quaternion in sorted(folded_wings.items()):
            pb = arm.pose.bones[bone]
            pb.rotation_quaternion = quaternion
            pb.location = (0.0, 0.0, 0.0)
            pb.keyframe_insert(data_path="rotation_quaternion", frame=f)
            pb.keyframe_insert(data_path="location", frame=f)

    action.use_frame_range = True
    action.frame_start, action.frame_end = 0.0, float(PERIOD)
    action.use_fake_user = True
    return action


def sanitize_materials() -> None:
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


def export(path: str) -> None:
    """Write the GLB. Only the wyvern rig and its mesh — the file also holds the
    old 291-bone vendor armature and two scratch armatures, and exporting those
    would change the joint set the manifest and `rigBones.ts` are written to."""
    sanitize_materials()
    for obj in bpy.context.scene.objects:
        obj.select_set(obj.name in (ARMATURE, "WyvernMesh"))
    bpy.context.view_layer.objects.active = armature()
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_skins=True,
        export_apply=False,
        export_yup=True,
        # Off to match how wyvern.glb was originally written. Left on, Blender
        # collapses every constant channel to two keys — harmless at runtime,
        # but it rewrites all 16 clips and buries the one that actually changed.
        export_optimize_animation_size=False,
    )
    print(f"exported {path}")


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--save", action="store_true", help="write the .blend back")
    parser.add_argument("--export", default="", metavar="PATH", help="write a GLB")
    parser.add_argument(
        "--gain",
        action="append",
        default=[],
        metavar="NAME=VALUE",
        help=f"override an entry in GAINS ({', '.join(GAINS)}). Repeatable.",
    )
    # Tolerant: Blender hands the same `--` argv to every -P script in the run,
    # so this one also sees the measurement script's flags.
    args, _ = parser.parse_known_args(argv)
    for override in args.gain:
        name, _, value = override.partition("=")
        if name not in GAINS:
            raise SystemExit(f"unknown gain {name!r}; expected one of {list(GAINS)}")
        GAINS[name] = float(value)

    scene = bpy.context.scene
    scene.render.fps = FPS
    arm = armature()
    action = build(arm)
    scene.frame_start, scene.frame_end = 0, PERIOD

    print(
        f"authored {ACTION}: {PERIOD + 1} frames, "
        f"{PERIOD / FPS:.2f}s, "
        f"{len(set(clip_definition()) | set(wing_fold_quaternions()))} bones"
    )
    if args.export:
        export(args.export)
    if args.save:
        bpy.ops.wm.save_mainfile()
        print(f"saved {bpy.data.filepath}")


if __name__ == "__main__":
    main()
