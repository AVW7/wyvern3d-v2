import type { GameState } from '../types'
import { REGIONS } from '../data/regions'
import { REGION_ATLAS_DATA } from '../data/atlas'
import { PHENOMENA, isPhenomenonOfRegion } from '../data/phenomena'
import { EXPEDITION_ACTIVITIES, isActivityOfRegion } from '../data/expeditionActivities'
import { emit, log } from '../state/game'
import { ensureAtlasKnowledge } from '../state/atlasKnowledge'

export function recordRegionVisit(state: GameState, regionId: string): void {
  const def = REGIONS[regionId]
  if (!def) return

  ensureAtlasKnowledge(state)
  const knowledge = state.atlasKnowledge[regionId]
  if (!knowledge) return

  // Idempotent: if already visited, do not re-emit or re-log
  if (knowledge.visited) return

  knowledge.visited = true
  knowledge.mapped = true
  if (knowledge.firstVisitedTick === null) {
    knowledge.firstVisitedTick = state.tick
  }

  // Discovering/visiting a region maps all its immediate neighbors
  for (const neighborId of def.neighbors) {
    if (state.atlasKnowledge[neighborId]) {
      state.atlasKnowledge[neighborId].mapped = true
    }
  }

  emit(state, 'region_visited', regionId)
  log(state, 'info', `Explored ${def.name}. Recorded in the World Atlas.`)
}

export function discoverLandmark(state: GameState, regionId: string, landmarkId: string): void {
  const def = REGIONS[regionId]
  const atlas = REGION_ATLAS_DATA[regionId]
  if (!def || !atlas) return

  const landmarkDef = atlas.landmarks.find((lm) => lm.id === landmarkId)
  if (!landmarkDef) return

  ensureAtlasKnowledge(state)
  const knowledge = state.atlasKnowledge[regionId]
  if (!knowledge) return

  // Idempotent: return early if already discovered
  if (knowledge.discoveredLandmarkIds.includes(landmarkId)) return

  knowledge.discoveredLandmarkIds.push(landmarkId)
  knowledge.visited = true
  knowledge.mapped = true
  if (knowledge.firstVisitedTick === null) {
    knowledge.firstVisitedTick = state.tick
  }

  emit(state, 'landmark_discovered', regionId, landmarkId)
  log(state, 'good', `Discovered landmark: ${landmarkDef.name} in ${def.name}.`)
}

export function observePhenomenon(state: GameState, regionId: string, phenomenonId: string): void {
  const def = REGIONS[regionId]
  if (!def) return
  if (!isPhenomenonOfRegion(regionId, phenomenonId)) return
  const phenomenon = PHENOMENA.find((p) => p.id === phenomenonId)
  if (!phenomenon) return

  ensureAtlasKnowledge(state)
  const knowledge = state.atlasKnowledge[regionId]
  if (!knowledge) return
  if (!knowledge.observedPhenomenonIds) knowledge.observedPhenomenonIds = []

  // Idempotent: a repeated observation adds nothing.
  if (knowledge.observedPhenomenonIds.includes(phenomenonId)) return

  knowledge.observedPhenomenonIds.push(phenomenonId)
  knowledge.visited = true
  knowledge.mapped = true
  if (knowledge.firstVisitedTick === null) {
    knowledge.firstVisitedTick = state.tick
  }

  emit(state, 'phenomenon_observed', regionId, phenomenonId)
  log(state, 'good', `Observed ${phenomenon.name} in ${def.name}.`)
}

export function completeExpeditionActivity(state: GameState, regionId: string, activityId: string): void {
  const def = REGIONS[regionId]
  if (!def) return
  if (!isActivityOfRegion(regionId, activityId)) return
  const activity = EXPEDITION_ACTIVITIES.find((a) => a.id === activityId)
  if (!activity) return

  ensureAtlasKnowledge(state)
  const knowledge = state.atlasKnowledge[regionId]
  if (!knowledge) return
  if (!knowledge.completedActivityIds) knowledge.completedActivityIds = []

  // Idempotent: a repeated completion adds nothing.
  if (knowledge.completedActivityIds.includes(activityId)) return

  knowledge.completedActivityIds.push(activityId)
  knowledge.visited = true
  knowledge.mapped = true
  if (knowledge.firstVisitedTick === null) {
    knowledge.firstVisitedTick = state.tick
  }

  emit(state, 'activity_completed', regionId, activityId, {
    activityName: activity.name,
    kind: activity.kind,
    knowledgeTag: activity.knowledgeTag,
  })
  log(state, 'good', `✦ Solved mystery: "${activity.name}" in ${def.name}! [${activity.knowledgeTag}]`)
}
