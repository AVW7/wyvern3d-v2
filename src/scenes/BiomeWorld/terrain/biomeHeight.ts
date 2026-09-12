import { deriveSeed } from '@/core/math/rng'
import { getRegionBiomeModifiers } from './regionModifiers'
import { DEFAULT_WEIGHTS, getBiomeLandform } from './biomeLandforms'
import { applyOperator } from './landformOperators'
import { noiseBasisAt } from './terrainNoise'
import {
  DRY_SITE_CLEARANCE,
  drySiteLift,
  getProtectedSites,
  getRegionWaterBody,
  hummockFalloff,
} from './biomeWater'

export const BIOME_WORLD_RADIUS = 110

/** Height of the grove's central mound; the world tree is planted on top of it. */
export const GROVE_MOUND_HEIGHT = 2.2

/** One dry-islet lift under a protected site. */
interface SiteLift {
  x: number
  z: number
  height: number
  radius: number
}

/**
 * Lifts are derived from other authored modules (landmark anchors, observation
 * vantages), which is more work than a bare height sample — memoize per
 * (biome, region, seed). Deterministic inputs make the cache semantically
 * invisible; it is bounded so long sessions cannot grow it without end.
 */
const liftCache = new Map<string, SiteLift[]>()
const LIFT_CACHE_MAX = 64

function getRegionSiteLifts(biome: string, regionId?: string, seed = 42): SiteLift[] {
  const water = getRegionWaterBody(biome, regionId, seed)
  if (!water) return []

  const key = `${biome}|${regionId ?? ''}|${seed}`
  const cached = liftCache.get(key)
  if (cached) return cached

  const lifts: SiteLift[] = []
  for (const site of getProtectedSites(regionId, seed)) {
    // Measure the *un-lifted* base at the site centre so a lift never feeds
    // back into its own need; neighbouring sites only ever add height.
    // baseSurfaceHeight takes plane-local coords: local y = -world z.
    const base = baseSurfaceHeight(biome, site.x, -site.z, regionId, seed)
    const need = water.level + DRY_SITE_CLEARANCE - base
    const resolved = drySiteLift(need)
    if (resolved) {
      lifts.push({ x: site.x, z: site.z, height: resolved.height, radius: resolved.radius })
    }
  }

  if (liftCache.size >= LIFT_CACHE_MAX) liftCache.clear()
  liftCache.set(key, lifts)
  return lifts
}

/**
 * Terrain relief per biome, in the ground plane's *local* coordinates.
 *
 * `BiomeTerrain` displaces a `PlaneGeometry` that is later rotated -90° about
 * X, so the plane's local Y is the world's -Z. Everything outside the geometry
 * build wants world coordinates — use `biomeHeightAt` for those.
 */
export function surfaceHeight(
  biome: string,
  x: number,
  y: number,
  regionId?: string,
  seed: number = 42,
): number {
  const base = baseSurfaceHeight(biome, x, y, regionId, seed)

  const lifts = getRegionSiteLifts(biome, regionId, seed)
  if (lifts.length === 0) return base

  // Local (x, y) ↔ world (x, -z); see the note above.
  const worldZ = -y
  let lift = 0
  for (const site of lifts) {
    const d = Math.hypot(x - site.x, worldZ - site.z)
    if (d < site.radius) lift += site.height * hummockFalloff(d, site.radius)
  }
  return base + lift
}

/**
 * Per-region noise seed.
 *
 * Two regions sharing a biome must not be a rotated copy of one another, so the
 * basis is re-seeded rather than only re-phased. Kept small: `hashNoise` folds
 * the seed into a `Math.sin` argument, where a full 32-bit value costs
 * precision without adding variety.
 */
function noiseSeedFor(regionId: string | undefined, seed: number): number {
  return deriveSeed(seed, `${regionId ?? 'generic'}:relief`) % 100003
}

/**
 * The one relief expression, for every biome.
 *
 * A weighted sum of the three noise basis fields, then the biome's geomorphic
 * operators in turn, then its datum and the rim lift. What distinguishes a
 * mountain from a marsh is entirely the row in `BIOME_LANDFORMS` — there is no
 * per-biome branch here to drift out of sync with the table.
 */
function baseSurfaceHeight(
  biome: string,
  x: number,
  y: number,
  regionId?: string,
  seed: number = 42,
): number {
  const dist = Math.hypot(x, y)
  const edge = Math.min(1, dist / BIOME_WORLD_RADIUS)

  const mod = getRegionBiomeModifiers(regionId, seed)
  const cosR = Math.cos(mod.terrainRotation)
  const sinR = Math.sin(mod.terrainRotation)

  // Region-rotated, scaled and phased coordinates — for the noise basis only.
  const rx = (x * cosR - y * sinR) * mod.terrainFreqScale + mod.terrainPhaseX
  const ry = (x * sinR + y * cosR) * mod.terrainFreqScale + mod.terrainPhaseZ

  const basis = noiseBasisAt(noiseSeedFor(regionId, seed), rx, ry)

  const landform = getBiomeLandform(biome)
  const wMacro = landform.weights?.macro ?? DEFAULT_WEIGHTS.macro
  const wRidge = landform.weights?.ridge ?? DEFAULT_WEIGHTS.ridge
  const wMicro = landform.weights?.micro ?? DEFAULT_WEIGHTS.micro

  // macro and micro are centred so they cut as well as lift. ridge is left
  // uncentred: it is a lifted massif creased by ravines, so weighting it raises
  // the biome's floor as well as sharpening it.
  let height =
    ((basis.macro - 0.5) * 2 * wMacro + basis.ridge * wRidge + (basis.micro - 0.5) * 2 * wMicro) *
    landform.amplitude

  // Operators read *world* coordinates, so an authored centre or spine sits in
  // the same frame as landmark anchors and protected sites. Local y = -world z.
  const worldZ = -y
  for (const operator of landform.operators ?? []) {
    height = applyOperator(operator, height, x, worldZ, basis)
  }

  return height + (landform.datum ?? 0) + edge * edge * landform.rimLift
}

/**
 * Ground height at a world XZ position. Everything that stands on the terrain —
 * the player, scatter props, the grove landmark — must go through this, or it
 * floats or sinks wherever the relief is not zero.
 */
export function biomeHeightAt(
  biome: string,
  x: number,
  z: number,
  regionId?: string,
  seed: number = 42,
): number {
  return surfaceHeight(biome, x, -z, regionId, seed)
}
