import { readFile } from 'node:fs/promises'
import { Box3, Vector3, type Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { describe, expect, it } from 'vitest'

async function loadFoodAtlas(): Promise<Object3D> {
  const bytes = await readFile('public/models/wyvern-food.glb')
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  const gltf = await new GLTFLoader().parseAsync(data, '')
  return gltf.scene
}

function named(scene: Object3D, id: string): Object3D {
  let result: Object3D | null = null
  scene.traverse((object) => {
    if (object.userData.name === id) result = object
  })
  if (!result) throw new Error(`Missing food model: ${id}`)
  return result
}

describe('food model atlas', () => {
  it('contains grounded, metre-scale meat and carcass models', async () => {
    const scene = await loadFoodAtlas()
    const cases = [
      ['prop.food.meat', [1.09, 0.42, 0.62]],
      ['prop.food.carcass', [2.19, 0.73, 0.86]],
    ] as const

    for (const [id, expected] of cases) {
      const bounds = new Box3().setFromObject(named(scene, id))
      const size = bounds.getSize(new Vector3())
      size.toArray().forEach((value, index) => expect(value).toBeCloseTo(expected[index]!, 2))
      expect(bounds.min.y).toBeGreaterThanOrEqual(-0.001)
      expect(bounds.min.y).toBeLessThan(0.08)
    }
  })
})
