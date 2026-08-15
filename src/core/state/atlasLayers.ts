import type { GameState } from '../types'
import { REGIONS } from '../data/regions'
import { SPECIES } from '../data/species'
import {
  ensureAtlasKnowledge,
  isRegionMapped,
  isRegionVisited,
} from './atlasKnowledge'

/**
 * 7 Mutually Exclusive Strategic Map Layers (World Atlas Stage 3).
 *
 * 1. `political` — Reachability, player ownership, locked status.
 * 2. `biome` — Terrain classification and climate identity.
 * 3. `yields` — Economic resource production capacity (Gold/Meat/Iron/Stone).
 * 4. `unrest` — Rebel risk & stability levels (0–100%).
 * 5. `garrison` — Garrison combat strength.
 * 6. `species` — Native wyvern species habitat.
 * 7. `exploration` — Visited state & landmark discovery progress.
 */
export type AtlasLayerId =
  | 'political'
  | 'biome'
  | 'yields'
  | 'unrest'
  | 'garrison'
  | 'species'
  | 'exploration'

export interface AtlasLayerDef {
  id: AtlasLayerId
  name: string
  shortLabel: string
  description: string
  iconName: string
}

export const ATLAS_LAYERS: Record<AtlasLayerId, AtlasLayerDef> = {
  political: {
    id: 'political',
    name: 'Political & Reachability',
    shortLabel: 'Political',
    description: 'Controlled territories, attackable frontiers, and locked provinces.',
    iconName: 'flag',
  },
  biome: {
    id: 'biome',
    name: 'Biome & Ecology',
    shortLabel: 'Biome',
    description: 'Terrain environments, climate zones, and ecological classifications.',
    iconName: 'mountain',
  },
  yields: {
    id: 'yields',
    name: 'Resource Yields',
    shortLabel: 'Yields',
    description: 'Combined economic yield output (gold, meat, iron, stone) per turn.',
    iconName: 'coins',
  },
  unrest: {
    id: 'unrest',
    name: 'Unrest & Stability',
    shortLabel: 'Unrest',
    description: 'Rebellion risk and civic unrest percentage in conquered territories.',
    iconName: 'flame',
  },
  garrison: {
    id: 'garrison',
    name: 'Garrison Strength',
    shortLabel: 'Garrison',
    description: 'Defending garrison troop power and fort fortification density.',
    iconName: 'shield',
  },
  species: {
    id: 'species',
    name: 'Native Species',
    shortLabel: 'Species',
    description: 'Native wyvern breed habitats and nesting territories.',
    iconName: 'paw',
  },
  exploration: {
    id: 'exploration',
    name: 'Exploration Progress',
    shortLabel: 'Atlas',
    description: 'Chartered regions, visited biomes, and discovered landmark counts.',
    iconName: 'compass',
  },
}

export const ATLAS_LAYER_LIST: AtlasLayerDef[] = Object.values(ATLAS_LAYERS)

export interface LayerRegionValue {
  regionId: string
  /** Normalized visual scalar [0.0, 1.0] for sizing, brightness, or color ramps. */
  normalized: number
  /** Primary display value (e.g. "85%", "450 Power", "Grasslands", "Unknown"). */
  displayValue: string
  /** Secondary detail or subtitle (e.g. "+12 Gold/t", "3/3 Landmarks"). */
  detail: string
  /** Dominant thematic color code for this layer item. */
  color: string
  /** True if this information is currently hidden by knowledge gating. */
  isUnknown: boolean
}

/**
 * Normalizes a number to [0, 1] given known min and max bounds.
 */
export function normalizeValue(val: number, min: number, max: number): number {
  if (max <= min) return 0
  const clamped = Math.max(min, Math.min(max, val))
  return (clamped - min) / (max - min)
}

/**
 * Evaluates the value of a region under the selected strategic layer.
 * Pure and deterministic; respects knowledge gating rules.
 */
export function getRegionLayerValue(
  state: GameState,
  regionId: string,
  layer: AtlasLayerId,
): LayerRegionValue {
  ensureAtlasKnowledge(state)
  const def = REGIONS[regionId]
  if (!def) {
    return {
      regionId,
      normalized: 0,
      displayValue: 'Unknown',
      detail: '',
      color: '#64748b',
      isUnknown: true,
    }
  }

  const regionState = state.regions[regionId]
  const isOwned = regionState?.owner === 'player'
  const isMapped = isRegionMapped(state, regionId)
  const isVisited = isRegionVisited(state, regionId)

  switch (layer) {
    case 'political': {
      if (isOwned) {
        return {
          regionId,
          normalized: 1.0,
          displayValue: 'Held Territory',
          detail: 'Player Realm',
          color: '#4ade80',
          isUnknown: false,
        }
      }
      const isAttackable = def.neighbors.some((n) => state.regions[n]?.owner === 'player')
      if (isAttackable) {
        return {
          regionId,
          normalized: 0.5,
          displayValue: 'Attackable Frontier',
          detail: `Tier ${def.tier} Province`,
          color: '#fbbf24',
          isUnknown: false,
        }
      }
      return {
        regionId,
        normalized: 0.1,
        displayValue: 'Locked Province',
        detail: `Tier ${def.tier} Province`,
        color: '#64748b',
        isUnknown: false,
      }
    }

    case 'biome': {
      if (!isMapped) {
        return {
          regionId,
          normalized: 0,
          displayValue: 'Uncharted Territory',
          detail: 'Discover adjacent regions',
          color: '#475569',
          isUnknown: true,
        }
      }
      const biomeColors: Record<string, string> = {
        grasslands: '#22c55e',
        savanna: '#eab308',
        tundra: '#38bdf8',
        desert: '#f97316',
        volcanic: '#ef4444',
        swamp: '#14b8a6',
        coastal: '#06b6d4',
        highlands: '#a855f7',
        forest: '#15803d',
      }
      const color = biomeColors[def.biome] ?? '#64748b'
      const formattedBiome = def.biome.charAt(0).toUpperCase() + def.biome.slice(1)
      return {
        regionId,
        normalized: 1.0,
        displayValue: formattedBiome,
        detail: `Tier ${def.tier} Climate`,
        color,
        isUnknown: false,
      }
    }

    case 'yields': {
      // Total yield points sum
      const yields = def.yields ?? {}
      const totalYield = Object.values(yields).reduce((sum, v) => sum + (v ?? 0), 0)
      const maxPossibleYield = 30 // Typical top province output
      const normalized = normalizeValue(totalYield, 0, maxPossibleYield)

      const yieldItems = Object.entries(yields)
        .filter(([, v]) => (v ?? 0) > 0)
        .map(([k, v]) => `+${v} ${k}`)
        .join(', ')

      return {
        regionId,
        normalized,
        displayValue: `${totalYield} Resources/t`,
        detail: yieldItems || 'No passive yield',
        color: totalYield > 15 ? '#38bdf8' : totalYield > 8 ? '#818cf8' : '#64748b',
        isUnknown: false,
      }
    }

    case 'unrest': {
      if (!isOwned) {
        return {
          regionId,
          normalized: 0,
          displayValue: 'Unoccupied',
          detail: 'Hostile control',
          color: '#64748b',
          isUnknown: false,
        }
      }
      const unrest = regionState?.unrest ?? 0
      const normalized = normalizeValue(unrest, 0, 100)
      const color = unrest > 65 ? '#ef4444' : unrest > 30 ? '#f59e0b' : '#22c55e'
      return {
        regionId,
        normalized,
        displayValue: `${Math.round(unrest)}% Unrest`,
        detail: unrest > 65 ? 'High Rebellion Risk' : unrest > 30 ? 'Moderate Dissent' : 'Stable Territory',
        color,
        isUnknown: false,
      }
    }

    case 'garrison': {
      if (isOwned) {
        const garrisonCount = (regionState?.garrison ?? []).length
        const normalized = normalizeValue(garrisonCount, 0, 8)
        return {
          regionId,
          normalized,
          displayValue: `${garrisonCount} Garrison Units`,
          detail: 'Defending player army',
          color: '#4ade80',
          isUnknown: false,
        }
      }
      const garrisonUnits = regionState?.garrison ?? []
      const garrisonStr =
        garrisonUnits.length > 0
          ? garrisonUnits.reduce((acc, g) => acc + g.strength, 0)
          : def.tier * 80
      const maxGarrisonStr = 600
      const normalized = normalizeValue(garrisonStr, 0, maxGarrisonStr)
      return {
        regionId,
        normalized,
        displayValue: `${Math.round(garrisonStr)} Power`,
        detail: `Tier ${def.tier} Defense Force`,
        color: garrisonStr > 350 ? '#ef4444' : garrisonStr > 150 ? '#f97316' : '#fbbf24',
        isUnknown: false,
      }
    }

    case 'species': {
      if (!isMapped) {
        return {
          regionId,
          normalized: 0,
          displayValue: 'Unknown Habitat',
          detail: 'Unexplored territory',
          color: '#64748b',
          isUnknown: true,
        }
      }
      const speciesDef = SPECIES[def.nativeSpecies]
      const speciesName = speciesDef?.name ?? def.nativeSpecies
      const speciesColor = speciesDef?.color ?? '#a855f7'
      return {
        regionId,
        normalized: 1.0,
        displayValue: speciesName,
        detail: `Native Habitat`,
        color: speciesColor,
        isUnknown: false,
      }
    }

    case 'exploration': {
      const knowledge = state.atlasKnowledge[regionId]
      const landmarks = knowledge?.discoveredLandmarkIds.length ?? 0
      const totalLandmarks = def.atlas?.landmarks.length ?? 1
      let score = 0
      if (isMapped) score += 0.25
      if (isVisited) score += 0.25
      if (totalLandmarks > 0) score += (landmarks / totalLandmarks) * 0.5

      const pct = Math.round(score * 100)
      const color = pct === 100 ? '#22c55e' : pct >= 50 ? '#38bdf8' : pct >= 25 ? '#fbbf24' : '#64748b'

      return {
        regionId,
        normalized: score,
        displayValue: `${pct}% Explored`,
        detail: isVisited ? `${landmarks}/${totalLandmarks} Landmarks` : isMapped ? 'Mapped (Unvisited)' : 'Uncharted',
        color,
        isUnknown: false,
      }
    }
  }
}

export interface AtlasLegendItem {
  label: string
  color: string
  description?: string
}

/**
 * Returns legend items defining the current layer scale or categories.
 */
export function getAtlasLayerLegend(layer: AtlasLayerId): AtlasLegendItem[] {
  switch (layer) {
    case 'political':
      return [
        { label: 'Player Realm', color: '#4ade80', description: 'Conquered & controlled' },
        { label: 'Attackable Frontier', color: '#fbbf24', description: 'Reachable next target' },
        { label: 'Locked Province', color: '#64748b', description: 'No adjacent access' },
      ]
    case 'biome':
      return [
        { label: 'Grasslands', color: '#22c55e' },
        { label: 'Savanna / Desert', color: '#eab308' },
        { label: 'Tundra / Alpine', color: '#38bdf8' },
        { label: 'Volcanic / Ash', color: '#ef4444' },
        { label: 'Swamp / Wetland', color: '#14b8a6' },
      ]
    case 'yields':
      return [
        { label: 'High (>15/t)', color: '#38bdf8' },
        { label: 'Medium (8–15/t)', color: '#818cf8' },
        { label: 'Low (<8/t)', color: '#64748b' },
      ]
    case 'unrest':
      return [
        { label: 'Stable (0–30%)', color: '#22c55e' },
        { label: 'Dissent (30–65%)', color: '#f59e0b' },
        { label: 'Critical (>65%)', color: '#ef4444' },
      ]
    case 'garrison':
      return [
        { label: 'Player Guard', color: '#4ade80' },
        { label: 'Heavy (>350)', color: '#ef4444' },
        { label: 'Moderate (150–350)', color: '#f97316' },
        { label: 'Light (<150)', color: '#fbbf24' },
      ]
    case 'species':
      return Object.values(SPECIES).map((s) => ({
        label: s.name,
        color: s.color,
      }))
    case 'exploration':
      return [
        { label: 'Mastered (100%)', color: '#22c55e' },
        { label: 'Surveyed (50–99%)', color: '#38bdf8' },
        { label: 'Mapped (25–49%)', color: '#fbbf24' },
        { label: 'Uncharted (<25%)', color: '#64748b' },
      ]
  }
}
