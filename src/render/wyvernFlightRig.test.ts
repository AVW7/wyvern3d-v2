import { describe, expect, it } from 'vitest'
import { Group, Object3D, Vector3 } from 'three'
import { createWyvernFlightRig } from './wyvernFlightRig'
import {
  HEAD_BONE,
  JAW_BONE,
  LEFT_LEG_CHAIN,
  NECK_CHAIN,
  RIGHT_LEG_CHAIN,
  SPINE_CHAIN,
  TAIL_CHAIN,
} from './rigBones'

function createMockArmature(): Group {
  const root = new Group()
  root.name = 'WyvernRoot'

  const head = new Object3D()
  head.name = HEAD_BONE
  root.add(head)

  const jaw = new Object3D()
  jaw.name = JAW_BONE
  head.add(jaw)

  let parent: Object3D = root
  for (const name of NECK_CHAIN) {
    const bone = new Object3D()
    bone.name = name
    parent.add(bone)
    parent = bone
  }

  parent = root
  for (const name of SPINE_CHAIN) {
    const bone = new Object3D()
    bone.name = name
    parent.add(bone)
    parent = bone
  }

  parent = root
  for (const name of TAIL_CHAIN) {
    const bone = new Object3D()
    bone.name = name
    parent.add(bone)
    parent = bone
  }

  for (const name of LEFT_LEG_CHAIN) {
    const bone = new Object3D()
    bone.name = name
    root.add(bone)
  }

  for (const name of RIGHT_LEG_CHAIN) {
    const bone = new Object3D()
    bone.name = name
    root.add(bone)
  }

  return root
}

describe('WyvernFlightRig', () => {
  it('mounts armature and binds all bone chains', () => {
    const armature = createMockArmature()
    const rig = createWyvernFlightRig(armature)

    expect(rig.bones.head).not.toBeNull()
    expect(rig.bones.jaw).not.toBeNull()
    expect(rig.bones.neck.length).toBe(NECK_CHAIN.length)
    expect(rig.bones.spine.length).toBe(SPINE_CHAIN.length)
    expect(rig.bones.tail.length).toBe(TAIL_CHAIN.length)
    expect(rig.bones.leftLeg.length).toBe(LEFT_LEG_CHAIN.length)
    expect(rig.bones.rightLeg.length).toBe(RIGHT_LEG_CHAIN.length)
    expect(rig.jawClosed).not.toBeNull()
  })

  it('steps flight kinematics without throwing and updates flight pose', () => {
    const armature = createMockArmature()
    const rig = createWyvernFlightRig(armature)

    rig.step(0.016, {
      position: new Vector3(0, 20, 0),
      yaw: 0,
      airborne: true,
      horizontalSpeed: 18,
      verticalSpeed: 0,
      phaseTime: 1.0,
      flightMode: 'cruise',
    })

    expect(rig.flightPose).toBeDefined()
    expect(rig.headNeckPose).toBeDefined()
    expect(rig.flightLegTuck).toBeGreaterThanOrEqual(0)
  })

  it('damps pose to zero when grounded (airborne: false)', () => {
    const armature = createMockArmature()
    const rig = createWyvernFlightRig(armature)

    rig.step(0.05, {
      position: new Vector3(0, 0, 0),
      yaw: 0,
      airborne: false,
      horizontalSpeed: 0,
      verticalSpeed: 0,
      phaseTime: 0,
      flightMode: 'idle',
    })

    expect(rig.flightPose.pitch).toBe(0)
    expect(rig.flightPose.bank).toBe(0)
    expect(rig.flightLegTuck).toBe(0)
  })

  it('handles custom gaze targets in flight', () => {
    const armature = createMockArmature()
    const rig = createWyvernFlightRig(armature)

    rig.step(
      0.016,
      {
        position: new Vector3(0, 20, 0),
        yaw: 0,
        airborne: true,
        horizontalSpeed: 18,
        verticalSpeed: 0,
        phaseTime: 1.0,
      },
      {
        target: new Vector3(10, 20, 30),
        kind: 'player',
        weight: 0.8,
      },
    )

    expect(rig.intelligentHeadNeck).toBeDefined()
  })

  it('resets state correctly', () => {
    const armature = createMockArmature()
    const rig = createWyvernFlightRig(armature)

    rig.step(0.016, {
      position: new Vector3(10, 25, 10),
      yaw: 1.5,
      airborne: true,
      horizontalSpeed: 25,
      verticalSpeed: 5,
    })

    rig.reset()

    expect(rig.flightPose.pitch).toBe(0)
    expect(rig.flightPose.bank).toBe(0)
    expect(rig.flightLegTuck).toBe(0)
  })
})
