import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import console from 'node:console'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const SOURCES = [
  {
    source: '/Users/ajadvanwyk/Desktop/3d models animals/dragon_egg.glb',
    id: 'prop.hatchery.egg',
    targetHeight: 0.75, // metres tall on the roost pads
    textureMax: 1024,
  },
  {
    source: '/Users/ajadvanwyk/Desktop/3d models animals/stylized_dragon_flag (1).glb',
    id: 'prop.gate.flag',
    targetHeight: 3.2, // a 3.2 m banner beside the keep gate
    textureMax: 1024,
  },
  {
    source: '/Users/ajadvanwyk/Desktop/world build/fantasy_table.glb',
    id: 'prop.war.table',
    targetHeight: 0.95, // council tabletop height
    textureMax: 1024,
  },
]

function readGlb(file) {
  const data = fs.readFileSync(file)
  let json = null
  let binary = null
  for (let offset = 12; offset < data.length;) {
    const size = data.readUInt32LE(offset)
    const kind = data.readUInt32LE(offset + 4)
    const body = data.subarray(offset + 8, offset + 8 + size)
    if (kind === 0x4e4f534a) json = JSON.parse(body.toString('utf8'))
    else if (kind === 0x004e4942) binary = body
    offset += 8 + size
  }
  if (!json || !binary) throw new Error(`${file}: invalid GLB`)
  return { json, binary }
}

/* -------------------------------------------------- minimal column-major m4 */

const m4 = {
  identity: () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  multiply(a, b) {
    const out = new Array(16)
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        out[c * 4 + r] =
          a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]
      }
    }
    return out
  },
  fromTRS(t, q, s) {
    const [x, y, z, w] = q
    const x2 = x + x
    const y2 = y + y
    const z2 = z + z
    const xx = x * x2
    const xy = x * y2
    const xz = x * z2
    const yy = y * y2
    const yz = y * z2
    const zz = z * z2
    const wx = w * x2
    const wy = w * y2
    const wz = w * z2
    return [
      (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
      (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
      (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
      t[0], t[1], t[2], 1,
    ]
  },
  transformPoint(m, p) {
    return [
      m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
      m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
      m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
    ]
  },
}

function nodeMatrix(node) {
  if (node.matrix) return node.matrix
  return m4.fromTRS(node.translation ?? [0, 0, 0], node.rotation ?? [0, 0, 0, 1], node.scale ?? [1, 1, 1])
}

/**
 * World-frame bounds of a document: walks every scene root with accumulated
 * node transforms and transforms each POSITION accessor's AABB corners.
 * Raw accessor bounds are in each node's local frame — Sketchfab roots rotate
 * −90° about X, so measuring without transforms swaps Y and Z (a 71-unit-tall
 * flag measures 4.6 tall). This is the same arithmetic GLTFLoader performs.
 */
function worldBounds(json) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  const visit = (index, parent) => {
    const node = json.nodes[index]
    const world = m4.multiply(parent, nodeMatrix(node))
    if (node.mesh !== undefined) {
      for (const primitive of json.meshes[node.mesh].primitives) {
        const position = json.accessors[primitive.attributes.POSITION]
        if (!position?.min || !position?.max) continue
        for (let cx = 0; cx < 2; cx++) {
          for (let cy = 0; cy < 2; cy++) {
            for (let cz = 0; cz < 2; cz++) {
              const corner = m4.transformPoint(world, [
                cx ? position.max[0] : position.min[0],
                cy ? position.max[1] : position.min[1],
                cz ? position.max[2] : position.min[2],
              ])
              for (let a = 0; a < 3; a++) {
                min[a] = Math.min(min[a], corner[a])
                max[a] = Math.max(max[a], corner[a])
              }
            }
          }
        }
      }
    }
    for (const child of node.children ?? []) visit(child, world)
  }
  for (const root of json.scenes[json.scene ?? 0].nodes) visit(root, m4.identity())
  return { min, max }
}

function writeGlb(file, json, binary) {
  const jsonChunk = Buffer.from(JSON.stringify(json), 'utf8')
  const jsonPad = (4 - (jsonChunk.length % 4)) % 4
  const binPad = (4 - (binary.length % 4)) % 4
  const total = 12 + 8 + jsonChunk.length + jsonPad + 8 + binary.length + binPad
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
  out.writeUInt32LE(binary.length + binPad, cursor)
  out.writeUInt32LE(0x004e4942, cursor + 4)
  binary.copy(out, cursor + 8)
  fs.writeFileSync(file, out)
}

function convertMaterials(json) {
  let converted = 0
  for (const material of json.materials ?? []) {
    const specGloss = material.extensions?.KHR_materials_pbrSpecularGlossiness
    const updated = { ...material }
    delete updated.extensions
    if (specGloss) {
      updated.pbrMetallicRoughness = {
        baseColorFactor: specGloss.diffuseFactor ?? [1, 1, 1, 1],
        metallicFactor: 0,
        roughnessFactor: 1 - (specGloss.glossinessFactor ?? 1),
      }
      if (specGloss.diffuseTexture) updated.pbrMetallicRoughness.baseColorTexture = specGloss.diffuseTexture
      converted += 1
    }
    Object.assign(material, updated)
  }
  if (converted) {
    json.extensionsUsed = (json.extensionsUsed ?? []).filter((e) => e !== 'KHR_materials_pbrSpecularGlossiness')
    json.extensionsRequired = (json.extensionsRequired ?? []).filter((e) => e !== 'KHR_materials_pbrSpecularGlossiness')
  }
  return converted
}

function encodeImage(bytes, mimeType, maxSize) {
  if (!['image/jpeg', 'image/png'].includes(mimeType)) return { bytes, mimeType }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wyvern3d-hatchery-'))
  const file = path.join(directory, 'texture.png')
  const webp = path.join(directory, 'texture.webp')
  try {
    fs.writeFileSync(file, bytes)
    const probe = execFileSync('/usr/bin/sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file]).toString()
    const width = Number(probe.match(/pixelWidth:\s*(\d+)/)?.[1] ?? 0)
    const height = Number(probe.match(/pixelHeight:\s*(\d+)/)?.[1] ?? 0)
    const factor = Math.min(1, maxSize / Math.max(width, height, 1))
    const resize = factor < 1 ? ['-resize', String(Math.round(width * factor)), String(Math.round(height * factor))] : []
    try {
      execFileSync('cwebp', ['-quiet', '-q', '80', ...resize, file, '-o', webp], { stdio: 'ignore' })
      return { bytes: fs.readFileSync(webp), mimeType: 'image/webp' }
    } catch {
      execFileSync('/usr/bin/sips', ['-Z', String(maxSize), file], { stdio: 'ignore' })
      return { bytes: fs.readFileSync(file), mimeType }
    }
  } catch {
    return { bytes, mimeType }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

const doc = {
  asset: { version: '2.0', generator: 'wyvern3d build-hatchery-atlas' },
  scene: 0,
  scenes: [{ nodes: [] }],
  nodes: [],
  meshes: [],
  materials: [],
  textures: [],
  images: [],
  samplers: [],
  accessors: [],
  bufferViews: [],
  buffers: [{ byteLength: 0 }],
  animations: [],
  skins: [],
}
const binaryChunks = []
let binaryOffset = 0

for (const item of SOURCES) {
  const { json, binary } = readGlb(item.source)
  convertMaterials(json)

  // Scale is derived from measured world-frame bounds, never guessed from
  // authored units (Sketchfab roots rotate; the flag's Y is not its height).
  const measured = worldBounds(json)
  const scale = item.targetHeight / (measured.max[1] - measured.min[1])
  const { min, max } = measured

  const viewBase = doc.bufferViews.length
  const accessorBase = doc.accessors.length
  const meshBase = doc.meshes.length
  const materialBase = doc.materials.length
  const textureBase = doc.textures.length
  const imageBase = doc.images.length
  const samplerBase = doc.samplers.length

  // Re-encode images, then copy every bufferView across with a new offset.
  const replacements = new Map()
  for (const image of json.images ?? []) {
    const old = json.bufferViews[image.bufferView]
    const sourceBytes = binary.subarray(old.byteOffset ?? 0, (old.byteOffset ?? 0) + old.byteLength)
    const encoded = encodeImage(sourceBytes, image.mimeType ?? 'image/png', item.textureMax)
    replacements.set(image.bufferView, encoded)
    if (encoded.mimeType !== image.mimeType) image.mimeType = encoded.mimeType
  }
  for (let i = 0; i < (json.bufferViews?.length ?? 0); i++) {
    const view = json.bufferViews[i]
    const replacement = replacements.get(i)
    const bytes = replacement
      ? replacement.bytes
      : binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)
    const pad = (4 - (bytes.length % 4)) % 4
    const padded = pad ? Buffer.concat([bytes, Buffer.alloc(pad)]) : bytes
    doc.bufferViews.push({ ...view, buffer: 0, byteOffset: binaryOffset, byteLength: bytes.length })
    binaryChunks.push(padded)
    binaryOffset += padded.length
  }

  // World-frame bounds (Sketchfab roots rotate; raw accessor bounds would
  // swap Y and Z) — measured above; the re-anchor TRS is derived from these.

  for (const accessor of json.accessors ?? []) {
    doc.accessors.push({ ...accessor, bufferView: accessor.bufferView + viewBase })
  }
  for (const material of json.materials ?? []) {
    const copy = JSON.parse(JSON.stringify(material))
    for (const slot of [
      copy.pbrMetallicRoughness?.baseColorTexture,
      copy.pbrMetallicRoughness?.metallicRoughnessTexture,
      copy.pbrMetallicRoughness?.normalTexture,
      copy.emissiveTexture,
    ]) {
      if (slot && typeof slot.index === 'number') slot.index += textureBase
    }
    doc.materials.push(copy)
  }
  for (const image of json.images ?? []) {
    doc.images.push({ ...image, bufferView: image.bufferView + viewBase })
  }
  for (const texture of json.textures ?? []) {
    doc.textures.push({ ...texture, sampler: (texture.sampler ?? 0) + samplerBase, source: texture.source + imageBase })
  }
  for (const sampler of json.samplers ?? []) doc.samplers.push({ ...sampler })

  for (const mesh of json.meshes) {
    const primitives = mesh.primitives.map((primitive) => {
      const attributes = {}
      for (const [semantic, index] of Object.entries(primitive.attributes)) attributes[semantic] = index + accessorBase
      return {
        ...primitive,
        attributes,
        indices: primitive.indices === undefined ? undefined : primitive.indices + accessorBase,
        material: primitive.material === undefined ? undefined : primitive.material + materialBase,
      }
    })
    doc.meshes.push({ ...mesh, primitives })
  }

  // Clone the source node hierarchy under one named, re-anchored atlas node.
  const cloneNodes = (index) => {
    const clone = JSON.parse(JSON.stringify(json.nodes[index]))
    if (clone.mesh !== undefined) clone.mesh += meshBase
    if (clone.children) clone.children = clone.children.map(cloneNodes)
    if (clone.skin !== undefined) delete clone.skin // static atlas: no skins
    return doc.nodes.push(clone) - 1
  }
  const roots = json.scenes[json.scene ?? 0].nodes.map(cloneNodes)
  // Node transform is T·R·S: a child point p lands at translation + scale·p.
  // The re-anchor translation therefore needs the scale folded in — raw
  // -min.y would leave the prop hovering at min.y·(1 - scale).
  doc.scenes[0].nodes.push(
    doc.nodes.push({
      name: item.id,
      children: roots,
      translation: [
        -scale * (min[0] + max[0]) / 2,
        -scale * min[1],
        -scale * (min[2] + max[2]) / 2,
      ],
      scale: [scale, scale, scale],
    }) - 1,
  )
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
  console.log(`  ${item.id}: ${size.map((v) => v.toFixed(2)).join('x')} authored -> ${(size[1] * scale).toFixed(2)} m tall`)
}

doc.buffers = [{ byteLength: binaryOffset }]
const output = path.join(REPO, 'public/models/hatchery.glb')
writeGlb(output, doc, Buffer.concat(binaryChunks))
console.log(`${output}: ${(fs.statSync(output).size / 1e6).toFixed(2)} MB, ${doc.meshes.length} meshes, ${doc.materials.length} materials`)
