import { describe, expect, it } from 'vitest'
import { Object3D, Quaternion, Vector3 } from 'three'
import {
  alignChainToBody,
  alignTailToBody,
  applyBoneOffset,
  applyLegTuck,
  holdStreamlinedHeadPose,
  LEG_TUCK_WEIGHTS,
  LOCAL_PITCH,
  LOCAL_ROLL,
  LOCAL_YAW,
} from './boneOffsets'

function expectSameRotation(actual: Quaternion, expected: Quaternion): void {
  expect(actual.angleTo(expected)).toBeLessThan(1e-6)
}

describe('bone offsets', () => {
  it('composes the aerodynamic response onto an authored pose', () => {
    const bone = new Object3D()
    bone.quaternion.setFromAxisAngle(LOCAL_YAW, 0.41)
    const authored = bone.quaternion.clone()

    applyBoneOffset(bone, 0.2, -0.1, 0.05)

    const expected = authored
      .multiply(new Quaternion().setFromAxisAngle(LOCAL_PITCH, 0.2))
      .multiply(new Quaternion().setFromAxisAngle(LOCAL_YAW, -0.1))
      .multiply(new Quaternion().setFromAxisAngle(LOCAL_ROLL, 0.05))
    expectSameRotation(bone.quaternion, expected)
  })

  it('uses the measured tuck shares without replacing either leg pose', () => {
    const chain = LEG_TUCK_WEIGHTS.map((_, index) => {
      const bone = new Object3D()
      bone.quaternion.setFromAxisAngle(LOCAL_YAW, 0.1 * (index + 1))
      return bone
    })
    const authored = chain.map((bone) => bone.quaternion.clone())

    applyLegTuck(chain, 0.4)

    chain.forEach((bone, index) => {
      const expected = authored[index]!.multiply(
        new Quaternion().setFromAxisAngle(LOCAL_PITCH, 0.4 * LEG_TUCK_WEIGHTS[index]!),
      )
      expectSameRotation(bone.quaternion, expected)
    })
  })

  it('straightens each tail link toward the current body line without a world-space reset', () => {
    // Bones run along local +Y, as they do on the clean rig, and the kink is in
    // Z — the plane a sagittal (local X) rotation can actually resolve.
    const pelvis = new Object3D()
    const tail1 = new Object3D()
    const tail2 = new Object3D()
    const tail3 = new Object3D()
    pelvis.add(tail1)
    tail1.add(tail2)
    tail2.add(tail3)
    tail1.position.set(0, -1, 0)
    tail2.position.set(0, -1, 1)
    tail3.position.set(0, -1, 1)
    pelvis.updateWorldMatrix(true, true)

    alignTailToBody([tail1, tail2, tail3], pelvis, 1)

    const root = tail1.getWorldPosition(new Vector3())
    const middle = tail2.getWorldPosition(new Vector3())
    const tip = tail3.getWorldPosition(new Vector3())
    // Fully aligned, the chain lies on the pelvis → tail-root line, which here
    // is straight down, so the kink in Z is gone and each link keeps falling.
    expect(middle.z).toBeCloseTo(root.z, 6)
    expect(tip.z).toBeCloseTo(root.z, 6)
    expect(tip.y).toBeLessThan(middle.y)
  })

  it('keeps the aligned neck on the body line and holds the skull at its measured forward pose', () => {
    const pelvis = new Object3D()
    const neck = new Object3D()
    const neck1 = new Object3D()
    const neck2 = new Object3D()
    const head = new Object3D()
    pelvis.add(neck)
    neck.add(neck1)
    neck1.add(neck2)
    neck2.add(head)
    neck.position.set(0, 1, 0)
    neck1.position.set(0, 1, 1)
    neck2.position.set(0, 1, 0)
    head.position.set(0, 1, 0)
    head.quaternion.setFromAxisAngle(LOCAL_YAW, 0.4)
    pelvis.updateWorldMatrix(true, true)

    alignChainToBody([neck, neck1, neck2, head], pelvis, 1)
    holdStreamlinedHeadPose(head, 1)

    const neckRoot = neck.getWorldPosition(new Vector3())
    const headPosition = head.getWorldPosition(new Vector3())
    expect(headPosition.z).toBeCloseTo(neckRoot.z, 6)
    expect(
      head.quaternion.angleTo(new Quaternion(-0.0007635, 0.0000137, 0.0411221, 0.9991539)),
    ).toBeLessThan(1e-6)
  })
})
