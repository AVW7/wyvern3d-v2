# External model index — `~/Desktop/world build` + `~/Desktop/3d models animals`

Generated 2026-08-19. Machine-readable companion: `docs/EXTERNAL_MODEL_INDEX.json`
(every asset with MB, triangles, primitives, materials, textures, joints, clip names,
glTF extensions). This is a *survey* of what is on disk, not an approval list —
licence evidence still goes in `CREDITS.md` before anything reaches `public/models`.

**211 GLB files, 7.3 GB, 130 distinct assets in 63 texture-resolution variant groups.**

The same-name files are *not* redundant copies. In all 63 groups the geometry is
byte-for-byte identical in triangle count, primitive layout and material list — what
differs is **texture resolution**: a 4096px or 2048px master alongside a 1024px
downscale. Only 5 groups are true byte-identical duplicates, totalling **313 MB**.
The other 1.78 GB held in the lower-res members is a real LOD ladder you may want to
keep, not waste.

**The `(N)` suffix is not a quality signal.** In 51 of 63 groups the `(1)` file is the
higher-res master; in 12 groups it is the opposite and the base name wins:

`ancient_horse_chariot_mauryan_era` · `clearwing_swallowtail` ·
`drogon__game_of_thrones_dragon` · `elephant` · `fire_dragon` ·
`ga_free_901_fantasy_villager_1.0` · `game_ready_carpet` ·
`guineafowl-realistic-3d-model-temprit` · `horse_-_realistic_3d_model_demo_free` ·
`retropc_chess` · `rocks_set_3` · `temple_ruins_asset_pack`

Anything referencing these files by name must be measured, not guessed. The JSON index
carries `preferredFile`, `variants[].maxTexturePx` and a short md5 per member for exactly
this reason — `drogon__game_of_thrones_dragon.glb` (2048px) is the master and
`drogon__game_of_thrones_dragon (1).glb` (1024px) the downscale, which is worth checking
against whatever the wyvern pipeline currently reads.

Spread of the masters: **23 groups top out at 4096px, 40 at 2048px.** The extremes are
`travelers_flask_relic_of_the_wilds` (4096px, 43.6 MB vs a 5 MB 1024px twin) and
`dragonstone_throne` (4096px, 101 MB for 3,132 triangles — 99% of that file is texture).

## `world build` (41 files) — the curated half

This is the smaller, cleaner folder and it is where the shipped biome atlas already
sources from. `scripts/biome-library.json` references 13 files here, and **none of them
is currently ambiguous** — the only two same-name pairs in this root are `amphora`
(byte-identical, md5 `3883632086`) and `rocks_set_3`. `low_poly_forest_tree_pack.glb`,
which the atlas also uses, exists in both roots but is byte-identical, so the
`"root": "world"` in that config resolves correctly today. Nothing here needs an urgent
fix; it needs to stay that way as entries are added.

Its distinct character versus the animals folder:

- **9 Draco-compressed props, all under 15 KB and 590–2,110 triangles**: `tomb-entrance`,
  `mudbrick-house`, `stone-well`, `obelisk`, `camel`, `basket-set`, `amphora`,
  `apple-tree`, `arborvitae-conifer`. These are the only assets in either folder that are
  already in shipping form. Most are already atlased; `tomb-entrance`, `camel` and
  `basket-set` are not, and are free wins.
- **A coherent ancient/Mauryan set** with no counterpart in the animals folder:
  `early_buddhist_shrine_circa_3rd_century_bc`, `ancient_historical_weapons_pack_mauryan_style`,
  `obelisk`, `terracotta_worn_tiled_floor`, `mudbrick-house`, `amphora`. If any region on
  the world map wants a distinct non-European identity, this is the only material for it.
- **4 humanoid rigs** — `paladin` (65j), `strong_knight` (65j, 1 clip), `warrior` (52j,
  1 clip), `skeleton_lord` (89j, 1 clip), `zaculeu_the_master_architect` (67j, 1 clip),
  plus unrigged `samurai_warrior` and `executioner_warrior`. Same caveat as before: one
  idle clip each, so they need an external locomotion set before they beat the procedural
  battle placeholders.
- **Scenery the biome scatter could use now**: `oak_trees` (198 primitives — a whole
  tree kit in one file), `ancient_tree`, `cave_rocks`, `rocks_set2`, `rocks_set_3`,
  `stylised_crystal_shrine` (15 materials), `fantasy_table`, `barrel_gameready`,
  `portal`, `floating_rune_monolith`.

**Its worst offender is texture, not geometry.** `rocks_set_3.glb` is **146 MB for 11,352
triangles** — twelve 4096px PNGs, one of them 18 MB. The `(1)` twin is the same geometry
at 1024px for 16.6 MB, a 9× saving. This is the clearest case in either folder that the
fix is `resize` + `webp`, not `simplify`.

**Five of its files carry `KHR_materials_pbrSpecularGlossiness`** and will render white
in three.js: `gnarly_trees`, `rocks_set2`, `grass_patches`, `portal`, `strong_knight`.
Three of those five (`gnarly_trees`, `rocks_set2`, `grass_patches`) are *already
referenced by `biome-library.json`* — worth confirming the atlas builder runs
`metalrough` on them rather than that they happen to look right by luck.

**A cross-root trap worth knowing.** Four filenames exist in both folders. Three are
byte-identical (`drogon_game_of_thrones`, `low_poly_forest_tree_pack`,
`petrified_dragon_egg_-_fossil_prop`), but **`autumn_forest_asset_extra_low_poly.glb`
differs**: the `world build` copy is 1024px, and the `3d models animals` copy is the
2048px master. A config naming that file has to say which root it means — and for that
one asset, `"root": "world"` gets you the lower-quality copy.

## The headline problem: these are render assets, not game assets

The library is not short of realism — it is drowning in it. Twelve assets exceed
1.8 M triangles *each*, and the pattern is unmistakable:

| Asset | MB | Tris | Materials | Textures |
|---|---|---|---|---|
| `alchemist_shelf_with_potion_bottles` | 148 | 1,871,044 | 1 | 3 |
| `violet_crystal_formation_glowing_rock_cluster` | 143 | 1,998,250 | 1 | 3 |
| `blacksmith_anvil__tool_set_prop` | 143 | 1,884,975 | 1 | 3 |
| `floating_rune_monolith_-_ancient_stone` | 120 | 1,866,832 | 1 | 3 |
| `crumbling_stone_watchtower` | 109 | 1,897,327 | 1 | 3 |
| `executioner_warrior_-_hooded_axe__armor` | 106 | 1,895,294 | 1 | 3 |
| `petrified_dragon_egg_-_fossil_prop` | 99 | 1,819,649 | 1 | 3 |
| `overgrown_courtyard_patio_ruin` | 112 | 1,910,497 | 1 | 3 |

One material, three textures, ~1.9 M triangles: these are photogrammetry/AI-generated
scans where **all the realism is baked into geometry that a decimated mesh plus the
same textures would carry just as well**. The whole shipped biome atlas
(`public/models/biomes.glb`, 26 props) has a per-prop budget in the hundreds of
triangles. Dropping one of these in unmodified costs more than the entire game.

The upside: decimating 1.9 M → 3–5 K while keeping the 4K albedo/normal/ORM is a
mechanical `gltf-transform` step, and the result looks dramatically better than the
current low-poly scatter props. **That decimation pass is the single highest-value
realism win available**, and it needs no new assets at all.

## What is actually usable, by category

### Animated / skinned (25 assets)

The only category the game cannot fake procedurally, and the most valuable.

| Asset | MB | Tris | Joints | Clips | Notable clip names |
|---|---|---|---|---|---|
| `drogon__game_of_thrones_dragon` | 113 | 39,234 | 292 | **52** | the existing wyvern source — already in the pipeline |
| `doe__realistic_animated_3d_model` | 25 | 19,950 | 48 | **46** | idle, death variants, locomotion — a full prey rig |
| `elephant` | 8 | 1,958 | 54 | **28** | attack, death, eating, fight idle, drop |
| `mega_wyvern` | 5 | 16,222 | 70 | 11 | Idle, Flame Blast, Roar, Beam, Talon Smash, Strike Swoop, Wing Slap |
| `prowler_dragon_variant_rig` | 16 | 19,766 | 126 | 3 | Walk, PoseLib, **Landing** |
| `wolf_with_animations` | 4 | 2,760 | 49 | 5 | Run, walk, creep, Idle, sit |
| `horse_-_realistic_3d_model_demo_free` | 22 | 82,426 | 677 | 2 | Idle, Walk |
| `guineafowl-realistic-...-temprit` | 4 | 9,105 | 165 | 3 | Idle, WalkMedium, **FlyFlapping** |
| `chicken_rig` | 0.7 | 1,541 | 50 | 1 | Idle |
| `rabbit_rigged` | 0.3 | 2,578 | 48 | 1 | — |
| `dove_bird_rigged` | 1 | 2,462 | 75 | 1 | — |
| `clearwing_swallowtail` | 1.4 | 11,064 | 62 | 1 | fly |
| `skeleton_lord` / `strong_knight` / `warrior` / `zaculeu` | 4–10 | 9–33 K | 52–89 | 1 each | single idle/T-pose — rigs, not animation sets |
| `robowyvern` | 12 | 30,950 | 40 | 6 | unnamed `ArmatureAction` clips |
| `fire_dragon` | 19 | **235,124** | 86 | 1 | too heavy as-is |
| `nightmare` / `red_wyvern` | <0.2 | <1 K | **0** | 6 / 1 | morph-or-node animated, no skin — placeholder tier |

### Static scenery worth atlasing

- **Modular kits / packs** (best value per file — many nodes, shared materials):
  `ancient_temple_modular_kit` (42 prims, 19 mat), `temple_ruins_asset_pack` (77 prims),
  `stylised_rocks_asset_pack` (184 prims), `noble_columns_-_asset_pack`,
  `ancient_fortress_asset_pack_-_part_2`, `frontier_fortifications`,
  `props_for_game` (170 prims), `dark_fantasy_themed_props_for_scene` (75 prims),
  `siege_at_night_medievalremixchallenge` (3,284 prims — a whole scene, mine it for parts).
- **Already game-ready** (Draco-compressed, <15 KB, hundreds of triangles):
  `tomb-entrance`, `mudbrick-house`, `camel`, `stone-well`, `obelisk`, `amphora`,
  `arborvitae-conifer`, `apple-tree`, `basket-set`. These can be wired today with zero
  processing.
- **Sanctuary dressing** the game has no equivalent for: `stove_forge_blacksmith`,
  `alchemy_table_free`, `medieval_fireplace`, `gothic_bed_01`, `dragonstone_throne`,
  `pearl_inlaid_throne`, `medieval_telescope`, `antique_books`, `the_medieval_book_stand`,
  `blacksmith_anvil__tool_set_prop`, `medieval_market_tent_prop_01`, `tent`.
- **Dragon-specific**: `dragon_egg`, `dragon_egg_lowpoly`, `green_dragon_egg_by_tripo`,
  `petrified_dragon_egg_-_fossil_prop`, `egg_of_rock`, `stylized_dragon_flag`,
  `dread_dragon_armor`.

### Traps to know about before importing

- **8 assets carry `KHR_materials_pbrSpecularGlossiness`** — `ancient_ritual_stone_altar_mw`,
  `ga_free_901_fantasy_villager_1.0`, `ga_free_101_dripping_wax_candle_cluster`,
  `realistic_animals_full_pack_demo_free`, `gnarly_trees`, `rocks_set2`, `grass_patches`,
  `portal`, plus the `wyvern.glb` baseline. three.js dropped that extension, so each
  renders as an **untextured white blob**. `gltf-transform metalrough` first — this is
  the exact trap `CLAUDE.md` already documents.
- **Two rugs and a carpet are textures pretending to be models**: `fur_rug` is 46 MB for
  **28 triangles**, `opulent_rug` 54 MB for 28. Take the textures, drop the geometry.
- **`horse_walk` (20 MB, 1 clip) and `nightmare` / `red_wyvern` have zero joints** —
  they animate node transforms or morphs, so they cannot retarget onto a skeleton.

## What we can use, and exactly where it goes

The project has five distinct asset intake paths. An asset is only usable if it fits one
of them, so this maps candidates to the path that accepts them.

| # | Path | Config → builder → output | Consumed by |
|---|---|---|---|
| 1 | **Skinned creature** | *(none — hand-placed GLB)* → `public/models/wildlife/` | `manifest.ts` `wildlife.*` → `GameModel` |
| 2 | **Biome scatter prop** | `scripts/biome-library.json` → `pnpm assets:biome-atlas` → `public/models/biomes.glb` | `biomeLibrary.ts` → `biomeScatter.ts` |
| 3 | **Sanctuary prop** | `scripts/asset-sources.json` → `python3 scripts/extract-assets.py` → `public/models/sanctuary.glb` | `PROP_CATALOG` in `core/state/sanctuaryLayout.ts` |
| 4 | **Showcase / hero prop** | `pnpm assets:import-meshy-library` → `public/models/library/` | `manifest.ts` `library.*` |
| 5 | **Wyvern clip** | `.blend` retarget → `pnpm assets:drogon-sidecar` → `drogon-sanctuary.glb` | `manifest.ts` animation map |

### Already wired — and both on the wrong variant

`wildlife.deer` and `wildlife.guineafowl` are **already in `manifest.ts`** (lines 613 and
626) with fitted scales and clip maps, already rendering in the Highlands hunt via
`GameModel id="wildlife.deer"`. So the earlier "land the animated prey" advice was half
done already.

But both were imported from the **1024px downscale**:

| In project | Its texture | Master on disk | Master texture |
|---|---|---|---|
| `public/models/wildlife/doe.glb` (11.8 MB) | 1024px | `doe__realistic_animated_3d_model (1).glb` (25.1 MB) | **4096px** |
| `public/models/wildlife/guineafowl.glb` (4.4 MB) | 1024px | `guineafowl-realistic-3d-model-temprit.glb` (9.1 MB) | **2048px** |

Re-importing from the master at 2048px is the single cheapest realism gain in the whole
list: same geometry, same clip names, same fitted scale — the manifest entries do not
change at all. Note the two masters sit on *opposite* sides of the naming convention.

### Ready to add now, per path

**Path 1 — skinned creatures.** `manifest.ts` already has the `wildlife.${string}` key
type, so each is a new entry plus a numeric height fit, nothing more:

| Asset | Tris | Joints | Clips | Fills |
|---|---|---|---|---|
| `wolf_with_animations` (13.8 MB copy) | 2,760 | 49 | Run, walk, creep, Idle, sit | Highlands predator — the hunt has prey but no rival |
| `rabbit_rigged` | 2,578 | 48 | 1 | Sanctuary/biome ambient life |
| `chicken_rig` | 1,541 | 50 | Idle | Sanctuary livestock — pairs with the feeding loop |
| `dove_bird_rigged` | 2,462 | 75 | 1 | Flying ambient, sanctuary skyline |
| `clearwing_swallowtail` | 11,064 | 62 | fly | Biome ambient insect |
| `elephant` (2048px copy) | 1,958 | 54 | **28** — attack, death, eating, fight idle | Highlands big game, or a hostile neutral |
| `horse_-_realistic_3d_model_demo_free` | 82,426 | 677 | Idle, Walk | Needs decimation; 677 joints is heavy for ambient |

`wolf` and `chicken_rig` are the two best value-per-byte: both under 4 MB, both properly
skinned, both fill a gap the game names but cannot render.

**Path 2 — biome scatter.** 13 entries already source from `world build`. Unclaimed
props that suit the existing scatter, all already low-poly enough for the triangle
budget: `tomb-entrance`, `camel`, `basket-set` (all Draco, <15 KB, zero processing),
plus `oak_trees` (198 primitives — a whole tree kit), `ancient_tree`, `rocks_set2`,
`stylised_crystal_shrine`, `barrel_gameready`, `terracotta_worn_tiled_floor`. The
existing prop ids (`prop.biome.tree.*`, `rock.*`, `landmark.*`, `cave.*`, `crystal.*`)
show the taxonomy each would join.

**Path 3 — sanctuary props.** `PROP_CATALOG` currently has 11 stations and 14 dressing
props (torches, chests, crates, barrels, anvil, trough, grindstone, runestones, logpile).
The animals folder has direct, better-looking replacements *and* new station candidates:
`stove_forge_blacksmith` (14 materials) and `blacksmith_anvil__tool_set_prop` for
`scaleForge`; `alchemy_table_free` / `alchemist_shelf_with_potion_bottles` for a new
station; `medieval_fireplace`, `gothic_bed_01`, `antique_books`,
`the_medieval_book_stand`, `medieval_telescope`, `dragonstone_throne` /
`pearl_inlaid_throne`, `medieval_market_tent_prop_01`, `tent`, `fur_rug` / `opulent_rug`
(textures only — 28 triangles each). A catalogue entry can carry `station`/`panel`/
`radius`, so any of these can become an interactable rather than set dressing.

Dragon-specific and unused: `dragon_egg`, `dragon_egg_lowpoly`, `green_dragon_egg_by_tripo`,
`petrified_dragon_egg_-_fossil_prop`, `egg_of_rock` — the hatchery station renders eggs
and these are the only egg meshes either folder has. `stylized_dragon_flag` and
`dread_dragon_armor` suit the sanctuary silhouette.

**Path 5 — wyvern clips.** `mega_wyvern` (11 clips: Flame Blast, Roar, Beam, Talon Smash,
Strike Swoop, Wing Slap, Combo Hit, Death) and `prowler_dragon_variant_rig` (Walk,
**Landing**, PoseLib) are the only sources of wyvern motion outside the current Drogon
set. `Landing` is the one that matters most — it is a named ledger gap that battle
cannot currently reach. These retarget through the sidecar pipeline; the meshes are not
wanted, only the curves.

### What we cannot use yet

- **Battle squads.** `SquadActorView` in `BattleScene.tsx:500` draws a `capsuleGeometry`
  through an `InstancedMesh`, and the comment at line 496 says it is non-skinned *on
  purpose* — instanced skinned meshes do not work in WebGL three.js. So `paladin`,
  `strong_knight`, `skeleton_lord`, `warrior`, `samurai_warrior`, `executioner_warrior`,
  `ga_free_901_fantasy_villager` and `patch_mercenary_stalker` **cannot replace the
  capsules without a rendering-architecture change**, regardless of quality. They would
  need either a non-skinned baked-pose variant per figure, or a hero/squad split where
  only a few figures are skinned. That is a design decision, not an import.
- **The 1.9 M-triangle scans** — until the decimation lane in step 2 below exists, none
  of the eight hero props can enter any path.
- **`nightmare`, `red_wyvern`, `horse_walk`** — zero joints, so they animate node
  transforms only and cannot retarget or blend.

### One thing I flagged earlier that turned out fine

I suggested confirming the atlas builder handles `KHR_materials_pbrSpecularGlossiness`
on `gnarly_trees`, `rocks_set2` and `grass_patches`. Checked: the shipped
`public/models/biomes.glb` declares only `EXT_texture_webp`, and every material derived
from those three carries a real `baseColorTexture`. The conversion is happening. No
action needed.

## Recommended order of work

1. **Resolve the variant ladder — do not blind-delete.** Only 313 MB is genuinely
   redundant (the 5 byte-identical groups). Everything else is a 4K/2K master beside a
   1K downscale, and both ends are useful: the master is the source you decimate and
   re-bake from, the downscale is closer to what ships. The actionable step is to make
   the choice *explicit* rather than positional — record `preferredFile` per asset (the
   JSON index now does) so `biome-library.json` never resolves a name to whichever copy
   sorted first. Bare `foo.glb` in a config is currently ambiguous in 63 cases.
2. **Build a decimation lane.** Extend `scripts/build-biome-atlas.mjs` (or add a sibling)
   with a `gltf-transform` chain: `metalrough` → `weld` → `simplify --ratio` →
   `resize 2048` → `webp` → `draco`. Point it at the eight 1.9 M-tri hero props and
   target 3–5 K triangles each. This converts the library's biggest liability into its
   biggest realism gain, and it is measurable — the existing
   `pnpm assets:validate-biome-atlas` gate already checks triangle budgets. Feed it the
   4K master, not the 1K downscale: you are decimating geometry and want the best normal
   map you can bake detail into, and `resize 2048` at the end of the chain gets you back
   to a sane runtime size anyway.
3. **Land the animated prey and livestock.** `doe` (46 clips), `wolf` (5), `rabbit`,
   `chicken_rig`, `guineafowl` (with a flap clip) and `dove_bird_rigged` are small,
   properly skinned, and would give the Highlands hunt and the sanctuary the ambient
   life they currently lack. These route through `GameModel` + `manifest.ts`, and the
   manifest already supports clip pools and `phaseGroup`, so no new render code is needed.
4. **Mine `mega_wyvern` and `prowler_dragon_variant_rig` for clips, not meshes.** Between
   them they hold Flame Blast, Roar, Talon Smash, Wing Slap, Strike Swoop, Walk and
   **Landing** — `Landing` is directly relevant to the ledger gap where `Actor.flying`
   never mutates and landing clips are unreachable in battle. Retargeting onto the
   existing `WyvernRig` follows the sidecar path in `scripts/build-sidecar.py`.
5. **Second static atlas for the sanctuary**, built the same way `biomes.glb` was, from
   the forge/alchemy/throne/bed/telescope set. That is the concrete asset half of
   `docs/SANCTUARY_ENVIRONMENT_ART_PLAN.md`.
6. **Humanoid rigs for units.** `strong_knight`, `skeleton_lord`, `warrior`, `paladin`,
   `samurai_warrior`, `executioner_warrior`, `patch_mercenary_stalker` and
   `ga_free_901_fantasy_villager` would replace the procedural battle placeholders — but
   they ship one idle clip at most, so they need an external locomotion set (Mixamo or
   similar) before they beat the placeholders in motion.

## Licence

None of this is cleared. `scripts/biome-library.json` starts every new entry at
`pending` and the builder refuses to write an unapproved prop into `public/models`.
Several files carry vendor-marketing names (`free_-_`, `demo_free`, `ga_free_`) that
usually imply non-redistribution or attribution terms. Record evidence in `CREDITS.md`
per asset before flipping any entry to `approved`.
