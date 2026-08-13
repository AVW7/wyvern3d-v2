#!/usr/bin/env node
/** Inspect a GLB numerically and recommend a metre-scale manifest fit. */
import { Buffer } from 'node:buffer'
import console from 'node:console'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { Box3, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

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
  if (!json) throw new Error('No JSON chunk; expected a binary glTF 2.0 file')

  const metadata = JSON.parse(JSON.stringify(json))
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
  const total = 12 + 8 + jsonChunk.length + jsonPad + (bin ? 8 + bin.length + binPad : 0)
  const output = Buffer.alloc(total)
  output.write('glTF', 0, 'ascii')
  output.writeUInt32LE(2, 4)
  output.writeUInt32LE(total, 8)
  let cursor = 12
  output.writeUInt32LE(jsonChunk.length + jsonPad, cursor)
  output.writeUInt32LE(0x4e4f534a, cursor + 4)
  jsonChunk.copy(output, cursor + 8)
  output.fill(0x20, cursor + 8 + jsonChunk.length, cursor + 8 + jsonChunk.length + jsonPad)
  cursor += 8 + jsonChunk.length + jsonPad
  if (bin) {
    output.writeUInt32LE(bin.length + binPad, cursor)
    output.writeUInt32LE(0x004e4942, cursor + 4)
    bin.copy(output, cursor + 8)
  }
  return { output, metadata }
}

function accessorCount(document, primitive) {
  const index = primitive.indices ?? primitive.attributes?.POSITION
  return document.accessors?.[index]?.count ?? 0
}

const [, , filename, targetHeightArg] = process.argv
if (!filename) {
  console.error('Usage: node scripts/inspect-model-asset.mjs <model.glb> [target-height-metres]')
  process.exit(1)
}

const source = fs.readFileSync(filename)
const { output, metadata } = stripTextures(source)
const data = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength)
await MeshoptDecoder.ready
const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(data, '')
gltf.scene.updateMatrixWorld(true)
const bounds = new Box3().setFromObject(gltf.scene)
const size = bounds.getSize(new Vector3())
const centre = bounds.getCenter(new Vector3())
let meshes = 0
let bones = 0
gltf.scene.traverse((object) => {
  if (object.isMesh) meshes += 1
  if (object.isBone) bones += 1
})
const triangles = (metadata.meshes ?? []).reduce(
  (total, mesh) => total + (mesh.primitives ?? []).reduce(
    (sum, primitive) => sum + Math.floor(accessorCount(metadata, primitive) / 3),
    0,
  ),
  0,
)
const targetHeight = Number(targetHeightArg)
const fit = Number.isFinite(targetHeight) && targetHeight > 0 ? targetHeight / size.y : null
const round = (value) => Number(value.toFixed(5))

console.log(JSON.stringify({
  file: path.resolve(filename),
  bytes: source.byteLength,
  generator: metadata.asset?.generator ?? null,
  bounds: {
    min: bounds.min.toArray().map(round),
    max: bounds.max.toArray().map(round),
    size: size.toArray().map(round),
    centre: centre.toArray().map(round),
  },
  counts: {
    scenes: metadata.scenes?.length ?? 0,
    nodes: metadata.nodes?.length ?? 0,
    meshes,
    primitives: (metadata.meshes ?? []).reduce((n, mesh) => n + (mesh.primitives?.length ?? 0), 0),
    triangles,
    materials: metadata.materials?.length ?? 0,
    textures: metadata.textures?.length ?? 0,
    images: metadata.images?.length ?? 0,
    skins: metadata.skins?.length ?? 0,
    bones,
    animations: gltf.animations.length,
  },
  clips: gltf.animations.map((clip) => ({ name: clip.name, duration: round(clip.duration), tracks: clip.tracks.length })),
  fit: fit === null ? null : {
    targetHeightMetres: targetHeight,
    scale: round(fit),
    yOffsetRigUnits: round(-bounds.min.y),
    fittedSizeMetres: size.toArray().map((value) => round(value * fit)),
  },
}, null, 2))
