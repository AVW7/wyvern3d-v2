#!/usr/bin/env node
/**
 * Emit a first landmark capture for one canonical v1 animation.
 *
 * The re-authoring contract starts every action with seven evenly-spaced source
 * poses.  An animator later replaces those with contact and event frames, but
 * this record makes the first pass reproducible and attaches it to the pinned
 * GLB rather than a mutable Blender scene.
 *
 * Usage: node scripts/capture-v1-landmarks.mjs Sanct_Rest
 */

import { Buffer } from 'node:buffer'
import console from 'node:console'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { AnimationMixer, Euler, LoopOnce, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

const ROOT = path.resolve(import.meta.dirname, '..')
const BASE = path.join(ROOT, 'public/models/drogon.glb')
const SIDECAR = path.join(ROOT, 'public/models/drogon-sanctuary.glb')
const requested = process.argv[2]
if (!requested) throw new Error('usage: capture-v1-landmarks.mjs <action name>')

const FRACTIONS = [0, 0.125, 0.25, 0.5, 0.75, 0.875, 1]
const BONES = {
  pelvis: 'Bip002-Pelvis_07',
  head: 'Bip002-Head_015',
  tail: 'Bip002-Tail6_01',
  leftFoot: 'Bip002-L-Foot_0188',
  rightFoot: 'Bip002-R-Foot_0202',
  jaw: 'Bip002-Ponytail1_016',
}

function stripTextures(data) {
  let offset = 12
  let json = null
  let bin = null
  while (offset < data.length) {
    const size = data.readUInt32LE(offset)
    const kind = data.readUInt32LE(offset + 4)
    const body = data.subarray(offset + 8, offset + 8 + size)
    if (kind === 0x4e4f534a) json = JSON.parse(body.toString('utf8'))
    else if (kind === 0x004e4942) bin = body
    offset += 8 + size
  }
  if (!json) throw new Error('no GLB JSON chunk')
  delete json.images
  delete json.textures
  delete json.samplers
  delete json.materials
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) delete primitive.material
  }
  const chunk = Buffer.from(JSON.stringify(json), 'utf8')
  const padding = (4 - (chunk.length % 4)) % 4
  const binPadding = bin ? (4 - (bin.length % 4)) % 4 : 0
  const total = 12 + 8 + chunk.length + padding + (bin ? 8 + bin.length + binPadding : 0)
  const out = Buffer.alloc(total)
  out.write('glTF', 0, 'ascii')
  out.writeUInt32LE(2, 4)
  out.writeUInt32LE(total, 8)
  let cursor = 12
  out.writeUInt32LE(chunk.length + padding, cursor)
  out.writeUInt32LE(0x4e4f534a, cursor + 4)
  chunk.copy(out, cursor + 8)
  out.fill(0x20, cursor + 8 + chunk.length, cursor + 8 + chunk.length + padding)
  cursor += 8 + chunk.length + padding
  if (bin) {
    out.writeUInt32LE(bin.length + binPadding, cursor)
    out.writeUInt32LE(0x004e4942, cursor + 4)
    bin.copy(out, cursor + 8)
  }
  return out
}

async function load(file) {
  const data = stripTextures(fs.readFileSync(file))
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  return new Promise((resolve, reject) => loader.parse(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '', resolve, reject,
  ))
}

await MeshoptDecoder.ready
const [base, sidecar] = await Promise.all([load(BASE), load(SIDECAR)])
const clip = [...base.animations, ...sidecar.animations].find(({ name }) => name === requested)
if (!clip) throw new Error(`canonical v1 action not found: ${requested}`)

const nodes = new Map()
base.scene.traverse((node) => nodes.set(node.name, node))
for (const [label, name] of Object.entries(BONES)) {
  if (!nodes.has(name)) throw new Error(`base rig lacks ${label} bone ${name}`)
}
const mixer = new AnimationMixer(base.scene)
const action = mixer.clipAction(clip)
action.setLoop(LoopOnce, 1)
action.clampWhenFinished = true
action.play()
const vector = new Vector3()
const euler = new Euler()

function at(time) {
  action.time = time
  mixer.update(0)
  base.scene.updateMatrixWorld(true)
  const point = (label) => vector.setFromMatrixPosition(nodes.get(BONES[label]).matrixWorld).toArray()
  const pelvis = point('pelvis')
  const leftFoot = point('leftFoot')
  const rightFoot = point('rightFoot')
  const jaw = nodes.get(BONES.jaw)
  euler.setFromQuaternion(jaw.quaternion, 'XYZ')
  return {
    frame: Math.round(time * 24),
    time_s: Number(time.toFixed(3)),
    pelvis,
    head: point('head'),
    tail: point('tail'),
    foot_drop: Number((pelvis[2] - leftFoot[2]).toFixed(3)),
    foot_drop_R: Number((pelvis[2] - rightFoot[2]).toFixed(3)),
    jaw_local_x_deg: Number((euler.x * 180 / Math.PI).toFixed(2)),
  }
}

const samples = FRACTIONS.map((fraction) => at(clip.duration * fraction))
const extremes = {
  jaw_open: samples.reduce((best, sample) => sample.jaw_local_x_deg < best.jaw_local_x_deg ? sample : best),
  jaw_close: samples.reduce((best, sample) => sample.jaw_local_x_deg > best.jaw_local_x_deg ? sample : best),
  left_foot_low: samples.reduce((best, sample) => sample.foot_drop > best.foot_drop ? sample : best),
  right_foot_low: samples.reduce((best, sample) => sample.foot_drop_R > best.foot_drop_R ? sample : best),
}
console.log(JSON.stringify({
  action: requested,
  source: requested.startsWith('Sanct_') ? 'sanctuary_extension' : 'vendor_base',
  fps: 24,
  frames: [0, Math.round(clip.duration * 24)],
  duration_s: Number(clip.duration.toFixed(3)),
  samples,
  sampled_extrema: extremes,
}, null, 2))
