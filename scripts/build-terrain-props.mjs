/* global console */
/**
 * Build the terrain-feature atlas: deadwood, dunes and geysers.
 *
 * Three traits in one file, unlike the other generated atlases which take one
 * each. All three are ground features rather than objects, all three serve
 * barrens, and wyvern already fetches seven generated GLBs at scene start —
 * splitting these into three more would cost three round trips to save nothing.
 *
 *   deadwood  forest, barrens   a standing snag and a fallen log
 *   dune      tundra, barrens   wind-drifted ridges (snow, ash or sand by tint)
 *   geyser    ashland, barrens  a sulfur cone and a mud-pot field
 *
 *   pnpm assets:terrain
 *   pnpm assets:terrain -- --preview /tmp/terrain.ppm
 */
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { CylinderGeometry, IcosahedronGeometry, MeshStandardMaterial } from 'three'
import { describe, prop, previewTarget, renderPreview, transformed, writeAtlas } from './procedural-glb.mjs'

const wood = new MeshStandardMaterial({ name: 'terrain-deadwood', color: 0x7a6f5e, roughness: 1 })
const woodDark = new MeshStandardMaterial({ name: 'terrain-deadwood-rot', color: 0x554c40, roughness: 1 })
// Pale on purpose: drifts are tinted to snow, ash or sand, and a light base
// gives the tint the most range.
const drift = new MeshStandardMaterial({ name: 'terrain-drift', color: 0xc4b596, roughness: 0.96 })
const crust = new MeshStandardMaterial({ name: 'terrain-crust', color: 0x8f8266, roughness: 1 })
const mineral = new MeshStandardMaterial({ name: 'terrain-mineral', color: 0xb8a95e, roughness: 0.85 })
const mouth = new MeshStandardMaterial({ name: 'terrain-vent-mouth', color: 0x2e2822, roughness: 1 })

/** A broken limb stub, angled off a trunk. */
function stub(y, angle, length, lean, thickness) {
  const reach = Math.cos(lean) * length * 0.5
  return transformed(
    new CylinderGeometry(0.35, 1, 1, 5),
    [Math.cos(angle) * reach, y + Math.sin(lean) * length * 0.3, Math.sin(angle) * reach],
    [thickness, length, thickness],
    [Math.sin(angle) * (Math.PI / 2 - lean), 0, -Math.cos(angle) * (Math.PI / 2 - lean)],
  )
}

/** A wind-drifted ridge: a long low mound with a sharper crest along its spine. */
function ridge(length, width, height, yaw) {
  return [
    transformed(new IcosahedronGeometry(1, 1), [0, height * 0.34, 0], [length, height, width], [0, yaw, 0]),
    transformed(new IcosahedronGeometry(1, 0), [0, height * 0.7, -width * 0.18], [length * 0.62, height * 0.5, width * 0.4], [0.06, yaw, 0]),
  ]
}

// — deadwood ----------------------------------------------------------------
const snagProp = prop('prop.terrain.snag', [
  transformed(new CylinderGeometry(0.42, 1, 1, 7), [0, 1.05, 0], [0.17, 2.1, 0.17], [0.04, 0.3, 0.05]),
  transformed(new IcosahedronGeometry(1, 0), [0, 0.1, 0], [0.3, 0.16, 0.29], [0.1, 0.8, 0.06]),
  stub(1.32, 0.8, 0.72, 0.55, 0.055),
  stub(1.66, 3.4, 0.5, 0.75, 0.045),
  stub(0.94, 5.1, 0.58, 0.4, 0.05),
], [wood, woodDark, wood, wood, woodDark], { ground: true })

const deadfallProp = prop('prop.terrain.deadfall', [
  transformed(new CylinderGeometry(0.82, 1, 1, 7), [0, 0.2, 0], [0.19, 2.3, 0.19], [Math.PI / 2, 0.22, 0]),
  transformed(new IcosahedronGeometry(1, 0), [0.12, 0.26, -1.16], [0.36, 0.34, 0.3], [0.2, 1.1, 0.15]),
  stub(0.24, 1.6, 0.62, 0.12, 0.05),
  stub(0.22, 4.4, 0.48, 0.1, 0.042),
], [wood, woodDark, woodDark, wood], { ground: true })

// — dune --------------------------------------------------------------------
const DUNE = ridge(1.55, 0.62, 0.52, 0.22)
const duneProp = prop('prop.terrain.dune', DUNE, [drift, drift], { ground: true })

const DRIFT = ridge(0.86, 0.4, 0.3, -0.5)
const driftProp = prop('prop.terrain.drift', DRIFT, [drift, drift], { ground: true })

// — geyser ------------------------------------------------------------------
const ventProp = prop('prop.terrain.vent', [
  transformed(new CylinderGeometry(0.5, 1, 1, 9), [0, 0.26, 0], [0.46, 0.52, 0.46]),
  // The mouth is recessed, so the cone reads as open rather than as a lump.
  transformed(new CylinderGeometry(1, 0.8, 1, 9), [0, 0.46, 0], [0.2, 0.14, 0.2]),
  transformed(new IcosahedronGeometry(1, 0), [0.4, 0.06, 0.26], [0.26, 0.1, 0.24], [0.1, 0.6, 0.05]),
  transformed(new IcosahedronGeometry(1, 0), [-0.36, 0.05, -0.3], [0.22, 0.09, 0.2], [0.08, 2.3, 0.05]),
], [mineral, mouth, crust, crust], { ground: true })

/**
 * Mud pots must clear the crust plate they sit on.
 *
 * The plate's own top sits at PLATE_TOP; the first version centred the pots
 * below that, so every one of them was swallowed by the plate and the prop
 * rendered as a flat dark blob.
 */
const PLATE_TOP = 0.15
const POTS = [
  [0.24, 0.2, 0.15], [-0.32, -0.13, 0.12], [0.05, -0.36, 0.11], [-0.15, 0.36, 0.12],
].flatMap(([x, z, r]) => [
  transformed(new CylinderGeometry(0.62, 1, 1, 7), [x, PLATE_TOP + 0.05, z], [r * 1.6, 0.22, r * 1.6]),
  transformed(new CylinderGeometry(1, 0.85, 1, 7), [x, PLATE_TOP + 0.15, z], [r * 0.85, 0.05, r * 0.85]),
])
const fumaroleProp = prop('prop.terrain.fumarole', [
  transformed(new IcosahedronGeometry(1, 0), [0, 0.04, 0], [0.72, PLATE_TOP - 0.04, 0.66], [0.05, 0.9, 0.04]),
  ...POTS,
], [crust, ...POTS.map((_, i) => (i % 2 ? mouth : mineral))], { ground: true })

const props = [snagProp, deadfallProp, duneProp, driftProp, ventProp, fumaroleProp]
describe(props)

const preview = previewTarget()
if (preview) await renderPreview(props, preview)

const here = path.dirname(fileURLToPath(import.meta.url))
await writeAtlas(props, path.join(here, '..', 'public', 'models', 'wyvern-terrain.glb'))
