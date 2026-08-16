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

const bounds = { boundsRadius: 60 }

function airborneBody(overrides: Partial<DirectWyvernFlightBody> = {}): DirectWyvernFlightBody {
  return {
    position: { x: 0, y: 25, z: 0 },
    yaw: 0,
    airborne: true,
    airspeed: 18,
    climbRate: 0,
    pathAngle: 0,
    bank: 0,
    flightMode: 'cruise',
    ...overrides,
  }
}

/** Runs `frames` steps of the same input, as a pilot holding a key would. */
function hold(
  body: DirectWyvernFlightBody,
  input: Partial<DirectWyvernFlightInput>,
  frames: number,
  dt = 1 / 60,
) {
  let step = stepDirectWyvernFlight(body, { ...neutralInput, ...input }, 0, dt, bounds)
  for (let i = 1; i < frames; i += 1) {
    step = stepDirectWyvernFlight(body, { ...neutralInput, ...input }, 0, dt, bounds)
  }
  return step
}

describe('direct wyvern flight controller', () => {
  it('walks camera-relative on the ground and enters flight from Space', () => {
    const body: DirectWyvernFlightBody = { position: { x: 0, y: 0, z: 0 }, yaw: 0, airborne: false }
    const walking = stepDirectWyvernFlight(body, { ...neutralInput, moveZ: 1 }, 0, 1, bounds)
    expect(walking.locomotion).toBe('walk')
    expect(body.position.z).toBeCloseTo(9)

    const climbing = stepDirectWyvernFlight(body, { ...neutralInput, climbing: true }, 0, 0.1, bounds)
    expect(climbing).toMatchObject({ locomotion: 'cruise', airborne: true, climbing: true })
    expect(climbing.airspeed).toBeGreaterThan(0)
  })

  it('keeps piloted flight within the scene boundary and lands on descent', () => {
    const body = airborneBody({ position: { x: 58, y: 2, z: 0 }, yaw: Math.PI / 2 })
    hold(body, { moveZ: 1 }, 60, 1 / 60)
    expect(Math.hypot(body.position.x, body.position.z)).toBeLessThanOrEqual(60)

    const landing = stepDirectWyvernFlight(body, { ...neutralInput, descending: true }, 0, 1, bounds)
    expect(landing).toMatchObject({ airborne: false, landed: true, locomotion: 'idle' })
    expect(body.position.y).toBe(0)
  })

  it('turns by banking, and the bank builds up rather than snapping', () => {
    const body = airborneBody()
    const first = stepDirectWyvernFlight(body, { ...neutralInput, moveX: 1 }, 0, 1 / 60, bounds)
    expect(Math.abs(first.bank)).toBeLessThan(0.85)

    const settled = hold(body, { moveX: 1 }, 60)
    expect(settled.bank).toBeCloseTo(-0.85, 2)
    // Right input rolls right and yaws right, as the pre-existing sign did.
    expect(body.yaw).toBeLessThan(0)
    expect(settled.flightMode).toBe('bankRight')
  })

  it('trades height for speed in a dive and reaches the dive loop', () => {
    const body = airborneBody({ position: { x: 0, y: 45, z: 0 } })
    const step = hold(body, { descending: true }, 120)
    expect(step.airspeed).toBeGreaterThan(18)
    expect(step.climbRate).toBeLessThan(0)
    expect(step.pitch).toBeGreaterThan(0)
    expect(step.flightMode).toBe('dive')
  })

  it('bleeds speed in a climb', () => {
    const body = airborneBody({ position: { x: 0, y: 10, z: 0 } })
    const step = hold(body, { moveZ: 0, climbing: true }, 120)
    expect(step.climbRate).toBeGreaterThan(0)
    expect(step.airspeed).toBeLessThan(18)
  })

  it('reports an unpowered glide when thrust is released while descending', () => {
    const body = airborneBody({ position: { x: 0, y: 40, z: 0 } })
    const step = stepDirectWyvernFlight(body, { ...neutralInput, descending: true }, 0, 1 / 60, bounds)
    expect(step.powered).toBe(false)
    expect(step.flightMode).toBe('glide')
  })

  it('holds position on reverse input and selects the hover loop', () => {
    const body = airborneBody({ position: { x: 0, y: 20, z: 0 } })
    const before = body.position.z
    const step = hold(body, { moveZ: -1 }, 60)
    expect(Math.abs(body.position.z - before)).toBeLessThan(1.5)
    expect(step.flightMode).toBe('hover')
  })

  it('reaches the speed loop under sprinting thrust', () => {
    const body = airborneBody({ position: { x: 0, y: 20, z: 0 } })
    const step = hold(body, { moveZ: 1, running: true }, 120)
    expect(step.airspeed).toBeGreaterThan(18)
    expect(step.flightMode).toBe('speed')
  })

  it('flares nose-up on the approach instead of driving into the ground', () => {
    const body = airborneBody({ position: { x: 0, y: 2.6, z: 0 }, pathAngle: -0.4 })
    const step = stepDirectWyvernFlight(body, { ...neutralInput, moveZ: 1 }, 0, 1 / 60, bounds)
    expect(step.pitch).toBeLessThan(0)
  })
})
