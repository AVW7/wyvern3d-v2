import type { Actor } from './types'
import { add, clamp, clampLength, damp, direction, distance, distanceFlat, scale, sub, vec, type Vec3 } from '../math/vec'

/** Cruising altitude for a wyvern with nothing to attack. */
export const CRUISE_ALTITUDE = 18
/** How far above a ground target a wyvern drops to strafe it. */
export const STRAFE_ALTITUDE = 7
const SEPARATION_RADIUS = 7
const RETREAT_HP_FRACTION = 0.18

/**
 * Melee cannot reach something in the air. This is the whole reason the unit
 * triangle matters: wyverns hard-counter spears and riders, and archers and
 * siege are the only answer to wyverns.
 */
export function canHit(attacker: Actor, target: Actor): boolean {
  if (!target.alive) return false
  if (target.flying && !attacker.flying && attacker.range < 20) return false
  return true
}

const isEnemy = (a: Actor, b: Actor): boolean => (a.feral ? a.id !== b.id : a.side !== b.side)

export function pickTarget(actor: Actor, actors: readonly Actor[]): string | null {
  let best: Actor | null = null
  let bestScore = Infinity

  for (const other of actors) {
    if (!other.alive || other.id === actor.id) continue
    if (!isEnemy(actor, other)) continue
    if (!canHit(actor, other)) continue

    // Prefer close targets, but weight toward things this actor counters and
    // away from full-health ones, so squads focus fire rather than spreading.
    const d = distance(actor.position, other.position)
    const score = d * (0.6 + 0.4 * (other.hp / other.maxHp))
    if (score < bestScore) {
      bestScore = score
      best = other
    }
  }
  return best?.id ?? null
}

export function updateAi(actor: Actor, actors: readonly Actor[], byId: Map<string, Actor>): void {
  if (!actor.alive) return

  // A wounded wyvern breaks off. Troops fight to the last — they have nowhere
  // to run, and letting squads rout made auto-resolve wildly swingy.
  if (actor.kind === 'wyvern' && actor.hp / actor.maxHp < RETREAT_HP_FRACTION) {
    actor.ai = 'retreat'
    actor.targetId = null
    return
  }

  // An obeyed attack order overrides target selection.
  const order = actor.disobedient ? null : actor.order
  if (order?.kind === 'attack') {
    const ordered = byId.get(order.targetId)
    if (ordered?.alive && canHit(actor, ordered)) {
      actor.targetId = ordered.id
      actor.ai = distance(actor.position, ordered.position) <= actor.range ? 'engage' : 'approach'
      return
    }
    actor.order = null
  }

  if (order?.kind === 'hold') {
    actor.ai = 'idle'
    // Still shoot anything that wanders into range.
    const nearby = pickTarget(actor, actors)
    const target = nearby ? byId.get(nearby) : undefined
    if (target && distance(actor.position, target.position) <= actor.range) {
      actor.targetId = nearby
      actor.ai = 'engage'
    } else {
      actor.targetId = null
    }
    return
  }

  const current = actor.targetId ? byId.get(actor.targetId) : undefined
  if (!current?.alive || !canHit(actor, current)) {
    actor.targetId = pickTarget(actor, actors)
  }

  const target = actor.targetId ? byId.get(actor.targetId) : undefined
  if (!target) {
    actor.ai = order?.kind === 'moveTo' || order?.kind === 'regroup' ? 'approach' : 'idle'
    return
  }
  actor.ai = distance(actor.position, target.position) <= actor.range ? 'engage' : 'approach'
}

/** Keeps same-side actors from collapsing into one point. */
function separation(actor: Actor, actors: readonly Actor[]): Vec3 {
  let push = vec()
  for (const other of actors) {
    if (!other.alive || other.id === actor.id || other.side !== actor.side) continue
    if (other.flying !== actor.flying) continue
    const d = distance(actor.position, other.position)
    if (d > SEPARATION_RADIUS || d < 1e-4) continue
    push = add(push, scale(direction(other.position, actor.position), (SEPARATION_RADIUS - d) / SEPARATION_RADIUS))
  }
  return push
}

/** Where this actor wants to be, before separation. */
function desiredPosition(actor: Actor, byId: Map<string, Actor>, rallyPoint: Vec3): Vec3 | null {
  const order = actor.disobedient ? null : actor.order

  if (order?.kind === 'moveTo') return order.position
  if (order?.kind === 'regroup') return rallyPoint

  const target = actor.targetId ? byId.get(actor.targetId) : undefined
  if (actor.ai === 'retreat') {
    // Climb and pull back the way we came.
    const away = direction(rallyPoint, actor.position)
    return add(actor.position, scale({ x: -away.x, y: 0, z: -away.z }, 30))
  }
  if (!target) return actor.flying ? { ...actor.position, y: CRUISE_ALTITUDE } : null

  if (actor.flying) {
    // Sit at strafing height above a ground target; match altitude against
    // another flyer.
    const y = target.flying ? target.position.y : target.position.y + STRAFE_ALTITUDE
    return { x: target.position.x, y, z: target.position.z }
  }
  return { ...target.position, y: 0 }
}

export function steer(
  actor: Actor,
  actors: readonly Actor[],
  byId: Map<string, Actor>,
  rallyPoint: Vec3,
  dt: number,
  arenaRadius: number,
): void {
  if (!actor.alive) return

  const goal = desiredPosition(actor, byId, rallyPoint)
  let desired = vec()

  if (goal) {
    const toGoal = sub(goal, actor.position)
    const dist = actor.flying ? distance(actor.position, goal) : distanceFlat(actor.position, goal)
    // Ease off inside engagement range so actors don't jitter through targets.
    const approach = actor.ai === 'engage' && dist < actor.range * 0.8 ? 0 : 1
    desired = scale(direction(actor.position, goal), actor.speed * approach)
    if (!actor.flying) desired.y = 0
    else desired.y = clamp(toGoal.y, -actor.speed, actor.speed)
  }

  desired = add(desired, scale(separation(actor, actors), actor.speed * 0.6))
  desired = clampLength(desired, actor.speed)

  // Smooth toward the desired velocity rather than snapping — this is what
  // makes flight read as flight instead of teleporting.
  const responsiveness = actor.flying ? 2.5 : 6
  actor.velocity = {
    x: damp(actor.velocity.x, desired.x, responsiveness, dt),
    y: damp(actor.velocity.y, desired.y, responsiveness, dt),
    z: damp(actor.velocity.z, desired.z, responsiveness, dt),
  }

  applyMotion(actor, dt, arenaRadius)
}

/** Integrates velocity and enforces ground/altitude/arena bounds. */
export function applyMotion(actor: Actor, dt: number, arenaRadius: number): void {
  actor.position = add(actor.position, scale(actor.velocity, dt))

  if (actor.flying) {
    actor.position.y = clamp(actor.position.y, 3, 60)
  } else {
    actor.position.y = 0
    actor.velocity.y = 0
  }

  const flat = Math.hypot(actor.position.x, actor.position.z)
  if (flat > arenaRadius) {
    const k = arenaRadius / flat
    actor.position.x *= k
    actor.position.z *= k
  }

  if (Math.abs(actor.velocity.x) > 1e-3 || Math.abs(actor.velocity.z) > 1e-3) {
    actor.yaw = Math.atan2(actor.velocity.x, actor.velocity.z)
  }
}
