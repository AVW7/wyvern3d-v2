#!/usr/bin/env node
/**
 * Numeric acceptance gate for the hatchery/gate props atlas
 * (public/models/hatchery.glb), mirroring validate-sanctuary-atlas.mjs:
 * - node name parity with the contract table below
 * - per-prop world-frame bounds: target height, y=0 resting plane, x/z centring
 * - total triangle budget
 * - GLB size cap
 * - licence provenance recorded in CREDITS.md
 *
 * Usage: pnpm assets:validate-hatchery-atlas
 */
import console from 'node:console'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { URL } from 'node:url'

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const GLB_PATH = path.join(REPO, 'public/models/hatchery.glb')

if (!fs.existsSync(GLB_PATH)) {
  console.error('Missing public/models/hatchery.glb — run pnpm assets:hatchery-atlas')
  process.exit(1)
}

/** World-frame contract per prop. Bounds math must match build-hatchery-atlas.mjs. */
const CONTRACT = [
  { id: 'prop.hatchery.egg', height: 0.75, footprint: 0.55, triangles: 1_920 },
  { id: 'prop.gate.flag', height: 3.2, footprint: 1.49, triangles: 2_336 },
  { id: 'prop.war.table', height: 0.95, footprint: 1.6, triangles: 7_292 },
]

const TOLERANCE = 0.01

/* -------------------------------------------------- world-frame bounds walk */

const m4 = {
  identity: () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  multiply(a, b) {
    const out = new Array(16)
    for (let c = 0; c < 4; c++)
      for (let r = 0; r < 4; r++)
        out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]
    return out
  },
  fromTRS(t, q, s) {
    const [x, y, z, w] = q
    const x2 = x + x, y2 = y + y, z2 = z + z
    const xx = x * x2, xy = x * y2, xz = x * z2
    const yy = y * y2, yz = y * z2, zz = z * z2
    const wx = w * x2, wy = w * y2, wz = w * z2
    return [
      (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
      (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
      (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
      t[0], t[1], t[2], 1,
    ]
  },
  transformPoint(m, p) {
    return [
      m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
      m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
      m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
    ]
  },
}

/* --------------------------------------------------------------- checks */

const data = fs.readFileSync(GLB_PATH)
const jsonLength = data.readUInt32LE(12)
const doc = JSON.parse(data.subarray(20, 20 + jsonLength).toString('utf8'))

const failures = []
const check = (ok, message) => {
  if (!ok) failures.push(message)
}

// Node parity: every contract id present exactly once; no unexpected roots.
const rootNames = doc.scenes[doc.scene].nodes.map((i) => doc.nodes[i].name)
for (const { id } of CONTRACT) {
  check(rootNames.filter((n) => n === id).length === 1, `node ${id} must appear exactly once (found ${rootNames.filter((n) => n === id).length})`)
}
check(rootNames.length === CONTRACT.length, `atlas has ${rootNames.length} roots, expected ${CONTRACT.length}`)

// Per-prop world bounds and triangles, walking each root's subtree.
const measure = (nodeIndex, parent) => {
  const node = doc.nodes[nodeIndex]
  const local = node.matrix ?? m4.fromTRS(node.translation ?? [0, 0, 0], node.rotation ?? [0, 0, 0, 1], node.scale ?? [1, 1, 1])
  const world = m4.multiply(parent, local)
  let min = [Infinity, Infinity, Infinity]
  let max = [-Infinity, -Infinity, -Infinity]
  let tris = 0
  if (node.mesh !== undefined) {
    for (const prim of doc.meshes[node.mesh].primitives) {
      const pos = doc.accessors[prim.attributes.POSITION]
      const idx = prim.indices !== undefined ? doc.accessors[prim.indices] : null
      tris += (idx ? idx.count : pos.count) / 3
      for (let cx = 0; cx < 2; cx++)
        for (let cy = 0; cy < 2; cy++)
          for (let cz = 0; cz < 2; cz++) {
            const c = m4.transformPoint(world, [cx ? pos.max[0] : pos.min[0], cy ? pos.max[1] : pos.min[1], cz ? pos.max[2] : pos.min[2]])
            for (let a = 0; a < 3; a++) {
              min[a] = Math.min(min[a], c[a])
              max[a] = Math.max(max[a], c[a])
            }
          }
    }
  }
  for (const child of node.children ?? []) {
    const sub = measure(child, world)
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], sub.min[a])
      max[a] = Math.max(max[a], sub.max[a])
    }
    tris += sub.tris
  }
  return { min, max, tris }
}

for (const rootIndex of doc.scenes[doc.scene].nodes) {
  const name = doc.nodes[rootIndex].name
  const entry = CONTRACT.find((c) => c.id === name)
  if (!entry) continue
  const { min, max, tris } = measure(rootIndex, m4.identity())
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
  check(Math.abs(size[1] - entry.height) <= TOLERANCE, `${name}: height ${size[1].toFixed(3)} m ≠ ${entry.height} m`)
  check(Math.abs(min[1]) <= TOLERANCE, `${name}: rests ${min[1].toFixed(4)} m off y=0`)
  check(Math.abs(min[0] + size[0] / 2) <= TOLERANCE && Math.abs(min[2] + size[2] / 2) <= TOLERANCE, `${name}: not centred in x/z`)
  check(tris === entry.triangles, `${name}: ${tris} triangles ≠ ${entry.triangles}`)
}

// Budgets and provenance.
check(data.length <= 2 * 1024 * 1024, `atlas ${(data.length / 1e6).toFixed(2)} MB exceeds 2 MB cap`)
check(!(doc.extensionsRequired ?? []).includes('KHR_materials_pbrSpecularGlossiness'), 'deprecated spec/gloss required extension present')
const credits = fs.readFileSync(path.join(REPO, 'CREDITS.md'), 'utf8')
for (const token of ['holderacademy', 'SamuelRochaJr', 'MartynaLawniczak']) {
  check(credits.includes(token), `CREDITS.md missing ${token} attribution`)
}

if (failures.length > 0) {
  console.error(`hatchery atlas: ${failures.length} failure(s)`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}
console.log(`hatchery atlas: OK (${CONTRACT.length} props, ${(data.length / 1e6).toFixed(2)} MB)`)
