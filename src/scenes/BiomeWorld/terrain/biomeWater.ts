import { unitFromSeed } from '@/core/math/rng'
import { getRegionLandmarkAnchors } from '../discovery/landmarkAnchors'
import { getRegionObservationVantage } from '../ecology/observationVantage'

/**
 * Biome water bodies — the animated sea, fen and lava planes of water biomes.
 *
 * Pure, deterministic companion to the terrain height field. Two jobs:
 *
 * 1. Describe the water itself: level, palette, churn speed, wave amplitude.
 *    The level jitters per region (seeded by region id) so two coasts never
 *    sit at exactly the same tide, but stays inside a tight authored band.
 * 2. Enumerate the *protected sites* a region must keep dry — arrival spawn,
 *    landing clearings, landmark anchors, observation vantage. The height
 *    field lifts a smooth hummock under each (see `biomeHeight.ts`), which is
 *    what lets a fen flood its hollows while every contract site stays dry.
 *
 * This module never imports the height field (that dependency points the
 * other way), so there is no import cycle through the terrain.
 */

export type BiomeWaterKind = 'sea' | 'bog' | 'lava'

export interface BiomeWaterBody {
  kind: BiomeWaterKind
  /** World Y of the surface. Authored per biome, lightly jittered per region. */
  level: number
  colorShallow: string
  colorDeep: string
  colorFoam: string
  /** Animation speed multiplier (wave scroll, foam churn). */
  speed: number
  /** Vertex wave amplitude multiplier. */
  waveAmp: number
  opacity: number
  /** Water plane size relative to BIOME_WORLD_RADIUS (1 = exactly the disc). */
  extent: number
  /** Plane subdivisions per side; more = smoother shoreline foam. */
  segments: number
  /** Lava renders as emissive crust instead of reflective water. */
  glow: number
}

interface WaterVocabulary extends Omit<BiomeWaterBody, 'level'> {
  /** Authored nominal level. */
  baseLevel: number
  /** Per-region jitter band around baseLevel. */
  jitter: number
}

const VOCABULARY: Record<string, WaterVocabulary> = {
  coast: {
    kind: 'sea',
    baseLevel: -0.6,
    jitter: 0.12,
    colorShallow: '#5fb8d8',
    colorDeep: '#0c4a6e',
    colorFoam: '#e8f6fb',
    speed: 1.0,
    waveAmp: 1.0,
    opacity: 0.86,
    extent: 1.25,
    segments: 96,
    glow: 0,
  },
  marsh: {
    kind: 'bog',
    baseLevel: -0.3,
    jitter: 0.08,
    colorShallow: '#5c7a52',
    colorDeep: '#1d3226',
    colorFoam: '#cfe3c8',
    speed: 0.45,
    waveAmp: 0.5,
    opacity: 0.82,
    extent: 1.0,
    segments: 72,
    glow: 0,
  },
  swamp: {
    kind: 'bog',
    baseLevel: -0.35,
    jitter: 0.08,
    colorShallow: '#48604a',
    colorDeep: '#141f18',
    colorFoam: '#b9ccaf',
    speed: 0.35,
    waveAmp: 0.45,
    opacity: 0.84,
    extent: 1.0,
    segments: 72,
    glow: 0,
  },
  ashland: {
    kind: 'lava',
    baseLevel: -0.5,
    jitter: 0.1,
    colorShallow: '#f97316',
    colorDeep: '#3b1210',
    colorFoam: '#ffd280',
    speed: 0.3,
    waveAmp: 0.6,
    opacity: 0.95,
    extent: 1.0,
    segments: 72,
    glow: 1,
  },
}

/**
 * The water body a region carries, or null when its biome has none. The level
 * is deterministic from (region id, seed) and bounded to the authored band.
 */
export function getRegionWaterBody(
  biome: string,
  regionId?: string,
  seed = 42,
): BiomeWaterBody | null {
  const vocab = VOCABULARY[biome]
  if (!vocab) return null

  const jitter = regionId
    ? (unitFromSeed(seed, `${regionId}:water-level`) * 2 - 1) * vocab.jitter
    : 0

  const { baseLevel, ...rest } = vocab
  return { ...rest, level: baseLevel + jitter }
}

/** How far above the surface every protected site must sit, in metres. */
export const DRY_SITE_CLEARANCE = 0.35

export type ProtectedSiteKind = 'spawn' | 'landing' | 'landmark' | 'vantage'

export interface ProtectedSite {
  kind: ProtectedSiteKind
  x: number
  z: number
}

/**
 * Fixed gameplay sites, kept in sync with `biomeTraversal`'s spawn anchor and
 * landing clearings by test (importing them here would create a cycle through
 * the height field, which imports this module).
 */
const SPAWN_SITE: [number, number] = [0, -18]
const LANDING_SITES: ReadonlyArray<[number, number]> = [
  [0, 28],
  [28, 0],
  [-28, 0],
]

/**
 * Every site a water biome must keep dry for this region: the arrival spawn,
 * the three aerial touchdown clearings, the landmark anchors the atlas
 * surveys, and the observation vantage. All derived — revisiting a region
 * always finds the same islets.
 */
export function getProtectedSites(regionId?: string, seed = 42): ProtectedSite[] {
  const sites: ProtectedSite[] = [
    { kind: 'spawn', x: SPAWN_SITE[0], z: SPAWN_SITE[1] },
    ...LANDING_SITES.map(([x, z]) => ({ kind: 'landing' as const, x, z })),
  ]

  if (!regionId) return sites

  for (const anchor of getRegionLandmarkAnchors(regionId, seed)) {
    sites.push({ kind: 'landmark', x: anchor.x, z: anchor.z })
  }

  const vantage = getRegionObservationVantage(regionId, seed)
  if (vantage) {
    sites.push({ kind: 'vantage', x: vantage.x, z: vantage.z })
  }

  return sites
}

/**
 * Height the terrain must gain at a protected site so it clears the water.
 *
 * `siteBaseHeight` is the *un-lifted* height at the site centre (the caller
 * supplies it so the lift never feeds back into itself). Returns the needed
 * lift and the hummock radius that keeps the bump's flank below the landing
 * slope limit: for a cosine bump of height `need` over radius `R` the steepest
 * gradient is `need * PI / (2R)`, so `R >= need * 5.5` bounds it at ~0.286
 * (atan ≈ 0.28 rad, under MAX_LANDING_SLOPE's 0.35) for any need.
 */
export function drySiteLift(
  need: number,
): { height: number; radius: number } | null {
  if (need <= 0) return null
  const radius = Math.min(14, Math.max(8, need * 5.5))
  return { height: need, radius }
}

/** Cosine bump contribution at distance `d` from a hummock centre. */
export function hummockFalloff(d: number, radius: number): number {
  if (d >= radius) return 0
  return 0.5 * (1 + Math.cos((Math.PI * d) / radius))
}
