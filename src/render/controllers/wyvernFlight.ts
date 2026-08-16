'use client'

import { axis, CONTROLS, isDown, keys } from './input'
import { flightAnimationState, type FlightLoopState } from '../flightPose'

export interface DirectWyvernFlightBody {
  position: { x: number; y: number; z: number }
  yaw: number
  airborne: boolean
  /** Airspeed carried between frames. Absent on a fresh body; treated as 0. */
  airspeed?: number
  /** Vertical rate carried between frames, metres per second. */
  climbRate?: number
  /** Commanded flight-path angle, radians, positive nose-up. */
  pathAngle?: number
  /** Smoothed roll, radians. Positive rolls left, matching the yaw sign. */
  bank?: number
  /** The loop the selector last chose, so its hysteresis bands have a state. */
  flightMode?: FlightLoopState
}

export interface DirectWyvernFlightInput {
  moveX: number
  moveZ: number
  climbing: boolean
  descending: boolean
  attacking: boolean
  breathing: boolean
  running: boolean
}

export interface DirectWyvernFlightStep {
  locomotion: 'idle' | 'walk' | 'cruise'
  airborne: boolean
  climbing: boolean
  landed: boolean
  /** The v1-measured flight loop for this frame; `null` while on the ground. */
  flightMode: FlightLoopState | null
  /** Nose-down attitude in radians, for the caller's model rotation. */
  pitch: number
  /** Roll in radians, positive to the left. */
  bank: number
  /** False when the wyvern has stopped beating and is trading height for speed. */
  powered: boolean
  airspeed: number
  climbRate: number
}

export interface DirectWyvernFlightOptions {
  boundsRadius: number
}

/**
 * The piloted envelope, in the same units the animation side already measures
 * against: `FLIGHT_REF_SPEED` is 20, `flightAnimationState` reads `speed` above
 * 0.72 of it and `hover` below 2.4, and `dive` needs both a steep path angle
 * and real speed through the air. Every number here exists so a pilot can
 * actually reach those bands rather than sit permanently in cruise.
 */
const HOVER_SPEED = 2
const CRUISE_SPEED = 18
const SPRINT_SPEED = 28
/** Terminal speed a sustained dive converges on. */
const DIVE_SPEED = 40
const THRUST_ACCEL = 14
const DRAG_DECEL = 6
/**
 * Vertical intent is a commanded flight-path angle, not a climb rate, because
 * that is the quantity `flightAnimationState` actually reads: `dive` needs a
 * path angle past 0.4 rad *and* real speed through the air, which a fixed
 * metres-per-second climb rate can never produce once the wyvern is fast.
 */
const CLIMB_ANGLE = 0.35
const DESCEND_ANGLE = 0.55
const DIVE_ANGLE = 0.8
const GLIDE_ANGLE = 0.18
const ANGLE_RESPONSE = 1.6
/** Height traded for speed and back, the one thing a glide has to feel like. */
const GRAVITY_EXCHANGE = 22
const CLIMB_RATE = 12
const MAX_BANK = 0.85
const BANK_RESPONSE = 3.6
const MAX_YAW_RATE = 2.2
/** Coordinated turn: yaw rate falls out of bank and speed, not of a key press. */
const TURN_GRAVITY = 26
const MAX_PITCH = 0.75
const FLARE_HEIGHT = 3

/** Reads global input once; movement integration remains testable below. */
export function readDirectWyvernFlightInput(): DirectWyvernFlightInput {
  const climbing = isDown('Space')
  const descending = isDown(...CONTROLS.descend) || isDown('KeyF')
  return {
    moveX: axis([...CONTROLS.right], [...CONTROLS.left]),
    moveZ: axis([...CONTROLS.forward], [...CONTROLS.back]),
    climbing,
    descending,
    // R is the direct strike control. Space owns ascent in the test map, so
    // this edge is no longer suppressed by the old R-as-climb overlap.
    attacking: isDown('KeyR'),
    breathing: isDown('KeyF') || (isDown('Space') && keys.has('KeyF')),
    running: isDown(...CONTROLS.run),
  }
}

/**
 * Shared direct-flight movement for Sanctuary, Highlands and the biomes.
 *
 * Ground movement is unchanged. Airborne movement is a small energy model
 * rather than a position offset: airspeed has inertia, a turn is a bank the
 * yaw rate follows from, and height and speed trade against each other, so
 * releasing thrust and pushing the nose down produces a real dive and pulling
 * up bleeds it back. That is what makes the v1-derived loops — dive, glide,
 * hover, the banks, speed — reachable while piloting; the same selector the
 * director uses picks between them here.
 *
 * It mutates only the supplied presentation body. No simulation or React state
 * enters this helper.
 */
export function stepDirectWyvernFlight(
  body: DirectWyvernFlightBody,
  input: DirectWyvernFlightInput,
  cameraYaw: number,
  dt: number,
  { boundsRadius }: DirectWyvernFlightOptions,
): DirectWyvernFlightStep {
  if (!body.airborne) return stepGround(body, input, cameraYaw, dt, boundsRadius)
  return stepAir(body, input, dt, boundsRadius)
}

function stepGround(
  body: DirectWyvernFlightBody,
  input: DirectWyvernFlightInput,
  cameraYaw: number,
  dt: number,
  boundsRadius: number,
): DirectWyvernFlightStep {
  const moving = input.moveX !== 0 || input.moveZ !== 0
  const speed = input.running ? 16 : 9

  if (moving) {
    const sin = Math.sin(cameraYaw)
    const cos = Math.cos(cameraYaw)
    let dx = sin * input.moveZ - cos * input.moveX
    let dz = cos * input.moveZ + sin * input.moveX
    const length = Math.hypot(dx, dz) || 1
    dx /= length
    dz /= length

    body.position.x += dx * speed * dt
    body.position.z += dz * speed * dt
    body.yaw = Math.atan2(dx, dz)
  }

  body.bank = decay(body.bank ?? 0, dt)
  body.climbRate = 0

  if (input.climbing) {
    // A takeoff leaves the ground with the run already in it, so the first
    // airborne frame is not a hover.
    body.airborne = true
    body.airspeed = Math.max(moving ? speed : 0, HOVER_SPEED)
    body.pathAngle = CLIMB_ANGLE
    body.climbRate = CLIMB_RATE * 0.5
    body.flightMode = 'cruise'
    return {
      locomotion: 'cruise',
      airborne: true,
      climbing: true,
      landed: false,
      flightMode: 'cruise',
      pitch: 0,
      bank: 0,
      powered: true,
      airspeed: body.airspeed,
      climbRate: body.climbRate,
    }
  }

  body.airspeed = moving ? speed : 0
  clampToFlightBounds(body, boundsRadius)
  return {
    locomotion: moving ? 'walk' : 'idle',
    airborne: false,
    climbing: false,
    landed: false,
    flightMode: null,
    pitch: 0,
    bank: 0,
    powered: true,
    airspeed: body.airspeed,
    climbRate: 0,
  }
}

function stepAir(
  body: DirectWyvernFlightBody,
  input: DirectWyvernFlightInput,
  dt: number,
  boundsRadius: number,
): DirectWyvernFlightStep {
  const thrust = input.moveZ
  // Thrust released while descending is the glide/dive intent. Everything else
  // is a beating wing, including holding position, which the selector requires:
  // there is no unpowered way to hang.
  const powered = thrust > 0 || input.climbing || !input.descending

  let airspeed = body.airspeed ?? CRUISE_SPEED

  // Roll first: the turn follows the bank rather than the key, so a fast turn
  // is wide and a slow one is tight, and the bank loops read as the cause.
  const targetBank = -input.moveX * MAX_BANK
  const bank = approach(body.bank ?? 0, targetBank, BANK_RESPONSE * dt)
  const yawRate = clamp(
    (Math.tan(bank) * TURN_GRAVITY) / Math.max(airspeed, HOVER_SPEED),
    -MAX_YAW_RATE,
    MAX_YAW_RATE,
  )
  body.yaw += yawRate * dt

  let targetAngle = 0
  if (input.climbing) targetAngle = CLIMB_ANGLE
  else if (input.descending) targetAngle = powered ? -DESCEND_ANGLE : -DIVE_ANGLE
  else if (!powered) targetAngle = -GLIDE_ANGLE
  const pathAngle = approach(body.pathAngle ?? 0, targetAngle, ANGLE_RESPONSE * dt)

  // Thrust, then the height/speed exchange the path angle costs or pays.
  const targetSpeed = powered
    ? (thrust > 0 ? (input.running ? SPRINT_SPEED : CRUISE_SPEED) : CRUISE_SPEED * 0.55)
    : HOVER_SPEED * 3
  const accel = powered && thrust > 0 ? THRUST_ACCEL : DRAG_DECEL
  airspeed = approach(airspeed, targetSpeed, accel * dt)
  airspeed = clamp(airspeed - Math.sin(pathAngle) * GRAVITY_EXCHANGE * dt, 0, DIVE_SPEED)

  // Reverse holds position instead of flying backwards — that is the hover.
  const groundSpeed =
    thrust < 0 ? Math.min(airspeed, HOVER_SPEED * 0.5) : airspeed * Math.cos(pathAngle)
  const climbRate = clamp(airspeed * Math.sin(pathAngle), -DIVE_SPEED, CLIMB_RATE)

  body.position.x += Math.sin(body.yaw) * groundSpeed * dt
  body.position.z += Math.cos(body.yaw) * groundSpeed * dt
  body.position.y = Math.min(50, body.position.y + climbRate * dt)

  const landing = body.position.y <= 0.2 || (input.descending && body.position.y <= 1.5)
  let pitch = clamp(-pathAngle, -MAX_PITCH, MAX_PITCH)
  if (!landing && body.position.y <= FLARE_HEIGHT && climbRate < 0) {
    // Flare: the nose comes up into the ground rather than through it.
    pitch = approach(pitch, -0.3, 1)
  }

  body.airspeed = airspeed
  body.climbRate = climbRate
  body.pathAngle = pathAngle
  body.bank = bank

  if (landing) {
    body.position.y = 0
    body.airborne = false
    body.climbRate = 0
    body.pathAngle = 0
    body.bank = 0
    body.flightMode = undefined
    clampToFlightBounds(body, boundsRadius)
    return {
      locomotion: 'idle',
      airborne: false,
      climbing: false,
      landed: true,
      flightMode: null,
      pitch: 0,
      bank: 0,
      powered: true,
      airspeed,
      climbRate: 0,
    }
  }

  const flightMode = flightAnimationState(body.flightMode ?? 'cruise', bank, {
    horizontalSpeed: groundSpeed,
    verticalSpeed: climbRate,
    referenceSpeed: CRUISE_SPEED,
    powered,
    boosting: input.running && thrust > 0,
  })
  body.flightMode = flightMode

  clampToFlightBounds(body, boundsRadius)
  return {
    locomotion: 'cruise',
    airborne: true,
    climbing: input.climbing,
    landed: false,
    flightMode,
    pitch,
    bank,
    powered,
    airspeed,
    climbRate,
  }
}

function clampToFlightBounds(body: DirectWyvernFlightBody, boundsRadius: number): void {
  const flat = Math.hypot(body.position.x, body.position.z)
  if (flat <= boundsRadius || flat === 0) return
  body.position.x *= boundsRadius / flat
  body.position.z *= boundsRadius / flat
}

function approach(current: number, target: number, step: number): number {
  const delta = target - current
  if (Math.abs(delta) <= step) return target
  return current + Math.sign(delta) * step
}

function decay(current: number, dt: number): number {
  return approach(current, 0, BANK_RESPONSE * dt)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
