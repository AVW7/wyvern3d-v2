# 3D asset library index

For the runtime model registry, `/models` previewer, animation mappings, fallbacks,
and contributor workflow, see `docs/MODEL_LIBRARY.md`. This index records source
assets and art-direction decisions rather than runtime configuration.

Source library: `/Users/ajadvanwyk/Documents/3Dassets`  
Art direction: **flat-shaded low-poly**, led by Poly Perfect (PP) with selective
use of the Low Poly Ultimate Asset Pack.

This is a development index, not a licence grant. Keep vendor source files
outside the repository. Before shipping any asset whose licence is not already
recorded in `CREDITS.md`, verify its original licence and redistribution terms.

## What the game uses now

The sanctuary currently ships one generated runtime atlas:

- `public/models/sanctuary.glb`: 57 named static props, 3.5 MB.
- Sources: Low Poly Nature - Flying Islands, Low Poly Mining/Cave/Blacksmith,
  and Low Poly Lava World.
- Rendering: one embedded PP palette, one material, instancing for repeated
  walls, floors, vegetation, paths, fences, hills, and perch rocks.
- Build map: `scripts/asset-sources.json`.
- Extractor: `scripts/extract-assets.py`.
- Runtime components: `src/render/assets/props.tsx`.
- Scene placement: `src/scenes/Sanctuary/dressing.ts` and
  `src/scenes/Sanctuary/SanctuaryScene.tsx`.

The 57 logical props are:

| Area | Used asset families |
|---|---|
| Keep | stone walls (2), pillar, gate, floor tiles (3), stairs |
| Keep rooms | tables (2), chest, barrel, crate, torch, signpost, log pile, blockade, campfire |
| Hatchery | mountain cave entrance, small cave, moss stone plateau |
| Scale Forge | furnace, anvil, quenching trough, grindstone, tool holder, chimney, blacksmith sign |
| Burn Range | lava columns (2), burned trees (2), dead volcano, lava stone |
| Flight Ring | mystic columns (3), flying menhirs (2) |
| Breeding Roosts | moss plateau, rune stone |
| Routes and pens | fences (2), stone paths (2) |
| Wyvern perches | moss rocks (2), stump, trunk |
| Grounds | fir trees (3), leafless tree, grass (2), moss hill, mystic stone |

The environment is visually dressed but still mostly static. Interaction is
currently proximity-based: the player enters a station radius and presses `E`
to open its panel. Wyverns are still procedural placeholders, eggs are
procedural, and assigned wyverns do not physically move to or perform actions
at stations.

## Library decisions

| Source | Size | Status | Best use / reason |
|---|---:|---|---|
| Low Poly Nature - Flying Islands | 1.1 GB | **In use — core** | Sanctuary terrain, paths, plants, rocks, ruins, gates, perches, and world-map biome kit. Shares the PP palette. |
| Low Poly Mining, Cave & Blacksmith | 393 MB | **In use — core** | Keep dressing, hatchery caves, forge, storage, camp props, mining regions. Shares the PP palette. |
| Low Poly Lava World | 129 MB | **In use — accent** | Burn Range now; volcanic battlefields and Emberback habitat later. Shares the PP palette. |
| Low Poly Ultimate Asset Pack | 413 MB | **Approved — extract selectively** | Highest-priority additions: `egg-dino`, `egg-dino-open`, `egg-dino-nest`; then medieval towers/gates/drawbridge, flags, knight statue, hanging cage. Use a separate atlas/material because its texture atlas differs from PP. |
| Dragon | 211 MB + 101 MB optional textures | **Convert — top wyvern candidate** | FBX rig plus 34 FBX animations: ground idle/look, walk, takeoff/landing, directional flight, fire forward/down, tail and bite-like attacks, hits, death. Excellent interaction coverage; visually restyle and optimize for the low-poly world. |
| Wyvern 2 | 224 MB | **Convert — top wyvern candidate** | FBX mesh plus 31 FBX motions: idle, walk, takeoff, flight/glide, landing, roar, fireball/spread fire, bite, stinger, hit, fall, death. Strongest ready source for a true wyvern silhouette. |
| Wyvern Rex Lite | 127 MB | **Reference / export first** | Rich behavioural set including sniff, drink, eat, sit, sleep, roar, walk, run, flight, landing and attacks. Files are Unreal `.uasset`, so they cannot enter the web pipeline directly; export from the matching Unreal version to FBX first. |
| drogon dragon GLB/gltf | 121–133 MB | **Convert only as a hero prototype** | Already readable by glTF tooling but far over the target budget and realistic in style. Decimate, bake/repaint materials, reduce textures and verify licence before use. Useful as anatomy/flight reference. |
| Fantasy Props MegaKit | 157 MB | **Selective conversion only** | Dummy, weapon stand and workbench could deepen physical training interactions. PBR style clashes with PP; repaint/bake to a compact stylized palette before inclusion. Verify Standard licence redistribution terms. |
| Ancient Fortress, parts 1 and 2 | 63 MB / 22 MB | **Inspiration or stylized conversion** | Good modular grammar for gateways, walls, corners, stairs, bastions, towers, palisades and moat pieces. Realistic PBR look conflicts with the sanctuary; use as keep-layout reference or bake/repaint a small selection. CC-BY credit required. |
| MedievalCityGenerator | 99 MB | **Authoring tool, later** | Blender-only procedural city kit. Useful for generating distant keeps or world-map settlement silhouettes, then manually simplifying and exporting. Do not ship the generator as runtime content. |
| Forgotten Sanctuary Lake GLB | 145 MB | **Inspiration only** | Useful composition reference for water, ruins, vertical framing and sanctuary mood. Nineteen generic meshes and photoscan-grade textures make direct use poor value. |
| Tree and Hill | 18 MB | **Do not use** | Redundant beside PP Nature and costs much more per useful prop. |
| landscape-forest-mountains | 43 MB | **Inspiration only** | Reference for layered horizons and biome silhouettes; existing PP hills and trees fit the runtime art direction better. |
| low-poly-forest-tree-pack | 25 MB | **Hold** | Potential silhouette reference, but the source/archive and licence need verification and PP Nature already covers the need. |
| rock_block_set | 13 MB | **Hold / repaint** | Useful blockout shapes, but a hand-painted one-off style is less batchable than PP rocks. |
| obelisk-01 hand-painted | 13 MB | **Convert as a special landmark** | A possible world-map landmark or arcane objective after palette restyling; avoid mixing it into ordinary sanctuary scatter. |
| r-pbr | 68 MB | **Inspiration only** | PBR reference material; wrong runtime style and texture cost for current direction. |
| majestic rooster GLB | 4.7 MB | **Optional ambient life** | Could make the sanctuary feel inhabited, provided licence and performance are acceptable. Not part of wyvern gameplay. |
| Dragon extra textures | 101 MB | **Source material only** | Normal and metallic/roughness/AO inputs for the Dragon conversion. Downscale and repack; never ship this folder as-is. |

## Best additions for player–environment–wyvern interaction

### 1. Make the hatchery a visible lifecycle

Extract Ultimate's nest, closed egg and open egg into a small second atlas.
Drive the shown model from existing egg state:

1. Empty nest when no egg is assigned.
2. Closed egg while incubation is active.
3. Cracked/open egg for the last part of the timer.
4. A short hatch event, then a hatchling at the nest.

This is the clearest near-term win because the simulation already has
incubation state, yet the environment currently communicates only “an egg
exists.”

### 2. Put assigned wyverns at their stations

The world should reflect `assignment.kind` rather than leaving every wyvern on
an idle perch:

| Assignment | Location and animation |
|---|---|
| Training: flight ring | Circle/glide around ring; land on completion |
| Training: burn range | Fire-forward or fire-down animation toward a safe target |
| Training: hunting pen | Walk/stalk, bite or stinger attack near the dummy/pen |
| Training: endurance run | Walk/run route between signposts |
| Training: scale forge | Calm ground idle while armour treatment is applied |
| Breeding | Move both partners to the breeding plateaus |
| Injured | Rest/sleep near the infirmary instead of perching |
| Idle | Perch, look, stretch, roar, sleep, or groom with seeded variation |

`Dragon` and `Wyvern 2` already contain most of these animation concepts.
Wyvern Rex is particularly useful as a behaviour reference for drinking,
eating, sitting and sleeping, even if its Unreal files are not used directly.

### 3. Turn props into readable affordances

Keep gameplay collision simple and separate from visual meshes. Add small,
explicit interaction targets to props rather than making every decoration
clickable:

- Forge anvil: inspect the current armour bonus or start Scale Forge training.
- War table: enter the world map.
- Hatchery nest: inspect egg, time remaining and parents.
- Perched wyvern: inspect, feed, rename, assign or bond.
- Training station: preview stat gain, cost, duration and the assigned wyvern.
- Chest/crates: display storage/capacity, not generic loot.
- Roost rune stone: select breeding pair.

Use proximity plus a single focus/highlight system. The prop mesh remains
cosmetic; the interaction target owns radius, label, action and accessibility
prompt.

### 4. Add environmental feedback before adding more geometry

The current atlas already has enough structure. Higher-value feedback:

- Emissive flame/lava pulses at the forge and Burn Range.
- Dust, sparks, smoke and fire breath particles only while a station is active.
- Footsteps, wing gusts, roars, forge hits and egg cracks with distance falloff.
- Subtle prop highlight and a path/ground decal for the focused station.
- Camera framing for inspect, hatch and training-complete moments.

This follows the performance rule for the project: simple colliders, instanced
static scenery, and effects/animation only around the active interaction.

## Conversion pipeline

### Static PP scenery

Continue using `scripts/extract-assets.py`: curate named nodes, re-anchor,
normalize scale, embed the small palette, and instance repeated props. Add
separate targets for world-map and battle atlases rather than growing the
sanctuary file indefinitely.

### Ultimate static scenery

Add a second extraction target and runtime atlas. Do not merge its material
blindly with PP: inspect its 44 KB atlas and retain a separate shared material
unless a deliberate palette bake proves visually correct.

### Animated wyverns

1. Verify the candidate's licence before derivative conversion.
2. Import the base FBX and selected animation FBXs into Blender.
3. Confirm one skeleton and consistent bone orientation/scale.
4. Keep an initial clip set: idle, walk, fly, takeoff, landing, attack/fire,
   hit and death. Add social/ambient clips after the controller works.
5. Reduce mesh complexity and repaint/bake materials toward the PP palette.
6. Export one GLB with named clips, compress geometry, resize/convert textures,
   and test skinning in three.js.
7. Wire clip names through `src/render/assets/manifest.ts`; gameplay collision
   and stats remain independent of model dimensions.

Start with **Wyvern 2** for silhouette and **Dragon** for animation coverage.
Build one vertical slice for `wyvern.emberback` before converting five species.
Species variation can initially use palette/material variants and scale rather
than five unrelated rigs.

## Recommended development order

1. Ultimate hatchery atlas: nest, egg, open egg; replace `PlaceholderEgg`.
2. Convert one Wyvern 2/Dragon rig vertical slice with idle/walk/fly/fire.
3. Bind sanctuary assignment state to station placement and animation.
4. Add wyvern inspect/feed/bond interaction at perches.
5. Add active-station VFX/audio and completion moments.
6. Extract PP biome atlases for world map and battles.
7. Evaluate stylized fortress landmarks and distant generated settlements.

Avoid converting the full library up front. A small, state-driven set of
animated assets will improve interaction more than thousands of additional
static meshes.
