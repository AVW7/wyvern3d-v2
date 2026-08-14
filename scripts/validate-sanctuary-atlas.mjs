#!/usr/bin/env node
/**
 * Numeric acceptance gate for the sanctuary atlas (public/models/sanctuary.glb).
 *
 * Checks the shipped GLB against scripts/sanctuary-library.json:
 * - GLB size within soft budget and hard cap
 * - Node name parity (no duplicates, no missing, no unexpected)
 * - Geometry bounds (target height, ground resting plane, X/Z centering)
 * - Triangle budgets
 * - License provenance and approval
 * - Sockets integrity
 *
 * Usage:
 *     pnpm assets:validate-sanctuary-atlas
 */
import console from 'node:console'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { URL } from 'node:url'

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const MANIFEST_PATH = path.join(REPO, 'scripts/sanctuary-library.json')
const GLB_PATH = path.join(REPO, 'public/models/sanctuary.glb')

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error(`Missing manifest at ${path.relative(REPO, MANIFEST_PATH)}`)
  process.exit(1)
}

if (!fs.existsSync(GLB_PATH)) {
  console.error(`Missing GLB at ${path.relative(REPO, GLB_PATH)}`)
  process.exit(1)
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
const data = fs.readFileSync(GLB_PATH)
const jsonLength = data.readUInt32LE(12)
const doc = JSON.parse(data.subarray(20, 20 + jsonLength).toString('utf8'))

const failures = []
const check = (condition, message) => {
  if (!condition) failures.push(message)
}

const hardCapBytes = (manifest.hardCapMb ?? 15.0) * 1024 * 1024
const softBudgetBytes = (manifest.softBudgetMb ?? 8.0) * 1024 * 1024
const sizeMb = data.length / (1024 * 1024)

check(data.length <= hardCapBytes, `Atlas size ${sizeMb.toFixed(2)} MB exceeds hard cap ${manifest.hardCapMb} MB`)
if (data.length > softBudgetBytes) {
  console.warn(`[WARN] Atlas size ${sizeMb.toFixed(2)} MB exceeds soft budget ${manifest.softBudgetMb} MB`)
}

check(!doc.skins?.length, 'Atlas must not contain skins; it is a static scenery atlas')
check(!doc.animations?.length, 'Atlas must not contain animations; it is a static scenery atlas')

const expectedIds = manifest.props.map((p) => p.id)
const actualNodeNames = (doc.nodes ?? []).map((n) => n.name)

// Check uniqueness
const uniqueActual = new Set(actualNodeNames)
check(
  actualNodeNames.length === uniqueActual.size,
  `Duplicate node names: ${actualNodeNames.filter((name, idx) => actualNodeNames.indexOf(name) !== idx).join(', ')}`,
)

// Check exact parity
for (const id of expectedIds) {
  check(uniqueActual.has(id), `Missing prop node: ${id}`)
}
for (const name of actualNodeNames) {
  check(expectedIds.includes(name), `Unexpected unmanifested node in GLB: ${name}`)
}

// Check textures & materials
for (const texture of doc.textures ?? []) {
  const source = texture.source ?? texture.extensions?.EXT_texture_webp?.source
  check(source !== undefined && doc.images?.[source] !== undefined, 'Texture references unresolvable image source')
}

// Per-prop bounds and budgets
const HEIGHT_TOLERANCE = 0.05

for (const prop of manifest.props) {
  check(
    prop.license?.status === 'approved' && Boolean(prop.license?.evidence),
    `${prop.id}: Missing or unapproved license status in manifest`,
  )

  if (prop.sockets) {
    for (const [socketName, pos] of Object.entries(prop.sockets)) {
      check(
        Array.isArray(pos) && pos.length === 3 && pos.every((v) => typeof v === 'number' && !Number.isNaN(v)),
        `${prop.id}: Malformed socket '${socketName}' -> ${JSON.stringify(pos)}`,
      )
    }
  }

  const nodeIndex = actualNodeNames.indexOf(prop.id)
  if (nodeIndex < 0) continue

  const node = doc.nodes[nodeIndex]
  check(node.mesh !== undefined, `${prop.id}: Node has no mesh`)
  if (node.mesh === undefined) continue

  const mesh = doc.meshes[node.mesh]
  const primitives = mesh.primitives ?? []

  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  let triangles = 0

  for (const prim of primitives) {
    const posAcc = doc.accessors[prim.attributes.POSITION]
    if (posAcc?.min && posAcc?.max) {
      for (let a = 0; a < 3; a++) {
        min[a] = Math.min(min[a], posAcc.min[a])
        max[a] = Math.max(max[a], posAcc.max[a])
      }
    }
    if (prim.indices !== undefined) {
      triangles += Math.floor((doc.accessors[prim.indices]?.count ?? 0) / 3)
    } else if (prim.mode === 5) {
      triangles += Math.max(0, (posAcc?.count ?? 0) - 2)
    }
  }

  // Check scale transform application
  const scale = node.scale ?? [1, 1, 1]
  const height = (max[1] - min[1]) * scale[1]
  const width = (max[0] - min[0]) * scale[0]
  const depth = (max[2] - min[2]) * scale[2]

  const heightDelta = Math.abs(height - prop.targetHeight)
  const maxAllowedDelta = Math.max(0.1, prop.targetHeight * HEIGHT_TOLERANCE)
  check(
    heightDelta <= maxAllowedDelta,
    `${prop.id}: Measured height ${height.toFixed(2)}m drifts from target ${prop.targetHeight.toFixed(2)}m (delta ${heightDelta.toFixed(2)}m > ${maxAllowedDelta.toFixed(2)}m)`,
  )

  if (prop.maxTriangles) {
    check(
      triangles <= prop.maxTriangles,
      `${prop.id}: Triangle count ${triangles} exceeds budget ${prop.maxTriangles}`,
    )
  }

  // Check resting plane
  const restY = min[1] * scale[1] + (node.translation?.[1] ?? 0)
  check(Math.abs(restY) <= 0.25, `${prop.id}: Ground rest elevation is ${restY.toFixed(2)}m (expected ~0.0m)`)

  // Check horizontal centering
  const centerX = ((min[0] + max[0]) / 2) * scale[0] + (node.translation?.[0] ?? 0)
  const centerZ = ((min[2] + max[2]) / 2) * scale[2] + (node.translation?.[2] ?? 0)
  const maxSpan = Math.max(1.0, width, depth)
  check(
    Math.abs(centerX) <= 0.25 * maxSpan && Math.abs(centerZ) <= 0.25 * maxSpan,
    `${prop.id}: Not centered in X/Z (center: [${centerX.toFixed(2)}, ${centerZ.toFixed(2)}])`,
  )
}

if (failures.length > 0) {
  console.error(`sanctuary.glb failed validation (${failures.length} errors):\n${failures.map((f) => `  - ${f}`).join('\n')}`)
  process.exit(1)
}

console.log(`sanctuary.glb validated OK: ${actualNodeNames.length} props, ${sizeMb.toFixed(2)} MB (soft budget: ${manifest.softBudgetMb} MB, hard cap: ${manifest.hardCapMb} MB)`)
