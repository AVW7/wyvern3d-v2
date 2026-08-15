# Sanctuary gameplay — staged work orders

**Status: OPEN.** Stage 0 of `docs/SANCTUARY_GAMEPLAY_PLAN.md` is DONE. Follow the handoff protocol below to take the first incomplete stage (Stage 1: Context action and physical carry).

This plan turns the sanctuary from a hub of panels and ambient animation into a place where the
player performs short, physical care routines. It is deliberately written as self-contained work
orders for coding agents. The source inspiration was the request → gather → deliver → celebrate
loop in Mint Playground's Boulder Cove and the placement feedback in Room Ritual; neither external
project is a runtime dependency, and no external asset is required by this plan.

---

## HANDOFF PROTOCOL

1. Read all of `CLAUDE.md` and this document.
2. Check `docs/WYVERN_ANIMATION_PLAN.md`. If its Stage 6 event stream is not DONE, stop and complete
   that work order first; do not create a second event queue here.
3. Find the first row in the progress ledger below not marked DONE.
4. Do only that stage. Preserve unrelated user changes in the worktree.
5. Run the stage-specific checks and the standard gates:

   ```bash
   pnpm typecheck && pnpm lint && pnpm test
   ```

   Also run `pnpm sim:battle` when a stage changes resources, bond, hunger, injury, or training.
6. Update both the ledger row and the stage's own `Status:` line in the same commit as the code.
   Record surprises or deliberate deviations in one sentence.

When every stage is DONE, fold durable architecture facts into `CLAUDE.md`, mark this document
CLOSED with the date, and retain it as the decision record.

---

## PRODUCT CONTRACT

The sanctuary loop is:

> notice a wyvern's need → collect or perform the relevant care action in-world → return to the
> wyvern or station → see an immediate reaction → make visible progress toward the sanctuary

The first release must satisfy these rules:

- Duties come from real state: hunger, injury, bond, age, assignment, and available resources.
- A duty takes roughly 20–90 seconds of active play, not hours of simulation time.
- The player can always understand who needs what, where to go, and what completion will do.
- Routine care uses one context action. The command wheel remains the advanced flight/combat tool.
- Rewards use existing resources and bond carefully; no parallel currency in the first release.
- Missing or ignored duties do not punish the player. Existing hunger/injury systems already carry
  consequences; duties are an expressive way to respond to them.
- The first release uses existing props and animation states. New models are optional polish, not a
  prerequisite for functional acceptance.

### Explicit non-goals

- No generic quest framework, dialogue tree, NPC villager system, or procedural narrative engine.
- No fishing, bug-catching, farming, or house-building copied literally from Boulder Cove.
- No player transform, wyvern transform, proximity distance, or per-frame timer in `GameState`.
- No `Math.random()`, `Date.now()`, UUID, or render-loop draw from `state.rngState`.
- No second event/flourish stream beside the one delivered by animation-plan Stage 6.
- No removal of command-wheel care actions until the context path is proven usable.
- No importing Mint-hosted GLBs, audio, images, or fonts. Code ideas may be reimplemented; assets
  require a separate provenance and licence review.

---

## ARCHITECTURE CONTRACT

Persistent, replay-relevant duty state belongs in `src/core/**`. Presentation and proximity stay
outside core.

### Core shape

Agents may refine names, but preserve this separation:

```ts
type SanctuaryDutyKind = 'feed' | 'medicine' | 'companionship' | 'flightExercise'
type SanctuaryDutyStatus = 'available' | 'carrying' | 'complete'

interface SanctuaryDuty {
  id: number
  kind: SanctuaryDutyKind
  subjectId: string
  createdTick: number
  status: SanctuaryDutyStatus
  sourceId?: string
}

interface SanctuaryDutiesState {
  nextSeq: number
  active: SanctuaryDuty[]
  carriedDutyId: number | null
  completed: number
}
```

- Use a duty-local sequence. Never consume `nextId`; it affects future wyvern names.
- Cap active duties at three for the first release.
- Generate candidates from sorted entity ids and deterministic state. Prefer a documented rotation
  keyed by day/tick over consuming the global RNG. If randomness is later necessary, it must occur
  in the tick path and be covered by replay tests.
- Store logical carry state only. The carried sack/herb visual is scene state derived from it.
- Completion effects must pass through intents and executions and must revalidate the subject,
  duty status, resources, and current need.
- Do not reorder `executeNextTick`. Add any duty tick inside the existing sanctuary phase.
- Use the Stage 6 `GameEvent` stream for `sanctuary_duty_completed`; do not use formatted log text as
  an event source.

### Presentation shape

- A small scene-side proximity resolver chooses one `ContextAction` from nearby duty sources,
  wyverns, and stations. It does not mutate core.
- Context prompts are DOM UI. In-world request badges use `WorldLabel` or a canvas-texture sprite;
  never use Drei `<Text>`.
- Per-frame badge/carry transforms mutate Three objects directly. Never call React/Zustand setters
  every frame; change-guard any nearby-action store update.
- Wyvern reactions travel through the existing director/action-channel seams. Do not add animation
  state to core.

### Balance defaults

Keep all numbers in `src/core/data/config.ts`. Initial guidance, subject to tests:

- Maximum active duties: 3.
- Refresh eligibility: once per sanctuary day, plus immediately when a slot opens.
- Feed duty: use the existing feed cost and feed relief; completion may add at most +1 bond.
- Medicine duty: only for a meaningfully injured wyvern and must not outperform the infirmary's
  long-term purpose.
- Companionship duty: small bond gain, no resource reward.
- Flight exercise: adult/juvenile eligibility must follow existing flight rules and may grant a
  small bond gain, not a full training-station stat increase.
- No gold reward. If completion needs feedback before prop unlocks exist, use a small existing
  resource or bond change and log it explicitly.

---

## PROGRESS LEDGER

| Stage | Title | Status | Depends on | Completion note |
|---|---|---|---|---|
| 0 | Feed-duty vertical slice | DONE | Animation plan Stage 6 | Deterministic feed duties in core, save migration 10->11, TAKE/ABANDON/COMPLETE intents, typed completion events, accessible UI controls in RosterPanel, 10 unit tests in `duties.test.ts`. |
| 1 | Context action and physical carry | DONE | 0 | Pure proximity & priority resolver in `actionResolver.ts`, change-guarded `useContextActionStore`, 3D `CarriedItem` visual bundle, click/touch and E key trigger, fully tested in `actionResolver.test.ts`. |
| 2 | Request readability and wyvern reactions | DONE | 1 | `SanctuaryDutiesHud` chips, 3D `DutyRequestBadge`, `director.playReaction(..., 'eat')`, spectral completion flourish in `EventFlourishManager`, 3 unit tests in `sanctuaryDutiesPresentation.test.ts`. |
| 3 | Medicine, companionship, and flight exercise | DONE | 2 | Implemented 4-duty care vocabulary in core & presentation (`feed`, `medicine`, `companionship`, `flightExercise`), deterministic candidate priority generator, config costs & relief, tested in `duties.test.ts` and `actionResolver.test.ts`. |
| 4 | Sanctuary improvement unlocks | NOT STARTED | 3 | — |
| 5 | Sanctuary audio layer | NOT STARTED | 2 | — |
| 6 | Layout snapshots and editor feedback | NOT STARTED | 4 | — |

Stages 5 and 6 are independent once their listed dependencies are complete, but the handoff
protocol remains one stage per agent/commit unless the user explicitly requests parallel work.

---

# STAGE 0 — Feed-duty vertical slice

**Status:** DONE · **Depends on:** Stage 6 of `docs/WYVERN_ANIMATION_PLAN.md`

**Goal.** One deterministic feed duty exists end to end in core: it appears for a hungry wyvern,
can be accepted/carried/completed through intents, applies the existing feed economics, emits a
typed completion event, survives save/load, and replays identically. UI may be minimal buttons in
an existing panel for this stage; physical movement arrives in Stage 1.

**Likely files.** `src/core/types.ts`, `src/core/data/config.ts`,
`src/core/state/game.ts`, `src/core/state/save.ts`, `src/core/intents/index.ts`,
`src/core/executions/index.ts`, `src/core/systems/sanctuary.ts`, and co-located tests.

**Do.**

1. Add the minimal persistent duty state and initialize it for new games.
2. Add a save migration from the repository's current save version. Discover the actual version;
   do not trust stale numbers in older planning documents.
3. Add a deterministic generator that selects one eligible hungry wyvern from sorted ids. It must
   not draw from the main RNG and must not regenerate a different duty every tick.
4. Add intents to take the duty item, abandon it, and complete the duty. Executions revalidate all
   ids/status/resources. Deduct food and apply relief only on successful completion.
5. Emit `sanctuary_duty_completed` through the existing typed event stream and retain the ordinary
   human-readable log entry.
6. Add temporary, accessible controls to an existing sanctuary/roster panel so the entire state
   transition is exercisable before scene proximity is involved.

**Tests.** Eligibility threshold; three-duty cap; stable selection; no duplicate subject duty;
successful completion; insufficient food; stale/deleted subject; abandon/reaccept; save migration;
serialization; replay equality; unchanged `rngState`; no `nextId` consumption.

**Verify.** Standard gates, `pnpm sim:replay` with a captured duty sequence, and
`pnpm sim:battle` because hunger/bond/resources are touched.

**Done when.** A fresh and migrated game can complete a feed duty with deterministic state and one
typed event, without moving any player/wyvern transform into core or altering RNG/id sequences.

---

# STAGE 1 — Context action and physical carry

**Status:** DONE · **Depends on:** Stage 0

**Goal.** The feed duty is completed by walking to a supply source, taking a visible ration, and
returning to the requesting wyvern using one context action.

**Likely files.** A new focused store under `src/state/`, a pure resolver and tests under
`src/scenes/Sanctuary/`, `src/scenes/Sanctuary/SanctuaryScene.tsx`, player-controller integration,
`src/ui/InteractionNotice.tsx`, and a small carried-item component.

**Do.**

1. Define a presentation-only `ContextAction` containing id, label, priority, disabled reason, and
   callback/intent payload. Keep core types out of scene rendering where existing boundaries forbid
   them; adapt at the scene edge.
2. Resolve the nearest valid action with explicit priority: active delivery target → duty source →
   existing station → wyvern selection. Use pure distance/priority helpers with unit tests.
3. Reuse an existing barrel/crate as the ration source. A placed source must be discoverable from
   sanctuary layout data, with a deterministic fallback source in the default layout.
4. Bind keyboard and touch/click affordances to the same action. Preserve existing click-to-move,
   editor mode, attack targeting, and panel interactions.
5. Render a small ration bundle attached to the player while core says a feed duty is carried.
   Mutate its transform in the scene; do not publish it through React state per frame.
6. On delivery, dispatch the Stage 0 completion intent. Do not trust the scene to apply effects.

**Tests.** Priority ties; disabled actions; editor/attack-mode suppression; source removed/moved;
selected wyvern not stealing the delivery action; keyboard and click invoking the same payload;
change-guarded nearby store updates.

**Verify.** Standard gates plus live checks with keyboard, mouse, and narrow viewport/touch layout.

**Done when.** A player can identify the prompt, collect a ration, see it carried, deliver it, and
receive the exact Stage 0 result without opening the command wheel or a management panel.

---

# STAGE 2 — Request readability and wyvern reactions

**Status:** DONE · **Depends on:** Stage 1

**Goal.** Duties are understandable without hunting through menus, and completion produces an
immediate, entity-specific reaction.

**Likely files.** A new `SanctuaryDutiesHud`, a request-badge component using `WorldLabel`/canvas
sprites, `src/scenes/Sanctuary/director/wyvernDirector.ts`, Stage 6 event draining/presentation,
and focused tests.

**Do.**

1. Show no more than three compact duty chips: wyvern name, icon, instruction, and destination.
2. Display a request badge above the subject. Cull it by distance and camera visibility; keep text
   out of WebGL font rendering.
3. Selecting a chip focuses/highlights the subject or destination using existing camera/selection
   seams. Do not teleport the player.
4. Drain `sanctuary_duty_completed` by event sequence. Trigger an appropriate one-shot reaction
   through the action channel, a small deterministic flourish, and a concise notification.
5. Suppress delayed offline flourishes using the Stage 6 cursor rules.
6. Add clear states for insufficient resources, subject unavailable, carrying, and completion.

**Tests.** Event consumed once; remount does not replay it; offline cursor jump; badge disappears
when duty completes; labels remain correct after rename; no per-frame store churn.

**Done when.** A new player can complete the loop without opening a roster panel, and completion is
visibly attributable to the correct wyvern exactly once.

---

# STAGE 3 — Medicine, companionship, and flight exercise

**Status:** DONE · **Depends on:** Stage 2

**Goal.** Expand duties into a small care vocabulary that uses existing sanctuary locations and
wyvern commands rather than becoming a generic quest engine.

**Do.**

1. Add medicine duties for injured wyverns. Use an existing infirmary/log-pile/herbal-garden prop
   as source, and balance relief so the infirmary remains valuable.
2. Add companionship duties for eligible low-bond, non-busy wyverns. Complete through an existing
   pet/calm/follow interaction; do not require a carried item.
3. Add flight exercise for flight-capable wyverns. Reuse command/director phases and existing
   flight-ring geometry. Require a small, deterministic sequence such as follow → pass markers →
   land/return, with progress held presentation-side until the completion intent. Core cannot
   validate traversed 3D markers because player/wyvern transforms are deliberately not replay
   state; it revalidates the duty, subject eligibility, and completion availability instead.
4. Put each duty kind's thresholds, costs, relief, and cooldowns in config.
5. Ensure one wyvern cannot receive contradictory simultaneous duties and busy/breeding/garrisoned
   subjects are handled explicitly.

**Tests.** Full eligibility matrix by age/assignment/condition; medicine cap; command interruption;
presentation-side flight marker ordering; cancellation; rejection when the duty/subject is stale or
ineligible; replay and save/load for each persistent result.

**Verify.** Standard gates and `pnpm sim:battle`; live-check every duty with one hatchling, juvenile,
adult, injured, hungry, and assigned wyvern.

**Done when.** At least four distinct needs produce short, readable activities, and each reuses an
existing system or landmark instead of adding a disconnected minigame.

---

# STAGE 4 — Sanctuary improvement unlocks

**Status:** NOT STARTED · **Depends on:** Stage 3

**Goal.** Duty completion visibly improves the sanctuary and gives the layout editor meaningful
progression without introducing a new spendable currency.

**Do.**

1. Persist a lifetime duty-completion count and milestone flags. Completion count is progress, not
   a currency: it cannot be spent or farmed into economy resources.
2. Unlock a small first set of existing catalog props at documented milestones. Recommended first
   set: upgraded feeding area dressing, grooming/perch object, hatchling toy/dressing, banner/fire
   decoration. Locked props remain visible in the editor with their requirement.
3. Make unlocked functional props influence only ambient choice/location in the first release—for
   example, a grooming object enables or attracts a groom idle. Do not add opaque stat multipliers.
4. Use typed events for milestone completion and show one bounded construction/reveal flourish.
5. Ensure old saves keep all props already placed; migrations never relock or move user objects.

**Tests.** Exact milestone boundaries; idempotent unlock; old-save preservation; storage inventory;
place/store/reset; ambient target fallback when an unlocked prop is absent or blocked.

**Done when.** Completing duties unlocks at least three placeable improvements and one visibly
changes where/how wyverns idle, without a new economy or destructive migration.

---

# STAGE 5 — Sanctuary audio layer

**Status:** NOT STARTED · **Depends on:** Stage 2

**Goal.** Give the sanctuary an owned, disposable audio presentation layer: environment bed,
localized landmarks, contextual interaction cues, and wyvern responses.

**Do.**

1. Add a focused audio manager outside core with one user-gesture unlock path, master/ambience/SFX
   controls, visibility pause/resume, and complete disposal on unmount.
2. Add a low continuous outdoor bed, footsteps/movement state, and spatial loops for fire/forge,
   water, hatchery, and woodland where owned audio exists.
3. Add one-shots for collect, delivery, invalid action, duty completion, and milestone completion.
4. Connect subject reactions to species/age-safe vocal cues without coupling animation playback to
   audio duration.
5. Store only audio preferences locally. Never place audio time or playback state in `GameState`.
6. Use only project-owned, generated, or explicitly licensed audio. Record every source in
   `CREDITS.md`; do not copy Mint Playground asset URLs.

**Tests.** Preference persistence; disabled audio makes no play attempt; visibility handling;
single listener/manager after remount; missing file fallback; event one-shot deduplication.

**Done when.** The feed loop reads with the screen hidden after orientation, all audio can be
disabled, and scene changes leak neither listeners nor playing elements.

---

# STAGE 6 — Layout snapshots and editor feedback

**Status:** NOT STARTED · **Depends on:** Stage 4

**Goal.** Adopt the useful Room Ritual editor patterns: trustworthy previews, collision feedback,
and named sanctuary layouts, without bypassing Wyvern's intent/replay architecture.

**Do.**

1. Add continuous overlap/clearance feedback while moving an object. Reuse the sanctuary's existing
   collision and station-clearance rules; do not create render-derived business rules.
2. Preserve the current grid snap and intent-backed edits. Add cancel-to-original for an active
   drag and a bounded undo/redo history built from deep-cloned layouts.
3. Add up to five named local layout snapshots with a thumbnail if capture is reliable. Snapshots
   are local convenience data; loading one dispatches the normal restore-layout intent so the
   resulting game state remains serializable/replayable.
4. Snapshot load must never overwrite duty unlock state, resources, wyvern assignments, or newer
   catalog inventory rules. Missing/locked props are reported before applying.
5. Defer side-by-side comparison unless user testing shows snapshots alone are insufficient.

**Tests.** Rotated-footprint overlap; station clearance; cancel; bounded undo/redo; snapshot schema;
missing prop; locked prop; replay of restored layout; no mutation through retained references.

**Done when.** Players can safely experiment with a duty-improved sanctuary, recover from layout
mistakes, and switch named arrangements without corrupting core progression.

---

## FINAL ACCEPTANCE CHECKLIST

- A fresh save offers a deterministic, state-derived duty.
- Feed, medicine, companionship, and flight exercise are completable in-world.
- The same input affordance works on keyboard and touch/click.
- The command wheel remains available for advanced commands and has no regression.
- Completion effects survive save/load and replay; no transform enters core.
- Duty generation consumes neither global RNG nor `nextId`.
- Offline catch-up does not replay a burst of old flourishes.
- At least three sanctuary improvements unlock from lifetime completion milestones.
- Audio is optional, credited, and leak-free.
- Layout snapshots restore only layout data through normal intents.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, replay checks, and `pnpm sim:battle` pass.
