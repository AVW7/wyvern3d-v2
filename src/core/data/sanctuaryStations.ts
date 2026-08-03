export type SanctuaryStationPanel =
  | 'warTable'
  | 'roster'
  | 'barracks'
  | 'infirmary'
  | 'hatchery'
  | 'breeding'
  | 'training'

export interface SanctuaryStationDefinition {
  label: string
  panel: SanctuaryStationPanel
  position: readonly [number, number]
  radius: number
  /**
   * Visual breathing room reserved around the station. This is deliberately
   * larger than the interaction radius so scenery does not crowd the landmark.
   */
  clearance: number
  station?: string
}

/**
 * The sanctuary is arranged as a small campus rather than a loose cluster:
 *
 * - the keep anchors the north;
 * - the Flight Ring terminates the central processional path;
 * - care, breeding and craft facilities form the quieter eastern wing;
 * - hunting, endurance and burn training sit on the wider outer arc.
 */
export const SANCTUARY_STATIONS = {
  warTable: {
    label: 'War Table',
    panel: 'warTable',
    position: [0, -30],
    radius: 3.5,
    clearance: 4,
  },
  roster: {
    label: 'Roster Ledger',
    panel: 'roster',
    position: [-9, -30],
    radius: 3,
    clearance: 3,
  },
  barracks: {
    label: 'Barracks',
    panel: 'barracks',
    position: [9, -30],
    radius: 3,
    clearance: 4,
  },
  infirmary: {
    label: 'Infirmary',
    panel: 'infirmary',
    position: [-13, -22],
    radius: 3,
    clearance: 4,
  },
  hatchery: {
    label: 'Hatchery',
    panel: 'hatchery',
    position: [14, -3],
    radius: 4,
    clearance: 10,
  },
  breeding: {
    label: 'Breeding Roosts',
    panel: 'breeding',
    position: [34, 8],
    radius: 4,
    clearance: 10,
  },
  huntingPen: {
    label: 'Hunting Pen',
    panel: 'training',
    station: 'huntingPen',
    position: [-30, 2],
    radius: 3.5,
    clearance: 10,
  },
  flightRing: {
    label: 'Flight Ring',
    panel: 'training',
    station: 'flightRing',
    position: [0, 30],
    radius: 4.5,
    clearance: 11,
  },
  burnRange: {
    label: 'Burn Range',
    panel: 'training',
    station: 'burnRange',
    position: [34, 32],
    radius: 3.5,
    clearance: 12,
  },
  enduranceRun: {
    label: 'Endurance Run',
    panel: 'training',
    station: 'enduranceRun',
    position: [-38, 26],
    radius: 3.5,
    clearance: 10,
  },
  scaleForge: {
    label: 'Scale Forge',
    panel: 'training',
    station: 'scaleForge',
    position: [32, -12],
    radius: 3.5,
    clearance: 9,
  },
} as const satisfies Record<string, SanctuaryStationDefinition>

export type SanctuaryStationId = keyof typeof SANCTUARY_STATIONS

/** Positions used by version-1 saves, retained only for a non-destructive migration. */
export const LEGACY_SANCTUARY_STATION_POSITIONS = {
  warTable: [0, -30],
  roster: [-9, -30],
  barracks: [9, -30],
  infirmary: [-13, -22],
  hatchery: [16, -6],
  breeding: [24, 4],
  huntingPen: [-18, 2],
  flightRing: [-4, 14],
  burnRange: [14, 18],
  enduranceRun: [-24, 16],
  scaleForge: [26, -14],
} as const satisfies Record<SanctuaryStationId, readonly [number, number]>

export function sanctuaryPosition(id: SanctuaryStationId): [number, number] {
  return [...SANCTUARY_STATIONS[id].position]
}

export function sanctuaryPosition3(id: SanctuaryStationId): [number, number, number] {
  const [x, z] = SANCTUARY_STATIONS[id].position
  return [x, 0, z]
}
