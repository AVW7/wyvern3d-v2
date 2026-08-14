#!/usr/bin/env node
/**
 * Build public/models/biomes.glb — the biome scenery atlas.
 *
 * Why an atlas and not one GLB per prop
 * ------------------------------------
 * Biome dressing scatters the same few props hundreds of times. props.tsx draws
 * that with InstancedMesh, which needs the prop's geometry up front and batches
 * best when everything arrives in one file. Twenty separate GLBs would be twenty
 * requests and twenty caches for geometry that is used together or not at all.
 * This is the same shape as scripts/extract-assets.py's sanctuary atlas, with
 * one difference: these sources each bring their own materials and textures, so
 * the output is multi-material rather than one shared palette.
 *
 * What it does per prop, in order
 * -------------------------------
 *   1. select nodes from the source GLB by name (or take every mesh node)
 *   2. bake each node's world transform into the geometry — InstancedMesh
 *      supplies one matrix per instance, so authored transforms cannot survive
 *      as node TRS
 *   3. re-anchor: centred in x/z, resting on y=0
 *   4. scale by targetHeight / measured height. Authored metres, never inferred
 *      from the file's unit setting or its object names
 *   5. simplify to the triangle budget
 *   6. convert KHR_materials_pbrSpecularGlossiness to metallic/roughness —
 *      three.js dropped that extension and such a source renders as an
 *      untextured white blob otherwise
 *   7. cap textures at 1024 px
 *
 * Everything here is cosmetic fitting. Gameplay dimensions live in src/core/data
 * and are never read from a model.
 *
 * Licensing gate
 * --------------
 * A prop only reaches public/models once its manifest entry says
 * license.status === "approved" with evidence. --draft bypasses that and writes
 * to .biome-atlas/ instead, which is gitignored and not served.
 *
 * Usage:
 *     pnpm assets:biome-atlas               # approved props -> public/models
 *     pnpm assets:biome-atlas --draft       # everything -> .biome-atlas/
 *     pnpm assets:biome-atlas --only=prop.biome.forest.oak
 */
import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import console from 'node:console'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { URL, pathToFileURL } from 'node:url'

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const MANIFEST = JSON.parse(fs.readFileSync(path.join(REPO, 'scripts/biome-library.json'), 'utf8'))
const HOME = process.env.HOME ?? ''

const draft = process.argv.includes('--draft')
const onlyArg = process.argv.find((argument) => argument.startsWith('--only='))
const only = onlyArg ? onlyArg.slice('--only='.length).split(',') : null

const COMPONENTS = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }
const WIDTHS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 }
// TANGENT is dead weight — none of these materials carry a normal map. COLOR_0
// is kept because several sources are vertex-coloured with no texture at all,
// and dropping it turns them uniformly grey.
const KEEP_ATTRIBUTES = ['POSITION', 'NORMAL', 'TEXCOORD_0', 'COLOR_0']

function storeModule(name) {
  const store = path.join(REPO, 'node_modules/.pnpm')
  const entry = fs.readdirSync(store).find((candidate) => candidate.startsWith(`${name}@`))
  if (!entry) throw new Error(`${name} unavailable; run pnpm install`)
  return path.join(store, entry, 'node_modules', name)
}

const { MeshoptSimplifier } = await import(pathToFileURL(path.join(storeModule('meshoptimizer'), 'index.js')).href)
await MeshoptSimplifier.ready

/** Draco is only loaded when a source actually needs it. */
let dracoDecoder = null
async function draco() {
  if (!dracoDecoder) {
    const module = await import(pathToFileURL(path.join(storeModule('draco3d'), 'draco_decoder_nodejs.js')).href)
    // Emscripten CJS: the module's export *is* the factory, and it resolves to
    // itself once the wasm is ready.
    dracoDecoder = await new Promise((resolve) => {
      const instance = (module.default ?? module)({ onModuleLoaded: () => resolve(instance) })
    })
  }
  return dracoDecoder
}

/* ---------------------------------------------------------------- GLB I/O */

function readGlb(file) {
  const data = fs.readFileSync(file)
  let json = null
  let binary = null
  for (let offset = 12; offset < data.length; ) {
    const size = data.readUInt32LE(offset)
    const type = data.readUInt32LE(offset + 4)
    const body = data.subarray(offset + 8, offset + 8 + size)
    if (type === 0x4e4f534a) json = JSON.parse(body.toString('utf8'))
    if (type === 0x004e4942) binary = body
    offset += 8 + size
  }
  if (!json || !binary) throw new Error(`${file}: invalid GLB`)
  return { json, binary }
}

function writeGlb(file, doc, binary) {
  const json = Buffer.from(JSON.stringify(doc))
  const jsonPad = (4 - (json.length % 4)) % 4
  const binaryPad = (4 - (binary.length % 4)) % 4
  const out = Buffer.alloc(12 + 8 + json.length + jsonPad + 8 + binary.length + binaryPad)
  out.write('glTF', 0)
  out.writeUInt32LE(2, 4)
  out.writeUInt32LE(out.length, 8)
  let offset = 12
  out.writeUInt32LE(json.length + jsonPad, offset)
  out.writeUInt32LE(0x4e4f534a, offset + 4)
  json.copy(out, offset + 8)
  out.fill(0x20, offset + 8 + json.length, offset + 8 + json.length + jsonPad)
  offset += 8 + json.length + jsonPad
  out.writeUInt32LE(binary.length + binaryPad, offset)
  out.writeUInt32LE(0x004e4942, offset + 4)
  binary.copy(out, offset + 8)
  fs.writeFileSync(file, out)
}

function bufferViewBytes(json, binary, index) {
  const view = json.bufferViews[index]
  const start = view.byteOffset ?? 0
  return binary.subarray(start, start + view.byteLength)
}

/** An accessor's elements as a tightly packed typed array, de-interleaving if needed. */
function accessorData(json, binary, index) {
  const accessor = json.accessors[index]
  if (accessor.sparse) throw new Error('sparse accessors are not supported')
  const Type = COMPONENTS[accessor.componentType]
  const width = WIDTHS[accessor.type]
  if (!Type || !width) throw new Error(`unsupported accessor type ${accessor.type}/${accessor.componentType}`)
  if (accessor.bufferView === undefined) return new Type(accessor.count * width)

  const view = json.bufferViews[accessor.bufferView]
  const base = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
  const element = Type.BYTES_PER_ELEMENT * width
  const stride = view.byteStride ?? element
  if (stride === element) {
    return new Type(binary.buffer.slice(binary.byteOffset + base, binary.byteOffset + base + accessor.count * element))
  }
  const out = new Type(accessor.count * width)
  for (let i = 0; i < accessor.count; i += 1) {
    const source = new Type(binary.buffer.slice(binary.byteOffset + base + i * stride, binary.byteOffset + base + i * stride + element))
    out.set(source, i * width)
  }
  return out
}

/* ----------------------------------------------------------------- Matrix */

function multiply(a, b) {
  const out = new Float64Array(16)
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0
      for (let k = 0; k < 4; k += 1) sum += a[k * 4 + row] * b[column * 4 + k]
      out[column * 4 + row] = sum
    }
  }
  return out
}

function nodeMatrix(node) {
  if (node.matrix) return Float64Array.from(node.matrix)
  const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1]
  const [sx, sy, sz] = node.scale ?? [1, 1, 1]
  const [tx, ty, tz] = node.translation ?? [0, 0, 0]
  const x2 = x + x, y2 = y + y, z2 = z + z
  const xx = x * x2, xy = x * y2, xz = x * z2
  const yy = y * y2, yz = y * z2, zz = z * z2
  const wx = w * x2, wy = w * y2, wz = w * z2
  return Float64Array.from([
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ])
}

const IDENTITY = Float64Array.from([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])

/** Every mesh node in the scene, with its world matrix. */
function meshNodes(json) {
  const found = []
  const visit = (index, parent) => {
    const node = json.nodes[index]
    const world = multiply(parent, nodeMatrix(node))
    if (node.mesh !== undefined) found.push({ index, name: node.name ?? `node_${index}`, mesh: node.mesh, world })
    for (const child of node.children ?? []) visit(child, world)
  }
  const scene = json.scenes?.[json.scene ?? 0]
  for (const root of scene?.nodes ?? json.nodes.map((_, index) => index)) visit(root, IDENTITY)
  return found
}

function transformPoint(matrix, x, y, z) {
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
  ]
}

/* ------------------------------------------------------------- Primitives */

async function decodeDraco(json, binary, primitive) {
  const extension = primitive.extensions.KHR_draco_mesh_compression
  const decoderModule = await draco()
  const bytes = bufferViewBytes(json, binary, extension.bufferView)
  const buffer = new decoderModule.DecoderBuffer()
  buffer.Init(new Int8Array(bytes), bytes.length)
  const decoder = new decoderModule.Decoder()
  const mesh = new decoderModule.Mesh()
  const status = decoder.DecodeBufferToMesh(buffer, mesh)
  if (!status.ok()) throw new Error(`draco decode failed: ${status.error_msg()}`)

  const faces = mesh.num_faces()
  const indices = new Uint32Array(faces * 3)
  const face = new decoderModule.DracoInt32Array()
  for (let i = 0; i < faces; i += 1) {
    decoder.GetFaceFromMesh(mesh, i, face)
    indices[i * 3] = face.GetValue(0)
    indices[i * 3 + 1] = face.GetValue(1)
    indices[i * 3 + 2] = face.GetValue(2)
  }
  decoderModule.destroy(face)

  const attributes = {}
  for (const [semantic, id] of Object.entries(extension.attributes)) {
    if (!KEEP_ATTRIBUTES.includes(semantic)) continue
    const attribute = decoder.GetAttributeByUniqueId(mesh, id)
    const width = attribute.num_components()
    const values = new decoderModule.DracoFloat32Array()
    decoder.GetAttributeFloatForAllPoints(mesh, attribute, values)
    const out = new Float32Array(mesh.num_points() * width)
    for (let i = 0; i < out.length; i += 1) out[i] = values.GetValue(i)
    decoderModule.destroy(values)
    attributes[semantic] = { data: out, width }
  }

  decoderModule.destroy(mesh)
  decoderModule.destroy(decoder)
  decoderModule.destroy(buffer)
  return { attributes, indices }
}

/** One primitive as plain float attributes plus a Uint32 index list. */
async function readPrimitive(json, binary, primitive) {
  if (primitive.extensions?.KHR_draco_mesh_compression) return decodeDraco(json, binary, primitive)

  const attributes = {}
  for (const semantic of KEEP_ATTRIBUTES) {
    const index = primitive.attributes[semantic]
    if (index === undefined) continue
    const accessor = json.accessors[index]
    const width = WIDTHS[accessor.type]
    const raw = accessorData(json, binary, index)
    // A normalized integer accessor stores 0..255 (or 0..65535) for what the
    // renderer reads as 0..1; converting to float without dividing would blow
    // vertex colours out to white.
    const divisor = accessor.normalized ? { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 }[accessor.componentType] ?? 1 : 1
    const data = raw instanceof Float32Array && divisor === 1 ? raw : Float32Array.from(raw, (value) => value / divisor)
    attributes[semantic] = { data, width }
  }
  const count = attributes.POSITION ? attributes.POSITION.data.length / attributes.POSITION.width : 0
  const indices = primitive.indices !== undefined
    ? Uint32Array.from(accessorData(json, binary, primitive.indices))
    : Uint32Array.from({ length: count }, (_, i) => i)
  return { attributes, indices }
}

/* -------------------------------------------------------------- Materials */

/**
 * Convert a spec/gloss material to metallic/roughness.
 *
 * three.js dropped KHR_materials_pbrSpecularGlossiness, and such a source keeps
 * its colour maps *inside* the extension — the model would load, and render
 * white.
 */
function metalRough(material) {
  const specGloss = material.extensions?.KHR_materials_pbrSpecularGlossiness
  const converted = { ...material }
  // Every material extension is dropped, not just spec/gloss. The others in
  // these sources (transmission, specular, unlit) carry their own texture
  // references indexed into the *source* document, and an unlit prop would
  // ignore the biome's lighting besides.
  delete converted.extensions
  if (!specGloss) return converted
  converted.pbrMetallicRoughness = {
    baseColorFactor: specGloss.diffuseFactor ?? [1, 1, 1, 1],
    ...(specGloss.diffuseTexture ? { baseColorTexture: specGloss.diffuseTexture } : {}),
    metallicFactor: 0,
    roughnessFactor: 1 - (specGloss.glossinessFactor ?? 1),
  }
  return converted
}

/**
 * Re-encode an embedded texture as a small WebP.
 *
 * These sources ship 2k PNGs — 26 MB of them across the first curated set,
 * against a 3.5 MB sanctuary atlas. WebP at 512 px keeps the alpha the foliage
 * cutouts need and costs about a fortieth of that. cwebp is a soft dependency:
 * without it the texture is only resized, and the atlas is merely large.
 */
function encodeImage(bytes, mimeType, maxSize) {
  if (!['image/jpeg', 'image/png'].includes(mimeType)) return { bytes, mimeType }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wyvern3d-biome-'))
  const file = path.join(directory, `texture${mimeType === 'image/png' ? '.png' : '.jpg'}`)
  const webp = path.join(directory, 'texture.webp')
  try {
    fs.writeFileSync(file, bytes)
    // Both sides are capped explicitly, from the measured dimensions. cwebp's
    // `-resize <w> 0` bounds one axis only, and these packs ship 1024x8192
    // foliage atlases — which is how a 512x4096 texture reached the atlas on
    // the first build.
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

/* ----------------------------------------------------------------- Output */

const out = {
  asset: { version: '2.0', generator: 'wyvern3d build-biome-atlas' },
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
  buffers: [],
}
const chunks = []
let blobLength = 0

function addView(bytes, target) {
  const pad = (4 - (blobLength % 4)) % 4
  if (pad) {
    chunks.push(Buffer.alloc(pad))
    blobLength += pad
  }
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  chunks.push(buffer)
  const view = { buffer: 0, byteOffset: blobLength, byteLength: buffer.length }
  if (target) view.target = target
  blobLength += buffer.length
  out.bufferViews.push(view)
  return out.bufferViews.length - 1
}

function addAccessor(data, type, componentType, target, extra = {}) {
  const view = addView(data, target)
  out.accessors.push({ bufferView: view, componentType, count: data.length / WIDTHS[type], type, ...extra })
  return out.accessors.length - 1
}

/** Source (file, material index) -> output material index. */
const materialCache = new Map()
/** Source (file, image index) -> output image index. One copy per source image. */
const imageCache = new Map()
let usesWebp = false

function copyImage(source, index, maxSize) {
  const key = `${source.file}#${index}`
  const cached = imageCache.get(key)
  if (cached !== undefined) return cached
  const image = source.json.images[index]
  const encoded = encodeImage(bufferViewBytes(source.json, source.binary, image.bufferView), image.mimeType, maxSize)
  if (encoded.mimeType === 'image/webp') usesWebp = true
  out.images.push({ mimeType: encoded.mimeType, bufferView: addView(encoded.bytes) })
  imageCache.set(key, out.images.length - 1)
  return out.images.length - 1
}

function copyMaterial(source, sourceFile, index, maxSize) {
  const key = `${sourceFile}#${index}`
  const cached = materialCache.get(key)
  if (cached !== undefined) return cached

  const material = metalRough(source.json.materials?.[index] ?? { name: `material_${index}` })
  const remapTexture = (reference) => {
    if (!reference) return undefined
    const texture = source.json.textures[reference.index]
    const image = source.json.images?.[texture.source]
    if (!image || image.bufferView === undefined) return undefined
    const imageIndex = copyImage(source, texture.source, maxSize)
    const sampler = source.json.samplers?.[texture.sampler]
    if (sampler) out.samplers.push(sampler)
    // A WebP image is not core glTF: it has to arrive through EXT_texture_webp,
    // which three's GLTFLoader reads. Declaring it required is what stops a
    // loader without that extension from rendering an untextured prop.
    const webp = out.images[imageIndex].mimeType === 'image/webp'
    out.textures.push({
      ...(webp ? { extensions: { EXT_texture_webp: { source: imageIndex } } } : { source: imageIndex }),
      ...(sampler ? { sampler: out.samplers.length - 1 } : {}),
    })
    return { ...reference, index: out.textures.length - 1 }
  }

  const pbr = { ...(material.pbrMetallicRoughness ?? {}) }
  pbr.baseColorTexture = remapTexture(pbr.baseColorTexture)
  pbr.metallicRoughnessTexture = remapTexture(pbr.metallicRoughnessTexture)
  for (const field of ['baseColorTexture', 'metallicRoughnessTexture']) if (!pbr[field]) delete pbr[field]
  const emissiveTexture = remapTexture(material.emissiveTexture)

  out.materials.push({
    name: material.name ?? `material_${index}`,
    pbrMetallicRoughness: pbr,
    ...(material.emissiveFactor ? { emissiveFactor: material.emissiveFactor } : {}),
    ...(emissiveTexture ? { emissiveTexture } : {}),
    ...(material.doubleSided ? { doubleSided: true } : {}),
    ...(material.alphaMode ? { alphaMode: material.alphaMode } : {}),
    ...(material.alphaCutoff !== undefined ? { alphaCutoff: material.alphaCutoff } : {}),
  })
  materialCache.set(key, out.materials.length - 1)
  return out.materials.length - 1
}

/* ------------------------------------------------------------------ Build */

const sources = new Map()
function loadSource(entry) {
  const root = MANIFEST.sourceRoots[entry.source.root]
  if (!root) throw new Error(`${entry.id}: unknown source root "${entry.source.root}"`)
  const file = path.join(root.replace(/^~(?=$|\/)/, HOME), entry.source.file)
  if (!sources.has(file)) {
    if (!fs.existsSync(file)) throw new Error(`${entry.id}: source missing: ${file}`)
    const { json, binary } = readGlb(file)
    sources.set(file, { json, binary, file })
  }
  return sources.get(file)
}

const selected = MANIFEST.props
  .filter((entry) => !only || only.includes(entry.id))
  .filter((entry) => draft || entry.license?.status === 'approved')

const refused = MANIFEST.props
  .filter((entry) => !only || only.includes(entry.id))
  .filter((entry) => !draft && entry.license?.status !== 'approved')

if (!selected.length) {
  console.error(
    refused.length
      ? `Every selected prop is unlicensed. Set license.status to "approved" with evidence in scripts/biome-library.json, or build with --draft.\n${refused.map((entry) => `  ${entry.id} (${entry.license?.status ?? 'missing'})`).join('\n')}`
      : 'No props selected.',
  )
  process.exit(1)
}
for (const entry of refused) console.warn(`skipping unlicensed ${entry.id} (${entry.license?.status ?? 'missing'})`)

const report = []

for (const entry of selected) {
  const source = loadSource(entry)
  const nodes = meshNodes(source.json)
  const chosen = entry.nodes ? nodes.filter((node) => entry.nodes.includes(node.name)) : nodes
  if (!chosen.length) throw new Error(`${entry.id}: no matching nodes in ${entry.source.file}`)

  // Gather every primitive, in world space, grouped by source material.
  const groups = new Map()
  for (const node of chosen) {
    for (const primitive of source.json.meshes[node.mesh].primitives ?? []) {
      const { attributes, indices } = await readPrimitive(source.json, source.binary, primitive)
      if (!attributes.POSITION) continue
      const positions = attributes.POSITION.data
      const world = new Float32Array(positions.length)
      for (let i = 0; i < positions.length; i += 3) {
        const [x, y, z] = transformPoint(node.world, positions[i], positions[i + 1], positions[i + 2])
        world[i] = x
        world[i + 1] = y
        world[i + 2] = z
      }
      const normals = attributes.NORMAL
        ? (() => {
            const rotated = new Float32Array(attributes.NORMAL.data.length)
            for (let i = 0; i < rotated.length; i += 3) {
              const [x, y, z] = transformPoint(node.world, attributes.NORMAL.data[i], attributes.NORMAL.data[i + 1], attributes.NORMAL.data[i + 2])
              const ox = x - node.world[12], oy = y - node.world[13], oz = z - node.world[14]
              const length = Math.hypot(ox, oy, oz) || 1
              rotated[i] = ox / length
              rotated[i + 1] = oy / length
              rotated[i + 2] = oz / length
            }
            return rotated
          })()
        : null
      const material = primitive.material ?? -1
      if (!groups.has(material)) groups.set(material, [])
      groups.get(material).push({
        positions: world,
        normals,
        uvs: attributes.TEXCOORD_0?.data ?? null,
        colors: attributes.COLOR_0 ?? null,
        indices,
      })
    }
  }
  if (!groups.size) throw new Error(`${entry.id}: selected nodes have no geometry`)

  // Measure in world space, then re-anchor and scale as one rigid prop.
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
  for (const parts of groups.values()) {
    for (const part of parts) {
      for (let i = 0; i < part.positions.length; i += 3) {
        for (let axis = 0; axis < 3; axis += 1) {
          bounds.min[axis] = Math.min(bounds.min[axis], part.positions[i + axis])
          bounds.max[axis] = Math.max(bounds.max[axis], part.positions[i + axis])
        }
      }
    }
  }
  const measured = bounds.max[1] - bounds.min[1]
  const scale = entry.targetHeight / (measured || 1)
  const centreX = (bounds.min[0] + bounds.max[0]) / 2
  const centreZ = (bounds.min[2] + bounds.max[2]) / 2
  const restY = bounds.min[1] + (entry.sink ?? 0) / scale

  const sourceTriangles = [...groups.values()].reduce(
    (total, parts) => total + parts.reduce((sum, part) => sum + part.indices.length / 3, 0),
    0,
  )
  const budget = entry.maxTriangles ?? sourceTriangles

  // Merge each material's parts into one welded surface, in final world scale.
  // Simplification then collapses across the whole surface rather than per
  // source node, and the re-anchoring is applied exactly once.
  const merged = []
  for (const [material, parts] of groups) {
    const vertexCount = parts.reduce((total, part) => total + part.positions.length / 3, 0)
    const positions = new Float32Array(vertexCount * 3)
    const normals = new Float32Array(vertexCount * 3)
    const uvs = new Float32Array(vertexCount * 2)
    const colourWidth = parts.find((part) => part.colors)?.colors.width ?? 0
    const colors = colourWidth ? new Float32Array(vertexCount * colourWidth) : null
    const indices = new Uint32Array(parts.reduce((total, part) => total + part.indices.length, 0))
    let vertexOffset = 0
    let indexOffset = 0
    for (const part of parts) {
      const count = part.positions.length / 3
      for (let i = 0; i < count; i += 1) {
        positions[(vertexOffset + i) * 3] = (part.positions[i * 3] - centreX) * scale
        positions[(vertexOffset + i) * 3 + 1] = (part.positions[i * 3 + 1] - restY) * scale
        positions[(vertexOffset + i) * 3 + 2] = (part.positions[i * 3 + 2] - centreZ) * scale
        if (part.normals) normals.set(part.normals.subarray(i * 3, i * 3 + 3), (vertexOffset + i) * 3)
        else normals[(vertexOffset + i) * 3 + 1] = 1
        if (part.uvs) uvs.set(part.uvs.subarray(i * 2, i * 2 + 2), (vertexOffset + i) * 2)
        if (colors) {
          if (part.colors) colors.set(part.colors.data.subarray(i * colourWidth, i * colourWidth + colourWidth), (vertexOffset + i) * colourWidth)
          else colors.fill(1, (vertexOffset + i) * colourWidth, (vertexOffset + i + 1) * colourWidth)
        }
      }
      for (let i = 0; i < part.indices.length; i += 1) indices[indexOffset + i] = part.indices[i] + vertexOffset
      vertexOffset += count
      indexOffset += part.indices.length
    }
    merged.push({ material, positions, normals, uvs, colors, colourWidth, indices })
  }

  /**
   * Simplify every surface towards `ratio` of its triangles.
   *
   * meshopt stops early when the error limit binds, and these props are full of
   * open surfaces — leaf cards, grass planes — where it binds quickly. So the
   * error is relaxed until the target is met. Borders are left free to move:
   * locking them makes an alpha-cutout card unsimplifiable.
   */
  const simplifyAll = (ratio) =>
    merged.map((surface) => {
      let indices = surface.indices
      const target = Math.max(3, Math.floor((indices.length * ratio) / 3) * 3)
      if (target < indices.length) {
        for (const error of [0.05, 0.2, 0.6, 1]) {
          const [simplified] = MeshoptSimplifier.simplify(indices, surface.positions, 3, target, error)
          indices = simplified
          if (indices.length <= target) break
        }
      }
      return { surface, indices }
    })

  // A single ratio undershoots when small surfaces refuse to collapse, so the
  // whole prop is re-simplified against whatever the last attempt achieved.
  let ratio = Math.min(1, budget / sourceTriangles)
  let simplified = simplifyAll(ratio)
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const total = simplified.reduce((sum, entry) => sum + entry.indices.length / 3, 0)
    if (total <= budget) break
    ratio *= (budget / total) * 0.98
    simplified = simplifyAll(ratio)
  }

  const primitives = []
  let triangles = 0
  for (const { surface, indices } of simplified) {
    const [remap, compactCount] = MeshoptSimplifier.compactMesh(indices)
    const compact = (data, width) => {
      const output = new Float32Array(compactCount * width)
      for (let old = 0; old < remap.length; old += 1) {
        const next = remap[old]
        if (next === 0xffffffff) continue
        for (let component = 0; component < width; component += 1) output[next * width + component] = data[old * width + component]
      }
      return output
    }
    const finalPositions = compact(surface.positions, 3)
    const min = [Infinity, Infinity, Infinity]
    const max = [-Infinity, -Infinity, -Infinity]
    for (let i = 0; i < finalPositions.length; i += 3) {
      for (let axis = 0; axis < 3; axis += 1) {
        min[axis] = Math.min(min[axis], finalPositions[i + axis])
        max[axis] = Math.max(max[axis], finalPositions[i + axis])
      }
    }
    const attributes = {
      POSITION: addAccessor(finalPositions, 'VEC3', 5126, 34962, { min, max }),
      NORMAL: addAccessor(compact(surface.normals, 3), 'VEC3', 5126, 34962),
      TEXCOORD_0: addAccessor(compact(surface.uvs, 2), 'VEC2', 5126, 34962),
      ...(surface.colors
        ? { COLOR_0: addAccessor(compact(surface.colors, surface.colourWidth), surface.colourWidth === 4 ? 'VEC4' : 'VEC3', 5126, 34962) }
        : {}),
    }
    const IndexType = compactCount <= 65535 ? Uint16Array : Uint32Array
    const indexData = IndexType.from(indices)
    const indexView = addView(indexData, 34963)
    out.accessors.push({ bufferView: indexView, componentType: compactCount <= 65535 ? 5123 : 5125, count: indexData.length, type: 'SCALAR' })
    primitives.push({
      attributes,
      indices: out.accessors.length - 1,
      ...(surface.material >= 0 ? { material: copyMaterial(source, source.file, surface.material, entry.textureSize ?? 512) } : {}),
    })
    triangles += indexData.length / 3
  }

  out.meshes.push({ name: entry.id, primitives })
  out.nodes.push({ name: entry.id, mesh: out.meshes.length - 1 })
  out.scenes[0].nodes.push(out.nodes.length - 1)

  report.push({
    id: entry.id,
    sourceFile: entry.source.file,
    nodes: chosen.length,
    sourceTriangles,
    triangles,
    height: Number((measured * scale).toFixed(4)),
    footprint: [
      Number(((bounds.max[0] - bounds.min[0]) * scale).toFixed(4)),
      Number(((bounds.max[2] - bounds.min[2]) * scale).toFixed(4)),
    ],
    scale: Number(scale.toFixed(6)),
  })
}

out.asset.extras = { wyvern3dBiomeAtlas: report }
if (usesWebp) {
  out.extensionsUsed = ['EXT_texture_webp']
  out.extensionsRequired = ['EXT_texture_webp']
}
for (const key of ['materials', 'textures', 'images', 'samplers']) if (!out[key].length) delete out[key]

const packed = Buffer.concat(chunks)
out.buffers = [{ byteLength: packed.length }]

const directory = draft ? path.join(REPO, '.biome-atlas') : path.join(REPO, 'public/models')
fs.mkdirSync(directory, { recursive: true })
const destination = path.join(directory, `${MANIFEST.out}.glb`)
writeGlb(destination, out, packed)

console.log(JSON.stringify(report, null, 1))
console.log(
  `${draft ? 'draft ' : ''}${path.relative(REPO, destination)}: ${report.length} props, ${report.reduce((total, entry) => total + entry.triangles, 0)} triangles, ${(fs.statSync(destination).size / 1e6).toFixed(2)} MB`,
)
