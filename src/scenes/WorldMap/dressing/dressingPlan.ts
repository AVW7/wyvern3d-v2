import { REGION_LIST } from '../../../core/data/regions'
import { createRng, deriveSeed } from '../../../core/math/rng'
import { mapHeightAt, plateauRadius } from '../terrain/mapTerrain'

export interface PropPlacement {
  propId: string
  position: [number, number, number]
  rotationY: number
  scale: number
  wind?: number
}

interface BiomeDressingConfig {
  propId: string
  count: number
  minR: number
  maxR: number
  scale: number
  wind?: number
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
    { propId: 'prop.scatter.hill', count: 3, minR: 4, maxR: 13, scale: 1.4 },
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

export function planDressing(seed: number = 42): Record<string, PropPlacement[]> {
  const rng = createRng(deriveSeed(seed, 'worldmap:dressing'))
  const result: Record<string, PropPlacement[]> = {}

  for (const def of REGION_LIST) {
    const configs = BIOME_DRESSING[def.biome] ?? BIOME_DRESSING['valley']!
    const baseR = plateauRadius(def) + 1.0
    let globalIndex = 0

    for (const cfg of configs) {
      if (!result[cfg.propId]) {
        result[cfg.propId] = []
      }

      for (let i = 0; i < cfg.count; i++) {
        const theta = globalIndex * GOLDEN_ANGLE
        const radius = baseR + (cfg.minR + (cfg.maxR - cfg.minR) * rng.next())
        const x = def.position.x + Math.cos(theta) * radius
        const z = def.position.z + Math.sin(theta) * radius
        const y = mapHeightAt(x, z)
        const rotY = rng.next() * Math.PI * 2

        result[cfg.propId]!.push({
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
