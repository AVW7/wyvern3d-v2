# Powers, diplomacy and armies — staged work orders

**Status: PLANNED — Stage 0 is eligible now.**

`Faction` is `'player' | 'enemy'` (`core/types.ts`). There is no third party anywhere in the model,
so every region on the map is either yours or an obstacle, every army is a garrison waiting to be
assaulted, and the only verb the world offers is conquest. This plan adds the missing axis: **other
powers, who can be fought, bargained with, or joined.**

It is the *systems* half of a two-document split. The content half — biome landmark and
fortification tiers, parley stage sets, hero rig vocabulary — is
`docs/WORLD_CONTENT_TIERS_PLAN.md`, and it deliberately depends on nothing here so the two can
proceed in parallel.

Stage 0 is the unlock and has the widest blast radius in the codebase. Read its work order in full
before starting anything else in this document.

---

## HANDOFF PROTOCOL

1. Read all of `CLAUDE.md` and this document. Re-read the core purity invariant before touching
   `src/core/**`.
2. Take the first ledger row not marked DONE and do only that stage.
3. Negotiation outcomes are **pure functions of state**. If a stage wants variance it goes through
   `withRng(state, …)`, never `Math.random()` and never a wall-clock read — a replay has to
   reproduce every diplomatic answer exactly.
4. Reuse the existing `GameEvent` stream for discrete moments. Do not create a second event queue.
5. Run the stage checks and the standard gates:

   ```bash
   pnpm typecheck && pnpm lint && pnpm test
   ```

   **Every stage in this document must also run `pnpm sim:battle`**, because every stage touches
   who counts as an enemy. Record the win-rate curve in the ledger row and confirm it is still
   monotonic across region tiers.
6. Update the ledger row and the stage's own `Status:` line in the same commit as the code.

## PRODUCT CONTRACT

The world should answer:

- **Who else is out there?** — regions belong to named powers with their own holdings, not to an
  undifferentiated enemy.
- **What do they want?** — a power's disposition toward the player is legible and has causes.
- **What can I do besides attack?** — truce, tribute, pact, vassalage; and each has a cost.
- **Where are their armies?** — forces occupy space and move through it, so they can be met,
  avoided, or intercepted.

Invariants:

- `src/core/**` stays pure. Standing, regard and army positions are replay-stable state; nothing
  reads wall-clock time or `Math.random()`.
- **There remains exactly one combat model.** A field battle feeds `createEncounter` the same way an
  assault does, stepped at the same fixed `dt`, so auto-resolve and playable battles cannot drift.
- The home region stays unlosable. Whatever diplomacy can do, it must not produce a state with zero
  player regions and no legal move.
- Diplomacy is authored content plus pure rules. No power's disposition is read from a model, a
  scene, or a UI component.
- Adding a power changes `GameState`'s shape, so every such stage ships a save migration and leaves
  existing replays reproducible or explicitly invalidated in the ledger row.

### Non-goals

- No 4X diplomacy sim: no trade routes, espionage, dynastic marriage, or per-power tech trees.
- No AI-versus-AI world simulation. Other powers react to the player; they do not fight each other
  offscreen.
- No random diplomatic events or dice-roll acceptance.
- No second combat model, second event queue, or second knowledge model.
- No new economy resource — negotiation trades what the realm layer already tracks.
- No skinned crowds. `SquadActorView` stays instanced and non-skinned (`BattleScene.tsx:496`).

## PROGRESS LEDGER

| Stage | Title | Status | Depends on |
|---|---|---|---|
| 0 | Powers replace the binary faction | NOT STARTED | — |
| 1 | Standing and regard | NOT STARTED | 0 |
| 2 | Negotiation verbs | NOT STARTED | 1 |
| 3 | Armies that march | NOT STARTED | 0 |
| 4 | Interception and field battle | NOT STARTED | 3 |
| 5 | Diplomacy on the map | NOT STARTED | 1, 3 |

# STAGE 0 — Powers replace the binary faction

**Status:** NOT STARTED · **Depends on:** —

**Goal.** Regions belong to named powers. Nothing else changes yet.

**Do.**

1. Add a `PowerId` union and a `POWERS` table in `core/data` — a handful of authored powers with a
   name, colour and seat region. The player is one of them.
2. Replace `Faction` with `PowerId` on `RegionState.owner` and anywhere else `'player' | 'enemy'` is
   stored. Keep a `isPlayer(id)` helper rather than scattering string comparisons.
3. **Audit every reader before changing the type.** At minimum: `isAttackable`
   (`core/state/game.ts:73`), `buildMapGraph`, `regionTick` and `revolt` (`core/systems/regions.ts`),
   `yieldMultiplier`/`totalYields` (`core/systems/economy.ts`), `regionVisibility`
   (`core/systems/visibility.ts`), `getRegionDossier` and `settlementCondition`
   (`core/state/settlement.ts` — its `'hostile'` reading becomes per-power), and `sim-battle.ts`.
4. Ship a save migration mapping every stored `'enemy'` to a default power, chosen from the region's
   authored owner so an existing save's map does not scramble.
5. `isAttackable` keeps its current meaning for now — not player-owned and adjacent to a player
   region. Standing gates it in Stage 1, not here.

**Tests.** Every region resolves to a valid `PowerId`; the migration maps a v-previous save without
changing which regions the player holds; `isAttackable` returns exactly what it did before for the
same inputs; a fresh state has at least two non-player powers holding regions.

**Verify.** Standard gates plus `pnpm sim:battle` — the harness's notion of "the enemy" changed, so
the curve must be re-recorded and confirmed monotonic. Load an existing save and confirm the map is
unchanged.

**Done when.** The type is gone from the codebase, every reader has been visited deliberately, and
an old save loads with an identical map.

# STAGE 1 — Standing and regard

**Status:** NOT STARTED · **Depends on:** 0

**Goal.** Each power has a disposition toward the player, with causes the player can name.

**Do.**

1. Add `diplomacy: Record<PowerId, { standing: Standing; regard: number }>` to `GameState`, where
   `Standing` is `'war' | 'truce' | 'pact' | 'alliance'`. Save migration; every power starts at war
   to preserve today's behaviour exactly.
2. Move regard in the tick from causes that already exist: taking a power's region, holding it,
   revolts, prestige, and philosophies unlocked. Thresholds in `core/data/config.ts` with every
   other tunable.
3. Gate `isAttackable` on `standing === 'war'`. **Guard the soft-lock**: a player at truce with
   every power and holding one region has no legal move. Either truces expire, or breaking one is
   always available at a regard cost — decide, and put a test on it.
4. Derive a per-power reading the way `settlementCondition` derives per-region — a pure, co-located,
   independently testable module — so UI never recomputes thresholds.
5. Emit a `GameEvent` when a standing changes; surface it in the realm history codex, which already
   exists.

**Tests.** Regard is a pure function of its inputs across the full range; standing transitions match
config; every power resolves to a valid standing on a fresh state and after migration; **the player
can always reach a legal attack**; the home region is still unlosable.

**Verify.** Standard gates plus `pnpm sim:battle`.

**Done when.** Standing exists, changes for stated reasons, gates attacks, and cannot lock the
player out of the game.

# STAGE 2 — Negotiation verbs

**Status:** NOT STARTED · **Depends on:** 1

**Goal.** The player can propose, and the answer is legible before they ask.

**Do.**

1. Add intents — `PROPOSE_TRUCE`, `OFFER_TRIBUTE`, `DEMAND_VASSALAGE` — through the normal
   Intent → Execution path. Executions re-validate: intents arriving from a replay are untrusted.
2. Acceptance is a **pure function of state**: regard, relative strength, how many of that power's
   regions the player holds, prestige. No dice roll. If variance is wanted later it goes through
   `withRng`, and the ledger row must say so.
3. **Show the calculation before the player commits.** A proposal whose answer is a hidden roll is
   noise; one whose answer is a readable sum is a decision. Expose the terms in the UI.
4. Tribute spends what the realm already tracks — prestige, elixirs, equipment, eggs. No new
   resource.
5. Vassalage is the interesting case: a vassal's regions are not the player's, but they stop being
   attackable and contribute something. Keep that contribution small enough that conquest stays the
   main line.

**Tests.** Identical state produces an identical answer every time; executions reject malformed or
impossible proposals; tribute cannot spend below zero; accepting a truce makes the target
un-attackable and the player still has a legal move elsewhere; a replay of a session with
negotiations reproduces exactly.

**Verify.** Standard gates, `pnpm sim:battle`, and `pnpm sim:replay` on a session containing at
least one accepted and one rejected proposal.

**Done when.** The player can end a war without winning it, understands why an offer failed, and the
replay harness reproduces the whole exchange.

# STAGE 3 — Armies that march

**Status:** NOT STARTED · **Depends on:** 0

**Goal.** Forces occupy space and move through it over time.

**Do.**

1. Add `marchingTo: string | null` and `arrivesAtTick: number | null` to `Squad`. Save migration;
   existing squads load as stationed and idle.
2. Resolve arrival in the tick, inside the existing region phase. **Do not reorder the phases in
   `executeNextTick`** — order is intents → economy → sanctuary → regions, and changing it
   invalidates every replay and save.
3. March duration comes from the region graph, not from world-space distance — the map is a graph
   and adjacency is already the rule that governs attacks.
4. A marching squad suppresses no unrest and defends nothing. That is the cost, and it makes
   garrisoning a real choice rather than a default.
5. Give other powers the same mechanism. They need not be clever; they need to be visible and
   consistent.

**Tests.** Arrival is deterministic from `(departTick, from, to)`; a marching squad contributes zero
suppression in `regionTick`; a squad whose destination is lost mid-march resolves somewhere valid
rather than vanishing; replays reproduce every arrival.

**Verify.** Standard gates plus `pnpm sim:battle` — suppression changed, so unrest and therefore
economy changed.

**Done when.** Armies leave, take time, arrive, and the map can show them in transit.

# STAGE 4 — Interception and field battle

**Status:** NOT STARTED · **Depends on:** 3

**Goal.** Two forces in the same place at the same tick fight, without a second combat model.

**Do.**

1. Detect co-location in the region phase and hand it to `createEncounter` exactly as an assault
   does. **This is presentation-neutral**: the same encounter must auto-resolve and play identically.
2. A field battle has no garrison and no fortification, which is what distinguishes it from an
   assault — and it is the natural counterpart to the contested-ground work in
   `docs/INHABITED_WORLD_PLAN.md` Stage 3.
3. Losers retreat toward a friendly region rather than being deleted, so a field defeat is a setback
   and not an instant loss of an army.
4. Emit the outcome through the existing event stream; the realm history codex records it.

**Tests.** Auto-resolve and playable battle produce identical outcomes for identical inputs;
interception is symmetric (whoever detects it, the same battle happens); a retreat always lands
somewhere legal; existing replays still reproduce.

**Verify.** Standard gates and `pnpm sim:battle`, recorded before and after. Field battles are a new
way to lose troops, so watch the curve carefully.

**Done when.** Armies can meet away from a region assault, and there is still exactly one combat
model in the codebase.

# STAGE 5 — Diplomacy on the map

**Status:** NOT STARTED · **Depends on:** 1, 3

**Goal.** The map shows whose the world is, and where forces are going.

**Do.**

1. Territory colour encodes **which power**, not player/not-player. `MAP_STATUS_COLORS` in
   `nodeVisuals.ts` currently has three player-relative states; extend it without losing the
   reachable/locked reading the player already relies on.
2. **Add a diplomacy layer to the existing `AtlasLayerId` system rather than building new
   machinery** — seven switchable layers already exist, and standing is a natural eighth.
3. Draw marching armies as tokens in transit between nodes. Per-frame transforms mutate `object3D`
   directly; never `setState` in `useFrame`.
4. All in-world text goes through `render/labels/WorldLabel.tsx`. `drei`'s `<Text>` still kills the
   WebGL context in WebKit.
5. Surface standing in the region dossier beside the settlement condition, so the directory and the
   map agree.

**Tests.** Every power resolves to a distinct colour; the layer renders for all 22 regions; token
positions are derived, never stored in `GameState`; no store setter fires from a per-frame loop
without a change guard.

**Verify.** Standard gates. Live check at world-map camera distance that powers are distinguishable
and that transit is readable — and check it against the settlement conditions from
`INHABITED_WORLD_PLAN` Stage 0, which share the map surface and must not collide visually.

**Done when.** A player can read the political state of the world from the map alone.

---

## Closing this plan

Close it per the convention the other plans use: when every ledger row is DONE, fold durable process
into the relevant contract docs and keep this document as the historical work-order record.
