import { ASSETS, getAsset, type AssetId, type ClipSpec, type ModelState } from '@/render/assets/manifest'
import type { LabCamera, LabTheme } from './FlightLab'
import { CAMERA_KEYS, SPECIES } from './constants'

/** Grounded + flight presets the lab can request. Labels stay human; clips come from the selected asset. */
export const LAB_PRESETS: { id: ModelState; label: string }[] = [
  { id: 'idle', label: 'Idle' },
  { id: 'rest', label: 'Rest' },
  { id: 'sleep', label: 'Sleep' },
  { id: 'sit', label: 'Sit' },
  { id: 'eat', label: 'Eat' },
  { id: 'drink', label: 'Drink' },
  { id: 'groom', label: 'Groom' },
  { id: 'attack', label: 'Attack' },
  { id: 'nuzzle', label: 'Nuzzle' },
  { id: 'calm', label: 'Calm' },
  { id: 'perch', label: 'Perch' },
  { id: 'hop', label: 'Hop' },
  { id: 'walk', label: 'Walk' },
  { id: 'breathe', label: 'Breathe' },
  { id: 'death', label: 'Death' },
  { id: 'rise', label: 'Rise' },
  { id: 'seated', label: 'Seated' },
  { id: 'pickUp', label: 'PickUp' },
  { id: 'huntGrip', label: 'HuntGrip' },
  { id: 'huntCarry', label: 'HuntCarry' },
  { id: 'drop', label: 'Drop' },
  { id: 'huntFinish', label: 'HuntFinish' },
  { id: 'fly', label: 'Fly' },
  { id: 'airborne', label: 'Airborne' },
  { id: 'cruise', label: 'Cruise' },
  { id: 'scout', label: 'Scout' },
  { id: 'speed', label: 'Speed' },
  { id: 'glide', label: 'Glide' },
  { id: 'dive', label: 'Dive' },
  { id: 'bankLeft', label: 'BankL' },
  { id: 'bankRight', label: 'BankR' },
  { id: 'hover', label: 'Hover' },
  { id: 'land', label: 'Land' },
  { id: 'breatheAir', label: 'BreatheAir' },
  { id: 'attackAir', label: 'AttackAir' },
]

/** Composer / auto-director aliases that used to request states the manifest does not have. */
export const PRESET_ALIASES: Record<string, ModelState> = {
  landing: 'land',
  perched: 'perch',
}

export const AIRBORNE_STATES = new Set<ModelState>([
  'fly',
  'airborne',
  'attackAir',
  'breatheAir',
  'huntCarry',
  'cruise',
  'scout',
  'speed',
  'glide',
  'dive',
  'bankLeft',
  'bankRight',
  'hover',
  'land',
])

export const FLIGHT_LAB_ALTITUDE = 4

export interface AnnotatedPreset {
  id: ModelState
  label: string
  clip?: string
  shared: number
}

export function flightLabAltitude(state: ModelState): number {
  return AIRBORNE_STATES.has(state) ? FLIGHT_LAB_ALTITUDE : 0
}

export function resolveRequestedState(name: string): ModelState | undefined {
  if (name in PRESET_ALIASES) return PRESET_ALIASES[name]
  if (LAB_PRESETS.some((preset) => preset.id === name)) return name as ModelState
  return undefined
}

export function resolveClipName(assetId: AssetId, state: string): string | undefined {
  const asset = getAsset(assetId)
  if (!asset) return undefined
  const spec = asset.animations[state as ModelState] as ClipSpec | ClipSpec[] | undefined
  if (!spec) return undefined
  if (Array.isArray(spec)) return spec[0]?.clip
  return spec.clip
}

export function annotatePresets(assetId: AssetId): AnnotatedPreset[] {
  const mapped = LAB_PRESETS.map((preset) => ({
    ...preset,
    clip: resolveClipName(assetId, preset.id),
  }))
  const uses = mapped.reduce<Record<string, number>>((acc, preset) => {
    if (preset.clip) acc[preset.clip] = (acc[preset.clip] ?? 0) + 1
    return acc
  }, {})
  return mapped.map((preset) => ({
    ...preset,
    shared: preset.clip ? (uses[preset.clip] ?? 1) : 1,
  }))
}

export function speciesIndexFor(id: string | undefined): number {
  const index = SPECIES.findIndex((species) => species.id === id)
  return index >= 0 ? index : 0
}

export function isLabSpeciesId(id: string | undefined): id is AssetId {
  return Boolean(id && Object.hasOwn(ASSETS, id) && SPECIES.some((species) => species.id === id))
}

export interface LabSearch {
  speciesIndex: number
  state: ModelState
  procedural: boolean
  auto: boolean
  speed: number
  camera: LabCamera
  theme: LabTheme
}

const CAMERAS = new Set<string>(CAMERA_KEYS)
const THEMES = new Set<LabTheme>(['dark', 'light', 'monochrome'])

function firstParam(value: string | string[] | null | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value ?? undefined
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === '1' || value === 'true') return true
  if (value === '0' || value === 'false') return false
  return undefined
}

/** Parse `?species=&state=&procedural=&auto=&speed=&camera=&theme=`. Unknown values are dropped, not remapped. */
export function parseLabSearch(params: URLSearchParams | Record<string, string | string[] | undefined>): Partial<LabSearch> {
  const read = (key: string): string | undefined => {
    if (params instanceof URLSearchParams) return params.get(key) ?? undefined
    return firstParam(params[key])
  }

  const next: Partial<LabSearch> = {}
  const species = read('species')
  if (isLabSpeciesId(species)) next.speciesIndex = speciesIndexFor(species)

  const state = resolveRequestedState(read('state') ?? '')
  if (state) next.state = state

  const procedural = parseBoolean(read('procedural'))
  if (procedural !== undefined) next.procedural = procedural

  const auto = parseBoolean(read('auto'))
  if (auto !== undefined) next.auto = auto

  const speedRaw = read('speed')
  if (speedRaw !== undefined) {
    const speed = Number(speedRaw)
    if (Number.isFinite(speed)) next.speed = Math.min(60, Math.max(0, speed))
  }

  const camera = read('camera')
  if (camera && CAMERAS.has(camera)) next.camera = camera as LabCamera

  const theme = read('theme')
  if (theme && THEMES.has(theme as LabTheme)) next.theme = theme as LabTheme

  return next
}

export function serializeLabSearch(search: LabSearch): string {
  const params = new URLSearchParams()
  const species = SPECIES[search.speciesIndex]
  if (species) params.set('species', species.id)
  params.set('state', search.state)
  if (search.procedural) params.set('procedural', '1')
  if (search.auto) params.set('auto', '1')
  if (search.speed !== 18) params.set('speed', String(search.speed))
  if (search.camera !== 'side') params.set('camera', search.camera)
  if (search.theme !== 'dark') params.set('theme', search.theme)
  const encoded = params.toString()
  return encoded ? `?${encoded}` : ''
}
