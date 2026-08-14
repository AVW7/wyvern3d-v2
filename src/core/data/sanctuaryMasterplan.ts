import { SANCTUARY_STATIONS, type SanctuaryStationId } from './sanctuaryStations'

/**
 * The 6 spatial zones defined in the sanctuary masterplan design contract:
 *
 * 1. keepArrival: Northern keep and arrival court (civic/command anchor)
 * 2. careCourt: Sheltered eastern care court (infirmary, hatchery, breeding roosts)
 * 3. craftFireYard: Eastern craft and fire yard (scale forge, burn range, downwind)
 * 4. flightCommons: Central flight corridor (open airway for wyvern take-off, landings, and patrol)
 * 5. trainingEdge: Western rough training edge (hunting pen, endurance run trailhead)
 * 6. ecologicalPerimeter: Outer perimeter rim concealing the world boundary
 */
export type SanctuaryZoneId =
  | 'keepArrival'
  | 'careCourt'
  | 'craftFireYard'
  | 'flightCommons'
  | 'trainingEdge'
  | 'ecologicalPerimeter'

export interface SanctuaryZoneDefinition {
  id: SanctuaryZoneId
  label: string
  description: string
  stations: readonly SanctuaryStationId[]
  /** 2D AABB bounding envelope in the XZ plane [minX, minZ, maxX, maxZ] */
  bounds: readonly [number, number, number, number]
}

export const SANCTUARY_ZONES: Record<SanctuaryZoneId, SanctuaryZoneDefinition> = {
  keepArrival: {
    id: 'keepArrival',
    label: 'Northern Keep Court',
    description: 'Civic command center, war table, roster ledger, barracks, infirmary care, and north gate entrance.',
    stations: ['warTable', 'roster', 'barracks', 'infirmary'],
    bounds: [-18, -38, 18, -18],
  },
  careCourt: {
    id: 'careCourt',
    label: 'Sheltered Care Court',
    description: 'Quiet eastern wing for egg incubation and wyvern breeding.',
    stations: ['hatchery', 'breeding'],
    bounds: [8, -10, 48, 18],
  },
  craftFireYard: {
    id: 'craftFireYard',
    label: 'Craft & Fire Yard',
    description: 'Mineral-ground craft and forge facilities situated safely downwind of care areas.',
    stations: ['scaleForge', 'burnRange'],
    bounds: [20, -18, 48, 44],
  },
  flightCommons: {
    id: 'flightCommons',
    label: 'Central Flight Commons',
    description: 'Open, uncluttered corridor for wyvern landings, takeoffs, and aerial orientation.',
    stations: ['flightRing'],
    bounds: [-16, -12, 16, 36],
  },
  trainingEdge: {
    id: 'trainingEdge',
    label: 'Western Training Edge',
    description: 'Rough terrain edge leading toward the Highlands, hosting hunting and endurance training.',
    stations: ['huntingPen', 'enduranceRun'],
    bounds: [-48, -4, -18, 36],
  },
  ecologicalPerimeter: {
    id: 'ecologicalPerimeter',
    label: 'Ecological Perimeter',
    description: 'Clustered alpine conifers, rock formations, and terrain skirts concealing the outer rim.',
    stations: [],
    bounds: [-60, -60, 60, 60],
  },
} as const

/** Named authored clearance metrics in metres. */
export const SANCTUARY_CLEARANCE_METRICS = {
  /** Width of the main north-to-south processional walking spine. */
  mainPathWidth: 4.0,
  /** Width of secondary service paths branching to stations. */
  servicePathWidth: 2.4,
  /** Breathing room around interactive work tables and anvils. */
  stationApronRadius: 3.5,
  /** Distance from which the player triggers station interactions. */
  playerApproachDistance: 2.0,
  /** Ground radius reserved for a perched or resting adult wyvern. */
  wyvernRestEnvelopeRadius: 6.0,
  /** Large aerial corridor radius reserved around landing rings. */
  landingApproachClearance: 11.0,
  /** Fire/heat exclusion radius around the forge and burn range. */
  fireHazardClearance: 10.0,
  /** Outer boundary radius of the walkable sanctuary ground plane. */
  groundRadius: 60.0,
  /** Inner radius where dense perimeter woodland begins. */
  woodlandInnerRadius: 50.0,
} as const

/** Uncluttered 2D bounding box reserved for the central flight airway [minX, minZ, maxX, maxZ]. */
export const FLIGHT_CORRIDOR_BOX: readonly [number, number, number, number] = [-16, -12, 16, 28]

/**
 * Returns true if the coordinate falls inside the central flight corridor.
 * No tall trees, banners, or massive colliders may be placed in this box.
 */
export function isInsideFlightCorridor(x: number, z: number): boolean {
  const [minX, minZ, maxX, maxZ] = FLIGHT_CORRIDOR_BOX
  return x >= minX && x <= maxX && z >= minZ && z <= maxZ
}

/**
 * Returns the primary SanctuaryZoneId for a given [x, z] coordinate,
 * or 'ecologicalPerimeter' if outside functional campus zones.
 */
export function getZoneForPosition(x: number, z: number): SanctuaryZoneId {
  const radial = Math.hypot(x, z)
  if (radial > SANCTUARY_CLEARANCE_METRICS.woodlandInnerRadius) {
    return 'ecologicalPerimeter'
  }

  // Check Keep Arrival
  const [kMinX, kMinZ, kMaxX, kMaxZ] = SANCTUARY_ZONES.keepArrival.bounds
  if (x >= kMinX && x <= kMaxX && z >= kMinZ && z <= kMaxZ) return 'keepArrival'

  // Check Flight Commons (Central Spine)
  if (isInsideFlightCorridor(x, z)) return 'flightCommons'

  // Check Care Court
  const [cMinX, cMinZ, cMaxX, cMaxZ] = SANCTUARY_ZONES.careCourt.bounds
  if (x >= cMinX && x <= cMaxX && z >= cMinZ && z <= cMaxZ) return 'careCourt'

  // Check Craft & Fire Yard
  const [fMinX, fMinZ, fMaxX, fMaxZ] = SANCTUARY_ZONES.craftFireYard.bounds
  if (x >= fMinX && x <= fMaxX && z >= fMinZ && z <= fMaxZ) return 'craftFireYard'

  // Check Western Training Edge
  const [tMinX, tMinZ, tMaxX, tMaxZ] = SANCTUARY_ZONES.trainingEdge.bounds
  if (x >= tMinX && x <= tMaxX && z >= tMinZ && z <= tMaxZ) return 'trainingEdge'

  return 'ecologicalPerimeter'
}

/**
 * Validates that an interaction approach coordinate is free from station colliders
 * and within reachable interaction range.
 */
export function validateStationApproach(
  stationId: SanctuaryStationId,
  approachPoint: readonly [number, number],
): { valid: boolean; reason?: string } {
  const station = SANCTUARY_STATIONS[stationId]
  if (!station) return { valid: false, reason: `Unknown station id ${stationId}` }

  const dist = Math.hypot(approachPoint[0] - station.position[0], approachPoint[1] - station.position[1])
  if (dist > station.radius) {
    return { valid: false, reason: `Approach point is outside interaction radius (${dist.toFixed(2)} > ${station.radius})` }
  }
  if (dist < 0.5) {
    return { valid: false, reason: 'Approach point is too close to prop center (collider clipping risk)' }
  }

  return { valid: true }
}
