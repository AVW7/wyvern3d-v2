import { deriveSeed } from '@/core/math/rng'
import { getRegionPhenomenon } from '@/core/data/phenomena'

/**
 * Ambient ecology paths (Biome Enhancement Stage 4).
 *
 * Pure, deterministic agent paths for a region's characteristic phenomenon:
 * bird flocks circling above the treeline, fireflies drifting over wet ground,
 * embers rising from fissures. Presentation-only — paths stay bounded away
 * from the arrival clearing and landing zones so ambient life never collides
 * with gameplay space, and everything is index-derived (no RNG state, no
 * Math.random).
 */

export interface AmbientAgentSpec {
  /** Ambient vocabulary: which renderer draws it. */
  ambient: 'birds' | 'fireflies' | 'spores' | 'embers' | 'crystalPulses' | 'fish' | 'deer'
  /** Path centre. */
  x: number
  z: number
  /** Path radius in metres. */
  radius: number
  /** Base height above terrain (metres). */
  height: number
  /** Agents in the flock/swarm. */
  count: number
  /** Full-loop period in seconds. */
  period: number
  /** Phase offset per agent so a flock never moves as one point. */
  phase: number
}

/**
 * Loop geometry invariant: the arrival spawn [0, -18, r 14] and the three
 * authored landing clearings [0, ±28 / ±28, 0, r 10] all lie within ~43 m of
 * the region origin (max |centre| 28.4 + radius 14 = 42.4), and a loop centred
 * at >= LOOP_CENTRE_MIN with radius <= LOOP_RADIUS_MAX never reaches closer
 * than LOOP_CENTRE_MIN - LOOP_RADIUS_MAX = 46 m to the origin, so ambient life
 * can never enter gameplay space — no angle search needed.
 */
/** Loop centre distance band and loop radius bound. */
const LOOP_CENTRE_MIN = 64
const LOOP_CENTRE_MAX = 74
const LOOP_RADIUS_MAX = 18

const HEIGHTS: Record<AmbientAgentSpec['ambient'], [number, number]> = {
  birds: [14, 26],
  fireflies: [1.5, 4],
  spores: [1, 3],
  embers: [2, 9],
  crystalPulses: [0, 0.5],
  fish: [0.5, 1.5],
  deer: [0, 0],
}

const COUNTS: Record<AmbientAgentSpec['ambient'], number> = {
  birds: 12,
  fireflies: 24,
  spores: 18,
  embers: 20,
  crystalPulses: 8,
  fish: 10,
  deer: 3,
}

const PERIODS: Record<AmbientAgentSpec['ambient'], number> = {
  birds: 34,
  fireflies: 48,
  spores: 40,
  embers: 22,
  crystalPulses: 12,
  fish: 26,
  deer: 60,
}

function hashUnit(seed: number, salt: string): number {
  return (deriveSeed(seed, salt) >>> 0) / 4294967296
}

/**
 * The ambient agent spec for a region, or null when its biome has no
 * phenomenon.
 *
 * Loop geometry invariant: every keep-clear zone lies within
 * GAMEPLAY_ENVELOPE of the origin, and a loop centred at >=
 * LOOP_CENTRE_MIN with radius <= LOOP_RADIUS_MAX never reaches closer than
 * LOOP_CENTRE_MIN - LOOP_RADIUS_MAX = 46 m to the origin, so ambient life
 * can never enter gameplay space — no angle search needed.
 */
export function getRegionAmbientSpec(regionId: string, seed: number): AmbientAgentSpec | null {
  const phenomenon = getRegionPhenomenon(regionId)
  if (!phenomenon) return null

  const centreDist =
    LOOP_CENTRE_MIN + hashUnit(seed, `${regionId}:amb:dist`) * (LOOP_CENTRE_MAX - LOOP_CENTRE_MIN)
  const angle = hashUnit(seed, `${regionId}:amb:ang`) * Math.PI * 2
  const radius = 10 + hashUnit(seed, `${regionId}:amb:rad`) * (LOOP_RADIUS_MAX - 10)

  const [minH, maxH] = HEIGHTS[phenomenon.ambient]
  return {
    ambient: phenomenon.ambient,
    x: Math.cos(angle) * centreDist,
    z: Math.sin(angle) * centreDist,
    radius,
    height: minH + hashUnit(seed, `${regionId}:amb:h`) * (maxH - minH),
    count: COUNTS[phenomenon.ambient],
    period: PERIODS[phenomenon.ambient],
    phase: hashUnit(seed, `${regionId}:amb:ph`) * Math.PI * 2,
  }
}

/**
 * Agent position on its loop at time t. Pure: the same t always yields the
 * same point, so paths replay identically.
 */
export function ambientAgentPosition(
  spec: AmbientAgentSpec,
  agentIndex: number,
  t: number,
): { x: number; y: number; z: number } {
  const golden = 2.399963229728653
  const agentPhase = spec.phase + agentIndex * golden
  const wobble = 1 + Math.sin(agentPhase + t * 0.7) * 0.12
  const loopAngle = (t / spec.period) * Math.PI * 2 + agentPhase
  const r = spec.radius * wobble
  const x = spec.x + Math.cos(loopAngle) * r
  const z = spec.z + Math.sin(loopAngle) * r
  // Vertical bob, unique per agent.
  const y = spec.height + Math.sin(agentPhase * 2.3 + t * 1.9) * spec.height * 0.25
  return { x, y: Math.max(0, y), z }
}
