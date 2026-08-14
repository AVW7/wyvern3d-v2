import { describe, expect, it } from 'vitest'
import {
  nodeRadius,
  nodePedestalHeight,
  statusColor,
  regionStatus,
  edgeColor,
  MAP_STATUS_COLORS,
  nodeGroundColor,
} from './nodeVisuals'

describe('nodeVisuals', () => {
  it('computes node radius by tier', () => {
    expect(nodeRadius(0)).toBe(3.0)
    expect(nodeRadius(4)).toBe(5.4)
  })

  it('returns distinct status colors', () => {
    expect(statusColor('player', false)).toBe('#4ade80')
    expect(statusColor('enemy', true)).toBe('#fbbf24')
    expect(statusColor('enemy', false)).toBe('#64748b')
  })

  it('names the same three states as the region inspector', () => {
    expect(regionStatus('player', false)).toBe('held')
    expect(regionStatus('enemy', true)).toBe('reachable')
    expect(regionStatus('enemy', false)).toBe('locked')
  })

  it('resolves edge colors from the same palette as node badges', () => {
    expect(edgeColor('owned')).toBe(MAP_STATUS_COLORS.held)
    expect(edgeColor('attackable')).toBe(MAP_STATUS_COLORS.reachable)
    expect(edgeColor('locked')).toBe(MAP_STATUS_COLORS.locked)
  })

  it('grows the pedestal with tier', () => {
    expect(nodePedestalHeight(0)).toBeCloseTo(0.8)
    expect(nodePedestalHeight(4)).toBeCloseTo(4.4)
  })

  it('returns ground color from BIOME_PALETTES for valid biomes', () => {
    expect(nodeGroundColor('valley')).toBeDefined()
    expect(nodeGroundColor('valley')).not.toBe('#475569')
  })
})
