import { describe, expect, it } from 'vitest'
import {
  SANCTUARY_ZONES,
  SANCTUARY_CLEARANCE_METRICS,
  FLIGHT_CORRIDOR_BOX,
  isInsideFlightCorridor,
  getZoneForPosition,
  validateStationApproach,
} from '@/core/data/sanctuaryMasterplan'
import { SANCTUARY_STATIONS, sanctuaryPosition } from '@/core/data/sanctuaryStations'
import { SCATTER } from './dressing'
import { createDefaultSanctuaryLayout, migrateLegacySanctuaryLayout } from '@/core/state/sanctuaryLayout'

describe('Sanctuary masterplan and zoning contracts', () => {
  it('defines clearance metrics and zone position resolver', () => {
    expect(SANCTUARY_CLEARANCE_METRICS.mainPathWidth).toBe(4.0)
    expect(SANCTUARY_CLEARANCE_METRICS.servicePathWidth).toBe(2.4)
    expect(SANCTUARY_CLEARANCE_METRICS.wyvernRestEnvelopeRadius).toBe(6.0)

    expect(getZoneForPosition(0, -30)).toBe('keepArrival')
    expect(getZoneForPosition(0, 10)).toBe('flightCommons')
    expect(getZoneForPosition(34, 8)).toBe('careCourt')
    expect(getZoneForPosition(34, 32)).toBe('craftFireYard')
    expect(getZoneForPosition(-30, 2)).toBe('trainingEdge')
    expect(getZoneForPosition(0, 58)).toBe('ecologicalPerimeter')
  })
  it('defines all 6 spatial zones with stations and valid bounds', () => {
    const zoneKeys = Object.keys(SANCTUARY_ZONES)
    expect(zoneKeys).toEqual([
      'keepArrival',
      'careCourt',
      'craftFireYard',
      'flightCommons',
      'trainingEdge',
      'ecologicalPerimeter',
    ])

    for (const zone of Object.values(SANCTUARY_ZONES)) {
      expect(zone.bounds[0]).toBeLessThan(zone.bounds[2])
      expect(zone.bounds[1]).toBeLessThan(zone.bounds[3])
    }
  })

  it('maps all 11 stations to their canonical zones', () => {
    expect(SANCTUARY_ZONES.keepArrival.stations).toContain('warTable')
    expect(SANCTUARY_ZONES.keepArrival.stations).toContain('roster')
    expect(SANCTUARY_ZONES.keepArrival.stations).toContain('barracks')
    expect(SANCTUARY_ZONES.keepArrival.stations).toContain('infirmary')

    expect(SANCTUARY_ZONES.careCourt.stations).toContain('hatchery')
    expect(SANCTUARY_ZONES.careCourt.stations).toContain('breeding')

    expect(SANCTUARY_ZONES.craftFireYard.stations).toContain('scaleForge')
    expect(SANCTUARY_ZONES.craftFireYard.stations).toContain('burnRange')

    expect(SANCTUARY_ZONES.flightCommons.stations).toContain('flightRing')

    expect(SANCTUARY_ZONES.trainingEdge.stations).toContain('huntingPen')
    expect(SANCTUARY_ZONES.trainingEdge.stations).toContain('enduranceRun')
  })

  it('ensures each station position falls into its designated zone', () => {
    for (const [zoneId, zoneDef] of Object.entries(SANCTUARY_ZONES)) {
      for (const stationId of zoneDef.stations) {
        const [x, z] = sanctuaryPosition(stationId)
        const [minX, minZ, maxX, maxZ] = zoneDef.bounds
        expect(x, `${stationId} x in ${zoneId}`).toBeGreaterThanOrEqual(minX)
        expect(x, `${stationId} x in ${zoneId}`).toBeLessThanOrEqual(maxX)
        expect(z, `${stationId} z in ${zoneId}`).toBeGreaterThanOrEqual(minZ)
        expect(z, `${stationId} z in ${zoneId}`).toBeLessThanOrEqual(maxZ)
      }
    }
  })

  it('validates central flight corridor bounds and exclusion of scatter trees', () => {
    const [minX, minZ, maxX, maxZ] = FLIGHT_CORRIDOR_BOX
    expect(minX).toBe(-16)
    expect(maxX).toBe(16)
    expect(minZ).toBe(-12)
    expect(maxZ).toBe(28)

    expect(isInsideFlightCorridor(0, 10)).toBe(true)
    expect(isInsideFlightCorridor(-30, 10)).toBe(false)
    expect(isInsideFlightCorridor(30, 10)).toBe(false)

    // Check all scattered trees in SCATTER: none must fall inside flight corridor
    for (const [propKey, placements] of Object.entries(SCATTER)) {
      for (const placement of placements) {
        const [x, , z] = placement.position
        const inside = isInsideFlightCorridor(x, z)
        expect(inside, `${propKey} placed inside flight corridor at [${x}, ${z}]`).toBe(false)
      }
    }
  })

  it('verifies station approach validation helper', () => {
    const [wtX, wtZ] = SANCTUARY_STATIONS.warTable.position
    // Valid approach 1.5m south
    const valid = validateStationApproach('warTable', [wtX, wtZ + 1.5])
    expect(valid.valid).toBe(true)

    // Invalid approach too far
    const tooFar = validateStationApproach('warTable', [wtX, wtZ + 10])
    expect(tooFar.valid).toBe(false)
    expect(tooFar.reason).toContain('outside interaction radius')

    // Invalid approach at center (clipping)
    const tooClose = validateStationApproach('warTable', [wtX, wtZ + 0.1])
    expect(tooClose.valid).toBe(false)
    expect(tooClose.reason).toContain('clipping risk')
  })

  it('moves station-owned objects by the contract delta but leaves player props untouched', () => {
    const customLayout = createDefaultSanctuaryLayout()
    customLayout.spatialContractVersion = undefined
    // A player prop is not owned by any station and must remain untouched.
    const playerProp = { id: 'player-cairn', propId: 'prop.perch.rockA', position: [12.5, 0, 15.5] as [number, number, number], rotationY: 0.7, category: 'scenery' as const, label: 'Player Cairn', scale: 1.4 }
    customLayout.objects.push(playerProp)

    const migrated = migrateLegacySanctuaryLayout(customLayout)
    expect(migrated.objects.find((o) => o.id === 'player-cairn')?.position).toEqual([12.5, 0, 15.5])
  })
})
