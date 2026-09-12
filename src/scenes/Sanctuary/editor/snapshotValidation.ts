import { PROP_CATALOG, isPropUnlocked } from '@/core/state/sanctuaryLayout'
import type { SanctuaryLayoutState, SanctuaryPlacedObject } from '@/core/types'

export interface SnapshotWarning {
  propId: string
  label: string
  reason: 'missing_from_catalog' | 'locked'
  details: string
}

export interface SnapshotValidationResult {
  valid: boolean
  filteredLayout: SanctuaryLayoutState
  warnings: SnapshotWarning[]
  retainedObjectCount: number
  omittedObjectCount: number
}

/**
 * Validates a restored sanctuary snapshot against current catalog definitions and unlock progression.
 * Omitted items are reported as warnings and excluded from the restored layout without aborting the load.
 */
export function validateSnapshotLayout(
  snapshotLayout: SanctuaryLayoutState,
  completedDuties: number = 0,
  currentStorage: Record<string, number> = {},
): SnapshotValidationResult {
  const warnings: SnapshotWarning[] = []
  const validObjects: SanctuaryPlacedObject[] = []

  for (const obj of snapshotLayout.objects) {
    const catalogEntry = PROP_CATALOG[obj.propId]
    if (!catalogEntry) {
      warnings.push({
        propId: obj.propId,
        label: obj.label || obj.propId,
        reason: 'missing_from_catalog',
        details: `Prop '${obj.propId}' is no longer present in the building catalog.`,
      })
      continue
    }

    const unlocked = isPropUnlocked(obj.propId, completedDuties, currentStorage, snapshotLayout.objects)
    if (!unlocked) {
      warnings.push({
        propId: obj.propId,
        label: catalogEntry.label,
        reason: 'locked',
        details: `Requires ${catalogEntry.requiredDuties} completed duties to place.`,
      })
      continue
    }

    validObjects.push({
      ...obj,
      position: [...obj.position] as [number, number, number],
    })
  }

  const filteredLayout: SanctuaryLayoutState = {
    objects: validObjects,
    storage: { ...(snapshotLayout.storage ?? currentStorage) },
  }

  return {
    valid: warnings.length === 0,
    filteredLayout,
    warnings,
    retainedObjectCount: validObjects.length,
    omittedObjectCount: warnings.length,
  }
}
