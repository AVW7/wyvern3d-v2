/**
 * Pose Transition System
 * 
 * Provides fluid transitions between flight poses and loopable behavior:
 * 1. Smooth pose blending (current → target)
 * 2. Ease-in/ease-out curves for natural acceleration/deceleration
 * 3. Loop state management for continuous animation cycles
 * 4. Anticipation/overshoot for lively character motion
 */

import type { FlightLoopState } from '@/render/flightPose'
import { mix } from '@/core/math/vec'

/**
 * Easing functions for smooth transitions.
 */
export const Easing = {
  /** Linear interpolation (no easing) */
  linear: (t: number): number => t,
  
  /** Quadratic ease-in (slow start) */
  easeInQuad: (t: number): number => t * t,
  
  /** Quadratic ease-out (slow end) */
  easeOutQuad: (t: number): number => t * (2 - t),
  
  /** Quadratic ease-in-out (slow start and end) */
  easeInOutQuad: (t: number): number => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  
  /** Cubic ease-in (more dramatic slow start) */
  easeInCubic: (t: number): number => t * t * t,
  
  /** Cubic ease-out (more dramatic slow end) */
  easeOutCubic: (t: number): number => (--t) * t * t + 1,
  
  /** Cubic ease-in-out */
  easeInOutCubic: (t: number): number => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  
  /** Elastic ease-out (overshoot with bounce) */
  easeOutElastic: (t: number): number => {
    if (t === 0 || t === 1) return t
    const p = 0.3
    return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1
  },
  
  /** Back ease-out (slight overshoot) */
  easeOutBack: (t: number): number => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  },
} as const

/**
 * Transition configuration for a specific pose change.
 */
export const TRANSITION_CONFIG = {
  /** Default transition duration (seconds) */
  DEFAULT_DURATION: 0.4,
  
  /** Quick transition for mode changes */
  QUICK_DURATION: 0.25,
  
  /** Slow transition for settling */
  SLOW_DURATION: 0.8,
  
  /** Anticipation factor (how much to pull back before moving forward) */
  ANTICIPATION_AMOUNT: 0.15,
  
  /** Overshoot factor for lively motion */
  OVERSHOOT_AMOUNT: 0.08,
  
  /** Blend weight for mixing poses */
  BLEND_WEIGHT: 0.5,
  
  /** Minimum velocity threshold to trigger transitions */
  VELOCITY_THRESHOLD: 0.001,
} as const

/**
 * Describes a transition between two states.
 */
export interface Transition {
  /** Current progress (0-1) */
  progress: number
  /** Total duration in seconds */
  duration: number
  /** Easing function to use */
  easing: keyof typeof Easing
  /** Whether the transition is active */
  active: boolean
  /** Starting value */
  from: number
  /** Target value */
  to: number
  /** Current interpolated value */
  current: number
  /** Velocity for physics-based blending */
  velocity: number
}

/**
 * Multi-channel transition state for full pose blending.
 */
export interface PoseTransitionState {
  /** Per-channel transitions */
  pitch: Transition
  bank: Transition
  neckPitch: Transition
  neckYaw: Transition
  headPitch: Transition
  headYaw: Transition
  headRoll: Transition
  legTuck: Transition
  tailSwing: Transition
  tailLift: Transition
  /** Master time for loop cycling */
  loopTime: number
  /** Current loop cycle count */
  loopCount: number
  /** Target flight mode */
  targetMode: FlightLoopState
  /** Current blend weight */
  blendWeight: number
  /** Queued pose preset to transition to when current finishes */
  queuedPose?: PosePreset
  /** Queued flight mode to transition to when current finishes */
  queuedMode?: FlightLoopState
}

/**
 * Creates a default transition for a single channel.
 */
export function createTransition(
  from: number = 0,
  to: number = 0,
  duration: number = TRANSITION_CONFIG.DEFAULT_DURATION,
  easing: keyof typeof Easing = 'easeInOutQuad'
): Transition {
  return {
    progress: 0,
    duration,
    easing,
    active: false,
    from,
    to,
    current: from,
    velocity: 0,
  }
}

/**
 * Creates the full pose transition state.
 */
export function createPoseTransitionState(): PoseTransitionState {
  const defaultT = () => createTransition()
  return {
    pitch: defaultT(),
    bank: defaultT(),
    neckPitch: defaultT(),
    neckYaw: defaultT(),
    headPitch: defaultT(),
    headYaw: defaultT(),
    headRoll: defaultT(),
    legTuck: defaultT(),
    tailSwing: defaultT(),
    tailLift: defaultT(),
    loopTime: 0,
    loopCount: 0,
    targetMode: 'cruise',
    blendWeight: 0.5,
  }
}

/**
 * Starts a new transition on a channel.
 */
export function startTransition(
  transition: Transition,
  to: number,
  duration?: number,
  easing?: keyof typeof Easing
): Transition {
  return {
    ...transition,
    progress: 0,
    duration: duration ?? transition.duration,
    easing: easing ?? transition.easing,
    active: true,
    from: transition.current, // Start from current position
    to,
    velocity: 0,
  }
}

/**
 * Updates a single transition by delta time.
 */
export function updateTransition(transition: Transition, dt: number): Transition {
  if (!transition.active) return transition
  
  const newProgress = transition.progress + dt / transition.duration
  
  // Check if complete
  if (newProgress >= 1) {
    return {
      ...transition,
      progress: 1,
      active: false,
      current: transition.to,
      velocity: 0,
    }
  }
  
  // Calculate eased value
  const easingFn = Easing[transition.easing]
  const easedProgress = easingFn(newProgress)
  const newCurrent = transition.from + (transition.to - transition.from) * easedProgress
  
  // Calculate velocity (for physics blending)
  const velocity = (newCurrent - transition.current) / Math.max(dt, 0.001)
  
  return {
    ...transition,
    progress: newProgress,
    current: newCurrent,
    velocity,
  }
}

/**
 * Applies anticipation/overshoot to make motion more lively.
 */
export function applyAnticipationOvershoot(
  transition: Transition,
  anticipationAmount: number = TRANSITION_CONFIG.ANTICIPATION_AMOUNT,
  overshootAmount: number = TRANSITION_CONFIG.OVERSHOOT_AMOUNT
): Transition {
  if (!transition.active) return transition
  
  // Add anticipation at start (pull back slightly)
  if (transition.progress < 0.15) {
    const anticipationPhase = transition.progress / 0.15
    const anticipationOffset = -anticipationAmount * Math.sin(anticipationPhase * Math.PI)
    return {
      ...transition,
      current: transition.current + (transition.to - transition.from) * anticipationOffset,
    }
  }
  
  // Add overshoot at end (overshoot target, then settle)
  if (transition.progress > 0.75 && transition.progress < 1) {
    const overshootPhase = (transition.progress - 0.75) / 0.25
    const overshootOffset = overshootAmount * Math.sin(overshootPhase * Math.PI * 2)
    return {
      ...transition,
      current: transition.current + (transition.to - transition.from) * overshootOffset * (1 - transition.progress),
    }
  }
  
  return transition
}

/**
 * Blends two transition states for smooth crossfading.
 */
export function blendTransitions(
  current: Transition,
  target: Transition,
  weight: number
): number {
  return current.current * (1 - weight) + target.current * weight
}

/**
 * Updates the full pose transition state.
 */
export function updatePoseTransition(state: PoseTransitionState, dt: number): PoseTransitionState {
  return {
    ...state,
    pitch: applyAnticipationOvershoot(updateTransition(state.pitch, dt)),
    bank: applyAnticipationOvershoot(updateTransition(state.bank, dt)),
    neckPitch: updateTransition(state.neckPitch, dt),
    neckYaw: updateTransition(state.neckYaw, dt),
    headPitch: updateTransition(state.headPitch, dt),
    headYaw: updateTransition(state.headYaw, dt),
    headRoll: updateTransition(state.headRoll, dt),
    legTuck: updateTransition(state.legTuck, dt),
    tailSwing: updateTransition(state.tailSwing, dt),
    tailLift: updateTransition(state.tailLift, dt),
    loopTime: state.loopTime + dt,
  }
}

/**
 * Gets the current loop phase (0-1) for continuous cycling.
 */
export function getLoopPhase(state: PoseTransitionState, cycleDuration: number): number {
  return (state.loopTime % cycleDuration) / cycleDuration
}

/**
 * Calculates the sine wave value for looping oscillation.
 */
export function oscillate(state: PoseTransitionState, frequency: number, amplitude: number): number {
  return Math.sin(state.loopTime * frequency * Math.PI * 2) * amplitude
}

/**
 * Mode-specific transition settings.
 */
export const MODE_TRANSITIONS: Record<FlightLoopState, { duration: number; easing: keyof typeof Easing }> = {
  cruise: { duration: 0.4, easing: 'easeInOutQuad' },
  scout: { duration: 0.35, easing: 'easeOutBack' },
  speed: { duration: 0.25, easing: 'easeOutCubic' },
  glide: { duration: 0.5, easing: 'easeInOutQuad' },
  dive: { duration: 0.2, easing: 'easeOutCubic' },
  climb: { duration: 0.35, easing: 'easeOutCubic' },
  bankLeft: { duration: 0.3, easing: 'easeOutBack' },
  bankRight: { duration: 0.3, easing: 'easeOutBack' },
  hover: { duration: 0.6, easing: 'easeInOutCubic' },
}

/**
 * Triggers a mode transition with appropriate settings.
 */
export function triggerModeTransition(
  state: PoseTransitionState,
  newMode: FlightLoopState,
  targetPose: {
    pitch: number
    bank: number
    neckPitch: number
    neckYaw: number
    headPitch: number
    headYaw: number
    headRoll: number
    legTuck: number
    tailSwing: number
    tailLift: number
  },
  durationOverride?: number,
): PoseTransitionState {
  const settings = MODE_TRANSITIONS[newMode]
  const duration = durationOverride ?? settings.duration

  return {
    pitch: startTransition(state.pitch, targetPose.pitch, duration, settings.easing),
    bank: startTransition(state.bank, targetPose.bank, duration, settings.easing),
    neckPitch: startTransition(state.neckPitch, targetPose.neckPitch, duration, settings.easing),
    neckYaw: startTransition(state.neckYaw, targetPose.neckYaw, duration, settings.easing),
    headPitch: startTransition(state.headPitch, targetPose.headPitch, duration, settings.easing),
    headYaw: startTransition(state.headYaw, targetPose.headYaw, duration, settings.easing),
    headRoll: startTransition(state.headRoll, targetPose.headRoll, duration, settings.easing),
    legTuck: startTransition(state.legTuck, targetPose.legTuck, duration, settings.easing),
    tailSwing: startTransition(state.tailSwing, targetPose.tailSwing, duration, settings.easing),
    tailLift: startTransition(state.tailLift, targetPose.tailLift, duration, settings.easing),
    loopTime: state.loopTime,
    loopCount: state.loopCount,
    targetMode: newMode,
    blendWeight: state.blendWeight,
  }
}

/**
 * Checks if any transition is currently active.
 */
export function isTransitioning(state: PoseTransitionState): boolean {
  return (
    state.pitch.active ||
    state.bank.active ||
    state.neckPitch.active ||
    state.neckYaw.active ||
    state.headPitch.active ||
    state.headYaw.active ||
    state.headRoll.active ||
    state.legTuck.active ||
    state.tailSwing.active ||
    state.tailLift.active
  )
}

// ============================================================================
// SPRING PHYSICS - More natural motion with bounce and settling
// ============================================================================

/**
 * Spring configuration for physics-based transitions.
 */
export interface SpringConfig {
  /** Spring stiffness (higher = snappier) */
  stiffness: number
  /** Damping ratio (higher = less oscillation) */
  damping: number
  /** Mass (affects inertia) */
  mass: number
  /** Velocity threshold to consider settled */
  settleThreshold: number
}

/**
 * Preset spring configurations for different motion types.
 */
export const SPRING_PRESETS = {
  /** Snappy, responsive motion for combat/actions */
  snappy: { stiffness: 300, damping: 20, mass: 1, settleThreshold: 0.001 },
  /** Smooth, flowing motion for normal flight */
  smooth: { stiffness: 120, damping: 15, mass: 1, settleThreshold: 0.001 },
  /** Heavy, lumbering motion for large creatures */
  heavy: { stiffness: 80, damping: 12, mass: 2, settleThreshold: 0.0005 },
  /** Bouncy, playful motion */
  bouncy: { stiffness: 200, damping: 8, mass: 1, settleThreshold: 0.002 },
  /** Stiff, precise motion for aiming */
  precise: { stiffness: 400, damping: 30, mass: 1, settleThreshold: 0.0005 },
} as const

/**
 * Spring state for physics simulation.
 */
export interface SpringState {
  /** Current position */
  position: number
  /** Current velocity */
  velocity: number
  /** Target position */
  target: number
  /** Whether spring is still moving */
  active: boolean
}

/**
 * Creates a spring state.
 */
export function createSpringState(initialValue: number = 0): SpringState {
  return {
    position: initialValue,
    velocity: 0,
    target: initialValue,
    active: false,
  }
}

/**
 * Updates spring physics by delta time.
 * Uses semi-implicit Euler integration for stability.
 */
export function updateSpring(
  spring: SpringState,
  config: SpringConfig,
  dt: number
): SpringState {
  if (!spring.active && Math.abs(spring.position - spring.target) < config.settleThreshold) {
    return { ...spring, position: spring.target, velocity: 0, active: false }
  }
  
  // Spring force: F = -k * (position - target)
  const displacement = spring.position - spring.target
  const springForce = -config.stiffness * displacement
  
  // Damping force: F = -c * velocity
  const dampingForce = -config.damping * spring.velocity
  
  // Total force and acceleration: F = ma, a = F/m
  const acceleration = (springForce + dampingForce) / config.mass
  
  // Semi-implicit Euler: update velocity first, then position
  const newVelocity = spring.velocity + acceleration * dt
  const newPosition = spring.position + newVelocity * dt
  
  // Check if settled
  const isSettled = 
    Math.abs(newPosition - spring.target) < config.settleThreshold &&
    Math.abs(newVelocity) < config.settleThreshold
  
  return {
    position: isSettled ? spring.target : newPosition,
    velocity: isSettled ? 0 : newVelocity,
    target: spring.target,
    active: !isSettled,
  }
}

/**
 * Sets a new target for the spring.
 */
export function setSpringTarget(spring: SpringState, target: number): SpringState {
  if (spring.target === target && !spring.active) return spring
  return { ...spring, target, active: true }
}

// ============================================================================
// POSE PRESETS - Named poses for quick transitions
// ============================================================================

/**
 * Predefined pose configurations for common flight states.
 */
export interface PosePreset {
  pitch: number
  bank: number
  neckPitch: number
  neckYaw: number
  headPitch: number
  headYaw: number
  headRoll: number
  legTuck: number
  tailSwing: number
  tailLift: number
}

/**
 * Named pose presets for quick transitions.
 */
export const POSE_PRESETS: { [key: string]: PosePreset } = {
  /** Neutral cruise pose */
  cruise: {
    pitch: 0,
    bank: 0,
    neckPitch: 0.1,
    neckYaw: 0,
    headPitch: 0,
    headYaw: 0,
    headRoll: 0,
    legTuck: 0.05,
    tailSwing: 0,
    tailLift: 0,
  },
  /** Attacking dive pose */
  dive: {
    pitch: 0.45,
    bank: 0,
    neckPitch: 0.3,
    neckYaw: 0,
    headPitch: -0.1,
    headYaw: 0,
    headRoll: 0,
    legTuck: 0.25,
    tailSwing: 0,
    tailLift: -0.15,
  },
  /** Hovering pose */
  hover: {
    pitch: -0.15,
    bank: 0,
    neckPitch: 0,
    neckYaw: 0,
    headPitch: 0.15,
    headYaw: 0,
    headRoll: 0,
    legTuck: 0.35,
    tailSwing: 0,
    tailLift: 0.15,
  },
  /** High-speed pursuit */
  speed: {
    pitch: 0.15,
    bank: 0,
    neckPitch: 0.05,
    neckYaw: 0,
    headPitch: -0.05,
    headYaw: 0,
    headRoll: 0,
    legTuck: 0.2,
    tailSwing: 0,
    tailLift: -0.05,
  },
  /** Gliding pose */
  glide: {
    pitch: 0.05,
    bank: 0,
    neckPitch: 0.05,
    neckYaw: 0,
    headPitch: 0,
    headYaw: 0,
    headRoll: 0,
    legTuck: 0.1,
    tailSwing: 0,
    tailLift: 0.05,
  },
  /** Banking left */
  bankLeft: {
    pitch: 0,
    bank: -0.35,
    neckPitch: 0.05,
    neckYaw: 0.1,
    headPitch: 0,
    headYaw: 0.05,
    headRoll: 0.1,
    legTuck: 0.1,
    tailSwing: 0.2,
    tailLift: 0.05,
  },
  /** Banking right */
  bankRight: {
    pitch: 0,
    bank: 0.35,
    neckPitch: 0.05,
    neckYaw: -0.1,
    headPitch: 0,
    headYaw: -0.05,
    headRoll: -0.1,
    legTuck: 0.1,
    tailSwing: -0.2,
    tailLift: 0.05,
  },
  /** Preparing to land */
  landing: {
    pitch: -0.2,
    bank: 0,
    neckPitch: 0.15,
    neckYaw: 0,
    headPitch: 0.2,
    headYaw: 0,
    headRoll: 0,
    legTuck: 0.5,
    tailSwing: 0,
    tailLift: 0.2,
  },
  /** Perched/resting */
  perched: {
    pitch: 0,
    bank: 0,
    neckPitch: 0.2,
    neckYaw: 0,
    headPitch: 0.1,
    headYaw: 0,
    headRoll: 0,
    legTuck: 0.8,
    tailSwing: 0,
    tailLift: 0,
  },
  /** Alert/threat response */
  alert: {
    pitch: 0,
    bank: 0,
    neckPitch: 0.3,
    neckYaw: 0,
    headPitch: 0.15,
    headYaw: 0,
    headRoll: 0,
    legTuck: 0.15,
    tailSwing: 0,
    tailLift: 0.25,
  },
  /** Aggressive stance */
  aggressive: {
    pitch: -0.1,
    bank: 0,
    neckPitch: 0.25,
    neckYaw: 0,
    headPitch: -0.05,
    headYaw: 0,
    headRoll: 0,
    legTuck: 0.2,
    tailSwing: 0,
    tailLift: 0.35,
  },
}

/**
 * Gets a preset by name, returns cruise as default.
 */
export function getPreset(name: string): PosePreset {
  return POSE_PRESETS[name] ?? POSE_PRESETS['cruise']!
}

/**
 * Blends between two presets by weight.
 */
export function blendPresets(a: PosePreset, b: PosePreset, weight: number): PosePreset {
  return {
    pitch: mix(a.pitch, b.pitch, weight),
    bank: mix(a.bank, b.bank, weight),
    neckPitch: mix(a.neckPitch, b.neckPitch, weight),
    neckYaw: mix(a.neckYaw, b.neckYaw, weight),
    headPitch: mix(a.headPitch, b.headPitch, weight),
    headYaw: mix(a.headYaw, b.headYaw, weight),
    headRoll: mix(a.headRoll, b.headRoll, weight),
    legTuck: mix(a.legTuck, b.legTuck, weight),
    tailSwing: mix(a.tailSwing, b.tailSwing, weight),
    tailLift: mix(a.tailLift, b.tailLift, weight),
  }
}

// ============================================================================
// LAYER BLENDING - Partial pose changes
// ============================================================================

/**
 * Blend layer for overriding specific channels.
 */
export interface PoseLayer {
  /** Weight of this layer (0-1) */
  weight: number
  /** Which channels to affect (true = override) */
  mask: {
    pitch: boolean
    bank: boolean
    neckPitch: boolean
    neckYaw: boolean
    headPitch: boolean
    headYaw: boolean
    headRoll: boolean
    legTuck: boolean
    tailSwing: boolean
    tailLift: boolean
  }
  /** The pose values for this layer */
  pose: PosePreset
}

/**
 * Creates a full mask (all channels).
 */
export function fullMask(): PoseLayer['mask'] {
  return {
    pitch: true,
    bank: true,
    neckPitch: true,
    neckYaw: true,
    headPitch: true,
    headYaw: true,
    headRoll: true,
    legTuck: true,
    tailSwing: true,
    tailLift: true,
  }
}

/**
 * Creates an empty mask (no channels).
 */
export function emptyMask(): PoseLayer['mask'] {
  return {
    pitch: false,
    bank: false,
    neckPitch: false,
    neckYaw: false,
    headPitch: false,
    headYaw: false,
    headRoll: false,
    legTuck: false,
    tailSwing: false,
    tailLift: false,
  }
}

/**
 * Creates a mask for specific channels.
 */
export function partialMask(channels: (keyof PoseLayer['mask'])[]): PoseLayer['mask'] {
  const mask = emptyMask()
  for (const channel of channels) {
    mask[channel] = true
  }
  return mask
}

/**
 * Applies layers to a base pose.
 */
export function applyLayers(base: PosePreset, layers: PoseLayer[]): PosePreset {
  const result = { ...base }
  
  for (const layer of layers) {
    const w = layer.weight
    const m = layer.mask
    const p = layer.pose
    
    if (m.pitch) result.pitch = mix(result.pitch, p.pitch, w)
    if (m.bank) result.bank = mix(result.bank, p.bank, w)
    if (m.neckPitch) result.neckPitch = mix(result.neckPitch, p.neckPitch, w)
    if (m.neckYaw) result.neckYaw = mix(result.neckYaw, p.neckYaw, w)
    if (m.headPitch) result.headPitch = mix(result.headPitch, p.headPitch, w)
    if (m.headYaw) result.headYaw = mix(result.headYaw, p.headYaw, w)
    if (m.headRoll) result.headRoll = mix(result.headRoll, p.headRoll, w)
    if (m.legTuck) result.legTuck = mix(result.legTuck, p.legTuck, w)
    if (m.tailSwing) result.tailSwing = mix(result.tailSwing, p.tailSwing, w)
    if (m.tailLift) result.tailLift = mix(result.tailLift, p.tailLift, w)
  }
  
  return result
}

// ============================================================================
// INTERRUPT HANDLING - Responsive transitions
// ============================================================================

/**
 * Interrupts all active transitions and starts new ones.
 * Used for responsive input handling.
 */
export function interruptAndTransition(
  state: PoseTransitionState,
  newPose: PosePreset,
  duration?: number,
  easing?: keyof typeof Easing
): PoseTransitionState {
  const settings = { duration: duration ?? 0.25, easing: easing ?? 'easeOutCubic' }
  
  return {
    pitch: startTransition(state.pitch, newPose.pitch, settings.duration, settings.easing),
    bank: startTransition(state.bank, newPose.bank, settings.duration, settings.easing),
    neckPitch: startTransition(state.neckPitch, newPose.neckPitch, settings.duration, settings.easing),
    neckYaw: startTransition(state.neckYaw, newPose.neckYaw, settings.duration, settings.easing),
    headPitch: startTransition(state.headPitch, newPose.headPitch, settings.duration, settings.easing),
    headYaw: startTransition(state.headYaw, newPose.headYaw, settings.duration, settings.easing),
    headRoll: startTransition(state.headRoll, newPose.headRoll, settings.duration, settings.easing),
    legTuck: startTransition(state.legTuck, newPose.legTuck, settings.duration, settings.easing),
    tailSwing: startTransition(state.tailSwing, newPose.tailSwing, settings.duration, settings.easing),
    tailLift: startTransition(state.tailLift, newPose.tailLift, settings.duration, settings.easing),
    loopTime: state.loopTime,
    loopCount: state.loopCount,
    targetMode: state.targetMode,
    blendWeight: state.blendWeight,
  }
}

/**
 * Queues a transition to happen after current one completes.
 */
export function queueTransition(
  state: PoseTransitionState,
  queuedPose: PosePreset,
  queuedMode?: FlightLoopState
): PoseTransitionState {
  return {
    ...state,
    queuedPose,
    queuedMode,
  } as PoseTransitionState
}

/**
 * Processes any queued transition if current one is complete.
 */
export function processQueuedTransition(
  state: PoseTransitionState
): PoseTransitionState {
  const queuedPose = state.queuedPose
  const queuedMode = state.queuedMode
  
  if (!queuedPose || isTransitioning(state)) return state
  
  const newState = triggerModeTransition(state, queuedMode ?? state.targetMode, queuedPose)
  delete newState.queuedPose
  delete newState.queuedMode
  return newState
}

/**
 * Gets the overall transition progress (0-1).
 */
export function getOverallTransitionProgress(state: PoseTransitionState): number {
  const transitions = [
    state.pitch,
    state.bank,
    state.neckPitch,
    state.neckYaw,
    state.headPitch,
    state.headYaw,
    state.headRoll,
    state.legTuck,
    state.tailSwing,
    state.tailLift,
  ]
  
  const activeTransitions = transitions.filter(t => t.active)
  if (activeTransitions.length === 0) return 1
  
  return activeTransitions.reduce((sum, t) => sum + t.progress, 0) / activeTransitions.length
}
