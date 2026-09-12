import type { PanelId } from '@/state/uiStore'
import type { Collider } from '@/render/controllers/CharacterController'
import {
  SANCTUARY_STATIONS,
  sanctuaryPosition,
  type SanctuaryStationId,
} from '@/core/data/sanctuaryStations'

export interface Interactable {
  id: string
  label: string
  panel: PanelId
  /** Station id to focus when the panel opens. */
  station?: string
  position: [number, number]
  radius: number
}

/**
 * Sanctuary layout.
 *
 * Two zones, as designed: the keep to the north is the player's base — walled,
 * with a southern doorway — and everything south of it is the open wyvern
 * grounds. Walls are modelled as colliders with a gap rather than a separate
 * interior scene, so walking in and out needs no loading seam.
 */
export const KEEP = {
  centerX: 0,
  centerZ: -26,
  halfW: 18,
  halfD: 12,
  wallThickness: 0.8,
  doorWidth: 6,
}

export const GROUND_RADIUS = 60

const STATION_ORDER: SanctuaryStationId[] = [
  'warTable',
  'roster',
  'barracks',
  'infirmary',
  'hatchery',
  'breeding',
  'huntingPen',
  'flightRing',
  'burnRange',
  'enduranceRun',
  'scaleForge',
]

export const INTERACTABLES: Interactable[] = STATION_ORDER.map((id) => {
  const definition = SANCTUARY_STATIONS[id]
  return {
    id,
    label: definition.label,
    panel: definition.panel,
    station: 'station' in definition ? definition.station : undefined,
    position: sanctuaryPosition(id),
    radius: definition.radius,
  }
})

/** Perch positions for idle wyverns on open grounds, placed away from rock formations. */
export const PERCHES: [number, number][] = [
  [8, 53],
  [48, -20],
  [-52, 2],
  [52, 2],
  [-24, 49],
  // Starter wy_1 hashes to this slot. The north-west clearing keeps its full
  // silhouette away from the Flight Ring, campus paths and station labels.
  [-38, -22],
  [42, 38],
  [-44, 38],
]

/** Assignment-aware resting posts, placed in open clearings outside station interaction rings and rock features. */
export const TRAINING_POSTS: Record<string, [number, number]> = {
  huntingPen: [-41, 5],
  flightRing: [-13, 34],
  burnRange: [20, 44],
  enduranceRun: [-52, 18],
  scaleForge: [53, -14],
}

export const BREEDING_POSTS: [[number, number], [number, number]] = [
  [25, 11],
  [43, 11],
]

export const INFIRMARY_POST: [number, number] = [-25, -22]

export const PATROL = {
  center: [0, 8] as [number, number],
  radiusX: 44,
  radiusZ: 38,
  altitude: 22,
  speed: 0.16,
}

/** Roost pads inside the hatchery, for incubating eggs. */
export const ROOSTS: [number, number][] = [
  [11, 0],
  [15, 0],
  [11, -6],
  [15, -6],
]

import type { GameState } from '@/core/types'

export function getInteractables(state?: GameState): Interactable[] {
  if (!state?.sanctuaryLayout?.objects) return INTERACTABLES

  const dynamic: Interactable[] = []
  for (const obj of state.sanctuaryLayout.objects) {
    if (obj.interactableId && obj.panel) {
      dynamic.push({
        id: obj.interactableId,
        label: obj.label,
        panel: obj.panel as PanelId,
        station: obj.station,
        position: [obj.position[0], obj.position[2]],
        radius: obj.radius ?? 3.5,
      })
    }
  }

  return dynamic.length > 0 ? dynamic : INTERACTABLES
}

/** Building footprints and keep walls, as blocking boxes. */
export function buildColliders(state?: GameState): Collider[] {
  const { centerX, centerZ, halfW, halfD, wallThickness, doorWidth } = KEEP
  const wallSegment = (halfW - doorWidth / 2) / 2

  const colliders: Collider[] = [
    // North wall (solid)
    { x: centerX, z: centerZ - halfD, halfW, halfD: wallThickness },
    // East and west walls
    { x: centerX + halfW, z: centerZ, halfW: wallThickness, halfD },
    { x: centerX - halfW, z: centerZ, halfW: wallThickness, halfD },
    // South wall, split around a doorway the player walks through
    {
      x: centerX - doorWidth / 2 - wallSegment,
      z: centerZ + halfD,
      halfW: wallSegment,
      halfD: wallThickness,
    },
    {
      x: centerX + doorWidth / 2 + wallSegment,
      z: centerZ + halfD,
      halfW: wallSegment,
      halfD: wallThickness,
    },
  ]

  if (state?.sanctuaryLayout?.objects) {
    for (const obj of state.sanctuaryLayout.objects) {
      if (obj.category === 'structure' || obj.propId === 'prop.blockade') {
        const halfW = (obj.radius ?? 3) * 0.6
        colliders.push({
          x: obj.position[0],
          z: obj.position[2],
          halfW,
          halfD: halfW,
        })
      }
    }
  } else {
    // Default static fallback colliders
    colliders.push(
      { x: SANCTUARY_STATIONS.warTable.position[0], z: SANCTUARY_STATIONS.warTable.position[1], halfW: 2.2, halfD: 1.4 },
      { x: SANCTUARY_STATIONS.roster.position[0], z: SANCTUARY_STATIONS.roster.position[1], halfW: 1.2, halfD: 1.2 },
      { x: SANCTUARY_STATIONS.barracks.position[0], z: SANCTUARY_STATIONS.barracks.position[1], halfW: 1.6, halfD: 1.2 },
      { x: SANCTUARY_STATIONS.hatchery.position[0], z: SANCTUARY_STATIONS.hatchery.position[1], halfW: 4.5, halfD: 4.5 },
      { x: SANCTUARY_STATIONS.scaleForge.position[0], z: SANCTUARY_STATIONS.scaleForge.position[1], halfW: 2.2, halfD: 2.2 },
    )
  }

  return colliders
}
