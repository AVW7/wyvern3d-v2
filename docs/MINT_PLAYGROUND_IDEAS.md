# Mint Playground ideas — game-experience enhancement backlog

**Status: OPEN (ideas backlog — not a staged work order).**

This document has two parts: **Part A — Sanctuary** (Tier 1–3 ideas) and
**Part B — World Atlas / World Map**. Nothing here is committed work. When an
idea is picked up, it should either be folded into an existing staged plan
(`docs/SANCTUARY_GAMEPLAY_PLAN.md`, `docs/WORLD_ATLAS_PLAN.md`,
`docs/WYVERN_ANIMATION_PLAN.md`, `docs/BATTLE_TRIALS_PLAN.md`) or promoted into
its own work order with a progress ledger.

Ideas are sourced from `~/Documents/mint-playground-main` (39 open-source
Three.js experiences, MIT); each entry names the experience and file worth
reading first.

**Provenance rule (inherited from the sanctuary gameplay plan).** Code ideas may
be reimplemented; assets may not. No Mint-hosted GLBs, audio, images, or fonts
enter this repository without a separate licence review. Nothing in
`src/core/**` may gain `three`, `react`, `zustand`, `Math.random()`, or
`Date.now()` imports as a result of these ideas.

---

## How to read this document

Each idea lists: **Source** (the experience and file worth reading first),
**Idea**, **Fit** (where it lands in this codebase), and **Weight** —

- 🥇 high value now, fits existing seams
- 🥈 valuable, needs groundwork or another stage first
- 🥉 speculative / polish

---

# Part A — Sanctuary

## Tier 1 — Sanctuary, this stage

### 1.1 Annoyance-gated reaction system for resting wyverns 🥇

**Source.** `experiences/sleeping-snorlax/src/scene/reactions.ts` (+ `rigProfiles.ts`,
`growth.ts`).

**Idea.** 14 named reactions — twitch, headShake, armSwat, tummyRub, grumble,
squirm, bigStretch, rollAway, … — each `{ duration, minAnnoyance, apply(t, amp,
side, pose, motions) }`. Selection is gated by an **annoyance level** 0→1, with
`REACTION_MEMORY = 4` so long interactions keep producing new behaviour, and
mild reactions de-prioritised once annoyance passes 0.35.

The load-bearing architectural trick: reactions **never touch Euler
components**. They call a semantic `RigMotions` interface (`headYaw`,
`headNod`, `armLift`, `torsoTwist`, `bellyPush`, `legKick`, …) and each rig
profile maps semantics onto its own axes. Two models with disagreeing local
axes share one reaction library.

**Fit.** The Sanctuary already has the exact hookup points:

- `Agent.ambientDwell` / `ambientRoll` / `ambientAction` in
  `src/scenes/Sanctuary/director/wyvernDirector.ts:87-92` — the ambient idle
  scheduler already playing sleep/sit/groom/eat/drink/perch.
- Bond is already a per-wyvern stat, and traits already gate bond rate
  (`src/core/systems/sanctuary.ts:41`).

A port would add: a pure reaction catalog (bond- and trait-gated instead of
annoyance-only — a high-bond wyvern does the fond reaction, a Stubborn one
does grumble/rollAway), plus a `WyvernRigMotions` adapter beside the existing
gaze/tail/leg controllers in `src/render/`. Given the baseline document's
lesson that every rig axis contradicted confident guesses, the semantic-motion
layer is the right defence: reactions written against semantics survive
re-measured axes.

**Relation to existing plan.** This is the concrete mechanism behind
`SANCTUARY_GAMEPLAY_PLAN.md` Stage 2 ("completion produces an immediate,
entity-specific reaction") and Stage 3 companionship duties. Build it there.

### 1.2 Visible growth stages 🥇

**Source.** `sleeping-snorlax/src/scene/growth.ts` — procedural size/feature
growth driven by interaction history.

**Idea.** Growth is expressed as continuous blend parameters (scale, feature
prominence) rather than discrete model swaps, with smooth easing between
stages.

**Fit.** `growthTick` (`src/core/systems/sanctuary.ts:102`) currently changes
numbers but nothing on screen — `hatchling → juvenile → adult` is invisible in
the Sanctuary. A scene-side component reading `stage` + `ageTicks` and easing
scale/proportions on the cloned model (never in core) would make lineage
tangible. Pairs naturally with species scale already present in
`WyvernInstance`.

### 1.3 Day/night ambience cycle 🥇

**Source.** `experiences/boulder-cove/src/MapleCove.tsx` — `DAY_CYCLE = 240`
seconds, looping, purely cosmetic, no fail state.

**Idea.** A slow looping day cycle that drives existing atmosphere systems
rather than adding new ones: dusk dims `SkyDome`, `Firelight`/torches become
dominant, `SanctuaryDust` motes catch golden-hour colour, the deer herd
(`atmosphere/wildlifeLogic.ts`) is more active at dawn. Phase can be derived
deterministically from the tick (or a scene clock), keeping replays identical.

**Fit.** All the ingredients exist as separate components under
`src/scenes/Sanctuary/atmosphere/`; what's missing is a shared time-of-day
signal. This is also the natural carrier for Stage 5 (Sanctuary audio layer) —
dawn/dusk stingers.

### 1.4 Wyvern "requests" as ambient chatter 🥈

**Source.** Boulder Cove's `RequestChip { villager, type, count }` plus
chatter/thanks lines and toast/banner UI.

**Idea.** Creatures signal needs in-world with personality lines, before any
formal quest UI exists.

**Fit.** Deliberately overlapping with `SANCTUARY_GAMEPLAY_PLAN.md` (duties
read off real state: hunger, injury, bond, assignment). The Boulder Cove twist
worth keeping even after duties land: **flavour text per temperament** —
thanks/chatter variants keyed by trait, so a Ferocious wyvern and a Timid one
word the same need differently. Trait-keyed line tables are cheap and core-safe
(pure data, deterministic pick by a seeded draw or rotation).

---

## Tier 2 — Secondary picks

| # | Source | Takeaway | Landing spot | Weight |
|---|---|---|---|---|
| 2.1 | `quadrotor-sandbox/src/sim/wind.ts` | Deterministic wind: steady heading + gusts as a fixed sum of seeded sinusoids with incommensurate frequencies — smooth, allocation-free, **perfectly reproducible so a recorded flight replays through identical air** | Flight feel: Stage 4.9 scout flight; also a wind signal `SanctuaryWind` could consume | 🥇 |
| 2.2 | `quadrotor-sandbox/src/sim/` (`pid.ts`, `landing.ts`, `crash.ts`) | PID stabilisation, landing-pad detection, crash/impact state machines | Landing polish for wyvern touch-downs; perched take-off/landing blends | 🥈 |
| 2.3 | `quadrotor-sandbox/src/perception/` (`lidar.ts`, `occupancy.ts`) | Sensor-style perception and occupancy grids | Avoidance for autonomous sanctuary flight paths (director waypoints around props) | 🥉 |
| 2.4 | `four-fields` | Timed farming: plant → ripeness states → harvest windows | Sanctuary food economy feeding the Hunting Pen / feed duties (a herb or livestock plot as a feed source, Stage 1's "supply source") | 🥈 |
| 2.5 | `mossbound/src/systems/` (`VfxSystem`, `CombatTextSystem`, `Minimap`) | Wave escalation, floating combat text, minimap | Battle scene (see `BATTLE_TRIALS_PLAN.md`), not Sanctuary | 🥈 |
| 2.6 | `financial-city` | Aggregate economy ↔ visible world response: budget changes ripple across city blocks | `EconomyManagementPanel` / `ProductionBuildings3D`: make tax/policy changes visibly change the sanctuary (smoke, traffic, queue lengths at stations) | 🥉 |
| 2.7 | `dynasty-index/src/scene/CardRig.ts` | Physical card inspection rig: rounded-box slab, canvas textures, foil shader, flip/swap transitions with easing and `damp()` smoothing | Roster/pedigree UI: a 3D "wyvern card" for breeding preview — inspect lineage, stats, traits as a physical card in the ledger panel | 🥈 |
| 2.8 | `cdx-2089-music-player/src/tween.ts` + `skins/` | Tiny tween library and theme-skin manager | Sanctuary palette presets beyond the current saved palette (`sanctuaryColorsStore`) — swappable named themes | 🥉 |
| 2.9 | `boulder-cove` door triggers | Exit points pushed ~1.8 units out along the door radial so leaving never re-triggers entry (their fix for a "revolving door") | Station `radius` proximity panels: offset the exit/leave position along the approach radial | 🥇 small fix |
| 2.10 | `boulder-cove` fishing loop | AC-style: stand still near a fish → cast → lure; move and it flees | A patience-based feeding mini-interaction at a sanctuary pond (Stage 3+ polish; must not become a new currency) | 🥉 |
| 2.11 | `helios-form` | Orbital vehicle showroom: inspect/turntable framing | Model Library viewer framing (recent full-viewport layout work) — their camera choreography for "hero" presentation | 🥉 |

---

## Tier 3 — Other interesting ideas

These are looser observations worth keeping in the backlog.

### 3.1 Reproducible-everything discipline as a design asset

Multiple Mint experiences independently arrive at the same rule this repo
already enforces: seeded PRNGs (`mulberry32` in quadrotor-sandbox, seeded
rejection sampling in our own `wildlifeLogic.ts`), deterministic wind, fixed
sinusoid gusts — all so **recorded play replays identically**. The interesting
generalisation: any future gameplay-facing randomness in scenes (ambient
scheduler rolls, reaction picks, chatter draws) should come from
`createRng(deriveSeed(...))` off the world seed — never `Math.random()`, never
the tick RNG. Writing this down as a checklist item for new scene systems may
prevent a whole class of replay desync bugs.

### 3.2 Interaction foam: reactions before gameplay

Snorlax ships **no quests, no economy** — the entire game is Poke → reaction.
It is a reminder that the Sanctuary's felt quality will come disproportionately
from cheap, high-frequency feedback (1.1) rather than from new systems. When
prioritising, weigh "player pokes a sleeping wyvern and it reacts" above most
new mechanics.

### 3.3 Semantic motion interfaces beyond reactions

The `RigMotions` pattern generalises: any future procedural layer (injury
limps, fatigue carriage, age stiffness, battle wounds) could be authored as
semantic requests against one interface, keeping per-rig axis knowledge in a
single adapter file next to the baseline measurements
(`docs/WYVERN_ANIMATION_BASELINE.md` §Measured rig axes).

### 3.4 IdleScheduler memory as ambient variety

`REACTION_MEMORY = 4` + "never let memory empty the pool" fallback is a
reusable pattern for the existing `ambientRoll` scheduler: track recently
played ambient actions per wyvern so two wyverns side by side don't synchronise
into the same groom/eat cycle, with a guaranteed fallback so the pool can never
empty. Deterministic if the roll counter (already present) drives selection.

### 3.5 Presentation-layer damp/smoothing helper

Boulder Cove and Dynasty Index both define the same `damp(current, target,
smoothing, dt)` helper (`lerp` with `1 - exp(-smoothing * dt)` — frame-rate
independent). This repo's per-frame direct-mutation philosophy would benefit
from one shared, tested helper in `src/render/` instead of ad-hoc lerp factors;
several atmosphere components could consume it.

### 3.6 Catch-banner / flourish vocabulary

Boulder Cove's `catchBanner { emoji, line }` — a short, centred, auto-dismissing
celebration — plus per-event toast lines, is a compact vocabulary for duty
completion feedback (Stage 2) and battle results alike. DOM-based, accessible,
no WebGL text.

---

## Explicit non-goals (inherited)

- No importing Mint-hosted GLBs, audio, images, or fonts.
- No generic quest framework, dialogue tree, or NPC villager system.
- No new core state for presentation-only values (annoyance, growth visuals,
  time-of-day tint are scene state).
- No `Math.random()`, `Date.now()`, or render-loop draws from `state.rngState`.
- No second event stream beside the Stage 6 `GameEvent` channel.

---

## Promotion protocol

When an idea is picked up:

1. Check the relevant staged plan for overlap — fold in rather than fork if a
   stage already covers the need.
2. Otherwise create a work order with a progress ledger and self-contained
   stages, following the house style of `SANCTUARY_GAMEPLAY_PLAN.md`.
3. Cross the idea off here with a pointer to where it landed.

---

# Part B — World Atlas / World Map

**Scope.** `src/scenes/WorldMap/**` (the 3D tactical graph: regions,
reachability, yields, garrisons, biome colour, camera focus, assault entry) and
the staged work in `docs/WORLD_ATLAS_PLAN.md` (Stage 0 DONE; Stages 1–5 not
started). The world atlas plan already names SF Tennis Atlas as its reference
pattern, so Part B goes deeper on the other map-adjacent Mint experiences and
on ideas the atlas plan does not yet cover.

### B1. Tier 1 — fold into existing atlas stages 🥇

These reinforce stages already written; read the source before building.

| # | Atlas stage | Source | Takeaway |
|---|---|---|---|
| B1.1 | Stage 1 (directory) | `sf-tennis-atlas/src/client/app.ts` + `shared/types.ts` | Their whole directory loop: compound filters (query + neighbourhood + boolean facets) as one pure `filteredFacilities()`, map/list view toggle sharing one `selectedId` authority, result count element, escape-filtered detail rendering. Exactly the shape Stage 1 asks for — steal the structure, not the code. |
| B1.2 | Stage 3 (layers) | `sf-tennis-atlas` map caption | The map caption below the canvas narrates the current filter/selection state for screen readers and glanceability. Cheap, and satisfies Stage 5's "ARIA status" requirement early. |
| B1.3 | Stage 4 (dossier) | `fieldline-santa-clara/src/stadium/provenance.ts` + `sightlineEngine.ts` | **Provenance-tagged values**: every metric is `ProvenancedValue<T>` carrying `status: 'modeled' \| 'official' \| 'estimated'` and source ids, rendered with honest disclaimers. Port the pattern to atlas dossier fields: authored vs discovered vs estimated values get explicit status, which is exactly the "honest unknown states" the plan demands, generalised. |
| B1.4 | Stage 4 (route explanation) | `fieldline-santa-clara` `aisleTopology.ts` | Path explanations ("row 12, aisles 3 or 7, 40 m") built from topology, not prose templates. The atlas route explanation (required neighbor, shortest known path, blockers) should generate from the graph helper the same way — structured segments, then rendered. |
| B1.5 | Stage 5 (perf) | `fieldline-santa-clara` `sightline.worker.ts` + `SightlineClient.ts` | Heavy geometry analysis in a Web Worker with a cache keyed by geometry hash; results marshalled back with a client wrapper. Any future per-region analytical layer (sightlines to landmarks, terrain visibility) should follow this shape. 15 regions don't need it yet — the pattern is the note. |

### B2. Tier 2 — new ideas for the World Map itself

| # | Source | Idea | Fit | Weight |
|---|---|---|---|---|
| B2.1 | `impossible-places/src/world/SplatTransition.ts` | Region-to-region **particle transition**: sample both splats into pixel particles, burst → hold → reveal with quantised colours and seeded RNG, respecting `prefers-reduced-motion` | The world-map → biome-world camera transition (`scenes/BiomeWorld/transitions/`); also map-node focus changes. Deterministic seed keeps replays identical | 🥇 |
| B2.2 | `fieldline-santa-clara/src/stadium/shadeEngine.ts` + `camera/CameraRig.ts` | **Sun/shade + scheduled light**: shade computed per seat-over-time; camera presets per focus target with eased transitions | Map time-of-day: a shared sun angle driving terrain lighting, node glow, and biome-preview lighting so the map feels alive; presets already exist in `WorldMap/camera/mapPresets.ts` — add authored per-region hero angles | 🥈 |
| B2.3 | `memory-constellation/app/MemoryConstellation.tsx` | Constellation ↔ timeline duality: same data as a spatial star-field or a chronological scrubber, with scroll-to-travel focus wheel | Atlas duality: the 3D map (spatial) and Stage 4's campaign journal (chronological) as two views of one typed event history. Their scroll-wheel focus traversal with prev/next counters is a good fit for "prev/next region" keyboard navigation | 🥈 |
| B2.4 | `seatline-nyc/app/SeatlineNYC.tsx` | **Preview controller seam**: `SceneController { focusSeat(id) }` imperative handle on a canvas component; parent React only calls `focusSeat` on selection change | The one-selection-authority contract between the future atlas directory (Stage 1) and `MapCamera`/`mapCameraRig.ts`: DOM panel holds selection, scene exposes `focusRegion(id)` — no store chatter per frame | 🥇 |
| B2.5 | `orbit-week/src/app/OrbitWeek.tsx` | Planetary weekly planner: orbital bodies as mission slots | Campaign planning metaphor: owned regions orbit the sanctuary keep; pending assaults/visits scheduled as "missions" on arcs. Presentation-only re-framing of the war table's campaign data — not a new core system | 🥉 |
| B2.6 | `dynasty-index/src/scene/CameraDirector.ts` + `LightingRig.ts` | Authored camera choreography: slow orbit, drift, and key-light shifts keyed to browsing state | Idle map attract mode: when the player stops interacting, the camera slowly orbits the world; touching input returns control. Pairs with B2.2 sun cycle | 🥉 |

### B3. Tier 3 — patterns and smaller observations

- **B3.1 Layer vocabulary without colour.** Stage 3 already mandates
  shape/pattern cues; Fieldline's non-colour legend (`status` chips plus
  textual values on selection) is the reference implementation. Their
  `nodeVisuals.ts` equivalent keeps one palette authority — our
  `WorldMap/nodeVisuals.ts` is already this shape; keep new layers flowing
  through it rather than adding per-component hexes.
- **B3.2 Cache keyed by content hash.** Fieldline keys sightline caches by
  geometry version hash. When atlas layer values are memoized (Stage 5), key by
  region-graph/tick inputs, not object identity — cheaper invalidation
  reasoning and testable.
- **B3.3 Escape-everything detail rendering.** SF Tennis Atlas escapes all
  interpolated HTML (`escapeHtml`) even for its own data. Region summaries are
  authored strings that may one day contain quotes/apostrophes — render via
  text nodes, not `innerHTML`, in the dossier.
- **B3.4 Map/list parity counts.** Their `resultCount` element is trivial but
  load-bearing for trust: the atlas directory should always show
  "X of Y regions" so hidden-by-knowledge entries read as filtered, not lost.
- **B3.5 `settle` camera framing.** Seatline's `focusSeat` eases then settles
  (damped, not snapped) — the same treatment for atlas camera focus on
  directory selection, respecting reduced-motion with an instant cut.

### Explicit non-goals for Part B

- No second map canvas, route algorithm, or conquest graph (inherited).
- No real-world GIS data or live feeds.
- Splat/particle transitions must use deterministic seeds; no `Math.random()`.
- The orbital campaign view (B2.5) is presentation-only and must never become
  a second authority for assault scheduling.
