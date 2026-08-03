import { describe, expect, it } from 'vitest'
import {
  allocateStablePerches,
  assignmentVisualState,
  findNearestAvailablePerch,
  findSafeAttackLanding,
  isSanctuaryPointValid,
  stableIdHash,
  yawToward,
  type PerchAssignments,
  type SanctuaryPoint,
} from './commandLogic'

describe('stable sanctuary perch allocation', () => {
  it('faces idle perches toward a world-space target using the model +Z axis', () => {
    expect(yawToward([0, 0], [0, 10])).toBeCloseTo(0)
    expect(yawToward([0, 0], [10, 0])).toBeCloseTo(Math.PI / 2)
    expect(yawToward([-38, -22], [0, 8])).toBeCloseTo(0.9025, 3)
  })

  it('is independent of roster input ordering', () => {
    const ids = ['ember', 'rook', 'cirrus', 'bramble', 'onyx']
    const forward = allocateStablePerches(ids, 8)
    const reversed = allocateStablePerches([...ids].reverse(), 8)
    const shuffled = allocateStablePerches(['cirrus', 'onyx', 'ember', 'bramble', 'rook'], 8)

    expect(reversed).toEqual(forward)
    expect(shuffled).toEqual(forward)
    expect(new Set(Object.values(forward)).size).toBe(ids.length)
  })

  it('preserves surviving assignments when a wyvern is released', () => {
    const before = allocateStablePerches(['ember', 'rook', 'cirrus', 'bramble'], 8)
    const after = allocateStablePerches(['ember', 'cirrus', 'bramble'], 8, before)

    expect(after.ember).toBe(before.ember)
    expect(after.cirrus).toBe(before.cirrus)
    expect(after.bramble).toBe(before.bramble)
    expect(after.rook).toBeUndefined()
  })

  it('preserves unaffected preferred hashes without previous state', () => {
    const count = 16
    const ids = ['ember', 'rook', 'cirrus', 'bramble']
    const uniquePreferred = ids.filter((id) => {
      const preferred = stableIdHash(id) % count
      return ids.filter((other) => stableIdHash(other) % count === preferred).length === 1
    })
    const before = allocateStablePerches(ids, count)
    const after = allocateStablePerches(ids.filter((id) => id !== 'rook'), count)

    for (const id of uniquePreferred.filter((id) => id !== 'rook')) {
      expect(after[id]).toBe(before[id])
    }
  })

  it('retains only valid, non-conflicting previous assignments', () => {
    const previous: PerchAssignments = { ember: 2, rook: 2, cirrus: 99 }
    const result = allocateStablePerches(['rook', 'ember', 'cirrus'], 4, previous)

    expect(new Set(Object.values(result)).size).toBe(3)
    expect(Object.values(result).every((index) => index >= 0 && index < 4)).toBe(true)
    expect(result.ember === 2 || result.rook === 2).toBe(true)
  })
})

describe('sanctuary point validity', () => {
  const geometry = {
    boundsRadius: 10,
    colliders: [{ x: 2, z: 2, halfW: 1, halfD: 2 }],
  }

  it('rejects targets outside the sanctuary or inside structures', () => {
    expect(isSanctuaryPointValid([11, 0], geometry)).toBe(false)
    expect(isSanctuaryPointValid([2, 3], geometry)).toBe(false)
    expect(isSanctuaryPointValid([0, 0], geometry)).toBe(true)
  })

  it('expands bounds and colliders by the requested clearance', () => {
    expect(isSanctuaryPointValid([8.5, 0], { ...geometry, clearance: 1.5 })).toBe(true)
    expect(isSanctuaryPointValid([8.51, 0], { ...geometry, clearance: 1.5 })).toBe(false)
    expect(isSanctuaryPointValid([0.75, 2], geometry)).toBe(true)
    expect(isSanctuaryPointValid([0.75, 2], { ...geometry, clearance: 0.3 })).toBe(false)
  })
})

describe('safe attack landing', () => {
  it('rejects an invalid clicked target', () => {
    const landing = findSafeAttackLanding([20, 0], [0, 0], {
      boundsRadius: 15,
      colliders: [],
    })

    expect(landing).toBeNull()
  })

  it('uses an alternate deterministic candidate when the direct landing is blocked', () => {
    const landing = findSafeAttackLanding([0, 0], [10, 0], {
      boundsRadius: 30,
      colliders: [{ x: 9, z: 0, halfW: 1, halfD: 1 }],
      candidateAngleOffsets: [0, Math.PI / 2],
    })

    expect(landing).not.toBeNull()
    expect(landing![0]).toBeCloseTo(0)
    expect(landing![1]).toBeCloseTo(9)
    expect(Math.hypot(landing![0], landing![1])).toBeCloseTo(9)
  })

  it('returns null when every landing candidate is invalid', () => {
    const landing = findSafeAttackLanding([0, 0], [1, 0], {
      boundsRadius: 8,
      colliders: [],
      candidateAngleOffsets: [0, Math.PI / 2, Math.PI],
    })

    expect(landing).toBeNull()
  })
})

describe('nearest available perch', () => {
  const perches: SanctuaryPoint[] = [
    [0, 0],
    [5, 0],
    [2, 0],
    [2, 2],
  ]

  it('skips occupied perches and returns the nearest free index', () => {
    expect(findNearestAvailablePerch([0, 0], perches, new Set([0, 2]))).toBe(3)
    expect(findNearestAvailablePerch([4, 0], perches, [1])).toBe(2)
  })

  it('returns null when every perch is occupied', () => {
    expect(findNearestAvailablePerch([0, 0], perches, [0, 1, 2, 3])).toBeNull()
  })

  it('breaks equal-distance ties by perch order', () => {
    expect(findNearestAvailablePerch([1, 0], perches, [])).toBe(0)
  })
})

describe('assignment visual state', () => {
  it('maps authored training stations to their sanctuary animation', () => {
    expect(
      assignmentVisualState({ kind: 'training', stationId: 'flightRing', ticksLeft: 10 }),
    ).toBe('hop')
    expect(
      assignmentVisualState({ kind: 'training', stationId: 'burnRange', ticksLeft: 10 }),
    ).toBe('breathe')
    expect(
      assignmentVisualState({ kind: 'training', stationId: 'huntingPen', ticksLeft: 10 }),
    ).toBe('attack')
    expect(
      assignmentVisualState({ kind: 'training', stationId: 'enduranceRun', ticksLeft: 10 }),
    ).toBe('walk')
    expect(
      assignmentVisualState({ kind: 'training', stationId: 'scaleForge', ticksLeft: 10 }),
    ).toBe('idle')
  })

  it('keeps non-training assignments settled', () => {
    expect(assignmentVisualState({ kind: 'idle' })).toBe('idle')
    expect(
      assignmentVisualState({ kind: 'breeding', partnerId: 'ember', ticksLeft: 10 }),
    ).toBe('idle')
  })
})
