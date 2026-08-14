import type { PropPlacement } from '@/render/assets/props'
import type { BiomeLayer } from '@/render/assets/biomeLibrary'
import { getRegionBiomeModifiers } from '../terrain/regionModifiers'

/** Golden angle. Successive indices land far apart, so a ring never stripes. */
const GOLDEN_ANGLE = 2.399963229728653

/** Arrival clearance radius around SPAWN [0, -18] in meters. */
const SPAWN_CLEARANCE_RADIUS = 5.0

export interface ScatterOptions {
  /** Ground height sampler, so a prop rests on the terrain rather than at y=0. */
  heightAt: (x: number, z: number) => number
  /** Minimum radius for every layer, used to keep a landmark's clearing empty. */
  clearing?: number
  /** Scales every layer's count. Above 1 for dense biomes, below for sparse. */
  density?: number
  /** Rotates the whole pattern, so two layers of the same count do not overlap. */
  offset?: number
  /** Optional regionId to derive deterministic region-specific scattering. */
  regionId?: string
  /** World seed for deterministic hashing. */
  seed?: number
}

/**
 * Deterministic placements for one dressing layer.
 *
 * Derived from layer config + deterministic region modifiers + instance index.
 * No global RNG and no Math.random. Two runs of the same region/seed produce the
 * identical forest, while two regions in the same biome receive distinct layouts.
 */
export function scatterLayer(layer: BiomeLayer, options: ScatterOptions): PropPlacement[] {
  const { heightAt, clearing = 0, density = 1, offset = 0, regionId, seed = 42 } = options

  const mod = getRegionBiomeModifiers(regionId, seed)
  const effectiveDensity = density * mod.densityMultiplier
  const count = Math.max(0, Math.round(layer.count * effectiveDensity))
  if (count === 0) return []

  const rawMin = Math.max(0, layer.radius[0] + mod.radiusBandShift)
  const rawMax = Math.max(rawMin + 2, layer.radius[1] + mod.radiusBandShift)

  const minRadius = Math.max(rawMin, clearing)
  const maxRadius = Math.max(minRadius, rawMax)
  const [minScale, maxScale] = layer.scale

  const placements: PropPlacement[] = []

  for (let index = 0; index < count; index++) {
    // Two independent index-derived sequences: one walks the band, the other
    // walks the circle, so radius and angle do not advance together into a spiral.
    const ratio = count === 1 ? 0 : ((index * 37) % count) / count
    const angle = index * GOLDEN_ANGLE + offset + mod.scatterRotation
    const radius = minRadius + ratio * (maxRadius - minRadius)
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius

    // Enforce central clearing
    if (Math.hypot(x, z) < clearing) continue

    // Enforce arrival spawn clearance around [0, -18]
    if (Math.hypot(x - 0, z - (-18)) < SPAWN_CLEARANCE_RADIUS) continue

    const step = (((index * 17) % 11) / 10) * (maxScale - minScale)
    const finalScale = (minScale + step) * mod.scaleMultiplier

    placements.push({
      position: [x, heightAt(x, z), z] as [number, number, number],
      rotationY: angle + Math.PI * 0.5,
      scale: finalScale,
    })
  }

  return placements
}

/**
 * Every layer of a biome, each given its own rotation and layer seed offset.
 *
 * Without the per-layer offset two layers with the same count would place every
 * prop of one on top of a prop of the other.
 */
export function scatterBiome(layers: BiomeLayer[], options: ScatterOptions): PropPlacement[][] {
  return layers.map((layer, index) =>
    scatterLayer(layer, {
      ...options,
      offset: (options.offset ?? 0) + index * 0.7,
    }),
  )
}
