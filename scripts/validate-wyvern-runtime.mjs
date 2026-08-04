#!/usr/bin/env node
/**
 * Load `public/models/wyvern.glb` the way `GameModel` does and prove the clips
 * actually drive the skeleton.
 *
 *     node scripts/validate-wyvern-runtime.mjs
 *     node scripts/validate-wyvern-runtime.mjs --against build/uncompressed.glb
 *
 * The Blender-side measurement in `measure-wyvern-clips-blender.py` proves the
 * *actions* are right. This proves the *shipped file* is: that GLTFLoader parses
 * it, that `SkeletonUtils.clone` survives it, that every animation track resolves
 * to a bone by name, and that the mixer moves what it binds.
 *
 * `--against` additionally samples every clip's posed bone positions in both
 * files and reports the largest disagreement. That is the check that makes the
 * compression step safe to run: `gltf-transform meshopt` quantizes positions and
 * inverse bind matrices, and its log says `prune: Removed types... Skin (1)`
 * while doing it, which is alarming enough to want evidence rather than a
 * reassuring JSON diff.
 */

import fs from 'node:fs'
import process from 'node:process'
import { URL } from 'node:url'
import { AnimationMixer, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'

const DEFAULT = new URL('../public/models/wyvern.glb', import.meta.url)
const SAMPLES = 8

/**
 * Drop materials, textures and images, and repack.
 *
 * Node has no ImageBitmap, so GLTFLoader throws decoding the WebP the moment it
 * touches a material — and none of that is under test here. Buffer views are
 * left alone: the image ones simply go unreferenced, and renumbering them would
 * corrupt the `EXT_meshopt_compression` views that share the array.
 */
function stripMaterials(data) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  let offset = 12
  const chunks = []
  while (offset < data.byteLength) {
    const length = view.getUint32(offset, true)
    const kind = view.getUint32(offset + 4, true)
    chunks.push({ kind, body: data.subarray(offset + 8, offset + 8 + length) })
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
  const total =
    12 + 8 + encoded.byteLength + jsonPad + (binary.byteLength ? 8 + binary.byteLength + binPad : 0)

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

async function load(url) {
  const stripped = stripMaterials(fs.readFileSync(url))
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  return await new Promise((resolve, reject) =>
    loader.parse(
      stripped.buffer.slice(stripped.byteOffset, stripped.byteOffset + stripped.byteLength),
      '',
      resolve,
      reject,
    ),
  )
}

/** Every clip's posed bone positions, sampled evenly across its duration. */
function poses(gltf) {
  const root = skeletonClone(gltf.scene)
  const mixer = new AnimationMixer(root)
  const bones = []
  root.traverse((o) => {
    if (o.isBone) bones.push(o)
  })
  bones.sort((a, b) => a.name.localeCompare(b.name))

  const out = new Map()
  for (const clip of gltf.animations) {
    const action = mixer.clipAction(clip)
    mixer.stopAllAction()
    action.reset().play()
    const frames = []
    let previous = 0
    for (let i = 0; i < SAMPLES; i += 1) {
      const t = (clip.duration * i) / (SAMPLES - 1)
      mixer.update(t - previous)
      previous = t
      root.updateMatrixWorld(true)
      frames.push(bones.map((b) => b.getWorldPosition(new Vector3()).toArray()))
    }
    out.set(clip.name, frames)
  }
  return { root, bones, poses: out }
}

function unresolvedTracks(gltf, root) {
  const names = new Set()
  root.traverse((o) => names.add(o.name))
  const bad = []
  for (const clip of gltf.animations) {
    for (const track of clip.tracks) {
      const target = track.name.split('.')[0]
      if (!names.has(target)) bad.push(`${clip.name} · ${track.name}`)
    }
  }
  return bad
}

const args = process.argv.slice(2)
const againstIndex = args.indexOf('--against')
const target = args.find((a) => !a.startsWith('--') && args[againstIndex + 1] !== a) ?? DEFAULT

const gltf = await load(target)
const { root, bones, poses: sampled } = poses(gltf)

const failures = []

const unresolved = unresolvedTracks(gltf, root)
if (unresolved.length) failures.push(`${unresolved.length} unresolved tracks: ${unresolved.slice(0, 5).join(', ')}`)

let skinned = 0
root.traverse((o) => {
  if (o.isSkinnedMesh) {
    skinned += 1
    if (!o.skeleton || o.skeleton.bones.length === 0) failures.push(`${o.name} has no skeleton`)
  }
})
if (skinned === 0) failures.push('no skinned mesh survived the clone')

// A clip that binds but never moves anything is the failure this whole exercise
// started from: `breath` moved one bone five degrees and nothing noticed.
for (const [name, frames] of sampled) {
  let travel = 0
  for (let i = 1; i < frames.length; i += 1) {
    for (let b = 0; b < frames[i].length; b += 1) {
      const [x1, y1, z1] = frames[i][b]
      const [x0, y0, z0] = frames[i - 1][b]
      travel = Math.max(travel, Math.hypot(x1 - x0, y1 - y0, z1 - z0))
    }
  }
  if (travel < 1) failures.push(`${name} · no bone moves more than ${travel.toFixed(3)} units`)
}

console.log(
  `clips=${gltf.animations.length} bones=${bones.length} skinnedMeshes=${skinned} ` +
    `tracks=${gltf.animations.reduce((n, c) => n + c.tracks.length, 0)}`,
)

if (againstIndex !== -1) {
  const reference = await load(args[againstIndex + 1])
  const { poses: refPoses } = poses(reference)
  let worst = 0
  let worstAt = ''
  for (const [name, frames] of sampled) {
    const ref = refPoses.get(name)
    if (!ref) {
      failures.push(`${name} · missing from the reference`)
      continue
    }
    for (let i = 0; i < frames.length; i += 1) {
      for (let b = 0; b < frames[i].length; b += 1) {
        const d = Math.hypot(
          frames[i][b][0] - ref[i][b][0],
          frames[i][b][1] - ref[i][b][1],
          frames[i][b][2] - ref[i][b][2],
        )
        if (d > worst) {
          worst = d
          worstAt = `${name} frame ${i} bone ${b}`
        }
      }
    }
  }
  // Judged in displayed metres, because that is the only scale at which the
  // number means anything: WYVERN_FIT is 0.0072 m per rig unit and the model
  // spans 46.9 m. meshopt quantizes rotation keys, and the error accumulates
  // along a chain, so the worst case is always the far end of the longest one —
  // a wingtip, 23 m of spar from the shoulder. 0.25 m there is 0.5% of semispan
  // and invisible; it buys a 17.4 MB file at 1.5 MB. Anything much larger means
  // the quantization grid changed, not that a wingtip drifted.
  const FIT = 0.0072
  const TOLERANCE_M = 0.25
  const metres = worst * FIT
  console.log(
    `max bone drift vs reference: ${worst.toFixed(2)} units / ${metres.toFixed(3)} m at ${worstAt}`,
  )
  if (metres > TOLERANCE_M) {
    failures.push(`bone drift ${metres.toFixed(3)} m > ${TOLERANCE_M} m`)
  }
}

if (failures.length) {
  console.error('FAIL')
  for (const f of failures) console.error(`  ${f}`)
  process.exit(1)
}
console.log('OK')
