# Credits

## Wyvern model (drogon)

- **Source:** Drogon — Game of Thrones Dragon by CoreMesh 3D
- **Licence:** CC-BY-4.0
- **File:** `public/models/drogon.glb` (meshopt + WebP compressed; original spec/gloss converted to metalrough)
- **Modifications:** Weight-optimized 56-bone re-rig (WyvernRig), 26 authored sanctuary sidecar animations, cosmetic material override for near-black finish

## Sanctuary scenery atlas

- **File:** `public/models/sanctuary.glb`
- **Build config:** `scripts/asset-sources.json`

## Player character

- **Files:** `public/models/library/` (Meshy-generated assets, imported via `pnpm assets:import-meshy-library`)

## Thornwing variant

- **File:** `public/models/thornwing.glb`

## Wildlife prey

- **Doe source:** Doe – Realistic Animated 3D Model by CoreMesh 3D ([Sketchfab](https://sketchfab.com/3d-models/doe-realistic-animated-3d-model-eed7c6103c2f4bd4b51f05208f0ec7a8))
- **Doe licence:** CC-BY-4.0
- **Doe file:** `public/models/wildlife/doe.glb`
- **Doe modifications:** imported from the 4096px master (`scripts/reimport-wildlife-masters.mjs`), not the 1024px downscale; deprecated specular/gloss material converted to metallic/roughness; texture re-encoded 2048px WebP; manifest scale fitted numerically to 1.35 m overall height
- **Guineafowl source:** Guineafowl-realistic-3d-model-temprit by mousebear3 ([Sketchfab](https://sketchfab.com/3d-models/guineafowl-realistic-3d-model-temprit-e74c523b730445d3a9ab657371ddfc2f))
- **Guineafowl licence:** CC-BY-4.0
- **Guineafowl file:** `public/models/wildlife/guineafowl.glb`
- **Guineafowl modifications:** re-imported from the 2048px master (`scripts/reimport-wildlife-masters.mjs`), replacing the 1024px first import; texture re-encoded 2048px WebP; manifest scale fitted numerically to 0.55 m overall height

## Elderroot Grove landmark

- **Source:** `ancient_tree.glb`, imported from the local `fantasy-biomes-isometric` prototype (`ancient-tree` manifest entry)
- **Licence:** not yet recorded upstream — status pending; resolve before shipping publicly
- **File:** `public/models/library/ancient-tree.glb` (meshopt + WebP compressed, 17,482 triangles)
- **Modifications:** none to the mesh; manifest scale fitted numerically to 34 m overall height, and the root offset set to plant the trunk rather than the bounding box (the lowest geometry is a handful of dangling root tips)

## Biome scenery atlas

- **File:** `public/models/biomes.glb` (26 static props, 29,556 triangles, 3.16 MB)
- **Build config:** `scripts/biome-library.json`; builder `scripts/build-biome-atlas.mjs`; system
  overview `docs/BIOME_SYSTEM.md`; asset workflow `docs/BIOME_LIBRARY.md`
- **Sources** (Sketchfab downloads held locally under `~/Desktop/world build`, one prop family each):
  `low_poly_forest_tree_pack.glb`, `gnarly_trees.glb`, `grass_patches.glb`, `apple-tree.glb`,
  `arborvitae-conifer.glb`, `rocks_set2.glb`, `cave_rocks.glb`,
  `gemstone_crystals_-_asset_pack.glb`, `stylised_crystal_shrine.glb`, `obelisk.glb`,
  `stone-well.glb`, `mudbrick-house.glb`, `amphora.glb`
- **Licence:** redistribution rights confirmed by the project owner on 2026-08-14; the per-source
  upstream licences are not yet recorded individually. Record them here before publishing, and note
  that the builder refuses any entry not marked `approved` in `scripts/biome-library.json`.
- **Modifications:** selected nodes extracted, world transforms baked, re-anchored (centred in x/z,
  resting on y=0), scaled to authored metre heights, simplified to per-prop triangle budgets,
  spec/gloss materials converted to metallic/roughness, textures re-encoded as 512 px WebP

## Sanctuary audio layer

- **Design:** Procedural real-time Web Audio API synthesis (`src/scenes/Sanctuary/audio/sanctuaryAudio.ts`)
- **Licence:** MIT (Project-authored procedural sound design)
- **Components:** Filtered brown/pink noise outdoor bed, positional landmark oscillators & filters (fire/forge, pool, hatchery, woodland), locomotion footsteps, discrete interaction cues (`collect`, `delivery`, `invalid`, `duty_completed`, `milestone_unlocked`), and species/age-scaled wyvern FM vocalizations. Zero external audio samples required.

---

Add new third-party assets here with their licence and attribution. Do not commit assets whose
licence is not recorded in this file.
