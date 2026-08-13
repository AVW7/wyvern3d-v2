import { describe, expect, it } from 'vitest'
import { BoxGeometry, Group, Mesh } from 'three'
import { footprintColliders } from './groveColliders'

function meshAt(size: [number, number, number], position: [number, number, number]): Mesh {
  const mesh = new Mesh(new BoxGeometry(...size))
  mesh.position.set(...position)
  return mesh
}

describe('footprintColliders', () => {
  it('covers geometry that reaches the ground', () => {
    const root = new Group()
    // A 4 m trunk standing on the ground at the origin.
    root.add(meshAt([4, 8, 4], [0, 4, 0]))

    const colliders = footprintColliders(root, { groundY: 0, maxHeight: 1.2, maxDepth: 0.4, cell: 2 })

    expect(colliders.length).toBeGreaterThan(0)
    for (const box of colliders) {
      expect(Math.abs(box.x)).toBeLessThanOrEqual(3)
      expect(Math.abs(box.z)).toBeLessThanOrEqual(3)
    }
  })

  it('ignores geometry that only spans overhead, so arches stay walkable', () => {
    const root = new Group()
    root.add(meshAt([20, 1, 2], [0, 9, 0]))

    expect(footprintColliders(root, { groundY: 0, maxHeight: 1.2, maxDepth: 0.4, cell: 2 })).toEqual([])
  })

  it('ignores geometry buried below the ground', () => {
    const root = new Group()
    root.add(meshAt([4, 2, 4], [0, -3, 0]))

    expect(footprintColliders(root, { groundY: 0, maxHeight: 1.2, maxDepth: 0.4, cell: 2 })).toEqual([])
  })

  it('measures relative to the ground level it is given', () => {
    const root = new Group()
    root.position.y = 5
    root.add(meshAt([4, 8, 4], [0, 4, 0]))

    expect(footprintColliders(root, { groundY: 5, maxHeight: 1.2, maxDepth: 0.4, cell: 2 }).length).toBeGreaterThan(0)
    expect(footprintColliders(root, { groundY: 0, maxHeight: 1.2, maxDepth: 0.4, cell: 2 })).toEqual([])
  })
})
