import { deriveSeed } from '@/core/math/rng'
import { getRegionPhenomenon } from '@/core/data/phenomena'
import { getRegionAmbientSpec } from './ambientPaths'

/**
 * Observation vantage (Biome Enhancement Stage 4, observation activity).
 *
 * One authored observation per region: the surveyor walks to a vantage beside
 * the region's ambient loop and presses E to record the phenomenon in the
 * World Atlas. Pure and deterministic — the vantage is derived from the same
 * ambient spec that renders the phenomenon, so the thing you observe is the
 * thing you see circling. Timed phenomena are only observable inside a
 * recurring deterministic window ("time an environmental phenomenon").
 */

export interface ObservationVantage {
  phenomenonId: string
  name: string
  kind: 'migration' | 'speciesSign' | 'vista' | 'timed'
  /** World XZ position — just off the ambient loop centre. */
  x: number
  z: number
  /** How close the surveyor must get, in metres. */
  approachRadius: number
}

/** Standing inside the loop ring puts agents at eye level all around. */
const VANTAGE_APPROACH_RADIUS = 10

/** Timed window: recurring period and active duration, both in seconds. */
const TIMED_PERIOD = 240
const TIMED_DURATION = 75

function hashUnit(seed: number, regionId: string, salt: string): number {
  return (deriveSeed(seed, `${regionId}:obs:${salt}`) >>> 0) / 4294967296
}

/**
 * The observation vantage for a region, or null when its biome has no
 * phenomenon. The vantage sits within the ambient loop ring (centre ± a
 * fraction of the loop radius), so it is always far from gameplay space and
 * well inside the explorable radius (max |centre| 74 + max offset ~10 = 84).
 */
export function getRegionObservationVantage(regionId: string, seed: number): ObservationVantage | null {
  const phenomenon = getRegionPhenomenon(regionId)
  const spec = getRegionAmbientSpec(regionId, seed)
  if (!phenomenon || !spec) return null

  const angle = hashUnit(seed, regionId, 'ang') * Math.PI * 2
  const offset = spec.radius * (0.25 + hashUnit(seed, regionId, 'rad') * 0.3)
  return {
    phenomenonId: phenomenon.id,
    name: phenomenon.name,
    kind: phenomenon.kind,
    x: spec.x + Math.cos(angle) * offset,
    z: spec.z + Math.sin(angle) * offset,
    approachRadius: VANTAGE_APPROACH_RADIUS,
  }
}

/**
 * Whether the phenomenon is observable at time t (seconds). Non-timed kinds
 * are always observable; timed kinds repeat on a fixed deterministic window
 * so the same save always shows the same rhythm.
 */
export function isPhenomenonActive(
  regionId: string,
  kind: ObservationVantage['kind'],
  t: number,
  seed = 42,
): boolean {
  if (kind !== 'timed') return true
  const phase = hashUnit(seed, regionId, 'win') * TIMED_PERIOD
  const pos = (((t - phase) % TIMED_PERIOD) + TIMED_PERIOD) % TIMED_PERIOD
  return pos < TIMED_DURATION
}
