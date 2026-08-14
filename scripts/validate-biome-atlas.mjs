#!/usr/bin/env node
/**
 * Numeric acceptance gate for the biome atlas.
 *
 * A GLB can load perfectly and still be wrong: floating props, a prop scaled to
 * the size of a mountain, a texture reference that resolves to nothing. This
 * checks the shipped file against scripts/biome-library.json rather than
 * against a screenshot.
 *
 * Usage:
 *     pnpm assets:validate-biome-atlas            # public/models/biomes.glb
 *     pnpm assets:validate-biome-atlas --draft    # .biome-atlas/biomes.glb
 */
import console from 'node:console'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { URL } from 'node:url'

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const MANIFEST = JSON.parse(fs.readFileSync(path.join(REPO, 'scripts/biome-library.json'), 'utf8'))
const draft = process.argv.includes('--draft')
const file = path.join(REPO, draft ? '.biome-atlas' : 'public/models', `${MANIFEST.out}.glb`)

/** Ordinary web assets stay under this; see docs/MODEL_LIBRARY.md. */
const MAX_BYTES = 15 * 1024 * 1024
/** Measured height may drift from the authored target by at most this much. */
const HEIGHT_TOLERANCE = 0.02

if (!fs.existsSync(file)) {
  console.error(`${path.relative(REPO, file)} does not exist — run pnpm assets:biome-atlas${draft ? ' --draft' : ''}`)
  process.exit(1)
}

const data = fs.readFileSync(file)
const jsonLength = data.readUInt32LE(12)
const doc = JSON.parse(data.subarray(20, 20 + jsonLength).toString('utf8'))

const failures = []
const check = (condition, message) => {
  if (!condition) failures.push(message)
}

check(data.length <= MAX_BYTES, `atlas is ${(data.length / 1e6).toFixed(1)} MB, over the ${MAX_BYTES / 1e6} MB cap`)
check(!doc.skins?.length, 'atlas contains skins; it is a static scenery atlas')
check(!doc.animations?.length, 'atlas contains animations; it is a static scenery atlas')

const expected = MANIFEST.props.filter((entry) => draft || entry.license?.status === 'approved').map((entry) => entry.id)
const actual = (doc.nodes ?? []).map((node) => node.name)
check(
  actual.length === new Set(actual).size,
  `duplicate node names: ${actual.filter((name, index) => actual.indexOf(name) !== index).join(', ')}`,
)
for (const id of expected) check(actual.includes(id), `missing prop node ${id}`)
for (const name of actual) check(expected.includes(name), `unexpected prop node ${name}`)

if (doc.images?.some((image) => image.mimeType === 'image/webp')) {
  check(doc.extensionsRequired?.includes('EXT_texture_webp'), 'WebP images without EXT_texture_webp in extensionsRequired')
}
for (const texture of doc.textures ?? []) {
  const source = texture.source ?? texture.extensions?.EXT_texture_webp?.source
  check(source !== undefined && doc.images?.[source] !== undefined, 'texture with an unresolvable image source')
}

const extras = doc.asset?.extras?.wyvern3dBiomeAtlas
check(Array.isArray(extras), 'asset.extras.wyvern3dBiomeAtlas is missing; rebuild the atlas')

for (const entry of MANIFEST.props) {
  if (!expected.includes(entry.id)) continue
  const nodeIndex = actual.indexOf(entry.id)
  if (nodeIndex < 0) continue
  const node = doc.nodes[nodeIndex]
  check(node.mesh !== undefined, `${entry.id}: node has no mesh`)
  check(!node.translation && !node.rotation && !node.scale && !node.matrix, `${entry.id}: transforms must be baked into geometry`)
  if (node.mesh === undefined) continue

  const primitives = doc.meshes[node.mesh].primitives ?? []
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  let triangles = 0
  for (const primitive of primitives) {
    const position = doc.accessors[primitive.attributes.POSITION]
    check(position?.min && position?.max, `${entry.id}: POSITION accessor without bounds`)
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], position.min?.[axis] ?? 0)
      max[axis] = Math.max(max[axis], position.max?.[axis] ?? 0)
    }
    triangles += Math.floor((doc.accessors[primitive.indices]?.count ?? 0) / 3)
  }

  const height = max[1] - min[1]
  check(
    Math.abs(height - entry.targetHeight) <= entry.targetHeight * HEIGHT_TOLERANCE,
    `${entry.id}: measured height ${height.toFixed(2)} m, authored ${entry.targetHeight} m`,
  )
  const rest = -(entry.sink ?? 0)
  check(Math.abs(min[1] - rest) <= 0.05, `${entry.id}: rests at y=${min[1].toFixed(3)}, expected ${rest.toFixed(3)}`)
  const centre = [(min[0] + max[0]) / 2, (min[2] + max[2]) / 2]
  check(
    Math.abs(centre[0]) <= 0.05 * Math.max(1, max[0] - min[0]) && Math.abs(centre[1]) <= 0.05 * Math.max(1, max[2] - min[2]),
    `${entry.id}: not centred in x/z (centre ${centre.map((value) => value.toFixed(2)).join(', ')})`,
  )
  if (entry.maxTriangles) {
    check(triangles <= entry.maxTriangles, `${entry.id}: ${triangles} triangles, budget ${entry.maxTriangles}`)
  }
}

if (failures.length) {
  console.error(`${path.relative(REPO, file)} failed validation:\n${failures.map((failure) => `  ${failure}`).join('\n')}`)
  process.exit(1)
}

const triangles = (extras ?? []).reduce((total, entry) => total + entry.triangles, 0)
console.log(
  `${path.relative(REPO, file)} ok: ${actual.length} props, ${triangles} triangles, ${(data.length / 1e6).toFixed(2)} MB, ${doc.images?.length ?? 0} textures`,
)
