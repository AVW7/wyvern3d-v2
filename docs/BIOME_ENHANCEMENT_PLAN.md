# Biome enhancements — staged work orders

**Status: PLANNED — start after World Atlas Stage 0; Stage 1 requires World Atlas Stage 2.**

The shipped biome system already provides 15 biome definitions, deterministic terrain, an approved
26-prop atlas, biome palettes, instanced dressing, on-foot exploration and wyvern flight. Its main
limits are repeated layouts for regions sharing a biome, one landmark with focused collision, and
little to discover or do. This plan adds regional identity, landmarks, traversal, environmental
dynamics and lightweight ecology while preserving the cosmetic/gameplay authority boundary.

## HANDOFF PROTOCOL

Read `CLAUDE.md`, `docs/BIOME_SYSTEM.md`, `docs/BIOME_LIBRARY.md`, this plan and the relevant World
Atlas stage. Take the first eligible ledger row not DONE and do only it. For atlas/dressing changes
run:

```bash
pnpm assets:validate-biome-atlas && pnpm typecheck && pnpm lint && pnpm test
```

Run `pnpm sim:battle` only when a stage changes resources, combat or economy. Update the ledger and
stage status with the code.

## PRODUCT CONTRACT

Each explored region should answer:

- Where am I? — unique regional silhouette, arrival point and landmark.
- What can I notice? — discoverable ecology/history tied to the World Atlas.
- How do I traverse it? — readable ground routes, landing spaces and aerial lines.
- Why revisit? — changing ambience and bounded activities, not randomized chores.

- Region identity is deterministic from region id and seed; revisiting never reshuffles the world.
- Biome props remain cosmetic. Collision, rewards and discoveries use authored data/pure rules.
- The same biome may share an art vocabulary but must not share an identical placement layout.
- Missing optional assets degrade gracefully without killing the persistent canvas.
- One world unit remains one metre.

### Non-goals

- No infinite procedural world, voxel terrain, survival crafting, universal physics mesh, or second
  biome renderer.
- No per-instance scatter saved in `GameState`.
- No automatic resource rewards for merely walking near scenery.
- No unlicensed atlas additions or performance budget bypass.
- No duplicate World Atlas knowledge model or Highlands hunting system.

## PROGRESS LEDGER

| Stage | Title | Status | Depends on |
|---|---|---|---|
| 0 | Region-specific deterministic identity | DONE | World Atlas 0 |
| 1 | Authored landmarks and discovery | DONE | World Atlas 2, Biome 0 |
| 2 | Traversal, collision, and landing | DONE | 0 |
| 3 | Weather and environmental dynamics | DONE | 2 |
| 4 | Ambient ecology and region activities | DONE — 2026-08-14 | 1, 2 |
| 5 | Audio and scene transitions | DONE | 3 |
| 6 | Streaming, LOD, and numeric quality gates | DONE — 2026-08-15 | 1–5 |

# STAGE 0 — Region-specific deterministic identity

**Status:** DONE — 2026-08-14 · **Depends on:** World Atlas Stage 0

**Goal.** Two regions with the same biome use the same art direction but no longer produce the same
terrain/scatter composition.

**Do.**

1. Thread `regionId` through terrain and scatter inputs. Derive stable variation from game seed,
   region id, layer id and instance index without consuming `state.rngState`.
2. Preserve biome-level palettes and layer recipes, then add bounded region modifiers: rotation,
   density, radius band, terrain frequency/phase and one authored composition tag.
3. Keep guaranteed arrival and central-clearance contracts. Variation must not move required
   landmarks or close navigable corridors.
4. Stamp/debug the effective recipe in `/biomes` or a region preview mode so reviewers can compare
   regions sharing a biome.
5. Existing saves need no scatter migration because placements remain derived.

**Tests.** Same seed/id equality; different-region inequality; bounded density/scale; arrival
clearance; stable terrain sampling; all 15 biomes and every region produce finite values.

**Done when.** Same-biome regions are visibly related but compositionally distinct and perfectly
stable across remount, save/load and replay.

# STAGE 1 — Authored landmarks and discovery

**Status:** DONE — 2026-08-14 · **Depends on:** World Atlas Stage 2 and Biome Stage 0

**Goal.** Every region contains deliberate places worth finding, connected to the atlas knowledge
contract.

**Do.**

1. Place 1–3 landmark anchors per region from authored atlas data. A landmark is an id, transform,
   approach radius, label and optional approved prop—not a guessed mesh name.
2. Reuse available atlas landmarks first. Add new models only through `BIOME_LIBRARY.md`, with
   licence evidence, target scale, triangle/material budget and atlas validation.
3. Give each landmark a readable approach composition and context action. Discovery dispatches the
   World Atlas intent exactly once; the mesh itself has no authority.
4. Use `WorldLabel`/canvas sprites for optional labels and the shared typed event stream for the
   flourish. Support hidden labels for discovery-first presentation.
5. Extend `/biomes` to inspect landmarks by region, including clearance and missing-asset state.

**Tests.** Unique ids, valid region/prop references, terrain seating, approach clearance, discovery
idempotence, missing prop fallback and no passive mount discovery.

**Verify.** Atlas gates, standard gates and live approach from ground and air.

**Done when.** Every region has at least one intentional, discoverable landmark and the atlas is the
single persistent record of finding it.

# STAGE 2 — Traversal, collision, and landing

**Status:** DONE — 2026-08-14 · **Depends on:** Stage 0

**Goal.** Terrain and scenery communicate where players and wyverns can safely move.

**Do.**

1. Generate authored traversal zones per biome/region: arrival clearing, primary ground loop,
   landmark approaches, hazardous/no-go areas and aerial corridor.
2. Expand collision beyond Elderroot Grove using low-cost authored primitives for major rocks,
   trunks, structures and landforms. Do not generate triangle-mesh collision from rendered GLBs.
3. Use the same pure footprint/height data for collision, scatter exclusion and landing validity.
4. Add slope/clearance-aware landing candidates and visible invalid feedback. Never infer gameplay
   radius from loaded model bounds.
5. Add recovery for stuck/fallen player or out-of-bounds wyvern to the last safe authored anchor.

**Tests.** Route continuity, primitive overlap, exclusion zones, slope thresholds, landing clearance,
out-of-bounds recovery and collision parity at varied region seeds.

**Done when.** Solid-looking major scenery behaves solidly, required routes remain open, and flight
can reliably transition to ground near every landmark.

# STAGE 3 — Weather and environmental dynamics

**Status:** DONE — 2026-08-14 · **Depends on:** Stage 2

**Goal.** Biomes feel alive across visits without changing combat/economy authority.

**Do.**

1. Define presentation-only weather profiles by biome: clear, fog, rain, snow/ash, wind and storm
   variants where appropriate. Selection is deterministic from seed, region and sanctuary day.
2. Blend sky, fog, light, particles, wind amplitude and surface response through one weather state.
3. Keep visibility fair: required landmarks/routes retain minimum contrast, and reduced effects can
   disable dense particles/flashes.
4. Weather does not change yields, movement speed or combat in this stage.
5. Add a debug selector and numeric state readout; automatic state resumes after leaving debug.

**Tests.** Profile coverage, deterministic selection, blend endpoints, visibility floors, reduced
effects, particle caps and no core mutation.

**Done when.** Every biome supports at least two coherent environmental states with smooth,
deterministic transitions and no gameplay divergence.

# STAGE 4 — Ambient ecology and region activities

**Status:** DONE — 2026-08-14 · **Depends on:** Stages 1 and 2

**Goal.** Add bounded reasons to observe and revisit regions without duplicating Highlands hunts.

**Do.**

1. Add deterministic ambient wildlife/phenomena by biome—birds, deer silhouettes, insects, fish,
   crystal pulses, ash vents or fireflies—using instancing/simple agents and distance LOD.
2. Add one authored observation activity per biome family: follow a migration trail, inspect rune
   sequence, reach a vista, identify a species sign, or time an environmental phenomenon.
3. Activities report discoveries/observations to the World Atlas. They do not grant food; active
   prey hunting remains Highlands-owned.
4. Keep ambient paths presentation-only and bounded away from arrival/landing collisions.
5. If a material reward is later added, introduce a specific core intent and balance test; never
   mutate resources from the scene.

**Tests.** Spawn/path determinism, LOD activation, activity sequence, atlas id validation, repeated
observation, no resource mutation and missing-model fallback.

**Done when.** Each biome family has something characteristic to observe or complete and revisits
show stable ecology rather than identical static scatter.

# STAGE 5 — Audio and scene transitions

**Status:** DONE — 2026-08-14 · **Depends on:** Stage 3

**Goal.** Give regions a coherent arrival/departure and sound identity without tearing down the
persistent canvas.

**Do.**

1. Add a brief cancellable world-map → biome transition using existing palette/region imagery or
   procedural particles. Never mount a second WebGL canvas or unload the global clock.
2. Add owned/licensed biome ambience layers and spatial landmark/phenomenon cues through shared
   audio preferences. Record sources in `CREDITS.md`.
3. Crossfade ambience on scene/weather changes and fully dispose sources on unmount.
4. Reduced motion shortens/fades the transition; skip is always available.
5. Loading failure returns to the map with a readable error and intact selected region.

**Tests.** Transition cancellation, reduced motion, failure recovery, selection retention, audio
crossfade/disposal, missing audio and no duplicate listeners.

**Done when.** Entering a region feels intentional, remains fast/skippable, and leaks neither canvas,
audio nor state across repeated map/biome switches.

# STAGE 6 — Streaming, LOD, and numeric quality gates

**Status:** DONE — 2026-08-15 · **Depends on:** Stages 1–5

**Goal.** Lock the enhanced system to measurable correctness and frame budgets.

**Do.**

1. Add distance/frustum LOD for landmark detail, wildlife agents, particles, shadows and audio.
2. Preload only the selected biome's required optional assets; retain shared atlas caching. Missing
   optional assets degrade locally.
3. Extend validation with region recipe/landmark contracts: finite transforms, terrain contact,
   clearance, unique ids, triangle/material budgets and maximum draw-call estimates.
4. Add `/biomes` region comparison and a constrained-render diagnostic with active counts.
5. Document budgets and workflow changes in `BIOME_SYSTEM.md` and `BIOME_LIBRARY.md`.

**Tests.** LOD thresholds/hysteresis, preload set, error boundaries, budget failures, resource
disposal and all-region deterministic snapshots.

**Verify.** Biome atlas gate, standard gates, repeated scene switches and constrained-profile live
checks for representative forest, cavern, coast, mountain and volcanic regions.

**Done when.** All regions meet numeric placement/clearance/budget contracts and enhanced scenes
remain stable under repeated travel on the constrained profile.

## FINAL ACCEPTANCE

- Same-biome regions are distinct and deterministic.
- Every region has a discoverable landmark recorded only by the World Atlas.
- Ground routes, collisions and landing areas agree on authored spatial rules.
- Weather is presentation-only, accessible and deterministic.
- Ambient activities never mutate rewards directly or duplicate Highlands hunting.
- Transitions preserve the persistent canvas and recover from failure.
- Numeric atlas, placement and performance gates pass for every region.

