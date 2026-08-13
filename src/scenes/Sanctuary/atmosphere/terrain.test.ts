import { describe, expect, it } from 'vitest'
import { SANCTUARY_STATIONS } from '@/core/data/sanctuaryStations'
import { GROUND_RADIUS } from '../layout'
import {
  OUTER_INNER_RADIUS,
  groundColorAt,
  outerHeightAt,
  wearAt,
} from './terrain'

const GRASS = '#6f7d55'

describe('sanctuary ground relief', () => {
  it('leaves the entire walkable disc flat', () => {
    // This is the load-bearing invariant of the whole stage. Three ground-plane
    // raycasts, the player's height, wyvern landing and every prop placement
    // assume y=0 inside GROUND_RADIUS; relief anywhere in here breaks movement.
    for (let radius = 0; radius <= GROUND_RADIUS; radius += 2) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        const x = Math.cos(a) * radius
        const z = Math.sin(a) * radius
        expect(outerHeightAt(x, z)).toBe(0)
      }
    }
  })

  it('starts from exactly zero at the inner rim, so there is no seam', () => {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
      expect(outerHeightAt(Math.cos(a) * OUTER_INNER_RADIUS, Math.sin(a) * OUTER_INNER_RADIUS)).toBe(0)
    }
  })

  it('rises toward the horizon', () => {
    const near = outerHeightAt(OUTER_INNER_RADIUS + 12, 0)
    const far = outerHeightAt(120, 0)
    expect(near).toBeGreaterThan(0)
    expect(far).toBeGreaterThan(near)
  })

  it('climbs smoothly rather than stepping', () => {
    let previous = outerHeightAt(OUTER_INNER_RADIUS, 0)
    for (let radius = OUTER_INNER_RADIUS; radius < 132; radius += 1) {
      const height = outerHeightAt(radius, 0)
      expect(Math.abs(height - previous)).toBeLessThan(1.5)
      previous = height
    }
  })
})

describe('sanctuary ground wear', () => {
  it('is bare where the player stands at a station', () => {
    const warTable = SANCTUARY_STATIONS.warTable.position
    expect(wearAt(warTable[0], warTable[1])).toBeGreaterThan(0.5)
  })

  it('is untouched grass out in the open', () => {
    // A point well away from paths, stations and the keep.
    expect(wearAt(-52, 46)).toBe(0)
  })

  it('stays within range everywhere', () => {
    for (let x = -GROUND_RADIUS; x <= GROUND_RADIUS; x += 7) {
      for (let z = -GROUND_RADIUS; z <= GROUND_RADIUS; z += 7) {
        const wear = wearAt(x, z)
        expect(wear).toBeGreaterThanOrEqual(0)
        expect(wear).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('sanctuary ground colour', () => {
  it('is deterministic', () => {
    expect(groundColorAt(12, -8, GRASS)).toEqual(groundColorAt(12, -8, GRASS))
  })

  it('still follows the player\'s chosen grass colour', () => {
    // The editor's colour picker must keep working; variation layers on top of
    // the choice rather than replacing it.
    const green = groundColorAt(-30, 40, '#4a7d2a')
    const red = groundColorAt(-30, 40, '#7d2a2a')
    expect(red[0]).toBeGreaterThan(green[0]!)
    expect(green[1]).toBeGreaterThan(red[1]!)
  })

  it('produces channels inside the renderable range', () => {
    for (let x = -GROUND_RADIUS; x <= GROUND_RADIUS; x += 11) {
      for (let z = -GROUND_RADIUS; z <= GROUND_RADIUS; z += 11) {
        for (const channel of groundColorAt(x, z, GRASS)) {
          expect(channel).toBeGreaterThanOrEqual(0)
          expect(channel).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('darkens toward earth where the ground is worn', () => {
    const warTable = SANCTUARY_STATIONS.warTable.position
    const worn = groundColorAt(warTable[0], warTable[1], GRASS)
    const open = groundColorAt(-52, 46, GRASS)
    // Dirt is warmer than grass: more red relative to green.
    expect(worn[0] / worn[1]).toBeGreaterThan(open[0] / open[1])
  })
})
