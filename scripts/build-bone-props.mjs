/* global console, process */
/**
 * Build the bone-scatter atlas.
 *
 * Bones were the highest-leverage missing prop in the biome dressing: four
 * biomes claim `bone` in their character profile (mountain, ashland, tundra,
 * barrens) and no prop in the 24-prop curated atlas depicted one. Barrens
 * showed none of its five traits at all, which is why it read as generic
 * desert rather than a poisoned flat.
 *
 *   pnpm assets:bones
 *   pnpm assets:bones -- --preview /tmp/bones.ppm
 */
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  MeshStandardMaterial,
  TorusGeometry,
} from 'three'
import { describe, prop, previewTarget, renderPreview, transformed, writeAtlas } from './procedural-glb.mjs'

const bone = new MeshStandardMaterial({ name: 'bone', color: 0xcfc3a4, roughness: 0.94 })
const weathered = new MeshStandardMaterial({ name: 'bone-weathered', color: 0xa3977c, roughness: 1 })

/** Half the tube thickness, so an arc's lowest surface lands exactly on y=0. */
const RIB_TUBE = 0.03

/**
 * A rib: a half-hoop hanging off the spine, opening downward.
 *
 * The torus is authored in the XY plane, so rotating Z by PI flips the arc to
 * hang below the axis and leaves it spanning X — across the body, with the
 * spine running along Z. Rotating about Y instead lays the ribs along the body
 * and the cage collapses to a 0.3 m sliver.
 */
function rib(z, radius) {
  return transformed(
    new TorusGeometry(radius, RIB_TUBE, 4, 9, Math.PI),
    [0, radius + RIB_TUBE, z],
    [1, 1, 1],
    [0, 0, Math.PI],
  )
}

/** A long bone lying flat, knobbed at both ends. */
function longBone(position, length, yaw) {
  const half = length / 2
  return [
    transformed(new CylinderGeometry(1, 1, 1, 6), position, [0.032, length, 0.032], [Math.PI / 2, 0, yaw]),
    transformed(new IcosahedronGeometry(1, 0), [
      position[0] + Math.cos(yaw) * half, position[1], position[2] - Math.sin(yaw) * half,
    ], [0.055, 0.05, 0.055]),
    transformed(new IcosahedronGeometry(1, 0), [
      position[0] - Math.cos(yaw) * half, position[1], position[2] + Math.sin(yaw) * half,
    ], [0.05, 0.048, 0.05]),
  ]
}

// A collapsed ribcage lying on its side — the readable silhouette of the set.
const RIBS = [-0.56, -0.36, -0.16, 0.04, 0.24, 0.44].map((z, i) => rib(z, 0.42 - Math.abs(i - 2.5) * 0.045))
const ribcageProp = prop('prop.bone.ribcage', [
  transformed(new CylinderGeometry(1, 1, 1, 7), [0, 0.43, 0], [0.05, 1.5, 0.05], [Math.PI / 2, 0, 0]),
  ...RIBS,
  transformed(new IcosahedronGeometry(1, 0), [0, 0.40, -0.78], [0.19, 0.17, 0.20]),
  transformed(new IcosahedronGeometry(1, 0), [0, 0.34, 0.74], [0.17, 0.15, 0.18]),
], [bone, ...RIBS.map(() => bone), weathered, weathered])

// A horned skull, big enough to read as a landmark of something that died here.
const skullProp = prop('prop.bone.skull', [
  transformed(new IcosahedronGeometry(1, 1), [0, 0.23, -0.04], [0.27, 0.23, 0.30]),
  transformed(new CylinderGeometry(0.62, 1, 1, 7), [0, 0.19, 0.34], [0.13, 0.42, 0.13], [Math.PI / 2, 0, 0]),
  transformed(new IcosahedronGeometry(1, 0), [0, 0.12, 0.30], [0.11, 0.06, 0.30]),
  transformed(new ConeGeometry(1, 1, 6), [-0.21, 0.38, -0.14], [0.055, 0.32, 0.055], [-0.5, 0, -0.55]),
  transformed(new ConeGeometry(1, 1, 6), [0.21, 0.38, -0.14], [0.055, 0.32, 0.055], [-0.5, 0, 0.55]),
], [bone, bone, weathered, weathered, weathered])

// Loose bones, for thin ground scatter between the larger pieces.
const SCATTER = [
  ...longBone([-0.16, 0.045, 0.10], 0.62, 0.35),
  ...longBone([0.18, 0.042, -0.08], 0.54, -0.9),
  ...longBone([0.02, 0.04, 0.30], 0.44, 1.9),
]
const scatterProp = prop('prop.bone.scatter', SCATTER, SCATTER.map((_, i) => (i % 3 === 0 ? bone : weathered)))

const props = [ribcageProp, skullProp, scatterProp]
describe(props)

const preview = previewTarget()
if (preview) await renderPreview(props, preview)

const here = path.dirname(fileURLToPath(import.meta.url))
await writeAtlas(props, path.join(here, '..', 'public', 'models', 'wyvern-bones.glb'))
