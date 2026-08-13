import { GameState } from '../types'
import { REGION_LIST } from '../data/regions'
import { devStore } from '../../state/devStore'

export type RegionVisibility = 'held' | 'frontier' | 'known' | 'rumoured'

export function regionVisibility(state: GameState, id: string): RegionVisibility {
  if (devStore.revealAll) {
    const isPlayer = state.regions[id]?.owner === 'player'
    return isPlayer ? 'held' : 'frontier'
  }

  const heldIds = new Set(
    Object.values(state.regions)
      .filter((r) => r.owner === 'player')
      .map((r) => r.id)
  )

  if (heldIds.has(id)) return 'held'

  const queue: { current: string; dist: number }[] = []
  const visited = new Set<string>()

  for (const hId of heldIds) {
    queue.push({ current: hId, dist: 0 })
    visited.add(hId)
  }

  let minDistance = Infinity

  while (queue.length > 0) {
    const { current, dist } = queue.shift()!
    if (current === id) {
      minDistance = dist
      break
    }

    const node = REGION_LIST.find((r) => r.id === current)
    if (!node) continue

    for (const nId of node.neighbors) {
      if (!visited.has(nId)) {
        visited.add(nId)
        queue.push({ current: nId, dist: dist + 1 })
      }
    }
  }

  if (minDistance === 1) return 'frontier'
  if (minDistance === 2) return 'known'
  return 'rumoured'
}

export function visibilityMap(state: GameState): Record<string, RegionVisibility> {
  const map: Record<string, RegionVisibility> = {}
  for (const def of REGION_LIST) {
    map[def.id] = regionVisibility(state, def.id)
  }
  return map
}
