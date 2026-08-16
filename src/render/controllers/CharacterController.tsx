'use client'

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Group, Plane, Raycaster, Vector2, Vector3 } from 'three'
import { useCameraStore } from '@/state/cameraStore'
import { usePlayerControlStore } from '@/state/playerControlStore'
import { useSanctuaryCommands } from '@/state/sanctuaryCommands'
import { CONTROLS, axis, consumeClick, consumeDrag, consumeWheel, isDown, pointer } from './input'
import { findPath } from './navigation'

/** Axis-aligned box footprint in the XZ plane. */
export interface Collider {
  x: number
  z: number
  halfW: number
  halfD: number
}

export interface CharacterState {
  position: Vector3
  yaw: number
  moving: boolean
  running: boolean
}

export interface CharacterMoveCommand {
  /** Monotonic id so the same destination can be commanded again. */
  token: number
  position: [number, number]
  /** Optional point the character should face after reaching the destination. */
  face?: [number, number]
}

const WALK_SPEED = 7
const RUN_SPEED = 13
const RADIUS = 0.45
const CAMERA_DISTANCE = 14
const CAMERA_MIN_DISTANCE = 4
const CAMERA_MAX_DISTANCE = 120
const CAMERA_ZOOM_SPEED = 0.02
const CAMERA_MIN_PITCH = 0.05
const CAMERA_MAX_PITCH = 1.42
const EYE_HEIGHT = 1.6
const CLICK_ARRIVAL_RADIUS = 0.25
/**
 * Extra room the planned route keeps beyond the body radius.
 *
 * `resolveCollisions` pushes out at exactly RADIUS, so a route planned at
 * RADIUS alone would ride the push-out boundary the whole way and jitter along
 * every wall it passes.
 */
const PATH_CLEARANCE = 0.15
const GROUND_PLANE = new Plane(new Vector3(0, 1, 0), 0)

export function CharacterController({
  spawn = [0, 0, 0],
  colliders = [],
  bounds = 60,
  onUpdate,
  moveCommand,
  onCommandArrival,
  onCommandCancel,
  acceptGroundClicks = true,
  groundHeightAt,
  children,
}: {
  spawn?: [number, number, number]
  colliders?: Collider[]
  bounds?: number
  /**
   * Terrain sampler for scenes whose ground is not flat. Omit it and the
   * character stays on the y=0 plane, which is what the sanctuary wants.
   */
  groundHeightAt?: (x: number, z: number) => number
  /** Called every frame. Must not call setState — mutate a ref instead. */
  onUpdate?: (state: CharacterState) => void
  /** Optional external walk order used by sanctuary contact interactions. */
  moveCommand?: CharacterMoveCommand | null
  onCommandArrival?: (token: number) => void
  onCommandCancel?: (token: number) => void
  /** False while another system (attack targeting) owns canvas clicks. */
  acceptGroundClicks?: boolean
  children?: React.ReactNode
}) {
  const group = useRef<Group>(null)
  const camera = useThree((s) => s.camera)

  // Seeded once from `spawn`; the controller owns the position from then on.
  // Re-syncing it to the prop would fight the player for control of movement.
  const position = useRef(new Vector3(spawn[0], spawn[1], spawn[2]))
  const cameraYaw = useRef(0)
  const cameraPitch = useRef(0.36)
  const cameraDistance = useRef(CAMERA_DISTANCE)
  const yaw = useRef(0)
  const destination = useRef<Vector3 | null>(null)
  /** Remaining corners of the planned route, after `destination`. */
  const pathQueue = useRef<Vector3[]>([])
  const commandFace = useRef<Vector3 | null>(null)
  const commandToken = useRef<number | null>(null)
  const raycaster = useRef(new Raycaster())
  const clickNdc = useRef(new Vector2())
  const desiredCam = useRef(new Vector3())
  const trackedTarget = useRef(new Vector3(spawn[0], spawn[1] + EYE_HEIGHT, spawn[2]))
  const lastPresetToken = useRef(0)

  const presetToken = useCameraStore((s) => s.presetToken)

  // Read by the move-command effect, which must not re-run when the layout
  // changes — that would re-issue an order the player has already answered.
  const collidersRef = useRef(colliders)
  collidersRef.current = colliders
  const boundsRef = useRef(bounds)
  boundsRef.current = bounds

  useEffect(() => {
    if (presetToken > 0 && presetToken !== lastPresetToken.current) {
      lastPresetToken.current = presetToken
      const { targetPitch, targetDistance, targetYaw } = useCameraStore.getState()
      cameraPitch.current = targetPitch
      cameraDistance.current = targetDistance
      if (targetYaw !== null) {
        cameraYaw.current = targetYaw
      }
    }
  }, [presetToken])

  // Clicks are captured globally because the ray may pass through scenery.
  // Discard a click left by another scene before this controller mounted.
  useEffect(() => {
    pointer.clicked = false
  }, [])

  useEffect(() => {
    if (!moveCommand) {
      if (commandToken.current !== null) {
        destination.current = null
        pathQueue.current = []
        commandFace.current = null
        commandToken.current = null
      }
      return
    }
    const route = planRoute(
      position.current,
      new Vector3(moveCommand.position[0], 0, moveCommand.position[1]),
      collidersRef.current,
      boundsRef.current,
    )
    destination.current = route[0]!
    pathQueue.current = route.slice(1)
    commandFace.current = moveCommand.face
      ? new Vector3(moveCommand.face[0], 0, moveCommand.face[1])
      : null
    commandToken.current = moveCommand.token
  }, [moveCommand])

  useFrame((_, rawDelta) => {
    // Guard against the huge delta a backgrounded tab produces on return,
    // which would otherwise teleport the character through a wall.
    const dt = Math.min(rawDelta, 0.05)
    const camSettings = useCameraStore.getState()

    // Update FOV dynamically if requested
    if ('fov' in camera && typeof camera.fov === 'number' && camera.fov !== camSettings.fov) {
      camera.fov = camSettings.fov
      camera.updateProjectionMatrix()
    }

    const drag = consumeDrag()
    const dragXMultiplier = (camSettings.invertX ? -1 : 1) * camSettings.sensitivity
    const dragYMultiplier = (camSettings.invertY ? 1 : -1) * camSettings.sensitivity

    cameraYaw.current += drag.x * 0.005 * dragXMultiplier
    cameraPitch.current = Math.max(
      CAMERA_MIN_PITCH,
      Math.min(CAMERA_MAX_PITCH, cameraPitch.current + drag.y * 0.004 * dragYMultiplier),
    )
    cameraDistance.current = Math.max(
      CAMERA_MIN_DISTANCE,
      Math.min(
        CAMERA_MAX_DISTANCE,
        cameraDistance.current + consumeWheel() * CAMERA_ZOOM_SPEED * camSettings.zoomSpeed,
      ),
    )


    const isHumanControl = usePlayerControlStore.getState().controlMode === 'human'

    if (acceptGroundClicks && isHumanControl && consumeClick()) {
      if (commandToken.current !== null) {
        onCommandCancel?.(commandToken.current)
        commandToken.current = null
        commandFace.current = null
      }
      clickNdc.current.set(pointer.x, pointer.y)
      raycaster.current.setFromCamera(clickNdc.current, camera)
      const hit = new Vector3()
      if (raycaster.current.ray.intersectPlane(GROUND_PLANE, hit)) {
        const flat = Math.hypot(hit.x, hit.z)
        if (flat > bounds) {
          hit.x *= bounds / flat
          hit.z *= bounds / flat
        }
        const clicked = planRoute(position.current, hit, colliders, bounds)
        destination.current = clicked[0]!
        pathQueue.current = clicked.slice(1)
      }
    }

    const inputX = isHumanControl ? axis([...CONTROLS.right], [...CONTROLS.left]) : 0
    const inputZ = isHumanControl ? axis([...CONTROLS.forward], [...CONTROLS.back]) : 0
    const keyboardMoving = inputX !== 0 || inputZ !== 0
    const spacePressed = isHumanControl && isDown('Space')

    if (keyboardMoving || spacePressed) {
      if (destination.current) {
        destination.current = null
        pathQueue.current = []
        if (commandToken.current !== null) {
          onCommandCancel?.(commandToken.current)
          commandToken.current = null
          commandFace.current = null
        }
        useSanctuaryCommands.getState().clearPlayerInteraction()
      }
    }

    let moving = keyboardMoving
    const running = keyboardMoving && isDown(...CONTROLS.run)
    if (keyboardMoving) {
      const sin = Math.sin(cameraYaw.current)
      const cos = Math.cos(cameraYaw.current)
      // Movement is camera-relative: "forward" means "away from the camera".
      // With the camera looking along +Z at yaw 0, screen-right is world -X
      // (three.js cameras look down their local -Z axis).
      let dx = sin * inputZ - cos * inputX
      let dz = cos * inputZ + sin * inputX
      const len = Math.hypot(dx, dz) || 1
      dx /= len
      dz /= len

      const speed = running ? RUN_SPEED : WALK_SPEED
      position.current.x += dx * speed * dt
      position.current.z += dz * speed * dt
      yaw.current = Math.atan2(dx, dz)
    } else if (destination.current) {
      const dx = destination.current.x - position.current.x
      const dz = destination.current.z - position.current.z
      const distance = Math.hypot(dx, dz)

      if (distance <= CLICK_ARRIVAL_RADIUS) {
        const corner = pathQueue.current.shift()
        if (corner) {
          // A turn on the route, not the destination — keep walking.
          destination.current = corner
          moving = true
        } else {
          destination.current = null
          if (commandToken.current !== null) {
            const arrived = commandToken.current
            if (commandFace.current) {
              yaw.current = Math.atan2(
                commandFace.current.x - position.current.x,
                commandFace.current.z - position.current.z,
              )
            }
            commandToken.current = null
            commandFace.current = null
            onCommandArrival?.(arrived)
          }
        }
      } else {
        const step = Math.min(WALK_SPEED * dt, distance)
        position.current.x += (dx / distance) * step
        position.current.z += (dz / distance) * step
        yaw.current = Math.atan2(dx, dz)
        moving = true
      }
    }

    resolveCollisions(position.current, colliders)

    const flat = Math.hypot(position.current.x, position.current.z)
    if (flat > bounds) {
      position.current.x *= bounds / flat
      position.current.z *= bounds / flat
    }

    if (groundHeightAt) {
      position.current.y = groundHeightAt(position.current.x, position.current.z)
    }

    if (group.current) {
      group.current.position.copy(position.current)
      group.current.rotation.y = yaw.current
    }

    // Determine focus target (character vs wyvern)
    const activeTarget = new Vector3()
    if (camSettings.followTarget === 'wyvern' && camSettings.wyvernTargetPosition) {
      activeTarget.set(
        camSettings.wyvernTargetPosition[0],
        camSettings.wyvernTargetPosition[1],
        camSettings.wyvernTargetPosition[2],
      )
    } else {
      activeTarget.set(position.current.x, position.current.y + EYE_HEIGHT, position.current.z)
    }

    // Lerp tracked target smoothly so transition between character and wyvern is fluid
    trackedTarget.current.lerp(activeTarget, 1 - Math.exp(-camSettings.smoothing * dt))

    // Camera trails the tracked target
    const distance = cameraDistance.current
    const horizontalDistance = distance * Math.cos(cameraPitch.current)
    const cameraHeight = distance * Math.sin(cameraPitch.current)
    desiredCam.current.set(
      trackedTarget.current.x - Math.sin(cameraYaw.current) * horizontalDistance,
      trackedTarget.current.y + cameraHeight,
      trackedTarget.current.z - Math.cos(cameraYaw.current) * horizontalDistance,
    )
    camera.position.lerp(desiredCam.current, 1 - Math.exp(-camSettings.smoothing * dt))
    camera.lookAt(trackedTarget.current)

    onUpdate?.({ position: position.current, yaw: yaw.current, moving, running })
  })

  return <group ref={group}>{children}</group>
}

/**
 * Turns a walk order into waypoints that go around the obstacles.
 *
 * A straight line plus `resolveCollisions` is not a detour, it is a dead stop:
 * the push-out pins the body against whatever is in the way and the walk never
 * arrives. That stranded the sanctuary's contact commands, whose wyvern waits
 * in `approachingPlayer` until the player reports arrival.
 *
 * A goal with no route at all falls back to the straight line, so a stale or
 * over-inflated collider set can never freeze the character where it stands.
 */
function planRoute(
  from: Vector3,
  target: Vector3,
  colliders: readonly Collider[],
  bounds: number,
): Vector3[] {
  const route = findPath(
    { x: from.x, z: from.z },
    { x: target.x, z: target.z },
    colliders,
    { radius: RADIUS + PATH_CLEARANCE, boundsRadius: bounds },
  )
  const points = route ?? [{ x: target.x, z: target.z }]
  return points.map((point) => new Vector3(point.x, 0, point.z))
}

/**
 * Pushes the character out of any box it has entered, along whichever axis it
 * is least deep in — that produces sliding along walls rather than sticking.
 */
function resolveCollisions(position: Vector3, colliders: readonly Collider[]): void {
  for (const box of colliders) {
    const dx = position.x - box.x
    const dz = position.z - box.z
    const overlapX = box.halfW + RADIUS - Math.abs(dx)
    const overlapZ = box.halfD + RADIUS - Math.abs(dz)

    if (overlapX <= 0 || overlapZ <= 0) continue

    if (overlapX < overlapZ) {
      position.x += dx >= 0 ? overlapX : -overlapX
    } else {
      position.z += dz >= 0 ? overlapZ : -overlapZ
    }
  }
}
