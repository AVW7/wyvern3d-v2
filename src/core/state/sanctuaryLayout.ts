import type { SanctuaryLayoutState, SanctuaryPlacedObject, SanctuaryObjectCategory } from '../types'
import {
  LEGACY_SANCTUARY_STATION_POSITIONS,
  SANCTUARY_STATIONS,
  sanctuaryPosition3,
  type SanctuaryStationId,
} from '../data/sanctuaryStations'
import { SANCTUARY_CONTRACT_VERSION } from '../data/sanctuarySpatialContract'

export interface PropCatalogEntry {
  propId: string
  label: string
  category: SanctuaryObjectCategory
  /** Variant group for editor catalogue grouping (e.g. 'forge', 'perch', 'ring'). */
  group?: string
  defaultScale?: number
  description: string
  isStructure?: boolean
  station?: string
  panel?: string
  radius?: number
  requiredDuties?: number
  milestoneName?: string
  /** Prop must never be placed inside the central flight corridor. */
  flightClearanceRequired?: boolean
}

/** Catalog of all placeable props and structures in the Sanctuary */
export const PROP_CATALOG: Record<string, PropCatalogEntry> = {
  // Structures
  'prop.warTable': { propId: 'prop.warTable', label: 'War Table', category: 'structure', isStructure: true, panel: 'warTable', radius: 3.5, description: 'Command center to plan campaign attacks.' },
  'prop.lectern': { propId: 'prop.lectern', label: 'Roster Ledger', category: 'structure', isStructure: true, panel: 'roster', radius: 3.0, description: 'Inspect wyvern stats and traits.' },
  'prop.hatchery.cave': { propId: 'prop.hatchery.cave', label: 'Hatchery Cave', category: 'structure', isStructure: true, panel: 'hatchery', radius: 4.0, description: 'Brood and incubate wyvern eggs.' },
  'prop.roost.plateau': { propId: 'prop.roost.plateau', label: 'Breeding Roost', category: 'structure', isStructure: true, panel: 'breeding', radius: 4.0, description: 'Pair wyverns for breeding.' },
  'prop.forge.furnace': { propId: 'prop.forge.furnace', label: 'Scale Forge', category: 'structure', isStructure: true, station: 'scaleForge', panel: 'training', radius: 3.5, description: 'Forge armor and train wyvern defense.' },
  'prop.burn.volcano': { propId: 'prop.burn.volcano', label: 'Burn Volcano', category: 'structure', isStructure: true, station: 'burnRange', panel: 'training', radius: 3.5, description: 'Practice wyvern breath firepower.' },
  'prop.ring.columnA': { propId: 'prop.ring.columnA', label: 'Flight Menhir', category: 'structure', isStructure: true, station: 'flightRing', panel: 'training', radius: 4.5, description: 'Ring of standing stones to train flight speed.' },
  'prop.signpost': { propId: 'prop.signpost', label: 'Endurance Signpost', category: 'structure', isStructure: true, station: 'enduranceRun', panel: 'training', radius: 3.5, description: 'Trailhead to train stamina.' },

  // Utility & Furniture
  'prop.torch': { propId: 'prop.torch', label: 'Standing Torch', category: 'utility', description: 'Illuminates the sanctuary grounds.' },
  'prop.chest': { propId: 'prop.chest', label: 'Iron Chest', category: 'furniture', description: 'Secure container for gear and supplies.' },
  'prop.barrel': { propId: 'prop.barrel', label: 'Supply Barrel', category: 'furniture', description: 'Stores rations and liquids.' },
  'prop.crate': { propId: 'prop.crate', label: 'Wooden Crate', category: 'furniture', description: 'Storage box for armory goods.' },
  'prop.logPile': { propId: 'prop.logPile', label: 'Log Pile', category: 'utility', description: 'Firewood fuel stack.' },
  'prop.blockade': { propId: 'prop.blockade', label: 'Wooden Blockade', category: 'furniture', description: 'Heavy timber defensive barrier.' },
  'prop.campfire': { propId: 'prop.campfire', label: 'Infirmary Fire', category: 'utility', description: 'Warm fire for healing injuries.' },
  'prop.forge.anvil': { propId: 'prop.forge.anvil', label: 'Forge Anvil', category: 'utility', group: 'forge', defaultScale: 0.55, description: 'Struck steel for scale-plate armor.' },
  'prop.forge.trough': { propId: 'prop.forge.trough', label: 'Quenching Trough', category: 'utility', group: 'forge', requiredDuties: 6, milestoneName: 'Quenching Basin & Troughs', description: 'Water bath for cooling hot metal and watering wyverns.' },
  'prop.forge.grindstone': { propId: 'prop.forge.grindstone', label: 'Grinding Stone', category: 'utility', group: 'forge', description: 'Whetstone wheel for finishing edges.' },

  // Scenery & Decor
  'prop.roost.runeStone': { propId: 'prop.roost.runeStone', label: 'Rune Stone', category: 'scenery', group: 'roost', description: 'Ancient carved stone emitting arcane energy.' },
  'prop.fenceA': { propId: 'prop.fenceA', label: 'Picket Fence A', category: 'scenery', group: 'fence', description: 'Rustic wooden fencing section.' },
  'prop.fenceB': { propId: 'prop.fenceB', label: 'Picket Fence B', category: 'scenery', group: 'fence', description: 'Post and rail fence section.' },
  'prop.pathA': { propId: 'prop.pathA', label: 'Stone Flagstone', category: 'scenery', group: 'path', description: 'Cobblestone walkway segment.' },
  'prop.pathB': { propId: 'prop.pathB', label: 'Curved Flagstone', category: 'scenery', group: 'path', description: 'Curved stone walkway segment.' },
  'prop.perch.stump': { propId: 'prop.perch.stump', label: 'Tree Stump', category: 'scenery', group: 'perch', description: 'Weathered stump for resting.' },
  'prop.perch.rockA': { propId: 'prop.perch.rockA', label: 'Moss Rock A', category: 'scenery', group: 'perch', description: 'Mossy boulder accent.' },
  'prop.perch.rockB': { propId: 'prop.perch.rockB', label: 'Moss Rock B', category: 'scenery', group: 'perch', description: 'Jagged rock formation.' },
  'prop.perch.trunk': { propId: 'prop.perch.trunk', label: 'Wyvern Log Perch', category: 'scenery', group: 'perch', requiredDuties: 3, milestoneName: 'Sanctuary Perches & Roosts', description: 'Fallen tree log for wyverns to roost.', flightClearanceRequired: true },
  'prop.ring.menhir': { propId: 'prop.ring.menhir', label: 'Sacred Menhir', category: 'scenery', group: 'ring', requiredDuties: 10, milestoneName: 'Sacred Menhir Monoliths', description: 'Ancient floating menhir stone that inspires grooming and rest.', flightClearanceRequired: true },
  'prop.burn.lavaStone': { propId: 'prop.burn.lavaStone', label: 'Lava Stone', category: 'scenery', group: 'burn', description: 'Glowing volcanic stone.' },
  'prop.burn.lavaColumn': { propId: 'prop.burn.lavaColumn', label: 'Lava Hearth Column', category: 'scenery', group: 'burn', requiredDuties: 15, milestoneName: 'Volcanic Hearth Beacon', description: 'Glowing basalt pillar radiating volcanic warmth.' },
  'prop.burn.burnedTree': { propId: 'prop.burn.burnedTree', label: 'Scorched Tree', category: 'scenery', group: 'burn', description: 'Charred pine trunk.' },
}

/**
 * Checks whether a catalog prop is unlocked for placement.
 * Ensures backward compatibility by treating already-stocked or already-placed items as unlocked.
 */
export function isPropUnlocked(
  propId: string,
  completedDuties: number = 0,
  storage?: Record<string, number>,
  placedObjects?: readonly SanctuaryPlacedObject[],
): boolean {
  const entry = PROP_CATALOG[propId]
  if (!entry || !entry.requiredDuties) return true
  if (completedDuties >= entry.requiredDuties) return true
  if (storage && (storage[propId] ?? 0) > 0) return true
  if (placedObjects && placedObjects.some((o) => o.propId === propId)) return true
  return false
}

export function createDefaultSanctuaryLayout(): SanctuaryLayoutState {
  const objects: SanctuaryPlacedObject[] = [
    // Structures
    { id: 'warTable', propId: 'prop.warTable', position: sanctuaryPosition3('warTable'), rotationY: 0, scale: 1.8, category: 'structure', label: 'War Table', interactableId: 'warTable', panel: 'warTable', radius: 3.5 },
    { id: 'roster', propId: 'prop.lectern', position: sanctuaryPosition3('roster'), rotationY: 0.3, category: 'structure', label: 'Roster Ledger', interactableId: 'roster', panel: 'roster', radius: 3.0 },
    { id: 'barracks', propId: 'prop.blockade', position: sanctuaryPosition3('barracks'), rotationY: Math.PI, category: 'structure', label: 'Barracks', interactableId: 'barracks', panel: 'barracks', radius: 3.0 },
    { id: 'infirmary', propId: 'prop.campfire', position: sanctuaryPosition3('infirmary'), rotationY: 0, category: 'structure', label: 'Infirmary', interactableId: 'infirmary', panel: 'infirmary', radius: 3.0 },
    { id: 'hatchery', propId: 'prop.hatchery.cave', position: sanctuaryPosition3('hatchery'), rotationY: Math.PI, scale: 0.75, category: 'structure', label: 'Hatchery', interactableId: 'hatchery', panel: 'hatchery', radius: 4.0 },
    { id: 'breeding', propId: 'prop.roost.plateau', position: sanctuaryPosition3('breeding'), rotationY: -0.45, category: 'structure', label: 'Breeding Roosts', interactableId: 'breeding', panel: 'breeding', radius: 4.0 },
    { id: 'huntingPen', propId: 'prop.blockade', position: sanctuaryPosition3('huntingPen'), rotationY: 0.35, category: 'structure', label: 'Hunting Pen', interactableId: 'huntingPen', station: 'huntingPen', panel: 'training', radius: 3.5 },
    { id: 'flightRing', propId: 'prop.ring.columnA', position: sanctuaryPosition3('flightRing'), rotationY: 0, category: 'structure', label: 'Flight Ring', interactableId: 'flightRing', station: 'flightRing', panel: 'training', radius: 4.5 },
    { id: 'burnRange', propId: 'prop.burn.volcano', position: sanctuaryPosition3('burnRange'), rotationY: -0.35, scale: 0.8, category: 'structure', label: 'Burn Range', interactableId: 'burnRange', station: 'burnRange', panel: 'training', radius: 3.5 },
    { id: 'enduranceRun', propId: 'prop.signpost', position: sanctuaryPosition3('enduranceRun'), rotationY: 0.7, category: 'structure', label: 'Endurance Run', interactableId: 'enduranceRun', station: 'enduranceRun', panel: 'training', radius: 3.5 },
    { id: 'scaleForge', propId: 'prop.forge.furnace', position: sanctuaryPosition3('scaleForge'), rotationY: -0.2, category: 'structure', label: 'Scale Forge', interactableId: 'scaleForge', station: 'scaleForge', panel: 'training', radius: 3.5 },

    // Initial Scenery & Furniture Props
    { id: 'torch_wt_l', propId: 'prop.torch', position: [-2.6, 0, -30], rotationY: 0, category: 'utility', label: 'War Table Torch Left' },
    { id: 'torch_wt_r', propId: 'prop.torch', position: [2.6, 0, -30], rotationY: 0, category: 'utility', label: 'War Table Torch Right' },
    { id: 'chest_wt', propId: 'prop.chest', position: [0, 0, -32.2], rotationY: Math.PI, category: 'furniture', label: 'Keep Treasure Chest' },
    { id: 'chest_roster', propId: 'prop.chest', position: [-10.4, 0, -30.8], rotationY: -0.4, category: 'furniture', label: 'Ledger Chest' },
    { id: 'crate_barracks_1', propId: 'prop.crate', position: [7.7, 0, -29.4], rotationY: 0.5, category: 'furniture', label: 'Barracks Crate' },
    { id: 'barrel_barracks_1', propId: 'prop.barrel', position: [10.3, 0, -29.5], rotationY: 0, category: 'furniture', label: 'Barracks Barrel' },
    { id: 'torch_hatchery_l', propId: 'prop.torch', position: [10.6, 0, 0.6], rotationY: 0, category: 'utility', label: 'Hatchery Torch Left' },
    { id: 'torch_hatchery_r', propId: 'prop.torch', position: [17.4, 0, 0.6], rotationY: 0, category: 'utility', label: 'Hatchery Torch Right' },
    { id: 'anvil_forge', propId: 'prop.forge.anvil', position: [32, 0, -10.9], rotationY: 0.4, scale: 0.55, category: 'utility', label: 'Forge Anvil' },
    { id: 'trough_forge', propId: 'prop.forge.trough', position: [30.3, 0, -11.3], rotationY: 0, category: 'utility', label: 'Quenching Trough' },
    { id: 'grindstone_forge', propId: 'prop.forge.grindstone', position: [33.8, 0, -11.1], rotationY: -0.5, category: 'utility', label: 'Grinding Stone' },
    { id: 'runestone_breeding_1', propId: 'prop.roost.runeStone', position: [34, 0, 4.8], rotationY: 0, category: 'scenery', label: 'North Rune Stone' },
    { id: 'runestone_breeding_2', propId: 'prop.roost.runeStone', position: [34.8, 0, 11.4], rotationY: 0.9, category: 'scenery', label: 'South Rune Stone' },
    { id: 'logpile_infirmary', propId: 'prop.logPile', position: [-11.8, 0, -20.7], rotationY: -0.6, category: 'utility', label: 'Infirmary Log Pile' },
  ]

  const storage: Record<string, number> = {
    'prop.torch': 6,
    'prop.chest': 2,
    'prop.barrel': 6,
    'prop.crate': 6,
    'prop.logPile': 4,
    'prop.fenceA': 10,
    'prop.fenceB': 10,
    'prop.roost.runeStone': 4,
    'prop.perch.stump': 6,
    'prop.perch.rockA': 4,
    'prop.perch.rockB': 4,
    'prop.pathA': 8,
    'prop.pathB': 8,
    'prop.burn.lavaStone': 4,
    'prop.burn.burnedTree': 2,
  }

  return { objects, storage, spatialContractVersion: SANCTUARY_CONTRACT_VERSION }
}

/**
 * Layout edits are nested data, so editor undo must never retain mutable
 * references to the live core state. Keeping this clone in core also means a
 * restored layout can safely travel through the intent log and a replay.
 */
export function cloneSanctuaryLayout(layout: SanctuaryLayoutState): SanctuaryLayoutState {
  return {
    objects: layout.objects.map((object) => ({
      ...object,
      position: [...object.position] as [number, number, number],
    })),
    storage: { ...layout.storage },
    spatialContractVersion: layout.spatialContractVersion,
  }
}

const LEGACY_SUPPORT_POSITIONS: Record<string, readonly [number, number]> = {
  torch_hatchery_l: [12.6, -2.4],
  torch_hatchery_r: [19.4, -2.4],
  anvil_forge: [26, -12.9],
  trough_forge: [24.3, -13.3],
  grindstone_forge: [27.8, -13.1],
  runestone_breeding_1: [24, 0.8],
  runestone_breeding_2: [24.8, 7.4],
}

const MODERN_SUPPORT_POSITIONS: Record<string, readonly [number, number]> = {
  torch_hatchery_l: [10.6, 0.6],
  torch_hatchery_r: [17.4, 0.6],
  anvil_forge: [32, -10.9],
  trough_forge: [30.3, -11.3],
  grindstone_forge: [33.8, -11.1],
  runestone_breeding_1: [34, 4.8],
  runestone_breeding_2: [34.8, 11.4],
}

function isAt(position: readonly [number, number, number], expected: readonly [number, number]): boolean {
  return position[0] === expected[0] && position[2] === expected[1]
}

/**
 * Relocates only untouched version-1 defaults. Player-moved stations and
 * decorations remain exactly where the sanctuary editor put them.
 */
export function migrateLegacySanctuaryLayout(layout: SanctuaryLayoutState): SanctuaryLayoutState {
  if ((layout.spatialContractVersion ?? 0) >= SANCTUARY_CONTRACT_VERSION) return layout

  // The v2 contract deliberately promotes the Studio's measured 120 m plan.
  // Station-owned furniture follows the authored station delta exactly once;
  // all player-created props, rotations, scale and inventory stay untouched.
  const previousCampus: Record<SanctuaryStationId, readonly [number, number]> = {
    warTable: [0, -30], roster: [-9, -30], barracks: [9, -30], infirmary: [-13, -22],
    hatchery: [14, -3], breeding: [34, 8], huntingPen: [-30, 2], flightRing: [0, 30],
    burnRange: [34, 32], enduranceRun: [-38, 26], scaleForge: [32, -12],
  }
  const ownedFurniture: Partial<Record<SanctuaryStationId, readonly string[]>> = {
    warTable: ['torch_wt_l', 'torch_wt_r', 'chest_wt'], roster: ['chest_roster'],
    barracks: ['crate_barracks_1', 'barrel_barracks_1'], infirmary: ['logpile_infirmary'],
    hatchery: ['torch_hatchery_l', 'torch_hatchery_r'], breeding: ['runestone_breeding_1', 'runestone_breeding_2'],
    scaleForge: ['anvil_forge', 'trough_forge', 'grindstone_forge'],
  }
  const deltas = new Map<string, readonly [number, number]>()
  for (const id of Object.keys(SANCTUARY_STATIONS) as SanctuaryStationId[]) {
    const before = previousCampus[id]
    const after = SANCTUARY_STATIONS[id].position
    const delta: [number, number] = [after[0] - before[0], after[1] - before[1]]
    deltas.set(id, delta)
    for (const furnitureId of ownedFurniture[id] ?? []) deltas.set(furnitureId, delta)
  }
  for (const object of layout.objects) {
    if (object.id in SANCTUARY_STATIONS) {
      const id = object.id as SanctuaryStationId
      if (isAt(object.position, LEGACY_SANCTUARY_STATION_POSITIONS[id])) {
        object.position = sanctuaryPosition3(id)
        continue
      }
    }
    const legacy = LEGACY_SUPPORT_POSITIONS[object.id]
    const modern = MODERN_SUPPORT_POSITIONS[object.id]
    if (legacy && modern && isAt(object.position, legacy)) {
      object.position = [modern[0], object.position[1], modern[1]]
    }
    const delta = deltas.get(object.id)
    if (delta) object.position = [object.position[0] + delta[0], object.position[1], object.position[2] + delta[1]]
  }
  layout.spatialContractVersion = SANCTUARY_CONTRACT_VERSION
  return layout
}

export function ensureSanctuaryLayout(state: { sanctuaryLayout?: SanctuaryLayoutState }): SanctuaryLayoutState {
  if (!state.sanctuaryLayout) {
    state.sanctuaryLayout = createDefaultSanctuaryLayout()
  }
  if (!state.sanctuaryLayout.objects) {
    state.sanctuaryLayout.objects = createDefaultSanctuaryLayout().objects
  }
  if (!state.sanctuaryLayout.storage) {
    state.sanctuaryLayout.storage = createDefaultSanctuaryLayout().storage
  }
  return state.sanctuaryLayout
}
