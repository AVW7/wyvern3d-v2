import type {
  GameEvent,
  GameState,
  LandmarkDef,
  SettlementCondition,
  SettlementTrend,
  WyvernSpecies,
} from '../types'
import { REGIONS, REGION_LIST } from '../data/regions'
import { SPECIES } from '../data/species'
import { UNITS } from '../data/units'
import {
  ensureAtlasKnowledge,
  getCompletedActivities,
  getDiscoveredLandmarks,
  getKnownRegionSummary,
  getKnownRegionTags,
  getKnownRegionThreatNotes,
  getObservedPhenomena,
  isRegionMapped,
  isRegionVisited,
} from './atlasKnowledge'
import { yieldMultiplier } from '../systems/economy'
import { regionSettlementReading } from './settlement'

export function calculateGarrisonStrength(garrison: { unitId: string; strength: number }[]): number {
  let total = 0
  for (const item of garrison) {
    const unitDef = UNITS[item.unitId]
    if (unitDef) {
      total += (unitDef.attack + unitDef.defense) * item.strength
    } else {
      total += item.strength
    }
  }
  return total
}

export interface RouteExplanation {
  targetRegionId: string
  status: 'controlled' | 'adjacent' | 'reachable' | 'isolated'
  /** Ordered list of region IDs from an owned origin to the target. */
  path: string[]
  /** Intermediate enemy/neutral regions that must be captured before target is attackable. */
  blockers: string[]
  summary: string
}

/**
 * Finds the shortest path from any player-owned territory to the target region.
 * Uses pure breadth-first search on the region adjacency graph.
 */
export function findShortestPathToRegion(
  state: GameState,
  targetRegionId: string,
): RouteExplanation {
  const targetDef = REGIONS[targetRegionId]
  if (!targetDef) {
    return {
      targetRegionId,
      status: 'isolated',
      path: [],
      blockers: [],
      summary: 'Unknown region.',
    }
  }

  const regionState = state.regions[targetRegionId]
  const isOwned = regionState?.owner === 'player'
  if (isOwned) {
    return {
      targetRegionId,
      status: 'controlled',
      path: [targetRegionId],
      blockers: [],
      summary: 'Controlled territory in your realm.',
    }
  }

  // Owned regions set as starting points for BFS
  const playerOwned = new Set<string>()
  for (const def of REGION_LIST) {
    if (state.regions[def.id]?.owner === 'player' || (!state.regions[def.id] && def.starting)) {
      playerOwned.add(def.id)
    }
  }

  // Check if directly attackable
  const directNeighbor = targetDef.neighbors.find((n) => playerOwned.has(n))
  if (directNeighbor) {
    const neighborName = REGIONS[directNeighbor]?.name ?? directNeighbor
    return {
      targetRegionId,
      status: 'adjacent',
      path: [directNeighbor, targetRegionId],
      blockers: [],
      summary: `Directly attackable from ${neighborName}.`,
    }
  }

  // Multi-hop BFS from all player owned territories
  const queue: { current: string; path: string[] }[] = []
  const visited = new Set<string>()

  for (const ownedId of playerOwned) {
    queue.push({ current: ownedId, path: [ownedId] })
    visited.add(ownedId)
  }

  let shortestPath: string[] | null = null

  while (queue.length > 0) {
    const item = queue.shift()!
    const def = REGIONS[item.current]
    if (!def) continue

    if (item.current === targetRegionId) {
      shortestPath = item.path
      break
    }

    for (const neighborId of def.neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId)
        queue.push({
          current: neighborId,
          path: [...item.path, neighborId],
        })
      }
    }
  }

  if (!shortestPath || shortestPath.length <= 1) {
    return {
      targetRegionId,
      status: 'isolated',
      path: [],
      blockers: [],
      summary: 'No charted travel route connected to your realm.',
    }
  }

  // Blockers are all regions on the path between the owned start and the target (excluding start and target)
  const blockers = shortestPath.slice(1, -1)
  const blockerNames = blockers.map((id) => REGIONS[id]?.name ?? id)

  const summary =
    blockerNames.length > 0
      ? `Requires conquering ${blockerNames.join(' then ')} to open attack route.`
      : 'Frontier path available.'

  return {
    targetRegionId,
    status: 'reachable',
    path: shortestPath,
    blockers,
    summary,
  }
}

export interface RegionDossierHistoryEntry {
  seq: number
  tick: number
  kind: string
  message: string
}

/**
 * Returns human-readable representation of a GameEvent in the context of a region.
 */
export function formatRegionalEvent(event: GameEvent, regionId: string): string {
  const regName = REGIONS[regionId]?.name ?? regionId
  switch (event.kind) {
    case 'region_visited':
      return `First expedition arrived in ${regName}.`
    case 'landmark_discovered': {
      const lmId = event.objectId ?? ''
      const lmName = REGIONS[regionId]?.atlas?.landmarks.find((l) => l.id === lmId)?.name ?? lmId
      return `Landmark discovered: ${lmName}.`
    }
    case 'phenomenon_observed':
      return `Environmental phenomenon recorded in ${regName}.`
    case 'settlement_condition_changed': {
      const to = (event.payload?.to as string) ?? 'unknown'
      const from = (event.payload?.from as string) ?? 'unknown'
      const settlement = REGIONS[regionId]?.settlement?.name ?? regName
      return to === 'revolting'
        ? `${settlement} has turned openly defiant.`
        : `${settlement} shifted from ${from} to ${to}.`
    }
    case 'activity_completed': {
      const actName = (event.payload?.activityName as string) ?? 'Expedition activity'
      const tag = (event.payload?.knowledgeTag as string) ?? 'Mystery Solved'
      return `Expedition completed: ${actName} [${tag}].`
    }
    default:
      return `${event.kind.replace(/_/g, ' ')} recorded (tick ${event.tick}).`
  }
}

/**
 * Returns recent typed events relevant to a specific region.
 * Bounded to at most 20 entries, sorted newest first.
 */
export function getRegionEventHistory(
  state: GameState,
  regionId: string,
): RegionDossierHistoryEntry[] {
  const events = state.events ?? []

  const relevant = events.filter((e) => {
    if (e.subjectId === regionId || e.objectId === regionId) return true
    if (e.payload && typeof e.payload.regionId === 'string' && e.payload.regionId === regionId) {
      return true
    }
    return false
  })

  // Return the 20 most recent, formatted
  return relevant
    .slice(-20)
    .reverse()
    .map((e) => ({
      seq: e.seq,
      tick: e.tick,
      kind: e.kind,
      message: formatRegionalEvent(e, regionId),
    }))
}

export interface RegionDossierData {
  id: string
  name: string
  tier: number
  biome: string
  owner: 'player' | 'enemy'
  isOwned: boolean
  isAttackable: boolean
  isMapped: boolean
  isVisited: boolean
  summary: string | null
  climateTags: string[]
  terrainTags: string[]
  threatNotes: string | null
  route: RouteExplanation
  nativeSpecies: WyvernSpecies | null
  landmarks: {
    discovered: LandmarkDef[]
    totalCount: number
    discoveredCount: number
  }
  observedPhenomena: { id: string; name: string; description: string; kind: string }[]
  completedActivities: {
    id: string
    name: string
    description: string
    kind: string
    objective: string
    knowledgeTag: string
    themeColor: string
  }[]
  yields: {
    base: Record<string, number>
    effective: Record<string, number>
    unrestMultiplier: number
  }
  garrison: {
    units: { unitId: string; name: string; count: number; power: number }[]
    totalStrength: number
  }
  unrest: {
    value: number
    level: 'stable' | 'moderate' | 'critical'
  }
  /** Null for a region authored as uninhabited. */
  settlement: {
    name: string
    tier: number
    condition: SettlementCondition
    trend: SettlementTrend
  } | null
  history: RegionDossierHistoryEntry[]
}

/**
 * Pure selector generating complete, knowledge-gated dossier data for a region.
 */
export function getRegionDossier(state: GameState, regionId: string): RegionDossierData | null {
  ensureAtlasKnowledge(state)
  const def = REGIONS[regionId]
  if (!def) return null

  const regionState = state.regions[regionId]
  const isOwned = regionState?.owner === 'player'
  const isAttackable = !isOwned && def.neighbors.some((n) => state.regions[n]?.owner === 'player')
  const isMapped = isRegionMapped(state, regionId)
  const isVisited = isRegionVisited(state, regionId)

  const summary = getKnownRegionSummary(state, regionId)
  const tags = getKnownRegionTags(state, regionId)
  const threatNotes = getKnownRegionThreatNotes(state, regionId)
  const route = findShortestPathToRegion(state, regionId)

  // Species
  const speciesDef = isMapped ? (SPECIES[def.nativeSpecies] ?? null) : null

  // Landmarks
  const discoveredLandmarks = getDiscoveredLandmarks(state, regionId)
  const totalLandmarks = def.atlas?.landmarks.length ?? 0

  // Phenomena
  const observedPhenomena = getObservedPhenomena(state, regionId).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    kind: p.kind,
  }))

  // Completed Activities
  const completedActivities = getCompletedActivities(state, regionId).map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    kind: a.kind,
    objective: a.objective,
    knowledgeTag: a.knowledgeTag,
    themeColor: a.themeColor,
  }))

  // Yields
  const unrest = regionState?.unrest ?? 0
  const mult = yieldMultiplier(unrest)
  const reading = regionSettlementReading(state, regionId)
  const effectiveYields: Record<string, number> = {}
  for (const [k, v] of Object.entries(def.yields)) {
    effectiveYields[k] = Math.round((v ?? 0) * mult * 10) / 10
  }

  // Garrison
  const rawGarrison = regionState?.garrison ?? def.garrison
  const totalStrength = calculateGarrisonStrength(rawGarrison)
  const garrisonUnits = rawGarrison.map((g) => {
    const unitDef = UNITS[g.unitId]
    const power = unitDef ? (unitDef.attack + unitDef.defense) * g.strength : g.strength
    return {
      unitId: g.unitId,
      name: unitDef?.name ?? g.unitId,
      count: g.strength,
      power,
    }
  })

  // Unrest level
  const unrestLevel: 'stable' | 'moderate' | 'critical' =
    unrest > 65 ? 'critical' : unrest > 30 ? 'moderate' : 'stable'

  // History
  const history = getRegionEventHistory(state, regionId)

  return {
    id: def.id,
    name: def.name,
    tier: def.tier,
    biome: def.biome,
    owner: isOwned ? 'player' : 'enemy',
    isOwned,
    isAttackable,
    isMapped,
    isVisited,
    summary,
    climateTags: tags?.climate ?? [],
    terrainTags: tags?.terrain ?? [],
    threatNotes,
    route,
    nativeSpecies: speciesDef,
    landmarks: {
      discovered: discoveredLandmarks,
      totalCount: totalLandmarks,
      discoveredCount: discoveredLandmarks.length,
    },
    observedPhenomena,
    completedActivities,
    yields: {
      base: { ...def.yields },
      effective: effectiveYields,
      unrestMultiplier: mult,
    },
    garrison: {
      units: garrisonUnits,
      totalStrength,
    },
    unrest: {
      value: Math.round(unrest),
      level: unrestLevel,
    },
    settlement: def.settlement && reading
      ? {
          name: def.settlement.name,
          tier: def.settlement.tier,
          // Same derivation the world map draws, so the two can never disagree.
          condition: reading.condition,
          trend: reading.trend,
        }
      : null,
    history,
  }
}
