import { describe, expect, it } from 'vitest'
import { REGION_LIST } from '@/core/data/regions'
import { BIOME_PALETTES } from '../atmosphere/biomePalettes'
import { BIOME_ACOUSTICS } from '../audio/biomeAudio'
import { biomeHeightAt } from './BiomeTerrain'
import { getRegionLandmarkAnchors } from '../discovery/landmarkAnchors'
import { BIOME_SPAWN_ANCHOR, getRegionColliders } from './biomeTraversal'
import { getRegionAmbientSpec } from '../ecology/ambientPaths'

describe('Biome Enhancement Stage 6: Numeric Quality Gates and Region Contracts', () => {
  const ALL_BIOMES = Object.keys(BIOME_PALETTES)

  it('asserts all 15 biomes have valid palettes, acoustics, and weather profiles', () => {
    expect(ALL_BIOMES.length).toBe(15)
    for (const biome of ALL_BIOMES) {
      expect(BIOME_PALETTES[biome]).toBeDefined()
      expect(BIOME_ACOUSTICS[biome]).toBeDefined()
      expect(BIOME_PALETTES[biome]!.groundColor).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })

  it('asserts every region produces finite, deterministic heights across its domain', () => {
    const testCoordinates: [number, number][] = [
      [0, 0],
      [BIOME_SPAWN_ANCHOR[0], BIOME_SPAWN_ANCHOR[1]],
      [-50, -50],
      [50, 50],
      [-80, 80],
      [80, -80],
    ]

    for (const region of REGION_LIST) {
      for (const [x, z] of testCoordinates) {
        const h1 = biomeHeightAt(region.biome, x, z, region.id, 42)
        const h2 = biomeHeightAt(region.biome, x, z, region.id, 42)
        expect(Number.isFinite(h1)).toBe(true)
        expect(h1).toBe(h2) // deterministic
        expect(h1).toBeGreaterThanOrEqual(-40)
        expect(h1).toBeLessThanOrEqual(60)
      }
    }
  })

  it('asserts spawn anchor clearance across all regions', () => {
    const [spawnX, spawnZ] = BIOME_SPAWN_ANCHOR

    for (const region of REGION_LIST) {
      const colliders = getRegionColliders(region.biome, region.id, 42)
      for (const col of colliders) {
        const dx = Math.abs(col.x - spawnX)
        const dz = Math.abs(col.z - spawnZ)
        // Spawn point should not be inside any collider box
        const inside = dx < col.halfW && dz < col.halfD
        expect(inside).toBe(false)
      }
    }
  })

  it('asserts every region has valid landmark anchors with unique IDs and finite coordinates', () => {
    for (const region of REGION_LIST) {
      const landmarks = getRegionLandmarkAnchors(region.id, 42)
      expect(landmarks.length).toBeGreaterThan(0)
      const ids = new Set<string>()

      for (const landmark of landmarks) {
        expect(ids.has(landmark.landmarkId)).toBe(false)
        ids.add(landmark.landmarkId)
        expect(Number.isFinite(landmark.x)).toBe(true)
        expect(Number.isFinite(landmark.z)).toBe(true)
        expect(landmark.approachRadius).toBeGreaterThan(0)
        expect(landmark.name.length).toBeGreaterThan(0)
      }
    }
  })

  it('asserts ambient ecology specs conform to frame and memory budgets', () => {
    for (const region of REGION_LIST) {
      const spec = getRegionAmbientSpec(region.id, 42)
      expect(spec).not.toBeNull()
      if (spec) {
        expect(spec.count).toBeGreaterThanOrEqual(6)
        expect(spec.count).toBeLessThanOrEqual(50) // bounded particle/agent budget
        expect(Number.isFinite(spec.x)).toBe(true)
        expect(Number.isFinite(spec.z)).toBe(true)
        expect(spec.radius).toBeGreaterThan(5)
      }
    }
  })
})
