import { describe, expect, it } from 'vitest'
import { nodeRadius, statusColor, nodeGroundColor } from './nodeVisuals'

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

  it('returns ground color from BIOME_PALETTES for valid biomes', () => {
    expect(nodeGroundColor('valley')).toBeDefined()
    expect(nodeGroundColor('valley')).not.toBe('#475569')
  })
})
