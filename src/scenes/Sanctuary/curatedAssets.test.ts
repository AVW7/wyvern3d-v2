import { describe, expect, it } from 'vitest'
import { SANCTUARY_SPATIAL_CONTRACT } from '@/core/data/sanctuarySpatialContract'
import { validateSanctuaryVisualAnchors } from './curatedAssets'

describe('Sanctuary spatial contract', () => {
  it('keeps all eleven stations named, measured, and outside unauthorised flight obstruction', () => {
    expect(Object.keys(SANCTUARY_SPATIAL_CONTRACT)).toHaveLength(11)
    expect(validateSanctuaryVisualAnchors()).toEqual([])
    for (const station of Object.values(SANCTUARY_SPATIAL_CONTRACT)) {
      expect(station.approach).not.toEqual(station.position)
      expect(station.roadConnection).not.toEqual(station.position)
      expect(station.visualAnchors.length).toBeGreaterThan(0)
    }
  })
})
