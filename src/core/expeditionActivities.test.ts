import { describe, expect, it } from 'vitest'
import { REGION_LIST } from './data/regions'
import {
  EXPEDITION_ACTIVITIES,
  getRegionExpeditionActivity,
  isActivityOfRegion,
} from './data/expeditionActivities'
import { createInitialState } from './state/game'
import { execute } from './executions'
import {
  getAtlasCompletionStats,
  getCompletedActivities,
  getRegionKnowledge,
} from './state/atlasKnowledge'
import { getRegionDossier } from './state/atlasDossier'

describe('expedition activities data', () => {
  it('covers every biome used by any region', () => {
    const biomes = new Set(REGION_LIST.map((r) => r.biome))
    const covered = new Set(EXPEDITION_ACTIVITIES.flatMap((a) => a.biomes))
    for (const biome of biomes) {
      expect(covered.has(biome), `biome ${biome} has no expedition activity`).toBe(true)
    }
  })

  it('has unique activity ids, valid kinds and theme colors', () => {
    const ids = new Set(EXPEDITION_ACTIVITIES.map((a) => a.id))
    expect(ids.size).toBe(EXPEDITION_ACTIVITIES.length)
    const kinds = new Set(['puzzle', 'hazard', 'trail', 'survey'])
    for (const a of EXPEDITION_ACTIVITIES) {
      expect(kinds.has(a.kind)).toBe(true)
      expect(a.name.length).toBeGreaterThan(3)
      expect(a.description.length).toBeGreaterThan(15)
      expect(a.objective.length).toBeGreaterThan(10)
      expect(a.hint.length).toBeGreaterThan(5)
      expect(a.knowledgeTag.length).toBeGreaterThan(3)
      expect(a.themeColor.startsWith('#')).toBe(true)
      expect(a.biomes.length).toBeGreaterThan(0)
    }
  })

  it('assigns an activity to each region matching its biome', () => {
    for (const def of REGION_LIST) {
      const a = getRegionExpeditionActivity(def.id)
      expect(a, def.id).not.toBeNull()
      expect(a!.biomes).toContain(def.biome)
      expect(isActivityOfRegion(def.id, a!.id)).toBe(true)
    }
  })
})

describe('COMPLETE_EXPEDITION_ACTIVITY execution', () => {
  it('records completion, emits event, and is idempotent', () => {
    const state = createInitialState(42)
    const before = state.events.length

    const activity = getRegionExpeditionActivity('hearthvale')!
    execute(state, {
      type: 'COMPLETE_EXPEDITION_ACTIVITY',
      regionId: 'hearthvale',
      activityId: activity.id,
    })

    expect(getCompletedActivities(state, 'hearthvale').map((a) => a.id)).toEqual([activity.id])
    expect(state.events.length).toBe(before + 1)
    const event = state.events[state.events.length - 1]!
    expect(event.kind).toBe('activity_completed')
    expect(event.subjectId).toBe('hearthvale')
    expect(event.objectId).toBe(activity.id)
    expect(event.payload?.knowledgeTag).toBe(activity.knowledgeTag)

    // Idempotent repetition
    const eventCountAfter = state.events.length
    execute(state, {
      type: 'COMPLETE_EXPEDITION_ACTIVITY',
      regionId: 'hearthvale',
      activityId: activity.id,
    })
    expect(state.events.length).toBe(eventCountAfter)
    expect(getRegionKnowledge(state, 'hearthvale')!.completedActivityIds).toEqual([activity.id])
  })

  it('rejects an activity for a wrong biome/region', () => {
    const state = createInitialState(42)
    const before = state.events.length
    const wrong = getRegionExpeditionActivity('cinderpeaks')! // ashland activity
    execute(state, {
      type: 'COMPLETE_EXPEDITION_ACTIVITY',
      regionId: 'hearthvale',
      activityId: wrong.id,
    })
    expect(state.events.length).toBe(before)
    expect(getCompletedActivities(state, 'hearthvale')).toEqual([])
  })

  it('does not consume rngState or nextId', () => {
    const state = createInitialState(42)
    const rngBefore = state.rngState
    const nextIdBefore = state.nextId

    const activity = getRegionExpeditionActivity('greyreach')!
    execute(state, {
      type: 'COMPLETE_EXPEDITION_ACTIVITY',
      regionId: 'greyreach',
      activityId: activity.id,
    })

    expect(state.rngState).toBe(rngBefore)
    expect(state.nextId).toBe(nextIdBefore)
    expect(getRegionKnowledge(state, 'greyreach')!.visited).toBe(true)
  })

  it('reflects completed activity in atlas completion stats and region dossier', () => {
    const state = createInitialState(42)
    const initialStats = getAtlasCompletionStats(state)
    expect(initialStats.completedActivities).toBe(0)

    const activity = getRegionExpeditionActivity('hearthvale')!
    execute(state, {
      type: 'COMPLETE_EXPEDITION_ACTIVITY',
      regionId: 'hearthvale',
      activityId: activity.id,
    })

    const updatedStats = getAtlasCompletionStats(state)
    expect(updatedStats.completedActivities).toBe(1)

    const dossier = getRegionDossier(state, 'hearthvale')!
    expect(dossier.completedActivities).toHaveLength(1)
    expect(dossier.completedActivities[0]?.id).toBe(activity.id)
    expect(dossier.completedActivities[0]?.knowledgeTag).toBe(activity.knowledgeTag)
    expect(dossier.history.some((h) => h.kind === 'activity_completed')).toBe(true)
  })
})
