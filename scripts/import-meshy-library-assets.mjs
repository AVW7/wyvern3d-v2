#!/usr/bin/env node
import { Buffer } from 'node:buffer'
import console from 'node:console'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const ROOT = process.cwd()
const SOURCE = '/Users/ajadvanwyk/Desktop/meshyai assets'
const OUTPUT = path.join(ROOT, 'public/models/library')
const ITEMS = [
  ['Meshy_AI_Arcane_Alchemist_s_Wo_0808085758_texture.glb', 'arcane-alchemist-workstation.glb', 6_052],
  ['Meshy_AI_Forest_Wyvern_0808182041_texture.glb', 'forest-wyvern-display.glb', 40_000],
  ['Meshy_AI_Hogwarts_Crest_0808184346_texture.glb', 'arcane-academy-crest.glb', 12_000],
  ['Meshy_AI_Throne_of_Books_0808181553_texture.glb', 'throne-of-books.glb', 20_000],
]

const COMPONENTS = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }
const WIDTHS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 }

function moduleUrl() {
  const store = path.join(ROOT, 'node_modules/.pnpm')
  const name = fs.readdirSync(store).find((entry) => entry.startsWith('meshoptimizer@'))
  if (!name) throw new Error('meshoptimizer unavailable; run pnpm install')
  return pathToFileURL(path.join(store, name, 'node_modules/meshoptimizer/index.js')).href
}

function readGlb(file) {
  const data = fs.readFileSync(file)
  let json, binary
  for (let offset = 12; offset < data.length;) {
    const size = data.readUInt32LE(offset), type = data.readUInt32LE(offset + 4)
    const body = data.subarray(offset + 8, offset + 8 + size)
    if (type === 0x4e4f534a) json = JSON.parse(body.toString('utf8'))
    if (type === 0x004e4942) binary = body
    offset += 8 + size
  }
  if (!json || !binary) throw new Error(`${file}: invalid GLB`)
  return { json, binary }
}

function accessorData(doc, binary, index) {
  const accessor = doc.accessors[index], view = doc.bufferViews[accessor.bufferView]
  const Type = COMPONENTS[accessor.componentType]
  const width = WIDTHS[accessor.type]
  if (!Type || !width || view.byteStride) throw new Error(`unsupported accessor ${index}`)
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
  return new Type(binary.buffer, binary.byteOffset + start, accessor.count * width)
}

function writeGlb(file, doc, binary) {
  const json = Buffer.from(JSON.stringify(doc)), jp = (4 - json.length % 4) % 4, bp = (4 - binary.length % 4) % 4
  const out = Buffer.alloc(12 + 8 + json.length + jp + 8 + binary.length + bp)
  out.write('glTF', 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8)
  let offset = 12
  out.writeUInt32LE(json.length + jp, offset); out.writeUInt32LE(0x4e4f534a, offset + 4); json.copy(out, offset + 8)
  out.fill(0x20, offset + 8 + json.length, offset + 8 + json.length + jp); offset += 8 + json.length + jp
  out.writeUInt32LE(binary.length + bp, offset); out.writeUInt32LE(0x004e4942, offset + 4); binary.copy(out, offset + 8)
  fs.writeFileSync(file, out)
}

function addChunk(chunks, bytes) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const pad = (4 - length % 4) % 4
  if (pad) chunks.push(Buffer.alloc(pad))
  const offset = length + pad
  chunks.push(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength))
  return offset
}

function webImage(bytes, mimeType) {
  if (bytes.length < 1_000_000 || !['image/jpeg', 'image/png'].includes(mimeType)) return bytes
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wyvern3d-texture-'))
  const extension = mimeType === 'image/png' ? '.png' : '.jpg'
  const file = path.join(directory, `texture${extension}`)
  try {
    fs.writeFileSync(file, bytes)
    execFileSync('/usr/bin/sips', ['-Z', '1024', file], { stdio: 'ignore' })
    return fs.readFileSync(file)
  } finally {
    fs.rmSync(directory, { recursive: true })
  }
}

const { MeshoptSimplifier } = await import(await moduleUrl())
await MeshoptSimplifier.ready
fs.mkdirSync(OUTPUT, { recursive: true })
const reports = []

for (const [sourceName, outputName, targetTriangles] of ITEMS) {
  const { json, binary } = readGlb(path.join(SOURCE, sourceName))
  const primitive = json.meshes?.[0]?.primitives?.[0]
  if (!primitive || json.meshes.length !== 1 || json.meshes[0].primitives.length !== 1) throw new Error(`${sourceName}: expected one primitive`)
  const positions = accessorData(json, binary, primitive.attributes.POSITION)
  const positionAccessor = json.accessors[primitive.attributes.POSITION]
  const sourceIndexData = accessorData(json, binary, primitive.indices)
  const sourceIndices = Uint32Array.from(sourceIndexData)
  const desired = Math.min(sourceIndices.length, targetTriangles * 3)
  const [indices, error] = desired === sourceIndices.length
    ? [sourceIndices, 0]
    : MeshoptSimplifier.simplifySloppy(sourceIndices, positions, WIDTHS[positionAccessor.type], null, desired, 0.02)
  const [remap, vertexCount] = MeshoptSimplifier.compactMesh(indices)
  const chunks = [], views = [], accessors = []

  for (const [semantic, oldIndex] of Object.entries(primitive.attributes)) {
    const oldAccessor = json.accessors[oldIndex], source = accessorData(json, binary, oldIndex)
    const Type = COMPONENTS[oldAccessor.componentType], width = WIDTHS[oldAccessor.type]
    const compact = new Type(vertexCount * width)
    for (let old = 0; old < remap.length; old += 1) {
      const next = remap[old]
      if (next === 0xffffffff) continue
      for (let component = 0; component < width; component += 1) compact[next * width + component] = source[old * width + component]
    }
    const offset = addChunk(chunks, compact)
    views.push({ buffer: 0, byteOffset: offset, byteLength: compact.byteLength, target: 34962 })
    accessors.push({ ...oldAccessor, bufferView: views.length - 1, byteOffset: 0, count: vertexCount })
    primitive.attributes[semantic] = accessors.length - 1
  }

  const IndexType = vertexCount <= 65535 ? Uint16Array : Uint32Array
  const compactIndices = IndexType.from(indices)
  const indexOffset = addChunk(chunks, compactIndices)
  views.push({ buffer: 0, byteOffset: indexOffset, byteLength: compactIndices.byteLength, target: 34963 })
  accessors.push({ bufferView: views.length - 1, componentType: vertexCount <= 65535 ? 5123 : 5125, count: compactIndices.length, type: 'SCALAR' })
  primitive.indices = accessors.length - 1

  for (const image of json.images ?? []) {
    const old = json.bufferViews[image.bufferView]
    const sourceBytes = binary.subarray(old.byteOffset ?? 0, (old.byteOffset ?? 0) + old.byteLength)
    const bytes = webImage(sourceBytes, image.mimeType)
    const offset = addChunk(chunks, bytes)
    views.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length })
    image.bufferView = views.length - 1
  }
  json.bufferViews = views
  json.accessors = accessors
  const packed = Buffer.concat(chunks)
  json.buffers = [{ byteLength: packed.length }]
  json.asset.extras = { ...(json.asset.extras ?? {}), wyvern3dImport: { sourceName, sourceTriangles: sourceIndices.length / 3, triangles: compactIndices.length / 3 } }
  const destination = path.join(OUTPUT, outputName)
  writeGlb(destination, json, packed)
  reports.push({ outputName, sourceTriangles: sourceIndices.length / 3, triangles: compactIndices.length / 3, vertices: vertexCount, error: Number(error.toFixed(6)), bytes: fs.statSync(destination).size })
}
console.log(JSON.stringify(reports, null, 2))
