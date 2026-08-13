import { describe, expect, it } from 'vitest'
import { clampPitch, clampDistance, calculateOrbitPosition } from './mapCameraRig'

describe('mapCameraRig', () => {
  it('clamps pitch within 0.35 and 1.25', () => {
    expect(clampPitch(0.1)).toBe(0.35)
    expect(clampPitch(1.5)).toBe(1.25)
    expect(clampPitch(0.85)).toBe(0.85)
  })

  it('clamps distance within 80 and 300', () => {
    expect(clampDistance(20)).toBe(80)
    expect(clampDistance(500)).toBe(300)
    expect(clampDistance(220)).toBe(220)
  })

  it('calculates orbit position correctly', () => {
    const target = { x: 0, y: 10, z: 0 }
    const pos = calculateOrbitPosition(target, 0, 0, 100)
    expect(pos.x).toBeCloseTo(0)
    expect(pos.y).toBeCloseTo(10)
    expect(pos.z).toBeCloseTo(100)
  })
})
