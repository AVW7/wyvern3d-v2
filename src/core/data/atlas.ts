import type { AtlasRegionData, LandmarkDef } from '../types'

/** Standard vocabulary of climate tags for filtering and indexing. */
export const CLIMATE_TAGS = [
  'temperate',
  'coastal',
  'humid',
  'arid',
  'subterranean',
  'alpine',
  'volcanic',
  'arctic',
  'windswept',
  'shadowed',
] as const

export type ClimateTag = (typeof CLIMATE_TAGS)[number]

/** Standard vocabulary of terrain tags for filtering and indexing. */
export const TERRAIN_TAGS = [
  'valleys',
  'lowlands',
  'woodland',
  'wetlands',
  'cliffs',
  'peaks',
  'plateaus',
  'caves',
  'canopy',
  'craters',
  'spires',
  'glaciers',
  'barrens',
] as const

export type TerrainTag = (typeof TERRAIN_TAGS)[number]

export const REGION_ATLAS_DATA: Record<string, AtlasRegionData> = {
  hearthvale: {
    summary:
      'A sheltered, fertile river valley cradled by ancient low hills. The ancestral seat of the dragon lords and high throne of the dragon realm.',
    climateTags: ['temperate'],
    terrainTags: ['valleys', 'lowlands'],
    threatNotes: 'Peaceful territory under secure player control; no hostile wild wyverns or encroaching incursions.',
    landmarks: [
      {
        id: 'hearthvale_high_perch',
        name: 'The High Perch',
        description: 'An ancient carved stone monolith overlooking the valley meadows where dragons roost in morning sun.',
        category: 'monolith',
      },
      {
        id: 'hearthvale_river_haven',
        name: 'Silverbrook Haven',
        description: 'A calm river basin fed by highland springs, supporting lush grazing herds and hatchery waters.',
        category: 'natural',
      },
    ],
  },
  sunkenreach: {
    summary:
      'A tidal shelf of brackish coves, tide pools, and drowned stone ruins where the western coast dips into the sea.',
    climateTags: ['coastal', 'temperate'],
    terrainTags: ['cliffs', 'lowlands'],
    threatNotes: 'Patrolled by coastal spear garrisons and roaming Emberback clutch-guards.',
    landmarks: [
      {
        id: 'sunkenreach_tide_gate',
        name: 'Drowned Archway',
        description: 'A sea-worn stone arch emerging from the coastal surf, encrusted in barnacles and sea glass.',
        category: 'ruin',
      },
      {
        id: 'sunkenreach_coral_cove',
        name: 'Glimmering Shoals',
        description: 'Shallow turquoise tide pools rich in coastal brine and nesting grounds for maritime wildlife.',
        category: 'natural',
      },
    ],
  },
  whisperingwoods: {
    summary:
      'A dense, wind-harrowed ancient woodland where the rustling canopy is said to carry warnings from elder drakes.',
    climateTags: ['temperate', 'humid'],
    terrainTags: ['woodland', 'valleys'],
    threatNotes: 'Entrenched woodland archers; Thornwings glide silently through the upper canopy.',
    landmarks: [
      {
        id: 'whisperingwoods_echo_hollow',
        name: 'Echo Hollow',
        description: 'A circular clearing ringed by towering ironwood trunks where gentle breezes create harmonic hums.',
        category: 'natural',
      },
      {
        id: 'whisperingwoods_watcher_stump',
        name: 'The Warden Trunk',
        description: 'The petrified hollow stump of a primordial tree, carved with archaic boundary runes.',
        category: 'monolith',
      },
    ],
  },
  ashfen: {
    summary:
      'A sprawling marshland blanketed by grey drift and volcanic particulate drifting down from northern summits.',
    climateTags: ['humid', 'temperate'],
    terrainTags: ['wetlands', 'lowlands'],
    threatNotes: 'Deceptive peat bogs and defensive spearman encampments guarding strategic trade crossings.',
    landmarks: [
      {
        id: 'ashfen_smoldering_bog',
        name: 'The Smoldering Mire',
        description: 'A bubbling peat pool radiating faint geothermal warmth through perpetual grey mist.',
        category: 'natural',
      },
      {
        id: 'ashfen_grey_watchpost',
        name: 'Fen Watch Bastion',
        description: 'A half-submerged timber and stone outpost overlooking the central bog highway.',
        category: 'settlement',
      },
    ],
  },
  greyreach: {
    summary:
      'A bleak, fog-shrouded expanse of heather and limestone ridges exposed to cold offshore squalls.',
    climateTags: ['windswept', 'temperate'],
    terrainTags: ['barrens', 'plateaus'],
    threatNotes: 'Combined spear and archer patrols; wild Cragwings frequent the exposed limestone crags.',
    landmarks: [
      {
        id: 'greyreach_standing_stones',
        name: 'The Grey Sentinels',
        description: 'A ring of weather-beaten monoliths that predates recorded empire chronicles.',
        category: 'monolith',
      },
      {
        id: 'greyreach_heather_rise',
        name: 'Windtorn Ridge',
        description: 'The highest crest of the moors, offering panoramic views over western sea lanes.',
        category: 'natural',
      },
    ],
  },
  thornmarch: {
    summary:
      'An impassable thicket of bramble-forest and deep hollows that forms a natural bastion along the eastern march.',
    climateTags: ['temperate', 'humid'],
    terrainTags: ['woodland', 'wetlands'],
    threatNotes: 'Heavily fortified archer garrisons nestled in elevated bramble blinds; native habitat of wild Thornwings.',
    landmarks: [
      {
        id: 'thornmarch_bramble_heart',
        name: 'The Iron Briar',
        description: 'A massive intertwining knot of petrified thorn-vines forming a natural defensive dome.',
        category: 'natural',
      },
      {
        id: 'thornmarch_outpost',
        name: 'Thorn Bastion',
        description: 'A fortified timber gatehouse barring the transit line into deeper eastern groves.',
        category: 'settlement',
      },
    ],
  },
  saltcrag: {
    summary:
      'Towering maritime cliffs coated in crystalline salt deposits, constantly pounded by violent ocean breakers.',
    climateTags: ['coastal', 'windswept'],
    terrainTags: ['cliffs', 'peaks'],
    threatNotes: 'Heavy infantry garrison reinforced with coastal ballistas; Cragwing defenders dive from high roosts.',
    landmarks: [
      {
        id: 'saltcrag_salt_pillar',
        name: 'The Salt Needle',
        description: 'A sheer sea stack rising thirty metres out of the churning sea, gleaming white in the sun.',
        category: 'monolith',
      },
      {
        id: 'saltcrag_brine_falls',
        name: 'Brine Cascade',
        description: 'A coastal waterfall cascading down stepped limestone shelves into sea caves below.',
        category: 'natural',
      },
    ],
  },
  cinderpeaks: {
    summary:
      'Jagged alpine crags venting sulfurous steam, rich in surface ore veins and cooled basalt columns.',
    climateTags: ['volcanic', 'alpine'],
    terrainTags: ['peaks', 'craters'],
    threatNotes: 'Tier 2 vanguard legion supported by siege units and aggressive Cragwing combatants.',
    landmarks: [
      {
        id: 'cinderpeaks_caldera',
        name: 'Ashen Caldera',
        description: 'A steaming volcanic depression surrounded by glowing vents and black glass shards.',
        category: 'natural',
      },
      {
        id: 'cinderpeaks_slag_forge',
        name: 'Ancient Slag Works',
        description: 'The scorched stone ruins of a subterranean forge harnessing mountain vents.',
        category: 'ruin',
      },
    ],
  },
  ironhold: {
    summary:
      'A fortified highland plateau rich in iron seams, defended by steep ravines and fortified palisades.',
    climateTags: ['windswept', 'temperate'],
    terrainTags: ['plateaus', 'cliffs'],
    threatNotes: 'Elite spearmen squads and swift outrider cavalry; heavily fortified hillworks.',
    landmarks: [
      {
        id: 'ironhold_citadel_rock',
        name: 'Iron Bastion Rock',
        description: 'A sheer natural stone spur crowned with stone ramparts commanding the highland passes.',
        category: 'settlement',
      },
      {
        id: 'ironhold_quarry',
        name: 'The Great Delve',
        description: 'A vast stepped open quarry revealing rich veins of iron and crystalline strata.',
        category: 'ruin',
      },
    ],
  },
  crystalgrotto: {
    summary:
      'A subterranean cavern biome of luminescent geodes, underground streams, and resonance crystals.',
    climateTags: ['subterranean', 'humid'],
    terrainTags: ['caves', 'lowlands'],
    threatNotes: 'Tunnel archers and siege positions anchored in narrow choke points; guarded by Mirefang drakes.',
    landmarks: [
      {
        id: 'crystalgrotto_resonance_spire',
        name: 'The Prism Column',
        description: 'A colossal amethyst stalactite radiating arcane harmonic resonance through the cavern air.',
        category: 'shrine',
      },
      {
        id: 'crystalgrotto_sunless_lake',
        name: 'The Sunless Pool',
        description: 'A glassy subterranean lake reflecting bioluminescent moss and glowing crystal clusters.',
        category: 'natural',
      },
    ],
  },
  serpentfang: {
    summary:
      'A sweltering jungle canyon dense with giant ferns, ancient roots, and winding waterways.',
    climateTags: ['humid', 'temperate'],
    terrainTags: ['canopy', 'valleys'],
    threatNotes: 'Concealed archer nests and swift jungle riders; Mirefang ambushers strike from root tangles.',
    landmarks: [
      {
        id: 'serpentfang_canopy_altar',
        name: 'Fang Altar',
        description: 'A stepped vine-choked serpent temple constructed from green obsidian blocks.',
        category: 'shrine',
      },
      {
        id: 'serpentfang_emerald_falls',
        name: 'Emerald Chasm',
        description: 'A thunderous waterfall carving through deep jungle limestone into mist-filled basins.',
        category: 'natural',
      },
    ],
  },
  mirelands: {
    summary:
      'A vast flooded wilderness of tangled mangrove roots, murky waterways, and glowing fen-lights.',
    climateTags: ['humid', 'temperate'],
    terrainTags: ['wetlands', 'lowlands'],
    threatNotes: 'Marshland archers and swamp riders adapted to deep water; wild Mirefangs dominate water approaches.',
    landmarks: [
      {
        id: 'mirelands_drowned_sanctuary',
        name: 'The Sunken Pillar',
        description: 'A tilted stone obelisk resting in deep dark marsh water, carved with water wardings.',
        category: 'ruin',
      },
      {
        id: 'mirelands_cypress_throne',
        name: 'The Elder Cypress',
        description: 'A giant buttressed cypress with a span exceeding thirty metres, housing nesting water fowl.',
        category: 'natural',
      },
    ],
  },
  stonewatch: {
    summary:
      'High wind-carved stone bluffs guarding the threshold between eastern forests and the northern frostlands.',
    climateTags: ['alpine', 'windswept'],
    terrainTags: ['plateaus', 'cliffs'],
    threatNotes: 'Heavy spear battalions and archer batteries occupying commanding defensive terraces.',
    landmarks: [
      {
        id: 'stonewatch_watchtower',
        name: 'The Stonewatch Beacon',
        description: 'A stone fire-tower constructed on the highest highland ridge to signal realm borders.',
        category: 'settlement',
      },
      {
        id: 'stonewatch_gorge',
        name: 'Riven Pass',
        description: 'A narrow, sheer-walled mountain gorge that cuts directly through the stone massif.',
        category: 'natural',
      },
    ],
  },
  elderrootgrove: {
    summary:
      'A mystical secluded grove anchored around a monumental World Tree, rich in primordial arcane resonance.',
    climateTags: ['temperate', 'humid'],
    terrainTags: ['woodland', 'valleys'],
    threatNotes: 'Guardian archers and veteran spearmen protecting sacred drakes; native territory of Thornwings.',
    landmarks: [
      {
        id: 'elderrootgrove_world_tree',
        name: 'The Elder World Tree',
        description: 'A colossal ancient world tree towering over the central mound, roots binding the earth.',
        category: 'natural',
      },
      {
        id: 'elderrootgrove_druid_circle',
        name: 'The Ancient Stone Ring',
        description: 'Twelve standing stones encircling the sacred tree mound, channeling wild elemental mana.',
        category: 'shrine',
      },
    ],
  },
  emberwaste: {
    summary:
      'A desolate volcanic wasteland of smoldering fissures, soot drifts, and rivers of cooling slag.',
    climateTags: ['volcanic', 'arid'],
    terrainTags: ['craters', 'barrens'],
    threatNotes: 'Heavily armored cavalry and siege engines; defended by hostile Mirefangs and Cragwings.',
    landmarks: [
      {
        id: 'emberwaste_magma_fissure',
        name: 'The Great Fissure',
        description: 'A glowing tectonic trench exposing molten magma veins across the cracked desert floor.',
        category: 'natural',
      },
      {
        id: 'emberwaste_pyre_monolith',
        name: 'Pyre of the Fallen',
        description: 'A towering blackened monolith erected where ancient dragons waged primordial war.',
        category: 'monolith',
      },
    ],
  },
  obsidianridge: {
    summary:
      'A jagged spine of glassy black stone rising high above volcanic ash fields, razor-sharp and hostile.',
    climateTags: ['volcanic', 'windswept'],
    terrainTags: ['cliffs', 'peaks'],
    threatNotes: 'Veteran tier 3 garrison with heavy siege machines; Frostmaw and Cragwing war-flights.',
    landmarks: [
      {
        id: 'obsidianridge_needle_spires',
        name: 'The Obsidian Needles',
        description: 'A forest of natural volcanic glass pillars projecting upward like titan spears.',
        category: 'natural',
      },
      {
        id: 'obsidianridge_black_fort',
        name: 'The Black Redoubt',
        description: 'A fortress carved directly out of the obsidian rock face overlooking the northern approaches.',
        category: 'settlement',
      },
    ],
  },
  stormshores: {
    summary:
      'A tempest-ravaged shoreline of black sand, shipbreaking reefs, and permanent gale-force thunderheads.',
    climateTags: ['coastal', 'windswept'],
    terrainTags: ['cliffs', 'lowlands'],
    threatNotes: 'Heavy vanguard outriders and storm archers; airborne Frostmaw hunters patrol sea winds.',
    landmarks: [
      {
        id: 'stormshores_lighthouse_ruin',
        name: 'The Tempest Beacon',
        description: 'The ruined shell of an ancient sea lighthouse whose beacon lens still catches lightning.',
        category: 'ruin',
      },
      {
        id: 'stormshores_black_shoal',
        name: 'The Thunder Shoals',
        description: 'A wide stretch of obsidian sand where sea storms wash up rare arcane flotsam.',
        category: 'natural',
      },
    ],
  },
  glaciercrest: {
    summary:
      'A permafrost highland dominated by immense blue ice sheets, crevasse fields, and freezing mountain winds.',
    climateTags: ['arctic', 'alpine'],
    terrainTags: ['glaciers', 'peaks'],
    threatNotes: 'Hardened winter archers and heavy siege engines; Frostmaw apex predators rule the glacier rims.',
    landmarks: [
      {
        id: 'glaciercrest_ice_arch',
        name: 'The Azure Arch',
        description: 'A colossal natural bridge of dense glacial ice spanning a bottomless mountain crevasse.',
        category: 'natural',
      },
      {
        id: 'glaciercrest_frozen_shrine',
        name: 'Shrine of the Winter Drake',
        description: 'An ice-sheathed altar commemorating the first frost drakes that conquered the northern peaks.',
        category: 'shrine',
      },
    ],
  },
  frostgate: {
    summary:
      'The fortified northern portal through the glacier barrier, guarding the mountain ascent to the High Spire.',
    climateTags: ['arctic', 'windswept'],
    terrainTags: ['glaciers', 'cliffs'],
    threatNotes: 'Massive tier 3 defensive garrison with reinforced spear ranks and master archers.',
    landmarks: [
      {
        id: 'frostgate_iron_portal',
        name: 'The Frostgate Archway',
        description: 'A colossal fortified stone gatehouse embedded directly into the glacial wall.',
        category: 'settlement',
      },
      {
        id: 'frostgate_rime_lake',
        name: 'The Rime Basin',
        description: 'A frozen mountain tarn surrounded by sheer ice cliffs and crystal snow banks.',
        category: 'natural',
      },
    ],
  },
  hollowmoor: {
    summary:
      'A frozen, wind-scoured barren steppe strewn with ancient bleached bones and glacial erratics.',
    climateTags: ['arctic', 'arid'],
    terrainTags: ['barrens', 'plateaus'],
    threatNotes: 'Armored heavy riders and artillery batteries; roaming Frostmaw packs in blizzard conditions.',
    landmarks: [
      {
        id: 'hollowmoor_titan_ribs',
        name: 'The Titan Ribs',
        description: 'The petrified skeletal remains of a gargantuan primeval beast emerging from the frost soil.',
        category: 'monolith',
      },
      {
        id: 'hollowmoor_cairn_field',
        name: 'The Silent Cairns',
        description: 'Hundreds of stacked stone markers commemorating warriors who perished in northern blizzards.',
        category: 'ruin',
      },
    ],
  },
  shadowcitadel: {
    summary:
      'A forbidding black basalt spire fortress looming in the perpetual twilight of the northern mountains.',
    climateTags: ['shadowed', 'alpine'],
    terrainTags: ['spires', 'cliffs'],
    threatNotes: 'Elite tier 4 garrison of master spearmen, longbowmen, and vanguard riders; defended by Duskwyrms.',
    landmarks: [
      {
        id: 'shadowcitadel_high_keep',
        name: 'The Shadow Throne',
        description: 'The dark stone fortress perched at the apex of the black basalt pinnacle.',
        category: 'settlement',
      },
      {
        id: 'shadowcitadel_void_well',
        name: 'The Twilight Fissure',
        description: 'A fathomless chasm beneath the citadel venting shadowy elemental mist.',
        category: 'natural',
      },
    ],
  },
  duskspire: {
    summary:
      'The crown of the northern world: a towering monolithic spire piercing stormclouds where the apex drakes hold court.',
    climateTags: ['shadowed', 'windswept'],
    terrainTags: ['spires', 'peaks'],
    threatNotes: 'The supreme enemy stronghold: 100 spearmen, 90 archers, 50 siege engines, and three legendary drakes.',
    landmarks: [
      {
        id: 'duskspire_apex_roost',
        name: 'The High Spire Apex',
        description: 'The highest reachable point in the realm, where ancient Duskwyrms survey the entire continent.',
        category: 'monolith',
      },
      {
        id: 'duskspire_drake_throne',
        name: 'The Sovereign Dais',
        description: 'An ancient obsidian throne carved with the chronicle of every wyvern species in the world.',
        category: 'shrine',
      },
    ],
  },
}

/**
 * Returns static authored atlas data for a given region id.
 * Pure, static lookup with fallback.
 */
export function getRegionAtlasData(regionId: string): AtlasRegionData | null {
  return REGION_ATLAS_DATA[regionId] ?? null
}

/**
 * Returns all authored landmarks across the entire realm.
 */
export function getAllAuthoredLandmarks(): { regionId: string; landmark: LandmarkDef }[] {
  const result: { regionId: string; landmark: LandmarkDef }[] = []
  for (const [regionId, data] of Object.entries(REGION_ATLAS_DATA)) {
    for (const landmark of data.landmarks) {
      result.push({ regionId, landmark })
    }
  }
  return result
}
