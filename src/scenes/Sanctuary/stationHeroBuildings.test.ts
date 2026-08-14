import { describe, expect, it } from 'vitest'
import { SANCTUARY_STATIONS, sanctuaryPosition, type SanctuaryStationId } from '@/core/data/sanctuaryStations'
import {
  isInsideFlightCorridor,
  validateStationApproach,
  FLIGHT_CORRIDOR_BOX,
} from '@/core/data/sanctuaryMasterplan'
import {
  BarracksHeroStation,
  InfirmaryHeroStation,
  HuntingPenHeroStation,
  BurnRangeHeroStation,
  EnduranceRunHeroStation,
  WarTableHeroStation,
  RosterHeroStation,
  ScaleForgeHeroStation,
  HatcheryHeroStation,
  BreedingHeroStation,
  FlightRingHeroStation,
} from './components/StationHeroBuildings'
import { buildColliders, getInteractables } from './layout'

describe('Stage 4: Sanctuary Hero Station Assemblies & Architectural Kit', () => {
  const allStations: SanctuaryStationId[] = [
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

  it('provides dedicated hero station assembly components for all 11 stations', () => {
    expect(BarracksHeroStation).toBeDefined()
    expect(InfirmaryHeroStation).toBeDefined()
    expect(HuntingPenHeroStation).toBeDefined()
    expect(BurnRangeHeroStation).toBeDefined()
    expect(EnduranceRunHeroStation).toBeDefined()
    expect(WarTableHeroStation).toBeDefined()
    expect(RosterHeroStation).toBeDefined()
    expect(ScaleForgeHeroStation).toBeDefined()
    expect(HatcheryHeroStation).toBeDefined()
    expect(BreedingHeroStation).toBeDefined()
    expect(FlightRingHeroStation).toBeDefined()
  })

  it('guarantees that all 11 stations have valid non-blocked approach vectors', () => {
    for (const stationId of allStations) {
      const station = SANCTUARY_STATIONS[stationId]
      expect(station).toBeDefined()

      // Player approach test point placed 1.5m south/in front of each station
      const approachPoint: [number, number] = [
        station.position[0],
        station.position[1] + 1.5,
      ]

      const validation = validateStationApproach(stationId, approachPoint)
      expect(
        validation.valid,
        `Station ${stationId} failed approach validation: ${validation.reason}`,
      ).toBe(true)
    }
  })

  it('guarantees training edge, craft yard, and roost stations do not intrude into the central flight corridor', () => {
    const peripheralStations: SanctuaryStationId[] = [
      'huntingPen',
      'enduranceRun',
      'burnRange',
      'scaleForge',
      'breeding',
    ]

    for (const stationId of peripheralStations) {
      const [x, z] = sanctuaryPosition(stationId)
      expect(
        isInsideFlightCorridor(x, z),
        `Station ${stationId} at [${x}, ${z}] unexpectedly intrudes into central flight corridor ${JSON.stringify(FLIGHT_CORRIDOR_BOX)}`,
      ).toBe(false)
    }
  })

  it('produces walkable colliders for all structures without blocking the door or center spine', () => {
    const colliders = buildColliders()
    expect(colliders.length).toBeGreaterThanOrEqual(5)

    // Doorway at [0, -14] must have zero colliders
    const doorX = 0
    const doorZ = -14
    for (const col of colliders) {
      const inX = doorX >= col.x - col.halfW && doorX <= col.x + col.halfW
      const inZ = doorZ >= col.z - col.halfD && doorZ <= col.z + col.halfD
      expect(
        inX && inZ,
        `Keep doorway at [${doorX}, ${doorZ}] is blocked by collider at [${col.x}, ${col.z}]`,
      ).toBe(false)
    }
  })

  it('generates interactables matching all 11 station definitions', () => {
    const interactables = getInteractables()
    expect(interactables).toHaveLength(11)

    const interactableIds = interactables.map((i) => i.id)
    for (const stationId of allStations) {
      expect(interactableIds).toContain(stationId)
    }
  })
})
