/**
 * Phase 2: Intelligent Head & Neck Controller
 * 
 * Provides anticipatory, stabilized, and mode-aware head/neck tracking
 * for AAA-quality flight animation. This controller replaces the simple
 * reactive head tracking with:
 * 
 * 1. Look-ahead targeting (predicts position 150ms ahead)
 * 2. Urgency-based stiffness (important targets = faster tracking)
 * 3. Turbulence shake compensation
 * 4. Mode-specific behavior (dive = head leads, hover = counter-pitch)
 * 5. Coordinated neck/head cascade (head leads, neck follows)
 */

import { Vector3 } from 'three'
import { clamp, damp } from '@/core/math/vec'
import type { FlightLoopState } from '@/render/flightPose'

// Reusable vectors to avoid allocations in useFrame
const predictedPosition = new Vector3()

/**
 * Gaze target with urgency and type classification.
 * Urgency affects tracking speed; type affects behavior.
 */
export interface GazeTarget {
  /** World-space position to look at */
  position: Vector3 | null
  /** How important this target is (0-1). Higher = faster tracking */
  urgency: number
  /** Target type affects mode-specific behavior */
  type: 'prey' | 'threat' | 'waypoint' | 'horizon' | 'neighbor' | 'player'
}

/**
 * Body pose information needed for head/neck calculations.
 */
export interface BodyPose {
  position: Vector3
  velocity: Vector3
  yaw: number
  pitch: number
  bank: number
}

/**
 * Flight context affecting head/neck behavior.
 */
export interface FlightContext {
  horizontalSpeed: number
  verticalSpeed: number
  turnRate: number
  turbulence: number
  flightMode: FlightLoopState
  time: number
}

/**
 * Current head/neck state passed between frames.
 */
export interface HeadNeckState {
  /** Neck pitch distributed across 3 neck bones */
  neckPitch: number
  /** Neck yaw distributed across 3 neck bones */
  neckYaw: number
  /** Head pitch to align gaze with flight/look direction */
  headPitch: number
  /** Head yaw leading into turns */
  headYaw: number
  /** Head roll compensating steep body bank */
  headRoll: number
  /** Last tracked world-space target (for smoothing) */
  lastTargetWorld: Vector3
  /** Current tracking velocity (for momentum) */
  trackingVelocity: number
}

/**
 * Configuration for the intelligent controller.
 */
export const GAZE_CONFIG = {
  /** Prediction horizon in seconds (150ms look-ahead) */
  PREDICTION_HORIZON: 0.15,
  
  /** Base tracking rates (radians per second) */
  BASE_NECK_RATE: 4.0,
  BASE_HEAD_RATE: 6.0,
  
  /** Maximum tracking rates */
  MAX_NECK_RATE: 10.0,
  MAX_HEAD_RATE: 12.0,
  
  /** Urgency multipliers */
  URGENCY_RATE_MULTIPLIER: 1.5,
  
  /** Turbulence shake frequency and amplitude */
  TURBULENCE_SHAKE_FREQ: 4.5,
  TURBULENCE_SHAKE_AMP: 0.02,
  
  /** Mode-specific head pitch offsets (radians) */
  DIVE_HEAD_PITCH_OFFSET: -0.15,
  HOVER_HEAD_PITCH_OFFSET: 0.08,
  GLIDE_HEAD_PITCH_OFFSET: 0.03,
  SPEED_HEAD_PITCH_OFFSET: 0,
  
  /** Neck cascade weights (head leads, neck follows) */
  NECK_WEIGHTS: [0.25, 0.35, 0.40], // Neck, Neck1, Neck2
  HEAD_LEAD_FACTOR: 1.4,
  
  /** Anatomical limits */
  MAX_HEAD_PITCH: 0.50,   // ~29 degrees up
  MIN_HEAD_PITCH: -0.70,  // ~40 degrees down
  MAX_HEAD_YAW: 0.85,     // ~49 degrees each side
  MAX_HEAD_ROLL: 0.30,    // ~17 degrees
  
  /** Horizon tracking when no target */
  HORIZON_SMOOTHING: 0.5,
  
  /** Counter-bank roll compensation */
  BANK_ROLL_COMPENSATION: 0.40,
  
  /** Minimum tracking distance */
  MIN_TRACKING_DIST: 3.0,
  MAX_TRACKING_DIST: 80.0,
} as const

/**
 * Creates a default head/neck state.
 */
export function createHeadNeckState(): HeadNeckState {
  return {
    neckPitch: 0,
    neckYaw: 0,
    headPitch: 0,
    headYaw: 0,
    headRoll: 0,
    lastTargetWorld: new Vector3(0, 0, 1),
    trackingVelocity: 0,
  }
}

/**
 * Predicts where a target will be PREDICTION_HORIZON seconds from now.
 * Returns the same target if it has no velocity (static position).
 */
export function predictTargetPosition(
  targetPosition: Vector3,
  bodyVelocity: Vector3,
  targetVelocity?: Vector3
): Vector3 {
  if (targetVelocity && targetVelocity.lengthSq() > 0.01) {
    // Moving target: predict its future position
    predictedPosition.copy(targetPosition).addScaledVector(
      targetVelocity,
      GAZE_CONFIG.PREDICTION_HORIZON
    )
    return predictedPosition
  }
  
  // Static target: account for our own motion
  // We'll be somewhere else in 150ms, so look ahead
  predictedPosition.copy(targetPosition)
  predictedPosition.addScaledVector(bodyVelocity, -GAZE_CONFIG.PREDICTION_HORIZON * 0.5)
  return predictedPosition
}

/**
 * Calculates turbulence shake offset for naturalistic motion.
 * High-frequency micro-adjustments proportional to turbulence level.
 */
export function calculateTurbulenceShake(
  turbulence: number,
  time: number
): { pitch: number; yaw: number; roll: number } {
  if (turbulence < 0.1) {
    return { pitch: 0, yaw: 0, roll: 0 }
  }
  
  const amp = GAZE_CONFIG.TURBULENCE_SHAKE_AMP * turbulence
  const freq = GAZE_CONFIG.TURBULENCE_SHAKE_FREQ
  
  return {
    pitch: Math.sin(time * freq * Math.PI * 2) * amp,
    yaw: Math.cos(time * freq * 0.7 * Math.PI * 2) * amp * 0.6,
    roll: Math.sin(time * freq * 0.5 * Math.PI * 2) * amp * 0.3,
  }
}

/**
 * Determines mode-specific head pitch adjustment.
 * Different flight modes have different "head carriage" postures.
 */
export function modeSpecificHeadPitch(flightMode: FlightLoopState): number {
  switch (flightMode) {
    case 'dive':
      // Head leads the dive, aggressive nose-down posture
      return GAZE_CONFIG.DIVE_HEAD_PITCH_OFFSET
    case 'hover':
      // Head counter-pitches, looking around while body stays level
      return GAZE_CONFIG.HOVER_HEAD_PITCH_OFFSET
    case 'glide':
      // Slight nose-up attitude for lift
      return GAZE_CONFIG.GLIDE_HEAD_PITCH_OFFSET
    case 'speed':
      // Streamlined, head tucked slightly
      return GAZE_CONFIG.SPEED_HEAD_PITCH_OFFSET
    default:
      return 0
  }
}

/**
 * Calculates urgency-adjusted tracking rate.
 * Prey/threat targets track faster than waypoints.
 */
export function calculateTrackingRate(
  urgency: number,
  baseRate: number,
  maxRate: number
): number {
  const urgencyBoost = urgency * GAZE_CONFIG.URGENCY_RATE_MULTIPLIER
  return clamp(baseRate + (maxRate - baseRate) * urgencyBoost, baseRate, maxRate)
}

/**
 * Main intelligent head/neck controller.
 * 
 * Takes body pose, gaze target, flight context, and current state,
 * returns updated head/neck pose with anticipation and mode awareness.
 */
export function intelligentHeadNeckController(
  bodyPose: BodyPose,
  primaryGaze: GazeTarget | null,
  flightContext: FlightContext,
  currentState: HeadNeckState,
  dt: number
): HeadNeckState {
  const { position, yaw, pitch: bodyPitch, bank: bodyBank } = bodyPose
  const { turnRate, turbulence, flightMode, time } = flightContext
  
  // 1. Resolve the actual gaze target
  let targetYaw = 0
  let targetPitch = 0
  let effectiveUrgency = 0.3 // Default: relaxed tracking
  
  if (primaryGaze && primaryGaze.position) {
    // Predict where to look
    const predictedTarget = predictTargetPosition(primaryGaze.position, bodyPose.velocity)
    
    // Calculate relative angles from body to target
    const dx = predictedTarget.x - position.x
    const dy = predictedTarget.y - (position.y + 3.5) // Head height offset
    const dz = predictedTarget.z - position.z
    const horizDist = Math.hypot(dx, dz)
    
    // Check tracking distance validity
    const dist3D = Math.hypot(dx, dy, dz)
    if (
      horizDist >= GAZE_CONFIG.MIN_TRACKING_DIST &&
      dist3D <= GAZE_CONFIG.MAX_TRACKING_DIST
    ) {
      // Calculate world-space target yaw
      const worldTargetYaw = Math.atan2(dx, dz)
      
      // Convert to relative yaw from body facing
      targetYaw = worldTargetYaw - yaw
      // Wrap to [-PI, PI]
      targetYaw = Math.atan2(Math.sin(targetYaw), Math.cos(targetYaw))
      
      // Calculate pitch to target
      targetPitch = -Math.atan2(dy, horizDist)
      
      effectiveUrgency = primaryGaze.urgency
      
      // Update last tracked position for smoothing
      currentState.lastTargetWorld.copy(predictedTarget)
    }
  } else {
    // No target: track the horizon (forward direction)
    // Gradually return to forward-facing
    targetYaw = 0
    targetPitch = -bodyPitch * GAZE_CONFIG.HORIZON_SMOOTHING
  }
  
  // 2. Apply mode-specific adjustments
  const modePitch = modeSpecificHeadPitch(flightMode)
  targetPitch += modePitch
  
  // 3. Calculate bank compensation for head roll
  // Head counter-rolls to keep eyes level with horizon during steep banks
  const targetRoll = clamp(
    -bodyBank * GAZE_CONFIG.BANK_ROLL_COMPENSATION,
    -GAZE_CONFIG.MAX_HEAD_ROLL,
    GAZE_CONFIG.MAX_HEAD_ROLL
  )
  
  // 4. Add turbulence shake
  const shake = calculateTurbulenceShake(turbulence, time)
  
  // 5. Calculate urgency-adjusted rates
  const neckRate = calculateTrackingRate(
    effectiveUrgency,
    GAZE_CONFIG.BASE_NECK_RATE,
    GAZE_CONFIG.MAX_NECK_RATE
  )
  const headRate = calculateTrackingRate(
    effectiveUrgency,
    GAZE_CONFIG.BASE_HEAD_RATE,
    GAZE_CONFIG.MAX_HEAD_RATE
  )
  
  // 6. Apply turn-rate-based yaw lead
  // Head anticipates turns, looking into the direction we're turning
  const turnLead = clamp(-turnRate * 0.25, -0.4, 0.4)
  targetYaw += turnLead * 0.6 // 60% of turn lead goes to head
  
  // 7. Apply anatomic limits
  targetPitch = clamp(targetPitch, GAZE_CONFIG.MIN_HEAD_PITCH, GAZE_CONFIG.MAX_HEAD_PITCH)
  targetYaw = clamp(targetYaw, -GAZE_CONFIG.MAX_HEAD_YAW, GAZE_CONFIG.MAX_HEAD_YAW)
  
  // 8. Smooth damp to targets
  const newHeadYaw = damp(currentState.headYaw, targetYaw + shake.yaw, headRate, dt)
  const newHeadPitch = damp(currentState.headPitch, targetPitch + shake.pitch, headRate, dt)
  const newHeadRoll = damp(currentState.headRoll, targetRoll + shake.roll, headRate * 0.8, dt)
  
  // 9. Distribute neck angles (head leads, neck follows with cascade)
  // Turn lead for neck is smaller proportion
  const neckTurnLead = turnLead * 0.4
  const targetNeckYaw = (targetYaw + neckTurnLead) * 0.7
  const targetNeckPitch = targetPitch * 0.6
  
  const newNeckYaw = damp(currentState.neckYaw, targetNeckYaw, neckRate, dt)
  const newNeckPitch = damp(currentState.neckPitch, targetNeckPitch, neckRate, dt)
  
  // 10. Update tracking velocity metric
  const yawDelta = Math.abs(newHeadYaw - currentState.headYaw)
  const pitchDelta = Math.abs(newHeadPitch - currentState.headPitch)
  currentState.trackingVelocity = (yawDelta + pitchDelta) / Math.max(dt, 0.001)
  
  return {
    neckPitch: newNeckPitch,
    neckYaw: newNeckYaw,
    headPitch: newHeadPitch,
    headYaw: newHeadYaw,
    headRoll: newHeadRoll,
    lastTargetWorld: currentState.lastTargetWorld,
    trackingVelocity: currentState.trackingVelocity,
  }
}

/**
 * Converts a spatial awareness gaze target to the controller format.
 * Helper for integration with existing codebase.
 */
export function fromSpatialTarget(
  targetPos: { x: number; y: number; z: number } | null,
  type: GazeTarget['type'] = 'waypoint',
  urgency = 0.5
): GazeTarget | null {
  if (!targetPos) return null
  return {
    position: new Vector3(targetPos.x, targetPos.y, targetPos.z),
    urgency,
    type,
  }
}

/**
 * Creates a horizon gaze target (look forward).
 */
export function horizonTarget(): GazeTarget {
  return {
    position: null,
    urgency: 0.2,
    type: 'horizon',
  }
}
