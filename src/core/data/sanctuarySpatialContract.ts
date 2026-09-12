/**
 * Authoritative spatial and visual contract for the 120 m Sanctuary campus.
 *
 * This module is deliberately dependency-free: Sanctuary Studio mirrors this
 * file byte-for-byte and may only adapt it, never edit its coordinates.
 */
export type SanctuaryStationPanel = 'warTable' | 'roster' | 'barracks' | 'infirmary' | 'hatchery' | 'breeding' | 'training'
export type SanctuaryZone = 'keepCourt' | 'careWing' | 'roostWing' | 'trainingWest' | 'flightCommons' | 'craftYard' | 'burnRim'
export type SanctuaryVisualRole =
  | 'commandCourt' | 'archive' | 'barracks' | 'infirmary' | 'hatchery' | 'breedingRoost'
  | 'huntingEdge' | 'flightRing' | 'burnRange' | 'enduranceTrailhead' | 'forge' | 'juvenileRoost'

export interface SanctuaryVisualAnchor {
  /** Semantic placement name, stable across model swaps. */
  name: string
  role: SanctuaryVisualRole
  /** Local [x, y, z] from the station origin. */
  position: readonly [number, number, number]
  facing: number
  /** Only these anchors may occupy the low-obstruction flight corridor. */
  flightApproved?: boolean
}

export interface SanctuaryStationContract {
  label: string
  panel: SanctuaryStationPanel
  station?: string
  zone: SanctuaryZone
  position: readonly [number, number]
  footprint: readonly [number, number]
  radius: number
  clearance: number
  facing: number
  /** Player-facing final approach, outside the footprint. */
  approach: readonly [number, number]
  /** Where the square road network terminates. */
  roadConnection: readonly [number, number]
  visualAnchors: readonly SanctuaryVisualAnchor[]
}

const anchors = (role: SanctuaryVisualRole, names: readonly string[], flightApproved = false): SanctuaryVisualAnchor[] =>
  names.map((name, index) => ({ name, role, position: [index === 0 ? 0 : (index % 2 ? -2.2 : 2.2), 0, index === 0 ? 0 : 1.6], facing: 0, ...(flightApproved ? { flightApproved: true } : {}) }))

export const SANCTUARY_SPATIAL_CONTRACT = {
  warTable: { label: 'War Table', panel: 'warTable', zone: 'keepCourt', position: [0, -30], footprint: [7, 5], radius: 3.5, clearance: 4, facing: 0, approach: [0, -25.5], roadConnection: [0, -18], visualAnchors: anchors('commandCourt', ['keep-gate', 'warden-left', 'warden-right']) },
  roster: { label: 'Roster Ledger', panel: 'roster', zone: 'keepCourt', position: [-10, -30], footprint: [5, 5], radius: 3, clearance: 3, facing: 0, approach: [-10, -26], roadConnection: [-10, -26], visualAnchors: anchors('archive', ['archive-lectern', 'archive-chest']) },
  barracks: { label: 'Barracks', panel: 'barracks', zone: 'keepCourt', position: [10, -30], footprint: [6, 5], radius: 3, clearance: 4, facing: Math.PI, approach: [10, -26], roadConnection: [10, -26], visualAnchors: anchors('barracks', ['barracks-blockade', 'barracks-supplies']) },
  infirmary: { label: 'Infirmary', panel: 'infirmary', zone: 'keepCourt', position: [-10, -21], footprint: [6, 5], radius: 3, clearance: 4, facing: 0, approach: [-10, -17], roadConnection: [-10, -17], visualAnchors: anchors('infirmary', ['healing-fire', 'medicine-store']) },
  hatchery: { label: 'Hatchery', panel: 'hatchery', zone: 'careWing', position: [22, -6], footprint: [8, 8], radius: 4, clearance: 10, facing: Math.PI / 2, approach: [17, -6], roadConnection: [16.8, -6], visualAnchors: anchors('hatchery', ['incubation-cave', 'egg-ward-left', 'egg-ward-right', 'juvenile-roost']) },
  breeding: { label: 'Breeding Roosts', panel: 'breeding', zone: 'roostWing', position: [30, 14], footprint: [8, 8], radius: 4, clearance: 10, facing: Math.PI / 2, approach: [25, 14], roadConnection: [24.8, 14], visualAnchors: anchors('breedingRoost', ['roost-plateau', 'rune-north', 'rune-south']) },
  huntingPen: { label: 'Hunting Pen', panel: 'training', station: 'huntingPen', zone: 'trainingWest', position: [-26, 4], footprint: [7, 7], radius: 3.5, clearance: 10, facing: -Math.PI / 2, approach: [-21.5, 4], roadConnection: [-21.3, 4], visualAnchors: anchors('huntingEdge', ['hunting-gate', 'prey-cover']) },
  flightRing: { label: 'Flight Ring', panel: 'training', station: 'flightRing', zone: 'flightCommons', position: [0, 24], footprint: [9, 9], radius: 4.5, clearance: 11, facing: 0, approach: [0, 18.5], roadConnection: [0, 18.3], visualAnchors: anchors('flightRing', ['ring-center', 'ring-marker-north', 'ring-marker-south'], true) },
  burnRange: { label: 'Burn Range', panel: 'training', station: 'burnRange', zone: 'burnRim', position: [30, 38], footprint: [7, 7], radius: 3.5, clearance: 11.5, facing: 0, approach: [30, 33.5], roadConnection: [30, 33.3], visualAnchors: anchors('burnRange', ['burn-hearth', 'ash-marker']) },
  enduranceRun: { label: 'Endurance Run', panel: 'training', station: 'enduranceRun', zone: 'trainingWest', position: [-42, 18], footprint: [7, 7], radius: 3.5, clearance: 10, facing: -Math.PI / 2, approach: [-37.5, 18], roadConnection: [-37.3, 18], visualAnchors: anchors('enduranceTrailhead', ['trailhead-sign', 'water-stop']) },
  scaleForge: { label: 'Scale Forge', panel: 'training', station: 'scaleForge', zone: 'craftYard', position: [42, -14], footprint: [7, 7], radius: 3.5, clearance: 9, facing: 0, approach: [42, -9.5], roadConnection: [42, -9.3], visualAnchors: anchors('forge', ['forge-furnace', 'forge-anvil', 'forge-trough']) },
} as const satisfies Record<string, SanctuaryStationContract>

export type SanctuaryStationId = keyof typeof SANCTUARY_SPATIAL_CONTRACT
export const SANCTUARY_CONTRACT_VERSION = 2 as const
export const FLIGHT_CORRIDOR = { minX: -16, maxX: 16, minZ: -12, maxZ: 28 } as const

export function sanctuaryPosition(id: SanctuaryStationId): [number, number] { return [...SANCTUARY_SPATIAL_CONTRACT[id].position] }
export function sanctuaryPosition3(id: SanctuaryStationId): [number, number, number] { const [x, z] = sanctuaryPosition(id); return [x, 0, z] }
