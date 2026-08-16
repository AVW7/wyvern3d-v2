/**
 * Phase 5: Wing Turbulence & Load Response
 * 
 * Provides wing micro-adjustments for:
 * 1. Turbulence response (high-frequency flutter)
 * 2. Load adaptation (wing extension during dive)
 * 3. Membrane billow (speed-dependent stretch)
 * 4. Asymmetric response for turns
 */

import { Object3D } from 'three'
import type { FlightLoopState } from '@/render/flightPose'

/**
 * Configuration for wing physics behavior.
 */
export const WING_CONFIG = {
  /** Maximum flutter frequency (Hz) */
  MAX_FLUTTER_FREQ: 7,
  /** Minimum flutter frequency (Hz) */
  MIN_FLUTTER_FREQ: 4,
  /** Maximum flutter amplitude (radians) */
  MAX_FLUTTER_AMP: 0.06,
  /** Minimum flutter amplitude (radians) */
  MIN_FLUTTER_AMP: 0.015,
  /** Speed above which membrane billows (units/s) */
  MEMBRANE_SPEED_THRESHOLD: 15,
  /** Maximum membrane stretch factor */
  MAX_MEMBRANE_STRETCH: 0.08,
  /** Dive angle threshold for wing fold (radians) */
  DIVE_FOLD_THRESHOLD: 0.25, // ~14 degrees
  /** Maximum wing fold during dive */
  MAX_DIVE_FOLD: 0.25,
  /** Speed above which wings fold more */
  HIGH_SPEED_FOLD_THRESHOLD: 40,
  /** Smooth time for wing adjustments */
  SMOOTH_TIME: 0.15,
  /** Wing bone chain weights (proximal to distal) */
  BONE_WEIGHTS: {
    upperArm: 0.1,
    forearm: 0.2,
    hand: 0.3,
    finger1: 0.6,
    finger2: 0.8,
    finger3: 1.0,
  },
} as const

/**
 * Wing controller state for a single wing.
 */
export interface WingState {
  /** Current flutter phase (random offset per wing) */
  flutterPhase: number
  /** Smoothed turbulence level */
  smoothedTurbulence: number
  /** Current fold amount (0-1) */
  foldAmount: number
  /** Smoothed extension for membrane billow */
  smoothedExtension: number
  /** Amplitude multiplier (for variation) */
  amplitudeMult: number
}

/**
 * State for both wings.
 */
export interface WingsState {
  left: WingState
  right: WingState
}

/**
 * Creates a default wing state.
 */
export function createWingState(): WingState {
  return {
    flutterPhase: Math.random() * Math.PI * 2,
    smoothedTurbulence: 0,
    foldAmount: 0,
    smoothedExtension: 0,
    amplitudeMult: 0.8 + Math.random() * 0.4,
  }
}

/**
 * Creates state for both wings.
 */
export function createWingsState(): WingsState {
  return {
    left: createWingState(),
    right: createWingState(),
  }
}

/**
 * Calculates turbulence flutter for wing bones.
 * 
 * @param turbulence - Turbulence intensity (0-1)
 * @param speed - Horizontal speed (units/s)
 * @param time - Current time (seconds)
 * @param phaseOffset - Random phase offset for this wing
 * @returns Flutter angle in radians
 */
export function calculateTurbulenceFlutter(
  turbulence: number,
  speed: number,
  time: number,
  phaseOffset: number,
  amplitudeMult: number
): number {
  if (turbulence < 0.01) return 0
  
  // Frequency scales with turbulence intensity
  const freq = WING_CONFIG.MIN_FLUTTER_FREQ + 
    (WING_CONFIG.MAX_FLUTTER_FREQ - WING_CONFIG.MIN_FLUTTER_FREQ) * turbulence
  
  // Amplitude scales with speed (more stable at high speed)
  const speedFactor = Math.max(0, 1 - (speed / 50))
  const amp = (WING_CONFIG.MIN_FLUTTER_AMP + 
    (WING_CONFIG.MAX_FLUTTER_AMP - WING_CONFIG.MIN_FLUTTER_AMP) * turbulence) *
    speedFactor * amplitudeMult
  
  // Multi-frequency flutter for organic feel
  const primary = Math.sin(time * freq * Math.PI * 2 + phaseOffset) * amp
  const secondary = Math.sin(time * freq * 1.7 * Math.PI * 2 + phaseOffset * 2.3) * amp * 0.3
  const tertiary = Math.sin(time * freq * 2.3 * Math.PI * 2 + phaseOffset * 1.7) * amp * 0.15
  
  return primary + secondary + tertiary
}

/**
 * Calculates wing fold for dive streamlining.
 * 
 * @param pitch - Body pitch angle (negative = nose-down)
 * @param speed - Current speed (units/s)
 * @param flightMode - Current flight mode
 * @returns Fold amount (0-1, where 1 = fully folded)
 */
export function calculateWingFold(
  pitch: number,
  speed: number,
  flightMode: FlightLoopState
): number {
  // Base fold from dive angle
  const diveAngle = Math.abs(Math.min(0, pitch))
  const diveFold = diveAngle > WING_CONFIG.DIVE_FOLD_THRESHOLD
    ? Math.min(1, (diveAngle - WING_CONFIG.DIVE_FOLD_THRESHOLD) * 2)
    : 0
  
  // Additional fold at high speed
  const speedFold = speed > WING_CONFIG.HIGH_SPEED_FOLD_THRESHOLD
    ? Math.min(1, (speed - WING_CONFIG.HIGH_SPEED_FOLD_THRESHOLD) / 20)
    : 0
  
  // Mode-specific adjustments
  let modeFold = 0
  if (flightMode === 'dive') {
    modeFold = 0.4 // Extra fold in dive mode
  } else if (flightMode === 'speed') {
    modeFold = 0.3
  } else if (flightMode === 'hover') {
    modeFold = -0.2 // Wings spread wider in hover
  }
  
  // Combine factors
  const totalFold = diveFold + speedFold + modeFold
  
  // Clamp to valid range (allow slight spread for hover)
  return Math.max(-0.2, Math.min(1, totalFold))
}

/**
 * Calculates membrane billow from speed.
 * 
 * @param speed - Horizontal speed
 * @returns Billow extension (radians)
 */
export function calculateMembraneBillow(speed: number): number {
  if (speed < WING_CONFIG.MEMBRANE_SPEED_THRESHOLD) return 0
  
  const speedExcess = speed - WING_CONFIG.MEMBRANE_SPEED_THRESHOLD
  const maxExcess = 30 - WING_CONFIG.MEMBRANE_SPEED_THRESHOLD
  const ratio = Math.min(1, speedExcess / maxExcess)
  
  return ratio * WING_CONFIG.MAX_MEMBRANE_STRETCH
}

/**
 * Calculates asymmetric wing response for turning.
 * 
 * @param turnRate - Yaw rate (radians/second)
 * @param speed - Current speed
 * @returns Left and right wing asymmetry multipliers
 */
export function calculateTurnAsymmetry(
  turnRate: number,
  speed: number
): { left: number; right: number } {
  // Dead zone for gentle turns
  if (Math.abs(turnRate) < 0.1) {
    return { left: 1, right: 1 }
  }
  
  // Asymmetry scales with turn rate
  const asymmetryAmount = Math.min(0.15, Math.abs(turnRate) * 0.2)
  
  // Speed affects response (more stable at high speed)
  const speedFactor = Math.max(0.5, 1 - (speed / 60))
  const effectiveAsymmetry = asymmetryAmount * speedFactor
  
  // Left turn = left wing extends more (counter-clockwise)
  // Right turn = right wing extends more (clockwise)
  if (turnRate < 0) {
    return {
      left: 1 + effectiveAsymmetry,
      right: 1 - effectiveAsymmetry * 0.5,
    }
  } else {
    return {
      left: 1 - effectiveAsymmetry * 0.5,
      right: 1 + effectiveAsymmetry,
    }
  }
}

/**
 * Applies wing flutter to a bone chain.
 */
function applyWingFlutter(
  bones: Object3D[],
  flutter: number,
  weights: number[]
): void {
  if (bones.length === 0) return
  
  bones.forEach((bone, i) => {
    if (!bone) return
    const weight = weights[i] ?? 1
    // Apply as pitch rotation (local X-axis roll)
    const currentRotation = bone.rotation.x
    bone.rotation.x = currentRotation + flutter * weight * 0.1
  })
}

/**
 * Applies the fold sweep to one wing's bone chain.
 *
 * `mirror` negates Z for the right wing: local +Z sweeps the two wings in
 * opposite directions, so an unmirrored sign folds the left back and the right
 * forward across the chest. Named apart from `wingFold.applyWingFold`, which
 * slerps the whole rig onto the authored gothic fold pose.
 */
function applyFoldSweep(
  bones: Object3D[],
  foldAmount: number,
  weights: number[],
  mirror: boolean
): void {
  if (bones.length === 0 || foldAmount < 0.01) return
  
  const sign = mirror ? -1 : 1
  bones.forEach((bone, i) => {
    if (!bone) return
    const weight = weights[i] ?? 1
    // Fold pulls wing backward and in
    bone.rotation.z += sign * foldAmount * weight * 0.1
  })
}

/**
 * Master wing refinement controller.
 * 
 * @param wingBonesL - Left wing bone chain (shoulder → wingtip)
 * @param wingBonesR - Right wing bone chain (shoulder → wingtip)
 * @param turbulence - Turbulence intensity (0-1)
 * @param pitch - Body pitch (radians)
 * @param turnRate - Yaw rate (radians/second)
 * @param speed - Horizontal speed (units/s)
 * @param flightMode - Current flight mode
 * @param time - Current time (seconds)
 * @param state - Current wing state
 * @param dt - Delta time (seconds)
 * @returns Updated wing state
 */
export function dynamicWingController(
  wingBonesL: Object3D[],
  wingBonesR: Object3D[],
  turbulence: number,
  pitch: number,
  turnRate: number,
  speed: number,
  flightMode: FlightLoopState,
  time: number,
  state: WingsState,
  dt: number
): WingsState {
  // Smooth turbulence
  const turbulenceSmoothFactor = 1 - Math.exp(-dt / WING_CONFIG.SMOOTH_TIME)
  state.left.smoothedTurbulence += (turbulence - state.left.smoothedTurbulence) * turbulenceSmoothFactor
  state.right.smoothedTurbulence = state.left.smoothedTurbulence // Synced
  
  // Calculate flutter for each wing
  const flutterL = calculateTurbulenceFlutter(
    state.left.smoothedTurbulence,
    speed,
    time,
    state.left.flutterPhase,
    state.left.amplitudeMult
  )
  const flutterR = calculateTurbulenceFlutter(
    state.right.smoothedTurbulence,
    speed,
    time,
    state.right.flutterPhase,
    state.right.amplitudeMult
  )
  
  // Calculate fold
  const targetFold = calculateWingFold(pitch, speed, flightMode)
  state.left.foldAmount += (targetFold - state.left.foldAmount) * turbulenceSmoothFactor
  state.right.foldAmount = state.left.foldAmount // Synced
  
  // Calculate membrane billow
  const billow = calculateMembraneBillow(speed)
  state.left.smoothedExtension += (billow - state.left.smoothedExtension) * turbulenceSmoothFactor
  state.right.smoothedExtension = state.left.smoothedExtension // Synced
  
  // Calculate turn asymmetry
  const asymmetry = calculateTurnAsymmetry(turnRate, speed)
  
  // Bone weights (proximal to distal)
  const weights = [0.1, 0.2, 0.35, 0.55, 0.75, 0.9, 1.0]
  
  // Apply to left wing
  if (wingBonesL.length > 0) {
    applyWingFlutter(wingBonesL, flutterL * asymmetry.left, weights)
    applyFoldSweep(wingBonesL, state.left.foldAmount, weights, false)
    // Membrane billow on distal bones only
    for (let i = 3; i < wingBonesL.length; i++) {
      const bone = wingBonesL[i]
      if (bone) {
        bone.rotation.x += state.left.smoothedExtension * (weights[i] ?? 1) * 0.5
      }
    }
  }
  
  // Apply to right wing
  if (wingBonesR.length > 0) {
    applyWingFlutter(wingBonesR, flutterR * asymmetry.right, weights)
    applyFoldSweep(wingBonesR, state.right.foldAmount, weights, true)
    // Membrane billow on distal bones only
    for (let i = 3; i < wingBonesR.length; i++) {
      const bone = wingBonesR[i]
      if (bone) {
        bone.rotation.x += state.right.smoothedExtension * (weights[i] ?? 1) * 0.5
      }
    }
  }
  
  return state
}

/**
 * Gets wing bone names for the left wing.
 */
export function getLeftWingBoneNames(): string[] {
  return [
    'L_WingShoulder',
    'L_WingElbow',
    'L_WingWrist',
    'L_WingFinger1',
    'L_WingFinger2',
    'L_WingFinger3',
    'L_WingFinger3_end',
  ]
}

/**
 * Gets wing bone names for the right wing.
 */
export function getRightWingBoneNames(): string[] {
  return [
    'R_WingShoulder',
    'R_WingElbow',
    'R_WingWrist',
    'R_WingFinger1',
    'R_WingFinger2',
    'R_WingFinger3',
    'R_WingFinger3_end',
  ]
}
