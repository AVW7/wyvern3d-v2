#!/usr/bin/env node
/** Validate the exported Thornwing GLB and its committed numeric signature. */

import { Buffer } from 'node:buffer'
import console from 'node:console'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { URL } from 'node:url'
import { AnimationMixer, Box3, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const MODEL = new URL('../public/models/thornwing.glb', import.meta.url)
const SOURCE_MODEL = new URL('../public/models/library/forest-wyvern-display.glb', import.meta.url)
const SIGNATURE = new URL('../validation/thornwing-animations/clip-signatures.json', import.meta.url)
const SOURCE_SHA256 = '95382c76993a2d1c869b781b2b122321d26246a43536509791c5db17c459368c'
const REQUIRED_CLIPS = new Map([
  ['idle', 6], ['walk', 2], ['takeoff', 2], ['cruise', 3],
  ['land', 2], ['attack', 1.5], ['death', 3],
])
const REQUIRED_BONES = [
  'Root', 'RootMotion', 'Body', 'Spine1', 'Spine2', 'Spine3', 'Neck1', 'Neck2',
  'Head', 'Jaw', 'L_WingShoulder', 'L_WingElbow', 'L_WingWrist',
  'L_WingFinger1', 'L_WingFinger2', 'L_WingFinger3', 'L_WingFinger3_end',
  'R_WingShoulder', 'R_WingElbow', 'R_WingWrist',
  'R_WingFinger1', 'R_WingFinger2', 'R_WingFinger3', 'R_WingFinger3_end',
  'L_Thigh', 'L_Calf', 'L_Foot', 'R_Thigh', 'R_Calf', 'R_Foot',
  'L_FrontLegRoot', 'L_FrontUpper', 'L_FrontLower', 'L_FrontFoot',
  'R_FrontLegRoot', 'R_FrontUpper', 'R_FrontLower', 'R_FrontFoot',
  ...Array.from({ length: 10 }, (_, index) => `Tail${index + 1}`),
]
const REQUIRED_PARENTS = {
  Spine1: 'Body', Spine2: 'Spine1', Spine3: 'Spine2',
  Neck1: 'Spine3', Neck2: 'Neck1', Head: 'Neck2', Jaw: 'Head',
  L_WingElbow: 'L_WingShoulder', L_WingWrist: 'L_WingElbow',
  L_WingFinger1: 'L_WingWrist', L_WingFinger2: 'L_WingWrist',
  L_WingFinger3: 'L_WingWrist', L_WingFinger3_end: 'L_WingFinger3',
  R_WingElbow: 'R_WingShoulder', R_WingWrist: 'R_WingElbow',
  R_WingFinger1: 'R_WingWrist', R_WingFinger2: 'R_WingWrist',
  R_WingFinger3: 'R_WingWrist', R_WingFinger3_end: 'R_WingFinger3',
  L_Calf: 'L_Thigh', L_Foot: 'L_Calf', R_Calf: 'R_Thigh', R_Foot: 'R_Calf',
  L_FrontUpper: 'L_FrontLegRoot', L_FrontLower: 'L_FrontUpper',
  L_FrontFoot: 'L_FrontLower', R_FrontUpper: 'R_FrontLegRoot',
  R_FrontLower: 'R_FrontUpper', R_FrontFoot: 'R_FrontLower',
  ...Object.fromEntries(Array.from({ length: 9 }, (_, index) => [`Tail${index + 2}`, `Tail${index + 1}`])),
}
const GROUNDED_CLIPS = ['idle', 'walk', 'attack', 'death']

function fail(message) {
  throw new Error(message)
}

function stripTextures(data) {
  let offset = 12
  let json = null
  let binary = null
  while (offset < data.length) {
    const size = data.readUInt32LE(offset)
    const kind = data.readUInt32LE(offset + 4)
    const body = data.subarray(offset + 8, offset + 8 + size)
    if (kind === 0x4e4f534a) json = JSON.parse(body.toString('utf8'))
    else if (kind === 0x004e4942) binary = body
    offset += 8 + size
  }
  if (!json) fail('missing GLB JSON chunk')
  delete json.images
  delete json.textures
  delete json.samplers
  delete json.materials
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) delete primitive.material
  }
  const jsonChunk = Buffer.from(JSON.stringify(json))
  const jsonPad = (4 - jsonChunk.length % 4) % 4
  const binaryPad = binary ? (4 - binary.length % 4) % 4 : 0
  const total = 12 + 8 + jsonChunk.length + jsonPad + (binary ? 8 + binary.length + binaryPad : 0)
  const out = Buffer.alloc(total)
  out.write('glTF', 0)
  out.writeUInt32LE(2, 4)
  out.writeUInt32LE(total, 8)
  let cursor = 12
  out.writeUInt32LE(jsonChunk.length + jsonPad, cursor)
  out.writeUInt32LE(0x4e4f534a, cursor + 4)
  jsonChunk.copy(out, cursor + 8)
  out.fill(0x20, cursor + 8 + jsonChunk.length, cursor + 8 + jsonChunk.length + jsonPad)
  cursor += 8 + jsonChunk.length + jsonPad
  if (binary) {
    out.writeUInt32LE(binary.length + binaryPad, cursor)
    out.writeUInt32LE(0x004e4942, cursor + 4)
    binary.copy(out, cursor + 8)
  }
  return out
}

const bytes = fs.readFileSync(MODEL)
if (bytes.length >= 15 * 1024 * 1024) fail(`GLB exceeds 15 MB: ${bytes.length}`)
const stripped = stripTextures(bytes)
const gltf = await new Promise((resolve, reject) => {
  new GLTFLoader().parse(
    stripped.buffer.slice(stripped.byteOffset, stripped.byteOffset + stripped.byteLength),
    '',
    resolve,
    reject,
  )
})
const sourceBytes = fs.readFileSync(SOURCE_MODEL)
const sourceHash = createHash('sha256').update(sourceBytes).digest('hex')
if (sourceHash !== SOURCE_SHA256) fail('authoritative Forest Wyvern Display changed unexpectedly')
const strippedSource = stripTextures(sourceBytes)
const sourceGltf = await new Promise((resolve, reject) => {
  new GLTFLoader().parse(
    strippedSource.buffer.slice(
      strippedSource.byteOffset,
      strippedSource.byteOffset + strippedSource.byteLength,
    ),
    '',
    resolve,
    reject,
  )
})

gltf.scene.updateMatrixWorld(true)
sourceGltf.scene.updateMatrixWorld(true)
const restBounds = new Box3().setFromObject(gltf.scene, true)
const sourceBounds = new Box3().setFromObject(sourceGltf.scene, true)
const restSize = restBounds.getSize(new Vector3())
const sourceSize = sourceBounds.getSize(new Vector3())
const restCenter = restBounds.getCenter(new Vector3())
const sourceCenter = sourceBounds.getCenter(new Vector3())
const visualRestDelta = Math.max(
  restSize.distanceTo(sourceSize),
  restCenter.distanceTo(sourceCenter),
)
if (visualRestDelta < 0.05) {
  fail(`derivative was not visibly baked into a new neutral rest pose: delta ${visualRestDelta}`)
}

const bones = new Set()
const boneParents = new Map()
const boneObjects = new Map()
const skinnedMeshes = []
gltf.scene.traverse((object) => {
  if (object.isBone) {
    bones.add(object.name)
    boneObjects.set(object.name, object)
    boneParents.set(object.name, object.parent?.isBone ? object.parent.name : null)
  }
  if (object.isSkinnedMesh) skinnedMeshes.push(object)
})
for (const name of REQUIRED_BONES) {
  if (!bones.has(name)) fail(`required bone missing: ${name}`)
}
for (const [name, parent] of Object.entries(REQUIRED_PARENTS)) {
  if (boneParents.get(name) !== parent) {
    fail(`${name} must be parented to ${parent}, found ${boneParents.get(name) ?? 'none'}`)
  }
}
gltf.scene.updateMatrixWorld(true)
for (const stem of [
  'WingShoulder', 'WingElbow', 'WingWrist', 'WingFinger1', 'WingFinger2',
  'WingFinger3', 'Thigh', 'Calf', 'Foot', 'FrontLegRoot', 'FrontUpper',
  'FrontLower', 'FrontFoot',
]) {
  const left = boneObjects.get(`L_${stem}`)?.getWorldPosition(new Vector3())
  const right = boneObjects.get(`R_${stem}`)?.getWorldPosition(new Vector3())
  if (!left || !right) fail(`neutral-pose symmetry bone missing: ${stem}`)
  const mirrorError = Math.max(
    Math.abs(left.x + right.x),
    Math.abs(left.y - right.y),
    Math.abs(left.z - right.z),
  )
  if (mirrorError > 0.01) fail(`${stem} neutral-pose mirror error is ${mirrorError}`)
}
if (skinnedMeshes.length !== 1) fail(`expected one skinned mesh, found ${skinnedMeshes.length}`)

const geometry = skinnedMeshes[0].geometry
const weights = geometry.getAttribute('skinWeight')
const joints = geometry.getAttribute('skinIndex')
if (!weights || !joints || weights.itemSize !== 4 || joints.itemSize !== 4) {
  fail('skin attributes must contain four weights and four joint indices')
}
let worstWeightSum = 0
for (let vertex = 0; vertex < weights.count; vertex += 1) {
  let sum = 0
  for (let component = 0; component < 4; component += 1) {
    const weight = weights.array[vertex * 4 + component]
    const joint = joints.array[vertex * 4 + component]
    if (!Number.isFinite(weight) || !Number.isFinite(joint) || weight < 0) {
      fail(`non-finite or negative skinning at vertex ${vertex}`)
    }
    sum += weight
  }
  worstWeightSum = Math.max(worstWeightSum, Math.abs(1 - sum))
}
if (worstWeightSum > 0.002) fail(`skin weights are not normalized: max error ${worstWeightSum}`)

const clips = new Map(gltf.animations.map((clip) => [clip.name, clip]))
if (clips.size !== REQUIRED_CLIPS.size) fail(`expected seven clips, found ${[...clips.keys()].join(', ')}`)
for (const [name, duration] of REQUIRED_CLIPS) {
  const clip = clips.get(name)
  if (!clip) fail(`clip missing: ${name}`)
  if (Math.abs(clip.duration - duration) > 1 / 240) {
    fail(`${name} duration ${clip.duration} does not match ${duration}`)
  }
  // Binding every clip through the same runtime mixer catches dropped target nodes.
  const action = new AnimationMixer(gltf.scene).clipAction(clip)
  action.play()
}

const signature = JSON.parse(fs.readFileSync(SIGNATURE, 'utf8'))
if (signature.schema !== 'thornwing_clip_signature.v1') fail(`unexpected signature schema: ${signature.schema}`)
if (signature.input?.sha256 !== sourceHash) fail('signature input hash does not match the display source')
if (signature.model.bytes !== bytes.length) fail('signature was not regenerated for the shipped GLB')
const modelHash = createHash('sha256').update(bytes).digest('hex')
if (signature.model.sha256 !== modelHash) fail('signature hash does not match the shipped GLB')
if (signature.model.triangles < 35_000 || signature.model.triangles > 40_000) {
  fail(`triangle budget drifted: ${signature.model.triangles}`)
}
if (signature.model.max_vertex_weights > 4) fail('more than four weights per vertex')

for (const name of ['idle', 'walk', 'cruise']) {
  const loop = signature.clips[name].loop
  if (!loop.loops || loop.pose_max >= 0.01 || loop.basis_max >= 0.01) {
    fail(`${name} loop seam exceeds 0.01: ${JSON.stringify(loop)}`)
  }
}
for (const name of GROUNDED_CLIPS) {
  const clearance = signature.clips[name].ground_clearance
  if (clearance.min < -0.02 || clearance.max > 0.02) {
    fail(`${name} ground clearance is ${JSON.stringify(clearance)}`)
  }
}
for (const [name, endpoint] of [['takeoff', 'start'], ['land', 'end']]) {
  const clearance = signature.clips[name].ground_clearance[endpoint]
  if (clearance < -0.02 || clearance > 0.02) {
    fail(`${name} ${endpoint} clearance is ${clearance}`)
  }
}

const cruise = signature.clips.cruise
const attackCarrier =
  signature.clips.attack.root_path.start.z - signature.clips.cruise.root_path.start.z
if (Math.abs(attackCarrier - 1.052532) > 0.001) {
  fail(`air-attack counter-fit drifted: ${attackCarrier}`)
}
if (cruise.wing_stroke.beats !== 2) fail(`cruise has ${cruise.wing_stroke.beats} beats, expected 2`)
if (cruise.wing_stroke.left_range_deg < 50 || cruise.wing_stroke.right_range_deg < 50) {
  fail(`cruise stroke is too small: ${JSON.stringify(cruise.wing_stroke)}`)
}
if (cruise.wing_stroke.range_difference_deg > 5) fail('cruise wing ranges differ by more than 5 degrees')
if (cruise.body_axis_deg.mean < -5 || cruise.body_axis_deg.mean > 15) {
  fail(`cruise body axis is ${cruise.body_axis_deg.mean} degrees`)
}
if (cruise.root_path.max_distance > 0.01) fail(`cruise root drift is ${cruise.root_path.max_distance}`)

console.log(
  `thornwing valid: ${signature.model.triangles} tris, ${bones.size} bones, ` +
  `${clips.size} clips, ${(bytes.length / 1024 / 1024).toFixed(2)} MB`,
)
