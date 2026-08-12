import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ASSETS, type AssetId } from './manifest'

const IMPORTS: [AssetId, string, number][] = [
  ['library.alchemistWorkstation', 'arcane-alchemist-workstation.glb', 6_052],
  ['library.forestWyvernDisplay', 'forest-wyvern-display.glb', 38_400],
  ['library.arcaneAcademyCrest', 'arcane-academy-crest.glb', 11_667],
  ['library.throneOfBooks', 'throne-of-books.glb', 20_523],
]

describe('imported Meshy model library', () => {
  it.each(IMPORTS)('%s is an optimized static GLB', (id, filename, triangles) => {
    expect(ASSETS[id]?.url).toBe(`/models/library/${filename}`)
    const data = readFileSync(new URL(`../../../public/models/library/${filename}`, import.meta.url))
    expect(data.length).toBeLessThan(15 * 1024 * 1024)
    const jsonLength = data.readUInt32LE(12)
    const gltf = JSON.parse(data.subarray(20, 20 + jsonLength).toString('utf8'))
    expect(gltf.skins).toBeUndefined()
    expect(gltf.animations).toBeUndefined()
    expect(gltf.asset.extras.wyvern3dImport.triangles).toBe(triangles)
  })
})
