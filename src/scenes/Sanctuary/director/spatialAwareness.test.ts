import { describe, expect, it } from 'vitest'
import { vec } from '@/core/math/vec'
import {
  calculateHeadTargetAngles,
  dampHeadPose,
  MAX_HEAD_PITCH,
  MAX_HEAD_YAW,
  MIN_HEAD_PITCH,
  resolveGazeTarget,
  type SpatialAgent,
} from './spatialAwareness'

describe('spatialAwareness', () => {
  it('prioritizes player gaze target when player is within notice distance', () => {
    const selfPos = vec(0, 0, 0)
    const playerPos = vec(3, 0, 4) // dist 5.0 <= 8.0
    const neighbors: SpatialAgent[] = [
      { id: 'wyvern-2', position: vec(1, 0, 1), yaw: 0, airborne: false },
    ]

    const target = resolveGazeTarget('wyvern-1', selfPos, playerPos, neighbors)
    expect(target).toEqual(playerPos)
  })

  it('selects nearest neighbor when player is out of range', () => {
    const selfPos = vec(0, 0, 0)
    const playerPos = vec(20, 0, 20) // dist > 8.0
    const neighbors: SpatialAgent[] = [
      { id: 'wyvern-1', position: vec(0, 0, 0), yaw: 0, airborne: false },
      { id: 'wyvern-2', position: vec(6, 0, 0), yaw: 0, airborne: false },
      { id: 'wyvern-3', position: vec(3, 0, 0), yaw: 0, airborne: false },
    ]

    const target = resolveGazeTarget('wyvern-1', selfPos, playerPos, neighbors)
    expect(target).toEqual(vec(3, 0, 0))
  })

  it('returns null when no targets are within range', () => {
    const selfPos = vec(0, 0, 0)
    const playerPos = vec(50, 0, 0)
    const neighbors: SpatialAgent[] = [
      { id: 'wyvern-2', position: vec(100, 0, 0), yaw: 0, airborne: false },
    ]

    const target = resolveGazeTarget('wyvern-1', selfPos, playerPos, neighbors)
    expect(target).toBeNull()
  })

  it('clamps head target angles within anatomical limits', () => {
    const selfPos = vec(0, 0, 0)
    const bodyYaw = 0
    const targetPos = vec(100, 50, 0) // Extreme angle to the right and high up

    const pose = calculateHeadTargetAngles(selfPos, bodyYaw, targetPos)
    expect(pose.yaw).toBeLessThanOrEqual(MAX_HEAD_YAW)
    expect(pose.yaw).toBeGreaterThanOrEqual(-MAX_HEAD_YAW)
    expect(pose.pitch).toBeLessThanOrEqual(MAX_HEAD_PITCH)
    expect(pose.pitch).toBeGreaterThanOrEqual(MIN_HEAD_PITCH)
  })

  it('damps head pose smoothly over time', () => {
    const startPose = { pitch: 0, yaw: 0 }
    const targetPose = { pitch: 0.3, yaw: 0.5 }
    const dt = 0.05

    const damped = dampHeadPose(startPose, targetPose, dt, 6)
    expect(damped.yaw).toBeGreaterThan(0)
    expect(damped.yaw).toBeLessThan(0.5)
    expect(damped.pitch).toBeGreaterThan(0)
    expect(damped.pitch).toBeLessThan(0.3)
  })
})
