import { BREATH_CONE_HALF_ANGLE } from '@/core/combat/encounter'

/** One visible burst: ignition, held jet, then a short ember-and-smoke tail. */
export const BREATH_VFX_DURATION_SECONDS = 0.85
export const BREATH_VFX_EMBER_COUNT = 20
export const BREATH_VFX_SMOKE_COUNT = 10

/** Smooth 0 → 1 → 0 envelope, deliberately independent of render frame rate. */
export function breathEnvelope(elapsed: number): number {
  const progress = Math.max(0, Math.min(elapsed / BREATH_VFX_DURATION_SECONDS, 1))
  const ignition = Math.min(progress / 0.12, 1)
  const release = 1 - Math.max(0, (progress - 0.58) / 0.42)
  return Math.max(0, Math.min(1, ignition * release))
}

/** Radius of the damage cone at a distance from its origin, in world units. */
export function breathRadiusAt(distance: number): number {
  return Math.max(0, distance) * Math.tan(BREATH_CONE_HALF_ANGLE)
}

/** A stable visual seed: cosmetics never consume the deterministic combat RNG. */
export function breathSeed(index: number, channel: number, seed: number): number {
  const value = Math.sin((index + 1) * 12.9898 + (channel + 1) * 78.233 + seed * 0.618)
  return value - Math.floor(value)
}
