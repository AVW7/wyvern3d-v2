/* global console */
/**
 * Build the ruin atlas: a broken column, a wall fragment and foundation rubble.
 *
 * Three biomes claim `ruin` — coast, moor and jungle — and between them that is
 * drowned masonry on a tide line, a collapsed croft on a heath, and stonework
 * under vines. Nothing in the geometry is specific to any of them: it is
 * weathered dressed stone, and each biome supplies the tint.
 *
 * Broken edges are built from stacked blocks of differing heights rather than
 * cut into a slab. There is no CSG here, so a jagged profile has to be
 * assembled rather than subtracted.
 *
 *   pnpm assets:ruin
 *   pnpm assets:ruin -- --preview /tmp/ruin.ppm
 */
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { BoxGeometry, CylinderGeometry, IcosahedronGeometry, MeshStandardMaterial } from 'three'
import { describe, prop, previewTarget, renderPreview, transformed, writeAtlas } from './procedural-glb.mjs'

const stone = new MeshStandardMaterial({ name: 'ruin-stone', color: 0x9a978c, roughness: 0.95 })
const shadowed = new MeshStandardMaterial({ name: 'ruin-stone-weathered', color: 0x6e6b62, roughness: 1 })

/** A dressed block, seated on the ground and turned slightly off-square. */
function block(x, z, width, height, depth, yaw = 0) {
  return transformed(new BoxGeometry(1, 1, 1), [x, height / 2, z], [width, height, depth], [0, yaw, 0])
}

/** A loose stone, settled into the ground rather than balanced on it. */
function stoneAt(x, z, size, yaw) {
  return transformed(
    new IcosahedronGeometry(1, 0),
    [x, size * 0.42, z],
    [size, size * 0.55, size * 0.86],
    [0.12, yaw, 0.09],
  )
}

// A broken column: a standing stub, its fallen upper section, and the chips.
const columnProp = prop('prop.ruin.column', [
  block(0, 0, 0.46, 0.14, 0.46, 0.12),
  transformed(new CylinderGeometry(1, 1.08, 1, 8), [0, 0.62, 0], [0.155, 0.98, 0.155]),
  // The fracture: a shallow disc set at an angle, so the shaft does not end flat.
  transformed(new CylinderGeometry(1, 1, 1, 8), [0.02, 1.10, -0.01], [0.15, 0.07, 0.15], [0.22, 0.4, 0.14]),
  transformed(new CylinderGeometry(1, 1, 1, 8), [0.62, 0.15, 0.34], [0.145, 0.86, 0.145], [Math.PI / 2, 0, 0.9]),
  stoneAt(-0.42, 0.3, 0.2, 0.8),
  stoneAt(0.3, -0.4, 0.16, 2.1),
], [shadowed, stone, shadowed, stone, shadowed, shadowed], { ground: true })

// A wall fragment. The stepped block heights are the broken top edge.
const wallProp = prop('prop.ruin.wall', [
  block(-0.60, 0, 0.32, 0.88, 0.30, 0.03),
  block(-0.28, 0.01, 0.32, 0.72, 0.29, -0.02),
  block(0.04, -0.01, 0.32, 0.90, 0.30, 0.04),
  block(0.36, 0.01, 0.32, 0.54, 0.28, -0.03),
  block(0.66, 0, 0.30, 0.34, 0.29, 0.05),
  stoneAt(0.98, 0.16, 0.24, 1.2),
  stoneAt(-0.86, -0.22, 0.2, 2.6),
], [stone, shadowed, stone, shadowed, stone, shadowed, shadowed], { ground: true })

// Foundation rubble: the outline of something that is otherwise gone.
const rubbleProp = prop('prop.ruin.rubble', [
  block(-0.40, -0.22, 0.44, 0.16, 0.26, 0.08),
  block(0.06, -0.30, 0.38, 0.13, 0.24, -0.14),
  block(0.44, 0.02, 0.30, 0.18, 0.26, 0.31),
  block(-0.18, 0.34, 0.40, 0.12, 0.22, -0.06),
  stoneAt(0.2, 0.36, 0.22, 0.5),
  stoneAt(-0.5, 0.16, 0.18, 2.9),
], [stone, shadowed, stone, shadowed, shadowed, stone], { ground: true })

const props = [columnProp, wallProp, rubbleProp]
describe(props)

const preview = previewTarget()
if (preview) await renderPreview(props, preview)

const here = path.dirname(fileURLToPath(import.meta.url))
await writeAtlas(props, path.join(here, '..', 'public', 'models', 'wyvern-ruin.glb'))
