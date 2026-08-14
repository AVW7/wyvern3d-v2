import { describe, expect, it } from 'vitest'
import { REGION_LIST } from '@/core/data/regions'
import { BIOME_WORLD_RADIUS, GROVE_MOUND_HEIGHT, biomeHeightAt, surfaceHeight } from './biomeHeight'

describe('biome terrain height', () => {
  it('reads the plane-local sample at the mirrored world Z', () => {
    // The ground plane is rotated -90° about X, so local +Y maps to world -Z.
    // Getting this backwards puts the player half a metre into asymmetric relief.
    expect(biomeHeightAt('forest', 12, 34)).toBe(surfaceHeight('forest', 12, -34))
    expect(biomeHeightAt('forest', 12, 34, 'whisperingwoods', 42)).toBe(
      surfaceHeight('forest', 12, -34, 'whisperingwoods', 42),
    )
  })

  it('is deterministic for the same region and seed', () => {
    const h1 = biomeHeightAt('forest', 25, -15, 'whisperingwoods', 100)
    const h2 = biomeHeightAt('forest', 25, -15, 'whisperingwoods', 100)
    expect(h1).toBe(h2)
  })

  it('produces distinct relief for two regions sharing the same biome', () => {
    const hA = biomeHeightAt('forest', 30, -30, 'whisperingwoods', 42)
    const hB = biomeHeightAt('forest', 30, -30, 'thornmarch', 42)
    expect(hA).not.toBeCloseTo(hB, 3)

    const hCoastA = biomeHeightAt('coast', -20, 40, 'sunkenreach', 42)
    const hCoastB = biomeHeightAt('coast', -20, 40, 'saltcrag', 42)
    expect(hCoastA).not.toBeCloseTo(hCoastB, 3)
  })

  it('lifts the grove into a mound at the centre and flattens it by the tree line across regions', () => {
    for (const seed of [42, 100, 999]) {
      const centre = biomeHeightAt('grove', 0, 0, 'elderrootgrove', seed)
      const outside = biomeHeightAt('grove', 60, 0, 'elderrootgrove', seed)
      expect(centre).toBeGreaterThanOrEqual(GROVE_MOUND_HEIGHT)
      expect(centre - outside).toBeGreaterThan(0.8)
    }
  })

  it('keeps all 22 regions within a walkable, finite range across the playfield', () => {
    for (const region of REGION_LIST) {
      for (let x = -BIOME_WORLD_RADIUS; x <= BIOME_WORLD_RADIUS; x += 30) {
        for (let z = -BIOME_WORLD_RADIUS; z <= BIOME_WORLD_RADIUS; z += 30) {
          const height = biomeHeightAt(region.biome, x, z, region.id, 42)
          expect(Number.isFinite(height), `${region.id} (${region.biome}) at ${x},${z}`).toBe(true)
          expect(Math.abs(height)).toBeLessThan(25)
        }
      }
    }
  })
})
