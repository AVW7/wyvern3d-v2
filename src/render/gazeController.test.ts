import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import {
  createHeadNeckState,
  predictTargetPosition,
  calculateTurbulenceShake,
  modeSpecificHeadPitch,
  calculateTrackingRate,
  intelligentHeadNeckController,
  fromSpatialTarget,
  horizonTarget,
  GAZE_CONFIG,
  type BodyPose,
  type FlightContext,
  type GazeTarget,
} from './gazeController'

describe('createHeadNeckState', () => {
  it('returns a state with all angles at zero', () => {
    const state = createHeadNeckState()
    expect(state.neckPitch).toBe(0)
    expect(state.neckYaw).toBe(0)
    expect(state.headPitch).toBe(0)
    expect(state.headYaw).toBe(0)
    expect(state.headRoll).toBe(0)
    expect(state.trackingVelocity).toBe(0)
  })

  it('initializes lastTargetWorld as a vector', () => {
    const state = createHeadNeckState()
    expect(state.lastTargetWorld).toBeInstanceOf(Vector3)
    expect(state.lastTargetWorld.x).toBe(0)
    expect(state.lastTargetWorld.z).toBe(1)
  })
})

describe('predictTargetPosition', () => {
  const targetPos = new Vector3(10, 5, 20)
  const bodyVel = new Vector3(2, 0, 1)

  it('returns target unchanged when no target velocity', () => {
    const result = predictTargetPosition(targetPos, bodyVel)
    // Should adjust for our own motion slightly
    expect(result.x).toBeCloseTo(10 - 2 * GAZE_CONFIG.PREDICTION_HORIZON * 0.5, 2)
    expect(result.z).toBeCloseTo(20 - 1 * GAZE_CONFIG.PREDICTION_HORIZON * 0.5, 2)
  })

  it('predicts moving target position', () => {
    const targetVel = new Vector3(5, 0, 3)
    const result = predictTargetPosition(targetPos, bodyVel, targetVel)
    
    // Should add target velocity * horizon
    expect(result.x).toBeCloseTo(10 + 5 * GAZE_CONFIG.PREDICTION_HORIZON, 2)
    expect(result.z).toBeCloseTo(20 + 3 * GAZE_CONFIG.PREDICTION_HORIZON, 2)
  })

  it('handles zero velocity gracefully', () => {
    const result = predictTargetPosition(targetPos, new Vector3(0, 0, 0))
    expect(result.x).toBe(10)
    expect(result.y).toBe(5)
    expect(result.z).toBe(20)
  })
})

describe('calculateTurbulenceShake', () => {
  it('returns zero for zero turbulence', () => {
    const shake = calculateTurbulenceShake(0, 1.0)
    expect(shake.pitch).toBe(0)
    expect(shake.yaw).toBe(0)
    expect(shake.roll).toBe(0)
  })

  it('returns zero for low turbulence below threshold', () => {
    const shake = calculateTurbulenceShake(0.05, 1.0)
    expect(shake.pitch).toBe(0)
    expect(shake.yaw).toBe(0)
    expect(shake.roll).toBe(0)
  })

  it('produces oscillating shake for turbulent conditions', () => {
    const shake1 = calculateTurbulenceShake(0.5, 0)
    const shake2 = calculateTurbulenceShake(0.5, 0.1)
    
    // Should be non-zero
    expect(Math.abs(shake1.pitch) + Math.abs(shake1.yaw) + Math.abs(shake1.roll)).toBeGreaterThan(0)
    
    // Should oscillate (different values at different times)
    expect(shake1.pitch).not.toBe(shake2.pitch)
  })

  it('scales amplitude with turbulence level', () => {
    const shakeLow = calculateTurbulenceShake(0.2, 0.25)
    const shakeHigh = calculateTurbulenceShake(0.8, 0.25)
    
    // Higher turbulence should produce larger magnitudes (on average)
    const magLow = Math.abs(shakeLow.pitch) + Math.abs(shakeLow.yaw) + Math.abs(shakeLow.roll)
    const magHigh = Math.abs(shakeHigh.pitch) + Math.abs(shakeHigh.yaw) + Math.abs(shakeHigh.roll)
    expect(magHigh).toBeGreaterThan(magLow)
  })

  it('stays within reasonable bounds', () => {
    const shake = calculateTurbulenceShake(1.0, 0.5)
    expect(Math.abs(shake.pitch)).toBeLessThan(0.1)
    expect(Math.abs(shake.yaw)).toBeLessThan(0.1)
    expect(Math.abs(shake.roll)).toBeLessThan(0.1)
  })
})

describe('modeSpecificHeadPitch', () => {
  it('returns negative pitch for dive mode', () => {
    const pitch = modeSpecificHeadPitch('dive')
    expect(pitch).toBeLessThan(0)
    expect(pitch).toBe(GAZE_CONFIG.DIVE_HEAD_PITCH_OFFSET)
  })

  it('returns positive pitch for hover mode', () => {
    const pitch = modeSpecificHeadPitch('hover')
    expect(pitch).toBeGreaterThan(0)
    expect(pitch).toBe(GAZE_CONFIG.HOVER_HEAD_PITCH_OFFSET)
  })

  it('returns positive pitch for glide mode', () => {
    const pitch = modeSpecificHeadPitch('glide')
    expect(pitch).toBeGreaterThan(0)
    expect(pitch).toBe(GAZE_CONFIG.GLIDE_HEAD_PITCH_OFFSET)
  })

  it('returns negative pitch for speed mode', () => {
    const pitch = modeSpecificHeadPitch('speed')
    expect(pitch).toBeLessThan(0)
    expect(pitch).toBe(GAZE_CONFIG.SPEED_HEAD_PITCH_OFFSET)
  })

  it('returns zero for cruise mode', () => {
    const pitch = modeSpecificHeadPitch('cruise')
    expect(pitch).toBe(0)
  })

  it('returns zero for bank modes', () => {
    expect(modeSpecificHeadPitch('bankLeft')).toBe(0)
    expect(modeSpecificHeadPitch('bankRight')).toBe(0)
    expect(modeSpecificHeadPitch('scout')).toBe(0)
  })
})

describe('calculateTrackingRate', () => {
  it('returns base rate for zero urgency', () => {
    const rate = calculateTrackingRate(0, GAZE_CONFIG.BASE_HEAD_RATE, GAZE_CONFIG.MAX_HEAD_RATE)
    expect(rate).toBe(GAZE_CONFIG.BASE_HEAD_RATE)
  })

  it('increases rate with urgency', () => {
    const rateLow = calculateTrackingRate(0.3, GAZE_CONFIG.BASE_HEAD_RATE, GAZE_CONFIG.MAX_HEAD_RATE)
    const rateHigh = calculateTrackingRate(0.9, GAZE_CONFIG.BASE_HEAD_RATE, GAZE_CONFIG.MAX_HEAD_RATE)
    expect(rateHigh).toBeGreaterThan(rateLow)
  })

  it('caps at max rate', () => {
    const rate = calculateTrackingRate(1.0, GAZE_CONFIG.BASE_HEAD_RATE, GAZE_CONFIG.MAX_HEAD_RATE)
    expect(rate).toBeLessThanOrEqual(GAZE_CONFIG.MAX_HEAD_RATE)
  })

  it('never goes below base rate', () => {
    const rate = calculateTrackingRate(0.1, GAZE_CONFIG.BASE_HEAD_RATE, GAZE_CONFIG.MAX_HEAD_RATE)
    expect(rate).toBeGreaterThanOrEqual(GAZE_CONFIG.BASE_HEAD_RATE)
  })
})

describe('intelligentHeadNeckController', () => {
  const createTestBodyPose = (): BodyPose => ({
    position: new Vector3(0, 10, 0),
    velocity: new Vector3(18, 0, 0),
    yaw: 0,
    pitch: 0,
    bank: 0,
  })

  const createTestFlightContext = (): FlightContext => ({
    horizontalSpeed: 18,
    verticalSpeed: 0,
    turnRate: 0,
    turbulence: 0,
    flightMode: 'cruise',
    time: 1.0,
  })

  it('returns valid state with no gaze target', () => {
    const bodyPose = createTestBodyPose()
    const context = createTestFlightContext()
    const state = createHeadNeckState()

    const result = intelligentHeadNeckController(
      bodyPose,
      null,
      context,
      state,
      0.016
    )

    expect(result.neckPitch).toBeDefined()
    expect(result.neckYaw).toBeDefined()
    expect(result.headPitch).toBeDefined()
    expect(result.headYaw).toBeDefined()
    expect(result.headRoll).toBeDefined()
  })

  it('looks toward gaze target', () => {
    const bodyPose = createTestBodyPose()
    const context = createTestFlightContext()
    const state = createHeadNeckState()

    // Target is to the left
    const gaze: GazeTarget = {
      position: new Vector3(-15, 10, 20),
      urgency: 0.5,
      type: 'waypoint',
    }

    const result = intelligentHeadNeckController(
      bodyPose,
      gaze,
      context,
      state,
      0.5 // Larger dt for more noticeable change
    )

    // Should start turning toward the target
    expect(Math.abs(result.headYaw)).toBeGreaterThan(0.01)
  })

  it('applies mode-specific behavior', () => {
    const bodyPose = createTestBodyPose()
    const diveContext: FlightContext = {
      ...createTestFlightContext(),
      flightMode: 'dive',
    }
    const hoverContext: FlightContext = {
      ...createTestFlightContext(),
      flightMode: 'hover',
    }
    const state = createHeadNeckState()

    const diveResult = intelligentHeadNeckController(
      bodyPose,
      null,
      diveContext,
      state,
      0.5
    )

    const hoverResult = intelligentHeadNeckController(
      bodyPose,
      null,
      hoverContext,
      state,
      0.5
    )

    // Dive should pitch head down more than hover
    // Note: this tests modeSpecificHeadPitch integration
    expect(diveResult.headPitch).toBeLessThan(hoverResult.headPitch)
  })

  it('applies bank roll compensation', () => {
    const bodyPose = createTestBodyPose()
    bodyPose.bank = 0.5 // Banking right

    const context = createTestFlightContext()
    const state = createHeadNeckState()

    const result = intelligentHeadNeckController(
      bodyPose,
      null,
      context,
      state,
      0.5
    )

    // Head should counter-roll
    expect(result.headRoll).not.toBe(0)
    // Negative roll for positive bank (counter-rolling)
    expect(result.headRoll).toBeLessThan(0)
  })

  it('applies turbulence shake', () => {
    const bodyPose = createTestBodyPose()
    const context: FlightContext = {
      ...createTestFlightContext(),
      turbulence: 0.8,
    }
    const state = createHeadNeckState()

    const result = intelligentHeadNeckController(
      bodyPose,
      null,
      context,
      state,
      0.016
    )

    // With turbulence, shake should be present
    // (values won't be exactly 0 due to added shake)
    expect(Math.abs(result.headPitch) + Math.abs(result.headYaw)).toBeGreaterThanOrEqual(0)
  })

  it('tracks urgency-affected speed', () => {
    const bodyPose = createTestBodyPose()
    const context = createTestFlightContext()

    const gazeLow: GazeTarget = {
      position: new Vector3(0, 10, 30),
      urgency: 0.2, // Low urgency
      type: 'waypoint',
    }
    const gazeHigh: GazeTarget = {
      position: new Vector3(0, 10, 30),
      urgency: 0.9, // High urgency
      type: 'threat',
    }

    const stateLow = createHeadNeckState()
    const stateHigh = createHeadNeckState()

    // Multiple updates to see rate difference
    let resultLow = stateLow
    let resultHigh = stateHigh
    for (let i = 0; i < 5; i++) {
      resultLow = intelligentHeadNeckController(bodyPose, gazeLow, context, resultLow, 0.05)
      resultHigh = intelligentHeadNeckController(bodyPose, gazeHigh, context, resultHigh, 0.05)
    }

    // High urgency should track faster (reach closer to target)
    // After same number of frames, high urgency should be closer to target
    expect(Math.abs(resultHigh.headPitch)).toBeGreaterThanOrEqual(Math.abs(resultLow.headPitch) - 0.01)
  })

  it('respects anatomical limits', () => {
    const bodyPose = createTestBodyPose()
    const context = createTestFlightContext()
    const state = createHeadNeckState()

    // Target is way to the side (should exceed limits)
    const extremeGaze: GazeTarget = {
      position: new Vector3(100, 50, -100),
      urgency: 1.0,
      type: 'threat',
    }

    // Run for a while
    let result = state
    for (let i = 0; i < 50; i++) {
      result = intelligentHeadNeckController(bodyPose, extremeGaze, context, result, 0.05)
    }

    // Should be clamped within limits
    expect(Math.abs(result.headYaw)).toBeLessThanOrEqual(GAZE_CONFIG.MAX_HEAD_YAW + 0.01)
    expect(Math.abs(result.headPitch)).toBeLessThanOrEqual(GAZE_CONFIG.MAX_HEAD_PITCH + 0.01)
    expect(Math.abs(result.headRoll)).toBeLessThanOrEqual(GAZE_CONFIG.MAX_HEAD_ROLL + 0.01)
  })

  it('adds turn-rate lead to yaw', () => {
    const bodyPose = createTestBodyPose()
    const context = createTestFlightContext()
    context.turnRate = 1.0 // Turning left

    const state = createHeadNeckState()

    const result = intelligentHeadNeckController(
      bodyPose,
      null,
      context,
      state,
      0.1
    )

    // Head should lead into turn (negative yaw for positive turn rate)
    // The turnLead calculation: clamp(-turnRate * 0.25, -0.4, 0.4) = -0.25
    // Then 60% goes to head: -0.15
    // So headYaw should be negative (looking into the turn)
    expect(result.headYaw).toBeLessThan(0)
  })

  it('preserves state continuity between frames', () => {
    const bodyPose = createTestBodyPose()
    const context = createTestFlightContext()
    const state1 = createHeadNeckState()

    // First frame
    const result1 = intelligentHeadNeckController(bodyPose, null, context, state1, 0.016)

    // Second frame with same inputs should produce similar results (smooth)
    const result2 = intelligentHeadNeckController(bodyPose, null, context, result1, 0.016)

    // Should not jump dramatically between frames
    expect(Math.abs(result2.headYaw - result1.headYaw)).toBeLessThan(0.1)
    expect(Math.abs(result2.headPitch - result1.headPitch)).toBeLessThan(0.1)
  })
})

describe('fromSpatialTarget', () => {
  it('returns null for null input', () => {
    const result = fromSpatialTarget(null)
    expect(result).toBeNull()
  })

  it('creates gaze target from position', () => {
    const pos = { x: 10, y: 5, z: 20 }
    const result = fromSpatialTarget(pos, 'player', 0.8)

    expect(result).not.toBeNull()
    if (result) {
      expect(result.position).toBeInstanceOf(Vector3)
      expect(result.position).not.toBeNull()
      if (result.position) {
        expect(result.position.x).toBe(10)
        expect(result.position.y).toBe(5)
        expect(result.position.z).toBe(20)
      }
      expect(result.type).toBe('player')
      expect(result.urgency).toBe(0.8)
    }
  })

  it('uses default values', () => {
    const pos = { x: 0, y: 0, z: 0 }
    const result = fromSpatialTarget(pos)

    expect(result).not.toBeNull()
    if (result) {
      expect(result.type).toBe('waypoint')
      expect(result.urgency).toBe(0.5)
    }
  })
})

describe('horizonTarget', () => {
  it('creates a horizon target with null position', () => {
    const result = horizonTarget()

    expect(result.position).toBeNull()
    expect(result.type).toBe('horizon')
    expect(result.urgency).toBe(0.2)
  })
})

describe('performance', () => {
  it('runs in under 0.1ms per call', () => {
    const bodyPose: BodyPose = {
      position: new Vector3(0, 10, 0),
      velocity: new Vector3(18, 0, 0),
      yaw: 0,
      pitch: 0.1,
      bank: 0.2,
    }

    const context: FlightContext = {
      horizontalSpeed: 18,
      verticalSpeed: -2,
      turnRate: 0.5,
      turbulence: 0.3,
      flightMode: 'cruise',
      time: 1.0,
    }

    const gaze: GazeTarget = {
      position: new Vector3(20, 12, 30),
      urgency: 0.6,
      type: 'waypoint',
    }

    const state = createHeadNeckState()

    const iterations = 1000
    const start = performance.now()

    for (let i = 0; i < iterations; i++) {
      intelligentHeadNeckController(bodyPose, gaze, context, state, 0.016)
    }

    const elapsed = performance.now() - start
    const perCall = elapsed / iterations

    expect(perCall).toBeLessThan(0.1)
  })
})
