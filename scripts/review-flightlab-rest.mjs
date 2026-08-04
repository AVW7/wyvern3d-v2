#!/usr/bin/env node
/**
 * Measure any shipped wyvern clip in every Flight Lab camera.
 *
 * This uses the exact fixed camera, altitude, asset fit, species scale and
 * per-clip ground lift that `FlightLabCanvas`, `FlightLabRigContainer`, and
 * `GameModel` apply at runtime. It reports the visible screen envelope at the
 * v1 landmark phases for `rest` and 48 evenly spaced samples for every other
 * clip, so a Lab camera cannot silently crop a pose after an animation or
 * scale change.
 *
 * Usage: node scripts/review-flightlab-rest.mjs [state ... | --all]
 */

import { Buffer } from 'node:buffer'
import console from 'node:console'
import fs from 'node:fs'
import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'
import {
  AnimationMixer,
  Box3,
  LoopOnce,
  PerspectiveCamera,
  Vector3,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const MODEL = fileURLToPath(new URL('../public/models/wyvern.glb', import.meta.url))
const REST_LANDMARKS = [0, 18, 36, 72, 108, 126, 144]
const SAMPLES_PER_CLIP = 48
const FPS = 24

// `CAMERAS` in the Flight Lab. Every one is a review surface, so no clip may
// silently crop when the artist changes preset.
const CAMERAS = {
  side: { position: [130, 16, 0], fov: 35, target: [0, 8, 0] },
  front: { position: [0, 16, 130], fov: 35, target: [0, 8, 0] },
  top: { position: [0, 125, 0.01], fov: 35, target: [0, 0, 0] },
  threeQuarter: { position: [104, 58, 104], fov: 40, target: [0, 8, 0] },
  sanctuary: { position: [0, 36, 93], fov: 60, target: [0, 10, 0] },
  battle: { position: [0, 31, 88], fov: 65, target: [0, 6, 0] },
}
const CAMERA_ASPECT = 16 / 10 // 1440 × 900 review viewport
const FLIGHT_LAB_ALTITUDE = 4

// Every mapped clip in `WYVERN_CLIPS`, plus the matching Flight Lab state.
// Keep the altitude classification aligned with `AIRBORNE_STATES` in
// FlightLabRigContainer.tsx.
const STATES = {
  idle: { clip: 'idle', yOffset: 0, airborne: false },
  walk: { clip: 'walk', yOffset: 7.5, airborne: false },
  rest: { clip: 'rest', yOffset: 331, airborne: false },
  fly: { clip: 'takeoff', yOffset: 0, airborne: true },
  land: { clip: 'land', yOffset: 0, airborne: true },
  cruise: { clip: 'cruise', yOffset: 0, airborne: true },
  scout: { clip: 'scout', yOffset: 0, airborne: true },
  bankLeft: { clip: 'bankLeft', yOffset: 0, airborne: true },
  bankRight: { clip: 'bankRight', yOffset: 0, airborne: true },
  hover: { clip: 'hover', yOffset: 0, airborne: true },
  glide: { clip: 'glide', yOffset: 0, airborne: true },
  dive: { clip: 'dive', yOffset: 0, airborne: true },
  speed: { clip: 'speed', yOffset: 0, airborne: true },
  attack: { clip: 'attack', yOffset: 0, airborne: false },
  breathe: { clip: 'breath', yOffset: 0, airborne: false },
  death: { clip: 'death', yOffset: 0, airborne: false },
}
const FIT = 0.0072
const SPECIES_SIZE = 0.85
const MAX_SCREEN_FRACTION = 0.95

const requested = process.argv.slice(2)
const stateNames = requested.includes('--all') ? Object.keys(STATES) : requested.length ? requested : ['rest']
for (const state of stateNames) {
  if (!STATES[state]) throw new Error(`unknown Flight Lab state ${state}`)
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
  if (!json) throw new Error('GLB has no JSON chunk')

  delete json.images
  delete json.textures
  delete json.samplers
  delete json.materials
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) delete primitive.material
  }

  const jsonChunk = Buffer.from(JSON.stringify(json), 'utf8')
  const jsonPadding = (4 - (jsonChunk.length % 4)) % 4
  const binPadding = bin ? (4 - (bin.length % 4)) % 4 : 0
  const total = 12 + 8 + jsonChunk.length + jsonPadding + (bin ? 8 + bin.length + binPadding : 0)
  const out = Buffer.alloc(total)
  out.write('glTF', 0, 'ascii')
  out.writeUInt32LE(2, 4)
  out.writeUInt32LE(total, 8)
  let cursor = 12
  out.writeUInt32LE(jsonChunk.length + jsonPadding, cursor)
  out.writeUInt32LE(0x4e4f534a, cursor + 4)
  jsonChunk.copy(out, cursor + 8)
  out.fill(0x20, cursor + 8 + jsonChunk.length, cursor + 8 + jsonChunk.length + jsonPadding)
  cursor += 8 + jsonChunk.length + jsonPadding
  if (bin) {
    out.writeUInt32LE(bin.length + binPadding, cursor)
    out.writeUInt32LE(0x004e4942, cursor + 4)
    bin.copy(out, cursor + 8)
  }
  return out
}

const raw = stripTextures(fs.readFileSync(MODEL))
const gltf = await new Promise((resolve, reject) => {
  new GLTFLoader().parse(
    raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
    '',
    resolve,
    reject,
  )
})
const scale = FIT * SPECIES_SIZE
gltf.scene.scale.setScalar(scale)
const mixer = new AnimationMixer(gltf.scene)

function cameraFor(spec) {
  const camera = new PerspectiveCamera(spec.fov, CAMERA_ASPECT, 1, 2000)
  camera.position.fromArray(spec.position)
  camera.lookAt(...spec.target)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
  return camera
}

function poseAt(clip, time) {
  mixer.stopAllAction()
  const action = mixer.clipAction(clip)
  action.setLoop(LoopOnce, 1)
  action.clampWhenFinished = true
  action.reset().play()
  action.time = time
  mixer.update(0)
  gltf.scene.updateMatrixWorld(true)
}

function screenEnvelope(camera) {
  const box = new Box3().setFromObject(gltf.scene, true)
  const corners = [
    [box.min.x, box.min.y, box.min.z], [box.min.x, box.min.y, box.max.z],
    [box.min.x, box.max.y, box.min.z], [box.min.x, box.max.y, box.max.z],
    [box.max.x, box.min.y, box.min.z], [box.max.x, box.min.y, box.max.z],
    [box.max.x, box.max.y, box.min.z], [box.max.x, box.max.y, box.max.z],
  ].map(([x, y, z]) => new Vector3(x, y, z).project(camera))
  const values = (axis) => corners.map((corner) => corner[axis])
  const minX = Math.min(...values('x'))
  const maxX = Math.max(...values('x'))
  const minY = Math.min(...values('y'))
  const maxY = Math.max(...values('y'))
  const minZ = Math.min(...values('z'))
  const maxZ = Math.max(...values('z'))
  return {
    ndc: {
      x: [minX, maxX],
      y: [minY, maxY],
      z: [minZ, maxZ],
    },
    coverage: {
      width_ndc: maxX - minX,
      height_ndc: maxY - minY,
      // NDC spans −1…+1, so divide the NDC range by two to express the
      // silhouette as a fraction of the visible viewport.
      width_fraction: (maxX - minX) / 2,
      height_fraction: (maxY - minY) / 2,
    },
    bounds_m: {
      width: box.max.x - box.min.x,
      height: box.max.y - box.min.y,
      depth: box.max.z - box.min.z,
    },
    contains: minX >= -1 && maxX <= 1 && minY >= -1 && maxY <= 1 && minZ >= -1 && maxZ <= 1,
  }
}

function sampleTimes(state, clip) {
  if (state === 'rest') return REST_LANDMARKS.map((frame) => frame / FPS)
  return Array.from({ length: SAMPLES_PER_CLIP + 1 }, (_, index) => (index / SAMPLES_PER_CLIP) * clip.duration)
}

const rows = []
const failures = []
for (const state of stateNames) {
  const spec = STATES[state]
  const clip = gltf.animations.find(({ name }) => name === spec.clip)
  if (!clip) throw new Error(`missing ${spec.clip} clip for ${state}`)
  gltf.scene.position.y = (spec.airborne ? FLIGHT_LAB_ALTITUDE : 0) + spec.yOffset * scale
  const times = sampleTimes(state, clip)

  for (const [cameraName, cameraSpec] of Object.entries(CAMERAS)) {
    const camera = cameraFor(cameraSpec)
    const samples = times.map((time) => {
      poseAt(clip, time)
      return screenEnvelope(camera)
    })
    const widest = samples.reduce((best, sample) => sample.coverage.width_fraction > best.coverage.width_fraction ? sample : best)
    const tallest = samples.reduce((best, sample) => sample.coverage.height_fraction > best.coverage.height_fraction ? sample : best)
    const contains = samples.every((sample) => sample.contains)
    const coverageFailure = widest.coverage.width_fraction > MAX_SCREEN_FRACTION || tallest.coverage.height_fraction > MAX_SCREEN_FRACTION
    const row = {
      state,
      clip: spec.clip,
      camera: cameraName,
      samples: samples.length,
      widest_viewport_pct: Number((widest.coverage.width_fraction * 100).toFixed(2)),
      tallest_viewport_pct: Number((tallest.coverage.height_fraction * 100).toFixed(2)),
      contains,
    }
    rows.push(row)
    if (!contains || coverageFailure) failures.push(row)
  }
}

console.log(JSON.stringify({
  context: {
    states: stateNames,
    cameras: Object.keys(CAMERAS),
    viewport: '1440x900',
    emberback_scale: scale,
    max_screen_fraction: MAX_SCREEN_FRACTION,
  },
  rows,
  failures,
}, null, 2))

if (failures.length) {
  throw new Error(`Flight Lab framing failed for ${failures.map((row) => `${row.state}/${row.camera}`).join(', ')}`)
}
