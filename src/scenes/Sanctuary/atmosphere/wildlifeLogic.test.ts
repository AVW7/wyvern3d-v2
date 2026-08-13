import { describe, expect, it } from 'vitest'
import { exclusions } from '../dressing'
import { GROUND_RADIUS } from '../layout'
import { STARTLE_RADIUS, alarmLevel, fleeHeading, placeDeer } from './wildlifeLogic'

describe('sanctuary wildlife placement', () => {
  it('is deterministic for a seed, so the herd is where the player left it', () => {
    expect(placeDeer(9182, 5)).toEqual(placeDeer(9182, 5))
    expect(placeDeer(9182, 5)).not.toEqual(placeDeer(5, 5))
  })

  it('keeps every deer inside the walkable ground', () => {
    for (const deer of placeDeer(2024, 6)) {
      expect(Math.hypot(deer.home[0], deer.home[1])).toBeLessThan(GROUND_RADIUS)
    }
  })

  it('never spawns a deer inside a station, perch or the keep', () => {
    const zones = exclusions()
    for (const deer of placeDeer(777, 6)) {
      for (const zone of zones) {
        expect(Math.hypot(deer.home[0] - zone.x, deer.home[1] - zone.z)).toBeGreaterThanOrEqual(
          zone.r,
        )
      }
    }
  })

  it('spaces the herd out rather than huddling it', () => {
    const herd = placeDeer(31337, 5)
    for (let i = 0; i < herd.length; i++) {
      for (let j = i + 1; j < herd.length; j++) {
        const a = herd[i]!
        const b = herd[j]!
        expect(Math.hypot(a.home[0] - b.home[0], a.home[1] - b.home[1])).toBeGreaterThanOrEqual(9)
      }
    }
  })
})

describe('sanctuary wildlife alarm', () => {
  const deer = { id: 'd', home: [0, 0] as [number, number], phase: 0, facing: 0 }

  it('is calm with nothing around', () => {
    expect(alarmLevel(deer, [])).toBe(0)
    expect(fleeHeading(deer, [])).toBeNull()
  })

  it('ignores anything airborne', () => {
    // A wyvern cruising overhead at altitude must not leave the herd
    // permanently spooked.
    const overhead = [{ x: 0, z: 0, airborne: true }]
    expect(alarmLevel(deer, overhead)).toBe(0)
    expect(fleeHeading(deer, overhead)).toBeNull()
  })

  it('rises as a grounded wyvern closes in', () => {
    const near = alarmLevel(deer, [{ x: 2, z: 0, airborne: false }])
    const far = alarmLevel(deer, [{ x: STARTLE_RADIUS - 1, z: 0, airborne: false }])
    expect(near).toBeGreaterThan(far)
    expect(near).toBeLessThanOrEqual(1)
    expect(alarmLevel(deer, [{ x: STARTLE_RADIUS + 1, z: 0, airborne: false }])).toBe(0)
  })

  it('runs directly away from the nearest threat', () => {
    // Threat to the east, so the deer heads west.
    const heading = fleeHeading(deer, [{ x: 5, z: 0, airborne: false }])
    expect(heading).not.toBeNull()
    expect(Math.sin(heading!)).toBeCloseTo(-1)
  })

  it('flees the closest of several threats', () => {
    const heading = fleeHeading(deer, [
      { x: 15, z: 0, airborne: false },
      { x: 0, z: 3, airborne: false },
    ])
    // Nearest is to the north, so the deer runs south.
    expect(Math.cos(heading!)).toBeCloseTo(-1)
  })
})
