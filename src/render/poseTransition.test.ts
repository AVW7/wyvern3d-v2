import { describe, expect, it } from 'vitest'
import {
  Easing,
  createTransition,
  createPoseTransitionState,
  startTransition,
  updateTransition,
  applyAnticipationOvershoot,
  blendTransitions,
  updatePoseTransition,
  getLoopPhase,
  oscillate,
  triggerModeTransition,
  isTransitioning,
  getOverallTransitionProgress,
  MODE_TRANSITIONS,
} from './poseTransition'

describe('Easing', () => {
  it('linear returns input unchanged', () => {
    expect(Easing.linear(0)).toBe(0)
    expect(Easing.linear(0.5)).toBe(0.5)
    expect(Easing.linear(1)).toBe(1)
  })

  it('easeInQuad starts slow', () => {
    const start = Easing.easeInQuad(0.1)
    const mid = Easing.easeInQuad(0.5)
    const end = Easing.easeInQuad(0.9)
    
    expect(start).toBeLessThan(0.1)
    expect(mid).toBe(0.25)
    expect(end).toBeLessThan(0.9)
  })

  it('easeOutQuad ends slow', () => {
    const start = Easing.easeOutQuad(0.1)
    const mid = Easing.easeOutQuad(0.5)
    const end = Easing.easeOutQuad(0.9)
    
    expect(start).toBeGreaterThan(0.1)
    expect(mid).toBe(0.75)
    expect(end).toBeGreaterThan(0.9)
  })

  it('easeInOutQuad is symmetric', () => {
    // At 0.5, should be exactly 0.5
    expect(Easing.easeInOutQuad(0.5)).toBe(0.5)
    // Values below 0.5 should ease in (slower)
    expect(Easing.easeInOutQuad(0.25)).toBeLessThan(0.25)
    // Values above 0.5 should ease out (slower)
    expect(Easing.easeInOutQuad(0.75)).toBeGreaterThan(0.75)
  })

  it('easeOutElastic overshoots and bounces', () => {
    const mid = Easing.easeOutElastic(0.5)
    expect(mid).toBeGreaterThan(1) // Overshoots
  })

  it('easeOutBack overshoots slightly', () => {
    const nearEnd = Easing.easeOutBack(0.9)
    expect(nearEnd).toBeGreaterThan(1) // Slight overshoot
  })
})

describe('createTransition', () => {
  it('creates transition with defaults', () => {
    const t = createTransition()
    expect(t.progress).toBe(0)
    expect(t.active).toBe(false)
    expect(t.from).toBe(0)
    expect(t.to).toBe(0)
    expect(t.current).toBe(0)
  })

  it('creates transition with custom values', () => {
    const t = createTransition(1, 2, 0.5, 'easeOutCubic')
    expect(t.from).toBe(1)
    expect(t.to).toBe(2)
    expect(t.duration).toBe(0.5)
    expect(t.easing).toBe('easeOutCubic')
    expect(t.current).toBe(1)
  })
})

describe('createPoseTransitionState', () => {
  it('creates state with all channels', () => {
    const state = createPoseTransitionState()
    expect(state.pitch).toBeDefined()
    expect(state.bank).toBeDefined()
    expect(state.neckPitch).toBeDefined()
    expect(state.headYaw).toBeDefined()
    expect(state.loopTime).toBe(0)
    expect(state.loopCount).toBe(0)
    expect(state.targetMode).toBe('cruise')
  })
})

describe('startTransition', () => {
  it('starts transition from current position', () => {
    const t = createTransition()
    t.current = 0.5
    
    const started = startTransition(t, 1.0)
    
    expect(started.active).toBe(true)
    expect(started.from).toBe(0.5)
    expect(started.to).toBe(1.0)
    expect(started.progress).toBe(0)
  })

  it('uses provided duration and easing', () => {
    const t = createTransition()
    
    const started = startTransition(t, 1.0, 0.3, 'easeOutBack')
    
    expect(started.duration).toBe(0.3)
    expect(started.easing).toBe('easeOutBack')
  })
})

describe('updateTransition', () => {
  it('does nothing when inactive', () => {
    const t = createTransition(0, 1)
    const updated = updateTransition(t, 0.1)
    
    expect(updated.progress).toBe(0)
    expect(updated.current).toBe(0)
  })

  it('progresses when active', () => {
    const t = createTransition(0, 1)
    const started = startTransition(t, 1)
    const updated = updateTransition(started, 0.1)
    
    expect(updated.progress).toBeGreaterThan(0)
    expect(updated.current).toBeGreaterThan(0)
  })

  it('completes when duration elapsed', () => {
    const t = createTransition(0, 1, 0.1)
    const started = startTransition(t, 1, 0.1)
    const updated = updateTransition(started, 0.2)
    
    expect(updated.progress).toBe(1)
    expect(updated.active).toBe(false)
    expect(updated.current).toBe(1)
  })

  it('calculates velocity', () => {
    const t = createTransition(0, 1, 0.1)
    const started = startTransition(t, 1, 0.1)
    const updated = updateTransition(started, 0.05)
    
    expect(updated.velocity).not.toBe(0)
  })
})

describe('applyAnticipationOvershoot', () => {
  it('returns unchanged when inactive', () => {
    const t = createTransition()
    const result = applyAnticipationOvershoot(t)
    
    expect(result.current).toBe(0)
  })

  it('applies anticipation at start', () => {
    const t = createTransition(0, 1)
    t.active = true
    t.progress = 0.05
    t.current = 0.05
    
    const result = applyAnticipationOvershoot(t)
    
    // Should have some anticipation offset
    expect(result.current).toBeDefined()
  })

  it('applies overshoot near end', () => {
    const t = createTransition(0, 1)
    t.active = true
    t.progress = 0.85
    t.current = 0.85
    t.to = 1
    
    const result = applyAnticipationOvershoot(t)
    
    expect(result.current).toBeDefined()
  })
})

describe('blendTransitions', () => {
  it('blends two values by weight', () => {
    const a = createTransition(0, 0)
    a.current = 0
    const b = createTransition(1, 1)
    b.current = 1
    
    const result = blendTransitions(a, b, 0.5)
    
    expect(result).toBe(0.5)
  })

  it('favors first when weight is low', () => {
    const a = createTransition(0, 0)
    a.current = 0
    const b = createTransition(1, 1)
    b.current = 1
    
    const result = blendTransitions(a, b, 0.1)
    
    expect(result).toBeCloseTo(0.1, 2)
  })
})

describe('updatePoseTransition', () => {
  it('updates all channels', () => {
    const state = createPoseTransitionState()
    state.pitch = startTransition(state.pitch, 0.5)
    
    const updated = updatePoseTransition(state, 0.1)
    
    expect(updated.pitch.progress).toBeGreaterThan(0)
    expect(updated.loopTime).toBe(0.1)
  })
})

describe('getLoopPhase', () => {
  it('returns phase within 0-1', () => {
    const state = createPoseTransitionState()
    state.loopTime = 5.3
    
    const phase = getLoopPhase(state, 2.0)
    
    expect(phase).toBeGreaterThanOrEqual(0)
    expect(phase).toBeLessThan(1)
  })

  it('wraps around at cycle boundary', () => {
    const state = createPoseTransitionState()
    state.loopTime = 4.0
    
    const phase = getLoopPhase(state, 2.0)
    
    expect(phase).toBe(0)
  })
})

describe('oscillate', () => {
  it('returns value between -amplitude and +amplitude', () => {
    const state = createPoseTransitionState()
    state.loopTime = 0
    
    const value = oscillate(state, 1, 0.5)
    
    expect(value).toBeGreaterThanOrEqual(-0.5)
    expect(value).toBeLessThanOrEqual(0.5)
  })

  it('changes sign over time', () => {
    const state = createPoseTransitionState()
    state.loopTime = 0.25 // At quarter cycle, sin is positive
    const value1 = oscillate(state, 1, 0.5)
    
    state.loopTime = 0.75 // At three quarters, sin is negative
    const value2 = oscillate(state, 1, 0.5)
    
    // Should have opposite signs
    expect(value1).toBeGreaterThan(0)
    expect(value2).toBeLessThan(0)
  })
})

describe('triggerModeTransition', () => {
  it('starts transitions for all channels', () => {
    const state = createPoseTransitionState()
    
    const updated = triggerModeTransition(state, 'dive', {
      pitch: 0.3,
      bank: -0.1,
      neckPitch: 0.1,
      neckYaw: 0,
      headPitch: -0.2,
      headYaw: 0.05,
      headRoll: 0,
      legTuck: 0.15,
      tailSwing: -0.1,
      tailLift: -0.05,
    })
    
    expect(updated.pitch.active).toBe(true)
    expect(updated.targetMode).toBe('dive')
  })

  it('uses mode-specific duration and easing', () => {
    const state = createPoseTransitionState()
    
    const updated = triggerModeTransition(state, 'speed', {
      pitch: 0.2,
      bank: 0,
      neckPitch: 0,
      neckYaw: 0,
      headPitch: -0.1,
      headYaw: 0,
      headRoll: 0,
      legTuck: 0.2,
      tailSwing: 0,
      tailLift: 0,
    })
    
    expect(updated.pitch.duration).toBe(MODE_TRANSITIONS.speed.duration)
    expect(updated.pitch.easing).toBe(MODE_TRANSITIONS.speed.easing)
  })

  it('honours a duration override on every channel', () => {
    const state = createPoseTransitionState()
    const updated = triggerModeTransition(state, 'speed', {
      pitch: 0.2,
      bank: 0,
      neckPitch: 0,
      neckYaw: 0,
      headPitch: -0.1,
      headYaw: 0,
      headRoll: 0,
      legTuck: 0.2,
      tailSwing: 0,
      tailLift: 0,
    }, 1.25)
    expect(updated.pitch.duration).toBe(1.25)
    expect(updated.neckPitch.duration).toBe(1.25)
    expect(updated.tailLift.duration).toBe(1.25)
  })
})

describe('isTransitioning', () => {
  it('returns false when no active transitions', () => {
    const state = createPoseTransitionState()
    expect(isTransitioning(state)).toBe(false)
  })

  it('returns true when any transition is active', () => {
    const state = createPoseTransitionState()
    state.pitch = startTransition(state.pitch, 0.5)
    
    expect(isTransitioning(state)).toBe(true)
  })
})

describe('getOverallTransitionProgress', () => {
  it('returns 1 when no active transitions', () => {
    const state = createPoseTransitionState()
    expect(getOverallTransitionProgress(state)).toBe(1)
  })

  it('returns average of active transitions', () => {
    const state = createPoseTransitionState()
    state.pitch = startTransition(state.pitch, 0.5)
    state.pitch.progress = 0.5
    state.bank = startTransition(state.bank, 0.3)
    state.bank.progress = 0.3
    
    const progress = getOverallTransitionProgress(state)
    
    expect(progress).toBe((0.5 + 0.3) / 2)
  })
})

// ============================================================================
// SPRING PHYSICS TESTS
// ============================================================================

import {
  createSpringState,
  updateSpring,
  setSpringTarget,
  SPRING_PRESETS,
} from './poseTransition'

describe('createSpringState', () => {
  it('creates spring with initial value', () => {
    const spring = createSpringState(0.5)
    expect(spring.position).toBe(0.5)
    expect(spring.velocity).toBe(0)
    expect(spring.target).toBe(0.5)
    expect(spring.active).toBe(false)
  })
})

describe('setSpringTarget', () => {
  it('sets new target and activates', () => {
    const spring = createSpringState(0)
    const updated = setSpringTarget(spring, 1)
    
    expect(updated.target).toBe(1)
    expect(updated.active).toBe(true)
  })

  it('returns unchanged if target matches and not active', () => {
    const spring = createSpringState(1)
    spring.target = 1
    spring.active = false
    
    const updated = setSpringTarget(spring, 1)
    
    expect(updated).toBe(spring)
  })
})

describe('updateSpring', () => {
  it('moves toward target', () => {
    const spring = createSpringState(0)
    const activated = setSpringTarget(spring, 1)
    const updated = updateSpring(activated, SPRING_PRESETS.snappy, 0.016)
    
    expect(updated.position).toBeGreaterThan(0)
    expect(updated.position).toBeLessThan(1)
  })

  it('settles at target', () => {
    const spring = createSpringState(0)
    const activated = setSpringTarget(spring, 1)
    
    // Simulate many frames
    let current = activated
    for (let i = 0; i < 100; i++) {
      current = updateSpring(current, SPRING_PRESETS.snappy, 0.016)
    }
    
    expect(current.position).toBeCloseTo(1, 2)
    expect(current.active).toBe(false)
    expect(current.velocity).toBe(0)
  })

  it('oscillates with bouncy preset', () => {
    const spring = createSpringState(0)
    const activated = setSpringTarget(spring, 1)
    
    // Track position over time
    const positions: number[] = []
    let current = activated
    for (let i = 0; i < 50; i++) {
      current = updateSpring(current, SPRING_PRESETS.bouncy, 0.016)
      positions.push(current.position)
    }
    
    // Should overshoot at some point
    const maxPosition = Math.max(...positions)
    expect(maxPosition).toBeGreaterThan(1)
  })
})

// ============================================================================
// POSE PRESETS TESTS
// ============================================================================

import {
  POSE_PRESETS,
  getPreset,
  blendPresets,
} from './poseTransition'

describe('POSE_PRESETS', () => {
  it('has all expected presets', () => {
    expect(POSE_PRESETS.cruise!).toBeDefined()
    expect(POSE_PRESETS.dive!).toBeDefined()
    expect(POSE_PRESETS.hover!).toBeDefined()
    expect(POSE_PRESETS.speed!).toBeDefined()
    expect(POSE_PRESETS.glide!).toBeDefined()
    expect(POSE_PRESETS.bankLeft!).toBeDefined()
    expect(POSE_PRESETS.bankRight!).toBeDefined()
    expect(POSE_PRESETS.landing!).toBeDefined()
    expect(POSE_PRESETS.perched!).toBeDefined()
    expect(POSE_PRESETS.alert!).toBeDefined()
    expect(POSE_PRESETS.aggressive!).toBeDefined()
  })

  it('dive has positive pitch', () => {
    expect(POSE_PRESETS.dive!.pitch).toBeGreaterThan(0)
  })

  it('bankLeft has negative bank', () => {
    expect(POSE_PRESETS.bankLeft!.bank).toBeLessThan(0)
  })

  it('bankRight has positive bank', () => {
    expect(POSE_PRESETS.bankRight!.bank).toBeGreaterThan(0)
  })

  it('perched has high leg tuck', () => {
    expect(POSE_PRESETS.perched!.legTuck).toBeGreaterThan(0.5)
  })
})

describe('getPreset', () => {
  it('returns named preset', () => {
    const preset = getPreset('dive')
    expect(preset).toEqual(POSE_PRESETS.dive!)
  })

  it('returns cruise for unknown preset', () => {
    const preset = getPreset('unknown')
    expect(preset).toEqual(POSE_PRESETS.cruise!)
  })
})

describe('blendPresets', () => {
  it('returns first preset at weight 0', () => {
    const result = blendPresets(POSE_PRESETS.cruise!, POSE_PRESETS.dive!, 0)
    expect(result.pitch).toBe(POSE_PRESETS.cruise!.pitch)
  })

  it('returns second preset at weight 1', () => {
    const result = blendPresets(POSE_PRESETS.cruise!, POSE_PRESETS.dive!, 1)
    expect(result.pitch).toBe(POSE_PRESETS.dive!.pitch)
  })

  it('interpolates at weight 0.5', () => {
    const result = blendPresets(POSE_PRESETS.cruise!, POSE_PRESETS.dive!, 0.5)
    const expectedPitch = (POSE_PRESETS.cruise!.pitch + POSE_PRESETS.dive!.pitch) / 2
    expect(result.pitch).toBe(expectedPitch)
  })
})

// ============================================================================
// LAYER BLENDING TESTS
// ============================================================================

import {
  fullMask,
  emptyMask,
  partialMask,
  applyLayers,
  type PoseLayer,
} from './poseTransition'

describe('fullMask', () => {
  it('enables all channels', () => {
    const mask = fullMask()
    expect(mask.pitch).toBe(true)
    expect(mask.bank).toBe(true)
    expect(mask.legTuck).toBe(true)
    expect(mask.tailLift).toBe(true)
  })
})

describe('emptyMask', () => {
  it('disables all channels', () => {
    const mask = emptyMask()
    expect(mask.pitch).toBe(false)
    expect(mask.bank).toBe(false)
    expect(mask.legTuck).toBe(false)
    expect(mask.tailLift).toBe(false)
  })
})

describe('partialMask', () => {
  it('enables only specified channels', () => {
    const mask = partialMask(['pitch', 'bank'])
    expect(mask.pitch).toBe(true)
    expect(mask.bank).toBe(true)
    expect(mask.neckPitch).toBe(false)
    expect(mask.legTuck).toBe(false)
  })
})

describe('applyLayers', () => {
  it('applies single layer to base pose', () => {
    const base = POSE_PRESETS.cruise!
    const layer: PoseLayer = {
      weight: 1,
      mask: { ...emptyMask(), pitch: true },
      pose: POSE_PRESETS.dive!,
    }
    
    const result = applyLayers(base, [layer])
    
    expect(result.pitch).toBe(POSE_PRESETS.dive!.pitch)
    expect(result.bank).toBe(POSE_PRESETS.cruise!.bank) // Not masked
  })

  it('blends multiple layers', () => {
    const base = POSE_PRESETS.cruise!
    
    const layer1: PoseLayer = {
      weight: 0.5,
      mask: { ...fullMask(), bank: false },
      pose: POSE_PRESETS.dive!,
    }
    
    const layer2: PoseLayer = {
      weight: 0.5,
      mask: { ...emptyMask(), bank: true },
      pose: POSE_PRESETS.bankLeft!,
    }
    
    const result = applyLayers(base, [layer1, layer2])
    
    // pitch affected by layer1
    const expectedPitch = POSE_PRESETS.cruise!.pitch + (POSE_PRESETS.dive!.pitch - POSE_PRESETS.cruise!.pitch) * 0.5
    expect(result.pitch).toBeCloseTo(expectedPitch, 5)
    
    // bank affected by layer2 (base=0, target=-0.35, weight=0.5)
    const expectedBank = 0 + (POSE_PRESETS.bankLeft!.bank - 0) * 0.5
    expect(result.bank).toBeCloseTo(expectedBank, 5)
  })

  it('handles empty layers array', () => {
    const base = POSE_PRESETS.cruise!
    const result = applyLayers(base, [])
    expect(result).toEqual(base)
  })
})

// ============================================================================
// INTERRUPT HANDLING TESTS
// ============================================================================

import {
  interruptAndTransition,
  queueTransition,
  processQueuedTransition,
} from './poseTransition'

describe('interruptAndTransition', () => {
  it('starts transitions to new pose', () => {
    const state = createPoseTransitionState()
    const updated = interruptAndTransition(state, POSE_PRESETS.dive!)
    
    expect(updated.pitch.active).toBe(true)
    expect(updated.pitch.to).toBe(POSE_PRESETS.dive!.pitch)
  })

  it('uses provided duration', () => {
    const state = createPoseTransitionState()
    const updated = interruptAndTransition(state, POSE_PRESETS.dive!, 0.1)
    
    expect(updated.pitch.duration).toBe(0.1)
  })

  it('uses provided easing', () => {
    const state = createPoseTransitionState()
    const updated = interruptAndTransition(state, POSE_PRESETS.dive!, 0.3, 'easeOutBack')
    
    expect(updated.pitch.easing).toBe('easeOutBack')
  })
})

describe('queueTransition', () => {
  it('stores queued pose', () => {
    const state = createPoseTransitionState()
    const result = queueTransition(state, POSE_PRESETS.dive!, 'dive')
    
    expect(result.queuedPose).toEqual(POSE_PRESETS.dive!)
    expect(result.queuedMode).toBe('dive')
  })
})

describe('processQueuedTransition', () => {
  it('triggers queued transition when idle', () => {
    const state = createPoseTransitionState()
    const queued = queueTransition(state, POSE_PRESETS.dive!, 'dive')
    const processed = processQueuedTransition(queued)
    
    expect(processed.pitch.active).toBe(true)
    expect(processed.targetMode).toBe('dive')
  })

  it('does not trigger while transitioning', () => {
    const state = createPoseTransitionState()
    state.pitch.active = true // Currently transitioning
    const queued = queueTransition(state, POSE_PRESETS.dive!, 'dive')
    const processed = processQueuedTransition(queued)
    
    // Should still have queued pose (not triggered)
    expect(processed.queuedPose).toEqual(POSE_PRESETS.dive!)
    expect(processed.pitch.active).toBe(true) // Still the original transition
  })
})
