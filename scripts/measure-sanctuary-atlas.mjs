#!/usr/bin/env node
/**
 * Measures all nodes in public/models/sanctuary.glb and outputs a detailed
 * machine-readable baseline to validation/sanctuary-environment/sanctuary-atlas-baseline.json.
 */
import console from 'node:console'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { URL } from 'node:url'

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const GLB_PATH = path.join(REPO, 'public/models/sanctuary.glb')
const OUT_PATH = path.join(REPO, 'validation/sanctuary-environment/sanctuary-atlas-baseline.json')

if (!fs.existsSync(GLB_PATH)) {
  console.error(`Missing GLB at ${GLB_PATH}`)
  process.exit(1)
}

const data = fs.readFileSync(GLB_PATH)
const jsonLength = data.readUInt32LE(12)
const doc = JSON.parse(data.subarray(20, 20 + jsonLength).toString('utf8'))

const totalBytes = data.length
const props = []
let totalTriangles = 0
let totalVertices = 0

for (let i = 0; i < (doc.nodes ?? []).length; i++) {
  const node = doc.nodes[i]
  if (node.mesh === undefined) continue

  const mesh = doc.meshes[node.mesh]
  const primitives = mesh.primitives ?? []
  
  let nodeTriangles = 0
  let nodeVertices = 0
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  let byteSize = 0

  for (const prim of primitives) {
    const posAcc = doc.accessors[prim.attributes.POSITION]
    if (posAcc) {
      nodeVertices += posAcc.count
      if (posAcc.min && posAcc.max) {
        for (let a = 0; a < 3; a++) {
          min[a] = Math.min(min[a], posAcc.min[a])
          max[a] = Math.max(max[a], posAcc.max[a])
        }
      }
      const bv = doc.bufferViews[posAcc.bufferView]
      if (bv) byteSize += bv.byteLength
    }

    if (prim.attributes.NORMAL !== undefined) {
      const normAcc = doc.accessors[prim.attributes.NORMAL]
      const bv = doc.bufferViews[normAcc.bufferView]
      if (bv) byteSize += bv.byteLength
    }

    if (prim.attributes.TEXCOORD_0 !== undefined) {
      const uvAcc = doc.accessors[prim.attributes.TEXCOORD_0]
      const bv = doc.bufferViews[uvAcc.bufferView]
      if (bv) byteSize += bv.byteLength
    }

    if (prim.indices !== undefined) {
      const idxAcc = doc.accessors[prim.indices]
      nodeTriangles += Math.floor(idxAcc.count / 3)
      const bv = doc.bufferViews[idxAcc.bufferView]
      if (bv) byteSize += bv.byteLength
    } else if (prim.mode === 5) {
      // TRIANGLE_STRIP
      nodeTriangles += Math.max(0, posAcc.count - 2)
    }
  }

  totalTriangles += nodeTriangles
  totalVertices += nodeVertices

  const width = Number((max[0] - min[0]).toFixed(3))
  const height = Number((max[1] - min[1]).toFixed(3))
  const depth = Number((max[2] - min[2]).toFixed(3))
  const restY = Number(min[1].toFixed(3))
  const centerX = Number(((min[0] + max[0]) / 2).toFixed(3))
  const centerZ = Number(((min[2] + max[2]) / 2).toFixed(3))

  props.push({
    id: node.name,
    nodeIndex: i,
    meshIndex: node.mesh,
    primitiveCount: primitives.length,
    mode: primitives[0]?.mode ?? 4,
    vertices: nodeVertices,
    triangles: nodeTriangles,
    byteSize,
    bounds: {
      min: min.map((v) => Number(v.toFixed(3))),
      max: max.map((v) => Number(v.toFixed(3))),
      dimensions: { width, height, depth },
      restY,
      center: [centerX, centerZ],
    },
    transform: {
      translation: node.translation ?? [0, 0, 0],
      rotation: node.rotation ?? [0, 0, 0, 1],
      scale: node.scale ?? [1, 1, 1],
    },
  })
}

props.sort((a, b) => a.id.localeCompare(b.id))

const baseline = {
  version: 1,
  capturedAt: '2026-08-14T13:50:00Z',
  target: 'public/models/sanctuary.glb',
  summary: {
    totalBytes,
    totalMb: Number((totalBytes / (1024 * 1024)).toFixed(2)),
    propCount: props.length,
    totalTriangles,
    totalVertices,
    materialCount: doc.materials?.length ?? 0,
    imageCount: doc.images?.length ?? 0,
    textureCount: doc.textures?.length ?? 0,
  },
  props,
}

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
fs.writeFileSync(OUT_PATH, JSON.stringify(baseline, null, 2))
console.log(`Measured ${props.length} props -> ${path.relative(REPO, OUT_PATH)}`)
console.log(`Summary: ${(totalBytes / 1e6).toFixed(2)} MB, ${totalTriangles} triangles, ${totalVertices} vertices`)
