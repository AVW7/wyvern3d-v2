# Inhabited world — staged work orders

**Status: PLANNED — Stage 0 is eligible now.**

Every system in this game currently models terrain, creatures and abstractions. Nothing models
*inhabitants*. A region is `biome, tier, position, neighbors, yields, nativeSpecies, garrison,
defenders`; holding one produces resources and an `unrest` number that silently flips ownership at a
threshold. The player conquers places that contain no one, feeds wyverns from a decrementing
counter, hunts prey that nothing else wants, and fights on ground that no one built.

This plan adds the missing layer: people, domestic animals, rival predators, and contested ground.
Each stage attaches to a system that already exists rather than introducing a parallel one.

The source of the direction was an audit of the external model library
(`docs/EXTERNAL_MODEL_INDEX.md`), which is overwhelmingly civilizational — market tents, forges,
alchemy benches, thrones, book stands, a villager, a night-siege scene — against a game with no
settlements in it. **The library is guidance, not a shopping list.** No stage here requires a
specific external asset; every stage degrades to existing procedural or atlas art, and any asset
that does land goes through the normal `BIOME_LIBRARY.md` / `asset-sources.json` licence path.

---

## HANDOFF PROTOCOL

1. Read all of `CLAUDE.md` and this document.
2. Confirm the dependency named in the ledger row is DONE before starting. Stage 1 additionally
   requires that the Highlands plan has reached its own Stage 3; do not build prey behaviour here
   ahead of it.
3. Take the first ledger row not marked DONE and do only that stage.
4. Reuse the existing `GameEvent` stream (`core/types.ts`, `GameEventKind`) for every discrete
   moment. **Do not create a second event queue** — that mistake is already called out in the
   sanctuary plan's protocol.
5. Run the stage checks and the standard gates:

   ```bash
   pnpm typecheck && pnpm lint && pnpm test
   ```

   Run `pnpm sim:battle` for any stage touching resources, unrest, combat or economy, and confirm
   the win-rate curve is still monotonic across regions.
6. Update the ledger row and the stage's own `Status:` line in the same commit as the code. Record
   surprises or deliberate deviations in one sentence.

## PRODUCT CONTRACT

A held region should answer:

- **Who lives here?** — a visible settlement whose condition reads at a glance from the world map.
- **How are they taking this?** — unrest has a face, not just a number and a revolt threshold.
- **What did conquest cost?** — the difference between a prospering and a resentful holding is
  legible without opening a panel.

And the living world should answer:

- **Where does food come from?** — feeding traces back to something that exists, not a decrement.
- **Who else wants this kill?** — the player is a predator among predators, not a shopper.
- **Why here?** — an assault happens at a place someone built and defended, not on open ground.

Invariants:

- `src/core/**` stays pure. Settlement condition is **derived** from existing `RegionState`
  (`owner`, `unrest`, `garrison`) — no new per-frame state in `GameState`, no `Math.random()`.
- Authored, static inhabitant data may join `RegionDef` the way `atlas?: AtlasRegionData` already
  does. Mutable condition is derived or lives in the existing state fields.
- Settlement and creature meshes are **cosmetic**. Yields, unrest maths, combat authority and hunt
  outcomes stay in `core/data` and pure rules, never read from a loaded model.
- Missing optional assets degrade gracefully and never kill the persistent canvas.
- One world unit remains one metre.

### Non-goals

- No city-builder, no settlement construction UI, no population simulation, no per-citizen agents.
- No second hunting system — Stage 1 extends the Highlands plan's prey model and owns no prey rules.
- No duplicate event queue, World Atlas knowledge model, or biome renderer.
- No new economy resource, and no rebalancing of yields as a side effect of making them visible.
- No skinned humanoid crowds. `SquadActorView` is instanced and non-skinned on purpose
  (`BattleScene.tsx:496`); nothing here changes that contract.
- No unlicensed asset additions and no performance-budget bypass.

## PROGRESS LEDGER

| Stage | Title | Status | Depends on |
|---|---|---|---|
| 0 | Settlements and the face of unrest | DONE — 2026-08-19 | — |
| 1 | Rival predators in the hunt | NOT STARTED | Highlands Stage 3 |
| 2 | Livestock and the source of food | NOT STARTED | Sanctuary Stage 3 (DONE) |
| 3 | Contested ground for assaults | NOT STARTED | 0 |
| 4 | Cultural identity per region | NOT STARTED | 0, 3 |

Stages 1 and 2 are independent of each other and of Stage 0, but the protocol remains one stage per
agent/commit unless the user explicitly requests parallel work.

# STAGE 0 — Settlements and the face of unrest

**Status:** DONE — 2026-08-19 · **Depends on:** —

**Landed.** `SettlementDef` on `RegionDef` (19 of 22 regions authored; Crystal Grotto, Emberwaste
and Glaciercrest deliberately left uninhabited), pure `core/state/settlement.ts` deriving
`condition` + `trend`, thresholds in `CONFIG.region.settlement`, a
`settlement_condition_changed` event emitted from `regionTick` on a band crossing,
`SettlementCluster` on the world map, and the condition in the atlas dossier. 19 new tests in
`settlement.test.ts`; 884 tests pass (19 of them new); `pnpm sim:battle` curve unchanged and still monotonic.

**Three deviations worth recording.**

1. **Trend is a second reading, not garrison folded into the band.** The work order named
   `garrison` as an input to the condition. Mixing it in would double-count: `regionTick` already
   subtracts garrison suppression from unrest every tick, so a well-garrisoned region shows a low
   band *because* of its troops. Garrison instead drives a separate `trend`, which is the part a
   player cannot read off the unrest number — two regions at 60 unrest are in the same state but
   not on the same trajectory.

2. **The flourish went to the dossier history, not `EventFlourishManager`.** That manager is
   mounted only in `SanctuaryScene`, and this is a world-map event. Rather than mount a second
   drain, `formatRegionalEvent` gained a case, so the crossing surfaces in the region dossier's
   existing history. A world-map flourish would be a reasonable later addition.

3. **`SettlementDef.offset` is a fraction of the node radius, not world units.** First pass
   authored it in metres and sized buildings to architectural scale; on a map where a whole region
   is a 4–5 unit disc that renders sub-pixel, and nothing was visible. Everything the cluster draws
   is now a fraction of `nodeRadius`, which also makes one authored offset read the same on a
   tier-1 and a tier-4 node.

**Not verified visually.** Settlements, tier-driven mass, bare uninhabited regions and the
`hostile` condition were all confirmed in the browser. The four *player-owned* conditions were not
compared side by side: reaching them needs held regions plus 70–260 ticks of unrest accumulation,
and a hand-patched save would not load (`GameClock` only calls `store.load()` when `store.loaded`
is false, and autosave then overwrites the patch). The condition→colour mapping is a total lookup
table with tests behind it, but **someone should eyeball all four at map camera distance before
this is trusted as readable.**

**Goal.** A held region visibly contains people, and its unrest is readable from the world map
without opening a panel.

**Do.**

1. Add authored, static settlement data to `RegionDef` alongside `atlas` — a name, a settlement
   tier, and an anchor transform. Static content only; no mutable state.
2. Derive a `SettlementCondition` (e.g. `prospering | strained | resentful | revolting`) purely from
   existing `RegionState.owner`, `unrest` and `garrison`. Put the derivation in a pure, co-located,
   independently testable module under `core/` — it is a rule, not presentation. Its thresholds
   belong in `core/data/config.ts` with every other tunable.
3. Render the settlement on the world map as a silhouette whose condition is legible at map camera
   distance: banners, smoke, lit or cold windows, activity or its absence. Read the derived
   condition; never recompute thresholds in the view.
4. Use `WorldLabel`/canvas sprites for any in-world text. `drei`'s `<Text>` still kills the WebGL
   context in WebKit.
5. Emit a `GameEvent` when a settlement crosses a condition boundary, and give it a flourish through
   the existing `EventFlourishManager` path. Add the new `GameEventKind` to the union; bump
   `SAVE_VERSION` only if authored data actually requires a migration.
6. Surface the same condition in the World Atlas dossier so the directory and the map agree.

**Tests.** Condition derivation is a pure function of its inputs across the full unrest range;
boundaries match config; the home region is never `revolting` (it is exempt from unrest and a test
already guards that); every region resolves to a valid condition; event emission is idempotent per
crossing and replay-stable.

**Verify.** Standard gates, plus `pnpm sim:battle` to confirm no yield or unrest drift. Live check at
world-map camera distance that all four conditions are distinguishable.

**Done when.** A player scanning the world map can tell which holdings are secure and which are
about to revolt, without opening anything, and the atlas dossier agrees with what the map shows.

# STAGE 1 — Rival predators in the hunt

**Status:** NOT STARTED · **Depends on:** Highlands plan Stage 3

**Goal.** The hunt is a contest for a kill rather than a collection of one.

**Do.**

1. Extend the Highlands plan's existing prey model with a rival predator actor. **This stage owns no
   prey rules** — awareness, tracking and spooking belong to Highlands Stages 2 and 3, and duplicating
   them here is an explicit non-goal.
2. Give the rival a deterministic approach: it converges on the same quarry the player is stalking,
   on a schedule derived from the expedition seed. No `Math.random()`; use `createRng(deriveSeed(...))`
   off the save seed, the pattern the sanctuary director already follows.
3. Make the contest a decision, not a race — striking early should be worse but safer, waiting
   better but riskier. Put the timing window and payoff difference in `core/data/config.ts`.
4. Presentation reads the rival's state and plays approach/creep/run locomotion. If no rival model is
   available, fall back to the existing procedural placeholder path the doe already has
   (`DoeFallback` in `HighlandsScene.tsx`) rather than skipping the actor.
5. Resolve contested outcomes through the Highlands plan's authoritative harvest, emitting its
   expedition events. No new outcome authority.

**Tests.** Rival approach is deterministic for a given seed and expedition; the contest window
matches config; outcomes are replay-stable; a lost contest produces a valid, non-crashing expedition
report; the rival never resolves a harvest itself.

**Verify.** Standard gates plus `pnpm sim:battle` if the stage touches food, hunger, bond or injury.
Live check that the approach is readable at hunting camera distance and that the decision is legible
before the window closes.

**Done when.** A player can lose a kill to a rival, understands why, and can articulate what they
should have done differently.

# STAGE 2 — Livestock and the source of food

**Status:** NOT STARTED · **Depends on:** Sanctuary plan Stage 3 (DONE)

**Goal.** Feeding a wyvern traces back to something living in the sanctuary instead of a resource
counter.

**Do.**

1. Add livestock as placeable `PROP_CATALOG` entries carrying `station`/`radius`, so a pen becomes an
   interactable through the existing catalogue mechanism rather than a bespoke object.
2. Connect the pen to the **existing** feed duty from sanctuary Stage 0/3 as its gather source. The
   duty vocabulary, priority resolver and completion events already exist — this stage supplies the
   physical origin of the carried item, and adds no fifth duty.
3. Keep livestock animals cosmetic and directed per-frame outside `core`, following
   `wyvernDirector.ts`: position, yaw and `ModelState` live in the scene layer, never in `GameState`.
4. Ambient livestock behaviour uses a local `createRng(deriveSeed(seed, ...))`, never `withRng` —
   drawing from the tick RNG in a render loop desyncs every replay.
5. Wire the animals through `manifest.ts` as `wildlife.*` entries with numeric height fits, the way
   `wildlife.deer` and `wildlife.guineafowl` already are. Missing model ⇒ procedural fallback, pen
   still functional.

**Tests.** Pen placement round-trips through the layout save; the feed duty resolves identically with
and without a pen present (no new authority); livestock RNG never advances `state.rngState`; ambient
selection is deterministic per seed.

**Verify.** Standard gates plus `pnpm sim:battle` — feeding touches hunger and bond. Live check that
gather → carry → deliver reads as one continuous action.

**Done when.** The feed duty begins at a visible source, and removing the pen degrades to today's
behaviour rather than breaking the duty.

# STAGE 3 — Contested ground for assaults

**Status:** NOT STARTED · **Depends on:** Stage 0

**Goal.** An assault happens at a defended place, and terrain is a tactical variable rather than
dressing.

**Do.**

1. Derive an authored battle site per region from its settlement tier and biome — a gate, a wall
   line, a bridge, a ford. Deterministic from region id and seed; no reshuffling between visits.
2. Give the site tactical meaning in `core/combat/encounter.ts`: a constrained approach that limits
   how much frontage engages at once. This is a combat-model change — it must behave identically in
   auto-resolve and playable battles, because they are the same code stepped at the same fixed `dt`.
3. **Treat the balance implication as the point, not a side effect.** The harness currently reports
   near-binary 100%/0% outcomes; a frontage constraint is a lever on decisiveness that is not just
   raising damage variance in `config.ts`. Measure before and after.
4. Build the site from the biome atlas and existing procedural terrain. Any new prop goes through
   `biome-library.json` with licence evidence and the triangle budget, gated by
   `pnpm assets:validate-biome-atlas`.
5. Squads remain instanced and non-skinned. If a site needs a defender silhouette, it is scenery or
   an instanced non-skinned figure — never a skinned crowd.

**Tests.** Site derivation is deterministic per region and seed; auto-resolve and playable battles
produce identical outcomes for identical inputs; frontage constraint is bounded and never zero;
existing replays still reproduce.

**Verify.** Standard gates, `pnpm assets:validate-biome-atlas` for atlas changes, and
`pnpm sim:battle` **before and after**, with the win-rate curve recorded in the ledger row. The curve
must stay monotonic across region tiers; the goal is closer fights, not reordered ones.

**Done when.** Assaults on different regions play differently because of where they happen, and the
harness shows fights that are decided rather than predetermined.

# STAGE 4 — Cultural identity per region

**Status:** NOT STARTED · **Depends on:** 0, 3

**Goal.** Regions differ by who lives there, not only by biome.

**Do.**

1. Add an authored culture tag to `RegionDef`, orthogonal to `biome` — two regions sharing a biome
   may differ in culture, and two regions sharing a culture may differ in biome. This is the axis
   `compositionTag` does not cover.
2. Bind each culture to an art vocabulary: settlement silhouette, banner motif, landmark style. The
   external library holds at least two coherent and visually distinct sets — a European-medieval one
   and an ancient/Mauryan/Buddhist one — which is guidance for the *number* of vocabularies worth
   supporting, not a mandate to import those files.
3. Route culture through the World Atlas dossier as static lore, per the atlas contract that static
   lore lives in region definitions.
4. Keep culture cosmetic and informational. It must not alter yields, unrest maths or combat, and no
   stage may make it do so later without a balance pass.

**Tests.** Every region resolves to a valid culture; culture and biome vary independently across the
region set; atlas dossier renders every combination; no yield or combat value reads the culture tag.

**Verify.** Standard gates plus `pnpm sim:battle` to prove the curve is unchanged — culture is
cosmetic, so an altered curve means something leaked into the rules.

**Done when.** A player can distinguish two same-biome regions by who lives there, and the sim is
provably unaffected.

---

## Closing this plan

Close it per the same convention the other plans use: when every ledger row is DONE, fold durable
process into the relevant contract docs, leave measured facts where they are measured, and keep this
document as the historical work-order record.
