import { describe, it, expect, beforeEach } from 'vitest'
import { createInitialState } from './game'
import { REGION_LIST } from '../data/regions'
import {
  ATLAS_LAYER_LIST,
  getRegionLayerValue,
  getAtlasLayerLegend,
  normalizeValue,
  type AtlasLayerId,
} from './atlasLayers'

describe('atlasLayers', () => {
  let state = createInitialState(42)

  beforeEach(() => {
    state = createInitialState(42)
  })

  it('defines exactly 7 strategic layers with descriptive names', () => {
    expect(ATLAS_LAYER_LIST).toHaveLength(7)
    const ids = ATLAS_LAYER_LIST.map((l) => l.id)
    expect(ids).toEqual([
      'political',
      'biome',
      'yields',
      'unrest',
      'garrison',
      'species',
      'exploration',
    ])
    for (const l of ATLAS_LAYER_LIST) {
      expect(l.name.length).toBeGreaterThan(3)
      expect(l.description.length).toBeGreaterThan(10)
    }
  })

  it('correctly clamps normalized values between 0.0 and 1.0', () => {
    expect(normalizeValue(50, 0, 100)).toBe(0.5)
    expect(normalizeValue(-20, 0, 100)).toBe(0)
    expect(normalizeValue(150, 0, 100)).toBe(1)
    expect(normalizeValue(10, 50, 50)).toBe(0)
  })

  describe('political layer', () => {
    it('returns held status for starting owned region', () => {
      const val = getRegionLayerValue(state, 'hearthvale', 'political')
      expect(val.displayValue).toBe('Held Territory')
      expect(val.color).toBe('#4ade80')
      expect(val.normalized).toBe(1.0)
      expect(val.isUnknown).toBe(false)
    })

    it('returns attackable for neighbor of owned region', () => {
      const val = getRegionLayerValue(state, 'sunkenreach', 'political')
      expect(val.displayValue).toBe('Attackable Frontier')
      expect(val.color).toBe('#fbbf24')
      expect(val.normalized).toBe(0.5)
    })
  })

  describe('biome layer', () => {
    it('returns biome name and color for mapped region', () => {
      const val = getRegionLayerValue(state, 'hearthvale', 'biome')
      expect(val.displayValue).toBe('Valley')
      expect(val.color).toBe('#64748b')
      expect(val.isUnknown).toBe(false)
    })

    it('returns unknown state for unmapped distant region', () => {
      // Temporarily mark a region unmapped
      state.atlasKnowledge.frostgate = {
        regionId: 'frostgate',
        mapped: false,
        visited: false,
        discoveredLandmarkIds: [],
        observedPhenomenonIds: [],
        firstVisitedTick: null,
      }
      const val = getRegionLayerValue(state, 'frostgate', 'biome')
      expect(val.isUnknown).toBe(true)
      expect(val.displayValue).toBe('Uncharted Territory')
    })
  })

  describe('yields layer', () => {
    it('computes positive yield sum and formatting', () => {
      const val = getRegionLayerValue(state, 'hearthvale', 'yields')
      expect(val.normalized).toBeGreaterThan(0)
      expect(val.normalized).toBeLessThanOrEqual(1.0)
      expect(val.displayValue).toContain('Resources/t')
    })
  })

  describe('unrest layer', () => {
    it('displays 0% unrest for newly conquered province', () => {
      const val = getRegionLayerValue(state, 'hearthvale', 'unrest')
      expect(val.displayValue).toBe('0% Unrest')
      expect(val.color).toBe('#22c55e')
      expect(val.detail).toBe('Stable Territory')
    })

    it('displays unoccupied for enemy-held region', () => {
      const val = getRegionLayerValue(state, 'sunkenreach', 'unrest')
      expect(val.displayValue).toBe('Unoccupied')
    })
  })

  describe('garrison layer', () => {
    it('computes garrison power for enemy regions', () => {
      const val = getRegionLayerValue(state, 'sunkenreach', 'garrison')
      expect(val.displayValue).toContain('Power')
      expect(val.normalized).toBeGreaterThan(0)
    })
  })

  describe('species layer', () => {
    it('displays species name and palette color for mapped region', () => {
      const val = getRegionLayerValue(state, 'hearthvale', 'species')
      expect(val.displayValue).toBe('Emberback')
      expect(val.isUnknown).toBe(false)
    })
  })

  describe('exploration layer', () => {
    it('evaluates visited and landmark discovery progression', () => {
      const val = getRegionLayerValue(state, 'hearthvale', 'exploration')
      expect(val.normalized).toBeGreaterThanOrEqual(0.5) // Mapped (25%) + Visited (25%) = 50%
      expect(val.displayValue).toContain('% Explored')
    })
  })

  describe('legends', () => {
    it('returns populated legends for all 7 layers', () => {
      const layers: AtlasLayerId[] = [
        'political',
        'biome',
        'yields',
        'unrest',
        'garrison',
        'species',
        'exploration',
      ]
      for (const l of layers) {
        const legend = getAtlasLayerLegend(l)
        expect(legend.length).toBeGreaterThanOrEqual(3)
        for (const item of legend) {
          expect(item.label.length).toBeGreaterThan(0)
          expect(item.color.startsWith('#')).toBe(true)
        }
      }
    })
  })

  it('runs safely over all regions for every layer without throwing', () => {
    const layers: AtlasLayerId[] = [
      'political',
      'biome',
      'yields',
      'unrest',
      'garrison',
      'species',
      'exploration',
    ]
    for (const def of REGION_LIST) {
      for (const l of layers) {
        const res = getRegionLayerValue(state, def.id, l)
        expect(res.regionId).toBe(def.id)
        expect(res.normalized).toBeGreaterThanOrEqual(0)
        expect(res.normalized).toBeLessThanOrEqual(1.0)
      }
    }
  })
})
