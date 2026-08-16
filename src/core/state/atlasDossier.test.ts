import { describe, it, expect, beforeEach } from 'vitest'
import { createInitialState } from './game'
import {
  findShortestPathToRegion,
  getRegionDossier,
  getRegionEventHistory,
} from './atlasDossier'
import { REGION_LIST } from '../data/regions'

describe('atlasDossier', () => {
  let state = createInitialState(42)

  beforeEach(() => {
    state = createInitialState(42)
  })

  describe('findShortestPathToRegion', () => {
    it('returns controlled status for player-owned starting region', () => {
      const route = findShortestPathToRegion(state, 'hearthvale')
      expect(route.status).toBe('controlled')
      expect(route.path).toEqual(['hearthvale'])
      expect(route.blockers).toEqual([])
      expect(route.summary).toContain('Controlled')
    })

    it('returns adjacent status for direct neighbor of owned region', () => {
      const route = findShortestPathToRegion(state, 'sunkenreach')
      expect(route.status).toBe('adjacent')
      expect(route.path).toEqual(['hearthvale', 'sunkenreach'])
      expect(route.blockers).toEqual([])
      expect(route.summary).toContain('Directly attackable')
    })

    it('finds multi-hop path with blocker list for distant region', () => {
      // Find a region at distance >= 2 from hearthvale (e.g. saltcrag via sunkenreach)
      const targetId = 'saltcrag'
      const route = findShortestPathToRegion(state, targetId)
      expect(route.status).toBe('reachable')
      expect(route.path.length).toBeGreaterThanOrEqual(3)
      expect(route.path[0]).toBe('hearthvale')
      expect(route.path[route.path.length - 1]).toBe(targetId)
      expect(route.blockers.length).toBe(route.path.length - 2)
      expect(route.summary).toContain('Requires conquering')
    })

    it('handles non-existent region safely', () => {
      const route = findShortestPathToRegion(state, 'non_existent_realm')
      expect(route.status).toBe('isolated')
      expect(route.path).toEqual([])
    })
  })

  describe('getRegionEventHistory', () => {
    it('extracts and orders relevant events for a region', () => {
      state.events = [
        {
          seq: 1,
          tick: 10,
          kind: 'region_visited',
          subjectId: 'hearthvale',
        },
        {
          seq: 2,
          tick: 20,
          kind: 'region_visited',
          subjectId: 'sunkenreach',
        },
        {
          seq: 3,
          tick: 30,
          kind: 'landmark_discovered',
          subjectId: 'hearthvale',
          objectId: 'hearthvale_altar',
        },
      ]

      const hearthEvents = getRegionEventHistory(state, 'hearthvale')
      expect(hearthEvents).toHaveLength(2)
      // Sorted newest first
      expect(hearthEvents[0]!.seq).toBe(3)
      expect(hearthEvents[0]!.message).toContain('Landmark discovered')
      expect(hearthEvents[1]!.seq).toBe(1)
      expect(hearthEvents[1]!.message).toContain('First expedition')

      const sunkenEvents = getRegionEventHistory(state, 'sunkenreach')
      expect(sunkenEvents).toHaveLength(1)
      expect(sunkenEvents[0]!.seq).toBe(2)
    })
  })

  describe('getRegionDossier', () => {
    it('builds a complete dossier for starting region with knowledge gating', () => {
      const dossier = getRegionDossier(state, 'hearthvale')
      expect(dossier).not.toBeNull()
      if (!dossier) return

      expect(dossier.id).toBe('hearthvale')
      expect(dossier.name).toBe('Hearthvale')
      expect(dossier.isOwned).toBe(true)
      expect(dossier.isMapped).toBe(true)
      expect(dossier.isVisited).toBe(true)
      expect(dossier.summary).not.toBeNull()
      expect(dossier.nativeSpecies).not.toBeNull()
      expect(dossier.nativeSpecies?.name).toBe('Emberback')
      expect(dossier.yields.base).toHaveProperty('gold')
      expect(dossier.garrison.totalStrength).toBeGreaterThanOrEqual(0)
      expect(dossier.unrest.level).toBe('stable')
    })

    it('builds valid dossier data across all 21 authored regions without throwing', () => {
      for (const def of REGION_LIST) {
        const dossier = getRegionDossier(state, def.id)
        expect(dossier).not.toBeNull()
        if (!dossier) continue
        expect(dossier.id).toBe(def.id)
        expect(dossier.tier).toBe(def.tier)
        expect(dossier.route.path.length).toBeGreaterThan(0)
      }
    })
  })
})
