# Highlands gameplay — staged work orders

**Status: PLANNED — start only after Stage 6 of `docs/WYVERN_ANIMATION_PLAN.md` is DONE.**

The Highlands currently proves the hunt animation sequence in a consequence-free scene. This plan
turns that testbed into a repeatable hunting expedition while preserving guided animation testing
as a development tool. Inspiration from Mint Playground is limited to patterns: readable routes and
speed feedback from Breakline, compact encounter pacing from Mossbound, and request/reward clarity
from Boulder Cove. No external asset or source project is a runtime dependency.

## HANDOFF PROTOCOL

1. Read `CLAUDE.md`, this document, and the completed Stage 6 work order in
   `docs/WYVERN_ANIMATION_PLAN.md`.
2. Take the first ledger row not marked DONE and do only that stage.
3. Keep the current guided hunt usable until its replacement debug surface is verified.
4. Run the stage checks and `pnpm typecheck && pnpm lint && pnpm test`. Run
   `pnpm sim:battle` whenever food, hunger, bond, injury, cooldown, or balance changes.
5. Update the ledger row and the stage's `Status:` line in the same commit.

## PRODUCT CONTRACT

The production loop is:

> choose an eligible adult → enter the Highlands → read tracks/wind → approach without spooking
> prey → strike and carry → return with an authoritative harvest → review the expedition

- Playable expeditions have consequences; guided and explore/debug modes never do.
- The physical hunt is scene-side, but the existing `HUNT_WILDLIFE` intent remains the only reward
  authority. It already validates age, assignment and cooldown.
- A successful expedition takes about 2–5 minutes. Failure is recoverable and costs time, not a
  permanently lost wyvern.
- Prey detection, tracks and wind must be readable without a minimap-only solution.
- Existing hunt clips and flight controls are reused before new animation is considered.
- Highlands remains inside the persistent game canvas.

### Non-goals

- No open-world survival game, loot rarity system, crafting inventory, or wave shooter.
- No combat fork: attacks reuse existing flight/action/VFX seams.
- No saved per-frame prey or wyvern transforms.
- No `Date.now()`, `Math.random()`, UUID, or global-RNG draw from a render loop.
- No literal reuse of Mint Playground assets.

## ARCHITECTURE CONTRACT

- `src/core/**` owns eligibility, cooldown, authoritative reward and typed completion event.
- `src/state/highlandsHuntStore.ts` owns the active presentation session only.
- Scene-side fixed-step helpers own tracking, awareness, target selection and route progress.
- The render layer may confirm a physical hit and dispatch `HUNT_WILDLIFE`; the execution must
  revalidate it. Guard reward dispatch with a session token so one carcass cannot reward twice.
- Use `deriveSeed(gameSeed, region/session key)` or index-derived placement for presentation. Do not
  advance `state.rngState` from the scene.
- Split `HighlandsScene.tsx` while touching it; it is already well above the 400-line target.

## PROGRESS LEDGER

| Stage | Title | Status | Depends on |
|---|---|---|---|
| 0 | Production expedition boundary | NOT STARTED | Animation Stage 6 |
| 1 | Highland terrain, routes, and landmarks | NOT STARTED | 0 |
| 2 | Tracking, wind, and prey awareness | NOT STARTED | 1 |
| 3 | Hunt objectives and prey variety | NOT STARTED | 2 |
| 4 | Authoritative outcomes and expedition report | NOT STARTED | 3 |
| 5 | Audio, VFX, accessibility, and performance | NOT STARTED | 4 |

# STAGE 0 — Production expedition boundary

**Status:** NOT STARTED · **Depends on:** animation-plan Stage 6

**Goal.** Separate production hunting from the animation harness, wire one playable deer hunt to
the existing authoritative intent, and decompose the monolithic scene without changing hunt feel.

**Do.**

1. Add an explicit production `expedition` session mode. Keep `guided` and unrestricted `explore`
   behind a development/debug entry point or clearly non-rewarding launcher section.
2. Gate launch to an idle adult whose hunt cooldown is ready. Show the precise disabled reason.
3. On one confirmed playable deer completion, dispatch `HUNT_WILDLIFE` exactly once. Record a local
   outcome snapshot from the resulting core revision/event; never award food from the store.
4. Drain the Stage 6 event by sequence for the completion flourish and prevent remount replay.
5. Split terrain/dressing, wildlife, director, camera, and hunt helpers into focused modules with
   co-located tests. Preserve all current guided phases and action tokens.

**Tests.** Eligibility, cooldown, double-completion guard, guided/no-reward behavior, remount,
abandon, invalid subject, intent replay, and unchanged RNG/id sequences.

**Verify.** Standard gates, `pnpm sim:battle`, and live guided/playable/abandon/re-enter checks.

**Done when.** One production deer hunt grants the existing configured food exactly once, while the
old animation sequence remains independently testable.

# STAGE 1 — Highland terrain, routes, and landmarks

**Status:** NOT STARTED · **Depends on:** Stage 0

**Goal.** Replace the flat circular test arena with a navigable highland hunting ground whose
silhouette and routes communicate where the player can search, fly, land and return.

**Do.**

1. Build a pure highland height sampler shared by ground, props, prey spawns, landing validation and
   camera clearance. Keep one world unit equal to one metre.
2. Author three readable zones: arrival camp, exposed ridge, sheltered meadow. Connect them with
   two routes offering a fast exposed line and a slower concealed line.
3. Reuse approved biome-atlas highland/moor props. Every placement is region/session-stable and
   terrain-seated; no placement enters the save.
4. Add landmark anchors, route markers, valid landing clearings and collision primitives. Props that
   look solid must either collide or sit outside the playable corridor.
5. Give the arrival camp an explicit return action and safe spawn/respawn volume.

**Tests.** Height determinism, route continuity, spawn clearance, landing slope, landmark spacing,
collision consistency and bounded camera ground clearance.

**Verify.** Standard gates and `pnpm assets:validate-biome-atlas`; inspect on foot and in flight.

**Done when.** The map can be navigated without invisible walls or HUD arrows, and every hunt phase
has a deliberate terrain location.

# STAGE 2 — Tracking, wind, and prey awareness

**Status:** NOT STARTED · **Depends on:** Stage 1

**Goal.** Finding and approaching prey becomes the game, instead of the scene selecting the nearest
doe and immediately launching the animation chain.

**Do.**

1. Add pure, fixed-step prey awareness with sight, hearing and scent/wind contributions. Inputs are
   explicit; no wall-clock or random calls inside the update.
2. Create deterministic evidence along the prey route: tracks, disturbed grass, scat/scratch or a
   distant call. Evidence reveals direction, not an exact always-on target marker.
3. Add a wind indicator and world cues. Upwind approach raises scent detection; cover and slower
   movement reduce visual/hearing detection.
4. Give prey calm, alert, flee and cooldown states with readable animation/pose fallbacks. Fleeing
   prey relocates within bounded routes rather than despawning instantly.
5. The strike prompt appears only for a physically valid target and attack envelope.

**Tests.** Detection monotonicity, wind sign, cover modifier, fixed-step equivalence, bounded flee,
lost-target recovery, and identical results for the same inputs.

**Done when.** A player can deliberately choose a route and approach technique, understand why prey
spooked, recover, and complete the existing strike/carry sequence.

# STAGE 3 — Hunt objectives and prey variety

**Status:** NOT STARTED · **Depends on:** Stage 2

**Goal.** Add replayable variation without a generic quest generator.

**Do.**

1. Define authored hunt contracts from existing prey vocabulary: deer first, bird second; add boar
   or goat only when a validated model/animation path and core reward exist.
2. Vary starting zone, evidence route, wind and optional constraints such as clean approach, aerial
   scout, or return-before-dusk. Constraints affect report goals, not base harvest eligibility.
3. Select contracts deterministically from game seed, region and sanctuary day without render-loop
   RNG. Show prey, expected food and cooldown before launch.
4. Add failure/retry rules and an always-available return. Never strand the world clock or selected
   wyvern assignment.
5. Keep guided animation playback as a separate contract-free diagnostic.

**Tests.** Contract selection, prey support matrix, constraint evaluation, retry, return, scene
switching and unsupported-prey rejection.

**Done when.** At least three authored variants across deer/bird routes are meaningfully different
while sharing the same tracking and reward systems.

# STAGE 4 — Authoritative outcomes and expedition report

**Status:** NOT STARTED · **Depends on:** Stage 3

**Goal.** Close the loop with factual results, event history and balanced rewards.

**Do.**

1. Extend typed events only as needed to identify hunter, prey and authoritative food gained. Do
   not infer outcomes by parsing log prose.
2. Present elapsed time, route, alerts, successful strike, food gained and cooldown remaining. Do
   not fabricate grades; optional contract goals are pass/not achieved.
3. Add small bond gain only if balance testing supports it and all values live in config.
4. Record a bounded per-wyvern hunt summary only if it drives UI/history; do not save route traces.
5. Integrate with sanctuary duties only through ordinary state: a successful hunt may satisfy a
   relevant feed/forage duty if that plan has landed, without a direct store-to-store call.

**Tests.** Event payload, report accuracy, reward/cooldown, old-save migration if state is added,
offline behavior, replay equality and no double reward.

**Verify.** Standard gates, replay harness and `pnpm sim:battle`.

**Done when.** The report exactly matches authoritative state and returning to the sanctuary shows
the harvested food and cooldown with no hidden side effects.

# STAGE 5 — Audio, VFX, accessibility, and performance

**Status:** NOT STARTED · **Depends on:** Stage 4

**Goal.** Make tracking and impact legible at gameplay camera distance across devices.

**Do.**

1. Add owned/licensed wind, distant prey, wing, footfall, alert and completion audio through the
   shared audio settings if available. Credit every file.
2. Add track highlights, disturbed foliage, breath/strike ground response and restrained camera
   trauma. Reduced motion disables trauma and shortens transitions.
3. Add color-independent awareness and wind UI, remappable action hints and touch controls.
4. Add mixer/distance LOD for prey, shadow budgets and a constrained-render profile.
5. Expose a dev diagnostic for awareness inputs, target envelope, route and reward token.

**Tests.** Audio disposal, event deduplication, reduced motion, touch action parity, LOD thresholds,
hidden-scene inactivity and diagnostic determinism.

**Done when.** Tracking remains understandable without color or audio, completion feels physical,
and the scene stays within the existing frame budget on the constrained profile.

## FINAL ACCEPTANCE

- Production hunts grant rewards only through `HUNT_WILDLIFE` and exactly once.
- Guided/debug hunts never change serialized state.
- Terrain, tracks, wind, awareness and prey routes are deterministic.
- Deer and bird have supported, readable contracts; unsupported prey cannot launch.
- Return/abandon always restores control and leaves assignments valid.
- Scene modules meet the repository's decomposition rules.
- Standard gates, replay verification, biome-atlas validation and battle simulation pass.

