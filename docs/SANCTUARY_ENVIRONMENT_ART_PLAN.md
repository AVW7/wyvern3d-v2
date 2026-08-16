# Sanctuary environment art — staged work orders

**Status: OPEN.** Stages 0, 1, 2, 3, 4, 5, and 6 are DONE. Stage 7 (Storytelling polish, performance, and release gate) is the next eligible stage.

This plan improves the sanctuary's spatial design, 3D asset quality, environmental realism, and
physical interaction language. It is a production plan for coding, technical-art, and environment-
art agents. It complements `docs/SANCTUARY_GAMEPLAY_PLAN.md`; it does not replace that plan's duty,
care, or reward systems.

The sanctuary already has useful foundations: a persistent editable layout, deterministic scenery,
day/night atmosphere, instanced static props, a 3.5 MB sanctuary atlas, and a 3.0 MB biome atlas.
The job is therefore not to maximize prop count. It is to make the existing campus read as one
believable, inhabited refuge with clear routes, credible construction, selective hero assets, and
interaction-ready props.

---

## HANDOFF PROTOCOL

1. Read all of `CLAUDE.md`, this document, and the relevant sections of
   `docs/SANCTUARY_GAMEPLAY_PLAN.md`, `docs/BIOME_ENHANCEMENT_PLAN.md`,
   `docs/BIOME_SYSTEM.md`, and `docs/BIOME_LIBRARY.md`.
2. Read the Blender skill/reference relevant to the stage before changing an authored asset:
   modeling for geometry, materials for surfacing, lighting for look development, and export for
   GLB delivery. Use reference → blockout → camera → light v1 → geometry → materials → light v2 →
   detail → review → export as the production order.
3. Find the first eligible row in the progress ledger not marked DONE. A stage is eligible only when
   all dependencies in its row are DONE.
4. Do only that stage. Preserve unrelated work and all player-authored layouts.
5. Run the stage checks plus the standard gates:

   ```bash
   pnpm typecheck && pnpm lint && pnpm test
   ```

6. Update the ledger row and the stage's own `Status:` line in the same commit. Record any measured
   budget change or deliberate deviation in the stage notes.

When every stage is DONE, fold durable asset and layout contracts into `CLAUDE.md`, mark this plan
CLOSED with the date, and keep it as the decision record.

---

## DESIGN CONTRACT

### Sanctuary identity

The sanctuary is a **fortified refuge at the edge of a temperate highland valley**. It should feel
maintained by people who live beside very large flying animals:

- The old stone keep is the civic and defensive anchor, not an isolated backdrop.
- Timber, local stone, blackened iron, leather, canvas, and repaired masonry form one construction
  language. New work can sit on older ruins, but every material transition needs a reason.
- Human-scale routes and workspaces sit beside much larger wyvern clearances, perches, and landing
  approaches. Fences guide movement; they do not pretend to restrain adult wyverns.
- Wear accumulates where use explains it: polished path centres, soot above fires, wet soil at
  troughs, claw marks at perches, moss on shaded stone, and wagon wear near stores.
- Biome vegetation frames the sanctuary and establishes wind, drainage, shelter, and season. It
  must not fill the campus like evenly distributed decoration.

### Spatial hierarchy

Preserve the broad topology already encoded by the current station positions, then make it legible:

1. **Northern keep and arrival court** — war table, roster, barracks, storage, and the strongest
   axial view. The keep door opens onto the main north/south spine.
2. **Sheltered care court** — infirmary, hatchery, breeding roosts, feed/water, softer light, wind
   shelter, and shorter quiet paths.
3. **Eastern craft and fire yard** — forge and burn range on mineral ground, downwind of care areas,
   with water, fuel, ash, and safe working clearances.
4. **Central flight commons** — an uncluttered visual and physical corridor for large silhouettes,
   take-off, landing, patrol views, and player orientation.
5. **Western training edge** — hunting pen and endurance trail connected to rougher terrain and the
   outward path toward the Highlands.
6. **Ecological perimeter** — terrain skirts, cliffs, wind-shaped trees, rock fields, drainage, and
   distant hills that conceal the circular world boundary.

Do not place tall canopy, suspended banners, or dense clutter inside a wyvern landing approach or
wing-sweep envelope. Main walking routes should be visibly wider and more continuous than service
paths. Exact widths and clearances are measured and approved during blockout rather than guessed in
final geometry.

### Three environment layers

| Layer | Ownership | Examples | Persistence |
|---|---|---|---|
| Ecological shell | Scene/render data | terrain skirt, cliff rim, clustered trees, grass, drainage | Derived from save seed/config |
| Functional campus | Core sanctuary layout + render catalogue | stations, fences, troughs, perches, storage | Saved and editable where appropriate |
| Activity layer | Scene/VFX/audio | smoke, embers, dust, birds, work poses, temporary carried props | Ephemeral |

An asset must not move between layers merely because implementation is convenient. In particular,
do not save hundreds of grass instances and do not derive gameplay rules from loaded mesh bounds.

### Explicit non-goals

- No photoreal texture dump that abandons the game's stylized wyvern art direction.
- No conversion of the sanctuary into a generic full-size biome or a collection of disconnected
  landmark models.
- No procedural building generator, NPC settlement simulation, seasons system, or destructible
  architecture in this plan.
- No interaction on every decorative prop. Interactive assets need a useful action and readable
  feedback; the rest remain scenery.
- No automatic relocation of a player's edited sanctuary. A redesigned master layout applies to
  new games, untouched defaults, or an explicit opt-in reset/adopt action only.
- No runtime use of GLB-derived dimensions as authoritative collision, range, or interaction data.

---

## ASSET AND INTERACTION CONTRACT

### Authored metadata

Keep rule-facing metadata independent from the GLB. Agents may refine names, but preserve this
separation:

```ts
interface SanctuaryAssetSpec {
  id: string
  atlas: 'sanctuary' | 'biomes'
  targetHeight: number
  footprint: { halfW: number; halfD: number }
  clearance: number
  materialClass: 'stone' | 'timber' | 'metal' | 'cloth' | 'earth' | 'vegetation'
  shadowClass: 'hero' | 'near' | 'none'
  anchors?: {
    playerApproach?: [number, number, number]
    interaction?: [number, number, number]
    delivery?: [number, number, number]
    wyvernPerch?: [number, number, number]
    effect?: [number, number, number]
    light?: [number, number, number]
  }
}
```

- Core owns only the logical prop id, authored footprint/radius needed for rules, functional kind,
  and persistent placement. It remains pure.
- Render/scene code owns material treatment, socket transforms, effects, and LOD presentation.
- Build-time validation compares authored targets with exported bounds and reports drift. Runtime
  code never changes gameplay dimensions because an artist re-exported a mesh.
- An interactive prop has an authored approach point and facing direction. The player should not
  activate an anvil through its rear wall merely because they entered a centre-radius circle.
- Repeated props use instancing. If a prop needs moving parts, keep the static body instanced where
  practical and render only the animated leaf/tool separately.

### Quality tiers and initial budgets

Stage 0 records real baselines; Stage 1 may tighten these numbers with evidence.

| Tier | Typical use | Geometry target | Materials/textures | Runtime rule |
|---|---|---:|---|---|
| Hero structure | keep gate, hatchery mouth, forge shelter | 15k–30k triangles | 2–4 materials, mostly 1K shared sets | 1–3 visible copies |
| Functional prop | trough, anvil, nest, perch, storage | 2k–8k triangles | 1–2 materials, 512–1K | Instanced if repeated |
| Scatter prop | rocks, grass, debris, small vegetation | ≤1k triangles | 1 material preferred, 256–512 | Instanced; distant shadows off |

- Use one metre per Blender unit, apply transforms, recalculate normals, and use clean semantic
  object names before export.
- Give manufactured edges small believable bevels; use overlaps, trim, caps, and contact geometry
  to eliminate accidental gaps.
- GLB materials use Principled BSDF. Metalness is physically categorical (normally 0 or 1), while
  roughness variation carries most wear. Bake unsupported procedural nodes to textures.
- Do not duplicate biome meshes in `sanctuary.glb`. Reuse logical ids from `biomes.glb` through the
  existing multi-atlas prop renderer.
- `sanctuary.glb` has an 8 MB soft budget and 15 MB hard cap. Any increase over the measured Stage 0
  draw-call, texture-memory, and triangle baseline needs an explicit note; the final representative
  view must remain within the Stage 0 approved percentage budget.
- Collision uses simple authored boxes/capsules/circles. Render triangles are never collision mesh.

### Interaction priority

Ship a small set of deeply readable interactions before adding breadth:

| Asset | Player affordance | World response | Gameplay seam |
|---|---|---|---|
| Supply barrel/crate | collect ration or supplies | lid/marker response; carried item appears | feed duty inventory source |
| Water/feed trough | refill, feed, or inspect | water/feed state and wyvern response | care context action |
| Nest/incubation bowl | inspect or tend egg | warmth/rune/egg feedback | hatchery panel or duty |
| Anvil/grindstone | work or inspect | short tool motion, spark/dust/audio | forge/training action |
| Perch/roost | call, groom, or rest wyvern | authored landing/rest pose | director action channel |
| Campfire/forge | tend fire or receive warmth | flame/smoke/light intensity | infirmary/forge action |

These actions depend on the context-action seam from Sanctuary Gameplay Stage 1. They must dispatch
normal intents for persistent consequences and use the existing event/flourish stream for feedback.

---

## PROGRESS LEDGER

| Stage | Work order | Depends on | Status | Notes |
|---|---|---|---|---|
| 0 | Art direction, baseline, and asset audit | — | DONE | docs/SANCTUARY_ART_DIRECTION.md, baseline fixtures in validation/sanctuary-environment/ |
| 1 | Masterplan blockout and review cameras | 0 | DONE | src/core/data/sanctuaryMasterplan.ts, camera presets in cameraStore.ts |
| 2 | Sanctuary asset catalogue and validation pipeline | 0 | DONE | scripts/sanctuary-library.json, pnpm assets:validate-sanctuary-atlas, /sanctuary-props review surface |
| 3 | Terrain and updated biome integration | 1, 2 | DONE | BIOME_SCATTER in dressing.ts, soot/moisture soil factors in terrain.ts, dual-atlas Scenery |
| 4 | Architectural kit and hero work areas | 1, 2 | DONE | StationHeroBuildings.tsx for all 11 hero stations, 5 priority replacements, clearance & flight corridor verified |
| 5 | Materials, lighting, and weathering pass | 3, 4 | DONE | Stylized water shader & pools in SanctuaryWater.tsx, multi-factor weathering & roughness in terrain.ts, atmospheric lighting and hero landmark tuning. |
| 6 | Interaction-ready prop vertical slices | 4; Sanctuary Gameplay Stage 1 | DONE | Implemented 6 priority interactive prop vertical slices (trough water shimmer, forge sparks, hatchery thermal nest, supply containers, healer hearth, perches), context action integration, and 5 unit tests in interactiveProps.test.ts. |
| 7 | Storytelling polish, performance, and release gate | 5, 6 | TODO | Final integration |

Stages 1 and 2 may be assigned to separate agents after Stage 0. Stages 3 and 4 may also proceed in
parallel after both prerequisites are DONE, provided one owns the ecological shell and the other the
functional campus. They must not edit the same manifest or layout recipe concurrently.

---

## STAGE 0 — Art direction, baseline, and asset audit

**Status: DONE**

### Goal

Turn “more realistic” into a reviewable target and measure the current sanctuary before changing it.

### Work

1. Capture the same representative route and fixed views at day, dusk, and night: keep arrival,
   main spine, central commons, care court, forge/burn yard, training edge, and perimeter.
2. Record current GLB size, logical prop count, per-prop bounds, triangle/material counts, visible
   draw calls, frame timing, texture memory where measurable, and collision/debug overlays.
3. Audit each station for silhouette, construction credibility, material consistency, readable
   entrance/approach, ground contact, player scale, wyvern clearance, and lighting.
4. Write `docs/SANCTUARY_ART_DIRECTION.md` with a compact reference board, material palette, scale
   sheet, colour/value targets, construction rules, wear rules, and annotated current screenshots.
   Store source URLs, authors, licences, and retrieval dates for every external reference or asset.
5. Identify assets to keep, resurface, remodel, replace, or retire. Prioritize false station
   stand-ins such as a blockade used as a barracks or a campfire used as an entire infirmary.
6. Create a machine-readable baseline under `validation/sanctuary-environment/` and a repeatable
   capture checklist or debug route. Do not make aesthetic changes in this stage.

### Completion criteria

- Reviewers can point to an explicit target for form, scale, value, material, and wear.
- Every current logical prop maps to an atlas node and has measured bounds/triangles/material count.
- Performance and visual comparisons can be repeated from fixed conditions.
- The highest-value five replacements and five reuse/resurface candidates are named.

### Checks

Run existing atlas validators plus the standard gates. If no sanctuary validator exists yet, record
that gap for Stage 2; do not hide it behind manual inspection.

---

## STAGE 1 — Masterplan blockout and review cameras

**Status: DONE**

### Goal

Prove navigation, hierarchy, sightlines, and wyvern scale with primitives before final assets exist.

### Work

1. Build a top-down blockout recipe for the six zones in the design contract. Preserve the keep's
   northern anchor, the main spine, the quiet east/care relationship, the east craft yard, the west
   training edge, and the open central commons unless playtest evidence requires a change.
2. Define main path, service path, station apron, player approach, wyvern rest envelope, landing
   approach, and fire/hazard clearances as named authored values rather than scattered constants.
3. Test walking loops, station discovery, label visibility, editor placement, chase camera clearance,
   and the largest wyvern silhouette. Verify that vegetation exclusions follow the same recipe.
4. Add fixed review cameras: 24–35 mm equivalents for establishing/environment views and a 50 mm
   equivalent for interaction-scale review. These cameras are developer tools, not gameplay state.
5. Decide how a new default layout is adopted. Existing edited saves remain untouched; automatic
   migration may move only exact untouched defaults and needs tests.
6. Review the blockout in monochrome and at day/night. Final meshes, textures, and decorative clutter
   are explicitly out of scope.

### Completion criteria

- A player can identify the keep, care, craft, training, and flight zones without labels in a
  monochrome review.
- Every station has a reachable approach point and every route avoids blocking colliders.
- The central commons and landing approaches remain free of tall or dense assets.
- Existing edited layouts are byte-for-byte unchanged through save migration tests.

### Checks

Add focused tests for layout recipes, exclusions, and migration behaviour; run the standard gates.

---

## STAGE 2 — Sanctuary asset catalogue and validation pipeline

**Status: DONE**

### Goal

Make asset quality, scale, provenance, bounds, sockets, and budgets reproducible rather than tribal
knowledge.

### Work

1. Extend or replace the sanctuary section of `scripts/asset-sources.json` with a manifest that can
   express source/provenance, target dimensions, triangle/material limits, atlas node, category,
   authored footprint, and named sockets. Keep licence evidence auditable.
2. Add `pnpm assets:validate-sanctuary-atlas`. It must fail on missing/duplicate nodes, invalid
   bounds, unapplied transforms, excessive triangles/materials, missing provenance, malformed
   sockets, or atlas size beyond the hard cap.
3. Add a sanctuary asset review surface showing each prop at true scale with a metre grid, bounds,
   pivot, forward direction, footprint, sockets, node/material names, and budget result.
4. Validate multi-material and instanced rendering through the existing atlas path. Keep materials
   shared by default and clone only before a local override.
5. Document the Blender-to-GLB recipe: semantic names, transforms, normals, modifier policy,
   Principled materials, baked procedural textures, colour space, texture packing, and GLB checks.
6. Keep render metadata out of `src/core/**`; expose only authored logical dimensions required by
   collision or game rules.

### Completion criteria

- One command validates every sanctuary atlas node and exits non-zero for a deliberately broken
  fixture.
- Reviewers can inspect scale, sockets, pivots, materials, and budgets without entering gameplay.
- Rebuilding or replacing a mesh cannot silently change interaction or collision dimensions.

### Checks

Run the new validator, any extraction/build command affected by the manifest, and standard gates.

---

## STAGE 3 — Terrain and updated biome integration

**Status: DONE**

### Goal

Use the updated biome library to give the sanctuary a credible highland-valley setting without
duplicating assets or obstructing play.

### Work

1. Reuse approved `biomes.glb` ids for conifers, broadleaf/gnarled trees, grass tufts, rock clusters,
   cliffs, cave rubble, the well, and amphora where they support the art direction. Do not copy them
   into the sanctuary atlas.
2. Replace the uniform woodland rim with deterministic ecological clusters driven by named rules:
   wind exposure, slope/edge distance, moisture/drainage, shade, path clearance, fire clearance, and
   wyvern flight exclusion. Preserve the save-seeded determinism contract.
3. Build layered perimeter depth: near rocks/shrubs, mid trees and cliff faces, then existing horizon
   hills. Break the circular silhouette while retaining an obvious playable boundary.
4. Add ground transitions—compacted paths, mud near water/troughs, mineral/ash soil at the forge and
   burn range, soft litter near care, and grass recovery away from traffic—through low-cost meshes,
   decals, vertex colour, or shader masks selected after profiling.
5. Keep the campus floor flat until every ground consumer has one shared sanctuary-height contract.
   If interior relief is introduced, migrate player grounding, prop placement, raycasts, colliders,
   labels, wyvern posts, and effects together and cover them with numeric tests. Edge berms and
   terrain skirts may provide depth without changing authoritative walk height.
6. Give large reused assets sanctuary-specific placement and material context, not arbitrary tinting.

### Completion criteria

- Sanctuary and full-size biome scenes visibly reuse the same approved asset library without mesh
  duplication.
- Scatter is deterministic, excludes all gameplay clearances, and reads as clustered ecology rather
  than noise.
- The boundary is concealed from normal cameras while remaining navigable and collision-safe.
- The representative view stays within the approved Stage 0 performance delta.

### Checks

Run biome and sanctuary atlas validators, scatter/height tests, and standard gates.

---

## STAGE 4 — Architectural kit and hero work areas

**Status: DONE**

### Goal

Replace symbolic station placeholders with a small coherent kit of believable spaces built for
people and wyverns.

### Work

1. Block out a reusable construction kit before hero detailing: foundations, retaining walls,
   timber posts/beams, awnings/roofs, steps/ramps, rails, gates, fences, gutters, work surfaces,
   signs, and attachment pieces.
2. Produce the five Stage 0 priority replacements first. Likely candidates are the barracks,
   infirmary shelter, hunting pen, endurance trailhead, and a clearer forge/burn separation, but the
   measured audit decides.
3. Model credible joins, thickness, support, drainage, and ground contact. Use small bevels on
   manufactured edges; remove unseen geometry; preserve silhouette where it matters.
4. Treat keep, hatchery, forge, and breeding roost as hero assemblies made from reusable kit pieces
   plus a small number of unique focal meshes. Avoid one bespoke material per building.
5. Author approach points, interaction/effect/light sockets, footprint, and clearance alongside each
   functional mesh. Validate them before decoration.
6. Export selected assets through Stage 2's pipeline and compare them in the fixed blockout cameras.
   A high-quality Cycles still may guide look development, but the browser scene is the acceptance
   authority.

### Completion criteria

- Every station reads as a place with an entrance, function, work surface, storage, and safe
  circulation—not a label attached to an unrelated prop.
- Kit reuse is visible but repetition is broken by layout, repair, props, and material variation.
- Hero and functional assets pass bounds, socket, triangle, material, and GLB validation.

### Checks

Run asset builders/validators and standard gates. Capture the fixed review cameras before and after.

---

## STAGE 5 — Materials, lighting, and weathering pass

**Status: DONE**

### Goal

Unify old and new assets under a realistic but game-readable surface and lighting language.

### Work

1. Establish shared material families for local stone, weathered timber, blackened iron/bronze,
   leather/canvas, packed earth, moss, ash, and wet surfaces. Reuse texture sets across kit pieces.
2. Use physically meaningful values: categorical metalness, varied roughness, restrained normal
   detail, correct sRGB/non-colour texture treatment, and baked maps for procedural Blender nodes.
3. Add evidence-based weathering at contacts and exposure zones. Avoid uniform edge wear, global
   grunge, or random colour tint as a substitute for material design.
4. Tune outdoor lighting as sun plus sky fill. Let torches, campfire, forge, hatchery warmth, and
   runes dominate only their local pools at dusk/night. Keep shadow softness and intensity coherent.
5. Review day, dusk, and night from fixed 24–35 mm environment cameras and 50 mm interaction views.
   Check colour, grayscale/value hierarchy, silhouette, ground contact, and prompt legibility.
6. Profile shadow casters, alpha vegetation, texture memory, and shader/material count. Disable
   distant scatter shadows before reducing hero quality.

### Completion criteria

- Old and new assets share a coherent palette without losing functional differentiation.
- Stone, wood, metal, soil, cloth, and vegetation remain identifiable in daylight and moonlight.
- Practical lights explain visible local illumination; emissive materials do not appear to glow
  without a corresponding light/effect where illumination is expected.
- Runtime screenshots—not Blender stills alone—pass the art-direction comparison and performance
  budget.

### Checks

Run atlas validators and standard gates; record representative frame and draw-call deltas.

---

## STAGE 6 — Interaction-ready prop vertical slices

**Status: DONE — 2026-08-16**

### Goal

Make six important assets feel physically usable through consistent approach, prompt, animation,
sound/VFX, state change, and reaction feedback.

### Work

1. Require Sanctuary Gameplay Stage 1's single context-action resolver. Extend that seam; do not add
   a second proximity/prompt system.
2. Implement the six priority rows in the interaction table. Each slice needs: authored approach
   point/facing, collision clearance, prompt, short action lock/timing, object response, optional
   carried visual, persistent intent when required, event/flourish, and cancellation behaviour.
3. Use the existing wyvern director/action channel for landing, rest, grooming, feeding, or reaction
   poses. Do not put per-frame transforms in core or call React/Zustand setters every frame.
4. Keep static asset bodies instanced. Animate a separate lid, tool, rune, water surface, flame, or
   effect only when the interaction needs it.
5. Prevent competing prompts by ranking approach anchors with the existing context resolver. Test
   blocked, rear-side, occupied, and out-of-range cases.
6. Meet accessibility requirements: input remapping path, non-colour state cues, persistent prompt
   long enough to read, audio-independent completion feedback, and a reduced-motion-safe response.

### Completion criteria

- All six interactions are understandable without opening a panel first.
- Actions cannot be triggered through solid geometry or from an ambiguous side.
- Persistent results travel through intent → execution and replay; presentation remains derived.
- No interaction introduces a per-frame React state update or a second event queue.

### Checks

Add focused resolver, execution, replay, and interaction-state tests. Run `pnpm sim:battle` if any
resource, bond, hunger, injury, or training value changes, then run standard gates.

---

## STAGE 7 — Storytelling polish, performance, and release gate

**Status: TODO**

### Goal

Add restrained signs of life, then prove the finished sanctuary is clearer and higher quality
without losing responsiveness or save safety.

### Work

1. Add story clusters with explicit purpose: repaired wall and scaffold, feed preparation, healer's
   drying rack, forge fuel/slag, hatchery bedding, flight gear, weather protection, and waste/water
   handling. Each cluster gets one focal item and limited support clutter.
2. Add restrained ambient motion and effects: banner/wind response, chimney smoke, drifting ash,
   insects/birds at the perimeter, water ripple, dust at landings, and local activity audio. Reuse
   existing weather and event systems; do not create global duplicates.
3. Audit the editor catalogue. Keep functional footprints readable, group variants sensibly, and
   prevent storage/placeable scenery from violating route or flight exclusions.
4. Add distance/importance-based LOD, shadow, and effect policies. Preserve instancing and the
   persistent Canvas; avoid mounting/unmounting whole environment trees during normal movement.
5. Repeat the Stage 0 route, screenshots, metrics, collision pass, save migration tests, and
   keyboard/controller interaction pass. Compare day, dusk, and night side by side.
6. Update `docs/MODEL_LIBRARY.md`, `docs/BIOME_LIBRARY.md`, credits/provenance, `CLAUDE.md`, and this
   ledger with the final asset, layout, and interaction entry points.

### Release gate

- Every station is reachable, identifiable, and visually tied to its function.
- No edited save moves unexpectedly; default adoption and reset behaviour are explicit.
- Atlas validators, standard gates, and any affected simulation gate pass.
- No missing textures, white spec/gloss assets, invalid bounds, buried/floating props, broken
  colliders, vegetation in flight clearances, prompt-through-wall cases, or WebGL warnings remain.
- The fixed-view performance metrics remain within the Stage 0 approved budget and the sanctuary
  atlas remains below the hard cap.
- A reviewer can explain the sanctuary's zoning, construction logic, daily activity, and major
  interactions from the world itself rather than from labels alone.

