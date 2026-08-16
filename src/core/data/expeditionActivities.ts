import { REGIONS } from './regions'

/**
 * Expedition activities — interactive ecological puzzles, environmental hazard
 * navigation, and regional surveys in wild biomes.
 *
 * Expands beyond passive observation into physical interactive exploration.
 * All state is pure and deterministic: positions and activation states are
 * derived from (seed, regionId, activityId), and completions are recorded in
 * core `atlasKnowledge` with typed events.
 */

export type ActivityKind = 'puzzle' | 'hazard' | 'trail' | 'survey'

export interface ExpeditionActivityDef {
  id: string
  name: string
  description: string
  kind: ActivityKind
  objective: string
  hint: string
  /** Biomes whose regions carry this activity. */
  biomes: string[]
  /** Category tag added to atlas dossier upon completion. */
  knowledgeTag: string
  /** Color theme for in-world visual representation. */
  themeColor: string
}

export const EXPEDITION_ACTIVITIES: ExpeditionActivityDef[] = [
  {
    id: 'activity.cavern_resonance_glyphs',
    name: 'Harmonic Geode Tuning',
    description: 'Ancient crystal nodes hum in harmonic frequencies. Align their resonance to unlock geode luminescence.',
    kind: 'puzzle',
    objective: 'Tune the 3 resonant crystal nodes in sequence.',
    hint: 'Listen and observe the crystal luminescence order.',
    biomes: ['cavern'],
    knowledgeTag: 'Resonance Harmonicist',
    themeColor: '#38bdf8',
  },
  {
    id: 'activity.ashland_pyroclastic_fumaroles',
    name: 'Fumarole Vent Navigation',
    description: 'Intense thermal vents vent superheated sulfur gas in periodic bursts across the basalt fissures.',
    kind: 'hazard',
    objective: 'Survey all thermal fissures when gas pressure subsides.',
    hint: 'Wait for the plume emission to settle before approaching.',
    biomes: ['ashland'],
    knowledgeTag: 'Cinder Strider',
    themeColor: '#f97316',
  },
  {
    id: 'activity.grove_ancient_glyph_trio',
    name: 'Canopy Glyph Alignment',
    description: 'Moss-covered elder stones bearing primal wyvern glyphs scattered among the ancient roots.',
    kind: 'puzzle',
    objective: 'Activate the three runic elder stones in the grove.',
    hint: 'Search around the grand trunk perimeter and stone circle.',
    biomes: ['grove', 'forest'],
    knowledgeTag: 'Elderwood Inquirer',
    themeColor: '#4ade80',
  },
  {
    id: 'activity.mountain_crag_updraft_survey',
    name: 'Crag Updraft Thermal Beacon',
    description: 'High wind funnels between mountain pillars create dangerous sheer currents and thermal vortexes.',
    kind: 'hazard',
    objective: 'Navigate the high-altitude cliff vantage and plant a survey marker.',
    hint: 'Use the lee side of the ridge to avoid sheer winds.',
    biomes: ['mountain', 'spire', 'highland', 'tundra'],
    knowledgeTag: 'Aero Vanguard',
    themeColor: '#a78bfa',
  },
  {
    id: 'activity.coast_tidal_menhir_alignment',
    name: 'Tidal Monolith Sequence',
    description: 'Salt-bleached menhirs along the shoreline align with celestial tides.',
    kind: 'puzzle',
    objective: 'Channel the tidal energy through the coastal menhir anchors.',
    hint: 'Approach the stones from the surf line toward the high cliffs.',
    biomes: ['coast'],
    knowledgeTag: 'Tidewalker Surveyor',
    themeColor: '#2dd4bf',
  },
  {
    id: 'activity.marsh_fen_miasma_purge',
    name: 'Fen Miasma Vent Cleansing',
    description: 'Noxious bog gas pools in sunken hollows, igniting faint spirit lights on still nights.',
    kind: 'hazard',
    objective: 'Trigger the marsh gas dispersers to clear the foul hollow.',
    hint: 'Move quickly between elevated hummocks to stay clear of the mist.',
    biomes: ['marsh', 'swamp'],
    knowledgeTag: 'Mire Pathfinder',
    themeColor: '#84cc16',
  },
  {
    id: 'activity.jungle_ancient_ruin_totem',
    name: 'Overgrown Ruin Totem',
    description: 'Stone effigies of forgotten serpent drakes hidden beneath thick jungle lianas and vines.',
    kind: 'puzzle',
    objective: 'Uncover and energize the ancient serpent totems in the jungle clearing.',
    hint: 'Look for carved serpentine stone pillars nestled near broadleaf canopies.',
    biomes: ['jungle'],
    knowledgeTag: 'Primeval Scholar',
    themeColor: '#10b981',
  },
  {
    id: 'activity.valley_meadow_trail_blaze',
    name: 'Valley Flora Survey Trail',
    description: 'Rare wild nectarine blooms and herb clusters blooming across the sunlit valley contours.',
    kind: 'trail',
    objective: 'Catalogue the rare flora stations across the valley traverse.',
    hint: 'Follow the natural meadow slope towards the western brook.',
    biomes: ['valley'],
    knowledgeTag: 'Flora Cartographer',
    themeColor: '#fbbf24',
  },
  {
    id: 'activity.moor_barrow_standing_stone',
    name: 'Windswept Barrow Rites',
    description: 'Weather-beaten barrow markers standing sentinel against endless moorland gale.',
    kind: 'survey',
    objective: 'Survey the ancient barrow markers to decipher ancient boundary runes.',
    hint: 'Follow the ridge line connecting the standing stones.',
    biomes: ['moor', 'barrens'],
    knowledgeTag: 'Barrow Sentinel',
    themeColor: '#94a3b8',
  },
]

const BY_BIOME: Record<string, ExpeditionActivityDef> = Object.fromEntries(
  EXPEDITION_ACTIVITIES.flatMap((a) => a.biomes.map((b) => [b, a])),
)

/** Returns the authored expedition activity for a given region. */
export function getRegionExpeditionActivity(regionId: string): ExpeditionActivityDef | null {
  const def = REGIONS[regionId]
  if (!def) return null
  return BY_BIOME[def.biome] ?? null
}

/** Validates whether an activity ID is legitimate for a given region. */
export function isActivityOfRegion(regionId: string, activityId: string): boolean {
  return getRegionExpeditionActivity(regionId)?.id === activityId
}
