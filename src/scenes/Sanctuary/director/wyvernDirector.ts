import { Vector3, type Object3D, type Group } from 'three'
import type { WyvernInstance } from '@/core/types'
import type { ModelActionRequest } from '@/render/assets/GameModel'
import type { ModelState } from '@/render/assets/manifest'
import type { FlightLoopState, FlightPose, HeadNeckPose } from '@/render/flightPose'
import type { HeadNeckState } from '@/render/gazeController'
import type { ClosedJawPose } from '@/render/flightMouth'
import type { SanctuaryCommand, SanctuaryCommandPhase, SanctuaryCommandRequest } from '@/state/sanctuaryCommands'
import {
  assignmentVisualState,
  isSanctuaryPointValid,
  type SanctuaryPoint,
  type PerchAssignments,
  type SanctuaryCollider,
} from '../commandLogic'
import {
  BREEDING_POSTS,
  INFIRMARY_POST,
  PERCHES,
  TRAINING_POSTS,
} from '../layout'

export interface VisualState {
  state: ModelState
  action: ModelActionRequest | null
  showFood: boolean
}

export type Purpose = Exclude<SanctuaryCommand, 'findFood'> | 'assignment' | 'land' | 'takeOff' | 'return' | 'attack'

export interface Agent {
  id: string
  group: Group | null
  jaw: Object3D | null
  /** Bind-pose lower muzzle, captured per cloned model for passive flight. */
  jawClosed: ClosedJawPose | null
  headBone: Object3D | null
  neckBones: Object3D[]
  /** Spine bones for wave propagation (Spine → Spine1 → Spine2 → Spine3 → Pelvis) */
  spineBones: Object3D[]
  /** Thigh → calf → foot for each hind leg; used by the runtime tuck layer. */
  legBones: Object3D[][]
  position: Vector3
  yaw: number
  headYaw: number
  headPitch: number
  phase: SanctuaryCommandPhase
  phaseTime: number
  phaseStartY: number
  phaseStartYaw: number
  airborne: boolean
  base: SanctuaryPoint
  baseState: ModelState
  destination: SanctuaryPoint | null
  purpose: Purpose | null
  attackTarget: SanctuaryPoint | null
  queued: SanctuaryCommandRequest | null
  lastRequestToken: number
  actionToken: number
  /** Active one-shot, retained until GameModel says its mixer action ended. */
  activeAction: ModelActionRequest | null
  currentActionDuration: number
  playerMoveToken: number | null
  patrolAngle: number
  returnAfterAction: boolean
  flightPose: FlightPose
  headNeckPose: HeadNeckPose
  /** Intelligent head/neck controller state (Phase 2) */
  intelligentHeadNeck: HeadNeckState
  /** Airspeed-driven tuck composed on top of the clip's authored carriage. */
  flightLegTuck: number
  flightAnimation: FlightLoopState
  /**
   * Whether the wings are beating, as an intent rather than a measurement.
   *
   * It cannot be derived from `phase`, because `'soaring'` means two different
   * things: the director's high Lissajous orbit, which really is a ride, and a
   * player holding the climb key, which is the most powered thing a wyvern
   * does. Whoever moves the agent states it.
   */
  powered: boolean
  /** Seconds until the ambient idle scheduler rolls or ends its next action. */
  ambientDwell: number
  /** Ever-incrementing draw counter, so repeated ambient rolls don't repeat. */
  ambientRoll: number
  /** The ambient action currently playing (sleep/sit/groom/eat/drink/perch), or null between them. */
  ambientAction: ModelState | null
}

export function baseFor(
  wyvern: WyvernInstance,
  perchAssignments: PerchAssignments,
): { position: SanctuaryPoint; state: ModelState } {
  if (wyvern.assignment.kind === 'training') {
    const stationId = wyvern.assignment.stationId
    const position = TRAINING_POSTS[stationId] ?? PERCHES[0]!
    const state = assignmentVisualState(wyvern.assignment)
    return { position, state }
  }

  if (wyvern.assignment.kind === 'breeding') {
    const partnerId = wyvern.assignment.partnerId
    const side = partnerId && wyvern.id > partnerId ? 1 : 0
    const position = BREEDING_POSTS[side]
    return { position, state: 'idle' }
  }

  if (wyvern.injury > 30) {
    return { position: INFIRMARY_POST, state: 'rest' }
  }

  const perchIndex = wyvern.preferredPerchIndex ?? perchAssignments[wyvern.id] ?? 0
  const position = PERCHES[perchIndex % PERCHES.length]!
  return { position, state: 'idle' }
}

export function flatDistance(a: Vector3 | SanctuaryPoint, b: Vector3 | SanctuaryPoint): number {
  const ax = 'x' in a ? a.x : a[0]
  const az = 'z' in a ? a.z : a[1]
  const bx = 'x' in b ? b.x : b[0]
  const bz = 'z' in b ? b.z : b[1]
  return Math.hypot(ax - bx, az - bz)
}

export function smooth01(t: number): number {
  const clamped = Math.max(0, Math.min(1, t))
  return clamped * clamped * (3 - 2 * clamped)
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function isNonInterruptible(phase: SanctuaryCommandPhase): boolean {
  return phase === 'takeoff' || phase === 'landing' || phase === 'acting'
}

export function isFlightPhase(phase: SanctuaryCommandPhase): boolean {
  return (
    phase === 'takeoff' ||
    phase === 'transit' ||
    phase === 'landing' ||
    phase === 'patrol' ||
    phase === 'circle' ||
    phase === 'following' ||
    phase === 'soaring' ||
    phase === 'hovering' ||
    phase === 'returning'
  )
}

export function isCruisePhase(phase: SanctuaryCommandPhase): boolean {
  return (
    phase === 'transit' ||
    phase === 'patrol' ||
    phase === 'circle' ||
    phase === 'following' ||
    phase === 'soaring' ||
    phase === 'returning' ||
    phase === 'hovering'
  )
}

export function phaseLabel(agent: Agent): string {
  if (agent.phase === 'approachingPlayer') return 'waiting for you'
  if (agent.phase === 'takeoff') return 'taking off'
  if (agent.phase === 'transit' || agent.phase === 'returning') return 'in flight'
  if (agent.phase === 'landing') return 'landing'
  if (agent.phase === 'acting') return 'responding'
  if (agent.phase === 'patrol' || agent.phase === 'circle') return 'circling the sky'
  if (agent.phase === 'following') return 'escorting from above'
  if (agent.phase === 'soaring') return 'soaring high'
  if (agent.phase === 'hovering') return 'hovering in place'
  return 'listening'
}

export function commandName(command: SanctuaryCommand): string {
  switch (command) {
    case 'offerFood':
      return 'Offer Food'
    case 'findFood':
      return 'Find Food'
    case 'takeOff':
      return 'Take Off'
    case 'circle':
      return 'Circle Sky'
    case 'follow':
      return 'Follow Player'
    case 'soar':
      return 'Soar High'
    case 'hover':
      return 'Hover'
    default:
      return command.charAt(0).toUpperCase() + command.slice(1)
  }
}

export function hasAttackTargetBlocker(object: Object3D): boolean {
  let current: Object3D | null = object
  while (current) {
    if (current.userData.sanctuaryAttackBlocker === true) return true
    current = current.parent
  }
  return false
}

export function isActorClearTarget(
  target: SanctuaryPoint,
  roster: Iterable<Agent>,
  playerPosition: SanctuaryPoint,
): boolean {
  if (Math.hypot(target[0] - playerPosition[0], target[1] - playerPosition[1]) < 2) {
    return false
  }
  for (const agent of roster) {
    if (flatDistance(agent.position, target) < 6) return false
  }
  return true
}

export function interactionPoint(
  agent: Agent,
  colliders: readonly SanctuaryCollider[],
  scratch: Vector3,
  playerPosition: SanctuaryPoint,
): { position: [number, number]; face: [number, number] } | null {
  if (agent.jaw) agent.jaw.getWorldPosition(scratch)
  else {
    scratch.set(
      agent.position.x + Math.sin(agent.yaw) * 5,
      0,
      agent.position.z + Math.cos(agent.yaw) * 5,
    )
  }

  const facePos: [number, number] = [scratch.x, scratch.z]
  const angles = [
    Math.PI,
    Math.PI * 0.75,
    -Math.PI * 0.75,
    Math.PI / 2,
    -Math.PI / 2,
  ]
  const candidates = angles
    .map((offset): [number, number] => [
      scratch.x + Math.sin(agent.yaw + offset) * 2.5,
      scratch.z + Math.cos(agent.yaw + offset) * 2.5,
    ])
    .sort(
      (left, right) =>
        Math.hypot(left[0] - playerPosition[0], left[1] - playerPosition[1]) -
        Math.hypot(right[0] - playerPosition[0], right[1] - playerPosition[1]),
    )
  for (const point of candidates) {
    if (
      isSanctuaryPointValid(point, {
        boundsRadius: 50,
        colliders,
        clearance: 0.8,
      })
    ) {
      return { position: point, face: facePos }
    }
  }
  return null
}
