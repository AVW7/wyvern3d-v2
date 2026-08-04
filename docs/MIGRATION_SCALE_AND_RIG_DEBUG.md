# Wyvern v2 Migration: Scale Baseline and Rig Debugging

**Status:** Active migration record  
**Last verified:** 2026-08-03  
**Scope:** Moving the clean 46-bone `wyvern.glb` into the old Flight Lab / game world without changing the established world-size convention.

> **Rule:** scale, axes, hierarchy, ground contact, and animation channels are measured facts. Never infer them from a screenshot, a Blender viewport, an asset's filename, or a plausible-looking pose.

---

## 1. Migration Decision

The v2 rig is intended to **work in the existing world and Flight Lab**, not establish a new arbitrary scale system.

The existing game convention is:

- **1 Three.js world unit = 1 metre.**
- The existing adult dragon is displayed at approximately a **45 m wingspan**.
- Gameplay dimensions remain authored in `src/core/data`; mesh scale is visual fitting only.
- The new asset must be normalized to this same visual adult size before camera, scene, or animation work is judged.

Do not retune the world, combat distances, sanctuary layout, or every Flight Lab camera to compensate for an incorrectly scaled GLB.

---

## 2. Verified Scale Baseline

### 2.1 Old production reference — `drogon.glb`

The old model is the visual reference for the current Flight Lab and sanctuary framing.

| Measurement | Value |
|---|---:|
| Authored length | ~44 world units |
| Authored wingspan | ~63 world units |
| Authored standing height | ~11 world units |
| Manifest base fit | `DROGON_FIT = 0.72` |
| Displayed adult length | ~31.7 m |
| Displayed adult wingspan | **~45.4 m** |
| Displayed adult standing height | ~7.9 m |
| Default idle fit | `yOffset: -1.55` |

Source: old project `src/render/assets/manifest.ts` (the old model's source measurements and `DROGON_FIT`).

The old GLB uses `KHR_mesh_quantization` and meshopt compression. Its POSITION accessors are signed `int16` with `normalized: true`; raw accessor min/max values are **not direct metres**. Let Three.js/GLTFLoader decode it, or inspect its authored measurement documentation. Do not compare its raw integer accessor extents directly with an unquantized GLB.

### 2.2 New clean-rig export — `wyvern.glb`

`public/models/wyvern.glb` was inspected directly. Its POSITION accessors are Float32 and **not normalized**, so its raw bounding-box values are direct authored units.

| Measurement | Verified value |
|---|---:|
| Format | Float32 positions; no mesh-quantization extension |
| Raw X extent | 5395.04 cm |
| Raw Y extent | 1803.48 cm |
| Raw Z extent | 6139.24 cm |
| Raw bounds min | `[-2901.90, -207.23, -3386.65]` |
| Raw bounds max | `[2493.14, 1596.25, 2752.59]` |
| Authoring unit | centimetres |
| Current manifest scale | `0.01` |
| Displayed X extent at `0.01` | **53.95 m** |

The v2 manifest comment previously cited a 4541-unit span / 45.4 m output. The actual exported GLB measures 5395.04 units across its widest X extent: **18.8% larger** than that cited source value.

### 2.3 Target scale

Use the old project's displayed adult wingspan as the migration target:

```text
Target span                45.36 m
New GLB measured X span    5395.04 cm
Required manifest scale    45.36 / 5395.04 = 0.00841
```

**Recommended initial value: `scale: 0.0084`.**

This is the correct starting point for a v2 adult intended to match the old Flight Lab. It is deliberately not a final art-lock: remeasure after each export and make any final adjustment against a documented target (not visual guesswork).

### 2.4 What must *not* be copied from the old model

Do **not** transfer old `yOffset` values to `wyvern.glb`.

The old vendor rig's offsets compensate for its airborne-origin animation corpus, e.g. its idle skin was 1.57 units above its rig origin. The clean rig has its own root and foot placement; every v2 clip needs its own measured ground clearance.

Start the v2 rig at:

```ts
scale: 0.0084,
yOffset: 0,
```

Then derive a clip-specific `yOffset` after the clip exists and has been measured.

---

## 3. Flight Lab Compatibility

### Existing Flight Lab framing

The old lab constants were designed around the old displayed adult:

```ts
side:         { position: [250, 30, 0], fov: 35, target: [0, 25, 0] }
front:        { position: [0, 30, 250], fov: 35, target: [0, 25, 0] }
top:          { position: [0, 260, 0.01], fov: 35, target: [0, 0, 0] }
threeQuarter: { position: [170, 100, 170], fov: 40, target: [0, 20, 0] }
```

Once `wyvern.glb` is near the same ~45 m span, those are the appropriate compatibility reference—not the smaller v2 camera set currently in `src/app/debug/animation/constants.ts`.

The v2 cameras presently use `side: [130, 16, 0]`, target `[0, 8, 0]`. That is a deliberate tighter framing, not a scale measurement. Do not use a camera framing change as evidence that the model is correctly sized.

### Camera validation order

1. Normalize the mesh scale to the known adult target (`0.0084` initial value).
2. Render the unanimated bind/rest pose in the old compatible camera.
3. Check the physical comparison anchors: adult wingspan, sanctuary occupancy, player/deer scale.
4. Only then decide whether v2 should retain the old camera presets or intentionally adopt a tighter lab presentation.
5. Record any intentional camera change separately from the model scale decision.

---

## 4. Repeatable Debugging Procedure

Use this procedure any time the model is unexpectedly tiny, enormous, offset, clipped, floating, sunk, asymmetric, or behaves incorrectly after export.

### Step A — Establish which scale layer is wrong

There are four independent scale layers. Inspect them in this order:

1. **Mesh vertex units** — e.g. cm vs m in the GLB POSITION accessors.
2. **Node / armature transform** — a root object scale may bake or compensate for conversion.
3. **Runtime asset manifest scale** — `AssetEntry.scale`.
4. **Caller/species scale** — Flight Lab species or life-stage multiplier passed to `GameModel`.

The effective render scale is:

```text
vertex units × node transform × asset manifest scale × caller/species scale
```

Never fix a root transform mistake by permanently distorting a camera or a scene layout.

### Step B — Inspect the exported GLB, not the Blender expectation

Use GLB accessor bounds to establish what actually shipped. The following read-only Python script works without external packages for uncompressed JSON chunks and reports declared POSITION bounds:

```bash
python3 - <<'PY'
import json, struct, sys

path = 'public/models/wyvern.glb'
with open(path, 'rb') as f:
    if f.read(4) != b'glTF':
        raise SystemExit('Not a GLB')
    f.read(8)
    chunk_length = struct.unpack('<I', f.read(4))[0]
    chunk_type = f.read(4)
    if chunk_type != b'JSON':
        raise SystemExit('Expected JSON chunk')
    gltf = json.loads(f.read(chunk_length).decode().rstrip('\0').rstrip())

positions = set()
for mesh in gltf.get('meshes', []):
    for primitive in mesh.get('primitives', []):
        accessor = primitive.get('attributes', {}).get('POSITION')
        if accessor is not None:
            positions.add(accessor)

for index in sorted(positions):
    accessor = gltf['accessors'][index]
    print(index, accessor.get('componentType'), accessor.get('normalized', False),
          accessor.get('min'), accessor.get('max'))
PY
```

For an ordinary Float32 `wyvern.glb`, calculate each dimension as:

```text
extent = max - min
world metres = extent × manifest scale
```

**Quantization warning:** if `normalized: true` or `KHR_mesh_quantization` is present, raw accessor values are encoded values. Do not apply the simple formula above until decoded by the loader or an accessor-aware inspector.

### Step C — Check dimensions against fixed world anchors

Use anchors which exist independently of the current camera:

| Anchor | Expected relationship |
|---|---|
| Adult wyvern wingspan | ~45 m for old Flight Lab compatibility |
| Player eye height | 1.6 world units (`CharacterController.EYE_HEIGHT`) |
| Sanctuary | Adult should be large but not consume the campus |
| Old displayed Drogon | ~31.7 m length / ~45.4 m wing span at `DROGON_FIT` |

If a scale differs by 10% or more, treat it as a numerical/export problem first, not an artistic preference.

### Step D — Separate scale from ground contact

A correctly sized dragon can still float or sink. That is normally a **clip ground-clearance / `yOffset`** problem, not a scale problem.

For each animation clip:

1. Sample the animated skin's minimum world Y at 48 or more evenly distributed frames.
2. Find the lowest sampled value, `ground_clearance.min`.
3. Set the clip's `yOffset` to `-ground_clearance.min` only if the clip is intended to be planted.
4. Keep airborne clips at the flight director's altitude (`yOffset: 0`) unless the design explicitly requires otherwise.
5. Re-run the numeric contract validation and inspect a viewport only after the numbers pass.

### Step E — Prove axes and signs with a single-channel probe

For a new rig, never port a rotation sign from the old vendor rig.

For each control bone/channel:

1. Save the neutral/rest pose.
2. Apply a small isolated delta, such as `+0.10 rad`, to **one** local rotation channel.
3. Read world-space positions of the relevant landmarks before/after: head, wing tips, feet, tail tip.
4. Repeat with `-0.10 rad` if the sign is unclear.
5. Record the observed effect in the new-rig baseline document.
6. Reset completely before probing the next channel.

Minimum probes before authoring procedural motion:

- root pitch, roll, yaw;
- spine / body bend;
- neck pitch and yaw;
- left and right wing shoulder elevation;
- left/right wing differential for banking;
- tail pitch and yaw;
- thighs, calves, feet, and toe curl.

A valid statement is: “`L_WingShoulder.localRotation.z = +0.1` lifts its wing tip by X and moves the opposite tip by Y.”  
An invalid statement is: “Z should be pitch because Blender says so.”

### Step F — Verify hierarchy and weight transfer

Before animation work, prove the clean rig actually has the intended structural improvement:

- `RootMotion` is the highest motion-bearing bone.
- Both wing roots descend from `Spine3`, never from neck bones.
- L/R names and parent chains are exact mirrors where designed.
- The GLB has the expected 46-bone hierarchy after export.
- Every vertex is weighted; no mesh region is unweighted or accidentally bound to a stray bone.
- Bind pose renders correctly in Three.js, not only Blender.

### Step G — Validate runtime wiring separately

If Blender measurements are correct but Flight Lab is wrong, inspect runtime wiring:

- `src/render/assets/manifest.ts`: GLB URL, `scale`, asset `yOffset`, clip names.
- `src/app/debug/animation/constants.ts`: model path, animation path, bone names, markers, cameras, species/life-stage multipliers.
- `GameModel`: actual multiplication order of asset vs caller scale and offset application.
- Browser console: missing clip/bone messages and GLTF loader errors.
- Flight Lab: active species, stage multiplier, clip, and camera preset.

A scale fix is complete only when the same measurements make sense in Blender, the GLB inspection, the manifest, and the running Flight Lab.

---

## 5. Required Evidence for Every Export

Add an entry to the migration log after each export that changes geometry, armature transforms, root transforms, or unit convention.

```md
### YYYY-MM-DD — Export N: short description

- Source `.blend`: `public/models/wyvern-rig.blend`
- Exported GLB: `public/models/wyvern.glb`
- Blender unit convention / armature object scale:
- GLB encoding: Float32 / quantized; normalized status:
- GLB bounds min/max:
- Derived X/Y/Z extents:
- Manifest scale and effective m dimensions:
- Root/foot ground-clearance in bind pose:
- Flight Lab camera used for comparison:
- Comparison outcome against ~45.4 m old adult target:
- Hierarchy / weight verification result:
- Commands and test results:
- Decision / follow-up:
```

Never overwrite prior entries; append a new dated record. That creates an audit trail when a later Blender export silently reintroduces centimetre/metre or object-scale drift.

---

## 6. Current Migration Log

### 2026-08-03 — Clean 46-bone rig export measured

- Source: `public/models/wyvern-rig.blend`
- Export: `public/models/wyvern.glb` (16.7 MB)
- Rig: clean 46-bone armature; `RootMotion` added; wing hierarchy rebuilt to originate at `Spine3`.
- Weight transfer: completed with full vertex coverage (prior build record).
- Actual GLB bounding extents: `5395.04 × 1803.48 × 6139.24` authored centimetre units.
- Current manifest scale: `0.01` → ~53.95 m across X extent.
- Compatibility target: ~45.36 m old adult span.
- Correct initial scale for compatibility: **`0.0084`**.
- The previous 4541-unit / 45.4 m manifest comment does not match the exported GLB; its input measurement needs replacing with the verified export measurement.
- Current animation state: clips have not yet been authored/measured for the new rig. `yOffset: 0` is correct as a temporary neutral value only.
- Next required action: update the scale declaration and manifest comment together; validate bind pose in the old-compatible Flight Lab camera before authoring clips.

### 2026-08-03 — Export N+1: every clip was shipping the rest pose (`rotation_mode` mismatch)

- Source `.blend`: `public/models/wyvern-rig.blend`
- Exported GLB: `public/models/wyvern.glb` (17.98 MB)
- GLB encoding: Float32 POSITION, not normalized, no mesh-quantization extension.
- Derived X/Y/Z extents: `6272.23 × 1107.31 × 4162.21`, bind pose, wings spread,
  symmetric in X at `±3136.11`. Bone node translations are centimetres
  (`Neck1.y = 178.70`), so mesh and skeleton now share one unit convention.
- Hierarchy / weight verification: 48 nodes, 46 joints, 1 skin, 17180 verts,
  0 unweighted vertices. Unchanged from the previous export.
- Commands and test results: `pnpm typecheck` clean; `pnpm test` 366 passed,
  35 skipped. `pnpm lint` reports 5 pre-existing errors in
  `src/render/coordination/{examples,flightCoordination}.ts`, untouched here.

**Symptom.** Every one of the 16 clips played as a static bind pose. Direct GLB
inspection found each of the 138 channels collapsed to exactly 2 keyframes with
`STEP` interpolation, whose two values matched the node's rest TRS to within
float rounding (max delta `1e-4`). Clip names and durations were correct, which
is what made it read as a runtime playback fault rather than an export fault.

**Root cause.** All 46 pose bones carried `rotation_mode = 'QUATERNION'`, while
all 1335 F-curves across all 16 actions key `pose.bones[...].rotation_euler`
(plus 432 `location` curves; there is not one quaternion curve in the file).
Blender evaluates a pose bone's rotation only from the channel matching its
`rotation_mode`, so every Euler curve was ignored and the pose never left rest.
The exporter then sampled a static pose on every frame and its
`export_optimize_animation_size` pass legitimately reduced each dead channel to
2 STEP keys. The keyframe data was never lost — it was unreadable by the rig.

**Correction.** Set `rotation_mode = 'XYZ'` on all 46 pose bones. Verified safe
first: no bone had a non-identity `rotation_quaternion`, so the switch could not
displace the pose. Re-exported with `export_force_sampling=True`,
`export_optimize_animation_size=False`, and `export_rest_position_armature=False`.

**Re-verification.** All 16 clips now carry motion at full key density (24–120
keys per channel, no 2-key collapse). Sampled `L_WingShoulder` travel:
cruise 40°, hover 110°, bankLeft 37.5°, takeoff 90.1°, speed 60°, walk 0°
(correctly wingless), glide 5.3°.

**Collateral risk found and fixed.** 15 of the 16 actions sat at `users = 0`
with `use_fake_user = False`, surviving only because the file was open. The next
save would have purged them. All 16 now carry a fake user.

**Guard for next time.** `rotation_mode` versus keyed channel type is a rig-level
precondition, not an export setting. Before any export, assert that the channel
type the actions key matches what every pose bone reads; a clip whose F-curves
are intact can still export as pure rest pose, and the GLB gives no warning.

### 2026-08-03 — Export N+2: skeleton repair (tail, wing, head weights)

- Source `.blend`: `public/models/wyvern-rig.blend`
- Exported GLB: `public/models/wyvern.glb` (18.16 MB), 52 nodes / **50 joints** / 16 clips
- Bone count 46 → 50 (`Tail7`–`Tail10` added)
- Commands: `pnpm typecheck` clean; `pnpm test` 366 passed, 35 skipped. `pnpm lint`
  still reports 5 pre-existing errors in `src/render/coordination/*`, untouched.

Three structural defects were found by measurement and repaired. The bind pose
rendered cleanly throughout, which is why none of them surfaced in a screenshot —
each only appears once a bone rotates.

**1. `Tail1` and `Jaw` had been swapped during the rig build.**
`Tail1`'s head sat at `y = −917` — under the jaw, past `Head` (−547) and beside
`Jaw` (−879) — while the rest of the tail began at `Tail2` (`y = +486`), 1313
units away on the other side of the body. Its vertex group held **3692 snout
vertices** and was the sole influence for 2936 of them, while the real `Jaw`
bone deformed nothing. Since the chain is `Body → Tail1 → Tail2 → … `, the whole
tail pivoted from the chin: the 6° `Tail1` key in `cruise` swung the tail tip
120.8 units about the wrong end of the animal.
*Repair:* snout weights folded into `Head` (no vertex orphaned), `Tail1` moved to
span pelvis → `Tail2`'s head as a weightless pivot — the same pattern `Root` and
`RootMotion` already use. Verified: `Tail1 +0.2 rad` now moves the tail tip 459.3
and the snout **0.0**.

**2. The last 1205 units of tail had no bone.**
`Tail6`'s tip ended at `y = 2025.7`; the mesh ran to `y = 3230.8`. 797 vertices
lay beyond it, 671 rigidly weighted to `Tail6` at weight 1.0 — the straight
spike visible from above.
*Repair:* `Tail7`–`Tail10` laid along the measured mesh centroid path, weights
redistributed by linear blend. Tip displacement now falls off monotonically:
450 / 352 / 269 / 181 / 91 for `Tail6`…`Tail10` at +0.30 rad.

**3. The wing was built without reference to the membrane.**
Every wing bone was near-perpendicular to the geometry it drove — the three spar
bones pointed *straight down* while the membrane ran outboard along +X:

| bone | was off by | now |
|---|---:|---:|
| `L_WingFinger1` | 88.2° | ~12° |
| `L_WingFinger2` | 84.9° | ~7° |
| `L_WingFinger3` | 84.1° | ~4° |

1019 units of wingtip also had no bone (mesh reached `x = 3136.1`, furthest bone
tip `x = 2116.8`), the spars started ~700 units off the wrist, and
`L_WingFinger3_end` owned geometry centred 963 units inboard of itself. The wing
could not fold: driving elbow + wrist + all three spars shrank span by only 15%
while z-spread doubled — the membrane tore rather than folded.
*Repair:* three spar tips extracted from the mesh by an angular outline sweep
about the wrist (local radius maxima at −15°, +3°, +27°); wrist re-aimed down the
fan; each spar rebuilt as a two-segment chain knuckle → mid → tip; weights
re-transferred by distance-to-segment, smoothed, limited to 4 influences.
Verified: the wing now folds coherently, 25.6% span reduction, and wing weight is
spread across all nine bones (shoulder 257, elbow 188, wrist 188, spars
206/177/138, tips 108/119/131 — the tips previously had none).

**4. 3407 mis-bound influences mesh-wide.** Head and jaw geometry was scattered
onto tail, spine and wing bones — `Spine3→Head` 412, `Tail5→Head` 402,
`L_WingShoulder→Head` 299, `L_WingWrist→Jaw` 165. Neck vertices sat on `Tail5`
at 1817 units' distance with weight 0.66, which is what produced the stretched
shards visible on the neck in a posed frame. Stripped every influence more than
600 units away *and* over 3× the nearest bone's distance, renormalised, smoothed.
**3407 → 145 remaining**, mostly toes (60) where a genuinely small bone sits far
from a large vertex cluster.

**Still open after this export**
- `Jaw` remains weightless and its bone is reversed — head at the snout tip,
  pointing back and up into the skull. Giving the mouth a hinge needs the bone
  rebuilt, not re-weighted.
- At rest the wing membrane's leading spar reaches `z = −42.6`, below the feet
  (`z = −2.8`), so a standing wyvern's wingtips touch the floor. This is not a
  scale or weight fault: `idle`/`walk`/`rest` key no wing channels at all, so the
  wings hold the spread bind pose while grounded. Now that the wing folds, those
  clips can fold it — that is clip work, not rig work.
- `L_WingRoot`/`R_WingRoot` are now weightless pivots rather than duplicates of
  the shoulder, which is the intended shrug/attachment channel but is unused.

### 2026-08-03 — Export N+3: full model audit, skin repair

- Exported GLB: `public/models/wyvern.glb` (18.47 MB), **56 joints**, 16 clips
- Bones added: `L/R_WingMembrane1`, `L/R_WingMembrane2`, `L/R_WingClaw`
- `pnpm typecheck` clean; `pnpm test` 366 passed, 35 skipped.

**The measurement that found everything.** Ratio of each edge's posed length to
its bind length, sampled across every clip. A skinning fault that no screenshot
resolves shows up here as a number: before the repair the worst edge went from
10.7 units at bind to 1404.7 posed — a **131× stretch**, which is the thin dark
needle that appeared to hang off each wingtip toward the floor.

| clip | worst edge stretch before | after |
|---|---:|---:|
| `bankLeft` | 131.4× | 8.9× |
| `hover` | 125.7× | 12.9× |
| `takeoff` | 124.7× | 28.3× |
| `cruise` | 110.6× | **4.9×** |
| `speed` | 100.6× | 11.3× |
| `glide` | — | 7.3× |

**Root cause 1 — the wing claw was bound to the foot.** The hooked thumb at
`(±1320, −714, 520)` carried `L_Toes`/`R_Toes` at weight **0.81–0.94**. Every
clip therefore stretched it between the wing and the foot, and because the foot
sits near the ground the claw skin was dragged toward the floor. 435 such
influences existed. **Now zero foot or toe influence anywhere in the wing region.**

**Root cause 2 — the trailing membrane had no bone.** 418 vertices (1.9%) sat
more than 500 units from *any* bone, up to a maximum of 1167, clustered in the
wing's trailing lobe from `(±900, 600, 900)` out to `(±1800, 1200, 900)`. That
region is exactly what the pre-rebuild 44-bone rig covered with
`L/R_WingMembrane1/2` — bones that were dropped when the rig went to 46 joints
with `_end` bones instead. Restored, plus a `WingClaw` per side.
**Vertices beyond 500 units from a bone: 418 → 0.**

**A false negative worth recording.** The first cross-limb pass classified each
vertex by its single nearest bone. For the trailing-membrane vertices the nearest
bone happened to be `L_LegRoot`, so they were classified "leg" and their `L_Toes`
weight was *kept* — the fix silently skipped the vertices it most needed to
correct, and the stretch only fell from 131× to 50×. Classifying by a vote of the
three nearest bones fixed it. When a heuristic repairs 90% of a defect, check
whether the residue is the same defect rather than a smaller one.

**Audit results after repair**

| check | result |
|---|---|
| Bone L/R mirror symmetry | 0 asymmetric, 0 unmirrored |
| Unexpected parents | none |
| Bones deforming nothing | `Root`, `RootMotion`, `Tail1` only — all intentional pivots |
| Geometry far from its own bone | none |
| Unweighted vertices | 0 |
| Vertices over 4 influences | 0 |
| Weight sums off by >2% | 0 |
| Mis-bound influences | 3407 → 145 → **cross-limb: 0** |
| Single-influence vertices | 50.9% → **23.4%** (vendor corpus: 33.4%) |

### 2026-08-03 — Export N+4: head/neck skin, island sweep, audit closed

- Exported GLB: `public/models/wyvern.glb` (18.47 MB), 56 joints, 16 clips.
- `pnpm typecheck` clean; `pnpm test` 366 passed, 35 skipped.

**Island sweep (the class edge-stretch cannot catch).** The mesh is 597 separate
connected components. Each is weighted independently, so a stray island can fly
off without stretching a single edge. Checked every island's dominant bone against
its centroid: **0 islands bound to a far bone, 0 split across distant bones.**
The single flag was the 8278-vertex main body, a false positive from comparing a
whole-body centroid against its highest-total-weight bone.

**Head/neck hotspot.** Neck and skull vertices near the midline carried
`L_WingShoulder`/`R_WingShoulder` at weight **0.6–0.93** from 214–342 units away,
while the nearest bone (`Jaw`) sat 52–87 units off. The previous pass used an
absolute 350-unit cut-off, so these sat just underneath it and survived. Replaced
with a *relative* rule — strip a cross-region influence when the bone is over 2.5×
the nearest bone's distance and beyond 150 units — which removed 512 more,
190 of them `L_WingShoulder` reaching into the head.

**Absolute displacement is the honest metric, not the ratio.** A 23× stretch on a
3-unit bind edge is 70 units, which is 0.5 m at `WYVERN_FIT` on a ~45 m animal —
invisible. The original defect was 131× on a 10.7-unit edge: 1404 units, **10 m**,
which is the needle that was visible from across the scene.

| clip | worst posed edge, before | after |
|---|---:|---:|
| `bankLeft` | 1404 units (10.1 m) | 26 units (0.19 m) |
| `takeoff` | 1333 units (9.6 m) | 25 units (0.18 m) |
| `cruise` | 1182 units (8.5 m) | 20 units (0.14 m) |
| `attack` | — | 108 units (0.78 m) |

**Final audit — shipped GLB**

| check | result |
|---|---|
| Unweighted vertices | 0 |
| Weight sums off by >2% | 0 |
| Vertices >500 units from any bone | 0 (was 418) |
| Cross-limb influences | 14 (was 3407) |
| Vertices over 4 influences | 0 |
| Single-influence vertices | **22.8%** (vendor corpus 33.4%) |
| Islands bound to a far bone | 0 of 597 |
| Zero-weight joints | `Root`, `RootMotion`, `Tail1` — intentional pivots |
| Clips carrying real keys | 16 of 16 |

**Known, not addressed**
- `Jaw` bone is reversed — head at the snout tip, pointing back and up into the
  skull. It deforms 752 vertices, so a mouth *works*, but hinges from the wrong
  end. Rebuilding it is authoring, not repair.
- Residual stretch peaks at `(−98, −161, 482)` on the throat/chest underside,
  which is 317 units from the nearest bone. Thin skeletal coverage rather than a
  binding error; the absolute displacement is under 0.8 m.
- Wing-membrane clip work is still outstanding: `idle`/`walk`/`rest` key no wing
  channels, so a grounded wyvern holds the spread bind pose and its wingtips
  reach the floor. The wing folds now, so this is clip authoring.

---

## 7. Runtime Animation Audit — 2026-08-03

### Symptom

The rebuilt `wyvern.glb` rendered in the Flight Lab but appeared static even when
`cruise`, `hover`, or `bankLeft` was selected.

### Reproduction evidence

The new GLB itself contains 15 animation clips, including `cruise` (2.04 s),
`hover` (2.50 s), `bankLeft` / `bankRight` (2.00 s), `takeoff`, `land`, and
`walk`. The direct GLB inspection found substantial keyed shoulder motion in
`cruise` (80°) and banks (up to 100°), so this was not an export-without-clips
failure.

The live Flight Lab readout instead reported:

```text
requested   cruise
clip        —
time        0.00s / 0.00s
```

### Root cause and correction

The rebuilt `GameModel` runtime had two broken GLTF/Three seams:

1. It looked for clips on `scene.animations`; GLTFLoader provides them on the
   GLTF result's `animations` array, so its clip map was empty.
2. It constructed `new AnimationMixer(null!)`. Three.js requires a real root
   object when resolving clip tracks; a null-root mixer throws on `clipAction`.

`GameModel` now reads the GLTF payload's `animations` and constructs the mixer
with the per-instance `SkeletonUtils` clone. A focused regression test,
`src/render/assets/GameModel.loader-contract.test.ts`, guards both requirements.

### Runtime re-verification

After the correction, the same live Flight Lab reports active, advancing clips:

```text
requested   cruise
clip        cruise
time        1.76s / 2.04s
```

and subsequently:

```text
requested   bankLeft
clip        bankLeft
time        0.78s / 2.00s
```

The model's bounds and left/right foot positions change across the bank pose,
confirming that the clone's skeleton is now receiving the track data.

### Remaining quality finding

Playback is restored, but the new authored clips are intentionally much sparser
than the old 52-clip vendor corpus. The numeric inspection found:

- `cruise`: five materially changing rotation tracks, chiefly wing shoulders
  (80°) and elbows (25°);
- `dive`: no materially changing rotation tracks;
- `glide`: only ~3.3° shoulder and ~1.6° elbow travel;
- most spine, neck, wrist, finger, and tail tracks remain static in the flight
  clips.

That means the immediate “does not move” fault is fixed, but the new rig will
not yet have the richness of the old Flight Lab until those clips are authored,
measured, and promoted through the numeric animation-contract pipeline. Do not
mistake restored playback for completion of the animation migration.

---

## 8. Migration Completion Criteria for Scale

The scale portion of the migration is complete only when all items are true:

- [ ] `wyvern.glb` has one documented unit convention, with no unexplained root-scale compensation.
- [ ] Manifest base scale has a measured derivation and produces the selected adult target size.
- [ ] The manifest comment cites the measured exported dimensions, not stale source assumptions.
- [ ] Old Flight Lab-compatible camera frames the normalized v2 dragon credibly.
- [ ] Player, sanctuary, and wildlife comparisons are documented.
- [ ] New animations have per-clip measured ground clearance / `yOffset` values.
- [ ] New bone channels and signs have been probed and documented.
- [ ] The GLB hierarchy, skin weights, TypeScript checks, lint, tests, and Flight Lab runtime validation pass.

---

## Related Documents

- `MIGRATION_STATUS.md` — phase/status tracker and high-level decisions.
- `docs/NEW_RIG_SPEC.md` — target clean hierarchy and rig requirements.
- `docs/RIG_BUILD_STATUS.md` — rig construction record.
- `docs/WYVERN_ANIMATION_BASELINE.md` — vendor-rig evidence and the reason numeric validation is mandatory.
- `docs/WYVERN_ANIMATION_PLAN.md` — staged animation work orders.
- `src/render/assets/manifest.ts` — runtime asset scale and clip mapping.
- `src/app/debug/animation/constants.ts` — Flight Lab models, bone markers, cameras, and display multipliers.
