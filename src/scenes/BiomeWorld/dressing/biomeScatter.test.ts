import { describe, expect, it } from 'vitest'
import type { BiomeLayer } from '@/render/assets/biomeLibrary'
import { scatterBiome, scatterLayer } from './biomeScatter'

const layer: BiomeLayer = { prop: 'prop.biome.tree.canopy', count: 12, radius: [20, 80], scale: [0.8, 1.4] }
const flat = { heightAt: () => 0 }

describe('scatterLayer', () => {
  it('is deterministic', () => {
    expect(scatterLayer(layer, flat)).toEqual(scatterLayer(layer, flat))
  })

  it('places every prop inside its radius band', () => {
    for (const placement of scatterLayer(layer, flat)) {
      const radius = Math.hypot(placement.position[0], placement.position[2])
      expect(radius).toBeGreaterThanOrEqual(20 - 1e-6)
      expect(radius).toBeLessThanOrEqual(80 + 1e-6)
    }
  })

  it('keeps every prop outside the clearing', () => {
    for (const placement of scatterLayer(layer, { ...flat, clearing: 40 })) {
      expect(Math.hypot(placement.position[0], placement.position[2])).toBeGreaterThanOrEqual(40 - 1e-6)
    }
  })

  it('samples ground height at the placement', () => {
    const placements = scatterLayer(layer, { heightAt: (x, z) => x + z })
    for (const placement of placements) {
      expect(placement.position[1]).toBeCloseTo(placement.position[0] + placement.position[2], 6)
    }
  })

  it('stays within the scale range', () => {
    for (const placement of scatterLayer(layer, flat)) {
      expect(placement.scale).toBeGreaterThanOrEqual(0.8)
      expect(placement.scale).toBeLessThanOrEqual(1.4)
    }
  })

  it('honours the count', () => {
    expect(scatterLayer(layer, flat)).toHaveLength(12)
    expect(scatterLayer({ ...layer, count: 0 }, flat)).toHaveLength(0)
    expect(scatterLayer(layer, { ...flat, density: 0.5 })).toHaveLength(6)
  })
})

describe('scatterBiome', () => {
  it('offsets each layer so equal-count layers do not stack', () => {
    const [first = [], second = []] = scatterBiome([layer, { ...layer }], flat)
    expect(first[0]?.position).not.toEqual(second[0]?.position)
  })
})
