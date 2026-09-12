/* global console */
/**
 * Build the freshwater atlas: standing and running water for wooded biomes.
 *
 * Forest and jungle claim `freshwater` in their character profile and have no
 * water of any kind — no dressing prop depicts it and, unlike marsh, swamp,
 * coast and ashland, neither biome gets a water body from biomeWater.ts. These
 * props are that water.
 *
 * The surface is deliberately **opaque**. Props are drawn through InstancedMesh,
 * where per-instance transparency sorting is unreliable and a translucent disc
 * flickers against the terrain behind it; a dark, low-roughness surface reads as
 * water without the sorting problem. Per-biome colour comes from BiomeLayer's
 * `color` tint, not from a second material here.
 *
 *   pnpm assets:water
 *   pnpm assets:water -- --preview /tmp/water.ppm
 */
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { BoxGeometry, CylinderGeometry, IcosahedronGeometry, MeshStandardMaterial, TorusGeometry } from 'three'
import { describe, prop, previewTarget, renderPreview, transformed, writeAtlas } from './procedural-glb.mjs'

const water = new MeshStandardMaterial({ name: 'water', color: 0x2e5a52, roughness: 0.08, metalness: 0.2 })
const bank = new MeshStandardMaterial({ name: 'water-bank', color: 0x4a3d2e, roughness: 1 })
const stone = new MeshStandardMaterial({ name: 'water-stone', color: 0x6b6459, roughness: 0.92 })

/** Vertical squash on the banks — a full-round tube reads as a pipe, not a lip. */
const BANK_SQUASH = 0.55

/**
 * A ring of wet earth around a pool.
 *
 * `transformed` composes scale *before* rotation, so the squash has to be
 * applied on the torus's local Z — the tube axis — and not on Y. Squashing Y
 * flattens the ring into an ellipse and leaves the tube full round, which then
 * rotates to hang a full tube-radius below the ground plane.
 */
function bankRing(radius, tube, segments) {
  return transformed(
    new TorusGeometry(radius, tube, 4, segments),
    [0, tube * BANK_SQUASH, 0],
    [1, 1, BANK_SQUASH],
    [Math.PI / 2, 0, 0],
  )
}

/**
 * A stone set into the bank, at an angle around the rim.
 *
 * Seated at three quarters of its own half-height so the yaw and the slight
 * roll cannot tip a corner under the ground plane.
 */
function rimStone(radius, angle, size) {
  return transformed(
    new IcosahedronGeometry(1, 0),
    [Math.cos(angle) * radius, size * 0.78, Math.sin(angle) * radius],
    [size, size * 0.72, size * 0.9],
    [0, angle, 0.2],
  )
}

// A woodland pool: still water held in a ring of wet earth.
const poolProp = prop('prop.water.pool', [
  transformed(new CylinderGeometry(1, 1, 1, 16), [0, 0.07, 0], [1.0, 0.02, 1.0]),
  bankRing(1.05, 0.17, 16),
  rimStone(1.02, 0.7, 0.15),
  rimStone(1.05, 2.9, 0.12),
  rimStone(1.0, 4.6, 0.13),
], [water, bank, stone, stone, stone])

// A creek: a run of water between two low banks, for sloping ground.
const creekProp = prop('prop.water.creek', [
  transformed(new BoxGeometry(1, 1, 1), [0, 0.06, 0], [0.86, 0.02, 2.9]),
  transformed(new CylinderGeometry(1, 1, 1, 8), [-0.52, 0.16 * BANK_SQUASH, 0], [0.16, 3.0, 0.16 * BANK_SQUASH], [Math.PI / 2, 0, 0]),
  transformed(new CylinderGeometry(1, 1, 1, 8), [0.52, 0.16 * BANK_SQUASH, 0], [0.16, 3.0, 0.16 * BANK_SQUASH], [Math.PI / 2, 0, 0]),
  rimStone(0.44, 1.1, 0.13),
  rimStone(0.5, 4.3, 0.11),
], [water, bank, bank, stone, stone])

// A puddle: thin ground scatter that ties the larger pieces together.
const puddleProp = prop('prop.water.puddle', [
  transformed(new CylinderGeometry(1, 1, 1, 12), [0, 0.04, 0], [0.42, 0.015, 0.42]),
  bankRing(0.44, 0.09, 12),
  rimStone(0.43, 2.2, 0.08),
], [water, bank, stone])

const props = [poolProp, creekProp, puddleProp]
describe(props)

const preview = previewTarget()
if (preview) await renderPreview(props, preview, { tint: [150, 190, 185] })

const here = path.dirname(fileURLToPath(import.meta.url))
await writeAtlas(props, path.join(here, '..', 'public', 'models', 'wyvern-water.glb'))
