import { createRng, deriveSeed } from '@/core/math/rng'
import { exclusions } from '../dressing'
import { GROUND_RADIUS } from '../layout'

/**
 * Where the sanctuary's ambient deer stand, and when they bolt.
 *
 * Pure and seeded so the herd is in the same place every time a save is loaded
 * — cosmetic randomness in this scene comes from `createRng(deriveSeed(...))`
 * off the world seed, never `Math.random()` and never the tick path's
 * `withRng`, which would advance `rngState` from a render loop and desync every
 * replay.
 */

export interface Deer {
  id: string
  /** Home position; the actor grazes around this point. */
  home: [number, number]
  /** Wander phase, so the herd does not move in lockstep. */
  phase: number
  facing: number
}

/** Deer graze between the outer stations and the treeline. */
const BAND_INNER = 42
const BAND_OUTER = GROUND_RADIUS - 5

/** How close a landing wyvern has to be before the herd bolts. */
export const STARTLE_RADIUS = 18

export function placeDeer(seed: number, count: number): Deer[] {
  const rng = createRng(deriveSeed(seed, 'sanctuary:wildlife'))
  const zones = exclusions()
  const deer: Deer[] = []

  // Rejection sampling, bounded: falling short just means a smaller herd, never
  // a hang. Same approach the scenery scatter uses.
  for (let attempt = 0; attempt < count * 60 && deer.length < count; attempt++) {
    const angle = rng.next() * Math.PI * 2
    const radius = rng.range(BAND_INNER, BAND_OUTER)
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius

    if (zones.some((zone) => Math.hypot(x - zone.x, z - zone.z) < zone.r)) continue
    // Keep them apart so they read as a scattered herd, not a huddle.
    if (deer.some((other) => Math.hypot(x - other.home[0], z - other.home[1]) < 9)) continue

    deer.push({
      id: `deer-${deer.length}`,
      home: [x, z],
      phase: rng.next() * Math.PI * 2,
      facing: rng.next() * Math.PI * 2,
    })
  }

  return deer
}

/**
 * How alarmed a deer is, 0 calm to 1 bolting.
 *
 * Anything airborne is ignored: a wyvern cruising at altitude 22 overhead is
 * not what makes a deer run, and treating it as a threat would leave the herd
 * permanently spooked while one patrols.
 */
export function alarmLevel(
  deer: Deer,
  threats: readonly { x: number; z: number; airborne: boolean }[],
): number {
  let alarm = 0
  for (const threat of threats) {
    if (threat.airborne) continue
    const distance = Math.hypot(deer.home[0] - threat.x, deer.home[1] - threat.z)
    if (distance >= STARTLE_RADIUS) continue
    alarm = Math.max(alarm, 1 - distance / STARTLE_RADIUS)
  }
  return alarm
}

/** Direction a startled deer runs: directly away from the nearest ground threat. */
export function fleeHeading(
  deer: Deer,
  threats: readonly { x: number; z: number; airborne: boolean }[],
): number | null {
  let nearest: { x: number; z: number } | null = null
  let best = Infinity
  for (const threat of threats) {
    if (threat.airborne) continue
    const distance = Math.hypot(deer.home[0] - threat.x, deer.home[1] - threat.z)
    if (distance < best) {
      best = distance
      nearest = threat
    }
  }
  if (!nearest || best >= STARTLE_RADIUS) return null
  return Math.atan2(deer.home[0] - nearest.x, deer.home[1] - nearest.z)
}
