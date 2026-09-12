/**
 * Geomorphic landform operators.
 *
 * Ported from the fantasy-biomes studio (`src/math/geomorphicOperators.ts`).
 * Each operator takes the height accumulated so far at a point and returns the
 * height after it, so a biome's relief is a weighted noise sum followed by a
 * chain of operators — data, not a branch per biome.
 *
 * They are pointwise on purpose. `biomeHeightAt` is sampled at arbitrary
 * coordinates by the player, scatter, colliders, landmarks and the water lifts,
 * so an operator that needed its neighbours could not live here.
 *
 * Coordinates are **world** x/z metres. `baseSurfaceHeight` converts the ground
 * plane's local frame before calling in, so an authored centre or spine is in
 * the same space as every landmark anchor and protected site.
 */

import type { NoiseBasis } from './terrainNoise'

export type GeomorphicOperator =
  /** Add a scaled basis field on top of the weighted sum. */
  | { kind: 'noiseBoost'; field: 'macro' | 'ridge' | 'micro'; amount: number }
  /** Transverse dune waves, phase-warped by the macro field. */
  | { kind: 'dune'; amount: number; frequency: number; skew?: number; warp?: number }
  /** Conical depression — the floor of a caldera or a sunken bowl. */
  | { kind: 'basin'; amount: number; radius: number; center?: [number, number] }
  /** Gaussian ring — the raised lip around a basin. */
  | { kind: 'rim'; amount: number; radius: number; falloff: number; center?: [number, number] }
  /** Parabolic cavity with a sine rim, as one operator. */
  | { kind: 'crater'; amount: number; radius: number; depth: number; rimHeight: number; center?: [number, number] }
  /** Elevated spine between two points, cosine-squared across its width. */
  | { kind: 'ridgeSpine'; amount: number; from: [number, number]; to: [number, number]; width: number }
  /**
   * Quantise elevation into stepped benches, `stepHeight` metres apart.
   *
   * The studio spells this as `steps` — benches per *unit* height — which works
   * on its 1-3 unit tiles but silently becomes a no-op here, where a mountain
   * spans 17 metres and `steps: 7` would mean 14 cm treads. Metres are the unit
   * that survives the move; the ported `terraceAt` below is unchanged.
   */
  | { kind: 'terrace'; amount: number; stepHeight: number; smoothness?: number }
  /** Blend a disc toward a target height with a cosine edge. */
  | { kind: 'plateau'; amount: number; center?: [number, number]; radius: number; height: number; blend?: number }

function distanceTo(x: number, z: number, center: [number, number] | undefined): number {
  return Math.hypot(x - (center?.[0] ?? 0), z - (center?.[1] ?? 0))
}

/** Transverse dune waves whose phase is warped by the macro field. */
export function duneAt(x: number, z: number, macro: number, frequency: number, skew = 0, warp = 0): number {
  return Math.sin((x + z * skew) * frequency + macro * warp)
}

/** Conical depression: full depth at the centre, zero at `radius`. */
export function basinAt(distance: number, radius: number): number {
  return Math.max(0, radius - distance)
}

/** Gaussian ring peaking at `radius`. */
export function rimAt(distance: number, radius: number, falloff: number): number {
  return Math.exp(-Math.pow(distance - radius, 2) / falloff)
}

/**
 * Parabolic cavity inside `radius` with a sine rim in the surrounding band.
 * Returns the signed offset, negative inside the cavity.
 */
export function craterAt(distance: number, radius: number, depth: number, rimHeight: number): number {
  if (distance <= radius) {
    return -depth * Math.cos((distance / radius) * (Math.PI / 2))
  }
  const rimWidth = radius * 0.4
  if (distance <= radius + rimWidth) {
    return rimHeight * Math.sin(((distance - radius) / rimWidth) * Math.PI)
  }
  return 0
}

/** Elevated spine along a segment, cosine-squared across its width. Returns 0..1. */
export function ridgeSpineAt(
  x: number,
  z: number,
  from: [number, number],
  to: [number, number],
  width: number,
): number {
  const segX = to[0] - from[0]
  const segZ = to[1] - from[1]
  const segLenSq = segX * segX + segZ * segZ
  if (segLenSq === 0 || width <= 0) return 0

  const t = Math.max(0, Math.min(1, ((x - from[0]) * segX + (z - from[1]) * segZ) / segLenSq))
  const distance = Math.hypot(x - (from[0] + t * segX), z - (from[1] + t * segZ))
  if (distance >= width) return 0

  const factor = Math.cos((distance / width) * (Math.PI / 2))
  return factor * factor
}

/** Quantise a height into stepped benches, smoothstep-shaped inside each step. */
export function terraceAt(height: number, steps: number, smoothness: number): number {
  const stepSize = 1 / Math.max(1, steps)
  const smoothFactor = Math.max(0.01, Math.min(1, smoothness))
  const stepBase = Math.floor(height / stepSize) * stepSize
  const fraction = (height - stepBase) / stepSize
  const shaped = fraction * fraction * (3 - 2 * fraction)
  const terraced = stepBase + shaped * stepSize * smoothFactor
  return height * (1 - smoothFactor) + terraced * smoothFactor
}

/** Blend weight toward a plateau: 1 inside `radius`, easing to 0 across `blend`. */
export function plateauWeightAt(distance: number, radius: number, blend: number): number {
  if (distance <= radius) return 1
  const outer = radius + Math.max(1e-6, blend)
  if (distance >= outer) return 0
  return (1 + Math.cos(((distance - radius) / (outer - radius)) * Math.PI)) / 2
}

/**
 * Apply one operator to the height accumulated so far. `amount` is the operator
 * weight: for additive operators it scales the contribution, for shaping
 * operators (terrace, plateau) it blends between before and after.
 */
export function applyOperator(
  operator: GeomorphicOperator,
  height: number,
  x: number,
  z: number,
  basis: NoiseBasis,
): number {
  switch (operator.kind) {
    case 'noiseBoost':
      return height + basis[operator.field] * operator.amount
    case 'dune':
      return height + duneAt(x, z, basis.macro, operator.frequency, operator.skew, operator.warp) * operator.amount
    case 'basin':
      return height - basinAt(distanceTo(x, z, operator.center), operator.radius) * operator.amount
    case 'rim':
      return height + rimAt(distanceTo(x, z, operator.center), operator.radius, operator.falloff) * operator.amount
    case 'crater':
      return (
        height +
        craterAt(distanceTo(x, z, operator.center), operator.radius, operator.depth, operator.rimHeight) *
          operator.amount
      )
    case 'ridgeSpine':
      return height + ridgeSpineAt(x, z, operator.from, operator.to, operator.width) * operator.amount
    case 'terrace': {
      // Normalise into the primitive's unit-tread frame, then back to metres.
      const step = Math.max(1e-3, operator.stepHeight)
      const terraced = terraceAt(height / step, 1, operator.smoothness ?? 0.5) * step
      return height + (terraced - height) * operator.amount
    }
    case 'plateau': {
      const weight = plateauWeightAt(distanceTo(x, z, operator.center), operator.radius, operator.blend ?? 0.5)
      return height + (operator.height - height) * weight * operator.amount
    }
  }
}
