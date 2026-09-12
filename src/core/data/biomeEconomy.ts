import type { ResourceId } from '../types'

export const WYVERN_TERRAIN_CLASSES = [
  'valley', 'forest', 'coast', 'marsh', 'moor', 'swamp', 'mountain', 'highland',
  'cavern', 'jungle', 'grove', 'ashland', 'tundra', 'barrens', 'spire',
] as const

export type WyvernTerrainClass = (typeof WYVERN_TERRAIN_CLASSES)[number]
export type BiomeYieldProfile = Partial<Record<ResourceId, number>>

/** Pure gameplay data. This intentionally does not exist in the studio contract. */
export const BIOME_YIELD_PROFILES: Record<WyvernTerrainClass, BiomeYieldProfile> = {
  valley: { food: 3, gold: 2, timber: 2 },
  forest: { timber: 5, food: 3 },
  coast: { gold: 4, food: 3 },
  marsh: { food: 3, timber: 3 },
  moor: { gold: 3, ore: 2 },
  swamp: { food: 5, arcane: 2 },
  mountain: { ore: 6, gold: 2 },
  highland: { ore: 4, gold: 3, timber: 2 },
  cavern: { arcane: 5, ore: 3, gold: 2 },
  jungle: { food: 6, arcane: 2 },
  grove: { arcane: 4, timber: 4, food: 3 },
  ashland: { arcane: 4, ore: 3, gold: 3 },
  tundra: { arcane: 5, ore: 4 },
  barrens: { arcane: 5, gold: 5 },
  spire: { arcane: 8, gold: 7, ore: 4 },
}

export const BIOME_YIELD_ANOMALIES = [
  {
    region: 'glaciercrest', biome: 'tundra', field: 'timber', authored: 4,
    reason: 'A glacial waste with lichen has nothing to log; review whether the region has an unstated forested margin.',
  },
  {
    region: 'hollowmoor', biome: 'barrens', field: 'ore', authored: 0,
    reason: 'Sulfur crust with active vents yields no ore while the less mineralised moor yields two; review as an authored exception.',
  },
] as const
