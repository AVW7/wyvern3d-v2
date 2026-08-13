import { describe, expect, it } from 'vitest'
import { BIOME_WORLD_RADIUS, GROVE_MOUND_HEIGHT, biomeHeightAt, surfaceHeight } from './biomeHeight'

describe('biome terrain height', () => {
  it('reads the plane-local sample at the mirrored world Z', () => {
    // The ground plane is rotated -90° about X, so local +Y maps to world -Z.
    // Getting this backwards puts the player half a metre into asymmetric relief.
    expect(biomeHeightAt('forest', 12, 34)).toBe(surfaceHeight('forest', 12, -34))
  })

  it('lifts the grove into a mound at the centre and flattens it by the tree line', () => {
    const centre = biomeHeightAt('grove', 0, 0)
    const outside = biomeHeightAt('grove', 60, 0)
    expect(centre).toBeGreaterThanOrEqual(GROVE_MOUND_HEIGHT)
    expect(centre - outside).toBeGreaterThan(1)
  })

  it('keeps every biome within a walkable range across the playfield', () => {
    for (const biome of ['grove', 'forest', 'valley', 'coast', 'mountain', 'tundra']) {
      for (let x = -BIOME_WORLD_RADIUS; x <= BIOME_WORLD_RADIUS; x += 22) {
        for (let z = -BIOME_WORLD_RADIUS; z <= BIOME_WORLD_RADIUS; z += 22) {
          const height = biomeHeightAt(biome, x, z)
          expect(Number.isFinite(height), `${biome} at ${x},${z}`).toBe(true)
          expect(Math.abs(height)).toBeLessThan(20)
        }
      }
    }
  })
})
