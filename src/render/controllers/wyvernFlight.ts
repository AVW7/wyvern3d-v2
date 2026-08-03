'use client'

import { axis, CONTROLS, isDown, keys } from './input'

export interface DirectWyvernFlightBody {
  position: { x: number; y: number; z: number }
  yaw: number
  airborne: boolean
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
}

export interface DirectWyvernFlightOptions {
  boundsRadius: number
}

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
 * Shared direct-flight movement for Sanctuary and Highlands.
 *
 * It mutates only the supplied presentation body. No simulation or React state
 * enters this helper, so a caller can apply its returned locomotion at a small
 * number of visual state transitions.
 */
export function stepDirectWyvernFlight(
  body: DirectWyvernFlightBody,
  input: DirectWyvernFlightInput,
  cameraYaw: number,
  dt: number,
  { boundsRadius }: DirectWyvernFlightOptions,
): DirectWyvernFlightStep {
  let landed = false

  if (!body.airborne) {
    const moving = input.moveX !== 0 || input.moveZ !== 0
    if (moving) {
      const sin = Math.sin(cameraYaw)
      const cos = Math.cos(cameraYaw)
      let dx = sin * input.moveZ - cos * input.moveX
      let dz = cos * input.moveZ + sin * input.moveX
      const length = Math.hypot(dx, dz) || 1
      dx /= length
      dz /= length

      const speed = input.running ? 16 : 9
      body.position.x += dx * speed * dt
      body.position.z += dz * speed * dt
      body.yaw = Math.atan2(dx, dz)
    }

    if (input.climbing) {
      body.airborne = true
      return { locomotion: 'cruise', airborne: true, climbing: true, landed: false }
    }

    clampToFlightBounds(body, boundsRadius)
    return { locomotion: moving ? 'walk' : 'idle', airborne: false, climbing: false, landed: false }
  }

  const speed = input.running ? 28 : 18
  if (input.moveX !== 0) body.yaw -= input.moveX * 2.2 * dt

  const forwardThrust = input.moveZ !== 0 ? input.moveZ : 0.8
  if (forwardThrust > 0) {
    body.position.x += Math.sin(body.yaw) * forwardThrust * speed * dt
    body.position.z += Math.cos(body.yaw) * forwardThrust * speed * dt
  }

  if (input.climbing) body.position.y = Math.min(50, body.position.y + 12 * dt)
  else if (input.descending) body.position.y -= 12 * dt

  if (body.position.y <= 0.2 || (input.descending && body.position.y <= 1.5)) {
    body.position.y = 0
    body.airborne = false
    landed = true
  }

  clampToFlightBounds(body, boundsRadius)
  return {
    locomotion: body.airborne ? 'cruise' : 'idle',
    airborne: body.airborne,
    climbing: body.airborne && input.climbing,
    landed,
  }
}

function clampToFlightBounds(body: DirectWyvernFlightBody, boundsRadius: number): void {
  const flat = Math.hypot(body.position.x, body.position.z)
  if (flat <= boundsRadius || flat === 0) return
  body.position.x *= boundsRadius / flat
  body.position.z *= boundsRadius / flat
}
