import { describe, expect, it } from 'vitest'
import {
  getRegionTraversalZones,
  getRegionColliders,
  isPositionTraversable,
  evaluateLandingSafety,
  getSafeRecoveryAnchor,
  BIOME_SPAWN_ANCHOR,
  MAX_LANDING_SLOPE,
} from './biomeTraversal'
import { BIOME_PALETTES } from '../atmosphere/biomePalettes'
import { biomeHeightAt } from './biomeHeight'

const ALL_BIOMES = Object.keys(BIOME_PALETTES)

describe('Biome Enhancement Stage 2: Traversal, Collision, and Landing', () => {
  it('generates coherent traversal zones for any biome', () => {
    for (const biome of ALL_BIOMES) {
      const zones = getRegionTraversalZones(biome, 'test-region', 42)
      expect(zones.length).toBeGreaterThanOrEqual(6)

      const arrival = zones.find((z) => z.kind === 'arrival')
      expect(arrival).toBeDefined()
      expect(arrival!.center).toEqual(BIOME_SPAWN_ANCHOR)
      expect(arrival!.radius).toBeGreaterThanOrEqual(5)

      const central = zones.find((z) => z.kind === 'central')
      expect(central).toBeDefined()
      expect(central!.center).toEqual([0, 0])
      expect(central!.radius).toBeGreaterThanOrEqual(biome === 'grove' ? 16 : 8)

      const landingClearings = zones.filter((z) => z.kind === 'landingClearing')
      expect(landingClearings.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('generates valid colliders across all 15 biomes with finite bounds', () => {
    for (const biome of ALL_BIOMES) {
      const colliders = getRegionColliders(biome, 'region_1', 123)
      for (const c of colliders) {
        expect(Number.isFinite(c.x)).toBe(true)
        expect(Number.isFinite(c.z)).toBe(true)
        expect(Number.isFinite(c.halfW)).toBe(true)
        expect(Number.isFinite(c.halfD)).toBe(true)
        expect(c.halfW).toBeGreaterThan(0)
        expect(c.halfD).toBeGreaterThan(0)
      }
    }
  })

  it('never places colliders in the arrival spawn clearing', () => {
    for (const biome of ALL_BIOMES) {
      const colliders = getRegionColliders(biome, 'test-region', 42)
      for (const c of colliders) {
        const distToSpawn = Math.hypot(c.x - BIOME_SPAWN_ANCHOR[0], c.z - BIOME_SPAWN_ANCHOR[1])
        expect(distToSpawn).toBeGreaterThanOrEqual(4.0)
      }
    }
  })

  it('evaluates traversability accurately against colliders', () => {
    const colliders = [
      { x: 10, z: 10, halfW: 2, halfD: 2 },
      { x: -10, z: -10, halfW: 1.5, halfD: 1.5 },
    ]

    expect(isPositionTraversable(0, 0, colliders)).toBe(true)
    expect(isPositionTraversable(10, 10, colliders)).toBe(false)
    expect(isPositionTraversable(10.5, 9.8, colliders)).toBe(false)
    expect(isPositionTraversable(14, 14, colliders)).toBe(true)
  })

  it('evaluates landing safety based on slope, clearance, and bounds', () => {
    const flatHeightFn = (_x: number, _z: number) => 5.0
    const steepHeightFn = (x: number, _z: number) => x * 0.8 // slope = 0.8 > 0.35
    const colliders = [{ x: 15, z: 15, halfW: 2, halfD: 2 }]

    // Safe flat clearing far from obstacles
    const safeResult = evaluateLandingSafety(0, 20, flatHeightFn, colliders, MAX_LANDING_SLOPE)
    expect(safeResult.safe).toBe(true)
    expect(safeResult.reason).toBeUndefined()

    // Unsafe due to steep terrain
    const steepResult = evaluateLandingSafety(0, 20, steepHeightFn, colliders, MAX_LANDING_SLOPE)
    expect(steepResult.safe).toBe(false)
    expect(steepResult.reason).toBe('steep_slope')

    // Unsafe due to proximity to obstacle
    const obstructedResult = evaluateLandingSafety(15, 16, flatHeightFn, colliders, MAX_LANDING_SLOPE)
    expect(obstructedResult.safe).toBe(false)
    expect(obstructedResult.reason).toBe('obstructed')

    // Unsafe due to outer world bounds (> 95m)
    const oobResult = evaluateLandingSafety(0, 105, flatHeightFn, colliders, MAX_LANDING_SLOPE)
    expect(oobResult.safe).toBe(false)
    expect(oobResult.reason).toBe('out_of_bounds')
  })

  it('provides safe recovery anchor at spawn coordinates', () => {
    const anchor = getSafeRecoveryAnchor('forest', 'hearthvale', 42)
    expect(anchor[0]).toBe(BIOME_SPAWN_ANCHOR[0])
    expect(anchor[2]).toBe(BIOME_SPAWN_ANCHOR[1])
    expect(anchor[1]).toBeCloseTo(biomeHeightAt('forest', 0, -18, 'hearthvale', 42) + 0.1)
  })

  it('produces identical colliders and zones given identical seed and regionId', () => {
    const collidersA = getRegionColliders('mountain', 'cinderpeaks', 77)
    const collidersB = getRegionColliders('mountain', 'cinderpeaks', 77)
    expect(collidersA).toEqual(collidersB)

    const zonesA = getRegionTraversalZones('mountain', 'cinderpeaks', 77)
    const zonesB = getRegionTraversalZones('mountain', 'cinderpeaks', 77)
    expect(zonesA).toEqual(zonesB)
  })
})
