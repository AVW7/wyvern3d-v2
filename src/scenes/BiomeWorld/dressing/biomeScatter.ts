import type { PropPlacement } from '@/render/assets/props'
import type { BiomeLayer } from '@/render/assets/biomeLibrary'

/** Golden angle. Successive indices land far apart, so a ring never stripes. */
const GOLDEN_ANGLE = 2.399963229728653

export interface ScatterOptions {
  /** Ground height sampler, so a prop rests on the terrain rather than at y=0. */
  heightAt: (x: number, z: number) => number
  /** Minimum radius for every layer, used to keep a landmark's clearing empty. */
  clearing?: number
  /** Scales every layer's count. Above 1 for dense biomes, below for sparse. */
  density?: number
  /** Rotates the whole pattern, so two layers of the same count do not overlap. */
  offset?: number
}

/**
 * Deterministic placements for one dressing layer.
 *
 * Derived entirely from the index — no rng and no Math.random. Two runs of the
 * same biome produce the same forest, which is what makes a biome recognisable
 * between visits without storing a single placement in the save.
 */
export function scatterLayer(layer: BiomeLayer, options: ScatterOptions): PropPlacement[] {
  const { heightAt, clearing = 0, density = 1, offset = 0 } = options
  const count = Math.max(0, Math.round(layer.count * density))
  if (count === 0) return []

  const minRadius = Math.max(layer.radius[0], clearing)
  const maxRadius = Math.max(minRadius, layer.radius[1])
  const [minScale, maxScale] = layer.scale

  return Array.from({ length: count }, (_, index) => {
    // Two independent index-derived sequences: one walks the band, the other
    // walks the circle, so radius and angle do not advance together into a
    // spiral.
    const ratio = count === 1 ? 0 : ((index * 37) % count) / count
    const angle = index * GOLDEN_ANGLE + offset
    const radius = minRadius + ratio * (maxRadius - minRadius)
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    const step = (((index * 17) % 11) / 10) * (maxScale - minScale)
    return {
      position: [x, heightAt(x, z), z] as [number, number, number],
      rotationY: angle + Math.PI * 0.5,
      scale: minScale + step,
    }
  })
}

/**
 * Every layer of a biome, each given its own rotation.
 *
 * Without the per-layer offset two layers with the same count would place every
 * prop of one on top of a prop of the other.
 */
export function scatterBiome(layers: BiomeLayer[], options: ScatterOptions): PropPlacement[][] {
  return layers.map((layer, index) => scatterLayer(layer, { ...options, offset: (options.offset ?? 0) + index * 0.7 }))
}
