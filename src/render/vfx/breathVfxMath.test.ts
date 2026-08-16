import { describe, expect, it } from 'vitest'
import { BREATH_CONE_HALF_ANGLE } from '@/core/combat/encounter'
import {
  BREATH_VFX_LEAD_SECONDS,
  BREATH_VFX_TOTAL_SECONDS,
  breathEnvelope,
  breathRadiusAt,
  breathSeed,
} from './breathVfxMath'

describe('breath VFX scaffold', () => {
  it('uses the same radius as the combat breath cone', () => {
    expect(breathRadiusAt(26)).toBeCloseTo(26 * Math.tan(BREATH_CONE_HALF_ANGLE), 8)
  })

  it('has a bounded ignition and release envelope', () => {
    expect(breathEnvelope(0)).toBe(0)
    expect(breathEnvelope(BREATH_VFX_LEAD_SECONDS + 0.2)).toBeGreaterThan(0.9)
    expect(breathEnvelope(BREATH_VFX_TOTAL_SECONDS)).toBe(0)
  })

  it('stays dark until the authored gape opens', () => {
    // The clip spends this lead inhaling with the jaw still near shut. Fire
    // drawn here comes out of a closed mouth, which is what it used to do.
    expect(breathEnvelope(BREATH_VFX_LEAD_SECONDS)).toBe(0)
    expect(breathEnvelope(BREATH_VFX_LEAD_SECONDS * 0.5)).toBe(0)
  })

  it('ends inside the tell, so fire never outlives the clip that opens the mouth', () => {
    // `breath` is 2.000 s; the sim's BREATH_INTERVAL is 2.2 s.
    expect(BREATH_VFX_TOTAL_SECONDS).toBeLessThan(2)
  })

  it('creates repeatable cosmetic particle seeds without combat RNG', () => {
    expect(breathSeed(2, 1, 7)).toBe(breathSeed(2, 1, 7))
    expect(breathSeed(2, 1, 7)).not.toBe(breathSeed(3, 1, 7))
  })
})
