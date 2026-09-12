import { describe, expect, it } from 'vitest'
import { REGION_LIST } from '@/core/data/regions'
import { BIOME_PALETTES } from '../atmosphere/biomePalettes'
import { BIOME_LANDFORMS, getBiomeLandform } from './biomeLandforms'
import { BIOME_WORLD_RADIUS, biomeHeightAt } from './biomeHeight'

/** Interior samples only — the rim lift is a boundary device, not relief. */
function reliefStats(biome: string, regionId: string) {
  let min = Infinity
  let max = -Infinity
  for (let x = -80; x <= 80; x += 4) {
    for (let z = -80; z <= 80; z += 4) {
      if (Math.hypot(x, z) > 80) continue
      const h = biomeHeightAt(biome, x, z, regionId, 42)
      min = Math.min(min, h)
      max = Math.max(max, h)
    }
  }
  return { min, max, range: max - min }
}

describe('biome landform table', () => {
  it('covers every biome the palettes define', () => {
    // A biome missing here silently falls back to the gentle valley stack and
    // ships looking like a meadow. Fail loudly instead.
    for (const biome of Object.keys(BIOME_PALETTES)) {
      expect(BIOME_LANDFORMS[biome], `${biome} has no landform`).toBeDefined()
    }
  })

  it('defines no landform for a biome that does not exist', () => {
    expect(Object.keys(BIOME_LANDFORMS).every((id) => id in BIOME_PALETTES)).toBe(true)
  })

  it('falls back to a walkable stack for an unknown biome', () => {
    const fallback = getBiomeLandform('not-a-biome')
    expect(fallback).toBe(BIOME_LANDFORMS.valley)
    expect(Number.isFinite(biomeHeightAt('not-a-biome', 20, -20, undefined, 42))).toBe(true)
  })

  it('keeps every authored amplitude, datum and rim lift bounded', () => {
    for (const [biome, landform] of Object.entries(BIOME_LANDFORMS)) {
      expect(landform.amplitude, biome).toBeGreaterThan(0)
      expect(landform.amplitude, biome).toBeLessThanOrEqual(8)
      expect(landform.rimLift, biome).toBeGreaterThanOrEqual(0)
      expect(landform.rimLift, biome).toBeLessThanOrEqual(10)
      expect(Math.abs(landform.datum ?? 0), biome).toBeLessThanOrEqual(3)
      for (const [field, weight] of Object.entries(landform.weights ?? {})) {
        expect(weight, `${biome}.${field}`).toBeGreaterThanOrEqual(0)
        expect(weight, `${biome}.${field}`).toBeLessThanOrEqual(2)
      }
    }
  })

  it('separates biome character — a mountain is not a dressed-up marsh', () => {
    // The whole point of the landform table. Before it, every biome was a
    // sin/cos lattice of near-identical amplitude and only the palette differed.
    const mountain = reliefStats('mountain', 'cinderpeaks')
    const marsh = reliefStats('marsh', 'ashfen')
    const coast = reliefStats('coast', 'sunkenreach')

    expect(mountain.range).toBeGreaterThan(8)
    expect(marsh.range).toBeLessThan(5)
    expect(coast.range).toBeLessThan(5)
    expect(mountain.range / marsh.range).toBeGreaterThan(2.5)
  })

  it('holds every region inside the walkable band with its landform applied', () => {
    for (const region of REGION_LIST) {
      for (let x = -BIOME_WORLD_RADIUS; x <= BIOME_WORLD_RADIUS; x += 11) {
        for (let z = -BIOME_WORLD_RADIUS; z <= BIOME_WORLD_RADIUS; z += 11) {
          const h = biomeHeightAt(region.biome, x, z, region.id, 42)
          expect(Number.isFinite(h), `${region.id} at ${x},${z}`).toBe(true)
          expect(Math.abs(h), `${region.id} at ${x},${z}`).toBeLessThan(25)
        }
      }
    }
  })
})
