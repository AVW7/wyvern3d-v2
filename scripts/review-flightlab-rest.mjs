#!/usr/bin/env node
/**
 * Measure the rebuilt `rest` loop in Flight Lab's sanctuary camera.
 *
 * This uses the exact fixed camera, altitude, asset fit, species scale and
 * per-clip ground lift that `FlightLabCanvas`, `FlightLabRigContainer`, and
 * `GameModel` apply at runtime. It reports the visible screen envelope at the
 * v1 landmark phases, so the lab camera cannot silently crop a pose after an
 * animation or scale change.
 *
 * Usage: node scripts/review-flightlab-rest.mjs
 */

import { Buffer } from 'node:buffer'
import console from 'node:console'
import fs from 'node:fs'
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
const CLIP = 'rest'
const LANDMARKS = [0, 18, 36, 72, 108, 126, 144]
const FPS = 24

// `CAMERAS.sanctuary` and the grounded-state altitude in the Flight Lab.
const CAMERA_POSITION = [0, 26, 58]
const CAMERA_TARGET = [0, 10, 0]
const CAMERA_FOV = 60
const CAMERA_ASPECT = 16 / 10 // 1440 × 900 review viewport
const FLIGHT_LAB_ALTITUDE = 0

// `wyvern.emberback` uses `WYVERN_FIT * 0.85`; `rest.yOffset` is 331.
const FIT = 0.0072
const SPECIES_SIZE = 0.85
const REST_Y_OFFSET = 331
const MAX_SCREEN_COVERAGE = 0.9

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
const clip = gltf.animations.find(({ name }) => name === CLIP)
if (!clip) throw new Error(`missing ${CLIP} clip`)

const scale = FIT * SPECIES_SIZE
gltf.scene.scale.setScalar(scale)
gltf.scene.position.y = FLIGHT_LAB_ALTITUDE + REST_Y_OFFSET * scale

const mixer = new AnimationMixer(gltf.scene)
const camera = new PerspectiveCamera(CAMERA_FOV, CAMERA_ASPECT, 1, 2000)
camera.position.fromArray(CAMERA_POSITION)
camera.lookAt(...CAMERA_TARGET)
camera.updateProjectionMatrix()
camera.updateMatrixWorld(true)

function poseAt(frame) {
  mixer.stopAllAction()
  const action = mixer.clipAction(clip)
  action.setLoop(LoopOnce, 1)
  action.clampWhenFinished = true
  action.reset().play()
  action.time = frame / FPS
  mixer.update(0)
  gltf.scene.updateMatrixWorld(true)
}

function screenEnvelope() {
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
      width: maxX - minX,
      height: maxY - minY,
    },
    bounds_m: {
      width: box.max.x - box.min.x,
      height: box.max.y - box.min.y,
      depth: box.max.z - box.min.z,
    },
    contains: minX >= -1 && maxX <= 1 && minY >= -1 && maxY <= 1 && minZ >= -1 && maxZ <= 1,
  }
}

const samples = LANDMARKS.map((frame) => {
  poseAt(frame)
  return { frame, ...screenEnvelope() }
})
const widest = samples.reduce((best, sample) => sample.coverage.width > best.coverage.width ? sample : best)
const tallest = samples.reduce((best, sample) => sample.coverage.height > best.coverage.height ? sample : best)
const failed = samples.filter((sample) => !sample.contains).map((sample) => sample.frame)
const coverageFailure = widest.coverage.width > MAX_SCREEN_COVERAGE || tallest.coverage.height > MAX_SCREEN_COVERAGE

console.log(JSON.stringify({
  context: {
    clip: CLIP,
    landmark_frames: LANDMARKS,
    camera: {
      preset: 'sanctuary',
      position: CAMERA_POSITION,
      target: CAMERA_TARGET,
      fov_deg: CAMERA_FOV,
      viewport: '1440x900',
    },
    runtime: {
      flight_lab_altitude_m: FLIGHT_LAB_ALTITUDE,
      emberback_scale: scale,
      rest_y_offset_rig_units: REST_Y_OFFSET,
    },
  },
  samples,
  widest,
  tallest,
  failed_frames: failed,
}, null, 2))

if (failed.length || coverageFailure) {
  throw new Error(
    `Flight Lab sanctuary camera crops rest: frames=${failed.join(',') || 'none'} ` +
    `width=${widest.coverage.width.toFixed(3)} height=${tallest.coverage.height.toFixed(3)}`,
  )
}
