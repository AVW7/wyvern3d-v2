import { describe, expect, it } from 'vitest'
import { stepDirectWyvernFlight, type DirectWyvernFlightBody, type DirectWyvernFlightInput } from './wyvernFlight'

const neutralInput: DirectWyvernFlightInput = {
  moveX: 0,
  moveZ: 0,
  climbing: false,
  descending: false,
  attacking: false,
  breathing: false,
  running: false,
}

describe('direct wyvern flight controller', () => {
  it('walks camera-relative on the ground and enters flight from Space', () => {
    const body: DirectWyvernFlightBody = { position: { x: 0, y: 0, z: 0 }, yaw: 0, airborne: false }
    const walking = stepDirectWyvernFlight(body, { ...neutralInput, moveZ: 1 }, 0, 1, { boundsRadius: 60 })
    expect(walking.locomotion).toBe('walk')
    expect(body.position.z).toBeCloseTo(9)

    const climbing = stepDirectWyvernFlight(body, { ...neutralInput, climbing: true }, 0, 0.1, { boundsRadius: 60 })
    expect(climbing).toMatchObject({ locomotion: 'cruise', airborne: true, climbing: true })
  })

  it('keeps piloted flight within the scene boundary and lands on descent', () => {
    const body: DirectWyvernFlightBody = { position: { x: 58, y: 2, z: 0 }, yaw: Math.PI / 2, airborne: true }
    stepDirectWyvernFlight(body, { ...neutralInput, moveZ: 1 }, 0, 1, { boundsRadius: 60 })
    expect(Math.hypot(body.position.x, body.position.z)).toBeLessThanOrEqual(60)

    const landing = stepDirectWyvernFlight(body, { ...neutralInput, descending: true }, 0, 1, { boundsRadius: 60 })
    expect(landing).toMatchObject({ airborne: false, landed: true, locomotion: 'idle' })
    expect(body.position.y).toBe(0)
  })
})
