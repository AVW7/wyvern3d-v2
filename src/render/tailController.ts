/**
 * Phase 3: Dynamic Tail Counterweight
 * 
 * Provides physics-based tail behavior that acts as:
 * 1. Active rudder (Newton's 3rd law: bank left → tail swings right)
 * 2. Speed-dependent stiffness (fast = rigid, slow = fluid)
 * 3. Turn anticipation (tail starts moving BEFORE turn)
 * 4. Aggression scaling (higher = wider, more expressive sweeps)
 */

import type { Object3D } from 'three'
import type { FlightLoopState } from '@/render/flightPose'
import { applyBoneOffset } from '@/render/boneOffsets'

/**
 * Configuration for the tail physics controller.
 */
export const TAIL_CONFIG = {
  /** Base oscillation frequency (Hz) - faster at higher speeds */
  BASE_FREQUENCY: 2.5,
  
  /** Amplitude range for lateral swing (radians) */
  MIN_SWING_AMPLITUDE: 0.03,
  MAX_SWING_AMPLITUDE: 0.12,
  
  /** Amplitude range for vertical lift/drop (radians) */
  MIN_VERTICAL_AMPLITUDE: 0.01,
  MAX_VERTICAL_AMPLITUDE: 0.06,
  
  /** Phase delay per bone (0-1, creates wave propagation) */
  PHASE_DELAY_PER_BONE: 0.14,
  
  /** Speed thresholds for stiffness scaling */
  SPEED_FOR_RIGID: 35,  // At this speed, tail is nearly rigid
  SPEED_FOR_FLUID: 8,   // At this speed, tail swings freely
  
  /** Maximum turn rate influence (radians) */
  MAX_TURN_INFLUENCE: 0.25,
  
  /** Counterweight factor: how much tail opposes bank */
  COUNTERWEIGHT_FACTOR: 0.85,
  
  /** Anticipation lead time (normalized 0-1) */
  ANTICIPATION_LEAD: 0.3,
  
  /** Aggression scaling for expressive sweeps */
  MIN_AGRESSION: 0.3,
  MAX_AGRESSION: 1.0,
  
  /** Bank response thresholds */
  BANK_RESPONSE_THRESHOLD: 0.15,
  
  /** Per-bone weights for distributed motion (tail1 to tail6) */
  BONE_WEIGHTS: [0.08, 0.14, 0.20, 0.24, 0.20, 0.14],
  
  /** Mode-specific behavior multipliers */
  DIVE_EXTEND_FACTOR: 1.4,    // Tail extends back during dive
  HOVER_DROP_FACTOR: 0.6,     // Tail drops during hover
  GLIDE_STREAMLINE_FACTOR: 0.7, // More streamlined in glide
  SPEED_STIFFEN_FACTOR: 1.5,  // Extra rigid at speed
} as const

/**
 * Tail controller state passed between frames.
 */
export interface TailState {
  /** Current lateral swing offset (radians) */
  swing: number
  /** Current vertical lift/drop offset (radians) */
  lift: number
  /** Smoothed turn rate for anticipation */
  smoothedTurnRate: number
  /** Smoothed bank for counterweight */
  smoothedBank: number
  /** Phase accumulator for oscillation */
  phase: number
}

/**
 * Creates a default tail state.
 */
export function createTailState(): TailState {
  return {
    swing: 0,
    lift: 0,
    smoothedTurnRate: 0,
    smoothedBank: 0,
    phase: 0,
  }
}

/**
 * Calculates speed-dependent stiffness (0-1, where 1 is most rigid).
 * At high speeds, the tail is nearly locked; at low speeds, it swings freely.
 */
export function calculateStiffness(horizontalSpeed: number): number {
  const { SPEED_FOR_RIGID, SPEED_FOR_FLUID } = TAIL_CONFIG
  
  if (horizontalSpeed >= SPEED_FOR_RIGID) return 0.95
  if (horizontalSpeed <= SPEED_FOR_FLUID) return 0.15
  
  // Linear interpolation between fluid and rigid
  const t = (horizontalSpeed - SPEED_FOR_FLUID) / (SPEED_FOR_RIGID - SPEED_FOR_FLUID)
  return 0.15 + t * 0.80
}

/**
 * Calculates mode-specific behavior modifier.
 * Different flight modes have different tail postures.
 */
export function modeSpecificBehavior(
  flightMode: FlightLoopState,
  _horizontalSpeed: number
): { swingMult: number; liftMult: number } {
  switch (flightMode) {
    case 'dive':
      // Tail extends back for stability, reduced lateral motion
      return {
        swingMult: TAIL_CONFIG.DIVE_EXTEND_FACTOR * 0.6,
        liftMult: -TAIL_CONFIG.DIVE_EXTEND_FACTOR, // Negative = extend back
      }
    case 'hover':
      // Tail drops for balance, more active lateral motion
      return {
        swingMult: 1.2,
        liftMult: TAIL_CONFIG.HOVER_DROP_FACTOR, // Positive = drop
      }
    case 'glide':
      // Streamlined, minimal motion
      return {
        swingMult: TAIL_CONFIG.GLIDE_STREAMLINE_FACTOR,
        liftMult: -TAIL_CONFIG.GLIDE_STREAMLINE_FACTOR * 0.5,
      }
    case 'speed':
      // Rigid, locked back for aerodynamics
      return {
        swingMult: TAIL_CONFIG.SPEED_STIFFEN_FACTOR * 0.3,
        liftMult: -TAIL_CONFIG.SPEED_STIFFEN_FACTOR * 0.4,
      }
    case 'bankLeft':
      // Preparing for left turn, tail swings right (counterweight)
      return {
        swingMult: 1.1,
        liftMult: 0.2,
      }
    case 'bankRight':
      // Preparing for right turn, tail swings left (counterweight)
      return {
        swingMult: 1.1,
        liftMult: 0.2,
      }
    default:
      return { swingMult: 1.0, liftMult: 0.0 }
  }
}

/**
 * Calculates the counterweight response to banking.
 * When body banks left, tail swings right to maintain balance.
 */
export function calculateCounterweightResponse(bank: number): number {
  const { COUNTERWEIGHT_FACTOR, BANK_RESPONSE_THRESHOLD } = TAIL_CONFIG
  
  // Only respond to significant banks
  if (Math.abs(bank) < BANK_RESPONSE_THRESHOLD) return 0
  
  // Opposite direction: positive bank (right) → negative swing (tail left)
  return -bank * COUNTERWEIGHT_FACTOR
}

/**
 * Calculates turn anticipation offset.
 * Tail starts moving BEFORE the body turns.
 */
export function calculateAnticipationOffset(
  turnRate: number,
  smoothedTurnRate: number
): number {
  const { MAX_TURN_INFLUENCE, ANTICIPATION_LEAD } = TAIL_CONFIG
  
  // The "surprise" factor: unexpected turns get more anticipation
  const turnDelta = turnRate - smoothedTurnRate
  const anticipation = turnDelta * ANTICIPATION_LEAD * 2
  
  // Clamp to max influence
  return Math.max(-MAX_TURN_INFLUENCE, Math.min(MAX_TURN_INFLUENCE, anticipation))
}

/**
 * Applies a tail bone offset on the chain's measured local axes.
 *
 * The tail does *not* have its own axis convention. Probed on the rig and used
 * by both authored tail layers, its sagittal lift is local **Z** (`body_response`
 * bobs the tail there; 0.30 rad moves the tip 1.46 up) and its lateral sway is
 * local **Y** (`tail_bend`, the bank counterbalance; 1.77 per 0.30 rad).
 *
 * This used to add straight into `bone.rotation.x` and `.z` and force the Euler
 * order to YXZ, which is the exact failure `render/boneOffsets.ts` was written
 * to fix: it put lift on local X — the axis the rig measures as inert — and
 * sway on local Z, the sagittal one. It also converted the mixer's quaternion to
 * Euler and back every frame, so an authored pose survived only as far as the
 * chosen order allowed.
 */
export function applyTailBoneOffset(
  bone: Object3D,
  pitchOffset: number,
  yawOffset: number
): void {
  applyBoneOffset(bone, pitchOffset, yawOffset)
}

/**
 * Main dynamic tail controller.
 * 
 * Takes tail bones, pelvis reference, flight dynamics, and state,
 * applies physics-based counterweight and anticipation behavior.
 */
export function dynamicTailController(
  tailBones: Object3D[],
  turnRate: number,
  bank: number,
  horizontalSpeed: number,
  flightMode: FlightLoopState,
  aggression: number,
  time: number,
  state: TailState,
  dt: number
): TailState {
  if (tailBones.length === 0) return state
  
  // 1. Calculate speed-dependent stiffness
  const stiffness = calculateStiffness(horizontalSpeed)
  const fluidity = 1 - stiffness
  
  // 2. Smooth inputs for anticipation calculations
  const smoothRate = 0.3
  state.smoothedTurnRate += (turnRate - state.smoothedTurnRate) * smoothRate
  state.smoothedBank += (bank - state.smoothedBank) * smoothRate
  
  // 3. Calculate mode-specific behavior
  const modeBehavior = modeSpecificBehavior(flightMode, horizontalSpeed)
  
  // 4. Calculate counterweight response
  const counterweight = calculateCounterweightResponse(bank) * fluidity
  
  // 5. Calculate turn anticipation
  const anticipation = calculateAnticipationOffset(turnRate, state.smoothedTurnRate) * fluidity
  
  // 6. Calculate oscillation phase
  const frequency = TAIL_CONFIG.BASE_FREQUENCY + (horizontalSpeed / 20) * 0.5
  state.phase += dt * frequency * Math.PI * 2
  
  // 7. Calculate base swing and lift
  // Swing: counterweight + anticipation + oscillation
  const oscillationSwing = Math.sin(state.phase) * TAIL_CONFIG.MIN_SWING_AMPLITUDE * fluidity
  const targetSwing = (
    counterweight +
    anticipation +
    oscillationSwing * (1 + aggression * 0.5)
  ) * modeBehavior.swingMult
  
  // Lift: mode-specific + damping oscillation
  const oscillationLift = Math.cos(state.phase * 0.7) * TAIL_CONFIG.MIN_VERTICAL_AMPLITUDE * fluidity
  const targetLift = (
    modeBehavior.liftMult * 0.1 +
    oscillationLift
  )
  
  // 8. Smooth toward targets
  const dampingRate = 8 * (1 - stiffness * 0.5)
  state.swing += (targetSwing - state.swing) * Math.min(1, dampingRate * dt)
  state.lift += (targetLift - state.lift) * Math.min(1, dampingRate * dt)
  
  // 9. Apply to each bone with wave propagation
  const boneCount = tailBones.length
  for (let i = 0; i < boneCount; i++) {
    const bone = tailBones[i]
    if (!bone) continue
    
    // Wave propagation: each bone lags behind the previous
    const phaseOffset = i * TAIL_CONFIG.PHASE_DELAY_PER_BONE
    const bonePhase = state.phase - phaseOffset * Math.PI * 2
    
    // Weight distribution: inner bones move less, outer bones more
    const weight = TAIL_CONFIG.BONE_WEIGHTS[i] ?? 0.1
    
    // Add wave propagation on top of base motion
    const waveMultiplier = Math.sin(bonePhase) * 0.3
    const pitchOffset = state.lift * weight + waveMultiplier * 0.02
    const yawOffset = state.swing * weight * (1 + waveMultiplier)
    
    applyTailBoneOffset(bone, pitchOffset, yawOffset)
  }
  
  return state
}
