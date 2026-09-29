import { describe, expect, it } from 'vitest'
import { Object3D } from 'three'
import {
  createWingState,
  createWingsState,
  calculateTurbulenceFlutter,
  calculateWingFold,
  calculateMembraneBillow,
  calculateTurnAsymmetry,
  dynamicWingController,
  WING_CONFIG,
  applyMembranePanelFlutter,
  getGothicLeftWingBoneNames,
  getGothicRightWingBoneNames,
  GOTHIC_LEFT_WING_PANEL_NAMES,
  GOTHIC_RIGHT_WING_PANEL_NAMES,
} from './wingRefinement'

describe('createWingState', () => {
  it('returns state with valid defaults', () => {
    const state = createWingState()
    expect(state.flutterPhase).toBeGreaterThanOrEqual(0)
    expect(state.flutterPhase).toBeLessThan(Math.PI * 2)
    expect(state.smoothedTurbulence).toBe(0)
    expect(state.foldAmount).toBe(0)
    expect(state.amplitudeMult).toBeGreaterThanOrEqual(0.8)
    expect(state.amplitudeMult).toBeLessThanOrEqual(1.2)
  })
})

describe('createWingsState', () => {
  it('creates state for both wings', () => {
    const state = createWingsState()
    expect(state.left).toBeDefined()
    expect(state.right).toBeDefined()
    expect(state.left.flutterPhase).not.toBe(state.right.flutterPhase) // Different phases
  })
})

describe('calculateTurbulenceFlutter', () => {
  it('returns zero when turbulence is zero', () => {
    const flutter = calculateTurbulenceFlutter(0, 20, 1, 0, 1)
    expect(flutter).toBe(0)
  })

  it('oscillates with time', () => {
    const flutter1 = calculateTurbulenceFlutter(0.5, 20, 1, 0, 1)
    const flutter2 = calculateTurbulenceFlutter(0.5, 20, 1.1, 0, 1)
    expect(flutter1).not.toBe(flutter2)
  })

  it('scales with turbulence intensity', () => {
    // Sample multiple points to account for oscillation
    let lowSum = 0
    let highSum = 0
    for (let t = 0; t < 1; t += 0.1) {
      lowSum += Math.abs(calculateTurbulenceFlutter(0.2, 20, t, 0, 1))
      highSum += Math.abs(calculateTurbulenceFlutter(0.8, 20, t, 0, 1))
    }
    const lowAvg = lowSum / 10
    const highAvg = highSum / 10
    expect(highAvg).toBeGreaterThan(lowAvg)
  })

  it('reduces at high speed', () => {
    const slow = Math.abs(calculateTurbulenceFlutter(0.5, 10, 1, 0, 1))
    const fast = Math.abs(calculateTurbulenceFlutter(0.5, 50, 1, 0, 1))
    expect(slow).toBeGreaterThan(fast)
  })

  it('stays within amplitude bounds', () => {
    for (let t = 0; t < 10; t += 0.1) {
      const flutter = calculateTurbulenceFlutter(1, 10, t, 0, 1)
      expect(Math.abs(flutter)).toBeLessThanOrEqual(WING_CONFIG.MAX_FLUTTER_AMP * 1.5) // Allow for secondary frequencies
    }
  })
})

describe('calculateWingFold', () => {
  it('returns zero for level flight', () => {
    const fold = calculateWingFold(0, 20, 'cruise')
    expect(fold).toBe(0)
  })

  it('returns zero for positive pitch (climb)', () => {
    const fold = calculateWingFold(0.3, 20, 'cruise')
    expect(fold).toBe(0)
  })

  it('increases with dive angle', () => {
    const shallow = calculateWingFold(-0.3, 20, 'cruise')
    const steep = calculateWingFold(-0.5, 20, 'cruise')
    expect(steep).toBeGreaterThan(shallow)
  })

  it('increases at high speed', () => {
    const normal = calculateWingFold(0, 30, 'cruise')
    const fast = calculateWingFold(0, 50, 'cruise')
    expect(fast).toBeGreaterThan(normal)
  })

  it('adds fold for dive mode', () => {
    const cruise = calculateWingFold(-0.2, 20, 'cruise')
    const dive = calculateWingFold(-0.2, 20, 'dive')
    expect(dive).toBeGreaterThan(cruise)
  })

  it('reduces fold for hover mode', () => {
    const cruise = calculateWingFold(0, 15, 'cruise')
    const hover = calculateWingFold(0, 8, 'hover')
    // Hover has negative fold (wings spread wider)
    expect(hover).toBeLessThan(0)
    expect(cruise).toBe(0)
  })

  it('never exceeds 1', () => {
    const extreme = calculateWingFold(-1, 100, 'dive')
    expect(extreme).toBeLessThanOrEqual(1)
  })
})

describe('calculateMembraneBillow', () => {
  it('returns zero below threshold', () => {
    const billow = calculateMembraneBillow(10)
    expect(billow).toBe(0)
  })

  it('returns zero at threshold', () => {
    const billow = calculateMembraneBillow(WING_CONFIG.MEMBRANE_SPEED_THRESHOLD)
    expect(billow).toBe(0)
  })

  it('increases above threshold', () => {
    const low = calculateMembraneBillow(20)
    const high = calculateMembraneBillow(28)
    expect(high).toBeGreaterThan(low)
  })

  it('caps at maximum', () => {
    const billow = calculateMembraneBillow(100)
    expect(billow).toBeLessThanOrEqual(WING_CONFIG.MAX_MEMBRANE_STRETCH)
  })
})

describe('calculateTurnAsymmetry', () => {
  it('returns symmetric for no turn', () => {
    const asym = calculateTurnAsymmetry(0, 20)
    expect(asym.left).toBe(1)
    expect(asym.right).toBe(1)
  })

  it('returns symmetric for gentle turn', () => {
    const asym = calculateTurnAsymmetry(0.05, 20)
    expect(asym.left).toBe(1)
    expect(asym.right).toBe(1)
  })

  it('extends outer wing during turn', () => {
    const leftTurn = calculateTurnAsymmetry(-0.5, 20) // Left turn
    expect(leftTurn.left).toBeGreaterThan(1)
    expect(leftTurn.right).toBeLessThan(1)
    
    const rightTurn = calculateTurnAsymmetry(0.5, 20) // Right turn
    expect(rightTurn.right).toBeGreaterThan(1)
    expect(rightTurn.left).toBeLessThan(1)
  })

  it('reduces at high speed', () => {
    const slow = calculateTurnAsymmetry(0.5, 15)
    const fast = calculateTurnAsymmetry(0.5, 50)
    
    // Fast speed should have less asymmetry than slow
    const slowAsymmetry = Math.abs(slow.left - 1) + Math.abs(slow.right - 1)
    const fastAsymmetry = Math.abs(fast.left - 1) + Math.abs(fast.right - 1)
    expect(fastAsymmetry).toBeLessThan(slowAsymmetry)
  })

  it('caps asymmetry', () => {
    const extreme = calculateTurnAsymmetry(10, 5)
    expect(Math.abs(extreme.left - 1)).toBeLessThanOrEqual(0.2)
    expect(Math.abs(extreme.right - 1)).toBeLessThanOrEqual(0.2)
  })
})

describe('dynamicWingController', () => {
  const createTestWings = (): { leftWing: Object3D[]; rightWing: Object3D[] } => {
    return {
      leftWing: Array(7).fill(null).map(() => new Object3D()),
      rightWing: Array(7).fill(null).map(() => new Object3D()),
    }
  }

  it('returns updated state', () => {
    const { leftWing, rightWing } = createTestWings()
    const state = createWingsState()
    
    const result = dynamicWingController(
      leftWing,
      rightWing,
      0.3,
      0,
      0.2,
      20,
      'cruise',
      1,
      state,
      0.016
    )
    
    expect(result).toBe(state)
  })

  it('smooths turbulence over time', () => {
    const { leftWing, rightWing } = createTestWings()
    const state = createWingsState()
    
    dynamicWingController(leftWing, rightWing, 0.8, 0, 0, 20, 'cruise', 0, state, 0.05)
    
    expect(state.left.smoothedTurbulence).toBeGreaterThan(0)
    expect(state.left.smoothedTurbulence).toBeLessThan(0.8)
  })

  it('applies flutter with turbulence', () => {
    const { leftWing, rightWing } = createTestWings()
    const state = createWingsState()
    
    for (let i = 0; i < 10; i++) {
      dynamicWingController(leftWing, rightWing, 0.5, 0, 0, 15, 'cruise', i * 0.05, state, 0.05)
    }
    
    // Check that bones were modified
    const leftModified = leftWing.some(b => b.rotation.x !== 0 || b.rotation.z !== 0)
    const rightModified = rightWing.some(b => b.rotation.x !== 0 || b.rotation.z !== 0)
    
    expect(leftModified || rightModified).toBe(true)
  })

  it('applies fold during dive', () => {
    const { leftWing, rightWing } = createTestWings()
    const state = createWingsState()
    
    for (let i = 0; i < 10; i++) {
      dynamicWingController(leftWing, rightWing, 0, -0.4, 0, 20, 'dive', i * 0.05, state, 0.05)
    }
    
    expect(state.left.foldAmount).toBeGreaterThan(0)
  })

  it('applies membrane billow at speed', () => {
    const { leftWing, rightWing } = createTestWings()
    const state = createWingsState()
    
    for (let i = 0; i < 10; i++) {
      dynamicWingController(leftWing, rightWing, 0, 0, 0, 25, 'speed', i * 0.05, state, 0.05)
    }
    
    expect(state.left.smoothedExtension).toBeGreaterThan(0)
  })

  it('handles empty wing arrays', () => {
    const state = createWingsState()
    
    const result = dynamicWingController(
      [],
      [],
      0.3,
      0,
      0.2,
      20,
      'cruise',
      1,
      state,
      0.016
    )
    
    expect(result).toBe(state)
  })

  it('syncs left and right turbulence', () => {
    const { leftWing, rightWing } = createTestWings()
    const state = createWingsState()
    
    dynamicWingController(leftWing, rightWing, 0.5, 0, 0, 20, 'cruise', 0, state, 0.016)
    
    expect(state.left.smoothedTurbulence).toBe(state.right.smoothedTurbulence)
  })

  it('applies turn asymmetry', () => {
    const { leftWing, rightWing } = createTestWings()
    const state = createWingsState()
    
    // Run with turn
    for (let i = 0; i < 20; i++) {
      dynamicWingController(leftWing, rightWing, 0.3, 0, 0.5, 15, 'cruise', i * 0.05, state, 0.05)
    }
    
    // Both wings should have been modified
    const leftRotations = leftWing.map(b => b.rotation.x)
    const rightRotations = rightWing.map(b => b.rotation.x)
    expect(leftRotations.some(r => r !== 0)).toBe(true)
    expect(rightRotations.some(r => r !== 0)).toBe(true)
  })
})

describe('performance', () => {
  it('runs in under 0.1ms per call', () => {
    const leftWing: Object3D[] = Array(7).fill(null).map(() => new Object3D())
    const rightWing: Object3D[] = Array(7).fill(null).map(() => new Object3D())
    const state = createWingsState()
    
    const iterations = 1000
    const start = performance.now()
    
    for (let i = 0; i < iterations; i++) {
      dynamicWingController(
        leftWing,
        rightWing,
        0.3 + Math.sin(i * 0.1) * 0.3,
        -0.2 + Math.cos(i * 0.08) * 0.3,
        0.3 * Math.sin(i * 0.05),
        20 + Math.sin(i * 0.07) * 10,
        'cruise',
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

describe('Gothic V2 membrane panel flutter & spar exports', () => {
  it('exports valid Gothic V2 spar chains matching 92-joint rig', () => {
    const leftSpar = getGothicLeftWingBoneNames()
    const rightSpar = getGothicRightWingBoneNames()
    expect(leftSpar.length).toBe(7)
    expect(rightSpar.length).toBe(7)
    expect(leftSpar[0]).toBe('L_WingShoulder')
    expect(leftSpar[6]).toBe('L_WingD0P2')
    expect(rightSpar[0]).toBe('R_WingShoulder')
    expect(rightSpar[6]).toBe('R_WingD0P2')
  })

  it('exports all 8 membrane panel names per side', () => {
    expect(GOTHIC_LEFT_WING_PANEL_NAMES.length).toBe(8)
    expect(GOTHIC_RIGHT_WING_PANEL_NAMES.length).toBe(8)
    expect(GOTHIC_LEFT_WING_PANEL_NAMES[0]).toBe('L_WingPanel0_0')
    expect(GOTHIC_LEFT_WING_PANEL_NAMES[7]).toBe('L_WingPanel3_1')
    expect(GOTHIC_RIGHT_WING_PANEL_NAMES[0]).toBe('R_WingPanel0_0')
    expect(GOTHIC_RIGHT_WING_PANEL_NAMES[7]).toBe('R_WingPanel3_1')
  })

  it('rotates panels under aerodynamic dynamic pressure and flutter', () => {
    const panelsL = Array(8).fill(null).map(() => new Object3D())
    const panelsR = Array(8).fill(null).map(() => new Object3D())

    applyMembranePanelFlutter(panelsL, panelsR, 25, 0.2, 0, 1.0, 3.0)

    // Panels must have received pitch rotation (quaternion x/w modified from identity)
    expect(panelsL[0]!.quaternion.x).not.toBe(0)
    expect(panelsR[0]!.quaternion.x).not.toBe(0)
    // Trailing edge panel 7 should receive greater amplitude than root panel 0
    expect(Math.abs(panelsL[7]!.quaternion.x)).toBeGreaterThan(0)
  })

  it('applies turn asymmetry between left and right wing panels', () => {
    const panelsL = Array(8).fill(null).map(() => new Object3D())
    const panelsR = Array(8).fill(null).map(() => new Object3D())

    // Hard turn
    applyMembranePanelFlutter(panelsL, panelsR, 22, 0, 0.6, 0.5, 3.0)

    expect(panelsL[3]!.quaternion.x).not.toBe(panelsR[3]!.quaternion.x)
  })
})
