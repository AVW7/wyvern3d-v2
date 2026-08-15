import { BIOME_PALETTES } from '../BiomeWorld/atmosphere/biomePalettes'
import type { MapEdge, MapNode } from './mapGraph'
import type { GameState } from '@/core/types'
import { getRegionLayerValue, type AtlasLayerId } from '@/core/state/atlasLayers'
import { SPECIES } from '@/core/data/species'

/**
 * The one palette the world map reads from. Node badges, ring glows, supply
 * lines and the region inspector all describe the same three states, so they
 * all resolve their colour here rather than each hard-coding a hex.
 */
export const MAP_STATUS_COLORS = {
  held: '#4ade80', // emerald
  reachable: '#fbbf24', // amber
  locked: '#64748b', // slate
} as const

export type RegionStatus = keyof typeof MAP_STATUS_COLORS

export function nodeRadius(tier: number): number {
  return 3.0 + tier * 0.6
}

/** Height of a region's pedestal above the terrain crest it stands on. */
export function nodePedestalHeight(tier: number): number {
  return 0.8 + tier * 0.9
}

export function regionStatus(owner: 'player' | 'enemy', isAttackable: boolean): RegionStatus {
  if (owner === 'player') return 'held'
  if (isAttackable) return 'reachable'
  return 'locked'
}

export function statusColor(owner: 'player' | 'enemy', isAttackable: boolean): string {
  return MAP_STATUS_COLORS[regionStatus(owner, isAttackable)]
}

/** Edge statuses use the graph's vocabulary; map them onto the same palette. */
export function edgeColor(status: MapEdge['status']): string {
  if (status === 'owned') return MAP_STATUS_COLORS.held
  if (status === 'attackable') return MAP_STATUS_COLORS.reachable
  return MAP_STATUS_COLORS.locked
}

export function nodeGroundColor(biome: string): string {
  const palette = BIOME_PALETTES[biome]
  return palette?.groundColor ?? '#475569'
}

/**
 * Computes the emblem ring accent color based on the active strategic layer.
 */
export function layerEmblemColor(
  layer: AtlasLayerId,
  node: MapNode,
  state: GameState,
): string {
  if (layer === 'political') {
    return SPECIES[node.def.nativeSpecies]?.color ?? '#888'
  }
  const layerVal = getRegionLayerValue(state, node.def.id, layer)
  return layerVal.color
}

/**
 * Returns badge label and color for the region under the active layer.
 */
export function layerBadgeInfo(
  layer: AtlasLayerId,
  node: MapNode,
  state: GameState,
): { text: string; color: string } {
  const status = regionStatus(node.owner, node.attackable)
  const defaultBadgeColor = statusColor(node.owner, node.attackable)

  if (layer === 'political') {
    return {
      text: status === 'locked' ? `LOCKED • TIER ${node.def.tier}` : status.toUpperCase(),
      color: defaultBadgeColor,
    }
  }

  const layerVal = getRegionLayerValue(state, node.def.id, layer)
  return {
    text: layerVal.displayValue.toUpperCase(),
    color: layerVal.color,
  }
}

