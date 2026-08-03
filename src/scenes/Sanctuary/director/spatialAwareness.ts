import { clamp, damp, type Vec3 } from '@/core/math/vec'

export const PLAYER_NOTICE_DIST = 8.0
export const NEIGHBOR_NOTICE_DIST = 10.0

export const MAX_HEAD_YAW = 0.96 // ~55 deg
export const MIN_HEAD_PITCH = -0.61 // ~-35 deg
export const MAX_HEAD_PITCH = 0.44 // ~+25 deg

export interface HeadPose {
  pitch: number
  yaw: number
}

export interface SpatialAgent {
  id: string
  position: Vec3
  yaw: number
  airborne: boolean
}

/**
 * Resolves the primary spatial target for a settled wyvern.
 * Priority 1: Player within PLAYER_NOTICE_DIST.
 * Priority 2: Closest neighboring wyvern within NEIGHBOR_NOTICE_DIST.
 */
export function resolveGazeTarget(
  selfId: string,
  selfPos: Vec3,
  playerPos: Vec3 | null,
  neighbors: SpatialAgent[],
): Vec3 | null {
  if (playerPos) {
    const distToPlayer = Math.hypot(playerPos.x - selfPos.x, playerPos.z - selfPos.z)
    if (distToPlayer <= PLAYER_NOTICE_DIST) {
      return playerPos
    }
  }

  let closestNeighbor: SpatialAgent | null = null
  let minNeighborDist = NEIGHBOR_NOTICE_DIST

  for (const neighbor of neighbors) {
    if (neighbor.id === selfId) continue
    const dist = Math.hypot(neighbor.position.x - selfPos.x, neighbor.position.z - selfPos.z)
    if (dist < minNeighborDist) {
      minNeighborDist = dist
      closestNeighbor = neighbor
    }
  }

  return closestNeighbor ? closestNeighbor.position : null
}

/**
 * Computes relative pitch and yaw angles from the agent's facing body orientation
 * toward the gaze target, clamped within anatomical limits.
 */
export function calculateHeadTargetAngles(
  selfPos: Vec3,
  bodyYaw: number,
  targetPos: Vec3 | null,
): HeadPose {
  if (!targetPos) {
    return { pitch: 0, yaw: 0 }
  }

  const dx = targetPos.x - selfPos.x
  const dy = targetPos.y - (selfPos.y + 3.0) // Assume head height ~3 units above origin
  const dz = targetPos.z - selfPos.z
  const horizDist = Math.hypot(dx, dz)

  if (horizDist < 1e-3) {
    return { pitch: 0, yaw: 0 }
  }

  const targetWorldYaw = Math.atan2(dx, dz)
  let relativeYaw = targetWorldYaw - bodyYaw
  // Wrap relative yaw to [-PI, PI]
  relativeYaw = Math.atan2(Math.sin(relativeYaw), Math.cos(relativeYaw))

  const targetPitch = -Math.atan2(dy, horizDist)

  return {
    yaw: clamp(relativeYaw, -MAX_HEAD_YAW, MAX_HEAD_YAW),
    pitch: clamp(targetPitch, MIN_HEAD_PITCH, MAX_HEAD_PITCH),
  }
}

/** Smoothly damps head pose angles towards target values over frame time dt. */
export function dampHeadPose(
  current: HeadPose,
  target: HeadPose,
  dt: number,
  rate = 6,
): HeadPose {
  return {
    pitch: damp(current.pitch, target.pitch, rate, dt),
    yaw: damp(current.yaw, target.yaw, rate, dt),
  }
}
