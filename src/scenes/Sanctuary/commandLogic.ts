import type { Assignment } from '@/core/types'

/** An XZ position on the sanctuary ground plane. */
export type SanctuaryPoint = readonly [x: number, z: number]

/** Structural match for the sanctuary character controller's box colliders. */
export interface SanctuaryCollider {
  x: number
  z: number
  halfW: number
  halfD: number
}

export interface SanctuaryGeometry {
  boundsRadius: number
  colliders: readonly SanctuaryCollider[]
  /** Radius to reserve around the tested point. Defaults to zero. */
  clearance?: number
}

export type PerchAssignments = Record<string, number>

/**
 * Stable unsigned FNV-1a hash used to give each wyvern a preferred perch.
 *
 * `Math.imul` is intentional: it keeps the calculation in 32-bit integer
 * space on every JavaScript engine.
 */
export function stableIdHash(id: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** World-space yaw for a model whose forward axis is +Z. */
export function yawToward(from: SanctuaryPoint, target: SanctuaryPoint): number {
  return Math.atan2(target[0] - from[0], target[1] - from[1])
}

/**
 * Assigns unique perch indices with hash-based linear probing.
 *
 * Valid previous assignments are claimed first so a released wyvern or a
 * reordered roster cannot move survivors. New ids are sorted by their stable
 * hash (then id), making a fresh allocation independent of input ordering.
 * When there are more ids than perches, the unplaced ids are omitted.
 */
export function allocateStablePerches(
  ids: readonly string[],
  perchCount: number,
  previous: Readonly<PerchAssignments> = {},
): PerchAssignments {
  const count = Math.max(0, Math.floor(perchCount))
  if (count === 0) return {}

  const uniqueIds = [...new Set(ids)]
  const activeIds = new Set(uniqueIds)
  const assignments: PerchAssignments = {}
  const occupied = new Set<number>()

  // Sorting also resolves the unlikely case where callers supply conflicting
  // previous assignments without making the result depend on object order.
  const retained = Object.entries(previous)
    .filter(([id, perch]) => activeIds.has(id) && isValidPerchIndex(perch, count))
    .sort(([leftId, leftPerch], [rightId, rightPerch]) => {
      return leftPerch - rightPerch || compareAllocationOrder(leftId, rightId)
    })

  for (const [id, perch] of retained) {
    if (occupied.has(perch)) continue
    assignments[id] = perch
    occupied.add(perch)
  }

  const unassigned = uniqueIds
    .filter((id) => assignments[id] === undefined)
    .sort(compareAllocationOrder)

  for (const id of unassigned) {
    if (occupied.size >= count) break

    const preferred = stableIdHash(id) % count
    for (let offset = 0; offset < count; offset += 1) {
      const candidate = (preferred + offset) % count
      if (occupied.has(candidate)) continue

      assignments[id] = candidate
      occupied.add(candidate)
      break
    }
  }

  return assignments
}

function compareAllocationOrder(left: string, right: string): number {
  return stableIdHash(left) - stableIdHash(right) || left.localeCompare(right)
}

function isValidPerchIndex(value: number, count: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < count
}

/**
 * Tests a ground point against the circular sanctuary boundary and expanded
 * axis-aligned structure footprints.
 */
export function isSanctuaryPointValid(
  point: SanctuaryPoint,
  { boundsRadius, colliders, clearance = 0 }: SanctuaryGeometry,
): boolean {
  const [x, z] = point
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(z) ||
    !Number.isFinite(boundsRadius) ||
    !Number.isFinite(clearance) ||
    boundsRadius < 0 ||
    clearance < 0
  ) {
    return false
  }

  if (Math.hypot(x, z) + clearance > boundsRadius) return false

  for (const box of colliders) {
    const expandedHalfW = box.halfW + clearance
    const expandedHalfD = box.halfD + clearance
    if (Math.abs(x - box.x) <= expandedHalfW && Math.abs(z - box.z) <= expandedHalfD) {
      return false
    }
  }

  return true
}

export interface AttackLandingOptions extends Omit<SanctuaryGeometry, 'clearance'> {
  /** Distance from the harmless target at which the wyvern lands. */
  standOff?: number
  /** Clearance required for accepting the clicked target itself. */
  targetClearance?: number
  /** Clearance required around the much larger landing wyvern. */
  landingClearance?: number
  /**
   * Deterministic offsets from the direct approach angle. The first valid
   * candidate wins. Override for authored arenas or focused tests.
   */
  candidateAngleOffsets?: readonly number[]
}

const DEFAULT_ATTACK_ANGLE_OFFSETS: readonly number[] = [
  0,
  Math.PI / 6,
  -Math.PI / 6,
  Math.PI / 3,
  -Math.PI / 3,
  Math.PI / 2,
  -Math.PI / 2,
  (Math.PI * 2) / 3,
  (-Math.PI * 2) / 3,
  Math.PI,
]

/**
 * Chooses a safe landing exactly `standOff` units from an attack target.
 *
 * The direct candidate is on the target's approach-facing side. If a building
 * blocks it, fixed clockwise/counter-clockwise alternatives are tried. No
 * random state is consulted, so a target always resolves to the same result.
 */
export function findSafeAttackLanding(
  target: SanctuaryPoint,
  approachFrom: SanctuaryPoint,
  {
    boundsRadius,
    colliders,
    standOff = 9,
    targetClearance = 0,
    landingClearance = 0,
    candidateAngleOffsets = DEFAULT_ATTACK_ANGLE_OFFSETS,
  }: AttackLandingOptions,
): SanctuaryPoint | null {
  if (
    !Number.isFinite(standOff) ||
    standOff <= 0 ||
    !isSanctuaryPointValid(target, {
      boundsRadius,
      colliders,
      clearance: targetClearance,
    })
  ) {
    return null
  }

  const dx = approachFrom[0] - target[0]
  const dz = approachFrom[1] - target[1]
  const directAngle = dx === 0 && dz === 0 ? 0 : Math.atan2(dz, dx)

  for (const offset of candidateAngleOffsets) {
    if (!Number.isFinite(offset)) continue

    const angle = directAngle + offset
    const candidate: SanctuaryPoint = [
      target[0] + Math.cos(angle) * standOff,
      target[1] + Math.sin(angle) * standOff,
    ]
    if (
      isSanctuaryPointValid(candidate, {
        boundsRadius,
        colliders,
        clearance: landingClearance,
      })
    ) {
      return candidate
    }
  }

  return null
}

/**
 * Returns the closest unoccupied perch index. Ties resolve to the lowest
 * index, keeping the choice deterministic.
 */
export function findNearestAvailablePerch(
  from: SanctuaryPoint,
  perches: readonly SanctuaryPoint[],
  occupied: ReadonlySet<number> | readonly number[],
): number | null {
  const occupiedSet = occupied instanceof Set ? occupied : new Set(occupied)
  let closestIndex: number | null = null
  let closestDistanceSquared = Infinity

  for (let index = 0; index < perches.length; index += 1) {
    if (occupiedSet.has(index)) continue
    const point = perches[index]
    if (!point) continue

    const dx = point[0] - from[0]
    const dz = point[1] - from[1]
    const distanceSquared = dx * dx + dz * dz
    if (distanceSquared < closestDistanceSquared) {
      closestDistanceSquared = distanceSquared
      closestIndex = index
    }
  }

  return closestIndex
}

export type AssignmentVisualState = 'idle' | 'hop' | 'breathe' | 'attack' | 'walk'

/** Pure mapping used when an agent returns to its persistent assignment post. */
export function assignmentVisualState(assignment: Assignment): AssignmentVisualState {
  if (assignment.kind !== 'training') return 'idle'

  switch (assignment.stationId) {
    case 'flightRing':
      return 'hop'
    case 'burnRange':
      return 'breathe'
    case 'huntingPen':
      return 'attack'
    case 'enduranceRun':
      return 'walk'
    default:
      return 'idle'
  }
}
