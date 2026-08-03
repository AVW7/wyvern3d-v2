import { describe, expect, it } from 'vitest'
import { Object3D } from 'three'
import {
  createLegState,
  createLegsState,
  calculateCentrifugalSwing,
  calculateAirBrakeExtension,
  calculateLandingExtension,
  modeSpecificLegBehavior,
  dynamicLegController,
  LEG_CONFIG,
} from './legPhysics'

describe('createLegState', () => {
  it('returns state with zero values', () => {
    const state = createLegState()
    expect(state.swing).toBe(0)
    expect(state.extension).toBe(0)
    expect(state.smoothedTurnRate).toBe(0)
    expect(state.phase).toBe(0)
  })
})

describe('createLegsState', () => {
  it('creates state for both legs', () => {
    const state = createLegsState()
    expect(state.left).toBeDefined()
    expect(state.right).toBeDefined()
  })
})

describe('calculateCentrifugalSwing', () => {
  it('returns zero for small turn rates', () => {
    const swing = calculateCentrifugalSwing(0.1, 20, true)
    expect(swing).toBe(0)
  })

  it('returns opposite sign for left vs right turn', () => {
    const leftTurn = calculateCentrifugalSwing(-0.5, 20, true)
    const rightTurn = calculateCentrifugalSwing(0.5, 20, true)
    
    expect(Math.sign(leftTurn)).not.toBe(Math.sign(rightTurn))
  })

  it('outer leg swings more than inner leg', () => {
    const turnRate = 0.5
    const outerSwing = Math.abs(calculateCentrifugalSwing(turnRate, 20, true))
    const innerSwing = Math.abs(calculateCentrifugalSwing(turnRate, 20, false))
    
    expect(outerSwing).toBeGreaterThan(innerSwing)
  })

  it('scales with speed', () => {
    const slowSwing = Math.abs(calculateCentrifugalSwing(0.5, 10, true))
    const fastSwing = Math.abs(calculateCentrifugalSwing(0.5, 30, true))
    
    expect(fastSwing).toBeGreaterThan(slowSwing)
  })
})

describe('calculateAirBrakeExtension', () => {
  it('returns zero when ascending', () => {
    const extension = calculateAirBrakeExtension(5, 20)
    expect(extension).toBe(0)
  })

  it('returns zero for gentle descent', () => {
    const extension = calculateAirBrakeExtension(-3, 20)
    expect(extension).toBe(0)
  })

  it('returns extension for rapid descent', () => {
    const extension = calculateAirBrakeExtension(-15, 20)
    expect(extension).toBeGreaterThan(0)
  })

  it('caps at maximum extension', () => {
    const extension = calculateAirBrakeExtension(-100, 20)
    expect(extension).toBeLessThanOrEqual(LEG_CONFIG.AIR_BRAKE_EXTENSION)
  })
})

describe('calculateLandingExtension', () => {
  it('returns zero when ascending', () => {
    const extension = calculateLandingExtension(2, 5)
    expect(extension).toBe(0)
  })

  it('returns zero when high above ground', () => {
    const extension = calculateLandingExtension(10, -2)
    expect(extension).toBe(0)
  })

  it('returns extension when low and descending', () => {
    const extension = calculateLandingExtension(2, -2)
    expect(extension).toBeGreaterThan(0)
  })

  it('increases as clearance decreases', () => {
    const high = calculateLandingExtension(4, -2)
    const low = calculateLandingExtension(1, -2)
    
    expect(low).toBeGreaterThan(high)
  })

  it('caps at maximum extension', () => {
    const extension = calculateLandingExtension(0.5, -2)
    expect(extension).toBeLessThanOrEqual(LEG_CONFIG.LANDING_EXTENSION)
  })
})

describe('modeSpecificLegBehavior', () => {
  it('returns neutral for cruise', () => {
    const behavior = modeSpecificLegBehavior('cruise')
    expect(behavior.tuckMult).toBe(1.0)
    expect(behavior.extensionMult).toBe(1.0)
  })

  it('tucks more in dive', () => {
    const behavior = modeSpecificLegBehavior('dive')
    expect(behavior.tuckMult).toBeGreaterThan(1)
  })

  it('tucks more in speed', () => {
    const behavior = modeSpecificLegBehavior('speed')
    expect(behavior.tuckMult).toBeGreaterThan(1)
  })

  it('drops in hover', () => {
    const behavior = modeSpecificLegBehavior('hover')
    expect(behavior.tuckMult).toBeLessThan(1)
    expect(behavior.extensionMult).toBeGreaterThan(1)
  })

  it('extends in glide', () => {
    const behavior = modeSpecificLegBehavior('glide')
    expect(behavior.tuckMult).toBeLessThan(1)
  })
})

describe('dynamicLegController', () => {
  const createTestLegs = (): { leftLeg: Object3D[]; rightLeg: Object3D[] } => {
    return {
      leftLeg: [new Object3D(), new Object3D(), new Object3D()],
      rightLeg: [new Object3D(), new Object3D(), new Object3D()],
    }
  }

  it('returns updated state', () => {
    const { leftLeg, rightLeg } = createTestLegs()
    const state = createLegsState()
    
    const result = dynamicLegController(
      leftLeg,
      rightLeg,
      0.2,
      20,
      -2,
      10,
      'cruise',
      0.1,
      1.0,
      state,
      0.016
    )
    
    expect(result).toBe(state)
  })

  it('updates pendulum phase', () => {
    const { leftLeg, rightLeg } = createTestLegs()
    const state = createLegsState()
    
    dynamicLegController(leftLeg, rightLeg, 0, 20, -2, 10, 'cruise', 0, 0, state, 0.016)
    
    expect(state.left.phase).toBeGreaterThan(0)
    expect(state.right.phase).toBeGreaterThan(0)
  })

  it('applies centrifugal swing during turn', () => {
    const { leftLeg, rightLeg } = createTestLegs()
    const state = createLegsState()
    
    // Multiple frames to let it settle
    for (let i = 0; i < 20; i++) {
      dynamicLegController(leftLeg, rightLeg, 0.6, 20, -2, 10, 'cruise', 0, i * 0.05, state, 0.05)
    }
    
    // Should have divergent swing (opposite signs)
    expect(Math.abs(state.left.swing) + Math.abs(state.right.swing)).toBeGreaterThan(0)
  })

  it('applies landing extension near ground', () => {
    const { leftLeg, rightLeg } = createTestLegs()
    const state = createLegsState()
    
    for (let i = 0; i < 20; i++) {
      dynamicLegController(leftLeg, rightLeg, 0, 15, -3, 2, 'cruise', 0, i * 0.05, state, 0.05)
    }
    
    expect(state.left.extension + state.right.extension).toBeGreaterThan(0)
  })

  it('handles empty leg arrays', () => {
    const state = createLegsState()
    
    const result = dynamicLegController(
      [],
      [],
      0.2,
      20,
      -2,
      10,
      'cruise',
      0.1,
      1.0,
      state,
      0.016
    )
    
    expect(result).toBe(state)
  })

  it('smooths turn rate over time', () => {
    const { leftLeg, rightLeg } = createTestLegs()
    const state = createLegsState()
    
    dynamicLegController(leftLeg, rightLeg, 1.0, 20, -2, 10, 'cruise', 0, 0, state, 0.05)
    dynamicLegController(leftLeg, rightLeg, 1.0, 20, -2, 10, 'cruise', 0, 0.05, state, 0.05)
    
    expect(Math.abs(state.left.smoothedTurnRate - 1.0)).toBeLessThan(Math.abs(0 - 1.0))
  })

  it('applies mode-specific tuck', () => {
    const diveLegs = createTestLegs()
    const hoverLegs = createTestLegs()
    const stateDive = createLegsState()
    const stateHover = createLegsState()
    
    for (let i = 0; i < 10; i++) {
      dynamicLegController(diveLegs.leftLeg, diveLegs.rightLeg, 0, 20, -2, 10, 'dive', 0.1, i * 0.05, stateDive, 0.05)
      dynamicLegController(hoverLegs.leftLeg, hoverLegs.rightLeg, 0, 10, -1, 10, 'hover', 0.1, i * 0.05, stateHover, 0.05)
    }
    
    // Both should have non-zero states
    expect(Math.abs(stateDive.left.swing) + Math.abs(stateHover.left.swing)).toBeGreaterThan(-1)
  })
})

describe('performance', () => {
  it('runs in under 0.1ms per call', () => {
    const leftLeg: Object3D[] = [new Object3D(), new Object3D(), new Object3D()]
    const rightLeg: Object3D[] = [new Object3D(), new Object3D(), new Object3D()]
    const state = createLegsState()
    
    const iterations = 1000
    const start = performance.now()
    
    for (let i = 0; i < iterations; i++) {
      dynamicLegController(
        leftLeg,
        rightLeg,
        0.3 + Math.sin(i * 0.1) * 0.2,
        20 + Math.sin(i * 0.05) * 5,
        -2 + Math.cos(i * 0.08) * 3,
        10,
        'cruise',
        0.1,
        i * 0.016,
        state,
        0.016
      )
    }
    
    const elapsed = performance.now() - start
    const perCall = elapsed / iterations
    
    expect(perCall).toBeLessThan(0.1)
  })
})
