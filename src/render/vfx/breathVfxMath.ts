import { BREATH_CONE_HALF_ANGLE } from '@/core/combat/encounter'

/**
 * How long after the action starts the mouth is open enough to breathe through.
 *
 * Measured on the `breath` clip in `public/models/wyvern-gothic.glb`: the jaw
 * leaves its closed pose at f1, crosses 30 degrees of gape at t = 0.375 s and 45
 * at t = 0.458, holds past 45 until t = 1.458, and is back under 30 by t = 1.542
 * — a 51-degree peak against the `attack` bite's 48.1. The clip's own numbers are
 * locked by `render/assets/manifest.breath-clip.test.ts`.
 *
 * Without this lead the burst ignites on the frame the action starts, which is
 * the frame the animal *begins its inhale* — so the fire left a closed mouth.
 * That was invisible for as long as the clip's gape peaked at t = 1.63 s and
 * the burst simply restarted underneath it; re-authoring the clip to open early
 * and hold is what makes the offset worth paying.
 */
export const BREATH_VFX_LEAD_SECONDS = 0.4

/** One visible burst: ignition, held jet, then a short ember-and-smoke tail. */
export const BREATH_VFX_DURATION_SECONDS = 0.85
export const BREATH_VFX_EMBER_COUNT = 20
export const BREATH_VFX_SMOKE_COUNT = 10

/** Lead plus burst — the whole life of one exhale, from trigger to last ember. */
export const BREATH_VFX_TOTAL_SECONDS = BREATH_VFX_LEAD_SECONDS + BREATH_VFX_DURATION_SECONDS

/**
 * Smooth 0 → 1 → 0 envelope, deliberately independent of render frame rate.
 *
 * `elapsed` is measured from the action's first frame, so the lead is subtracted
 * here rather than by every caller.
 */
export function breathEnvelope(elapsed: number): number {
  const burst = elapsed - BREATH_VFX_LEAD_SECONDS
  if (burst <= 0) return 0
  const progress = Math.max(0, Math.min(burst / BREATH_VFX_DURATION_SECONDS, 1))
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
