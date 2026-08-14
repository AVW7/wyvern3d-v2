import { describe, expect, it } from 'vitest'
import { REGION_LIST } from '../../../core/data/regions'
import {
  regionCrestHeight,
  regionDeckY,
  mapHeightAt,
  plateauRadius,
  COAST_FALLOFF,
  LAND_RADIUS,
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

  it('no region sits inside the coastal falloff', () => {
    // A region caught in the falloff has its crest crushed toward sea level,
    // so a tier-4 capital renders shorter than a tier-1 outpost.
    for (const def of REGION_LIST) {
      const dist = Math.hypot(def.position.x, def.position.z)
      expect(dist + plateauRadius(def), `${def.id} reaches the coast`).toBeLessThan(
        LAND_RADIUS - COAST_FALLOFF
      )
    }
  })

  it('crest height rises monotonically with tier', () => {
    for (const a of REGION_LIST) {
      for (const b of REGION_LIST) {
        if (a.tier >= b.tier) continue
        expect(regionCrestHeight(a), `${a.id} out-tops ${b.id}`).toBeLessThan(
          regionCrestHeight(b)
        )
      }
    }
  })

  it('the node deck clears the terrain it stands on', () => {
    for (const def of REGION_LIST) {
      expect(regionDeckY(def)).toBeGreaterThan(regionCrestHeight(def))
    }
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
