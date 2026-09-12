import { describe, expect, it } from 'vitest'
import { createDefaultSanctuaryLayout } from '@/core/state/sanctuaryLayout'
import type { SanctuaryLayoutState } from '@/core/types'
import { validateSnapshotLayout } from './snapshotValidation'

describe('snapshotValidation', () => {
  it('passes a standard layout snapshot with unlocked props', () => {
    const layout = createDefaultSanctuaryLayout()
    const result = validateSnapshotLayout(layout, 0, {})

    expect(result.valid).toBe(true)
    expect(result.warnings).toHaveLength(0)
    expect(result.retainedObjectCount).toBe(layout.objects.length)
    expect(result.omittedObjectCount).toBe(0)
  })

  it('omits props not present in the catalog and reports warnings', () => {
    const layout: SanctuaryLayoutState = {
      objects: [
        {
          id: 'obj_custom',
          propId: 'prop.nonexistent_monument',
          position: [0, 0, 0],
          rotationY: 0,
          category: 'scenery',
          label: 'Old Relic',
        },
      ],
      storage: {},
    }

    const result = validateSnapshotLayout(layout, 0, {})
    expect(result.valid).toBe(false)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]?.reason).toBe('missing_from_catalog')
    expect(result.filteredLayout.objects).toHaveLength(0)
  })

  it('preserves valid objects while stripping invalid ones', () => {
    const layout: SanctuaryLayoutState = {
      objects: [
        {
          id: 'torch_1',
          propId: 'prop.torch',
          position: [0, 0, 0],
          rotationY: 0,
          category: 'utility',
          label: 'Standing Torch',
        },
        {
          id: 'invalid_1',
          propId: 'prop.ghost_ruin_unknown',
          position: [5, 0, 5],
          rotationY: 0,
          category: 'scenery',
          label: 'Unknown Ruin',
        },
      ],
      storage: { 'prop.torch': 5 },
    }

    const result = validateSnapshotLayout(layout, 0, {})
    expect(result.valid).toBe(false)
    expect(result.warnings).toHaveLength(1)
    expect(result.retainedObjectCount).toBe(1)
    expect(result.filteredLayout.objects[0]?.id).toBe('torch_1')
    expect(result.filteredLayout.storage).toEqual({ 'prop.torch': 5 })
  })
})
