# Sanctuary Art Direction & Visual Style Guide

**Document Version:** 1.0 (Stage 0 Baseline)  
**Author:** Antigravity (Google DeepMind)  
**Scope:** 3D Environment Art, Spatial Layout, Materials, Lighting, and Interaction Grammar for the Sanctuary Campus.

---

## 1. Visual Identity & World Setting

The Sanctuary is a **fortified highland mountain refuge** positioned on a sheltered plateau at the threshold between temperate agricultural foothills and the wild alpine peaks of the Highlands.

It is inhabited and maintained by human beastmasters, blacksmiths, scholars, and handlers who live in close, daily partnership with **adult and adolescent wyverns**. Every architectural structure, route, railing, and work area reflects this co-existence:

- **Co-scale Architecture:** Human-scale doors, tables, workbenches, and bunks sit alongside massive open wyvern landings, elevated roost perches, and broad flight corridors. Fences and low stone curbs demarcate pedestrian zones; they do not pretend to cage flying apex predators.
- **Vernacular Construction:** Heavy ashlar stone foundations, weathered timber posts, iron bracing, hand-tanned hide awnings, and sloped slate/shingle roofs built to withstand mountain winds and wyvern downwash.
- **Functional Inhabitation:** Tools, quenching tubs, fire pits, ration barrels, and nesting heather are placed where actual labor happens. Wear patterns follow physical reality (scorched earth at the forge, claw gouges on stone perches, compacted earth along the central spine).

---

## 2. Scale Sheet & Spatial Metrics

All dimensions are in standard metres ($1.0\text{ unit} = 1.0\text{ metre}$).

```
                             [ Adult Wyvern ]
                               Wingspan: 16.0m
                               Height:    4.2m
                               Length:    9.5m
                               Ground Footprint: ~6.0m radius
                                      |
                     [ Keep Gateway / Archway ]
                           Height: 5.5m - 6.5m
                           Width:  4.0m - 5.0m
                                      |
                  [ Player Character / Beastmaster ]
                            Height:  1.75m
                            Eye Level: 1.62m
                            Shoulder Width: 0.55m
                                      |
                           [ Human Furniture ]
                             Table: 0.85m - 0.95m
                             Chair/Stool: 0.45m - 0.50m
                             Fence / Parapet: 1.10m - 1.25m
                             Barrel: 1.0m height × 0.7m dia
```

### Key Dimensional Envelopes:
- **Main Walkway Spine:** Minimum $4.0\text{ m}$ clear width.
- **Secondary Service Paths:** $2.0\text{ m} - 2.5\text{ m}$ width.
- **Station Interaction Approach:** Authored interaction bubble radius $3.0\text{ m} - 4.5\text{ m}$, always approaching the front utility surface.
- **Wyvern Perch Clearance:** Minimum $6.0\text{ m}$ vertical and lateral clearance from surrounding walls and canopy.
- **Central Flight Corridor:** An uninterrupted open airway ($30\text{ m} \times 40\text{ m}$ horizontal rectangle) extending from the Keep gate south to the Flight Ring.

---

## 3. Materials & Color Palette

All assets use standard Physically Based Rendering (PBR) metallic-roughness conventions. Materials are grouped into 6 coherent families:

| Material Family | Base Color (sRGB Hex) | Metalness | Roughness | Visual Description & Texture Notes |
|---|---|---:|---:|---|
| **Dressed Fieldstone** | `#475569` to `#334155` | 0.0 | 0.80–0.90 | Local grey-blue slate and granite with light mortar seams. Moss accumulates in shaded north-facing crevices. |
| **Aged Highland Timber** | `#5c4033` to `#3e2723` | 0.0 | 0.70–0.85 | Heavy dark oak and pine beams. Weathered grey grain on exposed cuts; warm amber resin tones in sheltered joints. |
| **Blackened Iron** | `#1e293b` to `#0f172a` | 1.0 | 0.35–0.50 | Hand-forged carbonized iron strapping, nails, cauldron bodies, and anvil strike faces. Minor edge highlight. |
| **Tanned Leather / Hide** | `#8d5b4c` to `#5c3d2e` | 0.0 | 0.60–0.75 | Thick boiled leather harnesses, chest straps, canvas lean-tos, and tool wraps. |
| **Packed Loam & Ash Earth** | `#3f2e1e` to `#1c1917` | 0.0 | 0.90–0.95 | Compacted soil paths with fine pebble aggregate. Forge and burn areas transition into soot and crushed volcanic pumice. |
| **Highland Heather & Moss** | `#4d7c0f` to `#365314` | 0.0 | 0.85–0.95 | Hardy alpine tussock grass, dry straw bedding for nests, and velvet ground moss at moisture contacts. |

---

## 4. Construction Grammar & Architectural Rules

1. **Mass Sits on Stone:** Wooden posts never plunge directly into raw soil. All timber uprights terminate on dry-laid stone footings, dwarf walls, or iron shoes to prevent rot.
2. **Beveled Edges:** Every manufactured wood beam and dressed stone edge has a visible $1.5\text{ cm} - 3.0\text{ cm}$ chamfer or bevel. Avoid knife-edge CG razor corners.
3. **Overlapping Joints & Bracing:** Timber frames use visible lap joints, diagonal knee braces, and iron clavos (square-headed studs). Roof eaves overhang walls by $\ge 0.4\text{ m}$ for rain runoff.
4. **Subordinate Detail:** Secondary clutter (baskets, crates, logs) must visually cluster around structural backdrops rather than floating in path corridors.
5. **No Procedural Noise As Detail:** Surface variation must represent physical history (e.g., foot traffic, rain drip, chimney soot) rather than random Voronoi blotches.

---

## 5. Wear & Weathering Hierarchy

| Wear Zone | Physical Cause | Visual Manifestation |
|---|---|---|
| **Path Centers** | Human and wyvern footfall | Polished, compacted soil devoid of grass; exposed gravel stones. |
| **Path Edges & Fence Bases** | Low traffic, moisture retention | Overgrowing moss, small clover tufts, fallen leaves. |
| **Perch Tops & Rock Ridges** | Wyvern claw gripping | Pale chipped stone flakes, raw unweathered scratch grooves, white lime staining. |
| **Forge & Burn Range** | Flame, smoke, molten metal | Dark soot-blackened stone, ash drift on leeward walls, scorched timber ends. |
| **Hatchery & Care Court** | Thermal warmth & care activity | Warm glowing embers, clean golden straw, polished wood handling edges. |
| **Building Eaves & North Walls** | Alpine rainfall and shade | Green algae and moss streaks dripping vertically from stone seams. |

---

## 6. Lighting & Value Targets

```
  [ Daytime Sunlight: 11:00 AM ]
  Key Sun (warm gold #fff8e7, 1.4) -----> [ Structure / Wyvern ] <----- Sky Fill (cool azure #7ca0b8, 0.45)
                                                 |
                                         Cast Contact Shadow
                                         (cool slate #1e293b)

  [ Nocturnal Atmosphere: 01:00 AM ]
  Moon Fill (desaturated navy #1e293b, 0.18) + Local Warm Pools:
  - Standing Torches: #ff9933, radius 6m, flicker 4Hz
  - Scale Forge: #ff5500, radius 9m, deep ember pulse
  - Hatchery Runes: #38bdf8, radius 5m, steady arcane luminescence
```

### Grayscale / Value Check:
- Structure roofs and tops: $70\% - 85\%$ luminance in direct sun.
- Vertical shaded walls: $30\% - 45\%$ luminance.
- Deep cast ground shadows: $15\% - 25\%$ luminance.
- Pure black ($0\%$) is strictly forbidden to preserve shadow detail in WebGL.

---

## 7. Asset Audit & Station Upgrade Plan

Summary of the 11 functional sanctuary stations and their Stage 4 replacement strategy:

| Station ID | Current Placeholder | Current Visual Issue | Target Art Direction | Action |
|---|---|---|---|---|
| **`barracks`** | `prop.blockade` (Roadblock) | Spiked barricade does not read as quarters. | Timber guardhouse / barracks shelter with canvas awning, bedrolls, shield rack, and lantern. | **Replace (Top 1)** |
| **`infirmary`** | `prop.campfire` (Campfire) | Open campfire fails to convey medical healing. | Covered healer's pavilion with drying herb rack, hearth, clean water basin, and straw recovery bed. | **Replace (Top 2)** |
| **`huntingPen`** | `prop.blockade` (Roadblock) | Roadblock in an open field is completely ambiguous. | Reinforced circular stockade with heavy timber fencing, bait post, leather dummy target, and hunting horn. | **Replace (Top 3)** |
| **`burnRange`** | `prop.burn.volcano` (Mini Volcano) | Looks like a miniature toy cone on flat grass. | Fortified dragon-fire target range with obsidian deflection wall, iron target baffles, and deep ash pit. | **Replace (Top 4)** |
| **`enduranceRun`** | `prop.signpost` (Small Sign) | Tiny signpost is invisible across the commons. | Monumental mountain trailhead archway with stone mileage cairn, waypoint banner, and water trough. | **Replace (Top 5)** |
| **`warTable`** | `prop.warTable` (Wooden Table) | Plain desk lacks strategic command gravitas. | Heavy oak command table with painted campaign map, iron corner brackets, map chests, and candleholders. | **Resurface** |
| **`roster`** | `prop.lectern` (Small Desk) | Plain desk under-represents wyvern registry. | Ornate carved wooden lectern with open leather-bound registry book, inkpot, and parchment scrolls. | **Resurface** |
| **`hatchery`** | `prop.hatchery.cave` (Cave) | Downscaled cave has harsh faceted geometry. | Natural rock cavern with thermal ember hearth, straw incubation hollows, and carved runic stone arch. | **Remodel** |
| **`breeding`** | `prop.roost.plateau` (Plateau) | Good scale, but surface is generic rock. | Tiered rock plateau with claw-worn granite texture, twin runic obelisks, and heather bedding. | **Resurface** |
| **`flightRing`** | `prop.ring.columnA` (Monolith) | Strong mystic monolith silhouette. | Mystic carved stone monolith with wind streamers, boundary ring stones, and updraft markers. | **Keep / Polish** |
| **`scaleForge`** | `prop.forge.furnace` (Furnace) | Great multi-prop composition. | Stone chimney forge with protective timber lean-to, slag pile, scale-plate displays, and quench smoke. | **Keep / Polish** |

---

## 8. Asset Provenance & Licensing Record

All static scenery assets in `public/models/sanctuary.glb` derive from curated low-poly packs created by **Poly Perfect**, licensed under **Creative Commons Attribution (CC-BY 4.0)**:

1. **Low Poly Nature - Flying Islands**
   - Author: Poly Perfect (Sketchfab)
   - License: CC-BY 4.0
   - Props Extracted: Stone gate, floor tiles, stairs, campfires, stone plateau, fences, stone paths, rocks, trees, grass.
2. **Low Poly Mining, Cave & Blacksmith Pack**
   - Author: Poly Perfect (Sketchfab)
   - License: CC-BY 4.0
   - Props Extracted: Stone walls, pillars, tables, chests, barrels, crates, torches, signposts, log piles, blockades, cave entrance, small cave, furnace, anvil, trough, grindstone, tool holder, chimney, forge sign, rune stones.
3. **Low Poly Lava World**
   - Author: Poly Perfect (Sketchfab)
   - License: CC-BY 4.0
   - Props Extracted: Lava columns, burned trees, volcano, lava stones.

*Note: All extracted nodes share the common `PP_Color_Palette.png` texture atlas ($256 \times 256$), ensuring 100% material sharing across all 57 static atlas nodes.*
