import { describe, expect, it } from 'vitest'
import { REGION_LIST } from '../../../core/data/regions'
import {
  regionCrestHeight,
  mapHeightAt,
  plateauRadius,
  SEA_LEVEL,
  SEA_RADIUS,
} from './mapTerrain'

describe('mapTerrain', () => {
  it('regionCrestHeight equals mapHeightAt within 1e-9 for all 22 regions', () => {
    for (const def of REGION_LIST) {
      const crest = regionCrestHeight(def)
      const height = mapHeightAt(def.position.x, def.position.z)
      expect(Math.abs(crest - height)).toBeLessThan(1e-9)
    }
  })

  it('every region crest is above SEA_LEVEL', () => {
    for (const def of REGION_LIST) {
      expect(regionCrestHeight(def)).toBeGreaterThan(SEA_LEVEL)
    }
  })

  it('height drops to SEA_LEVEL at SEA_RADIUS', () => {
    expect(mapHeightAt(SEA_RADIUS, 0)).toBe(SEA_LEVEL)
    expect(mapHeightAt(0, SEA_RADIUS)).toBe(SEA_LEVEL)
  })

  it('no two region plateaus overlap', () => {
    for (let i = 0; i < REGION_LIST.length; i++) {
      for (let j = i + 1; j < REGION_LIST.length; j++) {
        const a = REGION_LIST[i]!
        const b = REGION_LIST[j]!
        const dist = Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z)
        const minClearance = plateauRadius(a) + plateauRadius(b)
        expect(dist, `${a.id} and ${b.id} plateaus overlap`).toBeGreaterThan(minClearance)
      }
    }
  })
})
