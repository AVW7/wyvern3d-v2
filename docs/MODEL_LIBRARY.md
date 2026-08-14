# Model Library contributor guide

The Model Library at `/models` is the development-facing view of Wyvern3D's logical model registry. It previews the model assigned to every asset slot, exposes its animation mapping, and lets contributors temporarily compare a finished GLB with its procedural fallback. It is an inspection tool, not an importer or gameplay editor.

## How the pieces fit together

- `src/render/assets/manifest.ts` owns `ASSETS`, the mapping from logical `AssetId` values to model URLs, cosmetic scale and offsets, and animation `ClipSpec` entries.
- `src/render/assets/GameModel.tsx` loads an enabled model, clones skinned scenes safely, applies material overrides, selects clips, and renders the caller's fallback when a model is absent or disabled.
- `src/state/modelLibraryStore.ts` stores the set of locally disabled asset IDs under `wyvern3d.modelLibrary` in browser local storage.
- `src/app/models/` contains the catalog UI, preview canvas, and pure catalog helpers.

The registry is cosmetic. Collision radii, speeds, combat ranges, costs, and other simulation values remain in `src/core/**`; they must never be inferred from a loaded mesh. Disabling a production model changes only its presentation and does not alter saves or replay behavior.

## Using `/models`

The header reports production-ready and awaiting-art totals. Search matches a model's display name, logical ID, and category. Category and readiness filters can be combined, and catalog results are grouped consistently by category.

Selecting an entry:

- updates the preview and inspector;
- keeps the selected row visible;
- responds to arrow keys, `Home`, and `End` for stepping through the filtered list;
- writes `?model=<asset-id>` to the URL so the selection can be bookmarked or shared;
- falls back to `character.player` if a URL contains an unknown asset ID.

The inspector pins the status card and the "Use in world" toggle, and splits the rest across three
tabs: **Info** (source, world scale, root offset, state count), **Animation** (preview-state picker
and the per-state clip map), and **Rig** (polygon/bone/material counts and bone names, populated once
a GLB has loaded).

The status indicator distinguishes three cases:

- **Active:** a production GLB is assigned and enabled.
- **Disabled:** a production GLB is assigned but the local preference forces its procedural fallback.
- **Awaiting art:** the manifest URL is `null`, so the fallback is the production behavior for that slot.

Drag the preview to orbit and scroll to zoom. Changing the selected asset resets and refits the camera after the real GLB loads. The animation selector plays any state mapped by the manifest. The animation map lists the actual clip or clip pool and reports loop/one-shot behavior, chained states, phase groups, playback rates, fades, and pose-specific vertical offsets.

`Use in world` persists only in the current browser. `Enable all finished models` clears all locally disabled IDs. Placeholder entries cannot be enabled because they have no production model to load.

## Adding a model

Before importing third-party work, verify its licence and redistribution terms and record required attribution in `CREDITS.md`. `docs/ASSET_INDEX.md` is the source-asset inventory and art-direction reference; this guide covers the runtime registry rather than duplicating that inventory.

## Asset intake requirements

Every new world model must have a written target before anyone adjusts its manifest scale. Review is numeric first and visual second.

1. **Provenance:** record title, author, source URL, licence, redistribution permission, and modifications in `CREDITS.md`. Reject unknown or incompatible licences.
2. **Declared role:** name the logical asset ID, target scenes, expected maximum simultaneous instances, whether it is static or skinned, required gameplay-facing clips, and its real-world target dimensions in metres. One world unit is one metre.
3. **Source inspection:** run `pnpm assets:inspect-model <file.glb> <target-height-metres>`. Record bounds, triangle count, materials/textures, skins/bones, and exact clip names. Never infer scale from the file's unit setting or object name.
4. **Scale and ground fit:** calculate `manifest scale = target height / measured posed height`; use the reported `yOffsetRigUnits = -bounds.min.y`. Verify the fitted width and length remain anatomically plausible. Do not compensate with scene-specific magic scale or Y offsets.
5. **Orientation and origin:** in the Model Library, confirm Y-up, the expected forward direction, feet/contact surface at Y=0, a stable root, and no unexpected root motion. Apply object rotation/scale before export when authoring in Blender.
6. **Geometry budget:** ordinary web animals must be at most 30,000 triangles; prefer at most 10,000 for repeated ambient creatures. Declare an instance budget. A skinned creature is never eligible for `InstancedMesh`; reduce count, bones, or use a non-skinned distance representation.
7. **Materials and textures:** glTF must use metallic/roughness PBR. Convert `KHR_materials_pbrSpecularGlossiness`; use Principled BSDF-compatible materials; cap ordinary textures at 1024 px; verify base colour, normals, roughness, alpha, and colour space in three.js, not only Blender.
8. **Rig and animation:** preserve hierarchy for skinned assets; no flatten/join/palette/instance optimization. Limit weights to four per vertex. Map only clips that exist, mark one-shots `loop: false`, check loop seams and root motion, and test at least two simultaneous clones to expose broken skeleton cloning.
9. **Runtime package:** ship GLB under `public/models/`, use a stable lowercase filename, keep an ordinary asset under the 15 MB hard cap and preferably under 8 MB, then add its cosmetic manifest entry. Simulation collision/range values remain in `src/core/**` and never come from mesh bounds.
10. **Acceptance:** inspect every mapped state in `/models`, compare against a 1.6 m player and a known metre marker, check ground contact from front/side, test all target scenes at the declared maximum instance count, toggle the fallback, and run `pnpm typecheck && pnpm lint && pnpm test`.

For important or repeated assets, add a focused test like `wildlifeModels.test.ts` that locks the shipped GLB's measured height, ground offset, triangle budget, rig/clip inventory, and forbidden extensions. A manifest number without a measurement-backed test is provisional.

### Static model

1. Optimize the source GLB for the web and place the finished file under `public/models/` (or `public/models/library/` for showcase imports).
2. Add or update one `ASSETS` entry with its URL and cosmetic `scale`. Add `yOffset` only when the model needs a root-level ground correction.
3. Leave `animations` empty for a static asset.
4. Open `/models?model=<asset-id>`, check framing and ground contact, and toggle the model off to confirm the fallback remains readable.

### Animated or skinned model

1. Preserve the skeleton and scene hierarchy during optimization. Do not use graph-rewriting optimization steps such as flatten, join, palette, or instancing on a skinned asset.
2. Put clips in the base GLB or list compatible animation-only files in `animationUrl` or `animationUrls`.
3. Map gameplay-facing `ModelState` values to `ClipSpec` entries. A state may map to a small clip pool for seeded variation.
4. Mark one-shots with `loop: false`. Use `next` when the mixer must chain into another state, such as takeoff into airborne flight.
5. Use `phaseGroup` only for compatible looping clips whose normalized playback phase can survive a crossfade.
6. Set `timeScale`, `fadeIn`, and clip-level `yOffset` only when the asset requires an override. Clip offsets are authored rig units and are multiplied by the model's root scale.
7. Inspect every mapped state in `/models`; the animation map should match the intended clip contract exactly.

For supplied skinned assets, the compression and specular/gloss conversion recipes are documented at the top of `src/render/assets/manifest.ts`. Animation work on the wyvern rig has additional measured gates in `docs/WYVERN_ANIMATION_BASELINE.md` and `docs/FLIGHT_ANIMATION_DEVELOPMENT.md`.

## Validation

Run the standard gates after any registry or Model Library change:

```bash
pnpm typecheck
pnpm lint
pnpm test
```

For wyvern animation changes, also run the asset-specific commands required by `CLAUDE.md`, including `pnpm assets:validate-sidecar` where applicable. For combat-facing changes, run `pnpm sim:battle`; merely swapping a cosmetic model should not require combat changes.

The repository includes focused tests for catalog filtering, counts, URL validation, animation metadata, fallback preferences, preview refitting, imported GLBs, player animation sidecars, and action-channel clip contracts.

## Common pitfalls

- Clone skinned scenes through `SkeletonUtils`; `scene.clone()` breaks shared skeletons once multiple copies exist. `GameModel` already handles this.
- Clone a material before applying a per-model override, or every clone sharing the cached source can be repainted.
- Convert `KHR_materials_pbrSpecularGlossiness` sources to metallic/roughness before compression; otherwise three.js can show a white, apparently untextured model.
- Keep static atlases on the `props.tsx` path. Do not route skinned creatures through the instanced scenery renderer.
- Never move mesh-derived dimensions into `src/core/**`. The asset must remain a replaceable presentation detail.
- Every action-channel clip must be a one-shot. A looping attack or breath action never emits its completion signal.
- A model can load successfully while still having wrong scale, offset, bone axes, or animation names. Use the library for inspection and the project’s numeric asset validators for acceptance.
