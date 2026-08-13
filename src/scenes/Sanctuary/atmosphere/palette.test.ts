import { describe, expect, it } from 'vitest'
import {
  DAY_START_PHASE,
  SANCTUARY_DAY_TICKS,
  dayBucket,
  dayPhase,
  skyStateFor,
  sunDirection,
  sunElevation,
} from './palette'

/**
 * The tick at which the cycle reaches a given phase. Tick 0 is deliberately
 * mid-morning rather than midnight, so tests must not assume the two coincide.
 */
function tickForPhase(phase: number): number {
  return ((phase - DAY_START_PHASE + 1) % 1) * SANCTUARY_DAY_TICKS
}

describe('sanctuary time of day', () => {
  it('wraps phase over the day length and stays in [0,1)', () => {
    expect(dayPhase(0)).toBeCloseTo(DAY_START_PHASE)
    expect(dayPhase(SANCTUARY_DAY_TICKS / 2)).toBeCloseTo((DAY_START_PHASE + 0.5) % 1)
    expect(dayPhase(SANCTUARY_DAY_TICKS)).toBeCloseTo(DAY_START_PHASE)
    for (const tick of [0, 1, 359, 719, 720, 5000]) {
      const phase = dayPhase(tick)
      expect(phase).toBeGreaterThanOrEqual(0)
      expect(phase).toBeLessThan(1)
    }
  })

  it('starts a new game in daylight, not at midnight', () => {
    // Tick 0 is what a player sees on their very first load.
    expect(dayBucket(dayPhase(0))).toBe('day')
    expect(sunElevation(dayPhase(0))).toBeGreaterThan(0.3)
    expect(skyStateFor(0).sunIntensity).toBeGreaterThan(1.3)
  })

  it('puts the sun below the horizon at midnight and overhead at noon', () => {
    expect(sunElevation(0)).toBeCloseTo(-1)
    expect(sunElevation(0.25)).toBeCloseTo(0)
    expect(sunElevation(0.5)).toBeCloseTo(1)
    expect(sunElevation(0.75)).toBeCloseTo(0)
  })

  it('never aims the key light from directly overhead', () => {
    // A light straight down flattens every silhouette in the scene.
    const [x, , z] = sunDirection(0.5)
    expect(Math.hypot(x, z)).toBeGreaterThan(0.2)
  })

  it('buckets the cycle into night, dawn, day and dusk', () => {
    expect(dayBucket(0)).toBe('night')
    expect(dayBucket(0.26)).toBe('dawn')
    expect(dayBucket(0.5)).toBe('day')
    expect(dayBucket(0.78)).toBe('dusk')
    expect(dayBucket(0.95)).toBe('night')
  })

  it('is continuous across every keyframe boundary', () => {
    // A discontinuity here is a visible pop in the sky, so step the whole cycle
    // and assert no single tick moves the fog colour more than a small amount.
    let previous = skyStateFor(0)
    for (let tick = 1; tick <= SANCTUARY_DAY_TICKS; tick++) {
      const current = skyStateFor(tick)
      for (let channel = 0; channel < 3; channel++) {
        expect(Math.abs(current.fog[channel]! - previous.fog[channel]!)).toBeLessThan(0.05)
      }
      expect(Math.abs(current.sunIntensity - previous.sunIntensity)).toBeLessThan(0.05)
      previous = current
    }
  })

  it('keeps fog inside the play area so the treeline actually recedes', () => {
    // The shipped rig used 140-350 against a 60-unit ground radius, which put
    // the fog's near plane past the far rim: nothing was ever fogged.
    for (const tick of [0, 180, 360, 540]) {
      const { fogNear, fogFar } = skyStateFor(tick)
      expect(fogNear).toBeLessThan(60)
      expect(fogFar).toBeGreaterThan(fogNear)
    }
  })

  it('keeps the key light warmer than the fill while the sun is up', () => {
    // Warm key against cool fill is the whole point of the daylight rig. It
    // deliberately does not hold at night, when the key light is the moon and
    // is supposed to be the coolest thing in the scene.
    for (let tick = 0; tick < SANCTUARY_DAY_TICKS; tick += 15) {
      if (sunElevation(dayPhase(tick)) <= 0.1) continue
      const { sun, skyFill } = skyStateFor(tick)
      const sunWarmth = sun[0]! - sun[2]!
      const fillWarmth = skyFill[0]! - skyFill[2]!
      expect(sunWarmth).toBeGreaterThan(fillWarmth)
    }
  })

  it('lights the night cool and dim', () => {
    const midnight = skyStateFor(tickForPhase(0))
    expect(midnight.sun[2]).toBeGreaterThan(midnight.sun[0]!)
    expect(midnight.sunIntensity).toBeLessThan(0.4)
    const noon = skyStateFor(tickForPhase(0.5))
    expect(noon.sunIntensity).toBeGreaterThan(midnight.sunIntensity * 4)
  })
})
