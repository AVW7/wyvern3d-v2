import { describe, expect, it } from 'vitest'
import { Object3D, Quaternion, Vector3 } from 'three'
import {
  captureClosedJawPose,
  isMouthAction,
  sealFlightJaw,
  shouldSealFlightJaw,
} from './flightMouth'

describe('flight mouth seal', () => {
  it('seals ordinary flight but preserves airborne attack and breath tells', () => {
    expect(shouldSealFlightJaw('cruise')).toBe(true)
    expect(shouldSealFlightJaw('hover')).toBe(true)
    expect(shouldSealFlightJaw('idle')).toBe(false)
    expect(shouldSealFlightJaw('dive', 'attackAir')).toBe(false)
    expect(shouldSealFlightJaw('cruise', 'breatheAir')).toBe(false)
    expect(isMouthAction('attackAir')).toBe(true)
    expect(isMouthAction('breathe')).toBe(true)
    expect(isMouthAction(null)).toBe(false)
  })

  it('holds the captured bind pose over an authored open-mouth key', () => {
    const jaw = new Object3D()
    jaw.quaternion.setFromAxisAngle(new Vector3(0, 1, 0), 0.15)
    const closed = captureClosedJawPose(jaw)
    jaw.quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 1.2))

    sealFlightJaw(jaw, closed)

    expect(jaw.quaternion.angleTo(closed!.quaternion)).toBeLessThan(1e-6)
  })

  it('does not recapture an animated pose when the same jaw is reported twice', () => {
    const jaw = new Object3D()
    const first = captureClosedJawPose(jaw)
    jaw.quaternion.setFromAxisAngle(new Vector3(1, 0, 0), 1.2)

    expect(captureClosedJawPose(jaw, first)).toBe(first)
  })
})
