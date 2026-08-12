/* global Buffer, console, process */
/** Build the original low-poly food atlas without external source assets. */
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  CylinderGeometry,
  Euler,
  IcosahedronGeometry,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Scene,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

// GLTFExporter targets browsers; this is the FileReader surface it needs to
// assemble a binary GLB under Node.
globalThis.FileReader = class FileReader {
  async readAsArrayBuffer(blob) {
    this.result = await blob.arrayBuffer()
    this.onloadend?.()
  }
  async readAsDataURL(blob) {
    this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`
    this.onloadend?.()
  }
}

const meat = new MeshStandardMaterial({ name: 'meat', color: 0x6e1c18, roughness: 0.9 })
const cut = new MeshStandardMaterial({ name: 'meat-cut', color: 0x9d4036, roughness: 0.9 })
const bone = new MeshStandardMaterial({ name: 'bone', color: 0xb29a6b, roughness: 0.96 })
const hide = new MeshStandardMaterial({ name: 'hide', color: 0x40251a, roughness: 1 })

function transformed(geometry, position, scale, rotation = [0, 0, 0]) {
  const matrix = new Matrix4().compose(
    new Vector3(...position),
    new Quaternion().setFromEuler(new Euler(...rotation)),
    new Vector3(...scale),
  )
  return geometry.applyMatrix4(matrix)
}

function prop(name, parts, materials) {
  const geometry = mergeGeometries(parts.map((part) => part.index ? part.toNonIndexed() : part), true)
  geometry.computeVertexNormals()
  const mesh = new Mesh(geometry, materials)
  mesh.name = name
  mesh.userData.name = name
  return mesh
}

const meatProp = prop('prop.food.meat', [
  transformed(new IcosahedronGeometry(1, 1), [0, 0.24, 0], [0.49, 0.21, 0.31]),
  transformed(new IcosahedronGeometry(1, 1), [-0.34, 0.25, 0], [0.15, 0.18, 0.28]),
  transformed(new CylinderGeometry(1, 1, 1, 8), [0.36, 0.28, 0], [0.07, 0.30, 0.07], [0, 0, Math.PI / 2]),
  transformed(new IcosahedronGeometry(1, 1), [0.51, 0.28, 0], [0.09, 0.09, 0.09]),
], [meat, cut, bone, bone])

const carcassProp = prop('prop.food.carcass', [
  transformed(new IcosahedronGeometry(1, 1), [0, 0.40, 0], [0.76, 0.34, 0.43]),
  transformed(new IcosahedronGeometry(1, 1), [-0.66, 0.38, 0], [0.43, 0.35, 0.40]),
  transformed(new IcosahedronGeometry(1, 1), [0.66, 0.38, 0], [0.40, 0.25, 0.27]),
  transformed(new CylinderGeometry(1, 1, 1, 7), [0.05, 0.60, 0], [0.055, 0.72, 0.055], [Math.PI / 2, 0, 0]),
  transformed(new CylinderGeometry(1, 1, 1, 7), [-0.48, 0.18, 0.25], [0.07, 0.78, 0.07], [0, 0, Math.PI / 2 + 0.22]),
  transformed(new CylinderGeometry(1, 1, 1, 7), [0.42, 0.16, -0.24], [0.065, 0.72, 0.065], [0, 0, Math.PI / 2 - 0.25]),
  transformed(new IcosahedronGeometry(1, 1), [0.97, 0.36, 0], [0.13, 0.22, 0.25]),
], [hide, meat, meat, bone, bone, bone, cut])

const scene = new Scene()
scene.add(meatProp, carcassProp)
const glb = await new GLTFExporter().parseAsync(scene, {
  binary: true,
  onlyVisible: true,
  trs: false,
  includeCustomExtensions: false,
})
const here = path.dirname(fileURLToPath(import.meta.url))
const output = path.join(here, '..', 'public', 'models', 'wyvern-food.glb')
await writeFile(output, Buffer.from(glb))
console.log(`wrote ${path.relative(process.cwd(), output)} (${glb.byteLength} bytes)`)
