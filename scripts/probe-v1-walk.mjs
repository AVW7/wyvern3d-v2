#!/usr/bin/env node
/**
 * What do the wings do while the vendor dragon walks?
 *
 * Throwaway-grade probe kept because it answers a question that keeps coming
 * back: this creature is a quadruped that walks on its wing knuckles, and any
 * grounded clip that folds the wings away and cycles only the hind legs is
 * wrong. Run it against `public/models/drogon.glb` (the v1 vendor model) to get
 * the reference numbers before authoring a grounded clip.
 *
 *     node scripts/probe-v1-walk.mjs [clipName]
 */

import fs from 'node:fs'
import process from 'node:process'
import { URL } from 'node:url'
import { AnimationMixer, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

const SOURCE = new URL('../public/models/drogon.glb', import.meta.url)
const WANTED = process.argv[2] ?? 'Walk'

function stripMaterials(data) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  let offset = 12
  const chunks = []
  while (offset < data.byteLength) {
    const length = view.getUint32(offset, true)
    chunks.push({ body: data.subarray(offset + 8, offset + 8 + length) })
    offset += 8 + length
  }
  const json = JSON.parse(new TextDecoder().decode(chunks[0].body))
  delete json.materials
  delete json.textures
  delete json.images
  delete json.samplers
  json.extensionsUsed = (json.extensionsUsed ?? []).filter((e) => e !== 'EXT_texture_webp')
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) delete primitive.material
  }
  const encoded = new TextEncoder().encode(JSON.stringify(json))
  const jsonPad = (4 - (encoded.byteLength % 4)) % 4
  const binary = chunks[1]?.body ?? new Uint8Array(0)
  const binPad = (4 - (binary.byteLength % 4)) % 4
  const total = 12 + 8 + encoded.byteLength + jsonPad + (binary.byteLength ? 8 + binary.byteLength + binPad : 0)
  const out = new Uint8Array(total)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, 0x46546c67, true)
  dv.setUint32(4, 2, true)
  dv.setUint32(8, total, true)
  dv.setUint32(12, encoded.byteLength + jsonPad, true)
  dv.setUint32(16, 0x4e4f534a, true)
  out.set(encoded, 20)
  out.fill(0x20, 20 + encoded.byteLength, 20 + encoded.byteLength + jsonPad)
  if (binary.byteLength) {
    const at = 20 + encoded.byteLength + jsonPad
    dv.setUint32(at, binary.byteLength + binPad, true)
    dv.setUint32(at + 4, 0x004e4942, true)
    out.set(binary, at + 8)
  }
  return out
}

const data = stripMaterials(fs.readFileSync(SOURCE))
const loader = new GLTFLoader()
loader.setMeshoptDecoder(MeshoptDecoder)
const gltf = await new Promise((res, rej) =>
  loader.parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '', res, rej),
)

const bones = {}
gltf.scene.traverse((o) => {
  if (o.isBone) bones[o.name] = o
})
const names = Object.keys(bones)

const pick = (...needles) =>
  names.filter((n) => needles.every((needle) => n.toLowerCase().includes(needle)))

console.log('candidate hand/wing bones:')
for (const n of pick('hand').concat(pick('finger')).slice(0, 12)) console.log('   ', n)

const clip = gltf.animations.find((c) => c.name.includes(WANTED))
if (!clip) {
  console.log('clips:', gltf.animations.map((c) => c.name).join('\n  '))
  throw new Error(`no clip matching ${WANTED}`)
}
console.log(`\nclip: ${clip.name}  ${clip.duration.toFixed(2)}s`)

const mixer = new AnimationMixer(gltf.scene)
mixer.clipAction(clip).play()

// Track the lowest point of each limb group across the cycle.
const groups = {
  foot: names.filter((n) => /foot|toe/i.test(n)),
  hand: names.filter((n) => /hand/i.test(n) && !/finger/i.test(n)),
  wingFinger: names.filter((n) => /finger/i.test(n)),
  clavicle: names.filter((n) => /clavicle/i.test(n)),
  pelvis: names.filter((n) => /pelvis|spine1$/i.test(n)),
}

const SAMPLES = Number(process.argv[3]) || 24
const track = {}
for (const g of Object.keys(groups)) track[g] = []

let prev = 0
for (let i = 0; i < SAMPLES; i += 1) {
  const t = (clip.duration * i) / (SAMPLES - 1)
  mixer.update(t - prev)
  prev = t
  gltf.scene.updateMatrixWorld(true)
  for (const [g, list] of Object.entries(groups)) {
    let low = Infinity
    for (const n of list) low = Math.min(low, bones[n].getWorldPosition(new Vector3()).y)
    track[g].push(low)
  }
}

console.log('\nlowest world Y per limb group across the cycle (vendor units):')
for (const [g, series] of Object.entries(track)) {
  if (!series.length || series[0] === Infinity) continue
  const min = Math.min(...series)
  const max = Math.max(...series)
  console.log(
    `  ${g.padEnd(11)} min ${min.toFixed(2)}  max ${max.toFixed(2)}  travel ${(max - min).toFixed(2)}`,
  )
}

// The question that matters: do the wing knuckles come down to the feet?
const footMin = Math.min(...track.foot)
const knuckleMin = Math.min(...track.wingFinger)
console.log(
  `\nwing knuckle vs foot floor: knuckle ${knuckleMin.toFixed(2)} vs foot ${footMin.toFixed(2)} ` +
    `→ gap ${(knuckleMin - footMin).toFixed(2)}`,
)
console.log(
  knuckleMin - footMin < 1.5
    ? 'VERDICT: quadrupedal — the wing knuckles carry weight on the ground.'
    : 'VERDICT: bipedal — the wings stay clear of the floor.',
)

// ---------------------------------------------------------------------------
// Gait phasing. Which of the four limbs is down, and when.
// ---------------------------------------------------------------------------
const contacts = {
  L_foot: names.filter((n) => /L-(foot|toe)/i.test(n)),
  R_foot: names.filter((n) => /R-(foot|toe)/i.test(n)),
  L_knuckle: names.filter((n) => /L-Finger/i.test(n)),
  R_knuckle: names.filter((n) => /R-Finger/i.test(n)),
}

const series = {}
prev = 0
for (let i = 0; i < SAMPLES; i += 1) {
  const t = (clip.duration * i) / (SAMPLES - 1)
  mixer.update(t - prev)
  prev = t
  gltf.scene.updateMatrixWorld(true)
  for (const [g, list] of Object.entries(contacts)) {
    if (!list.length) continue
    let low = Infinity
    for (const n of list) low = Math.min(low, bones[n].getWorldPosition(new Vector3()).y)
    ;(series[g] ??= []).push(low)
  }
}

console.log('\ngait — normalised height per limb, 0 = its lowest (planted), 1 = its highest:')
const phase = {}
for (const [g, values] of Object.entries(series)) {
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const norm = values.map((v) => (v - lo) / (hi - lo || 1))
  phase[g] = norm.indexOf(0) / SAMPLES
  const bar = norm.map((v) => '.:-=+*#%@'[Math.min(8, Math.floor(v * 9))]).join('')
  console.log(`  ${g.padEnd(10)} ${bar}  plant@${(phase[g] * 100).toFixed(0)}%`)
}

console.log('\nphase offsets from L_foot (fraction of cycle):')
for (const g of Object.keys(phase)) {
  let d = phase[g] - phase.L_foot
  if (d < 0) d += 1
  console.log(`  ${g.padEnd(10)} ${d.toFixed(2)}`)
}
