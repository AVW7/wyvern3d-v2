/**
 * Biome LOD system (Biome Enhancement Stage 6).
 *
 * Pure distance thresholds with hysteresis: a band edge crossed by a metre and
 * immediately re-crossed must not flip a subsystem on and off every frame.
 * Every consumer reads the same `resolveLod` result through the
 * `useBiomeLod` store, so shadows, particles, ambient agents and audio fade
 * agree on one level, and `LodDirector` is the only component that computes
 * distance — no per-subsystem distance math, no per-frame allocations.
 */

export type LodLevel = 'near' | 'mid' | 'far'

/** Distance thresholds in metres (camera → world origin). */
export const LOD_THRESHOLDS = {
  /** Full quality: shadows, full particle count, all agents. */
  near: 80,
  /** Reduced: shadows off, particles halved, agents update at half rate. */
  mid: 140,
} as const

/** Hysteresis band in metres: a level only changes once distance is this far
 * past the threshold, preventing flicker at the boundary. */
export const LOD_HYSTERESIS = 12

/**
 * Resolve the LOD level for a distance given the current level. Pure — the
 * same (distance, current) always yields the same level.
 */
export function resolveLod(distance: number, current: LodLevel = 'near'): LodLevel {
  if (!Number.isFinite(distance)) return current
  if (current === 'near') {
    if (distance > LOD_THRESHOLDS.mid + LOD_HYSTERESIS) return 'far'
    if (distance > LOD_THRESHOLDS.near + LOD_HYSTERESIS) return 'mid'
    return 'near'
  }
  if (current === 'mid') {
    if (distance < LOD_THRESHOLDS.near - LOD_HYSTERESIS) return 'near'
    if (distance > LOD_THRESHOLDS.mid + LOD_HYSTERESIS) return 'far'
    return 'mid'
  }
  // current is 'far'
  if (distance < LOD_THRESHOLDS.near - LOD_HYSTERESIS) return 'near'
  if (distance < LOD_THRESHOLDS.mid - LOD_HYSTERESIS) return 'mid'
  return 'far'
}

export interface LodCapabilities {
  /** Directional shadow casting (the most expensive far-field subsystem). */
  shadows: boolean
  /** Particle count multiplier applied to the authored weather profile. */
  particleScale: number
  /** Ambient agent update-rate divisor (1 = every frame, 2 = every other). */
  agentUpdateRate: number
  /** Ambient agents fully culled. */
  agentsCulled: boolean
  /** Ambience gain multiplier for distance-based audio fade. */
  audioScale: number
}

const CAPABILITIES: Record<LodLevel, LodCapabilities> = {
  near: { shadows: true, particleScale: 1, agentUpdateRate: 1, agentsCulled: false, audioScale: 1 },
  mid: { shadows: false, particleScale: 0.5, agentUpdateRate: 2, agentsCulled: false, audioScale: 0.6 },
  far: { shadows: false, particleScale: 0, agentUpdateRate: 4, agentsCulled: true, audioScale: 0.25 },
}

/** The subsystem capabilities granted by a level. */
export function lodCapabilities(level: LodLevel): LodCapabilities {
  return CAPABILITIES[level]
}
