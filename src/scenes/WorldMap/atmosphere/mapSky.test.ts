import { describe, expect, it } from 'vitest'
import { mapSkyStateFor } from './mapSky'

describe('mapSky', () => {
  it('remaps fog distances to map scale', () => {
    const sky = mapSkyStateFor(100)
    expect(sky.fogNear).toBe(140)
    expect(sky.fogFar).toBe(480)
  })

  it('calculates nightBoost properly', () => {
    const nightSky = mapSkyStateFor(0) // Tick 0 with default start phase
    expect(nightSky.nightBoost).toBeGreaterThanOrEqual(0)
    expect(nightSky.nightBoost).toBeLessThanOrEqual(1.0)
  })
})
