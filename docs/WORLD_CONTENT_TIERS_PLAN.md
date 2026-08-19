# World content tiers — staged work orders

**Status: PLANNED — Stage 0 is eligible now.**

This is the *content* half of a two-document split; the systems half is
`docs/POWERS_AND_ARMIES_PLAN.md`. **Nothing here depends on anything there**, which is the point of
the split: asset and authoring work should not queue behind a change to `Faction`.

The problem it addresses is concrete. Seventeen biomes are dressed from a 26-prop atlas, and
`prop.biome.landmark.*` holds exactly four entries — hut, obelisk, shrine, well. Four landmarks
spread across seventeen biomes is why regions sharing a biome still read as the same place, and no
amount of scatter variation fixes it. Meanwhile the external library
(`docs/EXTERNAL_MODEL_INDEX.md`) holds multi-node prop packs and hero-scale ruins that would fill
the gap, and the hero rig carries seven clips — idle, walk, run, offer, pet, calm, inspect — every
one an animal-care verb.

**The organising idea is that not all props are the same kind of thing.** Scatter is instanced,
repeated, and lives on a tight triangle budget. A landmark appears once per region and can afford
ten times as much. A fortification is a place with tactical meaning. A stage set is a scene the
player is delivered into. Treating all four as "biome props" is what keeps the budget tyrannical
and the world repetitive.

---

## HANDOFF PROTOCOL

1. Read `CLAUDE.md`, `docs/BIOME_SYSTEM.md`, `docs/BIOME_LIBRARY.md`, `docs/EXTERNAL_MODEL_INDEX.md`
   and this document.
2. Take the first ledger row not marked DONE and do only that stage.
3. **No asset enters `public/models` without licence evidence in `CREDITS.md`.** The builder refuses
   an unapproved prop, and a new `biome-library.json` entry starts at `pending` for that reason.
   Several library files carry vendor-marketing names (`free_-`, `demo_free`, `ga_free_`) that
   usually imply attribution or non-redistribution terms.
4. Source from the **highest-resolution variant**, which is not reliably the one without a `(N)`
   suffix — 51 of 63 variant groups have `(1)` as the master and 12 do not. Check
   `preferredFile` in `docs/EXTERNAL_MODEL_INDEX.json` rather than guessing.
5. Convert spec/gloss sources first (`gltf-transform metalrough`) or they render as untextured white
   blobs. Disable scene-graph rewrites for anything skinned.
6. Run the stage checks and the standard gates:

   ```bash
   pnpm assets:validate-biome-atlas && pnpm typecheck && pnpm lint && pnpm test
   ```

   `pnpm sim:battle` is **not** required here unless a stage touches resources or combat — none
   should. If a stage makes you want to run it, that stage has probably left its lane.

## PRODUCT CONTRACT

- **Regions sharing a biome read as different places**, because their landmarks differ, not because
  their scatter is shuffled.
- **A landmark is worth walking to** — silhouette visible from the arrival point, detail that
  rewards arrival.
- **Props stay cosmetic.** Collision, discovery, rewards and combat authority live in `core`; nothing
  is read from a loaded model.
- **Budgets hold.** Instanced scatter stays affordable at `BIOME_WORLD_RADIUS = 110 m`; landmark
  spend is bounded by appearing once.
- Missing optional assets degrade to existing procedural or atlas art and never kill the canvas.
- One world unit remains one metre.

### Non-goals

- No second biome renderer, no infinite procedural world, no per-instance scatter in `GameState`.
- No new discovery or knowledge model — landmarks dispatch the World Atlas intents that already
  exist.
- No gameplay authority moving into assets.
- No raising the scatter triangle budget to fit a prop. Decimate the prop.
- No player combat animation on the hero rig until the fight/command question in Stage 3 is settled.

## PROGRESS LEDGER

| Stage | Title | Status | Depends on |
|---|---|---|---|
| 0 | The decimation lane | NOT STARTED | — |
| 1 | Landmark tier | NOT STARTED | 0 |
| 2 | Scatter pack expansion | NOT STARTED | 0 |
| 3 | Hero rig vocabulary | NOT STARTED | — |
| 4 | Fortification and stage sets | NOT STARTED | 0, 1 |

Stages 3 is independent of every other row and can be taken at any time.

# STAGE 0 — The decimation lane

**Status:** NOT STARTED · **Depends on:** —

**Goal.** A repeatable pipeline that turns a hero-scale source into a budgeted game asset, so later
stages are asset selection rather than asset engineering.

**Do.**

1. Build a `gltf-transform` chain as a script beside `build-biome-atlas.mjs`:
   `metalrough` → `weld` → `simplify` → `resize` → texture compress → geometry compress. Expose the
   target triangle count and texture size per asset, not globally.
2. **Feed it the 4K master, not the 1K downscale.** You are decimating geometry and want the best
   source to bake normal detail from; the resize at the end of the chain returns you to a sane
   runtime size regardless.
3. Prove it on the eight ~1.9M-triangle scans catalogued in `docs/EXTERNAL_MODEL_INDEX.md`. Those
   are one material and three textures each — all their detail is in geometry a decimated mesh plus
   a baked normal map carries just as well.
4. Report what each conversion cost: source triangles, output triangles, source and output bytes,
   texture dimensions. A silent pipeline is how a 146 MB rock set ships.
5. Consider KTX2 (`KHR_texture_basisu`) for the largest outputs. WebP shrinks the download but
   decodes to raw RGBA in VRAM; KTX2 stays compressed on the GPU, which is 4–8× less video memory
   and matters because a tab that exhausts VRAM loses the WebGL context rather than slowing down.
   It needs the Basis transcoder served locally and a loader wired in, so it is a real cost — take
   it for the big assets, skip it for the 15 KB Draco props.

**Tests.** Output triangle counts are at or under the requested budget; every output declares no
spec/gloss extension; a skinned input keeps its skeleton and clip names intact (the scene-graph
rewrites are off); the report file is written for every conversion.

**Verify.** `pnpm assets:validate-biome-atlas` on any atlas rebuilt through the lane, plus the
standard gates. Inspect one converted hero prop at true scale in `/biomes` against the 1.6 m figure.

**Done when.** A 1.9M-triangle source becomes a budgeted, correctly-materialled GLB in one command,
with a report saying what it cost.

# STAGE 1 — Landmark tier

**Status:** NOT STARTED · **Depends on:** 0

**Goal.** Every region has a landmark that distinguishes it from every other region sharing its
biome.

**Do.**

1. Treat landmarks as a **separate budget class** from scatter. They appear once per region, so they
   can afford roughly an order of magnitude more geometry than an instanced tuft. Make that explicit
   in `biome-library.json` rather than implicit in whoever authored the entry.
2. Expand `prop.biome.landmark.*` well beyond its current four. Candidates already catalogued:
   `temple_ruins_asset_pack` (77 primitives), `ancient_temple_modular_kit` (42 primitives, 19
   materials), `crumbling_stone_watchtower`, `overgrown_courtyard_patio_ruin`,
   `floating_rune_monolith`, `violet_crystal_formation`, `early_buddhist_shrine`, `tomb-entrance`.
   The last is Draco-compressed at under 15 KB and needs no processing at all.
3. **Modular kits are worth more than single meshes.** A 42-primitive temple kit yields many
   distinct landmark compositions from one licence and one atlas entry; a single hero mesh yields
   one. Prefer kits where the choice exists.
4. Bind landmarks to regions through the authored atlas data that `BIOME_ENHANCEMENT_PLAN` Stage 1
   already established — a landmark is an id, transform, approach radius and label, never a guessed
   mesh name. **Do not build a second discovery model**; dispatch the existing World Atlas intent.
5. Give each a readable approach: visible in silhouette from the arrival point, with clearance that
   does not close a navigable corridor.

**Tests.** Every region resolves to at least one landmark; ids are unique and reference approved
props; landmarks seat on terrain and preserve arrival clearance; discovery stays idempotent; a
missing prop falls back without crashing.

**Verify.** Atlas gates and standard gates, then walk and fly the approach in at least three regions
sharing one biome and confirm they read as different places.

**Done when.** No two regions sharing a biome are mistakable for each other.

# STAGE 2 — Scatter pack expansion

**Status:** NOT STARTED · **Depends on:** 0

**Goal.** More vocabulary in the scatter layers, without raising the per-biome cost.

**Do.**

1. Prioritise **multi-node packs**, which yield several atlas entries per approved file:
   `oak_trees` (198 primitives), `stylised_rocks_asset_pack` (184),
   `autumn_forest_asset_extra_low_poly` (70), `cave_rocks`, `gnarly_trees`, `ancient_tree`.
2. Note that `gnarly_trees`, `rocks_set2` and `grass_patches` are already atlas sources and carry
   spec/gloss; the current builder handles them (the shipped `biomes.glb` declares only
   `EXT_texture_webp` and its materials carry real base-colour textures), but any *new* spec/gloss
   source must be converted deliberately rather than assumed.
3. Hold the density budget: large silhouettes well under 30 per biome, ground scatter under 60.
   New vocabulary means **more kinds**, not more instances.
4. Give the thinnest biomes their own layers first. A biome whose dressing is three entries reads as
   empty regardless of how good those three are.
5. Keep placement deterministic and index-derived in `biomeScatter.ts`. Revisiting never reshuffles.

**Tests.** Atlas triangle and material budgets hold; every biome's layer list references existing
props; placement is identical for the same seed and region across remount and reload.

**Verify.** `pnpm assets:validate-biome-atlas`, standard gates, and a per-biome pass in `/biomes`.

**Done when.** Every biome has enough vocabulary that its scatter does not read as one prop repeated.

# STAGE 3 — Hero rig vocabulary

**Status:** NOT STARTED · **Depends on:** —

**Goal.** The player character can do the things the game is about to ask of them.

**Do.**

1. **Establish the baseline before authoring anything.** Confirm whether a rider mesh is drawn on
   the wyvern in flight — `BiomeFlightActor` mounts the animation rig, which is not the same
   question. If there is no visible rider, a mount / dismount / ride-idle set is the highest-value
   addition on this rig and everything else waits behind it.
2. Add a social set for negotiation: a talk/listen idle, an offer gesture, a refusal. Check whether
   the existing `offer` clip — authored as a food offering — retargets to tribute before capturing a
   new one.
3. **Settle whether the player fights or commands before authoring any combat clip.** Commanding is
   a UI verb and needs nothing on this rig. Personal combat needs attack, hit-react and death, and
   it is a much larger commitment in both capture and design. This decision belongs to the user, not
   to whoever takes this stage.
4. The library's humanoid rigs — `paladin`, `strong_knight`, `ga_free_901_fantasy_villager`,
   `samurai_warrior` — ship one idle clip each. They are **not** hero-rig material, but one idle is
   exactly enough for an envoy or bystander standing in a parley scene. Route them that way.
5. Extend `manifest.ts`'s `character.player` entry with the new clips. Adding an animation is a
   manifest edit; it should touch no scene code.

**Tests.** Every declared clip resolves in the loaded GLB; one-shot clips are `loop: false` (a
looping one-shot on the action channel plays forever and pins the state under it); the manifest
contract test covers the new entries.

**Verify.** Standard gates, plus a live check in the sanctuary and a biome at runtime scale.

**Done when.** The rig covers the verbs the shipped and planned features actually ask for, and the
fight-or-command question is answered in writing.

# STAGE 4 — Fortification and stage sets

**Status:** NOT STARTED · **Depends on:** 0, 1

**Goal.** Places built by people, for the moments that need them.

**Do.**

1. Build a fortification vocabulary — gates, wall lines, watchtowers — from
   `frontier_fortifications`, `ancient_fortress_asset_pack_-_part_2`,
   `gothic_structures_-_round_version`, `crumbling_stone_watchtower`, and
   `siege_at_night_medievalremixchallenge` mined for parts.
2. These serve two consumers at once: the settlement silhouettes of `INHABITED_WORLD_PLAN` Stage 0
   and the contested ground of its Stage 3. **Author once, and check the scale against both** — a
   settlement on the world map is sized against its node cap, not to architectural scale, and the
   same mesh in a biome is at true metres. That mismatch has already bitten once.
3. Build one parley stage set: a tent pitched between two forces, or a hall. Candidates —
   `medieval_market_tent_prop_01`, `tent_tribal_guard`, `pearl_inlaid_throne`, `dragonstone_throne`,
   `noble_columns`, `fantasy_table`. This is a single authored scene, not scatter, so it is cheap.
4. The stage set has no dependency on the diplomacy systems and should not wait for them. A scene
   the player can be delivered into is useful before there is anything to negotiate.
5. Keep every one of these cosmetic. A gate that constrains an assault does so because
   `core/combat` says so, never because a mesh is in the way.

**Tests.** Atlas budgets hold; fortification props resolve at both world-map and biome scale;
the stage set loads without an active negotiation system present.

**Verify.** Atlas gates and standard gates. Inspect at true scale in `/biomes`, and on a map node at
world-map camera distance.

**Done when.** There is a visual vocabulary for defended places and for a meeting, ready for the
systems that will use them.

---

## Closing this plan

Close it per the convention the other plans use: when every ledger row is DONE, fold durable process
into `docs/BIOME_LIBRARY.md` and the relevant contract docs, and keep this document as the
historical work-order record.
