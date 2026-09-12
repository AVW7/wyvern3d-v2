/**
 * Deterministic noise primitives for biome relief.
 *
 * Ported from the fantasy-biomes studio (`src/math/noise.ts`) so both projects
 * describe terrain with the same primitives and a landform authored in one can
 * be moved to the other as data. Pure functions of (x, z, seed) — no RNG state,
 * no `Math.random`, so they are safe on the replay path and inside a render loop.
 *
 * Frequencies here are in *world metres*. The studio works on 36 m tiles; the
 * biome world is 220 m across, so `BASIS_SCALE` maps the studio's spectrum onto
 * a landscape: macro features span ~100 m, the finest octave ~12 m.
 */

/** Hash of an integer lattice point. Deterministic, cheap, no allocation. */
export function hashNoise(x: number, z: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + z * 78.233 + seed * 0.0017) * 43758.5453
  return n - Math.floor(n)
}

/** Smoothstep-interpolated value noise over the integer lattice. Returns 0..1. */
export function valueNoise2D(x: number, z: number, seed: number): number {
  const xi = Math.floor(x)
  const zi = Math.floor(z)
  const xf = x - xi
  const zf = z - zi
  const u = xf * xf * (3 - 2 * xf)
  const v = zf * zf * (3 - 2 * zf)

  const n00 = hashNoise(xi, zi, seed)
  const n10 = hashNoise(xi + 1, zi, seed)
  const n01 = hashNoise(xi, zi + 1, seed)
  const n11 = hashNoise(xi + 1, zi + 1, seed)

  const nx0 = n00 * (1 - u) + n10 * u
  const nx1 = n01 * (1 - u) + n11 * u
  return nx0 * (1 - v) + nx1 * v
}

/**
 * Domain-warped fractal Brownian motion. Returns 0..1.
 *
 * The warp is what stops the octaves reading as a grid: without it, value noise
 * summed on axis-aligned lattices keeps a visible square grain at every scale.
 */
export function fbmField(x: number, z: number, seed: number, octaves = 4): number {
  const warpX = (valueNoise2D(x * 0.22, z * 0.22, seed + 101) - 0.5) * 1.8
  const warpZ = (valueNoise2D(x * 0.22 + 31.7, z * 0.22 + 19.3, seed + 203) - 0.5) * 1.8
  const wx = x + warpX
  const wz = z + warpZ

  let total = 0
  let amplitude = 1
  let frequency = 0.28
  let maxAmp = 0

  for (let o = 0; o < octaves; o += 1) {
    total += valueNoise2D(wx * frequency, wz * frequency, seed + o * 43) * amplitude
    maxAmp += amplitude
    amplitude *= 0.5
    frequency *= 2.04
  }
  return total / maxAmp
}

/** Inverted-absolute fbm: creases into sharp crests instead of rounded hills. Returns 0..1. */
export function ridgeField(x: number, z: number, seed: number): number {
  const n = Math.abs(fbmField(x * 1.4, z * 1.4, seed + 512, 3) * 2 - 1)
  return (1 - n) * (1 - n)
}

/** World-metre scale for the macro/ridge spectrum. 1 / 0.035 ≈ 29 m per noise unit. */
export const BASIS_SCALE = 0.035

/** World-metre scale for the micro field. Wavelength ≈ 14 m — bumps, not grass. */
export const MICRO_SCALE = 0.07

/**
 * The three fields every landform composes from.
 *
 * `macro` is the rolling body of the terrain, `ridge` the crests laid over it,
 * `micro` the metre-scale surface break-up. Each is 0..1; `landformHeightAt`
 * centres and weights them.
 */
export interface NoiseBasis {
  macro: number
  ridge: number
  micro: number
}

export function noiseBasisAt(seed: number, x: number, z: number): NoiseBasis {
  return {
    macro: fbmField(x * BASIS_SCALE, z * BASIS_SCALE, seed, 4),
    ridge: ridgeField(x * BASIS_SCALE, z * BASIS_SCALE, seed),
    micro: valueNoise2D(x * MICRO_SCALE, z * MICRO_SCALE, seed + 991),
  }
}
