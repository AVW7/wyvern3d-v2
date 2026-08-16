import { describe, expect, it } from 'vitest'
import { findPath, type NavCollider, type NavPoint } from './navigation'
import { buildColliders, GROUND_RADIUS, KEEP } from '@/scenes/Sanctuary/layout'

const RADIUS = 0.6

/** Every leg of a route, including the one out of `start`. */
function legs(start: NavPoint, route: NavPoint[]): [NavPoint, NavPoint][] {
  const points = [start, ...route]
  return points.slice(0, -1).map((from, index) => [from, points[index + 1]!])
}

/** Does a leg cut through a box inflated by the body radius? Sampled densely. */
function legClears(
  [from, to]: [NavPoint, NavPoint],
  colliders: readonly NavCollider[],
  radius: number,
): boolean {
  const steps = Math.max(2, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) * 8))
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const x = from.x + (to.x - from.x) * t
    const z = from.z + (to.z - from.z) * t
    for (const box of colliders) {
      // Strictly inside, so a path grazing the inflated edge is allowed.
      if (
        Math.abs(x - box.x) < box.halfW + radius - 1e-6 &&
        Math.abs(z - box.z) < box.halfD + radius - 1e-6
      ) {
        return false
      }
    }
  }
  return true
}

function routeLength(start: NavPoint, route: NavPoint[]): number {
  return legs(start, route).reduce(
    (total, [from, to]) => total + Math.hypot(to.x - from.x, to.z - from.z),
    0,
  )
}

describe('findPath', () => {
  it('returns the destination alone when the straight line is clear', () => {
    const route = findPath({ x: 0, z: 0 }, { x: 10, z: 0 }, [], { radius: RADIUS })
    expect(route).toEqual([{ x: 10, z: 0 }])
  })

  it('routes around a wall that blocks the straight line', () => {
    const wall: NavCollider[] = [{ x: 5, z: 0, halfW: 1, halfD: 6 }]
    const start = { x: 0, z: 0 }
    const goal = { x: 10, z: 0 }

    const route = findPath(start, goal, wall, { radius: RADIUS })

    expect(route).not.toBeNull()
    expect(route!.length).toBeGreaterThan(1)
    expect(route!.at(-1)).toEqual(goal)
    for (const leg of legs(start, route!)) {
      expect(legClears(leg, wall, RADIUS)).toBe(true)
    }
  })

  it('takes the short way round, not just any way round', () => {
    // Offset so going south past the wall's near end is clearly shorter.
    const wall: NavCollider[] = [{ x: 5, z: 4, halfW: 1, halfD: 6 }]
    const start = { x: 0, z: 0 }
    const goal = { x: 10, z: 0 }

    const route = findPath(start, goal, wall, { radius: RADIUS })!

    // Every turn should be south of the wall (the near end), never north.
    expect(route.slice(0, -1).every((point) => point.z < 0)).toBe(true)
    expect(routeLength(start, route)).toBeLessThan(14)
  })

  it('threads the keep doorway instead of climbing the wall', () => {
    const colliders = buildColliders()
    // Inside the keep, and a point on the open grounds due south of it.
    const start = { x: 0, z: KEEP.centerZ }
    const goal = { x: 0, z: 8 }

    const route = findPath(start, goal, colliders, {
      radius: RADIUS,
      boundsRadius: GROUND_RADIUS,
    })

    expect(route).not.toBeNull()
    for (const leg of legs(start, route!)) {
      expect(legClears(leg, colliders, RADIUS)).toBe(true)
    }
    // The doorway is the 6-unit gap at x in (-3, 3) on the south wall.
    const crossing = route![0]!
    expect(Math.abs(crossing.x)).toBeLessThan(3)
  })

  it('gets out of a keep corner without pinning on a wall', () => {
    const colliders = buildColliders()
    const start = { x: KEEP.centerX - KEEP.halfW + 2, z: KEEP.centerZ - KEEP.halfD + 2 }
    const goal = { x: 30, z: 30 }

    const route = findPath(start, goal, colliders, {
      radius: RADIUS,
      boundsRadius: GROUND_RADIUS,
    })

    expect(route).not.toBeNull()
    expect(route!.at(-1)).toEqual(goal)
    for (const leg of legs(start, route!)) {
      expect(legClears(leg, colliders, RADIUS)).toBe(true)
    }
  })

  it('still routes when the walker has been pushed inside an obstacle', () => {
    const box: NavCollider[] = [{ x: 0, z: 0, halfW: 2, halfD: 2 }]
    const route = findPath({ x: 0, z: 0 }, { x: 10, z: 0 }, box, { radius: RADIUS })

    expect(route).not.toBeNull()
    expect(route!.at(-1)).toEqual({ x: 10, z: 0 })
  })

  it('reports no route when the destination is walled in', () => {
    const pen: NavCollider[] = [
      { x: 20, z: 0, halfW: 1, halfD: 10 },
      { x: 40, z: 0, halfW: 1, halfD: 10 },
      { x: 30, z: 10, halfW: 11, halfD: 1 },
      { x: 30, z: -10, halfW: 11, halfD: 1 },
    ]
    expect(findPath({ x: 0, z: 0 }, { x: 30, z: 0 }, pen, { radius: RADIUS })).toBeNull()
  })

  it('reports no route to a destination outside the bounds disc', () => {
    const route = findPath({ x: 0, z: 0 }, { x: 0, z: GROUND_RADIUS + 5 }, [], {
      radius: RADIUS,
      boundsRadius: GROUND_RADIUS,
    })
    expect(route).toBeNull()
  })

  it('stays inside budget on the live sanctuary collider set', () => {
    const colliders = buildColliders()
    const started = performance.now()
    for (let i = 0; i < 20; i += 1) {
      findPath({ x: 0, z: KEEP.centerZ }, { x: -44 + i, z: 38 }, colliders, {
        radius: RADIUS,
        boundsRadius: GROUND_RADIUS,
      })
    }
    // One route per walk order, never per frame; this only guards a blow-up.
    expect((performance.now() - started) / 20).toBeLessThan(20)
  })
})
