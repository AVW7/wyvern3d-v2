import type { GameState } from '../types'
import { REGION_LIST } from '../data/regions'
import { SPECIES } from '../data/species'
import { REGION_ATLAS_DATA } from '../data/atlas'
import { PHENOMENA } from '../data/phenomena'
import { ensureAtlasKnowledge } from './atlasKnowledge'

/**
 * Pure directory model for the World Atlas (Atlas Stage 1).
 *
 * The UI must not reproduce knowledge or status rules, so every row the atlas
 * drawer renders is built here: knowledge-gated fields arrive as `null` when
 * unknown, and filtering/sorting are pure functions over these entries.
 */

export type AtlasStatus = 'held' | 'reachable' | 'locked'

export interface AtlasDirectoryEntry {
  id: string
  name: string
  biome: string
  tier: number
  status: AtlasStatus
  /** Mapped on the world chart. */
  mapped: boolean
  /** Physically visited or conquered. */
  visited: boolean
  /** Knowledge-gated: null until the region is mapped. */
  summary: string | null
  climateTags: string[] | null
  terrainTags: string[] | null
  /** Knowledge-gated: null until the region is mapped. */
  nativeSpecies: string | null
  /** Resource ids this region yields (always known — shown on the map graph). */
  resources: string[]
  /** Discovered landmark count for this region (knowledge, always known). */
  discoveredLandmarks: number
  /** Authored landmark total for this region (static content). */
  totalLandmarks: number
  /** The region's phenomenon name, null until observed (knowledge-gated). */
  observedPhenomenon: string | null
}

export type AtlasStatusFilter = 'all' | AtlasStatus | 'visited' | 'unvisited'

export interface AtlasDirectoryQuery {
  search: string
  status: AtlasStatusFilter
  biome: string | 'all'
  tier: number | 'all'
  resource: string | 'all'
  species: string | 'all'
}

export const EMPTY_ATLAS_QUERY: AtlasDirectoryQuery = {
  search: '',
  status: 'all',
  biome: 'all',
  tier: 'all',
  resource: 'all',
  species: 'all',
}

/** Lowercase, whitespace-collapsed search normalization shared by filter + UI. */
export function normalizeSearch(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

function atlasStatus(state: GameState, regionId: string): AtlasStatus {
  const def = REGION_LIST.find((r) => r.id === regionId)
  const owner = state.regions[regionId]?.owner ?? (def?.starting ? 'player' : 'enemy')
  if (owner === 'player') return 'held'
  const attackable = !!def?.neighbors.some((n) => state.regions[n]?.owner === 'player')
  return attackable ? 'reachable' : 'locked'
}

/**
 * Builds the full directory for every region, applying knowledge gating.
 * Deterministic: follows REGION_LIST order, reads no RNG or clock.
 */
export function buildAtlasDirectory(state: GameState): AtlasDirectoryEntry[] {
  ensureAtlasKnowledge(state)

  return REGION_LIST.map((def) => {
    const knowledge = state.atlasKnowledge[def.id]
    const isPlayerOwned = state.regions[def.id]?.owner === 'player'
    const mapped = !!knowledge?.mapped || isPlayerOwned
    const visited = !!knowledge?.visited || isPlayerOwned
    const atlas = REGION_ATLAS_DATA[def.id]

    return {
      id: def.id,
      name: def.name,
      biome: def.biome,
      tier: def.tier,
      status: atlasStatus(state, def.id),
      mapped,
      visited,
      summary: mapped ? (atlas?.summary ?? null) : null,
      climateTags: mapped ? (atlas?.climateTags ? [...atlas.climateTags] : null) : null,
      terrainTags: mapped ? (atlas?.terrainTags ? [...atlas.terrainTags] : null) : null,
      nativeSpecies: mapped ? def.nativeSpecies : null,
      resources: Object.keys(def.yields),
      discoveredLandmarks: knowledge?.discoveredLandmarkIds.length ?? 0,
      totalLandmarks: atlas?.landmarks.length ?? 0,
      // Only the observation record is knowledge; the phenomenon's existence
      // stays hidden until the player actually observes it in-region.
      observedPhenomenon: (() => {
        const observed = knowledge?.observedPhenomenonIds ?? []
        if (observed.length === 0) return null
        const phenomenon = PHENOMENA.find((p) => observed.includes(p.id))
        return phenomenon?.name ?? null
      })(),
    }
  })
}

function matchesQuery(entry: AtlasDirectoryEntry, query: AtlasDirectoryQuery): boolean {
  if (query.status !== 'all') {
    if (query.status === 'visited') {
      if (!entry.visited) return false
    } else if (query.status === 'unvisited') {
      if (entry.visited) return false
    } else if (entry.status !== query.status) {
      return false
    }
  }
  if (query.biome !== 'all' && entry.biome !== query.biome) return false
  if (query.tier !== 'all' && entry.tier !== query.tier) return false
  if (query.resource !== 'all' && !entry.resources.includes(query.resource)) return false
  if (query.species !== 'all' && entry.nativeSpecies !== query.species) return false

  const search = normalizeSearch(query.search)
  if (search.length > 0) {
    // Only knowledge-approved fields are searchable: an unmapped region's
    // summary and species stay hidden even to a lucky query.
    const speciesName = entry.nativeSpecies ? (SPECIES[entry.nativeSpecies]?.name ?? '') : ''
    const haystack = normalizeSearch(
      [
        entry.id,
        entry.name,
        entry.biome,
        speciesName,
        entry.summary ?? '',
        // Observed phenomena are knowledge-approved once recorded.
        entry.observedPhenomenon ?? '',
      ].join(' '),
    )
    // Token AND-match so "hearth vale" finds Hearthvale.
    const tokens = search.split(' ').filter((t) => t.length > 0)
    if (!tokens.every((token) => haystack.includes(token))) return false
  }
  return true
}

/** Stable sort: tier ascending, then name, so equal keys keep list order. */
function compareEntries(a: AtlasDirectoryEntry, b: AtlasDirectoryEntry): number {
  if (a.tier !== b.tier) return a.tier - b.tier
  return a.name.localeCompare(b.name)
}

/**
 * Filters and sorts the directory. Stable: entries comparing equal preserve
 * build order, so repeated runs over the same input are identical.
 */
export function filterAtlasDirectory(
  entries: AtlasDirectoryEntry[],
  query: AtlasDirectoryQuery,
): AtlasDirectoryEntry[] {
  return entries
    .filter((entry) => matchesQuery(entry, query))
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => compareEntries(a.entry, b.entry) || a.index - b.index)
    .map((pair) => pair.entry)
}

export interface AtlasFacetCount {
  value: string
  count: number
}

export interface AtlasFacets {
  biomes: AtlasFacetCount[]
  tiers: AtlasFacetCount[]
  resources: AtlasFacetCount[]
  /** Native species facets count only mapped regions — unknowns stay unknown. */
  species: AtlasFacetCount[]
}

/** Facet counts over the full entry list, sorted for display. */
export function getAtlasFacets(entries: AtlasDirectoryEntry[]): AtlasFacets {
  const biomes = new Map<string, number>()
  const tiers = new Map<number, number>()
  const resources = new Map<string, number>()
  const species = new Map<string, number>()

  for (const entry of entries) {
    biomes.set(entry.biome, (biomes.get(entry.biome) ?? 0) + 1)
    tiers.set(entry.tier, (tiers.get(entry.tier) ?? 0) + 1)
    for (const res of entry.resources) {
      resources.set(res, (resources.get(res) ?? 0) + 1)
    }
    if (entry.nativeSpecies) {
      species.set(entry.nativeSpecies, (species.get(entry.nativeSpecies) ?? 0) + 1)
    }
  }

  return {
    biomes: [...biomes.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value)),
    tiers: [...tiers.entries()]
      .map(([value, count]) => ({ value: String(value), count }))
      .sort((a, b) => Number(a.value) - Number(b.value)),
    resources: [...resources.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value)),
    species: [...species.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value)),
  }
}

/** True when a query differs from the empty default (drives "clear filters"). */
export function isQueryActive(query: AtlasDirectoryQuery): boolean {
  return (
    normalizeSearch(query.search).length > 0 ||
    query.status !== 'all' ||
    query.biome !== 'all' ||
    query.tier !== 'all' ||
    query.resource !== 'all' ||
    query.species !== 'all'
  )
}
