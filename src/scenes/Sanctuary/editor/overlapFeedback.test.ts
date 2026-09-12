import { describe, expect, it } from 'vitest'
import type { SanctuaryPlacedObject } from '@/core/types'
import {
  checkBoundsValidity,
  checkPlacementOverlap,
  getObjectFootprintRadius,
} from './overlapFeedback'

describe('overlapFeedback', () => {
  const mockObjects: SanctuaryPlacedObject[] = [
    {
      id: 'warTable',
      propId: 'prop.warTable',
      position: [0, 0, -30],
      rotationY: 0,
      category: 'structure',
      label: 'War Table',
      radius: 3.5,
    },
    {
      id: 'chest_1',
      propId: 'prop.chest',
      position: [10, 0, 10],
      rotationY: 0,
      category: 'furniture',
      label: 'Iron Chest',
    },
  ]

  it('calculates correct footprint radius from catalog and explicit radius', () => {
    expect(getObjectFootprintRadius('prop.warTable', undefined)).toBe(3.5)
    expect(getObjectFootprintRadius('prop.chest', undefined)).toBe(1.2)
    expect(getObjectFootprintRadius('prop.chest', 2.0)).toBe(2.0)
    expect(getObjectFootprintRadius('unknown.prop', undefined)).toBe(1.2)
  })

  it('rejects candidate outside circular sanctuary boundary', () => {
    expect(checkBoundsValidity([0, 0, 50], 40)).toBe(false)
    expect(checkBoundsValidity([0, 0, 30], 40)).toBe(true)

    const result = checkPlacementOverlap(
      { propId: 'prop.torch', position: [45, 0, 45] },
      mockObjects,
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('Out of sanctuary bounds')
  })

  it('detects overlap when placing too close to an existing object', () => {
    const candidate = {
      propId: 'prop.torch',
      position: [0.5, 0, -30.5] as const, // Right on top of War Table at [0, 0, -30]
    }
    const result = checkPlacementOverlap(candidate, mockObjects)
    expect(result.valid).toBe(false)
    expect(result.overlappingIds).toContain('warTable')
  })

  it('allows placement when safely separated from existing objects', () => {
    const candidate = {
      propId: 'prop.torch',
      position: [5, 0, 0] as const,
    }
    const result = checkPlacementOverlap(candidate, mockObjects)
    expect(result.valid).toBe(true)
    expect(result.overlappingIds).toHaveLength(0)
  })

  it('ignores candidate self when moving an existing object', () => {
    const movingWarTable = {
      id: 'warTable',
      propId: 'prop.warTable',
      position: [0.2, 0, -29.8] as const, // Minor shift of self
    }
    const result = checkPlacementOverlap(movingWarTable, mockObjects)
    expect(result.valid).toBe(true)
    expect(result.overlappingIds).not.toContain('warTable')
  })
})
