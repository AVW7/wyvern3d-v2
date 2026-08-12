#!/usr/bin/env node
import { Buffer } from 'node:buffer'
import console from 'node:console'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { Box3, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const ROOT = process.cwd()
const MODEL = path.join(ROOT, 'public/models/arcane-handler.glb')
const ANIMATIONS = path.join(ROOT, 'public/models/arcane-handler-animations')
const CLIPS = ['idle', 'walk', 'run', 'offer', 'pet', 'calm', 'inspect']
const MAX_BYTES = 15 * 1024 * 1024

function readGlb(file) {
  const data = fs.readFileSync(file)
  if (data.toString('ascii', 0, 4) !== 'glTF' || data.readUInt32LE(4) !== 2) {
    throw new Error(`${path.basename(file)} is not a GLB 2.0 file`)
  }
  let json
  let bin
  for (let offset = 12; offset < data.length;) {
    const size = data.readUInt32LE(offset)
    const type = data.readUInt32LE(offset + 4)
    const body = data.subarray(offset + 8, offset + 8 + size)
    if (type === 0x4e4f534a) json = JSON.parse(body.toString('utf8'))
    if (type === 0x004e4942) bin = body
    offset += 8 + size
  }
  if (!json) throw new Error(`${path.basename(file)} has no JSON chunk`)
  return { data, json, bin }
}

function stripTextures(glb) {
  const json = JSON.parse(JSON.stringify(glb.json))
  delete json.images
  delete json.textures
  delete json.samplers
  delete json.materials
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) delete primitive.material
  }
  const jsonBytes = Buffer.from(JSON.stringify(json))
  const jsonPad = (4 - jsonBytes.length % 4) % 4
  const bin = glb.bin
  const binPad = bin ? (4 - bin.length % 4) % 4 : 0
  const total = 12 + 8 + jsonBytes.length + jsonPad + (bin ? 8 + bin.length + binPad : 0)
  const output = Buffer.alloc(total)
  output.write('glTF', 0)
  output.writeUInt32LE(2, 4)
  output.writeUInt32LE(total, 8)
  let offset = 12
  output.writeUInt32LE(jsonBytes.length + jsonPad, offset)
  output.writeUInt32LE(0x4e4f534a, offset + 4)
  jsonBytes.copy(output, offset + 8)
  output.fill(0x20, offset + 8 + jsonBytes.length, offset + 8 + jsonBytes.length + jsonPad)
  offset += 8 + jsonBytes.length + jsonPad
  if (bin) {
    output.writeUInt32LE(bin.length + binPad, offset)
    output.writeUInt32LE(0x004e4942, offset + 4)
    bin.copy(output, offset + 8)
  }
  return output
}

async function loadScene(glb) {
  const data = stripTextures(glb)
  return new Promise((resolve, reject) => new GLTFLoader().parse(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    '', resolve, reject,
  ))
}

const base = readGlb(MODEL)
if (base.data.length > MAX_BYTES) throw new Error(`player GLB exceeds 15 MB: ${base.data.length}`)
if (!(base.json.skins?.length > 0)) throw new Error('player GLB has no skin')
if (!(base.json.materials?.length > 0)) throw new Error('player GLB has no embedded materials')

let triangles = 0
for (const mesh of base.json.meshes ?? []) {
  for (const primitive of mesh.primitives ?? []) {
    if (primitive.attributes?.JOINTS_1 !== undefined || primitive.attributes?.WEIGHTS_1 !== undefined) {
      throw new Error('player mesh exceeds four bone influences per vertex')
    }
    const accessor = primitive.indices ?? primitive.attributes?.POSITION
    triangles += Math.floor((base.json.accessors?.[accessor]?.count ?? 0) / 3)
  }
}
if (triangles < 28_000 || triangles > 30_000) {
  throw new Error(`player triangle count ${triangles} is outside the 28k-30k LOD budget`)
}
const lod = base.json.asset?.extras?.wyvern3dLod
if (lod?.sourceTriangles !== 55_928 || lod?.targetTriangles !== triangles) {
  throw new Error('player GLB is missing current LOD provenance; run pnpm assets:player-lod')
}

const loaded = await loadScene(base)
const bounds = new Box3().setFromObject(loaded.scene)
const size = bounds.getSize(new Vector3())
if (Math.abs(size.y - 1.82) > 0.04) throw new Error(`player height ${size.y.toFixed(3)} m is not 1.82 m`)
if (Math.abs(bounds.min.y) > 0.025) throw new Error(`player is not grounded: min Y ${bounds.min.y.toFixed(3)} m`)

const baseNames = new Set(base.json.nodes?.map((node) => node.name).filter(Boolean))
for (const clipName of CLIPS) {
  const file = path.join(ANIMATIONS, `${clipName}.glb`)
  const sidecar = readGlb(file)
  if (sidecar.json.meshes || sidecar.json.skins || sidecar.json.materials || sidecar.json.images) {
    throw new Error(`${clipName} sidecar contains render assets`)
  }
  if (sidecar.json.animations?.length !== 1 || sidecar.json.animations[0].name !== clipName) {
    throw new Error(`${clipName} sidecar has the wrong animation name`)
  }
  for (const channel of sidecar.json.animations[0].channels ?? []) {
    const target = sidecar.json.nodes[channel.target.node]?.name
    if (!target || !baseNames.has(target)) throw new Error(`${clipName} targets unknown node ${target}`)
  }
}

console.log(JSON.stringify({
  model: path.relative(ROOT, MODEL),
  bytes: base.data.length,
  triangles,
  dimensionsMetres: size.toArray().map((value) => Number(value.toFixed(3))),
  groundY: Number(bounds.min.y.toFixed(4)),
  clips: CLIPS,
}, null, 2))
