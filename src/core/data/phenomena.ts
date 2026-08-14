import { REGIONS } from './regions'

/**
 * Ambient phenomena — the authored observation activity per biome family
 * (Biome Enhancement Stage 4).
 *
 * Each biome family has exactly one characteristic phenomenon to observe:
 * a migration trail, a species sign, a vista or a timed environmental event.
 * Phenomena are presentation-flavoured but the observation *record* lives in
 * core: one intent, one event, one knowledge field. No resource rewards —
 * active hunting remains Highlands-owned.
 */

export type PhenomenonKind = 'migration' | 'speciesSign' | 'vista' | 'timed'

export interface PhenomenonDef {
  id: string
  name: string
  description: string
  kind: PhenomenonKind
  /** Ambient agent vocabulary that visualizes the phenomenon in-region. */
  ambient: 'birds' | 'fireflies' | 'spores' | 'embers' | 'crystalPulses' | 'fish' | 'deer'
  /** Biomes whose regions carry this phenomenon. */
  biomes: string[]
}

export const PHENOMENA: PhenomenonDef[] = [
  {
    id: 'phenomenon.valley_lark_migration',
    name: 'Meadowlark Migration Trail',
    description: 'Dawn flocks of meadowlarks wheel between the valley orchards on a fixed seasonal path.',
    kind: 'migration',
    ambient: 'birds',
    biomes: ['valley'],
  },
  {
    id: 'phenomenon.coad_gull_migration',
    name: 'Tern Migration Corridor',
    description: 'Sea terns trace the shoreline thermals in long files, riding the coastal wind north.',
    kind: 'migration',
    ambient: 'birds',
    biomes: ['coast'],
  },
  {
    id: 'phenomenon.forest_thornwing_signs',
    name: 'Thornwing Roost Marks',
    description: 'Claw-scored bark and downy feathers mark where Thornwings roost above the canopy.',
    kind: 'speciesSign',
    ambient: 'birds',
    biomes: ['forest', 'grove'],
  },
  {
    id: 'phenomenon.marsh_fenlights',
    name: 'Fen Light Bloom',
    description: 'On windless evenings, marsh gases kindle drifting lights over the black water.',
    kind: 'timed',
    ambient: 'fireflies',
    biomes: ['marsh', 'swamp'],
  },
  {
    id: 'phenomenon.moor_windcarved_vista',
    name: 'Windcarve Overlook',
    description: 'A limestone shelf where the west wind has sculpted ribs in the stone, overlooking sea lanes.',
    kind: 'vista',
    ambient: 'birds',
    biomes: ['moor', 'barrens'],
  },
  {
    id: 'phenomenon.mountain_cragwing_updraft',
    name: 'Cragwing Updraft Spiral',
    description: 'Wild Cragwings ride the same noon updraft, spiralling the crag in a slowAscending column.',
    kind: 'migration',
    ambient: 'birds',
    biomes: ['mountain', 'highland', 'spire', 'tundra'],
  },
  {
    id: 'phenomenon.cavern_resonance_pulse',
    name: 'Crystal Resonance Pulse',
    description: 'The geode clusters brighten in sequence as underground water strikes a harmonic interval.',
    kind: 'timed',
    ambient: 'crystalPulses',
    biomes: ['cavern'],
  },
  {
    id: 'phenomenon.jungle_emberback_wallows',
    name: 'Emberback Wallows',
    description: 'Warm mud hollows scented with ash — the resting sign of Emberback drakes passing through.',
    kind: 'speciesSign',
    ambient: 'fireflies',
    biomes: ['jungle'],
  },
  {
    id: 'phenomenon.ashland_ember_fall',
    name: 'Cinder Drift',
    description: 'Glowing embers rise from fissures at dusk and drift downwind like slow orange snow.',
    kind: 'timed',
    ambient: 'embers',
    biomes: ['ashland'],
  },
]

const BY_BIOME: Record<string, PhenomenonDef> = Object.fromEntries(
  PHENOMENA.flatMap((p) => p.biomes.map((b) => [b, p])),
)

/** The phenomenon a region carries, from its biome. Null for unmapped biomes. */
export function getRegionPhenomenon(regionId: string): PhenomenonDef | null {
  const def = REGIONS[regionId]
  if (!def) return null
  return BY_BIOME[def.biome] ?? null
}

/** True when the phenomenon belongs to the region (validation for executions). */
export function isPhenomenonOfRegion(regionId: string, phenomenonId: string): boolean {
  return getRegionPhenomenon(regionId)?.id === phenomenonId
}
