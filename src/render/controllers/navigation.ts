/**
 * Shortest walkable route around axis-aligned box obstacles.
 *
 * The character controller used to answer every walk order with a straight
 * line and a push-out: `resolveCollisions` shoves the body off whatever it has
 * entered, so a wall between the player and the destination is not a detour but
 * a dead stop — the walk pins itself against the wall and never arrives. That
 * is what stranded the sanctuary's Feed, Pet and Calm orders whenever a keep
 * wall or a station sat on the line, because the wyvern waits in
 * `approachingPlayer` until the player reports arrival.
 *
 * Obstacles here are axis-aligned rectangles, and the shortest path around a
 * set of those only ever bends at their corners. So rather than rasterise the
 * ground into a grid — resolution artefacts, a jagged path to smooth, and a
 * 6-unit keep doorway that a coarse grid can seal — this builds a visibility
 * graph over the inflated corners and runs Dijkstra across it. The result is
 * the exact shortest polyline, with no smoothing pass and no tuning constant
 * that decides whether a gap is passable.
 *
 * Everything here is pure: no three.js, no react, no module state.
 */

/** Axis-aligned box footprint in the XZ plane. */
export interface NavCollider {
  x: number
  z: number
  halfW: number
  halfD: number
}

/** A point on the ground plane. */
export interface NavPoint {
  x: number
  z: number
}

export interface NavOptions {
  /** Body radius. Obstacles are inflated by it so the path clears them. */
  radius: number
  /** Optional walkable disc centred on the origin. */
  boundsRadius?: number
}

interface Rect {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/**
 * How far outside an inflated rectangle its corner waypoints sit.
 *
 * They have to be strictly outside, or every segment leaving a corner starts on
 * the boundary and the visibility test has to decide whether touching counts.
 */
const CORNER_EPSILON = 0.05

function inflate(box: NavCollider, radius: number): Rect {
  return {
    minX: box.x - box.halfW - radius,
    maxX: box.x + box.halfW + radius,
    minZ: box.z - box.halfD - radius,
    maxZ: box.z + box.halfD + radius,
  }
}

/** Strictly inside — a point on the boundary is walkable. */
function contains(rect: Rect, point: NavPoint): boolean {
  return (
    point.x > rect.minX &&
    point.x < rect.maxX &&
    point.z > rect.minZ &&
    point.z < rect.maxZ
  )
}

/**
 * Does the segment `a`→`b` pass through the rectangle's interior?
 *
 * Slab clip. Grazing does not count: a segment running exactly along an edge is
 * parallel to that axis with its origin on the slab boundary, which the
 * parallel branch rejects, and a segment that only touches a corner collapses
 * to `t0 === t1`, which the strict compare rejects. Both matter, because every
 * candidate waypoint is a corner of some rectangle.
 */
function segmentHitsRect(a: NavPoint, b: NavPoint, rect: Rect): boolean {
  let t0 = 0
  let t1 = 1

  const delta = [b.x - a.x, b.z - a.z]
  const origin = [a.x, a.z]
  const min = [rect.minX, rect.minZ]
  const max = [rect.maxX, rect.maxZ]

  for (let axis = 0; axis < 2; axis += 1) {
    const d = delta[axis]!
    const o = origin[axis]!
    const lo = min[axis]!
    const hi = max[axis]!

    if (Math.abs(d) < 1e-9) {
      if (o <= lo || o >= hi) return false
      continue
    }

    let near = (lo - o) / d
    let far = (hi - o) / d
    if (near > far) [near, far] = [far, near]
    if (near > t0) t0 = near
    if (far < t1) t1 = far
    if (t0 >= t1) return false
  }

  return true
}

/**
 * Can the walker go straight from `a` to `b`?
 *
 * A rectangle that already contains an endpoint is ignored. The character can
 * be pushed inside one by `resolveCollisions`, or a caller can ask for a
 * destination that a later layout edit has buried, and refusing to connect such
 * a node would strand it with no route at all rather than the best available.
 */
function visible(a: NavPoint, b: NavPoint, rects: readonly Rect[]): boolean {
  for (const rect of rects) {
    if (contains(rect, a) || contains(rect, b)) continue
    if (segmentHitsRect(a, b, rect)) return false
  }
  return true
}

function distance(a: NavPoint, b: NavPoint): number {
  return Math.hypot(b.x - a.x, b.z - a.z)
}

/**
 * Waypoints from `start` to `goal`, or null when no route exists.
 *
 * `start` is not included; `goal` always is. A clear straight line returns
 * `[goal]`, so the common case costs one visibility test and callers need no
 * special case for it.
 *
 * Null means the goal is genuinely unreachable — walled off, or outside the
 * bounds disc. Callers should fall back to whatever they did before rather
 * than refuse to move, since a stale collider set should never freeze a walk.
 */
export function findPath(
  start: NavPoint,
  goal: NavPoint,
  colliders: readonly NavCollider[],
  { radius, boundsRadius }: NavOptions,
): NavPoint[] | null {
  if (boundsRadius !== undefined && Math.hypot(goal.x, goal.z) > boundsRadius) {
    return null
  }

  const rects = colliders.map((box) => inflate(box, radius))
  if (visible(start, goal, rects)) return [{ x: goal.x, z: goal.z }]

  // Candidate turns: the corners of every obstacle, nudged clear of their own
  // rectangle and dropped if they sit inside another one or out of bounds.
  const nodes: NavPoint[] = [start, goal]
  for (const rect of rects) {
    const corners: NavPoint[] = [
      { x: rect.minX - CORNER_EPSILON, z: rect.minZ - CORNER_EPSILON },
      { x: rect.maxX + CORNER_EPSILON, z: rect.minZ - CORNER_EPSILON },
      { x: rect.minX - CORNER_EPSILON, z: rect.maxZ + CORNER_EPSILON },
      { x: rect.maxX + CORNER_EPSILON, z: rect.maxZ + CORNER_EPSILON },
    ]
    for (const corner of corners) {
      if (boundsRadius !== undefined && Math.hypot(corner.x, corner.z) > boundsRadius) {
        continue
      }
      if (rects.some((other) => contains(other, corner))) continue
      nodes.push(corner)
    }
  }

  const count = nodes.length
  const GOAL = 1

  // Dense adjacency: the graph is small (four nodes per obstacle) and every
  // pair is tested once, so an explicit edge list would only add bookkeeping.
  const edges: number[][] = Array.from({ length: count }, () => [])
  for (let i = 0; i < count; i += 1) {
    for (let j = i + 1; j < count; j += 1) {
      if (visible(nodes[i]!, nodes[j]!, rects)) {
        edges[i]!.push(j)
        edges[j]!.push(i)
      }
    }
  }

  const best = new Array<number>(count).fill(Infinity)
  const previous = new Array<number>(count).fill(-1)
  const settled = new Array<boolean>(count).fill(false)
  best[0] = 0

  for (;;) {
    let current = -1
    let currentCost = Infinity
    for (let i = 0; i < count; i += 1) {
      if (!settled[i] && best[i]! < currentCost) {
        current = i
        currentCost = best[i]!
      }
    }
    if (current === -1 || current === GOAL) break
    settled[current] = true

    for (const next of edges[current]!) {
      const cost = currentCost + distance(nodes[current]!, nodes[next]!)
      if (cost < best[next]!) {
        best[next] = cost
        previous[next] = current
      }
    }
  }

  if (!Number.isFinite(best[GOAL]!)) return null

  const route: NavPoint[] = []
  for (let node = GOAL; node !== 0 && node !== -1; node = previous[node]!) {
    route.unshift({ x: nodes[node]!.x, z: nodes[node]!.z })
  }
  return route
}
