import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { REGION_LIST } from '@/core/data/regions'

const contract = JSON.parse(readFileSync(new URL('./studio-biomes.v1.json', import.meta.url), 'utf8')) as {
  schemaVersion: number
  studioBiomes: Array<{ id: string }>
  links: Array<{ wyvernId: string; primaryStudioId: string; alternateStudioIds: string[] }>
  unlinkedStudioBiomes: string[]
}

describe('reviewed studio biome contract', () => {
  it('maps every Wyvern terrain class exactly once', () => {
    const terrainClasses = [...new Set(REGION_LIST.map((region) => region.biome))].sort()
    const mapped = contract.links.map((link) => link.wyvernId).sort()
    expect(mapped).toEqual(terrainClasses)
    expect(new Set(mapped).size).toBe(mapped.length)
  })

  it('classifies every authored studio biome as linked or explicitly unlinked', () => {
    const classified = new Set(contract.unlinkedStudioBiomes)
    for (const link of contract.links) {
      classified.add(link.primaryStudioId)
      for (const alternate of link.alternateStudioIds) classified.add(alternate)
    }
    expect(contract.schemaVersion).toBe(1)
    expect(contract.studioBiomes).toHaveLength(24)
    expect(contract.studioBiomes.map((biome) => biome.id).sort()).toEqual([...classified].sort())
  })
})
