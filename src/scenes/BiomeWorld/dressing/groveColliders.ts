import { Vector3, type Mesh, type Object3D } from 'three'
import type { Collider } from '@/render/controllers/CharacterController'

export interface FootprintOptions {
  /** World Y of the ground the model stands on. */
  groundY: number
  /** How far above the ground still counts as blocking. */
  maxHeight: number
  /** How far below the ground still counts. Deeper geometry is buried. */
  maxDepth: number
  /** Grid resolution in metres. */
  cell: number
}

/**
 * Blocking footprint of a loaded model, measured from its geometry.
 *
 * Only vertices within `maxHeight` of the ground become colliders, which is the
 * whole point for the world tree: the trunk flare and the feet of its root
 * arches block, while the arches themselves span overhead and stay walkable.
 * A single hand-tuned box around the trunk could not express that, and the one
 * that shipped first let the player walk straight through the buttresses.
 * Geometry deeper than `maxDepth` is buried and does not block either — the
 * tree's root tips run 11 m out underground.
 */
export function footprintColliders(root: Object3D, options: FootprintOptions): Collider[] {
  const { groundY, maxHeight, maxDepth, cell } = options
  const ceiling = groundY + maxHeight
  const floor = groundY - maxDepth
  const occupied = new Set<string>()
  const vertex = new Vector3()

  root.updateWorldMatrix(true, true)
  root.traverse((object) => {
    const mesh = object as Mesh
    const position = mesh.isMesh ? mesh.geometry?.getAttribute('position') : undefined
    if (!position) return

    for (let i = 0; i < position.count; i += 1) {
      vertex.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld)
      if (vertex.y > ceiling || vertex.y < floor) continue
      occupied.add(`${Math.floor(vertex.x / cell)}:${Math.floor(vertex.z / cell)}`)
    }
  })

  const half = cell / 2
  return [...occupied].map((key) => {
    const [column, row] = key.split(':').map(Number) as [number, number]
    return {
      x: column * cell + half,
      z: row * cell + half,
      halfW: half,
      halfD: half,
    }
  })
}
