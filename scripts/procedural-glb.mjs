/* global Buffer, console, process */
/**
 * Shared machinery for atlases built from code rather than sourced.
 *
 * A generated prop carries no redistribution question, which is why the food,
 * bone and water atlases are built this way instead of curated into
 * scripts/biome-library.json. This module holds the parts every such builder
 * needs: the Node shim GLTFExporter wants, geometry composition, the grounding
 * check, and a preview rasterizer — because a triangle count cannot tell you
 * whether a ribcage reads as a ribcage.
 */
import { writeFile } from 'node:fs/promises'
import { Euler, Matrix4, Mesh, Quaternion, Scene, Vector3 } from 'three'
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

/** Bake a transform into a geometry, so instancing needs only one matrix. */
export function transformed(geometry, position, scale, rotation = [0, 0, 0]) {
  const matrix = new Matrix4().compose(
    new Vector3(...position),
    new Quaternion().setFromEuler(new Euler(...rotation)),
    new Vector3(...scale),
  )
  return geometry.applyMatrix4(matrix)
}

/**
 * One prop: merged parts, grouped so each part keeps its own material.
 *
 * Pass `{ ground: true }` to seat the finished composition on y=0 instead of
 * computing each part's clearance by hand. Worth doing whenever parts are
 * rotated: a tilted cylinder or a rolled stone dips below its own centre by an
 * amount that is tedious to derive and easy to get wrong — which is how the
 * bone, water and ruin atlases each shipped a sinking prop on first build.
 *
 * It is opt-in only so the atlases built before it keep producing byte-identical
 * output.
 */
export function prop(name, parts, materials, { ground = false } = {}) {
  const geometry = mergeGeometries(parts.map((part) => (part.index ? part.toNonIndexed() : part)), true)
  if (ground) {
    geometry.computeBoundingBox()
    geometry.translate(0, -geometry.boundingBox.min.y, 0)
  }
  geometry.computeVertexNormals()
  const mesh = new Mesh(geometry, materials)
  mesh.name = name
  // GLTFLoader sanitizes Object3D.name, so the atlas is keyed on userData.name.
  mesh.userData.name = name
  return mesh
}

/**
 * Report each prop's size and refuse one that sinks.
 *
 * Every atlas prop rests on y=0 — props.tsx sways vertices by their height
 * above the prop's own base, and biomeScatter drops each instance onto the
 * terrain sample. A prop modelled below its origin buries itself.
 */
export function describe(meshes, { tolerance = 0.01 } = {}) {
  for (const mesh of meshes) {
    mesh.geometry.computeBoundingBox()
    const box = mesh.geometry.boundingBox
    const triangles = mesh.geometry.attributes.position.count / 3
    console.log(
      `${mesh.name.padEnd(22)} ${triangles.toFixed(0).padStart(4)} tris  ` +
      `h=${box.max.y.toFixed(2)}m  base y=${box.min.y.toFixed(3)}  ` +
      `footprint ${(box.max.x - box.min.x).toFixed(2)} x ${(box.max.z - box.min.z).toFixed(2)}`,
    )
    if (box.min.y < -tolerance) {
      throw new Error(`${mesh.name} sinks below y=0 by ${(-box.min.y).toFixed(3)}m`)
    }
  }
}

/**
 * Rasterize a three-quarter view of each prop into one PPM strip.
 *
 * Deliberately not a real renderer: no GL context, no dependencies, and it
 * answers the only question that matters here — does the prop read?
 *
 * It shades by each triangle's own material, which is not a nicety. A
 * normal-only version showed the water props as featureless dark blobs, because
 * a pool's bank, stones and surface all face the same way; only their colours
 * tell them apart, and judging a prop against a preview that hides its
 * materials is judging the wrong thing.
 */
export async function renderPreview(meshes, outputPath, { cell = 260, background = 26 } = {}) {
  const pixels = new Uint8Array(cell * meshes.length * cell * 3).fill(background)
  const light = new Vector3(-0.5, 0.78, 0.38).normalize()
  const width = cell * meshes.length

  meshes.forEach((mesh, index) => {
    mesh.geometry.computeBoundingBox()
    const box = mesh.geometry.boundingBox
    const span = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z) * 1.15
    const cx = (box.max.x + box.min.x) / 2
    const cy = (box.max.y + box.min.y) / 2
    const cz = (box.max.z + box.min.z) / 2
    const position = mesh.geometry.attributes.position
    const depth = new Float32Array(cell * cell).fill(Infinity)
    const shade = new Float32Array(cell * cell)
    const albedo = new Float32Array(cell * cell * 3)
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    // Vertex index -> the material that draws it, via the merge groups.
    const groups = mesh.geometry.groups.length
      ? mesh.geometry.groups
      : [{ start: 0, count: mesh.geometry.attributes.position.count, materialIndex: 0 }]
    const colorAt = (vertex) => {
      const group = groups.find((g) => vertex >= g.start && vertex < g.start + g.count) ?? groups[0]
      return materials[group.materialIndex ?? 0]?.color ?? materials[0].color
    }
    const yaw = 0.61
    const pitch = 0.38

    const project = (x, y, z) => {
      const dx = x - cx
      const dy = y - cy
      const dz = z - cz
      const rx = dx * Math.cos(yaw) - dz * Math.sin(yaw)
      const rz = dx * Math.sin(yaw) + dz * Math.cos(yaw)
      const ry = dy * Math.cos(pitch) - rz * Math.sin(pitch)
      const rd = dy * Math.sin(pitch) + rz * Math.cos(pitch)
      return [(rx / span + 0.5) * cell, (0.5 - ry / span) * cell, rd]
    }

    for (let t = 0; t < position.count; t += 3) {
      const p0 = [position.getX(t), position.getY(t), position.getZ(t)]
      const p1 = [position.getX(t + 1), position.getY(t + 1), position.getZ(t + 1)]
      const p2 = [position.getX(t + 2), position.getY(t + 2), position.getZ(t + 2)]
      const normal = new Vector3().crossVectors(
        new Vector3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]),
        new Vector3(p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]),
      ).normalize()
      const lambert = 0.25 + 0.75 * Math.max(0, normal.dot(light))
      const color = colorAt(t)
      const [ax, ay, az] = project(...p0)
      const [bx, by, bz] = project(...p1)
      const [gx, gy, gz] = project(...p2)
      const minX = Math.max(0, Math.floor(Math.min(ax, bx, gx)))
      const maxX = Math.min(cell - 1, Math.ceil(Math.max(ax, bx, gx)))
      const minY = Math.max(0, Math.floor(Math.min(ay, by, gy)))
      const maxY = Math.min(cell - 1, Math.ceil(Math.max(ay, by, gy)))
      const area = (bx - ax) * (gy - ay) - (gx - ax) * (by - ay)
      if (Math.abs(area) < 1e-9) continue
      for (let py = minY; py <= maxY; py++) {
        for (let px = minX; px <= maxX; px++) {
          const w0 = ((bx - ax) * (py + 0.5 - ay) - (px + 0.5 - ax) * (by - ay)) / area
          const w1 = ((px + 0.5 - ax) * (gy - ay) - (gx - ax) * (py + 0.5 - ay)) / area
          if (w0 < 0 || w1 < 0 || w0 + w1 > 1) continue
          const d = az + (bz - az) * w1 + (gz - az) * w0
          const at = py * cell + px
          if (d < depth[at]) {
            depth[at] = d
            shade[at] = lambert
            albedo[at * 3] = color.r
            albedo[at * 3 + 1] = color.g
            albedo[at * 3 + 2] = color.b
          }
        }
      }
    }

    for (let py = 0; py < cell; py++) {
      for (let px = 0; px < cell; px++) {
        const at = py * cell + px
        const v = shade[at]
        if (!v) continue
        const o = (py * width + index * cell + px) * 3
        // sRGB-ish gamma, so a dark material does not crush to the background.
        for (let c = 0; c < 3; c++) {
          pixels[o + c] = Math.min(255, Math.pow(albedo[at * 3 + c] * v, 1 / 2.2) * 255)
        }
      }
    }
  })

  await writeFile(outputPath, Buffer.concat([
    Buffer.from(`P6\n${width} ${cell}\n255\n`, 'ascii'),
    Buffer.from(pixels),
  ]))
  console.log(`preview -> ${outputPath}`)
}

/** Export the props as one binary GLB. */
export async function writeAtlas(meshes, outputPath) {
  const scene = new Scene()
  scene.add(...meshes)
  const glb = await new GLTFExporter().parseAsync(scene, {
    binary: true,
    onlyVisible: true,
    trs: false,
    includeCustomExtensions: false,
  })
  await writeFile(outputPath, Buffer.from(glb))
  console.log(`wrote ${outputPath} (${glb.byteLength} bytes)`)
  return glb.byteLength
}

/** `--preview <path>` from argv, or null. */
export function previewTarget(argv = process.argv) {
  const at = argv.indexOf('--preview')
  return at >= 0 ? argv[at + 1] ?? null : null
}
