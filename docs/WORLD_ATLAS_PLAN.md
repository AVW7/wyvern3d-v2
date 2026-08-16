# World Atlas — staged work orders

**Status: PLANNED — start only after Stage 6 of `docs/WYVERN_ANIMATION_PLAN.md` is DONE.**

The current World Map is a strong tactical graph: regions, reachability, yields, garrisons, biome
color, camera focus and assault entry all work. The World Atlas adds the missing information and
discovery layer without replacing that map. Its reference pattern is SF Tennis Atlas: searchable
directory + map selection + camera focus + source-aware detail, adapted to fictional regions and
deterministic game state.

## HANDOFF PROTOCOL

Read `CLAUDE.md`, `docs/BIOME_SYSTEM.md`, this document and the completed event-stream work. Take
only the first ledger row not DONE, run its checks plus the standard gates, and update the ledger
and stage status in the same commit. Run `pnpm sim:battle` for changes to reachability, yields,
garrisons, unrest or combat entry.

## PRODUCT CONTRACT

The atlas answers four questions without opening several panels:

1. Where is a region and how do I reach it?
2. What is known about its biome, species, resources and threats?
3. What has the player discovered or accomplished there?
4. What strategic layer should I compare right now?

- The existing 3D map remains the spatial surface; the atlas is its directory, layers and dossier.
- Static lore/content lives in region definitions or dedicated core data. Mutable discovery lives in
  serialized core state only when it affects player-visible progress.
- Unknown information is hidden by explicit knowledge rules, not by removing graph navigation.
- Search, filtering, camera focus and panel state are presentation-only.
- The atlas never calculates battle authority from visuals.

### Non-goals

- No real-world GIS, live data, second map route/canvas, or replacement conquest graph.
- No procedurally generated lore.
- No URL requirement for in-game state; shareable debug deep links may remain route-only tools.
- No duplicated biome palette, region status or reachability logic.

## PROGRESS LEDGER

| Stage | Title | Status | Depends on |
|---|---|---|---|
| 0 | Atlas content and knowledge contract | DONE | Animation Stage 6 |
| 1 | Searchable directory and camera focus | DONE | 0 |
| 2 | Region visits, discoveries, and landmarks | DONE | 1 |
| 3 | Strategic map layers and legend | DONE | 1 |
| 4 | Region dossier and campaign journal | DONE | 2, 3 |
| 5 | Accessibility, navigation, and performance | NOT STARTED | 4 |

# STAGE 0 — Atlas content and knowledge contract

**Status:** DONE — 2026-08-14 · **Depends on:** animation-plan Stage 6

**Goal.** Define what atlas information exists, what is initially known, and what can be discovered,
without changing map visuals yet.

**Likely files.** `src/core/data/regions.ts`, new focused atlas data module, `src/core/types.ts`,
save migration only if mutable knowledge is introduced, and co-located tests.

**Do.**

1. Extend authored region content with concise summary, climate/terrain tags, landmark definitions
   and threat notes. Keep yields, neighbors, tier and combat data authoritative where they are.
2. Define `RegionKnowledge`: mapped, visited and per-landmark discovery ids. Starting region is
   visited; graph-visible regions may be mapped without revealing every discovery.
3. Add pure selectors for known fields, atlas completion and filter facets. UI must not reproduce
   these rules.
4. Add intents/events for first visit and landmark discovery, idempotent and subject to region/id
   validation. Do not use `nextId` or global RNG.
5. Migrate old saves so existing owned regions count as visited; do not fabricate landmark finds.

**Tests.** Every region has valid atlas content; tags/landmarks use known vocabularies; migration;
idempotent visit/discovery; unknown-field selectors; completion count; unchanged RNG and graph.

**Done when.** Core can answer what the player knows about all regions without a UI or prose parse.

# STAGE 1 — Searchable directory and camera focus

**Status:** DONE — 2026-08-14 · **Depends on:** Stage 0

**Goal.** Add a responsive atlas directory synchronized with the existing 3D map and inspector.

**Do.**

1. Add an Atlas drawer/panel listing regions with search and filters for status, biome, tier,
   resource, native species and visited state.
2. Selecting a row uses the existing region selection and map camera rig; map selection updates the
   same row. There is one selection authority.
3. Add keyboard navigation, result count, clear filters and an empty state. Preserve map orbit/pan
   and Escape behavior.
4. Show only knowledge-approved fields. Locked details state how they are discovered.
5. Extract filtering/sorting into pure tested helpers; do not filter by rendered node state.

**Tests.** Search normalization, compound filters, stable sort, selection synchronization, deleted
or invalid selection, keyboard focus and known/unknown field rendering.

**Done when.** Any region can be found and focused in seconds from keyboard, mouse or touch, with
the directory and 3D node always agreeing.

# STAGE 2 — Region visits, discoveries, and landmarks

**Status:** DONE — 2026-08-14 · **Depends on:** Stage 1

**Goal.** Exploration in `BiomeWorld` produces durable atlas progress.

**Do.**

1. Dispatch first-visit intent only after the selected biome scene becomes controllable, not when a
   map row is inspected.
2. Define 1–3 authored landmark ids per region. Biome Enhancement Stage 1 will place them; until
   then use deterministic existing landmark anchors where available.
3. Discover a landmark through a context action/proximity confirmation, not passive scene mount.
4. Emit typed first-visit/discovery events and present them once using the shared event cursor.
5. Add atlas completion by region and world, with no resource reward in this stage.

**Tests.** Inspect is not visit; scene-ready visit; landmark proximity adapter; repeated discovery;
wrong region/id; save/load; offline event suppression; replay equality.

**Done when.** Visiting and deliberately discovering a landmark updates exactly one atlas record and
the region directory reflects it immediately.

# STAGE 3 — Strategic map layers and legend

**Status:** DONE · **Depends on:** Stage 1

**Goal.** Let players compare the world by one concern at a time without changing game rules.

**Do.**

1. Add mutually exclusive layers: political/reachability, biome, resource yield, unrest, garrison
   strength, native species and exploration completion.
2. Derive all values from existing core selectors/data. Normalize visual scales with documented
   min/max and color-independent shape/pattern cues.
3. Reuse `nodeVisuals.ts` status vocabulary and the existing map height anchors. Layer colors must
   not alter hit targets, beacons, supply-line endpoints or selection.
4. Add a compact legend with exact values on selection and honest unknown states.
5. Persist the chosen layer as a local UI preference only.

**Tests.** Layer value derivation, normalization endpoints, unknown data, status consistency,
selection invariance and preference migration.

**Verify.** Standard gates and `pnpm sim:battle` only if a shared selector touching rules changed.

**Done when.** Every region is comparable across all seven layers and switching layers changes no
authoritative result.

# STAGE 4 — Region dossier and campaign journal

**Status:** DONE · **Depends on:** Stages 2 and 3

**Goal.** Turn the compact inspector into a coherent region record without making one giant panel.

**Do.**

1. Keep the current compact inspector for hover/quick action. Add a full dossier with Overview,
   Ecology, Strategy and History tabs as separate focused components.
2. Overview shows authored summary, status, route and completion. Ecology shows biome, native
   species and discoveries. Strategy reuses yields/garrison/unrest/assault controls. History shows
   typed events relevant to that region.
3. Add a route explanation using the existing graph path helper: required owned neighbor, shortest
   known path and blockers. Never create a second reachability algorithm.
4. Typed event history is bounded and factual; do not reconstruct it from the 60-entry prose log.
5. Preserve all current garrison, egg collection and assault actions through existing intents.

**Tests.** Tab field ownership, event filtering, route explanation, unknown ecology, action parity,
and no duplicate intent dispatch.

**Done when.** The dossier explains the region's place, ecology, campaign state and history while
the quick inspector remains compact.

# STAGE 5 — Accessibility, navigation, and performance

**Status:** NOT STARTED · **Depends on:** Stage 4

**Goal.** Make the atlas usable with large region counts, constrained devices and reduced motion.

**Do.**

1. Add focus return, screen-reader summaries, non-color legends, touch-sized controls and reduced-
   motion camera focus.
2. Virtualize only if profiling shows the directory needs it; 15 regions do not justify complexity.
3. Memoize derived layer/filter results by stable inputs and change-guard hover/selection stores.
4. Add a dev atlas diagnostic showing selected id, active layer, known fields and camera target.
5. Test narrow viewport overlap with the global HUD and region inspector.

**Tests.** Keyboard traversal, focus restoration, reduced motion, ARIA status, touch selection,
selector stability and no per-frame DOM/store churn.

**Done when.** The complete atlas is operable without pointer or color perception and adds no extra
WebGL canvas or measurable idle-frame churn.

## FINAL ACCEPTANCE

- One source of truth exists for selection, status, reachability, biome palette and region data.
- Search/filter, map nodes, inspector and dossier stay synchronized.
- Visits and landmark discoveries are persistent, idempotent and replay-safe.
- Seven strategic layers are explanatory only and never alter authority.
- Unknown information follows tested knowledge rules.
- Standard gates and relevant replay/battle checks pass.

