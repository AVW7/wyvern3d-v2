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
- **Doe modifications:** deprecated specular/gloss material converted to metallic/roughness; manifest scale fitted numerically to 1.35 m overall height
- **Guineafowl source:** Guineafowl-realistic-3d-model-temprit by mousebear3 ([Sketchfab](https://sketchfab.com/3d-models/guineafowl-realistic-3d-model-temprit-e74c523b730445d3a9ab657371ddfc2f))
- **Guineafowl licence:** CC-BY-4.0
- **Guineafowl file:** `public/models/wildlife/guineafowl.glb`
- **Guineafowl modifications:** smaller supplied export selected; manifest scale fitted numerically to 0.55 m overall height

## Elderroot Grove landmark

- **Source:** `ancient_tree.glb`, imported from the local `fantasy-biomes-isometric` prototype (`ancient-tree` manifest entry)
- **Licence:** not yet recorded upstream — status pending; resolve before shipping publicly
- **File:** `public/models/library/ancient-tree.glb` (meshopt + WebP compressed, 17,482 triangles)
- **Modifications:** none to the mesh; manifest scale fitted numerically to 34 m overall height, and the root offset set to plant the trunk rather than the bounding box (the lowest geometry is a handful of dangling root tips)

---

Add new third-party assets here with their licence and attribution. Do not commit assets whose licence is not recorded in this file.
