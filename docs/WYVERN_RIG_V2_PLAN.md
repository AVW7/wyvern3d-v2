# Wyvern rig v2 — staged work orders

**Status: OPEN.** Live handoff artifact, same protocol as
`docs/WYVERN_ANIMATION_PLAN.md` (which is the v1 / vendor-rig record and is
effectively closed). Each stage is self-contained and executable by an agent with
no memory of the session that produced it. Stages repeat context deliberately —
do not collapse the repetition.

This document exists because the rig was **replaced**, not edited. The vendor
`drogon.glb` (292 joints, 52 clips) was swapped for an authored `wyvern.glb`
(56 joints, 16 clips), and most of what the v1 plan recorded as DONE is DONE
against a skeleton that is no longer loaded. `docs/WYVERN_ANIMATION_PLAN.md`
remains the record of *why* the design is the shape it is; this one stages what
the swap left undone.

---

## HANDOFF PROTOCOL

1. Read **§Onboarding** and **§Reference data**. Both are short and contain
   measured numbers you cannot re-derive cheaply.
2. Read `CLAUDE.md`, `docs/FLIGHT_ANIMATION_DEVELOPMENT.md`, and the docstring at
   the top of `scripts/author-wyvern-clips-blender.py` — the last one carries the
   rig's measured axis conventions, several of which are the opposite of the
   obvious guess.
3. Find the first stage in **§Progress ledger** not marked DONE. Do only that
   stage.
4. When finished: run the stage's *Verify*, then **edit this file** — set the
   ledger row and the stage's `Status:` line to DONE with a one-line note of
   anything that surprised you. Commit that edit alongside the code.
5. If a stage is wrong, obsolete or blocked, say so in the ledger row rather than
   silently skipping it.

---

## ONBOARDING (cold start)

**The rig.** `public/models/wyvern.glb`, 56 joints, 16 clips, 1.51 MB
(meshopt + WebP). Source of truth is `public/models/wyvern-rig.blend`, which is
gitignored and lives only in the main checkout.

**Rebuild everything:**

```bash
pnpm assets:wyvern-clips --measure --compress
```

That re-authors all 16 clips from `scripts/author-wyvern-clips-blender.py`, saves
the `.blend`, exports the GLB, writes the signatures the test gate asserts,
compresses, and verifies the compression did not change the animation.

**The gate.** `pnpm test` asserts
`validation/wyvern-animations/wyvern-clip-signatures.json` against
`wyvern-clip-contracts.json`. It was `describe.skip` for the whole rig rebuild
while the manifest was already serving the real GLB — which is how seven of
sixteen clips shipped a dislocated wing. **Do not skip it.** If a clip is not
ready, drop it from `clips` in the contract with a reason.

**The trap that produced most of the defects.** Blender's
`export_animation_mode="ACTIONS"` samples every bone on every frame, so a bone a
clip does not key bakes whatever pose the `.blend` happened to be sitting in. The
correlation was exact: the eight clips keying all 46 bones were clean, the seven
keying 7–17 were not. `build()` now keys every bone on every clip and
`reset_pose()` runs first. Do not "optimise" either away.

---

## REFERENCE DATA

Measured, not assumed. Re-deriving these costs a Blender session each.

### This creature is a quadruped

Measured off v1's `drogon.glb` with `node scripts/probe-v1-walk.mjs <clip> <samples>`:

| clip | wing knuckle floor | foot floor | gap | reading |
|---|---|---|---|---|
| `Battle_Walk` | 0.64 | 0.15 | **+0.49** | knuckles planted |
| `Battle_Stand` | 1.86 | 1.99 | **−0.13** | knuckle *below* the foot |

The wings are forelimbs. They carry weight on the ground in **every** grounded
clip, standing included. The wrist rides high (`Hand` at 2.15 while the fingers
reach 0.64) — this is knuckle-walking, like a bat or a pterosaur, not a lizard
with its hands flat.

**Gait, at frame resolution over `Battle_Walk` (2.46 s, 59 frames):**

| limb | plants at | couplet |
|---|---|---|
| `L_foot` | 0% | with `R_knuckle` |
| `R_knuckle` | 93% (≈ −7%) | " |
| `R_foot` | 36% | with `L_knuckle` |
| `L_knuckle` | 36% | " |

Diagonal couplets: each hind foot moves with the opposite wing knuckle. The two
couplets are **0.36 apart, not 0.5** — an overlapping walk, not a trot.

### Axis conventions (v2 rig)

Probed on the live armature at +0.2 rad, reading world displacement of a
chain-tip marker. Every one contradicts a plausible guess:

```
Spine*/Neck*/Head    local +X pitches the head DOWN;  +Z yaws toward -X
Tail1..Tail10        local +X lifts the tail UP   (opposite sense to the spine)
Wing shoulder/elbow/wrist/finger/membrane
                     local +X raises BOTH wings   (symmetric)
                     local +Z sweeps them APART   (antisymmetric)
Legs thigh/calf/foot local +X swings the leg BACK (symmetric)
                     local +Y/+Z move both legs the same way in world space
Body.location        local +Z is world DOWN, +Y is world FORWARD
RootMotion.location  local +Y is world UP, +Z is world FORWARD
```

Mirroring rule: **rotation X is symmetric, Y/Z are antisymmetric.** Applied in
exactly one place, `limb_pair()`. Nothing else may write an `R_` channel.

### Scale

`WYVERN_FIT = 0.0072` m per rig unit; the model spans 46.9 m. A `yOffset` is in
rig units and plants a ground clip on its **lowest skinned vertex** —
`plant_offset_units` in the signature file, not the lowest bone tail, which
disagrees by metres.

---

## PROGRESS LEDGER

| Stage | Title | Status | Depends on | Notes on completion |
|---|---|---|---|---|
| 0 | Rebuild all 16 clips; re-enable the gate | DONE | — | Root cause was the export baking stale poses onto unkeyed bones, not the animation. All 16 re-authored with full distal-spar articulation; moving bones 1–9 → 21–43; symmetry error ≤0.30 on every clip that should be symmetric; cadence ordering fixed (was cruise 0.49 Hz / speed 3.33 Hz, i.e. reversed); both chain seams exactly 0.0; gate re-enabled and verified to fail on re-injected defects; GLB 18.6 MB → 1.51 MB. |
| 1 | Quadrupedal grounded stance and gait | DONE | 0 | Grounded clips now plant the wing knuckles. Two things only the measurement found: the plant angle is a **crossover**, not a target — at −34° the knuckle just kisses the floor and at −35° the membrane punches 0.47 m through it, so a step centred on the plant drove `walk` 12.7 m under (biasing the harmonic by +step fixes it); and `gait_mirror` must search **each contact pair separately**, because diagonal couplets 0.36 apart make the feet and knuckles mirror at *opposite* shifts (+0.36 / −0.36) and a combined search reports a spurious 0.107 on a correct gait. Authored walk measures foot shift 0.35 / knuckle 0.65 — v1's couplet reproduced. `attack` and `breath` deliberately rear onto the hind legs and lift the forelimbs, which is what a quadruped does to strike or breathe. |
| 2 | Restore the 17 unmapped sanctuary states | NOT STARTED | 1 | 35 `ModelState`s declared, 18 mapped. Every sanctuary ambient is missing. |
| 3 | Mandible repair | NOT STARTED | — | Mesh-level. Blocks a real `breath`/`attack`. |
| 4 | Phase-preserving flight transitions | NOT STARTED | 0 | Carried over from the v1 plan. |
| 5 | Bank as a modifier, not a peer | NOT STARTED | 4 | Needs a clip product or an additive layer. |
| 6 | Fire breath VFX | NOT STARTED | 3 | Nothing renders today. |
| 7 | Battle wyverns can land | NOT STARTED | 1 | `Actor.flying` is assigned once and never mutated. |
| 8 | Repo hygiene | NOT STARTED | — | Pre-existing; unrelated to the rig. |

---

## STAGE 1 — Quadrupedal grounded stance and gait

**Status:** DONE — 2026-08-04. See the ledger row for the two non-obvious findings. · **Depends on:** Stage 0

### Why

Stage 0 authored `walk` as a biped: hind legs cycling, wings held folded over the
back by `wings_folded()`. That is wrong for this creature. §Reference data shows
v1 plants the wing knuckles on the floor in `Battle_Walk` *and* in
`Battle_Stand` — the wings are forelimbs and bear weight whenever the animal is
grounded. A wyvern that walks on two legs with its wings tucked reads as a bird,
not a dragon, and it is the single most visible thing about the model at ground
level.

This is not only `walk`. It changes the base grounded pose, so it touches every
clip that starts or ends on the ground: `idle`, `walk`, `rest`, `attack`,
`breath`, the first third of `takeoff`, and the last third of `land`.

### Do

1. Replace `wings_folded()` with a **planted** carriage. The shape to hit, from
   the reference: shoulder and elbow carry the wing *out and down* to the ground
   rather than up over the back; the wrist stays high; the folded finger spars
   make the ground contact. Get the knuckle to the foot plane — the target is
   `lowest_vertex_up` for the knuckle within ~0.15 m of the toes, matching
   `Battle_Stand`'s −0.13.
2. Author the gait as **diagonal couplets at 0.36 offset**, not 0.5: `L_foot`
   with `R_knuckle`, `R_foot` with `L_knuckle`. Each contact needs a plant/lift
   cycle in the wing chain the same way the legs have one — shoulder swings the
   limb fore and aft, elbow/wrist absorb.
3. Keep the pelvis bob and roll tied to the **four**-beat contact pattern, not
   the two-beat one stage 0 used.
4. Rework `idle` and `rest` onto the planted stance. `idle`'s harmonic tables are
   tuned and should be preserved — override only the wing carriage, the way
   `clip_idle()` already overrides it today.
5. Re-measure `plant_offset_units` for every ground clip and update the
   `yOffset`s in `manifest.ts`. The gate asserts these agree.

### Watch out for

- **`land` must still end exactly on `idle`'s opening pose** and `takeoff` on
  `cruise`'s. `blend_into()` handles it, but both target poses are changing here,
  so re-check `chain_seams` — they are currently exactly 0.0 and must stay ≤0.02.
- **The fold is what plants the model.** Stage 0's `walk` plant offset dropped
  314 → 72 because the wings finally folded. Moving them to the floor moves it
  again; do not hand-edit `yOffset`, take it from the measurement.
- `attack` carries `yOffset: 0` and doubles as `attackAir`, so anything that dips
  below the origin there is depth *through the floor*.

### Verify

```bash
pnpm assets:wyvern-clips --measure --compress
pnpm test && pnpm typecheck
node scripts/probe-v1-walk.mjs Battle_Walk 59     # the reference to match
```

- Knuckle-to-toe gap within ~0.15 m on `idle`, `walk`, `rest`.
- `wing_symmetry_error.max` still ≤0.35 on every grounded clip.
- `chain_seams` still ≤0.02.
- Live check in `/debug/animation` at the Light theme — the near-black model
  hides pose on Dark, which is how a 27.3° cruise stroke once passed review.

---

## STAGE 2 — Restore the 17 unmapped sanctuary states

**Status:** NOT STARTED · **Depends on:** Stage 1

`manifest.ts` declares 35 `ModelState`s and `WYVERN_CLIPS` maps 18. Unmapped:

```
sleep  sit  seated  rise  eat  drink  groom  perch  hop
nuzzle  calm  pickUp  drop  huntGrip  huntCarry  huntFinish  breatheAir
```

The sanctuary ambient idle scheduler drives `sleep`/`sit`/`groom`/`eat`/`drink`/
`perch` directly (`scenes/Sanctuary/director/wyvernDirector.ts`), and the
Highlands hunt drives the `hunt*` sequence, so those wyverns currently ask for a
clip that does not exist. v1 covered all of this in the meshless
`drogon-sanctuary.glb` sidecar (26 short-name actions, built by
`scripts/author-drogon-sanctuary.py`); there is no v2 equivalent.

Decide first whether these belong in `wyvern.glb` or in a v2 sidecar. The v1
argument for a sidecar was that the vendor GLB was third-party and 15 MB; neither
holds now — `wyvern.glb` is ours and 1.51 MB — so folding them in is probably
right, but it is a real decision and should be recorded here.

Do Stage 1 first: most of these are grounded poses and will inherit the planted
wing carriage.

**Verify:** no `ModelState` resolves to a missing clip. Add a gate rule — the
existing "every wyvern clip the manifest can play was measured" test catches
mapped-but-missing, not unmapped, so extend it.

---

## STAGE 3 — Mandible repair

**Status:** NOT STARTED · **Depends on:** —

`Jaw` is not a mandible. It drives 448 verts in the upper-rear skull; the real
lower jaw was folded into `Head` during the rig build (the note in
`src/render/rigBones.ts` records the bone and the jaw being swapped, and the
snout weights being folded into `Head`). The bone also pivots at the **snout
tip** — head `(0, −879, 677)` pointing back and up — rather than at the hinge.

The head is a single welded island of 8278 verts with **no gap at the mouth
line**: the z-histogram of the snout is unimodal, so there is no geometric seam
to split on and no modelled mouth interior to reveal. A programmatic split tears
the face.

So this is mesh work, probably by hand in Blender: separate the mandible, build
an interior if the mouth is to open more than a crack, and repivot `Jaw` at the
hinge. Until it is done, `breath` and `attack` are carried by the neck, chest and
head, and no clip should pretend otherwise.

**Verify:** rotating `Jaw` opens a visible mouth without tearing; `breath`
measures a non-zero `Jaw` range in the signature.

---

## STAGE 4 — Phase-preserving flight transitions

**Status:** NOT STARTED · **Depends on:** Stage 0

Only `cruise`/`bankLeft`/`bankRight` share `phaseGroup: 'flight'` — all 2.00 s,
3 beats, 1.50 Hz. Every other pair is a plain crossfade that can cut mid-stroke:

| mode | cadence |
|---|---|
| `speed` | 2.00 Hz |
| `hover` | 1.60 Hz |
| `cruise` / banks | 1.50 Hz |
| `scout` | 0.50 Hz |
| `glide` / `dive` | held, no beat |

`GameModel` preserves *normalized* time across a crossfade inside a phase group,
so a shared group needs equal duration and equal beat count. Either author
transition clips, or restructure cadences so more modes can share a group.

---

## STAGE 5 — Bank as a modifier, not a peer

**Status:** NOT STARTED · **Depends on:** Stage 4

`FlightLoopState` maps straight to one clip, so the banks sit beside `dive` and
`speed` rather than combining with them. There is no authored inside-wing
deformation while diving or at speed; the runtime's whole-model roll banks them
instead. Real variants need a clip product (mode × bank) or an additive bank
layer. Note the constraint from `CLAUDE.md`: bank clips must **not** bake a
second whole-body roll, because the runtime already applies one.

---

## STAGE 6 — Fire breath VFX

**Status:** NOT STARTED · **Depends on:** Stage 3

`tryBreath` does a cone test and applies damage with no visuals. Check what
`src/render/vfx/` and `breathVfxMath.test.ts` already provide before starting —
some groundwork exists that the v1 plan predates. Carried over as Stage 6 of the
v1 plan, never started.

---

## STAGE 7 — Battle wyverns can land

**Status:** NOT STARTED · **Depends on:** Stage 1

`Actor.flying` is assigned once at spawn and never mutated, so battle wyverns
cannot land and the `walk`/`land` clips are unreachable there. Landing works in
the sanctuary, which has no `Actor` at all. Worth more after Stage 1, which gives
`walk` a real gait to show.

Remember the invariant: presentation frame-diffs the sim and never adds events to
it. A landing state change belongs in `core`, on the replay-stable path.

---

## STAGE 8 — Repo hygiene

**Status:** NOT STARTED · **Depends on:** —

All pre-existing and unrelated to the rig; confirmed by stashing.

1. Five eslint errors in `src/render/coordination/examples.ts` and
   `flightCoordination.ts` — unused vars, `no-case-declarations`. `pnpm lint`
   fails on them today.
2. `scripts/__pycache__/*.pyc` and `tsconfig.tsbuildinfo` are tracked and churn
   on every run. Gitignore them.
3. Commit `ce77fcc` committed a stray `--head/` directory of 8 PNGs, where a CLI
   flag became a folder name.

---

## CROSS-CUTTING NOTES

- **Review is numeric.** Contact sheets are not the gate. A near-black dragon
  hides pose in a render and two sheets cannot be compared.
- **One fold, used everywhere.** `idle` once folded differently from every other
  grounded clip, which left `land` ending 0.46 rad from the pose it chains into.
  Grounded clips share their carriage or the seams stop meeting.
- **Do not hand-edit `yOffset`.** It comes from `plant_offset_units` in the
  signature and the gate asserts they agree.
- **`src/core/**` stays pure.** None of this work should need to touch it except
  Stage 7, which does.
