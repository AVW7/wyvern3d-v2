# Biome library builder

How a model in the external source library becomes scenery in an explorable biome. Four steps —
index, curate, build, dress — each with its own command and its own gate.

For the player-facing feature map, runtime data flow and world-map integration, start with
`docs/BIOME_SYSTEM.md`.

For the runtime model registry (`/models`, animation mappings, skinned assets) see
`docs/MODEL_LIBRARY.md`. This document covers static biome scenery only.

## The pieces

| File | Role |
|---|---|
| `scripts/index-biome-library.mjs` | Reads the source roots, writes `docs/BIOME_LIBRARY_INDEX.{json,md}` |
| `scripts/biome-library.json` | The curated manifest: which source node backs each logical prop |
| `scripts/build-biome-atlas.mjs` | Builds `public/models/biomes.glb` from that manifest |
| `scripts/validate-biome-atlas.mjs` | Numeric acceptance gate on the built atlas |
| `src/render/assets/biomeLibrary.ts` | Which props each biome scatters, and how densely |
| `src/scenes/BiomeWorld/dressing/biomeScatter.ts` | Deterministic placement maths |
| `src/scenes/BiomeWorld/dressing/BiomeDressing.tsx` | Reads both and renders the instances |
| `src/app/biomes/` | The `/biomes` page: browse props, preview at true scale, see per-biome dressing |

Source models stay outside the repository. Only the built atlas is committed.

## Browsing it: `/biomes`

The Biome Library page is the inspection surface, the counterpart to `/models`. Two views:

- **Props** — every entry in `scripts/biome-library.json`, grouped by family, each row showing its
  built height and triangle count. Selecting one previews it from the shipped atlas beside a 1.6 m
  human figure, with the measured height and footprint printed under the viewport, and lists what
  the manifest asked for against what the builder measured, the source file and nodes, the licence
  status, and which biomes scatter it. `?prop=<id>` deep-links a selection.
- **Biomes** — every biome and the layers it dresses with: count, radius band, scale range, wind and
  tint, with any layer naming a prop the atlas does not build flagged in amber. Prop names jump back
  to the Props view.

The page reads the manifest and the atlas's `asset.extras` measurements on the server, so a prop
whose numbers drift from its authored target shows both. A missing atlas degrades to "not built"
rather than an error.

## 1. Index

```bash
pnpm assets:index-biome-library
```

Walks `~/Desktop/world build` and `~/Desktop/3d models animals` (pass paths as arguments to
override) and records, per file: category, size, triangle and material counts, skins, clip names,
extensions, sha256 duplicates, **mesh node names**, and keyword-matched biome candidates. It reads
only the GLB JSON chunk, so a multi-gigabyte library indexes in seconds.

`docs/BIOME_LIBRARY_INDEX.json` is the authoritative output; the `.md` is a readable summary. The
suggestions are a starting point for inspection, never approval.

## 2. Curate

Add an entry to `scripts/biome-library.json`:

```jsonc
{
  "id": "prop.biome.tree.canopy",
  "source": { "root": "world", "file": "low_poly_forest_tree_pack.glb" },
  "nodes": ["Tree_Trunk_01.001_Tree_Trunk_01_0", "Tree_Branches_01_Tree_Branches_01_0"],
  "targetHeight": 21,
  "maxTriangles": 900,
  "license": { "status": "pending", "evidence": null }
}
```

- **`nodes`** are source mesh node names, from the index's `glb.meshNodeNames`. Omit to take the
  whole file. Several nodes become one prop — a trunk and its branches, for instance. Check they
  belong together: the builder bakes world transforms, so selecting a trunk and another tree's
  branches produces one enormous prop with a hole in the middle.
- **`targetHeight`** is authored, in metres, and is the only place scale is decided. The builder
  measures the selected geometry and derives the factor. Never infer scale from the source file's
  units or its object names.
- **`sink`** pushes a prop below `y=0` — for a cliff that should bed into the terrain.
- **`maxTriangles`** is the whole prop's budget. These are instanced hundreds of times; the budget
  is what keeps the biome affordable.
- **`textureSize`** overrides the 512 px texture cap for a prop that needs more.

Avoid, or expect to do extra work for: animated or skinned sources (they belong on the `GameModel`
path, not here), unlit sources (`KHR_materials_unlit` is dropped, so they will suddenly respond to
biome lighting), and packs whose per-tree parts cannot be told apart by name.

## 3. Build

```bash
pnpm assets:biome-atlas --draft     # inspect first: writes .biome-atlas/, gitignored
pnpm assets:biome-atlas             # ships approved props to public/models/biomes.glb
pnpm assets:validate-biome-atlas
```

Per prop the builder selects nodes, bakes their world transforms into the geometry, re-anchors
(centred in x/z, resting on `y=0`), scales to `targetHeight`, simplifies to the triangle budget,
converts `KHR_materials_pbrSpecularGlossiness` to metallic/roughness, and re-encodes textures as
512 px WebP. Output is one GLB whose top-level nodes are named by logical id, with the per-prop
measurements stamped into `asset.extras.wyvern3dBiomeAtlas`.

Two soft dependencies, both with fallbacks: `cwebp` (Homebrew) for texture compression — without it
textures are only resized and the atlas is several times larger — and `draco3d` from the pnpm store
for Draco-compressed sources.

`--only=<id>[,<id>]` builds a subset, which is the quick way to measure one candidate's height and
footprint before committing to a `targetHeight`.

**Licence gate.** A prop reaches `public/models` only when its entry says
`"license": { "status": "approved", "evidence": "…" }`. Record the evidence in `CREDITS.md` first.
`--draft` bypasses the gate but writes to `.biome-atlas/`, which is not served.

## 4. Dress

`src/render/assets/biomeLibrary.ts` maps each full-size, explorable biome id to its layers:

```ts
{ prop: 'prop.biome.tree.canopy', count: 20, radius: [24, 96], scale: [0.85, 1.25], wind: 0.01 }
```

`atlas` may name the sanctuary atlas when a sanctuary prop is the right dressing; it defaults to the
biome atlas. `color` tints a cloned material, `wind` adds vertex sway, `castShadow` defaults to true.

Placement is `scatterLayer`, which is deterministic and index-derived — no rng, no `Math.random()`.
The same biome dresses identically on every visit without a single placement entering the save.

This is separate from `src/scenes/WorldMap/dressing/dressingPlan.ts`, which uses lightweight props
from the sanctuary atlas for the strategic map. See `docs/BIOME_SYSTEM.md` for the boundary.

## Gates

```bash
pnpm assets:validate-biome-atlas && pnpm typecheck && pnpm lint && pnpm test
```

`validate-biome-atlas` checks node ids against the manifest, measured height against `targetHeight`,
ground contact, x/z centring, per-prop triangle budgets, texture resolvability, the WebP extension
declaration, and the 15 MB cap. `src/render/assets/biomeAtlas.test.ts` locks the shipped file's
measurements, and `biomeLibrary.test.ts` checks that every biome is dressed and that every dressing
layer names a prop the atlas actually builds.

## Known gaps

- Two source landmarks are indexed but not curated: `floating_rune_monolith` and
  `petrified_dragon_egg` are ~1.8 M triangle, 100 MB+ scans. They would simplify fine; nobody has
  spent the build time yet.
- Interleaved vertex buffers de-interleave, but sparse accessors are refused outright.
- The biome atlas is multi-material, so a prop with N materials costs N draw calls per layer. The
  crystal shrine, at 15, is the one to watch.
