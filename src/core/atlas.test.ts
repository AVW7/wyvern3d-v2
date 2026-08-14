import { describe, expect, it } from 'vitest'
import { REGIONS, REGION_LIST, STARTING_REGION } from './data/regions'
import { CLIMATE_TAGS, TERRAIN_TAGS, getAllAuthoredLandmarks, getRegionAtlasData } from './data/atlas'
import { createInitialState } from './state/game'
import { execute } from './executions'
import {
  getAtlasCompletionStats,
  getDiscoveredLandmarks,
  getKnownRegionSummary,
  getKnownRegionTags,
  getKnownRegionThreatNotes,
  getRegionKnowledge,
  isRegionMapped,
  isRegionVisited,
} from './state/atlasKnowledge'
import { migrate } from './state/save'
import type { GameState } from './types'

describe('World Atlas Stage 0: Content and Knowledge Contract', () => {
  describe('Static Authored Content', () => {
    it('provides valid atlas data for all 22 defined regions', () => {
      expect(REGION_LIST).toHaveLength(22)
      for (const def of REGION_LIST) {
        const atlas = getRegionAtlasData(def.id)
        expect(atlas, `Atlas data for ${def.id}`).not.toBeNull()
        expect(atlas!.summary.length).toBeGreaterThan(20)
        expect(atlas!.climateTags.length).toBeGreaterThanOrEqual(1)
        expect(atlas!.terrainTags.length).toBeGreaterThanOrEqual(1)
        expect(atlas!.threatNotes.length).toBeGreaterThan(10)
        expect(atlas!.landmarks.length).toBeGreaterThanOrEqual(1)
        expect(atlas!.landmarks.length).toBeLessThanOrEqual(3)

        // Attached to RegionDef directly
        expect(def.atlas).toEqual(atlas)
      }
    })

    it('uses standard vocabularies for all climate and terrain tags', () => {
      const allowedClimates = new Set<string>(CLIMATE_TAGS)
      const allowedTerrains = new Set<string>(TERRAIN_TAGS)

      for (const def of REGION_LIST) {
        const atlas = getRegionAtlasData(def.id)!
        for (const c of atlas.climateTags) {
          expect(allowedClimates.has(c), `Invalid climate tag "${c}" in ${def.id}`).toBe(true)
        }
        for (const t of atlas.terrainTags) {
          expect(allowedTerrains.has(t), `Invalid terrain tag "${t}" in ${def.id}`).toBe(true)
        }
      }
    })

    it('ensures every landmark has a unique id across the realm and valid category', () => {
      const allLandmarks = getAllAuthoredLandmarks()
      const ids = new Set<string>()
      const allowedCategories = new Set(['natural', 'ruin', 'settlement', 'monolith', 'shrine'])

      for (const item of allLandmarks) {
        expect(ids.has(item.landmark.id), `Duplicate landmark id: ${item.landmark.id}`).toBe(false)
        ids.add(item.landmark.id)
        expect(item.landmark.name.length).toBeGreaterThan(3)
        expect(item.landmark.description.length).toBeGreaterThan(10)
        expect(allowedCategories.has(item.landmark.category)).toBe(true)
      }
      expect(allLandmarks.length).toBeGreaterThanOrEqual(22)
    })
  })

  describe('Initial Knowledge State', () => {
    it('initializes starting region as visited & mapped, and neighbors as mapped', () => {
      const state = createInitialState(42)
      expect(state.atlasKnowledge).toBeDefined()

      const startK = getRegionKnowledge(state, STARTING_REGION)
      expect(startK).not.toBeNull()
      expect(startK!.visited).toBe(true)
      expect(startK!.mapped).toBe(true)
      expect(startK!.discoveredLandmarkIds).toEqual([])
      expect(startK!.firstVisitedTick).toBe(0)

      // Starting region neighbors should be mapped
      const startDef = REGIONS[STARTING_REGION]!
      for (const neighborId of startDef.neighbors) {
        const neighborK = getRegionKnowledge(state, neighborId)
        expect(neighborK, `Neighbor ${neighborId}`).not.toBeNull()
        expect(neighborK!.mapped).toBe(true)
        expect(neighborK!.visited).toBe(false)
      }

      // Distant un-neighbor regions should not be mapped initially
      const distant = getRegionKnowledge(state, 'duskspire')
      expect(distant!.mapped).toBe(false)
      expect(distant!.visited).toBe(false)
    })

    it('computes accurate initial completion stats', () => {
      const state = createInitialState(42)
      const stats = getAtlasCompletionStats(state)

      expect(stats.totalRegions).toBe(22)
      expect(stats.visitedRegions).toBe(1) // only starting region
      expect(stats.mappedRegions).toBeGreaterThanOrEqual(6) // hearthvale + its 5 neighbors
      expect(stats.discoveredLandmarks).toBe(0)
      expect(stats.totalLandmarks).toBe(getAllAuthoredLandmarks().length)
      expect(stats.percent).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Pure Selectors & Information Gating', () => {
    it('gates summary and tags behind mapped state', () => {
      const state = createInitialState(42)

      // Hearthvale is mapped -> returns summary & tags
      expect(getKnownRegionSummary(state, 'hearthvale')).not.toBeNull()
      expect(getKnownRegionTags(state, 'hearthvale')).not.toBeNull()

      // Duskspire is unmapped -> returns null
      expect(getKnownRegionSummary(state, 'duskspire')).toBeNull()
      expect(getKnownRegionTags(state, 'duskspire')).toBeNull()
    })

    it('gates threat notes behind visited state', () => {
      const state = createInitialState(42)

      // Hearthvale is visited -> threat notes accessible
      expect(getKnownRegionThreatNotes(state, 'hearthvale')).not.toBeNull()

      // Sunkenreach is mapped (neighbor) but not visited -> threat notes hidden
      expect(isRegionMapped(state, 'sunkenreach')).toBe(true)
      expect(isRegionVisited(state, 'sunkenreach')).toBe(false)
      expect(getKnownRegionThreatNotes(state, 'sunkenreach')).toBeNull()
    })

    it('returns only discovered landmarks for a region', () => {
      const state = createInitialState(42)
      expect(getDiscoveredLandmarks(state, 'hearthvale')).toEqual([])

      execute(state, {
        type: 'DISCOVER_LANDMARK',
        regionId: 'hearthvale',
        landmarkId: 'hearthvale_high_perch',
      })

      const discovered = getDiscoveredLandmarks(state, 'hearthvale')
      expect(discovered).toHaveLength(1)
      expect(discovered[0]?.id).toBe('hearthvale_high_perch')
    })
  })

  describe('Intents and Executions', () => {
    it('records region visit, maps neighbors, emits event, and is idempotent', () => {
      const state = createInitialState(42)
      const prevEventsCount = state.events.length

      expect(isRegionVisited(state, 'sunkenreach')).toBe(false)

      execute(state, { type: 'RECORD_REGION_VISIT', regionId: 'sunkenreach' })

      expect(isRegionVisited(state, 'sunkenreach')).toBe(true)
      expect(isRegionMapped(state, 'sunkenreach')).toBe(true)
      expect(state.events.length).toBe(prevEventsCount + 1)
      const event = state.events[state.events.length - 1]!
      expect(event.kind).toBe('region_visited')
      expect(event.subjectId).toBe('sunkenreach')

      // Saltcrag is a neighbor of sunkenreach -> should now be mapped
      expect(isRegionMapped(state, 'saltcrag')).toBe(true)

      // Idempotence: repeating the intent must not duplicate events or change state
      const eventCountBefore = state.events.length
      execute(state, { type: 'RECORD_REGION_VISIT', regionId: 'sunkenreach' })
      expect(state.events.length).toBe(eventCountBefore)
    })

    it('discovers landmark, emits event, and is idempotent', () => {
      const state = createInitialState(42)
      const prevEventsCount = state.events.length

      execute(state, {
        type: 'DISCOVER_LANDMARK',
        regionId: 'hearthvale',
        landmarkId: 'hearthvale_high_perch',
      })

      const k = getRegionKnowledge(state, 'hearthvale')!
      expect(k.discoveredLandmarkIds).toContain('hearthvale_high_perch')
      expect(state.events.length).toBe(prevEventsCount + 1)
      const event = state.events[state.events.length - 1]!
      expect(event.kind).toBe('landmark_discovered')
      expect(event.subjectId).toBe('hearthvale')
      expect(event.objectId).toBe('hearthvale_high_perch')

      // Idempotence
      const eventCountBefore = state.events.length
      execute(state, {
        type: 'DISCOVER_LANDMARK',
        regionId: 'hearthvale',
        landmarkId: 'hearthvale_high_perch',
      })
      expect(state.events.length).toBe(eventCountBefore)
      expect(k.discoveredLandmarkIds).toEqual(['hearthvale_high_perch'])
    })

    it('rejects landmark discovery for invalid region or wrong landmark id', () => {
      const state = createInitialState(42)
      const prevEventsCount = state.events.length

      // Invalid region
      execute(state, {
        type: 'DISCOVER_LANDMARK',
        regionId: 'fake_region',
        landmarkId: 'some_id',
      })
      expect(state.events.length).toBe(prevEventsCount)

      // Landmark belongs to cinderpeaks, not hearthvale
      execute(state, {
        type: 'DISCOVER_LANDMARK',
        regionId: 'hearthvale',
        landmarkId: 'cinderpeaks_caldera',
      })
      expect(state.events.length).toBe(prevEventsCount)
    })

    it('does not consume rngState or nextId during visits and landmark discoveries', () => {
      const state = createInitialState(42)
      const rngBefore = state.rngState
      const nextIdBefore = state.nextId

      execute(state, { type: 'RECORD_REGION_VISIT', regionId: 'greyreach' })
      execute(state, {
        type: 'DISCOVER_LANDMARK',
        regionId: 'greyreach',
        landmarkId: 'greyreach_standing_stones',
      })

      expect(state.rngState).toBe(rngBefore)
      expect(state.nextId).toBe(nextIdBefore)
    })
  })

  describe('Save Migration (9 -> 10)', () => {
    it('migrates older save version 9 by initializing atlasKnowledge from owned regions', () => {
      const stateV9 = {
        ...createInitialState(100),
        saveVersion: 9,
        atlasKnowledge: undefined as unknown as GameState['atlasKnowledge'],
      }
      // Grant player an extra region
      stateV9.regions.thornmarch!.owner = 'player'
      stateV9.regions.thornmarch!.conqueredAtTick = 15

      const migrated = migrate(stateV9)
      expect(migrated.saveVersion).toBeGreaterThanOrEqual(10)
      expect(migrated.atlasKnowledge).toBeDefined()

      // Owned regions are visited and mapped
      expect(migrated.atlasKnowledge.hearthvale!.visited).toBe(true)
      expect(migrated.atlasKnowledge.thornmarch!.visited).toBe(true)
      expect(migrated.atlasKnowledge.thornmarch!.firstVisitedTick).toBe(15)

      // Neighbors of thornmarch (like stonewatch) should now be mapped
      expect(migrated.atlasKnowledge.stonewatch!.mapped).toBe(true)
      expect(migrated.atlasKnowledge.stonewatch!.visited).toBe(false)

      // Does not fabricate landmark discoveries
      expect(migrated.atlasKnowledge.hearthvale!.discoveredLandmarkIds).toEqual([])
      expect(migrated.atlasKnowledge.thornmarch!.discoveredLandmarkIds).toEqual([])
    })
  })
})
