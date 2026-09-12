import type { SanctuaryPlacedObject } from '@/core/types'
import { PROP_CATALOG, type PropCatalogEntry } from '@/core/state/sanctuaryLayout'

export interface PlacementCandidate {
  id?: string
  propId: string
  position: readonly [number, number, number]
  radius?: number
}

export interface OverlapCheckResult {
  valid: boolean
  overlappingIds: string[]
  reason?: string
}

export const DEFAULT_PROP_RADIUS = 1.2
export const DEFAULT_STRUCTURE_RADIUS = 3.0
export const SANCTUARY_GROUND_RADIUS = 40.0

export function getObjectFootprintRadius(
  propId: string,
  explicitRadius?: number,
  catalog: Record<string, PropCatalogEntry> = PROP_CATALOG,
): number {
  if (explicitRadius && explicitRadius > 0) return explicitRadius
  const entry = catalog[propId]
  if (entry?.radius && entry.radius > 0) return entry.radius
  if (entry?.isStructure) return DEFAULT_STRUCTURE_RADIUS
  return DEFAULT_PROP_RADIUS
}

/**
 * Validates whether a candidate placement point is within the sanctuary circular boundary.
 */
export function checkBoundsValidity(
  point: readonly [number, number, number],
  boundsRadius: number = SANCTUARY_GROUND_RADIUS,
  clearance: number = 0,
): boolean {
  const [x, , z] = point
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(boundsRadius)) {
    return false
  }
  const dist = Math.hypot(x, z)
  return dist + clearance <= boundsRadius
}

/**
 * Checks whether a candidate object overlaps with any other placed objects in the sanctuary.
 */
export function checkPlacementOverlap(
  candidate: PlacementCandidate,
  allObjects: readonly SanctuaryPlacedObject[],
  catalog: Record<string, PropCatalogEntry> = PROP_CATALOG,
  boundsRadius: number = SANCTUARY_GROUND_RADIUS,
): OverlapCheckResult {
  const candidateRadius = getObjectFootprintRadius(candidate.propId, candidate.radius, catalog)

  // 1. Boundary check
  if (!checkBoundsValidity(candidate.position, boundsRadius, candidateRadius * 0.5)) {
    return {
      valid: false,
      overlappingIds: [],
      reason: 'Out of sanctuary bounds',
    }
  }

  const [cx, , cz] = candidate.position
  const overlappingIds: string[] = []

  for (const obj of allObjects) {
    if (candidate.id && obj.id === candidate.id) continue

    const objRadius = getObjectFootprintRadius(obj.propId, obj.radius, catalog)
    const minDistance = (candidateRadius + objRadius) * 0.75 // 25% tolerance for tight organic placement
    const dist = Math.hypot(cx - obj.position[0], cz - obj.position[2])

    if (dist < minDistance) {
      overlappingIds.push(obj.id)
    }
  }

  if (overlappingIds.length > 0) {
    return {
      valid: false,
      overlappingIds,
      reason: `Overlaps with ${overlappingIds.length} object${overlappingIds.length > 1 ? 's' : ''}`,
    }
  }

  return {
    valid: true,
    overlappingIds: [],
  }
}
