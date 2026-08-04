# CLAUDE.md

Wyvern3D — a 3D browser game: raise and train wyverns at a sanctuary, then use them plus armies to
conquer regions on a world map. Next.js + react-three-fiber. Mechanics work end to end. The
sanctuary uses a curated low-poly scenery atlas and wyverns use a real skinned model; units, the
world map, and battle terrain still use procedural placeholders until their model pipelines are
wired.

## Start here

| I want to… | Go to |
|---|---|
| Change balance, costs, timings | `src/core/data/config.ts` — every tunable number is here |
| Add/edit content (species, regions, units, buildings, stations) | `src/core/data/*.ts` |
| Change what a player can *do* | `src/core/intents/index.ts` then `src/core/executions/index.ts` |
| Change what happens each tick | `src/core/systems/`, dispatched by `src/core/state/tick.ts` |
| Change how battles play out | `src/core/combat/encounter.ts` (+ `ai.ts`) |
| Wire up a real 3D model | `src/render/assets/manifest.ts` — one line, nothing else |
| Develop or review wyvern flight animation | `docs/WYVERN_ANIMATION_BASELINE.md`, then `docs/FLIGHT_ANIMATION_DEVELOPMENT.md` |
| Know what an animation actually measures | `validation/wyvern-animations/clip-signatures.json`; regenerate with `pnpm assets:analyze-clips` |
| Edit a clip on the new `WyvernRig` (wing axes, loop seams) | `docs/WYVERN_CLIP_AUDIT.md`; check with `pnpm assets:wyvern-audit` and `pnpm assets:validate-wyvern` |
| Add/swap a static scenery prop | `scripts/asset-sources.json`, then run `scripts/extract-assets.py` |
| Make a prop placeable in the sanctuary editor | `PROP_CATALOG` in `src/core/state/sanctuaryLayout.ts` |
| Change how sanctuary wyverns move or behave | `src/scenes/Sanctuary/director/wyvernDirector.ts` |
| Add a sanctuary player command | `src/state/sanctuaryCommands.ts`, then the director + `SanctuaryCommandWheel` |
| Change a scene's look | `src/scenes/{Sanctuary,WorldMap,Battle}/` |
| Change HUD/panels | `src/ui/` (DOM overlay, not in-canvas) |

## The invariant: `src/core/**` is pure

No `three`, no `react`, no `zustand`, no `Math.random()`, no `Date.now()`. A lint rule enforces this
and it genuinely fires — don't work around it, and don't add an eslint-disable.

Four things depend on it:

1. **Auto-resolve is the same code as a playable battle.** `createEncounter` is stepped at the same
   fixed `dt` either way; the only difference is whether a human is piloting. There is exactly one
   combat model, so the two paths cannot drift apart in balance.
2. **Headless testing and the balance harness.** Thousands of fights run in Node in under a second.
3. **Replays.** `(seed, intentLog)` reproduces a session exactly.
4. **Assets stay cosmetic.** Collision radii, ranges, speeds live in `core/data` and are never read
   from a loaded model.

Corollaries when editing core:
- All randomness goes through `withRng(state, …)` / `createRng(seed)`. Never `Math.random()`.
- Time is a tick parameter. Wall-clock reads belong in the save envelope, not `GameState`.
- Ids come from `nextId(state, prefix)` — a monotonic counter, not a uuid.
- **Never reorder the phases in `executeNextTick`.** Order is intents → economy → sanctuary →
  regions. Changing it changes outcomes and invalidates every existing replay and save.

## Intent → Execution

UI and input never mutate state. They emit an **Intent**; the tick turns it into an **Execution**,
and only Executions write to `GameState`. Executions re-validate their input — intents arriving from
a replay are untrusted.

Adding a player action means: add to the `Intent` union → add a case in `execute()` → call
`dispatch(intent)` from the UI. Don't shortcut by mutating state from a component.

## Where sanctuary behaviour lives

The sanctuary splits across the purity boundary, and the split is deliberate:

- **`core`** owns what must survive a save and a replay: `sanctuaryLayout` (placed objects and
  stored inventory), each wyvern's `assignment` and optional `preferredPerchIndex`, and the
  `ADD/MOVE/ROTATE/STORE_SANCTUARY_OBJECT` and `RESET_SANCTUARY_LAYOUT` intents. `PROP_CATALOG` in
  `core/state/sanctuaryLayout.ts` is the list of everything placeable, and a catalogue entry can
  carry `station`/`panel`/`radius`, which is how a placed prop becomes an interactable.
- **Outside core** owns everything per-frame: `scenes/Sanctuary/director/wyvernDirector.ts` drives
  position, yaw, phase and `ModelState` for every sanctuary wyvern; `director/spatialAwareness.ts`
  aims heads at the player and neighbours; `state/sanctuaryCommands.ts` is a zustand queue of
  player orders with a phase machine (`settled → approachingPlayer → takeoff → transit → …`);
  `scenes/Sanctuary/commandLogic.ts` holds the pure placement/validity helpers it uses.

Wyvern positions are **not** in `GameState` — a 1 Hz tick, the replay surface and save bloat all
argue against it, and `assignment.kind` is already the behaviour selector.

Cosmetic randomness there — which ambient idle a settled wyvern picks, seeded scenery scatter — uses
a local `createRng(deriveSeed(seed, …))` off the save seed, **never** `Math.random()` and never the
tick path's `withRng`. Drawing from `withRng` would advance `state.rngState` from a render loop and
desync every replay. Ambient weights read `hunger`, `injury` and `bond` but write nothing back.

Editor UI state
(`state/sanctuaryEditorStore.ts`) and the ground/soil/roost colours
(`state/sanctuaryColorsStore.ts`, localStorage) are cosmetic and deliberately stay out of the save.

Placing an object goes through the normal Intent → Execution path; the save is at version 2, whose
migration spreads a legacy sanctuary into the campus layout without moving anything the player has
already placed.

## Non-obvious traps (all of these have already bitten)

- **Never `setState` in `useFrame`.** Per-frame values mutate `object3D` transforms directly. The
  sim's actor positions never enter React state.
- **`drei`'s `<Text>` kills the WebGL context in WebKit** — the whole canvas goes blank the moment
  one label mounts. Use `render/labels/WorldLabel.tsx` (canvas-texture sprite) for all in-world text.
  `/webgl-probe` is a kept diagnostic route for bisecting this class of failure.
- **Instanced skinned meshes don't work in WebGL three.js.** Squads are ~10 instanced *non-skinned*
  figures standing in for a 50-troop squad. Only wyverns (few) are skinned.
- **Clone skinned models with `SkeletonUtils`**, never `scene.clone()` — the latter silently breaks
  skeletons once a second copy exists. `GameModel.tsx` owns skinned entity models.
- **A spec/gloss source GLB renders as an untextured white blob.** three.js dropped
  `KHR_materials_pbrSpecularGlossiness`, and such a source keeps its colour maps *inside* that
  extension, leaving `pbrMetallicRoughness` empty. The model loads, skins and animates perfectly —
  it is just white, which reads as a lighting bug rather than a material one. Run
  `gltf-transform metalrough` before compressing. `scripts/rebuild-drogon.py` does this.
- **A material override must clone the material first.** `SkeletonUtils`' clone keeps pointing at the
  cached source scene's materials, so assigning to one in place repaints every model sharing that
  GLB — and all five species share one file.
- **Static scenery has a separate atlas path.** `render/assets/props.tsx` also calls `useGLTF`, but
  bakes static node transforms and draws repeated props with `InstancedMesh`. Do not route skinned
  creatures through it or clone hundreds of scenery nodes through `GameModel`.
- **Load the static atlas before mounting `<Canvas>`.** `GameCanvas` calls `usePropAtlas()` outside
  the R3F root so suspension happens in the DOM loading boundary. Moving the first atlas load back
  inside an already-mounted canvas loses the WebGL context on affected browsers.
- **GLTFLoader sanitizes `Object3D.name`.** Dots disappear from names such as `prop.keep.wall`;
  static prop lookup must use the authored name preserved in `object.userData.name`.
- **`three-stdlib` is not importable** under pnpm's strict layout (it's a transitive drei dep). Use
  `three/examples/jsm/...` instead.
- **React must stay pinned to `19.2.x`** — `@react-three/fiber`'s peer range is `>=19 <19.3`.
- **The store mutates `GameState` in place** and bumps a `revision` counter. Object-returning
  selectors are always reference-equal and will never re-render — use `useGameState()`, which
  subscribes to `revision` and reads the live state.
- **A store setter called from a per-frame loop must no-op when nothing changed.** `uiStore.setNearby`
  compares ids and returns the previous state otherwise; without that guard the whole HUD re-renders
  every frame. Same rule as never-`setState`-in-`useFrame`, one level further out.
- **Battle presentation frame-diffs the sim; it never adds events to it.** Attack and breath tells
  come from watching `actor.cooldown` / `actor.breathCooldown` jump back up, and death fires once on
  the falling edge of `actor.alive`. The one exception is `Actor.hitThisTick`, which is explicitly
  presentation-only and never read by the sim. Keep it that way — an event queue in the encounter
  would have to be replay-stable.
- **Every clip the action channel plays must be `loop: false`.** `GameModel` emits
  `onActionFinished` for one-shots only, and that callback is the sole way a tell gets cleared, so a
  looping spec there plays forever and pins the base locomotion state under it. Both `attack` and
  `breathe` shipped defaulting to looping; `breathe` was the worse one, because `BreathVFX` restarts
  its burst for as long as `action?.state === 'breathe'`, so one breath attack left the fire running
  permanently. `manifest.action-channel.test.ts` locks it.
- **Wing bones mirror on `Z`, not on `X`.** Local +X raises *both* wings (symmetric); local +Z sweeps
  them in *opposite* directions, so a mirrored pose must negate `Z` on the right side. Giving both
  wings the same `Z` folds one forward across the chest and the other back, and it is nearly
  invisible on a near-black model — seven of the sixteen clips shipped that way, `rest` at 116.8
  degrees apart. See `docs/WYVERN_CLIP_AUDIT.md`; `pnpm assets:validate-wyvern` catches it.
- **The home region must never be losable.** Attacking requires an adjacent owned region, so losing
  it is an unrecoverable soft-lock. It is exempt from unrest, with a test guarding it.

## Scenes

One persistent `<Canvas>`; scenes swap on a store field (`mode`), **not** Next routes — routing would
tear down the WebGL context and stall the world clock on every transition. The clock itself is a
plain rAF loop at the app root (`state/GameClock.tsx`), outside R3F, so the world keeps simulating
regardless of which scene is mounted.

## Commands

**Use `pnpm` for all package installs and scripts.** Do not use `npm`, `yarn`, or `bun`; the
repository's lockfile and strict dependency layout are pnpm-managed.

```bash
pnpm dev
pnpm typecheck                      # strict
pnpm lint                           # includes the core-purity + determinism gates
pnpm test                           # core and render-side unit tests, plus the animation gate
pnpm sim:battle [runs]              # balance harness: win rate per region per loadout
pnpm sim:replay <replay.json> [n]   # replay a session and assert determinism
```

Before claiming a change works: `pnpm typecheck && pnpm lint && pnpm test`. For anything touching
combat or economy, also run `pnpm sim:battle` and check the curve is still monotonic.

## Verifying in the browser

Use the preview tools, not `pnpm dev` in a raw shell. A dev-only handle is exposed during battles:

```js
__wyvern.actors.map(a => [a.id, a.side, Math.round(a.hp), a.position])
```

Held keys need synthetic events (`keydown`, wait, `keyup`) — a single click-press moves one frame's
worth and looks like nothing happened.

## Current state

Working end to end: walkable sanctuary with station interactions, world map with the region graph,
playable and auto-resolved battles, egg/breeding/taming acquisition, training, economy, unrest,
save with offline catch-up and migrations.

On top of that base: a sanctuary layout editor (place, move, rotate, store and reset props from
`PROP_CATALOG`, with grid snap and ground/soil/roost recolouring), a per-wyvern command wheel
(feed, pet, calm, find food, take off, land, attack, return, circle, follow, soar, hover) driven by
the director, a quick-level widget reading the level/stat helpers in `core/entities/wyvern.ts`,
camera presets and sensitivity in `state/cameraStore.ts`, and a HUD hide toggle for clean captures.

The sanctuary is dressed with the generated `public/models/sanctuary.glb` atlas. Its source mapping
and extraction settings live in `scripts/asset-sources.json`; rebuild it with
`python3 scripts/extract-assets.py`. See `CREDITS.md` for third-party asset attribution.

Wyverns render from `public/models/drogon.glb` (15 MB, meshopt + WebP, 52 clips, 39 k tris) in both
the sanctuary and battle. `GameModel` plays whichever clip the manifest maps to the requested
`ModelState`, crossfading between them; the compression recipe is documented at the top of
`manifest.ts` and automated by `scripts/rebuild-drogon.py`. All five species share this one model and
differ by `scale` — swapping in per-species models is a manifest edit and touches nothing else. The
near-black surface comes from a cosmetic `material` override in the manifest, applied to cloned
materials at load; it is the one place to art-direct the finish without rebuilding the GLB.

`docs/WYVERN_ANIMATIONS.md` catalogues all 52 clips with measured frame counts, ground clearance,
loopability and a rendered pose sheet, and stages the animation work. Read it before mapping a new
`ModelState`: none of the clips carry root motion, four are additive delta poses that bury the model
if played as states, and roughly half are one-shots. A manifest `ClipSpec` therefore carries `loop`
and `next` — `fly` plays the one-shot takeoff and chains to an internal `airborne` loop when the
mixer reports it finished, so gameplay keeps asking only for `fly`. It also carries its own
`yOffset`, because each pose reaches a different distance below the rig origin; one number per asset
plants exactly one clip. Compatible loops may share a `phaseGroup`, preserving normalized playback
time through a crossfade; the cruise and bank loops use it so steering never restarts a wingbeat. A state
can map to an array of clips, chosen by `GameModel`'s `seed` prop, which is how perched wyverns avoid
idling in lockstep.

`docs/WYVERN_ANIMATION_BASELINE.md` is the measured capability envelope: what the rig demonstrably
does across all 52 artist clips, how the authored sidecar clips were built out of that, and the
numeric review loop that replaced image review. `docs/FLIGHT_ANIMATION_DEVELOPMENT.md` is the quality
and workflow contract on top of it. Read both before authoring a clip or changing flight-state logic,
procedural attitude, model bounds, or a flight camera.

Sanctuary-only animation additions live in the meshless
`public/models/drogon-sanctuary.glb` sidecar, not in the vendor GLB. Its twenty-six
short-name actions cover sleep, sit/seated/rise, eat, drink, groom, perch-grip,
cruise, scout, mirrored banks, hover, speed, glide, dive, nuzzle, calm, and the
hunt grip/carry/finish sequence. Rebuild it with
`pnpm assets:drogon-sidecar`; the build rejects meshes, skins, renamed nodes,
and any animation target absent from `drogon.glb`.
`pnpm assets:validate-sidecar` additionally parses and binds all clips through
three.js and checks every looping track's endpoints.

## Animation development contract

Treat flight as a family of modes, not one `flying` loop. Hover, takeoff, cruise,
bank, and landing have different torso axes, leg carriage, neck intent, tail
jobs, wing cadence, bounds, and camera requirements. Define those before
authoring wing keys.

Layer flight in this order: authored primary body posture → authored propulsion
cycle → authored directional deformation → procedural pitch/whole-model bank →
camera response. Procedural attitude must not compensate for the wrong base
posture, and bank clips must not bake a second whole-body roll. Compatible
cruise loops share `phaseGroup: "flight"` so steering preserves wingbeat phase.

**Review is numeric, not visual.** `pnpm assets:analyze-clips` measures all 74
clips in Blender, headless, in ~20 s, into the committed
`validation/wyvern-animations/clip-signatures.json`; `pnpm test` asserts it
against `clip-contracts.json`, whose per-mode thresholds each name the vendor
clip they were derived from. A change to a clip therefore lands as a readable
per-channel diff. Contact sheets remain available and are not the gate — a
near-black dragon hides pose in a render, and two sheets cannot be compared,
which is how a cruise loop with a 27.3° stroke, 37.7 left/right asymmetry and no
detectable wingbeat shipped past a reviewed sheet.

Any primary posture or bounds change still requires battle/sanctuary live checks
at actual runtime scale. If a body, wing, or tail extends farther from the
origin, review the camera in the same change. The full authoring, validation,
promotion, and definition-of-done checklist is in
`docs/FLIGHT_ANIMATION_DEVELOPMENT.md`.

## Animation work in flight

`docs/WYVERN_ANIMATION_PLAN.md` is an **open handoff document** staging the rest of the animation
work as self-contained work orders. If you are picking up animation or sanctuary-behaviour work,
read the development contract first, then take the first stage in the plan ledger not marked DONE.
Do only that stage, then update its ledger row with the code. Close the plan per its own instructions
once every stage is DONE; durable process belongs in the development contract, measured asset facts
belong in `clip-signatures.json` and `docs/WYVERN_ANIMATION_BASELINE.md`, and the plan remains the
historical work-order record.

Landed since the plan opened: sanctuary placement, travel and landing, the sidecar clip pipeline,
head gaze, the ambient idle scheduler (sleep/sit/groom/eat/drink/perch, weighted by hunger, injury
and bond), the flight-mode selector — `flightAnimationState` picks
dive/glide/hover/bank/scout/speed/cruise from measured motion, each on its own hysteresis band — and most of battle
readability — hit flash, a reachable death, attack and breath tells through the action channel,
fire-breath VFX, and a mixer-LOD `frozen` prop that stops distant wyverns advancing their pose.
`GameModel`'s `onReady` callback hands back the cloned root, which is the seam for reaching one
instance's materials or bones without going through the manifest.

Gaps the ledger still records, in case you trip over them first:

- **Fire breath's impact point is a placeholder.** It does render now —
  `render/vfx/BreathVFX.tsx` is a skull-following, range-matched scaffold of layered procedural
  flame sheets, deterministic ember/smoke pools and one mouth light, wired into battle and the
  Flight Lab. What it cannot do is show where the fire actually *lands*: `core/combat` stays the
  only hit authority and exposes no impact positions, so the range-end burst sits at
  `breathRange` rather than on whatever it hit. A combat-event stream would be the fix, and it
  would have to be replay-stable.
- **`Actor.flying` is assigned once and never mutated**, so battle wyverns can never land and the
  `walk` / landing clips are unreachable there. Landing *is* reachable in the sanctuary, which has no
  `Actor` at all.
- **The flight modes have no authored transitions between them.** Only cruise and the two banks
  share `phaseGroup: "flight"`. Hover is four beats to cruise's three in the same six seconds; speed
  is four in five; and the two held clips have no wingbeat cycle at all — so every other handoff is
  a plain crossfade rather than a phase-preserving one. Authoring those transitions is the next
  meaningful step, and it is what `scout` would build on.
- **Bank is a peer of the other modes, not a modifier.** `FlightLoopState` maps straight to one
  clip, so there is no authored inside-wing deformation while diving or at speed; the runtime's
  whole-model roll still banks them. Real bank variants would need a clip product.
- Stage 6 (world event stream and flourishes) is not started.

Known gap: the balance harness reports near-binary outcomes (100%/0%) — the curve is correctly
ordered but damage variance is low, so fights are decisive rather than close. Tune in
`core/data/config.ts`; no other file should need to change.

## Coding Contributors

This project is co-developed by human maintainers and AI coding agents:
- **Antigravity** (Google DeepMind)
- **Claude** (Anthropic)
- **Codex** (OpenAI)

