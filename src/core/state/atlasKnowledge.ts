import type { GameState, LandmarkDef, RegionKnowledge } from '../types'
import { REGIONS, REGION_LIST } from '../data/regions'
import { REGION_ATLAS_DATA } from '../data/atlas'

/**
 * Ensures that `state.atlasKnowledge` is populated for all known regions.
 * Pure, deterministic initialization without RNG or side effects.
 */
export function ensureAtlasKnowledge(state: GameState): GameState {
  if (!state.atlasKnowledge) {
    state.atlasKnowledge = {}
  }

  for (const def of REGION_LIST) {
    if (!state.atlasKnowledge[def.id]) {
      const regionState = state.regions[def.id]
      const isOwned = regionState?.owner === 'player'
      const isStarting = !!def.starting
      const visited = isOwned || isStarting
      // Starting or owned regions are mapped; neighbors of owned regions are mapped
      const mapped =
        visited ||
        def.neighbors.some((n) => state.regions[n]?.owner === 'player' || REGIONS[n]?.starting)

      state.atlasKnowledge[def.id] = {
        regionId: def.id,
        mapped,
        visited,
        discoveredLandmarkIds: [],
        firstVisitedTick: visited ? (regionState?.conqueredAtTick ?? 0) : null,
      }
    }
  }

  return state
}

/**
 * Returns the knowledge record for a specific region.
 */
export function getRegionKnowledge(state: GameState, regionId: string): RegionKnowledge | null {
  ensureAtlasKnowledge(state)
  return state.atlasKnowledge[regionId] ?? null
}

/**
 * True if the region has been mapped on the world chart.
 */
export function isRegionMapped(state: GameState, regionId: string): boolean {
  ensureAtlasKnowledge(state)
  return !!state.atlasKnowledge[regionId]?.mapped
}

/**
 * True if the player has physically visited or conquered the region.
 */
export function isRegionVisited(state: GameState, regionId: string): boolean {
  ensureAtlasKnowledge(state)
  return !!state.atlasKnowledge[regionId]?.visited
}

/**
 * Returns the list of discovered landmarks for a region according to player knowledge.
 */
export function getDiscoveredLandmarks(state: GameState, regionId: string): LandmarkDef[] {
  ensureAtlasKnowledge(state)
  const knowledge = state.atlasKnowledge[regionId]
  if (!knowledge) return []

  const atlas = REGION_ATLAS_DATA[regionId]
  if (!atlas) return []

  const discoveredSet = new Set(knowledge.discoveredLandmarkIds)
  return atlas.landmarks.filter((lm) => discoveredSet.has(lm.id))
}

/**
 * Returns the region summary if mapped; returns a locked message or null if unmapped.
 */
export function getKnownRegionSummary(state: GameState, regionId: string): string | null {
  if (!isRegionMapped(state, regionId)) return null
  return REGION_ATLAS_DATA[regionId]?.summary ?? null
}

/**
 * Returns climate and terrain tags if the region is mapped.
 */
export function getKnownRegionTags(
  state: GameState,
  regionId: string,
): { climate: string[]; terrain: string[] } | null {
  if (!isRegionMapped(state, regionId)) return null
  const atlas = REGION_ATLAS_DATA[regionId]
  if (!atlas) return null
  return {
    climate: [...atlas.climateTags],
    terrain: [...atlas.terrainTags],
  }
}

/**
 * Returns threat notes if the region has been visited or is held by player.
 */
export function getKnownRegionThreatNotes(state: GameState, regionId: string): string | null {
  if (!isRegionVisited(state, regionId)) return null
  return REGION_ATLAS_DATA[regionId]?.threatNotes ?? null
}

export interface AtlasCompletionStats {
  mappedRegions: number
  visitedRegions: number
  totalRegions: number
  discoveredLandmarks: number
  totalLandmarks: number
  percent: number
}

/**
 * Pure calculation of world atlas exploration progress.
 */
export function getAtlasCompletionStats(state: GameState): AtlasCompletionStats {
  ensureAtlasKnowledge(state)
  const totalRegions = REGION_LIST.length
  let mappedRegions = 0
  let visitedRegions = 0
  let discoveredLandmarks = 0
  let totalLandmarks = 0

  for (const def of REGION_LIST) {
    const knowledge = state.atlasKnowledge[def.id]
    if (knowledge?.mapped) mappedRegions += 1
    if (knowledge?.visited) visitedRegions += 1
    if (knowledge) discoveredLandmarks += knowledge.discoveredLandmarkIds.length

    const atlas = REGION_ATLAS_DATA[def.id]
    if (atlas) totalLandmarks += atlas.landmarks.length
  }

  // Weight: visited regions (50%) + discovered landmarks (50%)
  const regionScore = totalRegions > 0 ? visitedRegions / totalRegions : 0
  const landmarkScore = totalLandmarks > 0 ? discoveredLandmarks / totalLandmarks : 0
  const percent = Math.round(((regionScore + landmarkScore) / 2) * 100)

  return {
    mappedRegions,
    visitedRegions,
    totalRegions,
    discoveredLandmarks,
    totalLandmarks,
    percent,
  }
}
