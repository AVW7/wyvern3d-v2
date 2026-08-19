import { GameState, RegionDef, SettlementReading } from '../../core/types'
import { REGIONS, REGION_LIST } from '../../core/data/regions'
import { isAttackable } from '../../core/state/game'
import { settlementReading, unrestModifiers } from '../../core/state/settlement'
import { calculateGarrisonStrength } from '../../core/state/atlasDossier'

export { calculateGarrisonStrength }

export interface MapNode {
  id: string
  def: RegionDef
  owner: 'player' | 'enemy'
  unrest: number
  garrison: { unitId: string; strength: number }[]
  garrisonStrength: number
  attackable: boolean
  eggsAvailable: number
  /**
   * Derived settlement reading. Note this is NOT `garrisonStrength` above —
   * that is the force defending the region, whereas unrest is suppressed by the
   * player's own squads stationed there, which is what `regionTick` reads.
   */
  settlement: SettlementReading
}

export interface MapEdge {
  key: string
  a: string
  b: string
  status: 'owned' | 'attackable' | 'locked'
}

export function buildMapGraph(state: GameState): { nodes: Record<string, MapNode>; edges: MapEdge[] } {
  const nodes: Record<string, MapNode> = {}
  const { unrestRateMultiplier, suppressionMultiplier } = unrestModifiers(state)
  // One pass over squads instead of one per region.
  const stationed: Record<string, number> = {}
  for (const squad of Object.values(state.squads ?? {})) {
    if (squad.stationedAt) stationed[squad.stationedAt] = (stationed[squad.stationedAt] ?? 0) + squad.strength
  }
  for (const def of REGION_LIST) {
    const rState = state.regions[def.id]
    const owner = rState?.owner ?? (def.starting ? 'player' : 'enemy')
    const unrest = rState?.unrest ?? 0
    const garrison = rState?.garrison ?? def.garrison.map((g) => ({ ...g }))
    const eggsAvailable = rState?.eggsAvailable ?? (def.starting ? 0 : 2)
    const attackable = isAttackable(state, def.id)
    const garrisonStrength = calculateGarrisonStrength(garrison)

    nodes[def.id] = {
      id: def.id,
      def,
      owner,
      unrest,
      garrison,
      garrisonStrength,
      attackable,
      eggsAvailable,
      settlement: settlementReading(
        owner,
        def.starting ? 0 : unrest,
        stationed[def.id] ?? 0,
        unrestRateMultiplier,
        suppressionMultiplier,
      ),
    }
  }

  const edgesMap = new Map<string, MapEdge>()
  for (const def of REGION_LIST) {
    for (const nId of def.neighbors) {
      const edgeKey = def.id < nId ? `${def.id}:${nId}` : `${nId}:${def.id}`
      if (edgesMap.has(edgeKey)) continue

      const aNode = nodes[def.id]
      const bNode = nodes[nId]
      if (!aNode || !bNode) continue

      let status: 'owned' | 'attackable' | 'locked' = 'locked'
      if (aNode.owner === 'player' && bNode.owner === 'player') {
        status = 'owned'
      } else if (
        (aNode.owner === 'player' && bNode.attackable) ||
        (bNode.owner === 'player' && aNode.attackable)
      ) {
        status = 'attackable'
      }

      edgesMap.set(edgeKey, {
        key: edgeKey,
        a: def.id < nId ? def.id : nId,
        b: def.id < nId ? nId : def.id,
        status,
      })
    }
  }

  return { nodes, edges: Array.from(edgesMap.values()) }
}

export function edgePoints(edge: MapEdge): [{ x: number; z: number }, { x: number; z: number }] {
  const regA = REGIONS[edge.a]
  const regB = REGIONS[edge.b]
  const posA = regA ? regA.position : { x: 0, z: 0 }
  const posB = regB ? regB.position : { x: 0, z: 0 }
  return [posA, posB]
}

export function mapSignature(state: GameState): string {
  const parts: string[] = []
  for (const def of REGION_LIST) {
    const r = state.regions[def.id]
    if (!r) continue
    const strength = calculateGarrisonStrength(r.garrison)
    const unrestBucket = Math.round(r.unrest / 5)
    parts.push(`${def.id}:${r.owner}:${unrestBucket}:${strength}`)
  }
  return parts.join('|')
}

export function pathToRegion(state: GameState, targetId: string): string[] | null {
  const targetDef = REGIONS[targetId]
  if (!targetDef) return null

  const heldIds = new Set(
    Object.values(state.regions)
      .filter((r) => r.owner === 'player')
      .map((r) => r.id)
  )

  if (heldIds.has(targetId)) {
    return [targetId]
  }

  const queue: { current: string; path: string[] }[] = []
  const visited = new Set<string>()

  for (const hId of heldIds) {
    queue.push({ current: hId, path: [hId] })
    visited.add(hId)
  }

  while (queue.length > 0) {
    const { current, path } = queue.shift()!
    if (current === targetId) {
      return path
    }

    const neighbors = REGIONS[current]?.neighbors ?? []
    for (const nId of neighbors) {
      if (!visited.has(nId)) {
        visited.add(nId)
        queue.push({ current: nId, path: [...path, nId] })
      }
    }
  }

  return null
}
