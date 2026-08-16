import { describe, expect, it } from 'vitest'
import { REGION_LIST } from '@/core/data/regions'
import { BIOME_PALETTES } from '../atmosphere/biomePalettes'
import { biomeHeightAt } from './BiomeTerrain'
import { getRegionLandmarkAnchors } from '../discovery/landmarkAnchors'
import { getRegionObservationVantage } from '../ecology/observationVantage'
import {
  DRY_SITE_CLEARANCE,
  getProtectedSites,
  getRegionWaterBody,
  drySiteLift,
  hummockFalloff,
} from './biomeWater'

/**
 * Water vocabulary and dry-site contracts for biome water bodies.
 *
 * The hummock lift exists so a fen can flood its hollows while every
 * gameplay site — spawn, landings, landmark anchors, observation vantage —
 * stays provably dry. These tests pin that invariant numerically.
 */

const WATER_BIOMES = ['coast', 'marsh', 'swamp', 'ashland']

/** The biome each region actually uses, for iterating water regions. */
function waterRegions() {
  return REGION_LIST.filter((r) => WATER_BIOMES.includes(r.biome))
}

describe('biomeWater vocabulary', () => {
  it('defines a water body for every water biome and none for the rest', () => {
    for (const biome of Object.keys(BIOME_PALETTES)) {
      const body = getRegionWaterBody(biome, 'sunkenreach', 42)
      if (WATER_BIOMES.includes(biome)) {
        expect(body, biome).not.toBeNull()
      } else {
        expect(body, biome).toBeNull()
      }
    }
  })

  it('produces deterministic, finite levels within the authored jitter band', () => {
    for (const region of waterRegions()) {
      const a = getRegionWaterBody(region.biome, region.id, 42)
      const b = getRegionWaterBody(region.biome, region.id, 42)
      expect(a).toEqual(b)
      expect(Number.isFinite(a!.level)).toBe(true)
      expect(a!.level).toBeGreaterThan(-4)
      expect(a!.level).toBeLessThan(0)
    }
  })

  it('jitters the level distinctly for two regions sharing a biome', () => {
    const coasts = waterRegions().filter((r) => r.biome === 'coast')
    const levels = new Set(coasts.map((r) => getRegionWaterBody(r.biome, r.id, 42)!.level))
    expect(levels.size).toBe(coasts.length)
  })

  it('carries valid hex colours and bounded animation parameters', () => {
    for (const region of waterRegions()) {
      const body = getRegionWaterBody(region.biome, region.id, 42)!
      for (const c of [body.colorShallow, body.colorDeep, body.colorFoam]) {
        expect(c).toMatch(/^#[0-9a-fA-F]{6}$/)
      }
      expect(body.speed).toBeGreaterThan(0)
      expect(body.speed).toBeLessThanOrEqual(1.5)
      expect(body.waveAmp).toBeGreaterThan(0)
      expect(body.waveAmp).toBeLessThanOrEqual(1.2)
      expect(body.opacity).toBeGreaterThan(0.5)
      expect(body.opacity).toBeLessThanOrEqual(1)
      expect(body.extent).toBeGreaterThanOrEqual(1)
      expect(body.extent).toBeLessThanOrEqual(1.5)
      expect(body.segments).toBeGreaterThanOrEqual(48)
      expect(Number.isInteger(body.glow)).toBe(true)
    }
  })
})

describe('biomeWater protected sites', () => {
  it('always includes spawn and the three landing clearings', () => {
    const sites = getProtectedSites('sunkenreach', 42)
    const kinds = sites.map((s) => s.kind)
    expect(kinds).toContain('spawn')
    expect(kinds.filter((k) => k === 'landing')).toHaveLength(3)
    for (const s of sites) {
      expect(Number.isFinite(s.x)).toBe(true)
      expect(Number.isFinite(s.z)).toBe(true)
    }
  })

  it('includes the region\'s landmark anchors and observation vantage', () => {
    const sites = getProtectedSites('ashfen', 42)
    const anchors = getRegionLandmarkAnchors('ashfen', 42)
    for (const a of anchors) {
      expect(sites.some((s) => s.kind === 'landmark' && s.x === a.x && s.z === a.z)).toBe(true)
    }
    const vantage = getRegionObservationVantage('ashfen', 42)
    if (vantage) {
      expect(sites.some((s) => s.kind === 'vantage' && s.x === vantage.x && s.z === vantage.z)).toBe(true)
    }
  })
})

describe('biomeWater dry-site contracts (the water does not drown gameplay)', () => {
  it('keeps every protected site above the water level across all water regions', () => {
    for (const region of waterRegions()) {
      const body = getRegionWaterBody(region.biome, region.id, 42)
      expect(body).not.toBeNull()
      const sites = getProtectedSites(region.id, 42)

      for (const site of sites) {
        const h = biomeHeightAt(region.biome, site.x, site.z, region.id, 42)
        expect(
          h - body!.level,
          `${region.id} ${site.kind} at (${site.x.toFixed(1)}, ${site.z.toFixed(1)})`,
        ).toBeGreaterThanOrEqual(DRY_SITE_CLEARANCE * 0.9) // falloff centre is exactly 1.0
      }
    }
  })

  it('keeps the slope under every protected site below the landing limit', () => {
    const MAX_SLOPE = 0.35
    for (const region of waterRegions()) {
      for (const site of getProtectedSites(region.id, 42)) {
        // Sample the gradient over 1 m like evaluateLandingSafety does.
        const h = (x: number, z: number) => biomeHeightAt(region.biome, x, z, region.id, 42)
        const dx = (h(site.x + 1, site.z) - h(site.x - 1, site.z)) / 2
        const dz = (h(site.x, site.z + 1) - h(site.x, site.z - 1)) / 2
        const slope = Math.atan(Math.hypot(dx, dz))
        expect(slope, `${region.id} ${site.kind} slope`).toBeLessThan(MAX_SLOPE)
      }
    }
  })
})

describe('drySiteLift / hummockFalloff math', () => {
  it('sizes the hummock radius to bound the flank slope over the realistic need range', () => {
    // Protected sites sit at most ~1.6 m under their water level (marsh hollow
    // vs bog level); beyond need ≈ 2.5 the 14 m radius cap would steepen
    // flanks, but no authored site reaches it — the per-region slope test
    // below covers the real data.
    for (let need = 0.05; need <= 2.2; need += 0.05) {
      const { height, radius } = drySiteLift(need)!
      const peakGradient = (height * Math.PI) / (2 * radius)
      expect(peakGradient).toBeLessThanOrEqual(0.287)
    }
  })

  it('produces no lift when the site is already dry', () => {
    expect(drySiteLift(-1)).toBeNull()
    expect(drySiteLift(0)).toBeNull()
  })

  it('fades to zero at the hummock edge and peaks at its centre', () => {
    expect(hummockFalloff(0, 10)).toBeCloseTo(1)
    expect(hummockFalloff(10, 10)).toBeCloseTo(0)
    expect(hummockFalloff(14, 10)).toBe(0)
  })
})
