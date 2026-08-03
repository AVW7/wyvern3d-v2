/**
 * Example integration of the Flight Coordination System
 * 
 * This file demonstrates how to use the wyvern coordination system
 * for improved ground interactions, takeoff/landing, attacks, and hunting.
 */

import { Vector3 } from 'three'
import {
  calculateLandingApproach,
  calculateTakeoffProfile,
  planAttackRun,
  updateHuntEngagement,
  coordinationFlightPose,
  isInAttackPosition,
  calculateOptimalEngagementHeight,
  type CoordinationTarget,
  type HuntEngagement,
} from './flightCoordination'

/**
 * Example: Smooth Landing with Coordination
 */
export function exampleLanding() {
  const wyvernPosition = new Vector3(50, 25, 30)
  const targetLanding = new Vector3(10, 0, 15)
  const velocity = new Vector3(-5, -2, -3)
  
  const approach = calculateLandingApproach(
    wyvernPosition,
    targetLanding,
    velocity,
    1.0 // normal scale
  )
  
  console.log('Landing Approach:', {
    descentProfile: approach.descentProfile,
    flare: approach.flare,
    approachDistance: approach.approachDistance,
  })
  
  // Use approach guidance in your flight loop:
  // - approach.approachDirection: which way to approach from
  // - approach.descentProfile: how steep to descend
  // - approach.flare: whether to flare before touchdown
}

/**
 * Example: Dynamic Takeoff
 */
export function exampleTakeoff() {
  const wyvernPosition = new Vector3(10, 0, 5)
  
  // Normal takeoff
  const normalProfile = calculateTakeoffProfile(wyvernPosition, false, false)
  console.log('Normal Takeoff:', {
    climbRate: normalProfile.climbRate,
    cruiseAltitude: normalProfile.cruiseAltitude,
    initialPitch: normalProfile.initialPitch,
  })
  
  // Emergency takeoff (under attack)
  const emergencyProfile = calculateTakeoffProfile(wyvernPosition, true, false)
  console.log('Emergency Takeoff:', {
    climbRate: emergencyProfile.climbRate, // faster
    initialPitch: emergencyProfile.initialPitch, // steeper
  })
  
  // Takeoff with destination
  const transitProfile = calculateTakeoffProfile(wyvernPosition, false, true)
  console.log('Transit Takeoff:', {
    cruiseAltitude: transitProfile.cruiseAltitude, // lower for transit
    forwardSpeed: transitProfile.forwardSpeed, // faster forward
  })
}

/**
 * Example: Aerial Attack at Different Heights
 */
export function exampleAerialAttack() {
  const wyvernPos = new Vector3(20, 35, 20)
  const wyvernVelocity = new Vector3(-3, 0, 2)
  
  // Ground target (e.g., enemy soldier)
  const groundTarget: CoordinationTarget = {
    position: new Vector3(50, 0, 50),
    type: 'ground',
    id: 'enemy-soldier-1',
    priority: 0.8,
  }
  
  // Dive attack from height
  const diveAttack = planAttackRun(wyvernPos, wyvernVelocity, groundTarget, 'dive')
  console.log('Dive Attack:', {
    entryPoint: diveAttack.entryPoint,
    attackHeight: diveAttack.attackHeight,
    speedMultiplier: diveAttack.speedMultiplier,
  })
  
  // Strafe attack (low and fast)
  const strafeAttack = planAttackRun(wyvernPos, wyvernVelocity, groundTarget, 'strafe')
  console.log('Strafe Attack:', {
    attackHeight: strafeAttack.attackHeight, // lower than dive
    speedMultiplier: strafeAttack.speedMultiplier, // faster
  })
  
  // Aerial target (e.g., enemy wyvern)
  const aerialTarget: CoordinationTarget = {
    position: new Vector3(60, 25, 60),
    velocity: new Vector3(2, 0, -1),
    type: 'aerial',
    id: 'enemy-wyvern-1',
    priority: 1.0,
  }
  
  // Hover strike for aerial combat
  const hoverAttack = planAttackRun(wyvernPos, wyvernVelocity, aerialTarget, 'hover_strike')
  console.log('Hover Strike:', {
    attackHeight: hoverAttack.attackHeight, // matches target altitude
  })
  
  // Check if in optimal attack position
  const inPosition = isInAttackPosition(wyvernPos, aerialTarget, 'hover_strike')
  console.log('In attack position:', inPosition)
}

/**
 * Example: Hunting Prey at Multiple Heights
 */
export function exampleHuntEngagement() {
  const wyvernPos = new Vector3(30, 18, 30)
  const wyvernVelocity = new Vector3(1, 0, 0.5)
  
  // Prey target (e.g., wild boar)
  const prey: CoordinationTarget = {
    position: new Vector3(50, 0, 50),
    type: 'prey',
    id: 'boar-1',
    priority: 0.7,
  }
  
  // Initialize hunt engagement
  const engagement: HuntEngagement = {
    target: prey,
    phase: 'stalking',
    optimalHeight: calculateOptimalEngagementHeight('prey'),
    stalkingDistance: 25,
    approachAngle: Math.PI / 4, // 45 degrees
  }
  
  // Simulate hunt phases
  const dt = 0.016 // 60 FPS
  
  // Stalking phase
  const stalkingResult = updateHuntEngagement(engagement, wyvernPos, wyvernVelocity, dt)
  console.log('Stalking:', {
    behavior: stalkingResult.behavior,
    attackNow: stalkingResult.attackNow,
  })
  
  // Positioning phase
  engagement.phase = 'positioning'
  const positioningResult = updateHuntEngagement(engagement, wyvernPos, wyvernVelocity, dt)
  console.log('Positioning:', {
    targetPosition: positioningResult.targetPosition,
  })
  
  // Striking phase
  engagement.phase = 'striking'
  const strikePos = new Vector3(50, 15, 50) // closer and lower
  const strikingResult = updateHuntEngagement(engagement, strikePos, wyvernVelocity, dt)
  console.log('Striking:', {
    behavior: strikingResult.behavior,
    attackNow: strikingResult.attackNow,
  })
}

/**
 * Example: Coordinated Flight Poses
 */
export function exampleFlightPoses() {
  const currentPose = { pitch: 0, bank: 0 }
  const wyvernPos = new Vector3(20, 15, 20)
  const wyvernVelocity = new Vector3(5, 0, 5)
  const targetPos = new Vector3(25, 0, 25)
  const dt = 0.016
  
  // Landing pose (flare)
  const landingPose = coordinationFlightPose(
    wyvernPos,
    wyvernVelocity,
    new Vector3(20, 0, 20),
    'landing',
    currentPose,
    dt
  )
  console.log('Landing pose:', landingPose) // Pitch up to flare
  
  // Takeoff pose (climb)
  const takeoffPose = coordinationFlightPose(
    new Vector3(20, 5, 20),
    wyvernVelocity,
    new Vector3(20, 20, 20),
    'takeoff',
    currentPose,
    dt
  )
  console.log('Takeoff pose:', takeoffPose) // Strong pitch up
  
  // Attack pose (dive)
  const attackPose = coordinationFlightPose(
    new Vector3(20, 30, 20),
    new Vector3(0, -5, 0), // diving
    new Vector3(20, 0, 20),
    'attack',
    currentPose,
    dt
  )
  console.log('Attack pose:', attackPose) // Nose down, banked
  
  // Hunt pose (stalking)
  const huntPose = coordinationFlightPose(
    wyvernPos,
    wyvernVelocity,
    new Vector3(30, 0, 30),
    'hunt',
    currentPose,
    dt
  )
  console.log('Hunt pose:', huntPose) // Upright, subtle bank
}

/**
 * Example: Height-Based Target Selection
 */
export function exampleHeightBasedTargeting() {
  // Different optimal heights for different target types
  const heights = {
    aerial: calculateOptimalEngagementHeight('aerial'),
    ground: calculateOptimalEngagementHeight('ground', 0.8), // smaller target
    prey: calculateOptimalEngagementHeight('prey'),
    perch: calculateOptimalEngagementHeight('perch'),
  }
  
  console.log('Optimal engagement heights:', heights)
  // aerial: 25, ground: 22, prey: 12, perch: 15
  
  // Use these heights to position wyverns at optimal attack altitude
  // when engaging different target types
}

/**
 * Integration with existing systems
 * 
 * To integrate with SanctuaryWyverns:
 * 
 * 1. In the agent update loop:
 *    - Call calculateLandingApproach during landing phase
 *    - Call calculateTakeoffProfile during takeoff phase
 *    - Use coordinationFlightPose for smooth pose transitions
 * 
 * 2. For attacks:
 *    - Call planAttackRun when attack target is set
 *    - Use isInAttackPosition to check engagement readiness
 *    - Apply attackRun.trajectory waypoints
 * 
 * 3. For hunting:
 *    - Initialize HuntEngagement when prey detected
 *    - Call updateHuntEngagement each frame
 *    - Execute behavior based on returned phase
 * 
 * 4. For ground coordination:
 *    - Use calculateOptimalEngagementHeight for approach altitude
 *    - Apply flare logic from calculateLandingApproach
 *    - Smooth poses with coordinationFlightPose
 */
