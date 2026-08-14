import { Color } from 'three'
import { REGION_LIST } from '../../../core/data/regions'
import { createRng, deriveSeed } from '../../../core/math/rng'
import { BIOME_PALETTES } from '../../BiomeWorld/atmosphere/biomePalettes'
import { mapHeightAt, plateauRadius } from '../terrain/mapTerrain'

export interface PropPlacement {
  propId: string
  position: [number, number, number]
  rotationY: number
  scale: number
  wind?: number
}

export interface DressingGroup {
  propId: string
  /** Biome tint, so the prop reads as part of the terrain it stands on. */
  color: string
  items: PropPlacement[]
}

interface BiomeDressingConfig {
  propId: string
  count: number
  minR: number
  maxR: number
  scale: number
  wind?: number
  /**
   * Metres to sink the prop below the terrain surface. Landform props — the
   * hill in particular — are meant to read as relief, not as objects resting on
   * the ground, which is how Highlands and the sanctuary seat them too.
   */
  sink?: number
}

export const BIOME_DRESSING: Record<string, BiomeDressingConfig[]> = {
  valley: [
    { propId: 'prop.scatter.firA', count: 4, minR: 4, maxR: 12, scale: 1.2, wind: 0.5 },
    { propId: 'prop.fenceA', count: 2, minR: 3, maxR: 8, scale: 1.0 },
    { propId: 'prop.scatter.grassB', count: 6, minR: 2, maxR: 14, scale: 1.0, wind: 0.8 },
  ],
  coast: [
    { propId: 'prop.perch.rockA', count: 4, minR: 3, maxR: 10, scale: 1.4 },
    { propId: 'prop.perch.rockB', count: 3, minR: 4, maxR: 12, scale: 1.2 },
    { propId: 'prop.scatter.grassA', count: 5, minR: 2, maxR: 10, scale: 1.0, wind: 0.6 },
  ],
  forest: [
    { propId: 'prop.scatter.firA', count: 6, minR: 3, maxR: 14, scale: 1.5, wind: 0.6 },
    { propId: 'prop.scatter.firB', count: 5, minR: 4, maxR: 15, scale: 1.3, wind: 0.6 },
    { propId: 'prop.scatter.grassA', count: 8, minR: 2, maxR: 12, scale: 1.0, wind: 0.8 },
  ],
  marsh: [
    { propId: 'prop.scatter.deadTree', count: 4, minR: 3, maxR: 12, scale: 1.2 },
    { propId: 'prop.perch.stump', count: 3, minR: 3, maxR: 10, scale: 1.1 },
    { propId: 'prop.scatter.grassB', count: 6, minR: 2, maxR: 14, scale: 1.0, wind: 0.7 },
  ],
  moor: [
    { propId: 'prop.scatter.mysticStone', count: 3, minR: 4, maxR: 12, scale: 1.2 },
    { propId: 'prop.perch.rockB', count: 4, minR: 3, maxR: 11, scale: 1.3 },
    { propId: 'prop.scatter.grassB', count: 6, minR: 2, maxR: 14, scale: 1.0, wind: 0.9 },
  ],
  highland: [
    { propId: 'prop.scatter.hill', count: 3, minR: 4, maxR: 13, scale: 0.9, sink: 2.2 },
    { propId: 'prop.perch.rockA', count: 4, minR: 3, maxR: 11, scale: 1.2 },
    { propId: 'prop.keep.pillar', count: 2, minR: 5, maxR: 10, scale: 1.0 },
  ],
  mountain: [
    { propId: 'prop.perch.rockA', count: 5, minR: 3, maxR: 12, scale: 1.5 },
    { propId: 'prop.keep.pillar', count: 3, minR: 4, maxR: 10, scale: 1.2 },
    { propId: 'prop.scatter.firC', count: 3, minR: 5, maxR: 14, scale: 1.1, wind: 0.4 },
  ],
  cavern: [
    { propId: 'prop.roost.plateau', count: 3, minR: 4, maxR: 11, scale: 1.0 },
    { propId: 'prop.roost.runeStone', count: 4, minR: 3, maxR: 10, scale: 1.2 },
  ],
  jungle: [
    { propId: 'prop.scatter.firB', count: 6, minR: 3, maxR: 14, scale: 1.4, wind: 0.7 },
    { propId: 'prop.perch.trunk', count: 3, minR: 4, maxR: 10, scale: 1.2 },
    { propId: 'prop.scatter.grassA', count: 8, minR: 2, maxR: 12, scale: 1.0, wind: 0.9 },
  ],
  grove: [
    { propId: 'prop.scatter.firA', count: 5, minR: 3, maxR: 13, scale: 1.4, wind: 0.5 },
    { propId: 'prop.perch.stump', count: 3, minR: 3, maxR: 9, scale: 1.1 },
    { propId: 'prop.scatter.grassB', count: 6, minR: 2, maxR: 12, scale: 1.0, wind: 0.8 },
  ],
  swamp: [
    { propId: 'prop.scatter.deadTree', count: 5, minR: 3, maxR: 13, scale: 1.3 },
    { propId: 'prop.perch.stump', count: 4, minR: 3, maxR: 10, scale: 1.2 },
    { propId: 'prop.scatter.grassB', count: 6, minR: 2, maxR: 14, scale: 1.0, wind: 0.6 },
  ],
  ashland: [
    { propId: 'prop.burn.burnedTree', count: 5, minR: 3, maxR: 12, scale: 1.3 },
    { propId: 'prop.burn.lavaStone', count: 4, minR: 4, maxR: 11, scale: 1.2 },
  ],
  tundra: [
    { propId: 'prop.scatter.deadTree', count: 4, minR: 4, maxR: 12, scale: 1.2 },
    { propId: 'prop.perch.rockB', count: 4, minR: 3, maxR: 11, scale: 1.3 },
  ],
  barrens: [
    { propId: 'prop.perch.rockB', count: 5, minR: 3, maxR: 12, scale: 1.4 },
    { propId: 'prop.scatter.deadTree', count: 3, minR: 4, maxR: 10, scale: 1.1 },
  ],
  spire: [
    { propId: 'prop.ring.columnA', count: 3, minR: 4, maxR: 10, scale: 1.2 },
    { propId: 'prop.ring.menhir', count: 2, minR: 5, maxR: 12, scale: 1.3 },
  ],
}

const GOLDEN_ANGLE = 2.399963229728653

/**
 * The tint a biome's dressing takes. It is the biome ground colour the terrain
 * mesh already uses, stepped down to the low end of `mapColorAt`'s own height
 * factor — the props sit near the terrain's base, and the atlas texture the
 * tint multiplies is far brighter than the flat vertex colours around it.
 */
const TINT_CACHE: Record<string, string> = {}

export function dressingTint(biome: string): string {
  const cached = TINT_CACHE[biome]
  if (cached) return cached
  const base = BIOME_PALETTES[biome]?.groundColor ?? '#4a6042'
  const hex = `#${new Color(base).multiplyScalar(0.8).getHexString()}`
  TINT_CACHE[biome] = hex
  return hex
}

/**
 * Groups are keyed by prop *and* biome rather than by prop alone: the tint is a
 * per-biome value, and one InstancedMesh carries one material. Splitting a
 * prop across the biomes that use it costs a handful of draw calls and is what
 * stops a moss-green atlas hill from sitting on a slate-grey highland.
 */
export function planDressing(seed: number = 42): Record<string, DressingGroup> {
  const rng = createRng(deriveSeed(seed, 'worldmap:dressing'))
  const result: Record<string, DressingGroup> = {}

  for (const def of REGION_LIST) {
    const configs = BIOME_DRESSING[def.biome] ?? BIOME_DRESSING['valley']!
    const baseR = plateauRadius(def) + 1.0
    const color = dressingTint(def.biome)
    let globalIndex = 0

    for (const cfg of configs) {
      const key = `${cfg.propId}@${def.biome}`
      if (!result[key]) {
        result[key] = { propId: cfg.propId, color, items: [] }
      }

      for (let i = 0; i < cfg.count; i++) {
        const theta = globalIndex * GOLDEN_ANGLE
        const radius = baseR + (cfg.minR + (cfg.maxR - cfg.minR) * rng.next())
        const x = def.position.x + Math.cos(theta) * radius
        const z = def.position.z + Math.sin(theta) * radius
        const y = mapHeightAt(x, z) - (cfg.sink ?? 0)
        const rotY = rng.next() * Math.PI * 2

        result[key]!.items.push({
          propId: cfg.propId,
          position: [x, y, z],
          rotationY: rotY,
          scale: cfg.scale * (0.85 + rng.next() * 0.3),
          wind: cfg.wind,
        })

        globalIndex++
      }
    }
  }

  return result
}
