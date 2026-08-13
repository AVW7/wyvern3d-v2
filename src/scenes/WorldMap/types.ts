import type { Vector3 } from 'three'
import type { RegionDef } from '@/core/types'

export const OWNED_COLOR = '#4e8f5a'
export const ATTACKABLE_COLOR = '#e07a38'
export const LOCKED_COLOR = '#4a4e57'

export const BIOME_COLORS: Record<string, string> = {
  valley: '#3f7e4a',
  coast: '#2d8494',
  forest: '#276936',
  marsh: '#316e60',
  moor: '#736244',
  highland: '#7d684b',
  mountain: '#5b616e',
  cavern: '#6a3f8c',
  jungle: '#1d7a3e',
  grove: '#5f7d3a',
  swamp: '#356147',
  ashland: '#753b30',
  tundra: '#437585',
  barrens: '#665a4e',
  spire: '#541f33',
}

export interface EdgeInfo {
  key: string
  points: [Vector3, Vector3]
  status: 'owned' | 'attackable' | 'locked'
}

export interface RegionNodeProps {
  def: RegionDef
  color: string
  biomeColor: string
  owned: boolean
  attackable: boolean
  unrest: number
  selected: boolean
  isHovered: boolean
  onPointerOver: () => void
  onPointerOut: () => void
  onSelect: () => void
}

export interface RegionHoverCardProps {
  def: RegionDef
  state?: { owner: string; unrest: number }
}
