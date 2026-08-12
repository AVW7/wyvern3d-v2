#!/usr/bin/env node
import { Buffer } from 'node:buffer'
import console from 'node:console'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const ROOT = process.cwd()
const INPUT = path.join(ROOT, 'public/models/source/sorcerer-handler/character.glb')
const OUTPUT = path.join(ROOT, 'public/models/arcane-handler.glb')
const TARGET_TRIANGLES = 30_000

function meshoptimizerModule() {
  const store = path.join(ROOT, 'node_modules/.pnpm')
  const packageDir = fs.readdirSync(store).find((name) => name.startsWith('meshoptimizer@'))
  if (!packageDir) throw new Error('meshoptimizer is unavailable; run pnpm install')
  return pathToFileURL(path.join(store, packageDir, 'node_modules/meshoptimizer/index.js')).href
}

function readGlb(file) {
  const data = fs.readFileSync(file)
  let json
  let binary
  for (let offset = 12; offset < data.length;) {
    const size = data.readUInt32LE(offset)
    const type = data.readUInt32LE(offset + 4)
    const body = data.subarray(offset + 8, offset + 8 + size)
    if (type === 0x4e4f534a) json = JSON.parse(body.toString('utf8'))
    if (type === 0x004e4942) binary = body
    offset += 8 + size
  }
  if (!json || !binary) throw new Error('source must be a binary GLB')
  return { json, binary }
}

function accessorBytes(doc, binary, accessorIndex) {
  const accessor = doc.accessors[accessorIndex]
  const view = doc.bufferViews[accessor.bufferView]
  const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
  return binary.subarray(offset, offset + view.byteLength - (accessor.byteOffset ?? 0))
}

function writeGlb(file, doc, binary) {
  const json = Buffer.from(JSON.stringify(doc))
  const jsonPadding = (4 - json.length % 4) % 4
  const binaryPadding = (4 - binary.length % 4) % 4
  const total = 12 + 8 + json.length + jsonPadding + 8 + binary.length + binaryPadding
  const output = Buffer.alloc(total)
  output.write('glTF', 0)
  output.writeUInt32LE(2, 4)
  output.writeUInt32LE(total, 8)
  let offset = 12
  output.writeUInt32LE(json.length + jsonPadding, offset)
  output.writeUInt32LE(0x4e4f534a, offset + 4)
  json.copy(output, offset + 8)
  output.fill(0x20, offset + 8 + json.length, offset + 8 + json.length + jsonPadding)
  offset += 8 + json.length + jsonPadding
  output.writeUInt32LE(binary.length + binaryPadding, offset)
  output.writeUInt32LE(0x004e4942, offset + 4)
  binary.copy(output, offset + 8)
  fs.writeFileSync(file, output)
}

const { MeshoptSimplifier } = await import(await meshoptimizerModule())
await MeshoptSimplifier.ready
const { json, binary } = readGlb(INPUT)
const primitive = json.meshes?.[0]?.primitives?.[0]
  if (!primitive || json.meshes.length !== 1 || json.meshes[0].primitives.length !== 1) {
  throw new Error('expected the Meshy handler to contain one mesh primitive')
}

const positionAccessor = json.accessors[primitive.attributes.POSITION]
const positionView = json.bufferViews[positionAccessor.bufferView]
if (positionAccessor.componentType !== 5126 || positionAccessor.type !== 'VEC3') {
  throw new Error('positions must be float VEC3')
}
const positionBytes = accessorBytes(json, binary, primitive.attributes.POSITION)
const positions = new Float32Array(
  positionBytes.buffer,
  positionBytes.byteOffset,
  Math.floor(positionBytes.byteLength / 4),
)
const positionStride = (positionView.byteStride ?? 12) / 4

const indexAccessor = json.accessors[primitive.indices]
if (indexAccessor.componentType !== 5123) throw new Error('expected unsigned-short indices')
const indexBytes = accessorBytes(json, binary, primitive.indices)
const sourceIndices = new Uint16Array(
  indexBytes.buffer,
  indexBytes.byteOffset,
  indexAccessor.count,
)
const indices = Uint32Array.from(sourceIndices)
const [simplified, error] = MeshoptSimplifier.simplify(
  indices,
  positions,
  positionStride,
  TARGET_TRIANGLES * 3,
  0.02,
  ['LockBorder', 'Permissive'],
)
if (simplified.length > TARGET_TRIANGLES * 3 || simplified.length < 28_000 * 3) {
  throw new Error(`simplifier produced ${simplified.length / 3} triangles`)
}

const simplifiedBytes = Buffer.alloc(simplified.length * 2)
for (let index = 0; index < simplified.length; index += 1) {
  if (simplified[index] > 65535) throw new Error('LOD index exceeds unsigned-short range')
  simplifiedBytes.writeUInt16LE(simplified[index], index * 2)
}
const indexViewIndex = indexAccessor.bufferView
indexAccessor.count = simplified.length
json.bufferViews[indexViewIndex].byteLength = simplifiedBytes.length

// Repack every buffer view to remove the discarded index data while retaining
// embedded images, materials, the skin, and all vertex attributes byte-for-byte.
const chunks = []
let packedLength = 0
for (let index = 0; index < json.bufferViews.length; index += 1) {
  const view = json.bufferViews[index]
  const padding = (4 - packedLength % 4) % 4
  if (padding) {
    chunks.push(Buffer.alloc(padding))
    packedLength += padding
  }
  const bytes = index === indexViewIndex
    ? simplifiedBytes
    : binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)
  view.byteOffset = packedLength
  view.byteLength = bytes.length
  chunks.push(bytes)
  packedLength += bytes.length
}
const packed = Buffer.concat(chunks)
json.buffers[0].byteLength = packed.length
json.asset.extras = {
  ...(json.asset.extras ?? {}),
  wyvern3dLod: { sourceTriangles: sourceIndices.length / 3, targetTriangles: simplified.length / 3 },
}
writeGlb(OUTPUT, json, packed)

console.log(JSON.stringify({
  sourceTriangles: sourceIndices.length / 3,
  triangles: simplified.length / 3,
  simplificationError: Number(error.toFixed(6)),
  bytes: fs.statSync(OUTPUT).size,
}, null, 2))
