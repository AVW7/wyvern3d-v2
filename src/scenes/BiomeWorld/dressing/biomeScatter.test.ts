import { describe, expect, it } from 'vitest'
import type { BiomeLayer } from '@/render/assets/biomeLibrary'
import { scatterBiome, scatterLayer } from './biomeScatter'

const layer: BiomeLayer = { prop: 'prop.biome.tree.canopy', count: 18, radius: [10, 80], scale: [0.8, 1.4] }
const flat = { heightAt: () => 0 }

describe('scatterLayer', () => {
  it('is deterministic for the same region and seed', () => {
    const a = scatterLayer(layer, { ...flat, regionId: 'whisperingwoods', seed: 42 })
    const b = scatterLayer(layer, { ...flat, regionId: 'whisperingwoods', seed: 42 })
    expect(a).toEqual(b)
  })

  it('produces distinct scatter placements for two regions sharing the same biome', () => {
    const a = scatterLayer(layer, { ...flat, regionId: 'whisperingwoods', seed: 42 })
    const b = scatterLayer(layer, { ...flat, regionId: 'thornmarch', seed: 42 })
    expect(a).not.toEqual(b)
    expect(a[0]?.position).not.toEqual(b[0]?.position)
  })

  it('places props inside bounded radius band', () => {
    for (const placement of scatterLayer(layer, { ...flat, regionId: 'hearthvale', seed: 42 })) {
      const radius = Math.hypot(placement.position[0], placement.position[2])
      expect(radius).toBeGreaterThanOrEqual(6) // bounded shift
      expect(radius).toBeLessThanOrEqual(85)
    }
  })

  it('strictly keeps every prop outside the central clearing', () => {
    for (const placement of scatterLayer(layer, { ...flat, clearing: 32, regionId: 'elderrootgrove', seed: 42 })) {
      expect(Math.hypot(placement.position[0], placement.position[2])).toBeGreaterThanOrEqual(32 - 1e-6)
    }
  })

  it('strictly keeps every prop outside the arrival spawn clearance at [0, -18]', () => {
    for (const placement of scatterLayer(layer, { ...flat, regionId: 'sunkenreach', seed: 42 })) {
      const distToSpawn = Math.hypot(placement.position[0] - 0, placement.position[2] - (-18))
      expect(distToSpawn).toBeGreaterThanOrEqual(5.0 - 1e-6)
    }
  })

  it('samples ground height at the placement', () => {
    const placements = scatterLayer(layer, { heightAt: (x, z) => x + z, regionId: 'saltcrag', seed: 42 })
    for (const placement of placements) {
      expect(placement.position[1]).toBeCloseTo(placement.position[0] + placement.position[2], 6)
    }
  })

  it('stays within the bounded scale range', () => {
    for (const placement of scatterLayer(layer, { ...flat, regionId: 'cinderpeaks', seed: 42 })) {
      expect(placement.scale).toBeGreaterThanOrEqual(0.7)
      expect(placement.scale).toBeLessThanOrEqual(1.6)
    }
  })

  it('honours the count and density modifier', () => {
    const base = scatterLayer(layer, flat)
    expect(base.length).toBeGreaterThanOrEqual(10)
    expect(scatterLayer({ ...layer, count: 0 }, flat)).toHaveLength(0)
  })
})

describe('scatterBiome', () => {
  it('offsets each layer so equal-count layers do not stack', () => {
    const [first = [], second = []] = scatterBiome([layer, { ...layer }], { ...flat, regionId: 'whisperingwoods', seed: 42 })
    expect(first[0]?.position).not.toEqual(second[0]?.position)
  })
})
