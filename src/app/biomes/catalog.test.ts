import { describe, expect, it } from 'vitest'
import { BIOME_DRESSING } from '@/render/assets/biomeLibrary'
import {
  biomeSummaries,
  buildCatalog,
  catalogCounts,
  familyFor,
  filterProps,
  labelFor,
  stepSelection,
  usageFor,
  type AtlasMeasurement,
  type LibraryEntry,
} from './catalog'

const entry = (id: string, overrides: Partial<LibraryEntry> = {}): LibraryEntry => ({
  id,
  source: { root: 'world', file: 'source.glb' },
  targetHeight: 4,
  license: { status: 'approved', evidence: 'test' },
  ...overrides,
})

const measurement = (id: string): AtlasMeasurement => ({
  id,
  sourceFile: 'source.glb',
  nodes: 1,
  sourceTriangles: 900,
  triangles: 400,
  height: 4,
  footprint: [2, 2],
  scale: 1,
})

describe('biome catalog', () => {
  it('derives family and label from the prop id', () => {
    expect(familyFor('prop.biome.tree.gnarlA')).toBe('tree')
    expect(labelFor('prop.biome.tree.gnarlA')).toBe('Gnarl A')
    expect(labelFor('prop.biome.landmark.obelisk')).toBe('Obelisk')
  })

  it('joins authored entries to built measurements', () => {
    const catalog = buildCatalog([entry('prop.biome.tree.canopy'), entry('prop.biome.rock.pebble')], [
      measurement('prop.biome.tree.canopy'),
    ])
    expect(catalog.map((prop) => prop.id)).toEqual(['prop.biome.rock.pebble', 'prop.biome.tree.canopy'])
    expect(catalog.find((prop) => prop.id === 'prop.biome.tree.canopy')?.measured?.triangles).toBe(400)
    expect(catalog.find((prop) => prop.id === 'prop.biome.rock.pebble')?.measured).toBeNull()
  })

  it('reports which biomes scatter a prop', () => {
    const forest = BIOME_DRESSING.forest ?? []
    const propId = forest[0]!.prop
    expect(usageFor(propId).map(({ biome }) => biome)).toContain('forest')
    expect(usageFor('prop.biome.nothing.here')).toEqual([])
  })

  it('filters by query, family and usage', () => {
    const catalog = buildCatalog([entry('prop.biome.tree.canopy'), entry('prop.biome.rock.unusedThing')], [
      measurement('prop.biome.tree.canopy'),
    ])
    expect(filterProps(catalog, 'canopy', 'all', 'all').map((prop) => prop.id)).toEqual(['prop.biome.tree.canopy'])
    expect(filterProps(catalog, '', 'rock', 'all').map((prop) => prop.id)).toEqual(['prop.biome.rock.unusedThing'])
    expect(filterProps(catalog, '', 'all', 'unused').map((prop) => prop.id)).toEqual(['prop.biome.rock.unusedThing'])
    expect(filterProps(catalog, 'source.glb', 'all', 'all')).toHaveLength(2)
  })

  it('counts what is built and what is unused', () => {
    const catalog = buildCatalog([entry('prop.biome.tree.canopy'), entry('prop.biome.rock.unusedThing')], [
      measurement('prop.biome.tree.canopy'),
    ])
    const counts = catalogCounts(catalog)
    expect(counts).toMatchObject({ total: 2, built: 1, triangles: 400 })
    expect(counts.families).toEqual({ tree: 1, rock: 1 })
  })

  it('steps the selection with the keyboard', () => {
    const catalog = buildCatalog([entry('prop.biome.a.one'), entry('prop.biome.a.two')], [])
    expect(stepSelection(catalog, 'prop.biome.a.one', 'ArrowDown')).toBe('prop.biome.a.two')
    expect(stepSelection(catalog, 'prop.biome.a.two', 'ArrowDown')).toBe('prop.biome.a.two')
    expect(stepSelection(catalog, 'prop.biome.a.two', 'Home')).toBe('prop.biome.a.one')
    expect(stepSelection(catalog, 'prop.biome.a.one', 'End')).toBe('prop.biome.a.two')
    expect(stepSelection(catalog, 'prop.biome.a.one', 'Enter')).toBeNull()
    expect(stepSelection([], 'anything', 'ArrowDown')).toBeNull()
  })

  it('summarises every biome and flags layers the atlas does not build', () => {
    const summaries = biomeSummaries(buildCatalog([], []))
    expect(summaries.map((summary) => summary.biome)).toEqual(Object.keys(BIOME_DRESSING).sort())
    // Nothing is built in this catalog, so every biome-atlas layer is missing.
    expect(summaries.every((summary) => summary.missing.length === summary.layers.length)).toBe(true)
  })
})
