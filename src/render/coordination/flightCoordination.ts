import { Vector3 } from 'three'
import { clamp, damp, clampLength } from '@/core/math/vec'
import type { FlightPose } from '@/render/flightPose'

/**
 * Wyvern Flight Coordination System
 * 
 * Manages sophisticated coordination between wyverns and ground targets,
 * takeoff/landing sequences, aerial attacks, and hunting behaviors at
 * different heights.
 */

export interface CoordinationTarget {
  position: Vector3
  velocity?: Vector3
  priority: number
  type: 'ground' | 'aerial' | 'prey' | 'perch'
  id: string
}

export interface LandingApproach {
  /** Approach vector in world space */
  approachDirection: Vector3
  /** Descent rate curve: 0 = shallow, 1 = steep */
  descentProfile: number
  /** Target landing point */
  landingPoint: Vector3
  /** Distance to begin final approach */
  approachDistance: number
  /** Whether to flare before landing */
  flare: boolean
}

export interface TakeoffProfile {
  /** Initial pitch angle for liftoff */
  initialPitch: number
  /** Climb rate (units/second) */
  climbRate: number
  /** Target altitude before transitioning to cruise */
  cruiseAltitude: number
  /** Forward velocity during climb */
  forwardSpeed: number
}

export interface AttackRun {
  /** Attack type determines behavior */
  type: 'dive' | 'strafe' | 'hover_strike' | 'sweep'
  /** Entry point for attack */
  entryPoint: Vector3
  /** Attack trajectory */
  trajectory: Vector3[]
  /** Exit point after attack */
  exitPoint: Vector3
  /** Attack speed multiplier */
  speedMultiplier: number
  /** Height to maintain during attack */
  attackHeight: number
}

export interface HuntEngagement {
  /** Target being hunted */
  target: CoordinationTarget
  /** Current engagement phase */
  phase: 'stalking' | 'positioning' | 'striking' | 'carrying' | 'returning'
  /** Optimal attack height for this prey */
  optimalHeight: number
  /** Distance to maintain while stalking */
  stalkingDistance: number
  /** Approach angle (radians from target's direction of travel) */
  approachAngle: number
}

/**
 * Calculates optimal landing approach path
 */
export function calculateLandingApproach(
  currentPos: Vector3,
  targetLanding: Vector3,
  currentVelocity: Vector3,
  wyvernScale: number = 1.0
): LandingApproach {
  const toTarget = targetLanding.clone().sub(currentPos)
  const horizontalDist = Math.hypot(toTarget.x, toTarget.z)
  
  // Approach angle based on current altitude
  const altitude = currentPos.y
  const approachAngle = clamp(
    Math.atan2(altitude, horizontalDist),
    0.2, // Minimum glide angle
    0.7  // Maximum steep approach
  )
  
  // Calculate approach direction (upwind preference would go here)
  const approachDirection = new Vector3(
    -toTarget.x,
    0,
    -toTarget.z
  ).normalize()
  
  // Descent profile: steeper for short approaches, shallower for long glides
  const descentProfile = horizontalDist < 30 ? 0.7 : 
                          horizontalDist < 60 ? 0.4 : 0.25
  
  // Begin final approach at 2.5x the altitude
  const approachDistance = altitude * 2.5 * wyvernScale
  
  return {
    approachDirection,
    descentProfile,
    landingPoint: targetLanding,
    approachDistance,
    flare: altitude > 5 && horizontalDist < 20
  }
}

/**
 * Generates takeoff parameters based on situation
 */
export function calculateTakeoffProfile(
  currentPos: Vector3,
  immediate: boolean = false,
  hasDestination: boolean = false
): TakeoffProfile {
  // Steep takeoff for immediate threats or close targets
  const initialPitch = immediate ? 0.5 : 0.3
  
  // Climb rate varies with urgency
  const climbRate = immediate ? 15 : 10
  
  // Target altitude depends on whether we have a destination
  const cruiseAltitude = hasDestination ? 18 : 22
  
  // Forward speed during climb
  const forwardSpeed = hasDestination ? 12 : 8
  
  return {
    initialPitch,
    climbRate,
    cruiseAltitude,
    forwardSpeed
  }
}

/**
 * Plans an attack run based on target type and wyvern position
 */
export function planAttackRun(
  wyvernPos: Vector3,
  wyvernVelocity: Vector3,
  target: CoordinationTarget,
  attackType: AttackRun['type'] = 'dive'
): AttackRun {
  const toTarget = target.position.clone().sub(wyvernPos)
  const distance = toTarget.length()
  
  // Determine optimal attack height based on target type
  let attackHeight: number
  switch (target.type) {
    case 'aerial':
      attackHeight = target.position.y
      break
    case 'ground':
      attackHeight = attackType === 'dive' ? 15 : 8
      break
    case 'prey':
      attackHeight = 12
      break
    default:
      attackHeight = 18
  }
  
  // Calculate entry point
  const entryDirection = toTarget.clone().normalize()
  const entryDistance = attackType === 'hover_strike' ? distance * 0.8 : distance + 20
  const entryPoint = target.position.clone().sub(
    entryDirection.clone().multiplyScalar(entryDistance)
  )
  entryPoint.y = Math.max(attackHeight + 10, wyvernPos.y)
  
  // Build trajectory based on attack type
  const trajectory: Vector3[] = []
  switch (attackType) {
    case 'dive':
      // High approach, steep dive, pull-up
      trajectory.push(entryPoint)
      trajectory.push(new Vector3(
        target.position.x,
        target.position.y + 20,
        target.position.z
      ))
      trajectory.push(target.position.clone())
      trajectory.push(new Vector3(
        target.position.x + entryDirection.x * 30,
        attackHeight,
        target.position.z + entryDirection.z * 30
      ))
      break
      
    case 'strafe':
      // Low, fast pass
      trajectory.push(entryPoint)
      trajectory.push(new Vector3(
        target.position.x - entryDirection.x * 15,
        attackHeight,
        target.position.z - entryDirection.z * 15
      ))
      trajectory.push(new Vector3(
        target.position.x + entryDirection.x * 15,
        attackHeight,
        target.position.z + entryDirection.z * 15
      ))
      break
      
    case 'hover_strike':
      // Approach, hover, strike
      trajectory.push(entryPoint)
      trajectory.push(new Vector3(
        target.position.x,
        attackHeight,
        target.position.z
      ))
      break
      
    case 'sweep':
      // Wide arc approach
      const sweepRadius = distance * 0.7
      const sweepCenter = target.position.clone()
      for (let i = 0; i <= 8; i++) {
        const angle = (i / 8) * Math.PI * 0.8 - Math.PI * 0.4
        const point = new Vector3(
          sweepCenter.x + Math.cos(angle) * sweepRadius,
          attackHeight,
          sweepCenter.z + Math.sin(angle) * sweepRadius
        )
        trajectory.push(point)
      }
      break
  }
  
  // Exit point is beyond target
  const exitPoint = trajectory[trajectory.length - 1]!.clone()
  
  // Speed multiplier based on attack type
  const speedMultiplier = attackType === 'dive' ? 1.4 :
                          attackType === 'strafe' ? 1.6 :
                          attackType === 'sweep' ? 1.2 : 1.0
  
  return {
    type: attackType,
    entryPoint,
    trajectory,
    exitPoint,
    speedMultiplier,
    attackHeight
  }
}

/**
 * Manages hunting engagement coordination
 */
export function updateHuntEngagement(
  engagement: HuntEngagement,
  wyvernPos: Vector3,
  wyvernVelocity: Vector3,
  dt: number
): {
  targetPosition: Vector3
  behavior: 'circle' | 'approach' | 'climb' | 'dive' | 'grab' | 'carry'
  attackNow: boolean
} {
  const toTarget = engagement.target.position.clone().sub(wyvernPos)
  const distance = toTarget.length()
  const heightDiff = wyvernPos.y - engagement.target.position.y
  
  // Determine behavior based on phase and distance
  switch (engagement.phase) {
    case 'stalking': {
      // Circle at stalking distance, maintaining optimal height
      const orbitAngle = Math.atan2(toTarget.x, toTarget.z) + dt * 0.5
      const stalkPos = engagement.target.position.clone().add(
        new Vector3(
          Math.sin(orbitAngle) * engagement.stalkingDistance,
          engagement.optimalHeight,
          Math.cos(orbitAngle) * engagement.stalkingDistance
        )
      )
      return {
        targetPosition: stalkPos,
        behavior: 'circle',
        attackNow: false
      }
    }
    
    case 'positioning': {
      // Move to approach angle for strike
      const angleOffset = engagement.approachAngle
      const approachDir = Math.atan2(toTarget.x, toTarget.z) + angleOffset
      const approachDist = distance * 0.7
      const position = engagement.target.position.clone().add(
        new Vector3(
          Math.sin(approachDir) * approachDist,
          engagement.optimalHeight,
          Math.cos(approachDir) * approachDist
        )
      )
      return {
        targetPosition: position,
        behavior: 'approach',
        attackNow: false
      }
    }
    
    case 'striking': {
      // Dive or grab based on height
      if (heightDiff > 8) {
        // Dive attack
        return {
          targetPosition: engagement.target.position.clone(),
          behavior: 'dive',
          attackNow: distance < 15
        }
      } else {
        // Hover and grab
        const grabPoint = engagement.target.position.clone()
        grabPoint.y += 2
        return {
          targetPosition: grabPoint,
          behavior: 'grab',
          attackNow: distance < 3
        }
      }
    }
    
    case 'carrying': {
      // Ascend with prey
      const climbPoint = wyvernPos.clone()
      climbPoint.y += 15 * dt
      return {
        targetPosition: climbPoint,
        behavior: 'carry',
        attackNow: false
      }
    }
    
    case 'returning': {
      // Already handled by normal return logic
      return {
        targetPosition: wyvernPos,
        behavior: 'approach',
        attackNow: false
      }
    }
  }
}

/**
 * Calculates flight pose for coordination maneuvers
 */
export function coordinationFlightPose(
  wyvernPos: Vector3,
  wyvernVelocity: Vector3,
  targetPos: Vector3,
  maneuverType: 'landing' | 'takeoff' | 'attack' | 'hunt' | 'transit',
  currentPose: FlightPose,
  dt: number
): FlightPose {
  const toTarget = targetPos.clone().sub(wyvernPos)
  const distance = toTarget.length()
  const speed = wyvernVelocity.length()
  
  // Calculate base targets
  let targetPitch = 0
  let targetBank = 0
  
  switch (maneuverType) {
    case 'landing': {
      // Pitch up to flare, bank to align with landing direction
      const landingDist = Math.hypot(toTarget.x, toTarget.z)
      if (landingDist < 20 && wyvernPos.y > 5) {
        // Flare: pitch up
        targetPitch = clamp((wyvernPos.y - 5) * 0.03, 0, 0.3)
      } else {
        // Normal descent
        targetPitch = clamp(-toTarget.y / Math.max(landingDist, 1), -0.4, 0.1)
      }
      targetBank = 0
      break
    }
    
    case 'takeoff': {
      // Strong pitch up during initial climb
      targetPitch = wyvernPos.y < 15 ? 0.4 : 0.15
      targetBank = 0
      break
    }
    
    case 'attack': {
      // Aggressive nose-down during dive
      if (toTarget.y < 0) {
        targetPitch = clamp(toTarget.y / Math.max(distance, 1), -0.6, 0)
      } else {
        targetPitch = clamp(speed * 0.01 - 0.1, -0.3, 0.2)
      }
      // Bank into turn
      const turnRate = Math.atan2(
        wyvernVelocity.x * toTarget.z - wyvernVelocity.z * toTarget.x,
        wyvernVelocity.x * toTarget.x + wyvernVelocity.z * toTarget.z
      )
      targetBank = clamp(turnRate * 0.8, -0.7, 0.7)
      break
    }
    
    case 'hunt': {
      // Stalking: more upright, ready to strike
      targetPitch = 0.1
      // Subtle banking while circling
      const orbitSpeed = (wyvernVelocity.x * toTarget.z - wyvernVelocity.z * toTarget.x)
      targetBank = clamp(orbitSpeed * 0.05, -0.3, 0.3)
      break
    }
    
    case 'transit': {
      // Normal cruise attitude
      targetPitch = clamp((speed - 18) * 0.02 - 0.1, -0.2, 0.2)
      targetBank = 0
      break
    }
  }
  
  // Smooth transition
  return {
    pitch: damp(currentPose.pitch, targetPitch, 4, dt),
    bank: damp(currentPose.bank, targetBank, 6, dt)
  }
}

/**
 * Determines if a target is in optimal attack position
 */
export function isInAttackPosition(
  wyvernPos: Vector3,
  target: CoordinationTarget,
  attackType: AttackRun['type']
): boolean {
  const toTarget = target.position.clone().sub(wyvernPos)
  const distance = toTarget.length()
  const heightDiff = wyvernPos.y - target.position.y
  
  switch (attackType) {
    case 'dive':
      // Need height advantage and good distance
      return heightDiff > 10 && heightDiff < 40 && distance > 20 && distance < 60
      
    case 'strafe':
      // Low and fast approach
      return heightDiff > 3 && heightDiff < 12 && distance < 40
      
    case 'hover_strike':
      // Directly above or close
      return distance < 25 && heightDiff > 5 && heightDiff < 20
      
    case 'sweep':
      // Wide approach
      return distance > 30 && distance < 80 && heightDiff > 8 && heightDiff < 25
  }
}

/**
 * Calculates optimal engagement height for different target types
 */
export function calculateOptimalEngagementHeight(
  targetType: CoordinationTarget['type'],
  targetSize: number = 1.0
): number {
  switch (targetType) {
    case 'aerial':
      // Match target altitude
      return 25
    case 'ground':
      // Higher for better dive angle
      return 18 + targetSize * 5
    case 'prey':
      // Low for precision grab
      return 12
    case 'perch':
      // Approach altitude
      return 15
    default:
      return 18
  }
}
