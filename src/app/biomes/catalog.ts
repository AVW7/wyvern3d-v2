import { BIOME_DRESSING, type BiomeLayer } from '@/render/assets/biomeLibrary'
import { PROP_ATLAS } from '@/render/assets/manifest'

/**
 * Catalog helpers for the Biome Library page.
 *
 * Pure and independently testable: the page's server component reads
 * scripts/biome-library.json and the built atlas's measurements, then hands
 * both here to be joined into one row per prop. Nothing in this file touches
 * three, React or the filesystem.
 */

/** One entry as authored in scripts/biome-library.json. */
export interface LibraryEntry {
  id: string
  source: { root: string; file: string }
  nodes?: string[]
  targetHeight: number
  sink?: number
  maxTriangles?: number
  textureSize?: number
  license: { status: string; evidence: string | null }
}

/** One entry as measured by the builder, from asset.extras.wyvern3dBiomeAtlas. */
export interface AtlasMeasurement {
  id: string
  sourceFile: string
  nodes: number
  sourceTriangles: number
  triangles: number
  height: number
  footprint: [number, number]
  scale: number
}

export interface BiomePropEntry {
  id: string
  label: string
  /** Grouping key: `tree`, `rock`, `crystal`, `cave`, `grass`, `landmark`, `prop`. */
  family: string
  entry: LibraryEntry
  measured: AtlasMeasurement | null
  /** Biome ids that scatter this prop, with the layer that does it. */
  usedBy: { biome: string; layer: BiomeLayer }[]
}

export type FamilyFilter = 'all' | string
export type UsageFilter = 'all' | 'used' | 'unused'

const FAMILY_LABELS: Record<string, string> = {
  tree: 'Trees',
  grass: 'Ground cover',
  rock: 'Rocks',
  cave: 'Cavern',
  crystal: 'Crystals',
  landmark: 'Landmarks',
  prop: 'Props',
}

/** `prop.biome.tree.gnarlA` -> `tree`. */
export function familyFor(id: string): string {
  return id.split('.')[2] ?? 'other'
}

export function familyLabel(family: string): string {
  return FAMILY_LABELS[family] ?? `${family[0]?.toUpperCase() ?? ''}${family.slice(1)}`
}

/** `prop.biome.tree.gnarlA` -> `Gnarl A`. */
export function labelFor(id: string): string {
  const leaf = id.split('.').at(-1) ?? id
  return leaf
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (character) => character.toUpperCase())
}

/** Which biomes scatter a given prop id. */
export function usageFor(id: string): { biome: string; layer: BiomeLayer }[] {
  return Object.entries(BIOME_DRESSING).flatMap(([biome, layers]) =>
    layers.filter((layer) => layer.prop === id && (layer.atlas ?? '') !== PROP_ATLAS).map((layer) => ({ biome, layer })),
  )
}

export function buildCatalog(entries: LibraryEntry[], measurements: AtlasMeasurement[]): BiomePropEntry[] {
  const measured = new Map(measurements.map((measurement) => [measurement.id, measurement]))
  return entries
    .map((entry) => ({
      id: entry.id,
      label: labelFor(entry.id),
      family: familyFor(entry.id),
      entry,
      measured: measured.get(entry.id) ?? null,
      usedBy: usageFor(entry.id),
    }))
    .sort((left, right) => left.family.localeCompare(right.family) || left.label.localeCompare(right.label))
}

export function filterProps(
  props: BiomePropEntry[],
  query: string,
  family: FamilyFilter,
  usage: UsageFilter,
): BiomePropEntry[] {
  const needle = query.trim().toLowerCase()
  return props.filter((prop) => {
    if (family !== 'all' && prop.family !== family) return false
    if (usage === 'used' && prop.usedBy.length === 0) return false
    if (usage === 'unused' && prop.usedBy.length > 0) return false
    if (!needle) return true
    return (
      prop.label.toLowerCase().includes(needle) ||
      prop.id.toLowerCase().includes(needle) ||
      prop.entry.source.file.toLowerCase().includes(needle) ||
      prop.usedBy.some(({ biome }) => biome.includes(needle))
    )
  })
}

export function catalogCounts(props: BiomePropEntry[]) {
  return {
    total: props.length,
    built: props.filter((prop) => prop.measured).length,
    unused: props.filter((prop) => prop.usedBy.length === 0).length,
    triangles: props.reduce((total, prop) => total + (prop.measured?.triangles ?? 0), 0),
    families: props.reduce<Record<string, number>>((counts, prop) => {
      counts[prop.family] = (counts[prop.family] ?? 0) + 1
      return counts
    }, {}),
  }
}

/** Arrow-key stepping through the filtered list, mirroring the Model Library. */
export function stepSelection(visible: BiomePropEntry[], selectedId: string, key: string): string | null {
  if (visible.length === 0) return null
  const index = visible.findIndex((prop) => prop.id === selectedId)
  if (key === 'Home') return visible[0]!.id
  if (key === 'End') return visible[visible.length - 1]!.id
  if (key === 'ArrowDown') return visible[Math.min(visible.length - 1, index + 1)]!.id
  if (key === 'ArrowUp') return visible[Math.max(0, index - 1)]!.id
  return null
}

export interface BiomeSummary {
  biome: string
  layers: BiomeLayer[]
  props: number
  instances: number
  /** Layers naming a prop the atlas does not build. */
  missing: string[]
}

/** Per-biome view: what each biome dresses with, and how much of it. */
export function biomeSummaries(props: BiomePropEntry[]): BiomeSummary[] {
  const built = new Set(props.filter((prop) => prop.measured).map((prop) => prop.id))
  return Object.entries(BIOME_DRESSING)
    .map(([biome, layers]) => ({
      biome,
      layers,
      props: layers.length,
      instances: layers.reduce((total, layer) => total + layer.count, 0),
      missing: layers.filter((layer) => !built.has(layer.prop) && (layer.atlas ?? '') !== PROP_ATLAS).map((layer) => layer.prop),
    }))
    .sort((left, right) => left.biome.localeCompare(right.biome))
}
