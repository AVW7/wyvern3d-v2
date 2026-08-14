import { deriveSeed } from '../../../core/math/rng'
import { REGIONS } from '../../../core/data/regions'

export interface RegionBiomeModifiers {
  regionId: string
  compositionTag: string
  /** Rotation of the terrain high/low elevation features (radians, -PI to PI). */
  terrainRotation: number
  /** Multiplier on procedural terrain frequencies (0.88 - 1.12). */
  terrainFreqScale: number
  /** Phase shift along X axis (0 - 2*PI). */
  terrainPhaseX: number
  /** Phase shift along Z axis (0 - 2*PI). */
  terrainPhaseZ: number
  /** Base rotation applied to scatter prop distributions (0 - 2*PI). */
  scatterRotation: number
  /** Bounded multiplier for prop scatter density (0.85 - 1.20). */
  densityMultiplier: number
  /** Bounded radial shift for scatter distance bands in meters (-3 to +3). */
  radiusBandShift: number
  /** Bounded multiplier for prop scale (0.92 - 1.08). */
  scaleMultiplier: number
}

const DEFAULT_MODIFIERS: RegionBiomeModifiers = {
  regionId: 'generic',
  compositionTag: 'standard',
  terrainRotation: 0,
  terrainFreqScale: 1.0,
  terrainPhaseX: 0,
  terrainPhaseZ: 0,
  scatterRotation: 0,
  densityMultiplier: 1.0,
  radiusBandShift: 0,
  scaleMultiplier: 1.0,
}

function hashFloat(seed: number, text: string, offset: number): number {
  const derived = deriveSeed(seed, `${text}:${offset}`)
  return ((derived >>> 0) % 100000) / 100000
}

/**
 * Purely derives deterministic, bounded region modifiers for terrain and scatter.
 * Guarantees finite values and identical results across remounts, saves, and replays.
 */
export function getRegionBiomeModifiers(
  regionId?: string,
  seed: number = 42,
): RegionBiomeModifiers {
  if (!regionId) return DEFAULT_MODIFIERS

  const regDef = REGIONS[regionId]
  const compositionTag = regDef?.compositionTag ?? 'standard'

  const h0 = hashFloat(seed, `${regionId}:rot`, 0)
  const h1 = hashFloat(seed, `${regionId}:freq`, 1)
  const h2 = hashFloat(seed, `${regionId}:phx`, 2)
  const h3 = hashFloat(seed, `${regionId}:phz`, 3)
  const h4 = hashFloat(seed, `${regionId}:scrot`, 4)
  const h5 = hashFloat(seed, `${regionId}:dens`, 5)
  const h6 = hashFloat(seed, `${regionId}:rad`, 6)
  const h7 = hashFloat(seed, `${regionId}:scale`, 7)

  // Bounded ranges
  const terrainRotation = (h0 * 2 - 1) * Math.PI // -PI to PI
  const terrainFreqScale = 0.88 + h1 * 0.24 // 0.88 - 1.12
  const terrainPhaseX = h2 * Math.PI * 2 // 0 - 2*PI
  const terrainPhaseZ = h3 * Math.PI * 2 // 0 - 2*PI
  const scatterRotation = h4 * Math.PI * 2 // 0 - 2*PI
  const densityMultiplier = 0.85 + h5 * 0.35 // 0.85 - 1.20
  const radiusBandShift = (h6 * 2 - 1) * 3 // -3m to +3m
  const scaleMultiplier = 0.92 + h7 * 0.16 // 0.92 - 1.08

  return {
    regionId,
    compositionTag,
    terrainRotation,
    terrainFreqScale,
    terrainPhaseX,
    terrainPhaseZ,
    scatterRotation,
    densityMultiplier,
    radiusBandShift,
    scaleMultiplier,
  }
}
