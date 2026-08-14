import { ASSETS, type AssetEntry, type AssetId, type ClipSpec, type ModelState } from '@/render/assets/manifest'

export type ModelStatus = 'ready' | 'disabled' | 'pending'
export type StatusFilter = 'all' | 'ready' | 'pending'
export type CategoryFilter = 'all' | string

export interface ModelLibraryEntry {
  id: AssetId
  asset: AssetEntry
  label: string
  category: string
}

const LABELS: Partial<Record<AssetId, string>> = {
  'character.player': 'Arcane Handler',
  'wyvern.emberback': 'Emberback',
  'wyvern.cragwing': 'Cragwing',
  'wyvern.mirefang': 'Mirefang',
  'wyvern.frostmaw': 'Frostmaw',
  'wyvern.duskwyrm': 'Duskwyrm',
  'wyvern.thornwing': 'Thornwing',
  'unit.soldier': 'Human Soldier',
  'unit.archer': 'Archer',
  'unit.cavalry': 'Cavalry',
  'unit.pikeman': 'Pikeman',
  'building.hatchery': 'Hatchery',
  'building.barracks': 'Barracks',
  'building.infirmary': 'Infirmary',
  'building.trainingGrounds': 'Training Grounds',
  'prop.tree': 'Tree',
  'prop.rock': 'Rock',
  'wildlife.deer': 'Deer',
  'wildlife.guineafowl': 'Guineafowl',
  'library.alchemistWorkstation': 'Arcane Alchemist Workstation',
  'library.forestWyvernDisplay': 'Forest Wyvern Display',
  'library.arcaneAcademyCrest': 'Arcane Academy Crest',
  'library.throneOfBooks': 'Throne of Books',
  'library.ancientTree': 'Ancient World Tree',
}

const CATEGORY_LABELS: Record<string, string> = {
  character: 'Player',
  library: 'Imported',
}

export function labelFor(id: AssetId): string {
  return LABELS[id] ?? id.split('.').at(-1) ?? id
}

export function categoryFor(id: AssetId): string {
  const category = id.split('.')[0]!
  return CATEGORY_LABELS[category] ?? `${category[0]!.toUpperCase()}${category.slice(1)}`
}

export const MODEL_LIBRARY_ENTRIES: ModelLibraryEntry[] = (Object.entries(ASSETS) as [AssetId, AssetEntry][])
  .map(([id, asset]) => ({ id, asset, label: labelFor(id), category: categoryFor(id) }))
  .sort((left, right) => left.category.localeCompare(right.category) || left.label.localeCompare(right.label))

export const MODEL_LIBRARY_CATEGORIES = [...new Set(MODEL_LIBRARY_ENTRIES.map((entry) => entry.category))]

export function resolveModelId(value: string | string[] | undefined): AssetId {
  const candidate = Array.isArray(value) ? value[0] : value
  return candidate && Object.hasOwn(ASSETS, candidate) ? candidate as AssetId : 'character.player'
}

export function statusFor(asset: AssetEntry, disabled: boolean): ModelStatus {
  if (!asset.url) return 'pending'
  return disabled ? 'disabled' : 'ready'
}

export function filterModels(
  entries: ModelLibraryEntry[],
  query: string,
  status: StatusFilter,
  category: CategoryFilter,
): ModelLibraryEntry[] {
  const normalizedQuery = query.trim().toLowerCase()
  return entries.filter((entry) => {
    const matchesQuery = !normalizedQuery || `${entry.id} ${entry.label} ${entry.category}`.toLowerCase().includes(normalizedQuery)
    const matchesStatus = status === 'all' || (status === 'ready' ? Boolean(entry.asset.url) : !entry.asset.url)
    const matchesCategory = category === 'all' || entry.category === category
    return matchesQuery && matchesStatus && matchesCategory
  })
}

export function modelCounts(entries: ModelLibraryEntry[]) {
  return entries.reduce((counts, entry) => {
    counts.total += 1
    if (entry.asset.url) counts.ready += 1
    else counts.pending += 1
    counts.categories[entry.category] = (counts.categories[entry.category] ?? 0) + 1
    return counts
  }, { total: 0, ready: 0, pending: 0, categories: {} as Record<string, number> })
}

function clipSummary(spec: ClipSpec): string {
  const details = [spec.loop === false ? 'one-shot' : 'loop']
  if (spec.next) details.push(`next: ${spec.next}`)
  if (spec.phaseGroup) details.push(`phase: ${spec.phaseGroup}`)
  if (spec.timeScale !== undefined) details.push(`speed: ${spec.timeScale}×`)
  if (spec.fadeIn !== undefined) details.push(`fade: ${spec.fadeIn}s`)
  if (spec.yOffset !== undefined) details.push(`offset: ${spec.yOffset}`)
  return `${spec.clip} · ${details.join(' · ')}`
}

export function animationDetails(state: ModelState, value: ClipSpec | ClipSpec[]): { state: ModelState; clips: string[] } {
  const specs = Array.isArray(value) ? value : [value]
  return { state, clips: specs.map(clipSummary) }
}

/** Move the selection by `delta` rows within the visible list, clamped at both ends. */
export function stepSelection(entries: ModelLibraryEntry[], current: AssetId, delta: number): AssetId {
  if (entries.length === 0) return current
  const index = entries.findIndex((entry) => entry.id === current)
  if (index === -1) return entries[delta < 0 ? entries.length - 1 : 0]!.id
  const next = Math.min(entries.length - 1, Math.max(0, index + delta))
  return entries[next]!.id
}
