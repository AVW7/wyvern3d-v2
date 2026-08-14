import { describe, expect, it } from 'vitest'
import { REGIONS, REGION_LIST } from '@/core/data/regions'
import { getBiomePalette } from '../atmosphere/biomePalettes'

describe('Biome Enhancement Stage 5: Scene Transitions & Metadata', () => {
  it('ensures every authored region has valid transition palette and summary', () => {
    for (const region of REGION_LIST) {
      expect(region.biome).toBeDefined()
      const palette = getBiomePalette(region.biome)
      expect(palette).toBeDefined()
      expect(palette.background).toMatch(/^#/)
      expect(palette.accentColor).toMatch(/^#/)

      const def = REGIONS[region.id]
      expect(def).toBeDefined()
      expect(def!.name.length).toBeGreaterThan(0)
    }
  })
})
