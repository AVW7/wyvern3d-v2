/**
 * Phase 6: Master Flight Physics Coordinator
 * 
 * Provides unified control over all flight animation systems:
 * - Spine wave propagation
 * - Head/neck intelligent tracking
 * - Dynamic tail counterweight
 * - Weighted limb physics
 * - Wing turbulence & load response
 * - Pose transitions and living oscillation
 * 
 * This is the single entry point for all procedural flight animation.
 */

import { Object3D, Vector3 } from 'three'
import {
  HEAD_BONE,
  LEFT_LEG_CHAIN,
  LEFT_WING_CHAIN,
  NECK_CHAIN,
  RIGHT_LEG_CHAIN,
  RIGHT_WING_CHAIN,
  SPINE_CHAIN,
  TAIL_CHAIN,
  findBone,
  findChain,
} from './rigBones'
import { propagateFullBodyWave } from './spineWave'
import {
  intelligentHeadNeckController,
  createHeadNeckState,
  type HeadNeckState,
} from './gazeController'
import {
  dynamicTailController,
  createTailState,
  type TailState,
} from './tailController'
import {
  dynamicLegController,
  createLegsState,
  type LegsState,
} from './legPhysics'
import {
  dynamicWingController,
  createWingsState,
  type WingsState,
} from './wingRefinement'
import {
  createPoseTransitionState,
  updatePoseTransition,
  oscillate,
  isTransitioning,
  type PoseTransitionState,
} from './poseTransition'
import type { FlightLoopState } from './flightPose'

/**
 * Configuration for the master coordinator.
 */
export const COORDINATOR_CONFIG = {
  /** Minimum time between system updates (for performance capping) */
  MIN_DT: 0.008, // ~120fps cap
  /** Maximum time between updates (for stability) */
  MAX_DT: 0.05, // ~20fps minimum
  /** Turbulence threshold for wing response */
  TURBULENCE_ALTITUDE_CHANGE: 3,
  /** Default gaze target distance (ahead of the wyvern) */
  DEFAULT_GAZE_DISTANCE: 50,
} as const

/**
 * Bone references for all animated systems.
 */
export interface SkeletonRefs {
  /** Spine bones (root to tip, excluding neck) */
  spineBones: Object3D[]
  /** Neck bones (base to head) */
  neckBones: Object3D[]
  /** Head bone */
  headBone: Object3D | null
  /** Tail bones (base to tip) */
  tailBones: Object3D[]
  /** Left leg bones (thigh to foot) */
  leftLegBones: Object3D[]
  /** Right leg bones (thigh to foot) */
  rightLegBones: Object3D[]
  /** Left wing bones (shoulder to tip) */
  leftWingBones: Object3D[]
  /** Right wing bones (shoulder to tip) */
  rightWingBones: Object3D[]
}

/**
 * Flight physics inputs from flight simulation.
 */
export interface FlightPhysicsInput {
  /** Body position (world space) */
  position: { x: number; y: number; z: number }
  /** Body velocity (units/second) */
  velocity: { x: number; y: number; z: number }
  /** Body pitch angle (radians, positive = nose up) */
  pitch: number
  /** Body bank angle (radians, positive = right wing down) */
  bank: number
  /** Body yaw angle (radians) */
  yaw: number
  /** Yaw rate (radians/second) */
  yawRate: number
  /** Horizontal speed (units/second) */
  horizontalSpeed: number
  /** Vertical speed (units/second, positive = climbing) */
  verticalSpeed: number
  /** Current altitude (units) */
  altitude: number
  /** Ground clearance (units, for landing prep) */
  groundClearance: number
  /** Flight mode/state */
  flightMode: FlightLoopState
  /** Gaze target position (world space, optional) */
  gazeTarget?: { x: number; y: number; z: number } | null
  /** External turbulence intensity (0-1) */
  turbulenceIntensity?: number
}

/**
 * Combined state for all animation systems.
 */
export interface FlightAnimationState {
  headNeck: HeadNeckState
  tail: TailState
  legs: LegsState
  wings: WingsState
  poseTransition: PoseTransitionState
  /** Current animation time */
  time: number
  /** Last update time (for dt calculation) */
  lastTime: number
  /** Smoothed turbulence level */
  smoothedTurbulence: number
}

/**
 * Creates default animation state.
 */
export function createFlightAnimationState(): FlightAnimationState {
  return {
    headNeck: createHeadNeckState(),
    tail: createTailState(),
    legs: createLegsState(),
    wings: createWingsState(),
    poseTransition: createPoseTransitionState(),
    time: 0,
    lastTime: 0,
    smoothedTurbulence: 0,
  }
}

/**
 * Detects if currently transitioning between flight modes.
 */
export function detectTransition(
  current: FlightLoopState,
  previous: FlightLoopState | null
): boolean {
  return current !== previous
}

/**
 * Calculates turbulence from flight conditions.
 */
function calculateTurbulence(
  verticalSpeed: number,
  yawRate: number,
  altitude: number,
  externalTurbulence: number,
  state: FlightAnimationState,
  dt: number
): number {
  // Turbulence from altitude changes
  const altitudeTurbulence = Math.abs(verticalSpeed) > COORDINATOR_CONFIG.TURBULENCE_ALTITUDE_CHANGE
    ? 0.3 * Math.min(1, Math.abs(verticalSpeed) / 15)
    : 0
  
  // Turbulence from sharp turns
  const turnTurbulence = Math.abs(yawRate) > 0.4
    ? 0.25 * Math.min(1, Math.abs(yawRate))
    : 0
  
  // Combine with external turbulence
  const targetTurbulence = Math.max(
    externalTurbulence,
    altitudeTurbulence + turnTurbulence
  )
  
  // Smooth the turbulence over time
  const smoothFactor = 1 - Math.exp(-dt / 0.2)
  state.smoothedTurbulence += (targetTurbulence - state.smoothedTurbulence) * smoothFactor
  
  return state.smoothedTurbulence
}

/**
 * Master flight physics update.
 * 
 * Call this once per frame after `mixer.update(delta)` to apply all
 * procedural animation layers.
 * 
 * @param skeleton - Bone references for all animated systems
 * @param physics - Flight physics inputs from simulation
 * @param state - Persistent animation state (create once, pass each frame)
 * @param dt - Delta time in seconds (capped internally for stability)
 * @returns Updated animation state
 */
export function updateFlightAnimation(
  skeleton: SkeletonRefs,
  physics: FlightPhysicsInput,
  state: FlightAnimationState,
  dt: number
): FlightAnimationState {
  // Clamp dt for stability
  const safeDt = Math.max(COORDINATOR_CONFIG.MIN_DT, Math.min(COORDINATOR_CONFIG.MAX_DT, dt))
  state.time += safeDt
  
  // Calculate turbulence
  const turbulence = calculateTurbulence(
    physics.verticalSpeed,
    physics.yawRate,
    physics.altitude,
    physics.turbulenceIntensity ?? 0,
    state,
    safeDt
  )
  
  // --- PHASE 1: Spine wave propagation ---
  if (skeleton.spineBones.length > 0 || skeleton.neckBones.length > 0) {
    propagateFullBodyWave(
      { spine: skeleton.spineBones, neck: skeleton.neckBones },
      state.time,
      physics.horizontalSpeed,
      physics.yawRate
    )
  }
  
  // --- PHASE 2: Head/neck intelligent tracking ---
  if (skeleton.neckBones.length > 0 && skeleton.headBone) {
    const gazeTarget = physics.gazeTarget ? {
      position: new Vector3(physics.gazeTarget.x, physics.gazeTarget.y, physics.gazeTarget.z),
      urgency: 0.5,
      type: 'waypoint' as const,
    } : {
      position: new Vector3(
        physics.position.x + Math.sin(physics.yaw) * COORDINATOR_CONFIG.DEFAULT_GAZE_DISTANCE,
        physics.altitude + 5,
        physics.position.z + Math.cos(physics.yaw) * COORDINATOR_CONFIG.DEFAULT_GAZE_DISTANCE
      ),
      urgency: 0.5,
      type: 'waypoint' as const,
    }
    
    const bodyPose = {
      position: new Vector3(physics.position.x, physics.position.y, physics.position.z),
      velocity: new Vector3(physics.velocity.x, physics.velocity.y, physics.velocity.z),
      yaw: physics.yaw,
      pitch: physics.pitch,
      bank: physics.bank,
    }
    
    intelligentHeadNeckController(
      bodyPose,
      gazeTarget,
      {
        horizontalSpeed: physics.horizontalSpeed,
        verticalSpeed: physics.verticalSpeed,
        turnRate: physics.yawRate,
        turbulence: turbulence,
        flightMode: physics.flightMode,
        time: state.time,
      },
      state.headNeck,
      safeDt
    )
  }
  
  // --- PHASE 3: Dynamic tail controller ---
  if (skeleton.tailBones.length > 0) {
    dynamicTailController(
      skeleton.tailBones,
      physics.yawRate,
      physics.bank,
      physics.horizontalSpeed,
      physics.flightMode,
      turbulence, // aggression level from turbulence
      state.time,
      state.tail,
      safeDt
    )
  }
  
  // --- PHASE 4: Weighted limb physics ---
  if (skeleton.leftLegBones.length > 0 && skeleton.rightLegBones.length > 0) {
    dynamicLegController(
      skeleton.leftLegBones,
      skeleton.rightLegBones,
      physics.yawRate,
      physics.horizontalSpeed,
      physics.verticalSpeed,
      physics.groundClearance,
      physics.flightMode,
      0.5, // baseTuck default
      state.time,
      state.legs,
      safeDt
    )
  }
  
  // --- PHASE 5: Wing turbulence & load response ---
  if (skeleton.leftWingBones.length > 0 && skeleton.rightWingBones.length > 0) {
    dynamicWingController(
      skeleton.leftWingBones,
      skeleton.rightWingBones,
      turbulence,
      physics.pitch,
      physics.yawRate,
      physics.horizontalSpeed,
      physics.flightMode,
      state.time,
      state.wings,
      safeDt
    )
  }
  
  // --- Pose transitions & living oscillation ---
  updatePoseTransition(state.poseTransition, safeDt)
  
  // Apply living oscillation (breathing, sway) when not transitioning
  if (!isTransitioning(state.poseTransition)) {
    oscillate(state.poseTransition, 1 / 3, 0.015) // breath: 3s cycle, subtle
    oscillate(state.poseTransition, 0.15, 0.008) // sway: slow lateral
  }
  
  return state
}

/**
 * Convenience function to create skeleton refs from a model root.
 */
export function createSkeletonRefs(root: Object3D): SkeletonRefs {
  return {
    spineBones: findChain(root, SPINE_CHAIN),
    neckBones: findChain(root, NECK_CHAIN),
    headBone: findBone(root, HEAD_BONE),
    tailBones: findChain(root, TAIL_CHAIN),
    leftLegBones: findChain(root, LEFT_LEG_CHAIN),
    rightLegBones: findChain(root, RIGHT_LEG_CHAIN),
    leftWingBones: findChain(root, LEFT_WING_CHAIN),
    rightWingBones: findChain(root, RIGHT_WING_CHAIN),
  }
}

/**
 * Performance metrics for profiling.
 */
export interface FlightAnimationMetrics {
  /** Total update time in milliseconds */
  totalTime: number
  /** Time per subsystem in milliseconds */
  phaseTimes: {
    spine: number
    headNeck: number
    tail: number
    legs: number
    wings: number
    transition: number
  }
  /** Number of bones updated */
  boneCount: number
}

/**
 * Profiled version of updateFlightAnimation for development.
 */
export function updateFlightAnimationProfiled(
  skeleton: SkeletonRefs,
  physics: FlightPhysicsInput,
  state: FlightAnimationState,
  dt: number
): { state: FlightAnimationState; metrics: FlightAnimationMetrics } {
  const metrics: FlightAnimationMetrics = {
    totalTime: 0,
    phaseTimes: { spine: 0, headNeck: 0, tail: 0, legs: 0, wings: 0, transition: 0 },
    boneCount: 0,
  }
  
  const startTotal = performance.now()
  
  const safeDt = Math.max(COORDINATOR_CONFIG.MIN_DT, Math.min(COORDINATOR_CONFIG.MAX_DT, dt))
  state.time += safeDt
  
  // Turbulence
  const turbulence = calculateTurbulence(
    physics.verticalSpeed,
    physics.yawRate,
    physics.altitude,
    physics.turbulenceIntensity ?? 0,
    state,
    safeDt
  )
  
  // Phase 1: Spine
  let start = performance.now()
  if (skeleton.spineBones.length > 0 || skeleton.neckBones.length > 0) {
    propagateFullBodyWave(
      { spine: skeleton.spineBones, neck: skeleton.neckBones },
      state.time,
      physics.horizontalSpeed,
      physics.yawRate
    )
    metrics.boneCount += skeleton.spineBones.length + skeleton.neckBones.length
  }
  metrics.phaseTimes.spine = performance.now() - start
  
  // Phase 2: Head/neck
  start = performance.now()
  if (skeleton.neckBones.length > 0 && skeleton.headBone) {
    const gazeTarget = physics.gazeTarget ? {
      position: new Vector3(physics.gazeTarget.x, physics.gazeTarget.y, physics.gazeTarget.z),
      urgency: 0.5,
      type: 'waypoint' as const,
    } : {
      position: new Vector3(
        physics.position.x + Math.sin(physics.yaw) * COORDINATOR_CONFIG.DEFAULT_GAZE_DISTANCE,
        physics.altitude + 5,
        physics.position.z + Math.cos(physics.yaw) * COORDINATOR_CONFIG.DEFAULT_GAZE_DISTANCE
      ),
      urgency: 0.5,
      type: 'waypoint' as const,
    }
    const bodyPose = {
      position: new Vector3(physics.position.x, physics.position.y, physics.position.z),
      velocity: new Vector3(physics.velocity.x, physics.velocity.y, physics.velocity.z),
      yaw: physics.yaw,
      pitch: physics.pitch,
      bank: physics.bank,
    }
    intelligentHeadNeckController(
      bodyPose,
      gazeTarget,
      {
        horizontalSpeed: physics.horizontalSpeed,
        verticalSpeed: physics.verticalSpeed,
        turnRate: physics.yawRate,
        turbulence: turbulence,
        flightMode: physics.flightMode,
        time: state.time,
      },
      state.headNeck,
      safeDt
    )
    metrics.boneCount += skeleton.neckBones.length
  }
  metrics.phaseTimes.headNeck = performance.now() - start
  
  // Phase 3: Tail
  start = performance.now()
  if (skeleton.tailBones.length > 0) {
    dynamicTailController(
      skeleton.tailBones,
      physics.yawRate,
      physics.bank,
      physics.horizontalSpeed,
      physics.flightMode,
      turbulence, // aggression
      state.time,
      state.tail,
      safeDt
    )
    metrics.boneCount += skeleton.tailBones.length
  }
  metrics.phaseTimes.tail = performance.now() - start
  
  // Phase 4: Legs
  start = performance.now()
  if (skeleton.leftLegBones.length > 0 && skeleton.rightLegBones.length > 0) {
    dynamicLegController(
      skeleton.leftLegBones,
      skeleton.rightLegBones,
      physics.yawRate,
      physics.horizontalSpeed,
      physics.verticalSpeed,
      physics.groundClearance,
      physics.flightMode,
      0.5, // baseTuck
      state.time,
      state.legs,
      safeDt
    )
    metrics.boneCount += skeleton.leftLegBones.length + skeleton.rightLegBones.length
  }
  metrics.phaseTimes.legs = performance.now() - start
  
  // Phase 5: Wings
  start = performance.now()
  if (skeleton.leftWingBones.length > 0 && skeleton.rightWingBones.length > 0) {
    dynamicWingController(
      skeleton.leftWingBones,
      skeleton.rightWingBones,
      turbulence,
      physics.pitch,
      physics.yawRate,
      physics.horizontalSpeed,
      physics.flightMode,
      state.time,
      state.wings,
      safeDt
    )
    metrics.boneCount += skeleton.leftWingBones.length + skeleton.rightWingBones.length
  }
  metrics.phaseTimes.wings = performance.now() - start
  
  // Transitions
  start = performance.now()
  updatePoseTransition(state.poseTransition, safeDt)
  if (!isTransitioning(state.poseTransition)) {
    oscillate(state.poseTransition, 1 / 3, 0.015)
    oscillate(state.poseTransition, 0.15, 0.008)
  }
  metrics.phaseTimes.transition = performance.now() - start
  
  metrics.totalTime = performance.now() - startTotal
  
  return { state, metrics }
}
