import { describe, expect, it } from 'vitest'
import { REGION_LIST } from '@/core/data/regions'
import { getRegionPhenomenon } from '@/core/data/phenomena'
import {
  getRegionObservationVantage,
  isPhenomenonActive,
} from './observationVantage'

const SEED = 42

const KEEP_CLEAR: [number, number, number][] = [
  [0, -18, 14], // arrival
  [0, 28, 10], // north landing
  [28, 0, 10], // east landing
  [-28, 0, 10], // west landing
]

/** Exploration bound mirrored from biomeTraversal (kept in sync by test). */
const MAX_EXPLORATION_RADIUS = 95

describe('getRegionObservationVantage', () => {
  it('derives a vantage for every region with a phenomenon', () => {
    for (const def of REGION_LIST) {
      const vantage = getRegionObservationVantage(def.id, SEED)
      expect(vantage, def.id).not.toBeNull()
      expect(vantage!.phenomenonId).toBe(getRegionPhenomenon(def.id)!.id)
      expect(vantage!.kind).toBe(getRegionPhenomenon(def.id)!.kind)
    }
  })

  it('is deterministic per region and seed', () => {
    for (const def of REGION_LIST.slice(0, 8)) {
      expect(getRegionObservationVantage(def.id, SEED)).toEqual(
        getRegionObservationVantage(def.id, SEED),
      )
    }
  })

  it('stays inside the explorable radius and out of every keep-clear zone', () => {
    for (const def of REGION_LIST) {
      const vantage = getRegionObservationVantage(def.id, SEED)!
      const originDist = Math.hypot(vantage.x, vantage.z)
      expect(
        originDist,
        `${def.id}: vantage ${originDist.toFixed(1)}m from origin`,
      ).toBeLessThanOrEqual(MAX_EXPLORATION_RADIUS)
      for (const [kx, kz, kr] of KEEP_CLEAR) {
        const dist = Math.hypot(vantage.x - kx, vantage.z - kz)
        expect(
          dist,
          `${def.id}: vantage ${dist.toFixed(1)}m from zone (${kx},${kz})`,
        ).toBeGreaterThanOrEqual(kr)
      }
    }
  })

  it('produces finite values with a sane approach radius', () => {
    for (const def of REGION_LIST) {
      const vantage = getRegionObservationVantage(def.id, SEED)!
      expect(Number.isFinite(vantage.x)).toBe(true)
      expect(Number.isFinite(vantage.z)).toBe(true)
      expect(vantage.approachRadius).toBeGreaterThan(0)
      // The approach ring itself must stay within the explorable radius.
      expect(
        Math.hypot(vantage.x, vantage.z) + vantage.approachRadius,
      ).toBeLessThanOrEqual(MAX_EXPLORATION_RADIUS)
    }
  })
})

describe('isPhenomenonActive', () => {
  it('is always active for non-timed kinds', () => {
    for (const kind of ['migration', 'speciesSign', 'vista'] as const) {
      for (const t of [0, 37, 1234.5]) {
        expect(isPhenomenonActive('hearthvale', kind, t, SEED)).toBe(true)
      }
    }
  })

  it('gives timed phenomena a recurring deterministic window', () => {
    // A timed region (marsh/swamp family).
    const timed = REGION_LIST.find((r) => getRegionPhenomenon(r.id)!.kind === 'timed')!
    const active: boolean[] = []
    for (let t = 0; t < 240; t += 1) {
      active.push(isPhenomenonActive(timed.id, 'timed', t, SEED))
    }
    // Both states occur within one period...
    expect(active.some(Boolean)).toBe(true)
    expect(active.every(Boolean)).toBe(false)
    // ...the window repeats identically next period...
    for (let t = 0; t < 240; t += 7) {
      expect(isPhenomenonActive(timed.id, 'timed', t + 240, SEED)).toBe(
        isPhenomenonActive(timed.id, 'timed', t, SEED),
      )
    }
    // ...and is deterministic for the same inputs.
    expect(isPhenomenonActive(timed.id, 'timed', 500, SEED)).toBe(
      isPhenomenonActive(timed.id, 'timed', 500, SEED),
    )
  })
})
