import { describe, expect, it } from 'vitest'
import { BREATH_CONE_HALF_ANGLE } from '@/core/combat/encounter'
import { breathEnvelope, breathRadiusAt, breathSeed } from './breathVfxMath'

describe('breath VFX scaffold', () => {
  it('uses the same radius as the combat breath cone', () => {
    expect(breathRadiusAt(26)).toBeCloseTo(26 * Math.tan(BREATH_CONE_HALF_ANGLE), 8)
  })

  it('has a bounded ignition and release envelope', () => {
    expect(breathEnvelope(0)).toBe(0)
    expect(breathEnvelope(0.2)).toBeGreaterThan(0.9)
    expect(breathEnvelope(0.85)).toBe(0)
  })

  it('creates repeatable cosmetic particle seeds without combat RNG', () => {
    expect(breathSeed(2, 1, 7)).toBe(breathSeed(2, 1, 7))
    expect(breathSeed(2, 1, 7)).not.toBe(breathSeed(3, 1, 7))
  })
})
