import { describe, expect, it } from 'vitest'
import { SANCTUARY_REVIEW_SEED, SANCTUARY_REVIEW_VIEWS } from './qualityReview'

describe('Sanctuary review preset', () => {
  it('keeps game capture views deterministic and complete', () => {
    expect(SANCTUARY_REVIEW_SEED).toBe(120_024)
    expect(Object.keys(SANCTUARY_REVIEW_VIEWS)).toEqual(['keepGate', 'hatchery', 'flightRing', 'forge', 'breedingRoost', 'juvenileRoost'])
  })
})
