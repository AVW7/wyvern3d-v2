/**
 * Phase 4: Weighted Limb Physics
 * 
 * Provides physics-based leg behavior:
 * 1. Pendulum swing during turns (centrifugal force)
 * 2. Air-braking extension (legs out during deceleration)
 * 3. Pre-landing prep (extend at low clearance)
 * 4. Asymmetric response (left/right differ in turns)
 */

import type { Object3D } from 'three'
import type { FlightLoopState } from '@/render/flightPose'
import { applyBoneOffset } from '@/render/boneOffsets'

/**
 * Configuration for the leg physics controller.
 */
export const LEG_CONFIG = {
  /** Base pendulum frequency (Hz) */
  PENDULUM_FREQUENCY: 1.2,
  
  /** Maximum pendulum swing amplitude (radians) */
  MAX_PENDULUM_SWING: 0.25,
  
  /** Turn rate threshold for swing activation */
  TURN_RATE_THRESHOLD: 0.3,
  
  /** Deceleration threshold for air-braking */
  DECEL_THRESHOLD: -8,
  
  /** Air-brake extension factor */
  AIR_BRAKE_EXTENSION: 0.15,
  
  /** Landing prep clearance threshold */
  LANDING_CLEARANCE_THRESHOLD: 5,
  
  /** Maximum landing extension */
  LANDING_EXTENSION: 0.2,
  
  /** Pendulum damping factor */
  DAMPING: 0.7,
  
  /** Asymmetry factor for turns (outer leg swings more) */
  ASYMMETRY_FACTOR: 1.4,
  
  /** Bone weights for thigh/calf/foot chain */
  BONE_WEIGHTS: {
    thigh: 0.4,
    calf: 0.35,
    foot: 0.25,
  },
  
  /** Mode-specific behavior multipliers */
  DIVE_TUCK_FACTOR: 1.3,  // More tucked in dive
  HOVER_DROP_FACTOR: 0.5, // Less tucked in hover
  GLIDE_EXTEND_FACTOR: 0.7, // Slight extension in glide
  SPEED_TUCK_FACTOR: 1.5,  // Maximum tuck at speed
} as const

/**
 * Per-leg state tracking.
 */
export interface LegState {
  /** Current swing angle (radians) */
  swing: number
  /** Current extension angle (radians) */
  extension: number
  /** Smoothed turn rate for anticipation */
  smoothedTurnRate: number
  /** Phase accumulator for pendulum */
  phase: number
}

/**
 * Combined state for both legs.
 */
export interface LegsState {
  left: LegState
  right: LegState
}

/**
 * Creates default leg state.
 */
export function createLegState(): LegState {
  return {
    swing: 0,
    extension: 0,
    smoothedTurnRate: 0,
    phase: 0,
  }
}

/**
 * Creates default state for both legs.
 */
export function createLegsState(): LegsState {
  return {
    left: createLegState(),
    right: createLegState(),
  }
}

/**
 * Calculates centrifugal force effect during turns.
 * The outer leg swings outward more than the inner leg.
 */
export function calculateCentrifugalSwing(
  turnRate: number,
  horizontalSpeed: number,
  isOuterLeg: boolean
): number {
  const { TURN_RATE_THRESHOLD, MAX_PENDULUM_SWING, ASYMMETRY_FACTOR } = LEG_CONFIG
  
  if (Math.abs(turnRate) < TURN_RATE_THRESHOLD) return 0
  
  // Base swing proportional to turn rate and speed
  const turnDirection = Math.sign(turnRate)
  const speedFactor = Math.min(1, horizontalSpeed / 25)
  const baseSwing = turnDirection * MAX_PENDULUM_SWING * speedFactor
  
  // Outer leg swings MORE, inner leg swings LESS
  const asymmetry = isOuterLeg ? ASYMMETRY_FACTOR : 1 / ASYMMETRY_FACTOR
  
  return baseSwing * ((Math.abs(turnRate) / 0.8) * asymmetry)
}

/**
 * Calculates air-braking extension during deceleration.
 * Legs extend outward to increase drag.
 */
export function calculateAirBrakeExtension(
  verticalSpeed: number,
  _horizontalSpeed: number
): number {
  const { DECEL_THRESHOLD, AIR_BRAKE_EXTENSION } = LEG_CONFIG
  
  // Only brake when decelerating significantly
  if (verticalSpeed > 0) return 0 // Going up, not braking
  
  // Strong deceleration (verticalSpeed negative means descending fast)
  const decelMagnitude = Math.abs(verticalSpeed)
  if (decelMagnitude < Math.abs(DECEL_THRESHOLD)) return 0
  
  // Extension proportional to deceleration
  const decelFactor = Math.min(1, (decelMagnitude - Math.abs(DECEL_THRESHOLD)) / 10)
  
  return AIR_BRAKE_EXTENSION * decelFactor
}

/**
 * Calculates landing prep extension based on ground clearance.
 * Legs extend progressively as the wyvern approaches the ground.
 */
export function calculateLandingExtension(
  groundClearance: number,
  verticalSpeed: number
): number {
  const { LANDING_CLEARANCE_THRESHOLD, LANDING_EXTENSION } = LEG_CONFIG
  
  // Only when descending
  if (verticalSpeed >= 0) return 0
  
  // Below threshold, extend linearly
  if (groundClearance >= LANDING_CLEARANCE_THRESHOLD) return 0
  
  const proximityFactor = 1 - (groundClearance / LANDING_CLEARANCE_THRESHOLD)
  
  return LANDING_EXTENSION * Math.max(0, Math.min(1, proximityFactor))
}

/**
 * Calculates mode-specific leg behavior.
 */
export function modeSpecificLegBehavior(
  flightMode: FlightLoopState
): { tuckMult: number; extensionMult: number } {
  switch (flightMode) {
    case 'dive':
      // Tucked tight for streamlining
      return { tuckMult: LEG_CONFIG.DIVE_TUCK_FACTOR, extensionMult: 0.3 }
    case 'hover':
      // Dropped for balance
      return { tuckMult: LEG_CONFIG.HOVER_DROP_FACTOR, extensionMult: 1.2 }
    case 'glide':
      // Slightly extended
      return { tuckMult: LEG_CONFIG.GLIDE_EXTEND_FACTOR, extensionMult: 0.8 }
    case 'speed':
      // Maximum tuck
      return { tuckMult: LEG_CONFIG.SPEED_TUCK_FACTOR, extensionMult: 0.1 }
    default:
      return { tuckMult: 1.0, extensionMult: 1.0 }
  }
}

/**
 * Applies a leg bone offset on the limb's measured local axes.
 *
 * Extension is the sagittal flexion axis, local **Z** — the same
 * `LIMB_FLEX_AXIS` the authoring script's `hind_leg_tuck` uses, where the thigh
 * carries the foot 1.32 forward and up per 0.30 rad. Lateral swing is local
 * **Y**.
 *
 * The previous version put extension on local X and swing on local Z, which is
 * backwards on both counts: local X runs *down* the limb, so it twists rather
 * than folds, and the calf's contribution to foot position there measures
 * exactly 0.000. That is the same defect `hind_leg_pulse` shipped with until a
 * rig probe found it — see `docs/WYVERN_ANIMATION_BASELINE.md`.
 */
export function applyLegBoneOffset(
  bone: Object3D,
  swingOffset: number,
  extensionOffset: number,
  weight: number
): void {
  applyBoneOffset(bone, extensionOffset * weight, swingOffset * weight)
}

/**
 * Main dynamic leg controller.
 * 
 * Takes leg bone chains, flight dynamics, and state,
 * applies physics-based pendulum and extension behavior.
 */
export function dynamicLegController(
  legChainL: Object3D[],
  legChainR: Object3D[],
  turnRate: number,
  horizontalSpeed: number,
  verticalSpeed: number,
  groundClearance: number,
  flightMode: FlightLoopState,
  baseTuck: number,
  time: number,
  state: LegsState,
  dt: number
): LegsState {
  // 1. Update smoothed turn rate for anticipation
  const smoothRate = 0.4
  state.left.smoothedTurnRate += (turnRate - state.left.smoothedTurnRate) * smoothRate
  state.right.smoothedTurnRate += (turnRate - state.right.smoothedTurnRate) * smoothRate
  
  // 2. Update pendulum phase
  const frequency = LEG_CONFIG.PENDULUM_FREQUENCY * (1 + horizontalSpeed / 50)
  state.left.phase += dt * frequency * Math.PI * 2
  state.right.phase = state.left.phase + Math.PI * 0.15 // Slight phase offset
  
  // 3. Calculate mode behavior
  const modeBehavior = modeSpecificLegBehavior(flightMode)
  
  // 4. Calculate per-leg dynamics
  // Positive turnRate = turning right, so left leg is outer
  const isLeftOuter = turnRate > 0
  
  // Left leg
  const leftCentrifugal = calculateCentrifugalSwing(turnRate, horizontalSpeed, isLeftOuter)
  const leftAirBrake = calculateAirBrakeExtension(verticalSpeed, horizontalSpeed)
  const leftLanding = calculateLandingExtension(groundClearance, verticalSpeed)
  
  // Right leg
  const rightCentrifugal = calculateCentrifugalSwing(turnRate, horizontalSpeed, !isLeftOuter)
  const rightAirBrake = leftAirBrake // Symmetric for air-braking
  const rightLanding = leftLanding // Symmetric for landing
  
  // 5. Apply damped pendulum motion
  const pendulumAmplitude = LEG_CONFIG.MAX_PENDULUM_SWING * (1 - LEG_CONFIG.DAMPING * 0.5)
  
  // Target swings include centrifugal + pendulum oscillation
  const leftPendulum = Math.sin(state.left.phase) * pendulumAmplitude
  const rightPendulum = Math.sin(state.right.phase) * pendulumAmplitude
  
  const targetSwingL = (leftCentrifugal + leftPendulum * 0.3) * modeBehavior.extensionMult
  const targetSwingR = (rightCentrifugal + rightPendulum * 0.3) * modeBehavior.extensionMult
  
  // Target extensions
  const targetExtensionL = (leftAirBrake + leftLanding) * modeBehavior.extensionMult
  const targetExtensionR = (rightAirBrake + rightLanding) * modeBehavior.extensionMult
  
  // 6. Smooth toward targets
  const dampingRate = 6
  state.left.swing += (targetSwingL - state.left.swing) * Math.min(1, dampingRate * dt)
  state.left.extension += (targetExtensionL - state.left.extension) * Math.min(1, dampingRate * dt)
  state.right.swing += (targetSwingR - state.right.swing) * Math.min(1, dampingRate * dt)
  state.right.extension += (targetExtensionR - state.right.extension) * Math.min(1, dampingRate * dt)
  
  // 7. Apply to bones
  const applyLegChain = (chain: Object3D[], swing: number, extension: number) => {
    if (chain.length >= 1 && chain[0]) {
      // Thigh
      applyLegBoneOffset(chain[0], swing * 0.6, extension * 0.4 + baseTuck, LEG_CONFIG.BONE_WEIGHTS.thigh)
    }
    if (chain.length >= 2 && chain[1]) {
      // Calf
      applyLegBoneOffset(chain[1], swing * 0.4, extension * 0.3, LEG_CONFIG.BONE_WEIGHTS.calf)
    }
    if (chain.length >= 3 && chain[2]) {
      // Foot
      applyLegBoneOffset(chain[2], swing * 0.2, extension * 0.2, LEG_CONFIG.BONE_WEIGHTS.foot)
    }
  }
  
  applyLegChain(legChainL, state.left.swing, state.left.extension)
  applyLegChain(legChainR, state.right.swing, state.right.extension)
  
  return state
}
