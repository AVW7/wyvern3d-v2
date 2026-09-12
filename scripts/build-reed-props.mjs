/* global console */
/**
 * Build the reed atlas: a reed bed, cattails and a sedge tussock.
 *
 * Claimed by marsh and swamp, the two biomes whose profiles call for standing
 * water with vegetation growing out of it. Nothing in the curated atlas grows
 * from water — its trees are gnarled hardwoods that stand beside a fen, not in
 * one.
 *
 * These are the first props in the generated set that sway: bone, ruin, water,
 * fungus and worked stone are all rigid, but a reed bed that does not move
 * reads as plastic. Their layers carry `wind`, which props.tsx applies as
 * displacement scaled by height above the prop's own base — so grounding at
 * y=0 is what keeps the roots still while the tips move.
 *
 *   pnpm assets:reed
 *   pnpm assets:reed -- --preview /tmp/reed.ppm
 */
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { CylinderGeometry, IcosahedronGeometry, MeshStandardMaterial } from 'three'
import { describe, prop, previewTarget, renderPreview, transformed, writeAtlas } from './procedural-glb.mjs'

const blade = new MeshStandardMaterial({ name: 'reed-blade', color: 0x6f7a4a, roughness: 0.9 })
const dry = new MeshStandardMaterial({ name: 'reed-dry', color: 0x8a8253, roughness: 0.95 })
const head = new MeshStandardMaterial({ name: 'reed-head', color: 0x6b5334, roughness: 0.92 })
const root = new MeshStandardMaterial({ name: 'reed-root', color: 0x40482f, roughness: 1 })

/** A single stalk, tapering to a point and leaning away from the clump centre. */
function stalk(x, z, height, lean, yaw, thickness = 0.018) {
  return transformed(
    new CylinderGeometry(0.08, 1, 1, 4),
    [x, height * 0.5, z],
    [thickness, height, thickness],
    [Math.sin(yaw) * lean, yaw, -Math.cos(yaw) * lean],
  )
}

/**
 * Deterministic spread over a disc — the sunflower placement.
 *
 * Radius goes as sqrt(i / count) so the stalks spread evenly instead of
 * crowding the middle, and the angle is the golden angle so successive stalks
 * land far apart. An earlier version used `(i * 7) % count` for the radius,
 * which silently collapsed half a 14-stalk bed onto two rings when 7 shared a
 * factor with the count.
 */
function spread(index, count, radius) {
  const angle = index * 2.39996
  const r = radius * Math.sqrt((index + 0.5) / count)
  return [Math.cos(angle) * r, Math.sin(angle) * r, angle]
}

// A reed bed: the workhorse, dense enough to hide a waterline.
const BED = Array.from({ length: 14 }, (_, i) => {
  const [x, z, angle] = spread(i, 14, 0.44)
  return stalk(x, z, 0.75 + ((i * 5) % 7) * 0.09, 0.06 + (i % 4) * 0.03, angle)
})
const bedProp = prop('prop.reed.bed', [
  transformed(new IcosahedronGeometry(1, 0), [0, 0.04, 0], [0.36, 0.07, 0.34], [0.1, 0.6, 0.05]),
  ...BED,
], [root, ...BED.map((_, i) => (i % 5 === 0 ? dry : blade))], { ground: true })

// Cattails: taller, with the seed head that makes the silhouette read.
const CATTAILS = Array.from({ length: 7 }, (_, i) => {
  const [x, z, angle] = spread(i, 7, 0.34)
  const height = 1.15 + ((i * 3) % 5) * 0.11
  return {
    stalk: stalk(x, z, height, 0.05 + (i % 3) * 0.025, angle, 0.02),
    head: transformed(
      new IcosahedronGeometry(1, 0),
      [x + Math.sin(angle) * height * 0.05, height * 0.86, z],
      [0.055, 0.19, 0.055],
      [0, angle, 0],
    ),
  }
})
const cattailProp = prop('prop.reed.cattail', [
  transformed(new IcosahedronGeometry(1, 0), [0, 0.035, 0], [0.28, 0.06, 0.27], [0.08, 1.4, 0.06]),
  ...CATTAILS.map((c) => c.stalk),
  ...CATTAILS.map((c) => c.head),
], [root, ...CATTAILS.map(() => blade), ...CATTAILS.map(() => head)], { ground: true })

// A sedge tussock: low ground cover for the margins, where a bed would be too tall.
const TUSSOCK = Array.from({ length: 11 }, (_, i) => {
  const [x, z, angle] = spread(i, 11, 0.3)
  return stalk(x, z, 0.34 + ((i * 4) % 5) * 0.07, 0.14 + (i % 4) * 0.06, angle, 0.016)
})
const tussockProp = prop('prop.reed.tussock', [
  transformed(new IcosahedronGeometry(1, 0), [0, 0.03, 0], [0.24, 0.06, 0.23], [0.12, 2.1, 0.08]),
  ...TUSSOCK,
], [root, ...TUSSOCK.map((_, i) => (i % 4 === 0 ? dry : blade))], { ground: true })

const props = [bedProp, cattailProp, tussockProp]
describe(props)

const preview = previewTarget()
if (preview) await renderPreview(props, preview)

const here = path.dirname(fileURLToPath(import.meta.url))
await writeAtlas(props, path.join(here, '..', 'public', 'models', 'wyvern-reed.glb'))
