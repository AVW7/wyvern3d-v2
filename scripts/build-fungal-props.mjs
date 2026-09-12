/* global console */
/**
 * Build the fungal atlas: mushroom clusters, bracket fungus and a giant cap.
 *
 * Three biomes claim `fungal` — swamp, cavern and jungle — and no prop in any
 * atlas depicts one. The three places are very different (a black fen, a
 * crystal-lit cave, a hot rainforest), so the geometry stays neutral and each
 * biome supplies its own colour through BiomeLayer's `color` tint.
 *
 * Caps carry a faint emissive. A cavern is lit by crystal and little else, and
 * an unlit mushroom there is a dark lump; the value is low enough that it does
 * not glow in daylight biomes.
 *
 *   pnpm assets:fungal
 *   pnpm assets:fungal -- --preview /tmp/fungal.ppm
 */
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { CylinderGeometry, IcosahedronGeometry, MeshStandardMaterial } from 'three'
import { describe, prop, previewTarget, renderPreview, transformed, writeAtlas } from './procedural-glb.mjs'

const cap = new MeshStandardMaterial({
  name: 'fungal-cap', color: 0xb9b19a, roughness: 0.78, emissive: 0x24332b, emissiveIntensity: 1,
})
const stem = new MeshStandardMaterial({ name: 'fungal-stem', color: 0xcfc6ae, roughness: 0.9 })
const gill = new MeshStandardMaterial({ name: 'fungal-gill', color: 0x6b5f4d, roughness: 0.95 })
const wood = new MeshStandardMaterial({ name: 'fungal-wood', color: 0x4a3b2c, roughness: 1 })

/**
 * One mushroom, based at y=0.
 *
 * Proportions are fixed fractions of `height` so a 0.3 m and a 1.8 m cap read
 * as the same organism at different ages, rather than as two unrelated props.
 */
function mushroom(x, z, height, capRadius, lean = 0) {
  const stemTop = height * 0.62
  return [
    transformed(new CylinderGeometry(1, 1.25, 1, 6), [x, stemTop / 2, z], [capRadius * 0.2, stemTop, capRadius * 0.2], [0, 0, lean]),
    transformed(new CylinderGeometry(1, 1, 1, 9), [x, stemTop, z], [capRadius * 0.92, 0.015, capRadius * 0.92], [0, 0, lean]),
    transformed(new CylinderGeometry(0.08, 1, 1, 9), [x, stemTop + height * 0.17, z], [capRadius, height * 0.34, capRadius], [0, 0, lean]),
  ]
}

/** A bracket growing out of a stump, tilted so its face catches the light. */
function bracket(angle, y, reach, size) {
  return transformed(
    new CylinderGeometry(1, 1, 1, 8),
    [Math.cos(angle) * reach, y, Math.sin(angle) * reach],
    [size, 0.03, size * 0.8],
    [0.22 * Math.sin(angle), -angle, 0.22 * Math.cos(angle)],
  )
}

// The workhorse: a scattered cluster of mixed ages.
const CLUSTER = [
  ...mushroom(0, 0, 0.62, 0.21),
  ...mushroom(-0.26, 0.14, 0.44, 0.16, 0.14),
  ...mushroom(0.22, -0.18, 0.38, 0.14, -0.11),
  ...mushroom(0.08, 0.30, 0.28, 0.11, 0.08),
  ...mushroom(-0.30, -0.22, 0.22, 0.09, -0.16),
]
const clusterProp = prop('prop.fungal.cluster', CLUSTER, CLUSTER.map((_, i) => [stem, gill, cap][i % 3]))

// Bracket fungus on a rotting stump — the form that needs deadwood to sit on.
const shelfProp = prop('prop.fungal.shelf', [
  transformed(new CylinderGeometry(0.82, 1, 1, 7), [0, 0.23, 0], [0.17, 0.46, 0.17]),
  transformed(new IcosahedronGeometry(1, 0), [0, 0.47, 0], [0.15, 0.05, 0.15]),
  bracket(0.4, 0.34, 0.16, 0.19),
  bracket(2.1, 0.24, 0.15, 0.16),
  bracket(3.7, 0.36, 0.16, 0.14),
  bracket(5.2, 0.17, 0.15, 0.17),
], [wood, wood, cap, cap, cap, cap])

// A single tall cap, for the biomes where fungus is the canopy rather than cover.
const GIANT = [
  ...mushroom(0, 0, 1.75, 0.62),
  ...mushroom(0.52, 0.34, 0.54, 0.19, 0.18),
  ...mushroom(-0.44, -0.3, 0.4, 0.15, -0.2),
]
const giantProp = prop('prop.fungal.giant', GIANT, GIANT.map((_, i) => [stem, gill, cap][i % 3]))

const props = [clusterProp, shelfProp, giantProp]
describe(props)

const preview = previewTarget()
if (preview) await renderPreview(props, preview)

const here = path.dirname(fileURLToPath(import.meta.url))
await writeAtlas(props, path.join(here, '..', 'public', 'models', 'wyvern-fungal.glb'))
