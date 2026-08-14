import { describe, expect, it } from 'vitest'
import { REGION_LIST } from '@/core/data/regions'
import { getRegionPhenomenon } from '@/core/data/phenomena'
import { ambientAgentPosition, getRegionAmbientSpec } from './ambientPaths'

const SEED = 42

const KEEP_CLEAR: [number, number, number][] = [
  [0, -18, 14],
  [0, 28, 10],
  [28, 0, 10],
  [-28, 0, 10],
]

describe('getRegionAmbientSpec', () => {
  it('derives a spec for every region with a phenomenon', () => {
    for (const def of REGION_LIST) {
      const spec = getRegionAmbientSpec(def.id, SEED)
      expect(spec, def.id).not.toBeNull()
      expect(spec!.ambient).toBe(getRegionPhenomenon(def.id)!.ambient)
    }
  })

  it('is deterministic per region and seed', () => {
    for (const def of REGION_LIST.slice(0, 8)) {
      expect(getRegionAmbientSpec(def.id, SEED)).toEqual(getRegionAmbientSpec(def.id, SEED))
    }
  })

  it('keeps ambient loops away from arrival and landing zones', () => {
    for (const def of REGION_LIST) {
      const spec = getRegionAmbientSpec(def.id, SEED)!
      for (const [kx, kz, kr] of KEEP_CLEAR) {
        const dist = Math.hypot(spec.x - kx, spec.z - kz)
        expect(
          dist,
          `${def.id}: loop centre ${dist.toFixed(1)}m from zone (${kx},${kz})`,
        ).toBeGreaterThanOrEqual(kr)
      }
    }
  })

  it('produces finite, bounded values', () => {
    for (const def of REGION_LIST) {
      const spec = getRegionAmbientSpec(def.id, SEED)!
      expect(Number.isFinite(spec.x)).toBe(true)
      expect(Number.isFinite(spec.height)).toBe(true)
      expect(spec.count).toBeGreaterThan(0)
      expect(spec.count).toBeLessThanOrEqual(24)
      expect(spec.period).toBeGreaterThan(0)
      // The whole loop must stay inside the explorable radius.
      expect(Math.hypot(spec.x, spec.z) + spec.radius).toBeLessThanOrEqual(95)
    }
  })

  it('varies across same-biome regions', () => {
    const coasts = REGION_LIST.filter((r) => r.biome === 'coast').slice(0, 2)
    if (coasts.length === 2) {
      const a = getRegionAmbientSpec(coasts[0]!.id, SEED)!
      const b = getRegionAmbientSpec(coasts[1]!.id, SEED)!
      expect([a.x, a.z]).not.toEqual([b.x, b.z])
    }
  })
})

describe('ambientAgentPosition', () => {
  it('is pure — same inputs, same output', () => {
    const spec = getRegionAmbientSpec('hearthvale', SEED)!
    expect(ambientAgentPosition(spec, 3, 12.5)).toEqual(ambientAgentPosition(spec, 3, 12.5))
  })

  it('moves each agent around the loop over time and stays bounded', () => {
    const spec = getRegionAmbientSpec('hearthvale', SEED)!
    const a = ambientAgentPosition(spec, 0, 0)
    const b = ambientAgentPosition(spec, 0, spec.period / 2)
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(1)

    for (let t = 0; t < spec.period * 2; t += spec.period / 10) {
      for (let i = 0; i < spec.count; i++) {
        const p = ambientAgentPosition(spec, i, t)
        expect(Number.isFinite(p.x)).toBe(true)
        expect(p.y).toBeGreaterThanOrEqual(0)
        expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(95)
      }
    }
  })

  it('separates agents spatially', () => {
    const spec = getRegionAmbientSpec('hearthvale', SEED)!
    const positions = Array.from({ length: spec.count }, (_, i) => ambientAgentPosition(spec, i, 5))
    const first = positions[0]!
    let anyApart = false
    for (const p of positions.slice(1)) {
      if (Math.hypot(p.x - first.x, p.z - first.z) > 1) anyApart = true
    }
    expect(anyApart).toBe(true)
  })
})
