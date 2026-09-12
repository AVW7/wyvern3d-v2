/* global console */
/**
 * Build the arcane atlas: a runestone, a ritual circle and a floating focus.
 *
 * Claimed by cavern, grove and spire — a crystal grotto, a sacred wood and a
 * hostile citadel. What those three share is worked stone that carries light,
 * so that is what the geometry is; the difference between a fairy ring and a
 * ward is the biome tint and what stands around it.
 *
 * The glyph and core materials carry a real emissive. A BiomeLayer `color`
 * tint multiplies the base colour only, so the glow stays the same hue in every
 * biome while the stone around it shifts — which is the right way round: an
 * arcane light reads as its own thing, not as a property of the rock.
 *
 *   pnpm assets:arcane
 *   pnpm assets:arcane -- --preview /tmp/arcane.ppm
 */
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { BoxGeometry, ConeGeometry, CylinderGeometry, Euler, IcosahedronGeometry, MeshStandardMaterial, Vector3 } from 'three'
import { describe, prop, previewTarget, renderPreview, transformed, writeAtlas } from './procedural-glb.mjs'

const rock = new MeshStandardMaterial({ name: 'arcane-stone', color: 0x4e4a58, roughness: 0.9 })
const glyph = new MeshStandardMaterial({
  name: 'arcane-glyph', color: 0x8d7de0, roughness: 0.35, emissive: 0x5a49b4, emissiveIntensity: 1,
})
const core = new MeshStandardMaterial({
  name: 'arcane-core', color: 0xc9bcff, roughness: 0.2, emissive: 0x8a76ff, emissiveIntensity: 1.4,
})

/** A settled stone, turned off-square so a ring of them is not a machine part. */
function stoneAt(x, z, size, yaw, tilt = 0.1) {
  return transformed(
    new IcosahedronGeometry(1, 0),
    [x, size * 0.5, z],
    [size * 0.8, size, size * 0.7],
    [tilt, yaw, tilt * 0.6],
  )
}

const LEAN = 0.07
const YAW = 0.18
const SLAB = { width: 0.44, height: 1.2, depth: 0.26, centre: 0.62 }
const SLAB_POSE = new Euler(0, YAW, LEAN)

/**
 * A cut glyph on the face of the leaning slab.
 *
 * Both the mark's position and its orientation go through the slab's own pose.
 * Placing it in world space instead — which is what the first version did —
 * leaves the marks square to the world while the stone leans and turns away
 * from them, so they sink inside it and the runestone renders as a bare rock.
 *
 * `face` picks which broad side to cut. Both get marked: biomeScatter yaws
 * every instance by its index, so a stone carved on one side only would render
 * blank about half the time.
 */
function glyphMark(alongFace, upFace, width, height, face = 1) {
  const offset = new Vector3(alongFace, upFace, face * (SLAB.depth / 2 + 0.015)).applyEuler(SLAB_POSE)
  return transformed(
    new BoxGeometry(1, 1, 1),
    [offset.x, SLAB.centre + offset.y, offset.z],
    [width, height, 0.03],
    [SLAB_POSE.x, SLAB_POSE.y, SLAB_POSE.z],
  )
}

// A standing stone, leaning, cut with four glowing marks.
const runestoneProp = prop('prop.arcane.runestone', [
  transformed(new BoxGeometry(1, 1, 1), [0, SLAB.centre, 0], [SLAB.width, SLAB.height, SLAB.depth], [0, YAW, LEAN]),
  glyphMark(-0.02, 0.36, 0.26, 0.06),
  glyphMark(0.04, 0.19, 0.17, 0.06),
  glyphMark(-0.04, 0.02, 0.23, 0.06),
  glyphMark(0.02, -0.17, 0.14, 0.06),
  glyphMark(0.03, 0.30, 0.22, 0.06, -1),
  glyphMark(-0.03, 0.11, 0.15, 0.06, -1),
  glyphMark(0.02, -0.08, 0.24, 0.06, -1),
  stoneAt(0.36, 0.22, 0.22, 0.7),
  stoneAt(-0.32, -0.26, 0.18, 2.4),
], [rock, glyph, glyph, glyph, glyph, glyph, glyph, glyph, rock, rock], { ground: true })

// A ritual circle: eight set stones around a lit floor disc.
const RING = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * Math.PI * 2
  return stoneAt(Math.cos(angle) * 0.95, Math.sin(angle) * 0.95, 0.24 + (i % 3) * 0.05, angle, 0.14)
})
const circleProp = prop('prop.arcane.circle', [
  ...RING,
  transformed(new CylinderGeometry(1, 1, 1, 14), [0, 0.012, 0], [0.52, 0.024, 0.52]),
], [...RING.map(() => rock), glyph], { ground: true })

// A focus: a shard held above its plinth, with three lesser shards around it.
const ORBIT = [0.6, 2.7, 4.6].map((angle, i) => transformed(
  new ConeGeometry(1, 1, 5),
  [Math.cos(angle) * 0.34, 0.92 + i * 0.11, Math.sin(angle) * 0.34],
  [0.07, 0.19, 0.07],
  [0.5, angle, 0.3],
))
const focusProp = prop('prop.arcane.focus', [
  transformed(new CylinderGeometry(0.72, 1, 1, 8), [0, 0.24, 0], [0.32, 0.48, 0.32]),
  transformed(new CylinderGeometry(1, 1, 1, 8), [0, 0.5, 0], [0.24, 0.06, 0.24]),
  // Two cones base to base: a bipyramid, hanging clear of the plinth.
  transformed(new ConeGeometry(1, 1, 6), [0, 1.14, 0], [0.2, 0.34, 0.2]),
  transformed(new ConeGeometry(1, 1, 6), [0, 0.88, 0], [0.2, 0.34, 0.2], [Math.PI, 0, 0]),
  ...ORBIT,
], [rock, rock, core, core, ...ORBIT.map(() => glyph)], { ground: true })

const props = [runestoneProp, circleProp, focusProp]
describe(props)

const preview = previewTarget()
if (preview) await renderPreview(props, preview)

const here = path.dirname(fileURLToPath(import.meta.url))
await writeAtlas(props, path.join(here, '..', 'public', 'models', 'wyvern-arcane.glb'))
