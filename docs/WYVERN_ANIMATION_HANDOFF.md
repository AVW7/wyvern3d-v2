# Wyvern v2 animation handoff — 2026-08-05

## Scope completed in this session

The repaired-rig animation set was rebuilt from the v1 behavior references, then received a focused **wing sweep + span extension/folding** pass for:

- `cruise`, `scout`, `hover`, `speed`
- `bankLeft`, `bankRight`
- `takeoff`, `land`

The current exported asset is:

- `public/models/wyvern.glb` — 17.1 MB
- Source Blender file: `public/models/wyvern-rig.blend`
- Export contains exactly 16 actions: `attack`, `bankLeft`, `bankRight`, `breath`, `cruise`, `death`, `dive`, `glide`, `hover`, `idle`, `land`, `rest`, `scout`, `speed`, `takeoff`, `walk`.

## Non-negotiable source of truth

Before editing anything, read:

1. `CLAUDE.md`
2. `docs/WYVERN_ANIMATION_BASELINE.md` — especially **Measured rig axes**
3. `docs/WYVERN_V1_REAUTHORING_SOURCE_OF_TRUTH.md`
4. `docs/WYVERN_V1_CORE_CAPTURE_RECORDS.md`
5. `docs/FLIGHT_ANIMATION_DEVELOPMENT.md`
6. `docs/WYVERN_ANIMATION_PLAN.md`

Do not assume a rotation sign or an axis. Probe the live `WyvernRig` in Blender first.

## Measured repaired-rig controls

These were probed live in Blender, not inferred:

| Bone/control | Local transform behavior |
|---|---|
| `L/R_WingShoulder` X | symmetric wing elevation: positive = up, negative = down |
| `L/R_WingShoulder` Z | antisymmetric fore/aft sweep; mirror the Z component on the right |
| `L_WingWrist` Z | major span-fold / sweep contribution |
| `L_WingFinger1` X | meaningful span retraction when negative |
| Finger-chain Z | small membrane-tip/ripple motion; mirror Z on the right |
| Wing-chain quaternion mirror | copy `w,x`, negate `y,z`: `(w, x, -y, -z)` |
| `Body` X | positive = nose down; negative = nose up |

**Important:** Do not reconstruct a reflected wing quaternion through Euler angles. With both X and Z motion, that creates an unwanted Y term and breaks wing symmetry. Use direct quaternion reflection.

## Current authoring pipeline

The scripts are deliberately separate. If rerunning them, preserve this exact order:

```text
1. scripts/author-organic-flight.py
2. scripts/author-organic-ground.py
3. scripts/enforce-ground-wing-mirrors.py
4. scripts/author-membrane-secondary.py
5. Reapply the breath Body pitch correction (see below)
6. Export GLB and save the .blend
```

### Why the order matters

- `author-organic-flight.py` removes/recreates the flight actions.
- `author-organic-ground.py` removes/recreates only ground actions and preserves flight actions.
- `enforce-ground-wing-mirrors.py` must run **after** the ground author because it repairs local right-wing pose reflection for symmetric ground clips.
- `author-membrane-secondary.py` must run after both action authors so all exported clips have animated membrane tracks.

### Active scripts

| Script | Purpose |
|---|---|
| `scripts/author-organic-flight.py` | Full-wing-chain flight actions, nonuniform stroke timing, sweep, recovery folding, tail/neck/spine overlap |
| `scripts/author-organic-ground.py` | Ground, attack, breath, takeoff, land, death actions; takeoff/land include transition-specific span/sweep poses |
| `scripts/enforce-ground-wing-mirrors.py` | Mirrors action curves for `idle`, `rest`, `attack`, `breath`, `takeoff`, `land`, `death`; excludes deliberately asymmetric `walk` |
| `scripts/author-membrane-secondary.py` | Adds loop-safe local motion to all four membrane bones |
| `scripts/measure-v2-clips.py` | Blender-side v2 measurement helper |

### Breath pitch correction

The ground author provides the breath staging, but its Body line needs a source-informed correction after regeneration. Preserve the existing Body location while keying `Body` local X to `+25°` every three frames, 0–48 inclusive. This measures roughly `-14.2°` body pitch versus v1’s `-15.2°` target.

## Latest measured sweep/span result

Measurements use `L_WingFinger1` tip relative to `L_WingShoulder`.

| Clip | Span modulation | Sweep range |
|---|---:|---:|
| `cruise` | 17.9% | 80.1° |
| `scout` | 19.9% | 76.6° |
| `hover` | 22.2% | 56.0° |
| `speed` | 15.9% | 53.6° |
| `bankLeft` | 14.7% | 80.4° |
| `bankRight` | 17.9% | mirrored asymmetric bank |
| `takeoff` | 9.8% | 98.9° |
| `land` | 7.0% | 76.5° |

The span motion is a phased mechanism, not generic noise:

- recovery/upstroke: Wrist Z + Finger1/2/3 X fold the span;
- pre-power/power stroke: fold releases and the wing opens;
- shoulder Z supplies fore/aft sweep;
- finger Z supplies a smaller delayed membrane ripple.

## Last verified gates

```text
pnpm assets:validate-wyvern  PASS
pnpm typecheck               PASS
pnpm test                    PASS — 370 passed, 35 skipped
```

`assets:validate-wyvern` reported:

```text
wyvern.glb clean: wings mirrored, loops closed, every clip starts at t=0
```

`pnpm lint` is currently blocked by existing unrelated repository contents, including `.claude/worktrees/**/.next/**` generated files and existing errors in `src/render/coordination/`. Do not attribute those failures to the animation scripts without first cleaning/isolating the worktrees.

## Next recommended pass

**Toe/claw articulation + contact force**, in this order:

1. `walk`: toe curl and release aligned to stance/swing; preserve intentional wing-knuckle asymmetry.
2. `attack`: toe grip during anticipation, release on lunge, follow-through recovery.
3. `breath`: planted-claw bracing and asymmetric weight commitment.
4. `takeoff`: toe/foot push-off followed by tuck as the first power stroke begins.
5. `land`: splayed landing claws before contact, compression/grip at impact, then settle.
6. `death`: involuntary curl/release and asymmetric final contact.

Use the v1 records to target the measured toe ranges, not a generic foot wave:

| v1 reference behavior | Toe-curl range |
|---|---:|
| Attack | 60.74° |
| Walk | 57.70° |
| Death | 46.70° |
| Breath | 26.50° |
| Cruise | 12.78° |

After any authoring change: export, save, run `pnpm assets:validate-wyvern`, `pnpm typecheck`, and `pnpm test`.

## Key Criteria to Identify When Creating/Re-Authoring Animations

Whenever authoring a new clip or re-authoring an existing action on the `WyvernRig`, verify these 8 essential criteria:

| Criterion | Key Metric / Channel | Authoring Requirement |
|---|---|---|
| **1. Ground vs. Flight Wing Posture** | `wing_extension_L/R`, `wing_elev_L` | **Ground clips:** Wings folded along body (`up: -15°..-20°`, `elbow: +30°..+35°`, `wrist Z: -18°`). **Flight clips:** Open span flexed with stroke amplitude. |
| **2. Ground Clearance & `yOffset`** | `ground_clearance.min` | Plant lowest skin contact at $y=0$ via `ClipSpec.yOffset = -ground_clearance.min`. |
| **3. Quadrupedal Gait & Asymmetry** | `foot_asymmetry`, `symmetry_error` | Ground walk preserves alternating wing-knuckle stance (`foot_asymmetry > 0.1 m`). Do not apply rigid symmetric mirroring to `walk`. |
| **4. Toe / Claw Articulation** | `toe_curl_deg` | **Stance phase:** Splay/extend claws (`toe_curl_deg` negative). **Swing phase:** Curl claws upward (`toe_curl_deg` positive). Match v1 ranges (`attack`: 60.74°, `walk`: 57.70°). |
| **5. Body Axis & Attitude Line** | `body_axis_deg` | Streamlined flight (~0°–12°), nose-down walk (~7°), hover/land upright (25°–36°). |
| **6. Wing Surface Secondary Flex** | `matrix_basis` rotation | Wrist, finger, and membrane joints must flex with lagging phase relative to shoulder carrier ($\ge 0.005$ rad). |
| **7. Seams & One-Shot Chaining** | `seam_rot`, `seam_pelvis`, `spec.next` | Loops must close seamlessly ($< 0.01$). One-shots must set `loop: false` and declare `next` state (`fly` $\to$ `airborne`, `land` $\to$ `idle`). |
| **8. Quaternion Sign & Mirroring** | Quaternion `(w, x, -y, -z)` | Probe live axes before authoring. Reflect left wing quaternions directly to right wing without Euler conversions. |

## Working-tree note

This session intentionally did **not** commit. The animation export and the authoring/validation helper scripts are currently uncommitted. `tsconfig.tsbuildinfo` is also modified by the typecheck run; treat it as generated state and do not accidentally include it in an animation commit.

