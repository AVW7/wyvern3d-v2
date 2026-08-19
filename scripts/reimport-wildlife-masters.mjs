#!/usr/bin/env node
// Re-import the two live wildlife models from their high-resolution masters.
//
// Both shipped files were cut from the 1024px downscales while the masters sat
// on disk (doe 4096px, guineafowl 2048px — see docs/EXTERNAL_MODEL_INDEX.md
// §"Already wired — and both on the wrong variant"). Geometry, skins and clip
// names are identical between variants, so the manifest fit numbers and clip
// maps do not change; only the textures improve.
//
// Processing replicates the established chain:
//   - spec/gloss → metalrough conversion (build-biome-atlas.mjs recipe) for the
//     doe master, which still carries KHR_materials_pbrSpecularGlossiness;
//   - texture re-encode to WebP at a per-model cap (cwebp, sips resize fallback);
//   - geometry, skins, animations and node hierarchy copied through untouched.
//
// Idempotent: safe to re-run; Desktop sources are never written.
import { Buffer } from 'node:buffer'
import console from 'node:console'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const SOURCES = [
  {
    source: '/Users/ajadvanwyk/Desktop/3d models animals/doe__realistic_animated_3d_model (1).glb',
    output: 'public/models/wildlife/doe.glb',
    // 4096px master → 2048px: real detail gain over the shipped 1024px without
    // shipping a 26 MB texture for an ambient animal.
    textureMax: 2048,
  },
  {
    source: '/Users/ajadvanwyk/Desktop/3d models animals/guineafowl-realistic-3d-model-temprit.glb',
    output: 'public/models/wildlife/guineafowl.glb',
    // 2048px master kept native; the shipped file had been halved to 1024px.
    textureMax: 2048,
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

/**
 * build-biome-atlas.mjs's conversion, applied in place: every material
 * extension is dropped (their texture indices point into the source document;
 * unlit props would ignore scene lighting besides), and spec/gloss becomes a
 * metallic/roughness block. Returns how many materials were converted.
 */
function convertMaterials(json) {
  let converted = 0
  for (const material of json.materials ?? []) {
    const specGloss = material.extensions?.KHR_materials_pbrSpecularGlossiness
    const updated = { ...material }
    delete updated.extensions
    if (specGloss) {
      updated.pbrMetallicRoughness = {
        baseColorFactor: specGloss.diffuseFactor ?? [1, 1, 1, 1],
        ...(specGloss.diffuseTexture ? { baseColorTexture: specGloss.diffuseTexture } : {}),
        metallicFactor: 0,
        roughnessFactor: 1 - (specGloss.glossinessFactor ?? 1),
      }
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

/**
 * build-biome-atlas.mjs's re-encode, same strategy: probe real dimensions with
 * sips (cwebp -resize bounds one axis only, and these packs ship non-square
 * atlases), scale explicitly, prefer cwebp at q80, fall back to sips resize.
 */
function encodeImage(bytes, mimeType, maxSize) {
  if (!['image/jpeg', 'image/png'].includes(mimeType)) return { bytes, mimeType }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wyvern3d-wildlife-'))
  const file = path.join(directory, `texture${mimeType === 'image/png' ? '.png' : '.jpg'}`)
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

/**
 * Re-encode every embedded image, then compact the binary chunk so only bytes
 * still referenced by an accessor or an image survive. Without compaction the
 * superseded master texture stays orphaned inside BIN and the file is larger
 * than its source. Existing bufferView *indices* stay stable; only offsets are
 * remapped.
 */
function reencodeImages(json, binary, maxSize) {
  if (!json.images?.length) return { binary, count: 0 }
  const views = json.bufferViews ?? []
  // Pass 1 — re-encode each image into a pending replacement view.
  const replacements = new Map()
  for (const image of json.images) {
    const old = views[image.bufferView]
    const sourceBytes = binary.subarray(old.byteOffset ?? 0, (old.byteOffset ?? 0) + old.byteLength)
    const { bytes, mimeType } = encodeImage(sourceBytes, image.mimeType ?? 'image/png', maxSize)
    replacements.set(image.bufferView, { bytes, mimeType })
    if (mimeType !== image.mimeType) image.mimeType = mimeType
  }
  // Pass 2 — copy every referenced view's bytes into a fresh buffer.
  const referenced = new Set()
  for (const accessor of json.accessors ?? []) referenced.add(accessor.bufferView)
  for (const image of json.images) referenced.add(image.bufferView)
  const chunks = []
  let cursor = 0
  let count = 0
  for (let i = 0; i < views.length; i++) {
    const view = views[i]
    if (!referenced.has(i)) {
      view.byteOffset = 0
      view.byteLength = 0
      continue
    }
    const replacement = replacements.get(i)
    const bytes = replacement ? replacement.bytes : binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)
    const pad = (4 - (bytes.length % 4)) % 4
    const padded = pad ? Buffer.concat([bytes, Buffer.alloc(pad)]) : bytes
    view.byteOffset = cursor
    if (replacement) {
      view.byteLength = bytes.length
      count += 1
    }
    chunks.push(padded)
    cursor += padded.length
  }
  json.bufferViews = views
  return { binary: Buffer.concat(chunks), count }
}

const report = []
for (const item of SOURCES) {
  const { json, binary } = readGlb(item.source)
  const converted = convertMaterials(json)
  const { binary: packed, count } = reencodeImages(json, binary, item.textureMax)
  // Buffer byteLength must track the appended image bytes.
  json.buffers = [{ byteLength: packed.length }]
  writeGlb(item.output, json, packed)
  const mb = (n) => `${(n / 1e6).toFixed(1)} MB`
  report.push(`${item.output}: ${converted} spec/gloss material(s) converted, ${count} texture(s) re-encoded (max ${item.textureMax}px), ${mb(fs.statSync(item.source).size)} → ${mb(fs.statSync(item.output).size)}`)
}
console.log(report.join('\n'))
