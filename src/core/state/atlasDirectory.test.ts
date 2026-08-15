import { describe, expect, it } from 'vitest'
import { createInitialState } from './game'
import { STARTING_REGION, REGIONS } from '../data/regions'
import { getAllAuthoredLandmarks } from '../data/atlas'
import { PHENOMENA } from '../data/phenomena'
import { execute } from '../executions'
import {
  EMPTY_ATLAS_QUERY,
  buildAtlasDirectory,
  filterAtlasDirectory,
  getAtlasFacets,
  isQueryActive,
  normalizeSearch,
  type AtlasDirectoryQuery,
} from './atlasDirectory'

/** A fresh save where hearthvale is held and its neighbors are reachable. */
function freshState() {
  return createInitialState(42)
}

/** Conquer a region the honest way: mark it player-owned in state. */
function conquer(state: ReturnType<typeof freshState>, regionId: string) {
  state.regions[regionId]!.owner = 'player'
}

describe('buildAtlasDirectory', () => {
  it('produces one entry per region in REGION_LIST order', () => {
    const entries = buildAtlasDirectory(freshState())
    expect(entries).toHaveLength(REGIONS ? Object.keys(REGIONS).length : 0)
    expect(entries[0]!.id).toBe(STARTING_REGION)
  })

  it('marks the starting region held/visited and neighbors mapped but unvisited', () => {
    const state = freshState()
    const entries = buildAtlasDirectory(state)
    const start = entries.find((e) => e.id === STARTING_REGION)!

    expect(start.status).toBe('held')
    expect(start.visited).toBe(true)
    expect(start.summary).not.toBeNull()
    expect(start.nativeSpecies).not.toBeNull()

    const neighbor = entries.find((e) => e.id === 'sunkenreach')!
    expect(neighbor.mapped).toBe(true)
    expect(neighbor.visited).toBe(false)
    expect(neighbor.status).toBe('reachable')
    // Mapped regions expose their summary even before conquest.
    expect(neighbor.summary).not.toBeNull()
  })

  it('hides knowledge-gated fields for unmapped regions', () => {
    const entries = buildAtlasDirectory(freshState())
    const duskspire = entries.find((e) => e.id === 'duskspire')!
    expect(duskspire.mapped).toBe(false)
    expect(duskspire.summary).toBeNull()
    expect(duskspire.nativeSpecies).toBeNull()
    expect(duskspire.status).toBe('locked')
  })

  it('reflects conquest in status and visited', () => {
    const state = freshState()
    conquer(state, 'sunkenreach')
    const entry = buildAtlasDirectory(state).find((e) => e.id === 'sunkenreach')!
    expect(entry.status).toBe('held')
    expect(entry.visited).toBe(true)
  })

  it('is deterministic across repeated builds', () => {
    const a = buildAtlasDirectory(freshState())
    const b = buildAtlasDirectory(freshState())
    expect(a).toEqual(b)
  })
})

describe('filterAtlasDirectory', () => {
  const base = buildAtlasDirectory(freshState())

  it('returns everything sorted by tier then name for the empty query', () => {
    const result = filterAtlasDirectory(base, EMPTY_ATLAS_QUERY)
    expect(result).toHaveLength(base.length)
    for (let i = 1; i < result.length; i++) {
      const prev = result[i - 1]!
      const curr = result[i]!
      expect(
        prev.tier < curr.tier ||
          (prev.tier === curr.tier && prev.name.localeCompare(curr.name) <= 0),
      ).toBe(true)
    }
  })

  it('filters by held status', () => {
    const result = filterAtlasDirectory(base, { ...EMPTY_ATLAS_QUERY, status: 'held' })
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe(STARTING_REGION)
  })

  it('filters by visited and unvisited', () => {
    const visited = filterAtlasDirectory(base, { ...EMPTY_ATLAS_QUERY, status: 'visited' })
    expect(visited.map((e) => e.id)).toEqual([STARTING_REGION])

    const unvisited = filterAtlasDirectory(base, { ...EMPTY_ATLAS_QUERY, status: 'unvisited' })
    expect(unvisited).toHaveLength(base.length - 1)
  })

  it('filters by biome', () => {
    const result = filterAtlasDirectory(base, { ...EMPTY_ATLAS_QUERY, biome: 'coast' })
    expect(result.length).toBeGreaterThan(0)
    for (const entry of result) expect(entry.biome).toBe('coast')
  })

  it('filters by tier', () => {
    const result = filterAtlasDirectory(base, { ...EMPTY_ATLAS_QUERY, tier: 4 })
    expect(result.length).toBeGreaterThan(0)
    for (const entry of result) expect(entry.tier).toBe(4)
  })

  it('filters by resource', () => {
    const result = filterAtlasDirectory(base, { ...EMPTY_ATLAS_QUERY, resource: 'gold' })
    expect(result.length).toBeGreaterThan(0)
    for (const entry of result) expect(entry.resources).toContain('gold')
  })

  it('filters by species only where knowledge allows', () => {
    // frostmaw regions are unmapped at start, so nothing matches the facet.
    const state = freshState()
    conquer(state, 'sunkenreach')
    const entries = buildAtlasDirectory(state)
    const result = filterAtlasDirectory(entries, { ...EMPTY_ATLAS_QUERY, species: 'emberback' })
    expect(result.length).toBeGreaterThan(0)
    for (const entry of result) expect(entry.nativeSpecies).toBe('emberback')
  })

  it('searches name, biome and species, case- and space-insensitively', () => {
    const byName = filterAtlasDirectory(base, { ...EMPTY_ATLAS_QUERY, search: '  hearth   VALE ' })
    expect(byName.map((e) => e.id)).toEqual([STARTING_REGION])

    const byBiome = filterAtlasDirectory(base, { ...EMPTY_ATLAS_QUERY, search: 'coast' })
    expect(byBiome.length).toBeGreaterThan(0)

    const bySpecies = filterAtlasDirectory(base, { ...EMPTY_ATLAS_QUERY, search: 'emberback' })
    // hearthvale is mapped, so its species name/summary is searchable
    expect(bySpecies.map((e) => e.id)).toContain(STARTING_REGION)
  })

  it('never surfaces unmapped summaries through search', () => {
    // duskspire's summary mentions "apex"; its knowledge record is unmapped.
    const duskspire = REGIONS['duskspire']!
    expect(duskspire.atlas!.summary.toLowerCase()).toContain('apex')
    const result = filterAtlasDirectory(base, { ...EMPTY_ATLAS_QUERY, search: 'apex drakes' })
    expect(result.map((e) => e.id)).not.toContain('duskspire')
  })

  it('combines filters with AND semantics', () => {
    const result = filterAtlasDirectory(base, {
      ...EMPTY_ATLAS_QUERY,
      status: 'reachable',
      biome: 'coast',
    })
    for (const entry of result) {
      expect(entry.status).toBe('reachable')
      expect(entry.biome).toBe('coast')
    }
    expect(result.length).toBeGreaterThan(0)
  })

  it('sorts stably for equal keys', () => {
    const allTier1 = base.filter((e) => e.tier === 1)
    const once = filterAtlasDirectory(allTier1, EMPTY_ATLAS_QUERY)
    const twice = filterAtlasDirectory(allTier1, EMPTY_ATLAS_QUERY)
    expect(once.map((e) => e.id)).toEqual(twice.map((e) => e.id))
  })

  it('returns an empty list for a nonsense query', () => {
    const result = filterAtlasDirectory(base, { ...EMPTY_ATLAS_QUERY, search: 'zzzznothing' })
    expect(result).toEqual([])
  })
})

describe('getAtlasFacets', () => {
  it('counts every facet family over all entries', () => {
    const facets = getAtlasFacets(buildAtlasDirectory(freshState()))
    const totalBiomes = facets.biomes.reduce((sum, f) => sum + f.count, 0)
    expect(totalBiomes).toBe(Object.keys(REGIONS).length)
    expect(facets.tiers[0]!.value).toBe('0')
    expect(facets.resources.some((f) => f.value === 'gold')).toBe(true)
  })

  it('counts species only over mapped regions', () => {
    const state = freshState()
    const facets = getAtlasFacets(buildAtlasDirectory(state))
    const mappedSpecies = new Set(
      buildAtlasDirectory(state)
        .filter((e) => e.nativeSpecies)
        .map((e) => e.nativeSpecies),
    )
    const facetSpecies = new Set(facets.species.map((f) => f.value))
    expect(facetSpecies).toEqual(mappedSpecies)
  })
})

describe('normalizeSearch + isQueryActive', () => {
  it('normalizes case and collapses whitespace', () => {
    expect(normalizeSearch('  The    Sunken   REACH ')).toBe('the sunken reach')
  })

  it('reports active only for non-default queries', () => {
    const base: AtlasDirectoryQuery = { ...EMPTY_ATLAS_QUERY }
    expect(isQueryActive(base)).toBe(false)
    expect(isQueryActive({ ...base, search: '  ' })).toBe(false)
    expect(isQueryActive({ ...base, tier: 2 })).toBe(true)
    expect(isQueryActive({ ...base, status: 'visited' })).toBe(true)
  })
})

describe('directory stays consistent with authored content', () => {
  it('entry count matches the authored landmark universe', () => {
    const entries = buildAtlasDirectory(freshState())
    expect(entries.length).toBe(Object.keys(REGIONS).length)
    expect(getAllAuthoredLandmarks().length).toBeGreaterThanOrEqual(entries.length)
  })
})

describe('observed phenomena surface (Biome Stage 4)', () => {
  it('is null everywhere on a fresh save', () => {
    for (const entry of buildAtlasDirectory(freshState())) {
      expect(entry.observedPhenomenon).toBeNull()
    }
  })

  it('names the phenomenon once observed, in any knowledge state', () => {
    const state = freshState()
    const phenomenon = PHENOMENA.find((p) => p.biomes.includes('valley'))!
    // hearthvale is the valley starting region.
    execute(state, { type: 'OBSERVE_PHENOMENON', regionId: STARTING_REGION, phenomenonId: phenomenon.id })

    const entries = buildAtlasDirectory(state)
    const heard = entries.find((e) => e.id === STARTING_REGION)!
    expect(heard.observedPhenomenon).toBe(phenomenon.name)
    // Everyone else is still null.
    for (const entry of entries) {
      if (entry.id !== STARTING_REGION) expect(entry.observedPhenomenon).toBeNull()
    }
  })

  it('is searchable by phenomenon name, and never leaks unobserved ones', () => {
    const state = freshState()
    const phenomenon = PHENOMENA.find((p) => p.biomes.includes('valley'))!
    execute(state, { type: 'OBSERVE_PHENOMENON', regionId: STARTING_REGION, phenomenonId: phenomenon.id })
    const entries = buildAtlasDirectory(state)

    // Observed: findable by name.
    const found = filterAtlasDirectory(entries, { ...EMPTY_ATLAS_QUERY, search: 'meadowlark' })
    expect(found.map((e) => e.id)).toContain(STARTING_REGION)

    // Unobserved phenomenon names never match — even for mapped regions.
    const unobserved = PHENOMENA.find((p) => p.biomes.includes('coast'))!
    const leaked = filterAtlasDirectory(entries, {
      ...EMPTY_ATLAS_QUERY,
      search: unobserved.name,
    })
    expect(leaked).toEqual([])
  })
})
