# Biome system

This is the map of the shipped biome upgrade: what a player sees, where each part lives, and which
source is authoritative. For importing or rebuilding scenery, continue with
`docs/BIOME_LIBRARY.md`.

## What shipped

- A walkable `biome` scene for the selected region, with biome-specific terrain, atmosphere and
  deterministic scenery. The player arrives on foot and can press `Tab` to shift to the first
  available wyvern.
- A generated `public/models/biomes.glb` atlas containing 26 true-scale static props from 13 source
  files: trees, ground cover, rocks, cavern pieces, crystals, landmarks and small props.
- Dressing definitions for all 15 biome ids. Each layer controls prop, instance count, radius band,
  scale range, shadowing, wind and optional tint.
- A `/biomes` development library with searchable prop and per-biome views, authored-versus-built
  measurements, true-scale preview against a 1.6 m figure, usage links and `?prop=<id>` deep links.
- World-map presentation aligned with the biome palettes: biome-coloured land and dressing,
  tier-monotonic region crests, terrain-aware nodes, beacons, camera targets and supply lines, plus
  one shared held/reachable/locked status palette.
- A compact region inspector showing biome, status, adjusted yields, live garrison strength, native
  species, eggs, stationing controls and the assault entry point.
- Discoverability from the title screen and `/models`, without adding a second WebGL context to the
  title page.

The upgrade is cosmetic and presentational. Collision sizes, yields, combat stats and other gameplay
authority remain in `src/core/**`; no model measurement feeds game rules.

## Runtime data flow

```text
selected world-map region
  -> RegionDef.biome
  -> BiomeScene
     -> biomePalettes.ts       atmosphere and terrain colours
     -> BiomeTerrain           deterministic height field
     -> biomeLibrary.ts        layer recipes
     -> biomeScatter.ts        deterministic instance transforms
     -> BiomeDressing          instanced atlas rendering
```

`BiomeScene` is a mode inside the persistent game canvas, not a Next.js route. The separate
`/biomes` route is a development and review surface only.

## Sources of truth

| Concern | Source of truth |
|---|---|
| Region id, tier, biome, position, neighbours, yields | `src/core/data/regions.ts` |
| Atmosphere and ground palette per biome | `src/scenes/BiomeWorld/atmosphere/biomePalettes.ts` |
| Explorable-biome prop layers | `src/render/assets/biomeLibrary.ts` |
| Explorable-biome placement maths | `src/scenes/BiomeWorld/dressing/biomeScatter.ts` |
| Biome terrain and height sampling | `src/scenes/BiomeWorld/terrain/` |
| Curated external source nodes and target measurements | `scripts/biome-library.json` |
| Built prop measurements | `public/models/biomes.glb`, `asset.extras.wyvern3dBiomeAtlas` |
| External source inventory | `docs/BIOME_LIBRARY_INDEX.json` (generated) |
| World-map terrain and node deck height | `src/scenes/WorldMap/terrain/mapTerrain.ts` |
| World-map status vocabulary and colours | `src/scenes/WorldMap/nodeVisuals.ts` |
| World-map decorative scatter | `src/scenes/WorldMap/dressing/dressingPlan.ts` |
| Attribution and redistribution evidence | `CREDITS.md` |

There are deliberately two dressing catalogs with similar names:

- `src/render/assets/biomeLibrary.ts` dresses the full-size walkable biome from the new biome atlas.
- `src/scenes/WorldMap/dressing/dressingPlan.ts` dresses the strategic map from the sanctuary atlas,
  groups instances by prop and biome, and multiplies their materials by a biome tint.

Changing one does not change the other. This split keeps strategic-map silhouettes lightweight while
the explorable scene can use the richer multi-material models.

## Scale, placement and rendering contracts

- One world unit is one metre. `targetHeight` in `scripts/biome-library.json` is authored scale; the
  builder measures the selected geometry and derives the conversion factor.
- Built props are centred in x/z and rest on `y=0`, except an explicit manifest `sink` beds landforms
  below the surface.
- `biomeScatter.ts` derives radius, angle, rotation and scale from the layer and instance index. It
  uses neither the game RNG nor `Math.random()`, so revisiting a biome does not require saved
  placements and cannot disturb replay state.
- Terrain height is sampled for every instance. The `grove` reserves a 32 m central clearing for its
  separately loaded ancient-tree landmark and stone ring.
- The biome atlas is multi-material. `Prop` and `PropInstances` build one mesh or `InstancedMesh` per
  primitive while sharing the placement list; the template cache is keyed by atlas.
- The atlas is loaded before scene mounting with the other prop atlases. `BiomeDressing` also has an
  error boundary so a deliberately absent, unapproved atlas removes scenery instead of killing the
  whole game canvas.
- Wind and colour are material clones. They are visual only, and a multi-material prop still costs
  one draw call per primitive per layer.

## World-map integration

The strategic map reuses the same biome palettes but has its own procedural terrain and lightweight
dressing plan.

- `LAND_RADIUS` is derived from the outermost region, plateau and dressing reach. This keeps every
  region inside the coastal falloff.
- A region node is anchored at `regionCrestHeight(def)`. `regionDeckY(def)` is the common endpoint
  for beacons, supply lines and camera focus, preventing each system from inventing a different
  height.
- Pedestal height grows with tier, and tests require crest height to remain monotonic by tier.
- Decorative groups are keyed by `prop@biome` because an instanced mesh has one material. Each group
  receives the corresponding biome ground tint; landform props may define a terrain sink.
- Nodes, rings, graph edges, pulses and the DOM inspector resolve held/reachable/locked through the
  same status palette in `nodeVisuals.ts`.

## Review surfaces

Use `/biomes` before reviewing in a game scene:

1. Filter Props by family, use or source filename.
2. Compare the authored target with the built height, footprint, triangle count and scale.
3. Orbit beside the 1.6 m reference figure; the viewport deliberately shows scale rather than
   framing every prop to look equally large.
4. Switch to Biomes and inspect every layer's count, radius, scale, wind and tint. Amber rows name a
   prop missing from the built atlas.
5. Deep-link a finding with `/biomes?prop=<logical-id>`.

The page joins `scripts/biome-library.json` to measurements embedded in the built GLB. A missing
atlas is a supported state and appears as "not built".

## Change workflows

| Change | Edit | Verify |
|---|---|---|
| Add or replace a biome prop | Follow `docs/BIOME_LIBRARY.md`; edit `scripts/biome-library.json` | Draft build, licence evidence, shipped build, atlas validator |
| Change full-size biome dressing | `src/render/assets/biomeLibrary.ts` | `biomeLibrary.test.ts`, `biomeScatter.test.ts`, `/biomes`, live biome |
| Change atmosphere or terrain colour | `biomePalettes.ts` and, if needed, BiomeWorld terrain | Full-size biome and world map; map colours reuse these palettes |
| Change strategic-map scatter | `WorldMap/dressing/dressingPlan.ts` | `dressingPlan.test.ts`, world map |
| Change node height or coastline | `WorldMap/terrain/mapTerrain.ts` | `mapTerrain.test.ts`, camera focus, beacons and lines |
| Change map status styling | `WorldMap/nodeVisuals.ts` and DOM CSS if needed | `nodeVisuals.test.ts`, node, edge and inspector consistency |

For any biome atlas or dressing change, run:

```bash
pnpm assets:validate-biome-atlas && pnpm typecheck && pnpm lint && pnpm test
```

## Current limits

- The 26-prop atlas is approved by the manifest gate, but per-source upstream licence details still
  need to be recorded individually in `CREDITS.md` before public distribution.
- The Elderroot Grove ancient tree is a separate model with pending upstream licence metadata; it is
  not part of `biomes.glb`.
- Full-size biome collision currently covers the grove landmark, not every scattered prop.
- Scenery placement is stable per biome, not unique per region: two regions with the same biome use
  the same index-derived layout.
- Multi-material assets cannot batch across unlike materials. The 15-primitive crystal shrine is the
  current draw-call outlier.
- Sparse glTF accessors are rejected by the atlas builder; interleaved buffers are de-interleaved.
