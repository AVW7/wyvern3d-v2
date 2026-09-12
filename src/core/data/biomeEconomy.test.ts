import { describe, expect, it } from 'vitest'
import { REGION_LIST } from './regions'
import { BIOME_YIELD_ANOMALIES, BIOME_YIELD_PROFILES, WYVERN_TERRAIN_CLASSES } from './biomeEconomy'

describe('biome economy ownership', () => {
  it('defines one yield profile for every terrain class', () => {
    const regionClasses = [...new Set(REGION_LIST.map((region) => region.biome))].sort()
    expect(Object.keys(BIOME_YIELD_PROFILES).sort()).toEqual(regionClasses)
    expect([...WYVERN_TERRAIN_CLASSES].sort()).toEqual(regionClasses)
  })

  it('keeps reviewed authored anomalies in the game data layer', () => {
    expect(BIOME_YIELD_ANOMALIES).toHaveLength(2)
    for (const anomaly of BIOME_YIELD_ANOMALIES) {
      expect(REGION_LIST.some((region) => region.id === anomaly.region && region.biome === anomaly.biome)).toBe(true)
    }
  })
})
