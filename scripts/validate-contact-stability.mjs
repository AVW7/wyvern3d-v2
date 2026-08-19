#!/usr/bin/env node
/**
 * Does a grounded clip's contact actually stay put?
 *
 *     node scripts/validate-contact-stability.mjs [model.glb]
 *
 * Foot skate -- a planted foot sliding wrongly across the ground -- is the single
 * most legible "this is not an animal" fault in locomotion, and nothing in this
 * project measured it. `validate-wyvern-clips.mjs` gates mirror, loop seam, root
 * travel and cadence; all four passed clean on a `walk` whose gait was invented
 * from per-joint sine curves, and on one whose knuckle hung 16 m under the floor.
 * Those are aggregate properties of the clip. Contact is a per-frame relationship
 * between the mesh and the ground, so it needs its own pass.
 *
 * The measure is *consistency*, not stillness, and that distinction is the whole
 * design. Every clip here is authored in place -- `rootTravel` is gated at zero
 * by the sibling validator, because `core` owns locomotion speed and the sim
 * translates the character. So a planted foot is supposed to slide backwards
 * through the clip, at exactly the speed the sim will move the body forwards.
 * A cycle with zero foot motion would moonwalk the instant it played.
 *
 * Measured on v1's own hand-animated captures, that slide is large: `Battle_Walk`
 * runs a p95 of 0.555 body-heights per second. So absolute speed cannot be the
 * gate -- the reference would fail it. What separates a real gait from an
 * invented one is that a real one's stance velocity is *steady*: every planted
 * contact moves at one shared speed, which is what makes the ground read as
 * ground. A per-joint sine-curve walk has each foot accelerating and decelerating
 * on its own schedule, and no single locomotion speed can absorb that.
 *
 * So this reports the implied stride speed (the median contact velocity) and the
 * dispersion around it, and gates the dispersion.
 *
 * The ground plane is the pose's own lowest point over the cycle, not y=0: these
 * clips are planted at runtime by `ClipSpec.yOffset`, so their absolute height is
 * a manifest number and only the shape of the contact matters here.
 *
 * Reported per clip:
 *
 *   contact%   frames with at least one vertex within the contact band. Reported
 *              for context, not gated: the band is measured from the pose's
 *              lowest point over the whole cycle, which is a transient extreme,
 *              so even v1's own clips sit above it most of the time (8-43%).
 *   skate      horizontal speed of contact vertices. Reported both in metres per
 *              second at the shipped fit, and in body-heights per second, which
 *              is the scale-free form -- that is what lets this be pointed at the
 *              vendor asset (`--clips` takes its clip names) to calibrate what a
 *              hand-animated original actually scores, rather than inventing a
 *              limit. p50 is the honest centre; p95 is what the eye catches,
 *              because a single sliding foot is visible even when the median is
 *              clean.
 *   worst      the bone owning the fastest-sliding contact vertex, so a failure
 *              names a chain rather than a number.
 */

import { Buffer } from 'node:buffer'
import console from 'node:console'
import fs from 'node:fs'
import process from 'node:process'
import { URL } from 'node:url'
import { AnimationMixer, LoopOnce, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const MODEL = process.argv[2]
  ? new URL(process.argv[2], `file://${process.cwd()}/`)
  : new URL('../public/models/wyvern-gothic.glb', import.meta.url)

const FPS = 24

// The clips that are meant to carry weight on the ground for their whole length.
// `takeoff` and `land` deliberately leave it, and every flight loop is airborne,
// so contact is not defined for them.
const GROUNDED = process.argv.includes('--clips')
  ? process.argv[process.argv.indexOf('--clips') + 1].split(',').filter(Boolean)
  : ['idle', 'walk', 'rest']

// A vertex is in contact within this far of the pose's lowest point, as a
// fraction of the model's own standing height.
//
// Relative, not absolute, and that matters more than it looks: v1's GLB is
// authored ~100x smaller than this rig, so a fixed band in model units meant
// "the whole lower body" on one asset and "the sole of one foot" on the other.
// Calibrating against the vendor with that in place compared two different
// questions. As a fraction of height the same physical band is asked of both.
//
// 1.5% is sized from the mesh rather than chosen: the sole is a curved surface,
// so too tight a band tracks one vertex at a time and reports the roll of the
// foot as skate.
const CONTACT_BAND = 0.015
// The candidate sweep is wider, so a vertex entering contact is already tracked;
// it keeps pass two skinning hundreds of vertices per frame instead of all of them.
const CANDIDATE_BAND = 0.045
const COARSE_STRIDE = 3 // frames, for the candidate sweep only

// Thresholds are set from measurement. Calibrated against v1 by pointing this
// script at the vendor GLB with `--clips`, which is the only reason these are
// numbers and not guesses. Per chain, on v1's own hand-animated clips:
//
//     Battle_Stand   foot     implied 0.009   p95 0.015   spread 0.81
//     Battle_Stand   knuckle  implied 0.018   p95 0.046   spread 0.67
//     Battle_Walk    foot     implied 0.299   p95 0.555   spread 0.57
//
// Measured per contact *chain*, never pooled. A quadruped on its wing knuckles
// has two sets of contacts that legitimately travel at different speeds, and
// pooling them measures the gap between the two rather than the steadiness of
// either. Measured on the promoted walk, the feet score 0.11 and the knuckles
// 0.29 -- both sound -- while the pooled figure was 1.64 purely because their
// medians sit 2.9x apart. That pooled number made a good gait look like the
// worst clip in the model.
//
// Two regimes, because one statistic cannot serve both.
//
// A chain that TRAVELS is judged on `spread`, the inter-quartile range over the
// median: robust to the touchdown and lift-off frames, which are genuinely fast
// and would dominate a standard deviation. What matters for a moving contact is
// that it holds ONE speed, whatever that speed is.
//
// A chain that is STATIC cannot be judged that way. `idle`'s foot median is
// 0.010 and `rest`'s knuckle 0.027, so the ratio divides by nearly zero and
// swings on differences too small to see -- our idle foot matches v1's median
// exactly (0.009) and still scored 1.15 against v1's 0.81. For a settled pose
// the real question is not "one speed" but "does anything slide at all", which
// is an absolute measurement. So a static chain is gated on `p95` instead.
const SPREAD_LIMIT = 1.0
// Below this median speed a chain is settled rather than travelling. v1's
// stance chains sit at 0.009-0.018 and its walking foot at 0.299, so the two
// regimes are two orders of magnitude apart and this sits between them.
const STATIC_IMPLIED = 0.05
// The absolute limit for a settled chain: v1's worst stance p95 is the stand's
// knuckle at 0.046, and this is that with headroom.
const STATIC_P95_LIMIT = 0.06

/** Re-pack the GLB without images/textures/materials; see validate-wyvern-clips.mjs. */
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
  if (!json) throw new Error('no JSON chunk')
  delete json.images
  delete json.textures
  delete json.samplers
  delete json.materials
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) delete primitive.material
  }
  const jsonChunk = Buffer.from(JSON.stringify(json), 'utf8')
  const jsonPad = (4 - (jsonChunk.length % 4)) % 4
  const binPad = bin ? (4 - (bin.length % 4)) % 4 : 0
  const total =
    12 + 8 + jsonChunk.length + jsonPad + (bin ? 8 + bin.length + binPad : 0)
  const out = Buffer.alloc(total)
  out.write('glTF', 0, 'ascii')
  out.writeUInt32LE(2, 4)
  out.writeUInt32LE(total, 8)
  let cursor = 12
  out.writeUInt32LE(jsonChunk.length + jsonPad, cursor)
  out.writeUInt32LE(0x4e4f534a, cursor + 4)
  jsonChunk.copy(out, cursor + 8)
  out.fill(0x20, cursor + 8 + jsonChunk.length, cursor + 8 + jsonChunk.length + jsonPad)
  cursor += 8 + jsonChunk.length + jsonPad
  if (bin) {
    out.writeUInt32LE(bin.length + binPad, cursor)
    out.writeUInt32LE(0x004e4942, cursor + 4)
    bin.copy(out, cursor + 8)
  }
  return out
}

const stripped = stripTextures(fs.readFileSync(MODEL))
const gltf = await new Promise((resolve, reject) => {
  new GLTFLoader().parse(
    stripped.buffer.slice(stripped.byteOffset, stripped.byteOffset + stripped.byteLength),
    '',
    resolve,
    reject,
  )
})

const scene = gltf.scene
const skinned = []
scene.traverse((object) => {
  if (object.isSkinnedMesh) skinned.push(object)
})
if (!skinned.length) throw new Error('no skinned mesh in the GLB')

const mixer = new AnimationMixer(scene)

function poseAt(clip, time) {
  mixer.stopAllAction()
  const action = mixer.clipAction(clip)
  action.setLoop(LoopOnce, 1)
  action.clampWhenFinished = true
  action.reset().play()
  action.time = time
  mixer.update(0)
  scene.updateMatrixWorld(true)
}

/** Which ground-contact chain a bone belongs to; contacts are judged per chain. */
function chainOf(boneName) {
  if (/Foot|Toe/.test(boneName)) return 'foot'
  if (/Wing|Hand|Finger/.test(boneName)) return 'knuckle'
  return 'other'
}

/** Dominant skin bone of a vertex, for naming the worst offender. */
function dominantBone(mesh, index) {
  const skinIndex = mesh.geometry.attributes.skinIndex
  const skinWeight = mesh.geometry.attributes.skinWeight
  let best = 0
  let bestWeight = -1
  for (const component of ['x', 'y', 'z', 'w']) {
    const weight = skinWeight[`get${component.toUpperCase()}`](index)
    if (weight > bestWeight) {
      bestWeight = weight
      best = skinIndex[`get${component.toUpperCase()}`](index)
    }
  }
  return mesh.skeleton.bones[best]?.name ?? '?'
}

const scratch = new Vector3()
function worldVertex(mesh, index, target) {
  mesh.applyBoneTransform(index, target.set(
    mesh.geometry.attributes.position.getX(index),
    mesh.geometry.attributes.position.getY(index),
    mesh.geometry.attributes.position.getZ(index),
  ))
  return target.applyMatrix4(mesh.matrixWorld)
}

function quantile(sorted, q) {
  if (!sorted.length) return 0
  const position = (sorted.length - 1) * q
  const lower = Math.floor(position)
  const upper = Math.min(lower + 1, sorted.length - 1)
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)
}

const rows = []
const problems = []

for (const name of GROUNDED) {
  const clip = gltf.animations.find((candidate) => candidate.name === name)
  if (!clip) {
    problems.push(`${name}: clip missing from the GLB`)
    continue
  }
  const frames = Math.max(2, Math.round(clip.duration * FPS) + 1)
  const times = Array.from({ length: frames }, (_, i) => (i / (frames - 1)) * clip.duration)

  // Pass 1: the pose's own ground plane, the model's height for the scale-free
  // form, and the vertices that ever approach the plane.
  let plane = Infinity
  let ceiling = -Infinity
  for (let f = 0; f < frames; f += COARSE_STRIDE) {
    poseAt(clip, times[f])
    for (const mesh of skinned) {
      const count = mesh.geometry.attributes.position.count
      for (let i = 0; i < count; i += 1) {
        const y = worldVertex(mesh, i, scratch).y
        if (y < plane) plane = y
        if (y > ceiling) ceiling = y
      }
    }
  }
  const height = Math.max(ceiling - plane, 1e-6)
  const contactBand = plane + CONTACT_BAND * height
  const candidateBand = plane + CANDIDATE_BAND * height

  const candidates = skinned.map(() => new Set())
  for (let f = 0; f < frames; f += COARSE_STRIDE) {
    poseAt(clip, times[f])
    skinned.forEach((mesh, m) => {
      const count = mesh.geometry.attributes.position.count
      for (let i = 0; i < count; i += 1) {
        if (worldVertex(mesh, i, scratch).y <= candidateBand) candidates[m].add(i)
      }
    })
  }

  // Pass 2: track those vertices every frame and measure contact-to-contact drift.
  const previous = skinned.map(() => new Map())
  const speeds = { foot: [], knuckle: [], other: [] }
  let contactFrames = 0
  let worst = { speed: -1, bone: '-' }
  for (let f = 0; f < frames; f += 1) {
    poseAt(clip, times[f])
    const step = f > 0 ? times[f] - times[f - 1] : 0
    let touching = 0
    skinned.forEach((mesh, m) => {
      const current = new Map()
      for (const i of candidates[m]) {
        const position = worldVertex(mesh, i, new Vector3())
        if (position.y > contactBand) continue
        touching += 1
        current.set(i, position)
        const before = previous[m].get(i)
        if (before && step > 0) {
          const drift = Math.hypot(position.x - before.x, position.z - before.z)
          const speed = drift / step
          const bone = dominantBone(mesh, i)
          speeds[chainOf(bone)].push(speed)
          if (speed > worst.speed) worst = { speed, bone }
        }
      }
      previous[m] = current
    })
    if (touching > 0) contactFrames += 1
  }

  const chains = {}
  let total = 0
  for (const [chain, samples] of Object.entries(speeds)) {
    if (!samples.length) continue
    samples.sort((a, b) => a - b)
    total += samples.length
    const median = quantile(samples, 0.5)
    chains[chain] = {
      samples: samples.length,
      implied: median / height,
      spread: median > 0 ? (quantile(samples, 0.75) - quantile(samples, 0.25)) / median : 0,
      p95: quantile(samples, 0.95) / height,
    }
  }
  const contact = contactFrames / frames
  const ranked = Object.entries(chains).sort((a, b) => b[1].spread - a[1].spread)
  const row = {
    name,
    contact,
    vertices: candidates.reduce((set, group) => set + group.size, 0),
    chains,
    worstChain: ranked.length ? ranked[0][0] : '-',
    spread: ranked.length ? ranked[0][1].spread : 0,
    worst: worst.bone,
  }
  rows.push(row)

  if (!total) {
    problems.push(`${name}: nothing ever reaches the contact band`)
  } else {
    for (const [chain, data] of Object.entries(chains)) {
      if (data.implied < STATIC_IMPLIED) {
        if (data.p95 > STATIC_P95_LIMIT) {
          problems.push(
            `${name}: settled ${chain} contact slides at ${data.p95.toFixed(3)} ` +
              `(p95) > ${STATIC_P95_LIMIT} -- worst on ${row.worst}`,
          )
        }
      } else if (data.spread > SPREAD_LIMIT) {
        problems.push(
          `${name}: ${chain} stance velocity spread ${data.spread.toFixed(2)} > ` +
            `${SPREAD_LIMIT} -- contact does not hold one speed, worst on ${row.worst}`,
        )
      }
    }
  }
}

const width = Math.max(...rows.map((row) => row.name.length), 4)
console.log(
  `${'clip'.padEnd(width)}  ${'chain'.padEnd(8)}  ${'contact%'.padStart(8)}` +
    `  ${'samples'.padStart(7)}  ${'implied'.padStart(8)}  ${'p95'.padStart(7)}` +
    `  ${'spread'.padStart(7)}  worst`,
)
for (const row of rows) {
  const entries = Object.entries(row.chains)
  if (!entries.length) {
    console.log(`${row.name.padEnd(width)}  ${'-'.padEnd(8)}  ${'0'.padStart(8)}`)
    continue
  }
  entries.sort((a, b) => b[1].spread - a[1].spread)
  entries.forEach(([chain, data], index) => {
    console.log(
      `${(index === 0 ? row.name : '').padEnd(width)}  ${chain.padEnd(8)}` +
        `  ${(index === 0 ? (row.contact * 100).toFixed(0) : '').padStart(8)}` +
        `  ${String(data.samples).padStart(7)}  ${data.implied.toFixed(3).padStart(8)}` +
        `  ${data.p95.toFixed(3).padStart(7)}  ${data.spread.toFixed(2).padStart(7)}` +
        `  ${index === 0 ? row.worst : ''}`,
    )
  })
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`)
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}
console.log(
  '\ncontact stable: every grounded clip holds one stance speed,\n' +
    'so the ground reads as ground once the sim moves the body',
)
