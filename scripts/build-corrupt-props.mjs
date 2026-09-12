/* global console */
/**
 * Build the corruption atlas: a spined growth, a ground scar and a swollen bloom.
 *
 * Claimed by jungle, barrens and spire — blight on rainforest soil, a taint
 * spreading through sulfur crust, and something leaking out of a hostile
 * pillar. The shared reading is diseased matter forcing its way up through the
 * ground, so that is what the geometry is.
 *
 * Emissive is kept deliberately low here, unlike the arcane atlas. A tint
 * reaches base colour but not glow, and these three biomes want corruption in
 * three different colours — sulfur yellow, rot green, violet. Loading the look
 * into an emissive would freeze it at one hue in all three.
 *
 *   pnpm assets:corrupt
 *   pnpm assets:corrupt -- --preview /tmp/corrupt.ppm
 */
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { BoxGeometry, CylinderGeometry, IcosahedronGeometry, MeshStandardMaterial } from 'three'
import { describe, prop, previewTarget, renderPreview, transformed, writeAtlas } from './procedural-glb.mjs'

const flesh = new MeshStandardMaterial({ name: 'corrupt-flesh', color: 0x5a4a52, roughness: 0.9 })
const crust = new MeshStandardMaterial({ name: 'corrupt-crust', color: 0x6b5f4a, roughness: 1 })
const vein = new MeshStandardMaterial({
  name: 'corrupt-vein', color: 0xb8c98a, roughness: 0.6, emissive: 0x2a3312, emissiveIntensity: 1,
})

/** A spine: a tapered stalk leaning out of the mound. */
function spine(angle, lean, height, thickness) {
  const reach = Math.sin(lean) * height * 0.5
  return transformed(
    new CylinderGeometry(0.12, 1, 1, 6),
    [Math.cos(angle) * reach, height * 0.5, Math.sin(angle) * reach],
    [thickness, height, thickness],
    [Math.sin(angle) * lean, 0, -Math.cos(angle) * lean],
  )
}

/** A lump of diseased matter, settled rather than balanced. */
function lump(x, y, z, size, squash = 0.8) {
  return transformed(
    new IcosahedronGeometry(1, 0),
    [x, y, z],
    [size, size * squash, size * 0.92],
    [0.2, x + z, 0.15],
  )
}

// Spined growth: the silhouette piece.
// Thickness matters more than height here. Slender spines read as grass at
// scatter distance, and `grass` and `reed` are traits these props must not
// accidentally satisfy — corruption has to look like it forced its way up.
const SPINES = [
  spine(0.4, 0.30, 0.88, 0.095),
  spine(1.9, 0.42, 0.64, 0.082),
  spine(3.3, 0.24, 0.78, 0.088),
  spine(4.6, 0.5, 0.5, 0.072),
  spine(5.6, 0.34, 0.6, 0.078),
]
const growthProp = prop('prop.corrupt.growth', [
  lump(0, 0.13, 0, 0.34, 0.55),
  ...SPINES,
  lump(0.3, 0.09, 0.22, 0.16),
  lump(-0.26, 0.08, -0.2, 0.13),
], [crust, ...SPINES.map((_, i) => (i % 2 ? flesh : vein)), crust, crust], { ground: true })

// A ground scar: two crust lips with a seam of matter between them.
const scarProp = prop('prop.corrupt.scar', [
  transformed(new BoxGeometry(1, 1, 1), [-0.20, 0.07, 0], [0.30, 0.15, 1.55], [0, 0.06, -0.25]),
  transformed(new BoxGeometry(1, 1, 1), [0.21, 0.06, 0.05], [0.28, 0.13, 1.45], [0, -0.05, 0.28]),
  transformed(new BoxGeometry(1, 1, 1), [0, 0.035, 0.02], [0.17, 0.06, 1.5]),
  lump(0.04, 0.06, 0.86, 0.16),
  lump(-0.1, 0.05, -0.82, 0.14),
  lump(0.32, 0.05, -0.38, 0.11),
], [crust, crust, vein, crust, crust, flesh], { ground: true })

// A swollen bloom: rounded mass on a short stalk, with lesser sacs at its foot.
const bloomProp = prop('prop.corrupt.bloom', [
  transformed(new CylinderGeometry(0.75, 1, 1, 6), [0, 0.11, 0], [0.15, 0.22, 0.15]),
  transformed(new IcosahedronGeometry(1, 1), [0, 0.46, 0], [0.33, 0.36, 0.31], [0.15, 0.4, 0.1]),
  transformed(new IcosahedronGeometry(1, 0), [0.02, 0.74, 0.01], [0.11, 0.09, 0.1]),
  lump(0.3, 0.11, 0.16, 0.18),
  lump(-0.24, 0.1, -0.19, 0.15),
  lump(0.05, 0.08, -0.31, 0.12),
], [crust, flesh, vein, flesh, flesh, crust], { ground: true })

const props = [growthProp, scarProp, bloomProp]
describe(props)

const preview = previewTarget()
if (preview) await renderPreview(props, preview)

const here = path.dirname(fileURLToPath(import.meta.url))
await writeAtlas(props, path.join(here, '..', 'public', 'models', 'wyvern-corrupt.glb'))
