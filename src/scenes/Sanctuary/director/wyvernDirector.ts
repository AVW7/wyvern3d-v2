import { Vector3, type Group, type Object3D } from 'three'
import type { WyvernInstance } from '@/core/types'
import type { ModelActionRequest } from '@/render/assets/GameModel'
import type { ModelState } from '@/render/assets/manifest'
import { createRng, deriveSeed } from '@/core/math/rng'
import { angleDelta, flightAnimationState, type FlightLoopState } from '@/render/flightPose'
import { readDirectWyvernFlightInput, stepDirectWyvernFlight } from '@/render/controllers/wyvernFlight'
import { createWyvernFlightRig, type WyvernFlightRig } from '@/render/wyvernFlightRig'
import type { CharacterGesture } from '@/render/placeholders/PlaceholderProps'
import type {
  SanctuaryCommand,
  SanctuaryCommandPhase,
  SanctuaryCommandRequest,
} from '@/state/sanctuaryCommands'
import {
  allocateStablePerches,
  assignmentVisualState,
  findNearestAvailablePerch,
  findSafeAttackLanding,
  isSanctuaryPointValid,
  stableIdHash,
  yawToward,
  type PerchAssignments,
  type SanctuaryCollider,
  type SanctuaryPoint,
} from '../commandLogic'
import {
  BREEDING_POSTS,
  GROUND_RADIUS,
  INFIRMARY_POST,
  PATROL,
  PERCHES,
  TRAINING_POSTS,
} from '../layout'
import {
  calculateHeadTargetAngles,
  dampHeadPose,
  resolveGazeTarget,
  type SpatialAgent,
} from './spatialAwareness'

export const TRANSIT_SPEED = 18
export const TRANSIT_ALTITUDE = 22
export const TAKEOFF_SECONDS = 3.34
export const LAND_SECONDS = 4.67
export const NEAR_ATTACK = 14
export const AMBIENT_MIN_DWELL = 15
export const AMBIENT_MAX_DWELL = 45
export const AMBIENT_MIN_HOLD = 8
export const AMBIENT_MAX_HOLD = 20
export const EAT_SECONDS = 4.5

export interface VisualState {
  state: ModelState
  action: ModelActionRequest | null
  showFood: boolean
}

export type Purpose =
  | Exclude<SanctuaryCommand, 'findFood'>
  | 'assignment'
  | 'land'
  | 'takeOff'
  | 'return'
  | 'attack'

export interface Agent {
  id: string
  group: Group | null
  rig: WyvernFlightRig
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
  flightAnimation: FlightLoopState
  powered: boolean
  /** Seconds until the ambient idle scheduler rolls or ends its next action. */
  ambientDwell: number
  /** Ever-incrementing draw counter, so repeated ambient rolls don't repeat. */
  ambientRoll: number
  /** The ambient action currently playing (sleep/sit/groom/eat/drink/perch), or null between them. */
  ambientAction: ModelState | null
  /** Piloted-flight energy state, owned by `stepDirectWyvernFlight`. */
  airspeed?: number
  climbRate?: number
  bank?: number
  flightMode?: FlightLoopState
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
  if (agent.rig.bones.jaw) agent.rig.bones.jaw.getWorldPosition(scratch)
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

function moveFlat(
  agent: Agent,
  destination: SanctuaryPoint,
  speed: number,
  dt: number,
): number {
  const dx = destination[0] - agent.position.x
  const dz = destination[1] - agent.position.z
  const dist = Math.hypot(dx, dz)
  if (dist < 1e-4) return 0
  const step = Math.min(dist, speed * dt)
  agent.position.x += (dx / dist) * step
  agent.position.z += (dz / dist) * step
  if (dist > 1.0) {
    const targetYaw = Math.atan2(dx, dz)
    const delta = angleDelta(targetYaw, agent.yaw)
    agent.yaw += delta * Math.min(1, 10 * dt)
  }
  return dist - step
}

function face(agent: Agent, target: SanctuaryPoint): void {
  const dx = target[0] - agent.position.x
  const dz = target[1] - agent.position.z
  if (Math.hypot(dx, dz) > 1e-4) agent.yaw = Math.atan2(dx, dz)
}

function title(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export interface SanctuaryDirectorOptions {
  seed?: number
}

export interface SanctuaryDirectorStepContext {
  playerPosition: SanctuaryPoint | null
  playerLocomotion?: 'idle' | 'walk' | 'run'
  controlMode?: 'human' | 'wyvern'
  activeWyvernId?: string | null
  cameraRotationY?: number
  elapsedTime?: number
  colliders?: readonly SanctuaryCollider[]
  placedObjects?: readonly { propId: string; position: readonly [number, number, number] }[]
  onStatusChange?: (status: string | null) => void
  onPlayerMove?: (
    target: [number, number],
    gesture: CharacterGesture,
    faceTarget?: [number, number],
  ) => number
  onClearPlayerInteraction?: () => void
  onOpenHighlandsHunt?: (wyvernId: string) => void
}

export interface SanctuaryCommandsContext {
  setStatus: (status: string | null) => void
  movePlayer: (
    target: [number, number],
    gesture: CharacterGesture,
    faceTarget?: [number, number],
  ) => number
  clearPlayerInteraction: () => void
  acknowledgePlayerMove?: () => void
  openHighlandsHunt?: (wyvernId: string) => void
}

/**
 * Headless simulation engine for all autonomous sanctuary wyverns.
 *
 * Encapsulates the agent lifecycle, trajectory paths, flight state transitions,
 * collision avoidance, and ambient idle schedulers behind a cohesive, testable seam.
 */
export class SanctuaryDirector {
  public agents = new Map<string, Agent>()
  public perchAssignments: PerchAssignments = {}
  public visuals: Record<string, VisualState> = {}
  public seed: number

  private actionLatch = { breath: false, attack: false }
  private jawWorldScratch = new Vector3()

  constructor(options: SanctuaryDirectorOptions = {}) {
    this.seed = options.seed ?? 1
  }

  public setVisual(id: string, patch: Partial<VisualState>): void {
    const old = this.visuals[id]
    if (!old) {
      this.visuals[id] = {
        state: 'idle',
        action: null,
        showFood: false,
        ...patch,
      }
      return
    }
    const next = { ...old, ...patch }
    if (
      old.state === next.state &&
      old.action?.token === next.action?.token &&
      old.showFood === next.showFood
    ) {
      return
    }
    this.visuals[id] = next
  }

  public getVisual(id: string): VisualState {
    return (
      this.visuals[id] ?? {
        state: 'idle',
        action: null,
        showFood: false,
      }
    )
  }

  public syncWyverns(wyverns: WyvernInstance[], seed?: number): void {
    if (seed !== undefined) this.seed = seed
    const ids = wyverns.map((w) => w.id)
    this.perchAssignments = allocateStablePerches(ids, PERCHES.length, this.perchAssignments)

    const live = new Set(ids)
    for (const [id] of this.agents) {
      if (!live.has(id)) {
        this.agents.delete(id)
        delete this.visuals[id]
      }
    }

    for (const wyvern of wyverns) {
      const base = baseFor(wyvern, this.perchAssignments)
      const existing = this.agents.get(wyvern.id)
      if (existing) {
        existing.base = base.position
        existing.baseState = base.state
        continue
      }

      const angle =
        wyvern.assignment.kind === 'idle'
          ? yawToward(base.position, PATROL.center)
          : ((stableIdHash(wyvern.id) % 1000) / 1000) * Math.PI * 2

      const agent: Agent = {
        id: wyvern.id,
        group: null,
        rig: createWyvernFlightRig(),
        position: new Vector3(base.position[0], 0, base.position[1]),
        yaw: angle,
        headYaw: 0,
        headPitch: 0,
        phase: 'settled',
        phaseTime: 0,
        phaseStartY: 0,
        phaseStartYaw: angle,
        airborne: false,
        base: base.position,
        baseState: base.state,
        destination: null,
        purpose: null,
        attackTarget: null,
        queued: null,
        lastRequestToken: 0,
        actionToken: 0,
        activeAction: null,
        currentActionDuration: 0,
        playerMoveToken: null,
        patrolAngle: 0,
        returnAfterAction: false,
        flightAnimation: 'cruise',
        powered: false,
        ambientDwell: 8,
        ambientRoll: 0,
        ambientAction: null,
      }

      this.agents.set(wyvern.id, agent)
      this.setVisual(wyvern.id, {
        state: base.state,
        action: null,
        showFood: false,
      })
    }
  }

  public dispatchCommand(
    request: SanctuaryCommandRequest,
    wyverns: WyvernInstance[],
    colliders: readonly SanctuaryCollider[],
    commandsCtx: SanctuaryCommandsContext,
  ): void {
    const agent = this.agents.get(request.wyvernId)
    if (!agent) return

    const wyvern = wyverns.find((candidate) => candidate.id === agent.id)
    if (agent.phase === 'approachingPlayer') {
      agent.playerMoveToken = null
      commandsCtx.clearPlayerInteraction()
    }
    agent.queued = null
    commandsCtx.setStatus(null)

    if (request.kind === 'takeOff' || request.kind === 'circle') {
      if (wyvern?.stage === 'hatchling') {
        commandsCtx.setStatus('Hatchlings are not ready to take off.')
      } else if (!agent.airborne) {
        this.startTakeoff(agent, 'circle')
      } else {
        agent.purpose = 'circle'
        agent.phase = 'circle'
        agent.phaseTime = 0
        agent.flightAnimation = 'cruise'
        this.setVisual(agent.id, { state: 'cruise', action: null })
      }
      return
    }

    if (request.kind === 'follow') {
      if (wyvern?.stage === 'hatchling') {
        commandsCtx.setStatus('Hatchlings cannot follow from the air.')
      } else if (!agent.airborne) {
        this.startTakeoff(agent, 'follow')
      } else {
        agent.purpose = 'follow'
        agent.phase = 'following'
        agent.phaseTime = 0
        agent.flightAnimation = 'cruise'
        this.setVisual(agent.id, { state: 'cruise', action: null })
      }
      return
    }

    if (request.kind === 'soar') {
      if (wyvern?.stage === 'hatchling') {
        commandsCtx.setStatus('Hatchlings cannot soar.')
      } else if (!agent.airborne) {
        this.startTakeoff(agent, 'soar')
      } else {
        agent.purpose = 'soar'
        agent.phase = 'soaring'
        agent.phaseTime = 0
        agent.flightAnimation = 'cruise'
        this.setVisual(agent.id, { state: 'cruise', action: null })
      }
      return
    }

    if (request.kind === 'hover') {
      if (wyvern?.stage === 'hatchling') {
        commandsCtx.setStatus('Hatchlings cannot hover.')
      } else if (!agent.airborne) {
        this.startTakeoff(agent, 'hover')
      } else {
        agent.purpose = 'hover'
        agent.phase = 'hovering'
        agent.phaseTime = 0
        agent.flightAnimation = 'cruise'
        this.setVisual(agent.id, { state: 'cruise', action: null })
      }
      return
    }

    if (request.kind === 'land') {
      if (agent.airborne) this.startLandCommand(agent)
      return
    }

    if (request.kind === 'return') {
      this.startJourney(agent, agent.base, 'return')
      return
    }

    if (request.kind === 'findFood') {
      if (wyvern?.stage !== 'adult') {
        commandsCtx.setStatus('Only adult wyverns can enter the Highlands hunt test.')
        return
      }
      if (commandsCtx.openHighlandsHunt) {
        commandsCtx.openHighlandsHunt(agent.id)
      }
      commandsCtx.setStatus('Highlands hunt test opened.')
      return
    }

    if (request.kind === 'attack' && request.target) {
      const landing = findSafeAttackLanding(
        request.target,
        [agent.position.x, agent.position.z],
        {
          boundsRadius: GROUND_RADIUS,
          colliders,
          targetClearance: 0.75,
          landingClearance: 5.5,
        },
      )
      if (!landing) {
        commandsCtx.setStatus('That ground is not safe for an attack.')
        return
      }
      agent.attackTarget = request.target
      agent.purpose = 'attack'
      if (!agent.airborne && flatDistance(agent.position, request.target) <= NEAR_ATTACK) {
        face(agent, request.target)
        this.playAction(agent, 'attack', 3.34, false, commandsCtx)
      } else {
        if (wyvern?.stage === 'hatchling') {
          commandsCtx.setStatus('Choose a point closer to this hatchling.')
          return
        }
        this.startJourney(agent, landing, 'attack')
      }
      return
    }

    if (request.kind === 'offerFood' || request.kind === 'pet' || request.kind === 'calm') {
      if (agent.airborne) {
        agent.queued = request
        this.startLandCommand(agent)
      } else {
        this.startPlayerApproach(agent, request, colliders, commandsCtx)
      }
    }
  }

  public handlePlayerMoveResult(
    playerMoveResult: { token: number; result: 'arrived' | 'cancelled' },
    commandsCtx: SanctuaryCommandsContext,
  ): void {
    for (const agent of this.agents.values()) {
      if (
        agent.phase !== 'approachingPlayer' ||
        agent.playerMoveToken !== playerMoveResult.token
      ) {
        continue
      }
      const request = agent.queued
      agent.playerMoveToken = null
      agent.queued = null
      if (playerMoveResult.result === 'arrived' && request) {
        if (commandsCtx.acknowledgePlayerMove) commandsCtx.acknowledgePlayerMove()
        this.playContactAction(agent, request.kind, commandsCtx)
      } else {
        commandsCtx.clearPlayerInteraction()
        this.settle(agent)
        commandsCtx.setStatus('Interaction cancelled.')
      }
      break
    }
  }

  public onActionFinished(wyvernId: string, token: number): void {
    const agent = this.agents.get(wyvernId)
    if (agent && agent.activeAction?.token === token) {
      agent.activeAction = null
    }
  }

  public updatePlayerControlledWyvern(
    agent: Agent,
    dt: number,
    cameraRotationY: number,
  ): void {
    agent.phaseTime += dt
    const input = readDirectWyvernFlightInput()
    let action: ModelState | null = null

    if (input.breathing && !this.actionLatch.breath) {
      agent.actionToken += 1
      action = 'breathe'
    }
    this.actionLatch.breath = input.breathing

    if (input.attacking && !this.actionLatch.attack) {
      agent.actionToken += 1
      action = agent.airborne ? 'attackAir' : 'attack'
    }
    this.actionLatch.attack = input.attacking

    const flight = stepDirectWyvernFlight(agent, input, cameraRotationY, dt, {
      boundsRadius: GROUND_RADIUS,
    })
    agent.phase = flight.airborne ? (flight.climbing ? 'soaring' : 'transit') : 'settled'
    agent.powered = flight.powered
    // The piloted loop comes from the same selector the autonomous agents use,
    // so a player dive, glide, hover or bank reads as the authored clip.
    if (flight.flightMode) agent.flightAnimation = flight.flightMode
    this.setVisual(agent.id, { state: flight.flightMode ?? flight.locomotion, action: null })

    if (action) {
      agent.activeAction = { token: agent.actionToken, state: action }
      this.setVisual(agent.id, { action: { token: agent.actionToken, state: action } })
    }
  }

  public step(
    dt: number,
    context: SanctuaryDirectorStepContext,
    wyverns: WyvernInstance[],
    commandsCtx?: SanctuaryCommandsContext,
  ): void {
    const spatialAgents: SpatialAgent[] = Array.from(this.agents.values()).map((a) => ({
      id: a.id,
      position: { x: a.position.x, y: a.position.y, z: a.position.z },
      yaw: a.yaw,
      airborne: a.airborne,
    }))

    const playerVec = context.playerPosition
      ? { x: context.playerPosition[0], y: 0, z: context.playerPosition[1] }
      : null

    for (const agent of this.agents.values()) {
      const previousX = agent.position.x
      const previousY = agent.position.y
      const previousZ = agent.position.z
      const previousYaw = agent.yaw

      if (context.controlMode === 'wyvern' && context.activeWyvernId === agent.id) {
        this.updatePlayerControlledWyvern(agent, dt, context.cameraRotationY ?? 0)
      } else {
        this.updateAgent(agent, dt, context, wyverns, commandsCtx)
      }

      // Head / Gaze targeting
      if (agent.phase === 'settled' && agent.rig.bones.head) {
        const gazeTarget = resolveGazeTarget(
          agent.id,
          { x: agent.position.x, y: agent.position.y, z: agent.position.z },
          playerVec,
          spatialAgents,
        )
        const targetPose = calculateHeadTargetAngles(
          { x: agent.position.x, y: agent.position.y, z: agent.position.z },
          agent.yaw,
          gazeTarget,
        )
        const damped = dampHeadPose({ pitch: agent.headPitch, yaw: agent.headYaw }, targetPose, dt)
        agent.headPitch = damped.pitch
        agent.headYaw = damped.yaw
        agent.rig.bones.head.rotation.set(agent.headPitch, agent.headYaw, 0, 'YXZ')
      } else if (
        !isFlightPhase(agent.phase) &&
        agent.rig.bones.head &&
        (agent.headPitch !== 0 || agent.headYaw !== 0)
      ) {
        const damped = dampHeadPose(
          { pitch: agent.headPitch, yaw: agent.headYaw },
          { pitch: 0, yaw: 0 },
          dt,
        )
        agent.headPitch = damped.pitch
        agent.headYaw = damped.yaw
        agent.rig.bones.head.rotation.set(agent.headPitch, agent.headYaw, 0, 'YXZ')
      }

      // Procedural rig stepping
      const horizontalSpeed =
        Math.hypot(agent.position.x - previousX, agent.position.z - previousZ) /
        Math.max(dt, 1e-4)
      const verticalSpeed = (agent.position.y - previousY) / Math.max(dt, 1e-4)
      const yawRate = angleDelta(agent.yaw, previousYaw) / Math.max(dt, 1e-4)

      const gazeInput = isFlightPhase(agent.phase)
        ? {
            target: playerVec,
            kind: 'player' as const,
            weight: 0.6,
          }
        : null

      agent.rig.step(
        dt,
        {
          position: agent.position,
          yaw: agent.yaw,
          airborne: isFlightPhase(agent.phase),
          flightMode: agent.flightAnimation,
          horizontalSpeed,
          verticalSpeed,
          yawRate,
          phaseTime: agent.phaseTime,
          elapsedTime: context.elapsedTime ?? 0,
        },
        gazeInput,
      )
      agent.rig.sealJaw(agent.activeAction?.state)

      if (isCruisePhase(agent.phase)) {
        const nextAnimation = flightAnimationState(
          agent.flightAnimation,
          agent.rig.flightPose.bank,
          {
            horizontalSpeed,
            verticalSpeed,
            referenceSpeed: TRANSIT_SPEED,
            powered: agent.powered,
            searching: agent.phase === 'circle' || agent.phase === 'patrol',
          },
        )
        if (nextAnimation !== agent.flightAnimation) {
          agent.flightAnimation = nextAnimation
          this.setVisual(agent.id, { state: nextAnimation })
        }
      }

      if (agent.group) {
        agent.group.position.copy(agent.position)
        agent.group.rotation.order = 'YXZ'
        agent.group.rotation.set(
          agent.rig.flightPose.pitch,
          agent.yaw,
          agent.rig.flightPose.bank,
        )
      }

      if (
        agent.phase === 'settled' &&
        agent.purpose === 'assignment' &&
        flatDistance(agent.position, agent.base) <= 1
      ) {
        agent.purpose = null
      }
    }
  }

  private updateAgent(
    agent: Agent,
    dt: number,
    context: SanctuaryDirectorStepContext,
    wyverns: WyvernInstance[],
    commandsCtx?: SanctuaryCommandsContext,
  ): void {
    agent.phaseTime += dt
    agent.powered = agent.phase !== 'soaring'

    if (agent.phase === 'settled') {
      if (agent.purpose === null && flatDistance(agent.position, agent.base) > 1) {
        agent.purpose = 'assignment'
        this.startJourney(agent, agent.base, 'assignment')
      }
      this.runQueued(agent, wyverns, context.colliders ?? [], commandsCtx)
      if (agent.purpose === null && agent.queued === null && agent.baseState === 'idle') {
        this.updateAmbient(agent, dt, wyverns)
      }
      return
    }

    if (agent.phase === 'takeoff') {
      const t = smooth01(agent.phaseTime / TAKEOFF_SECONDS)
      agent.position.y = agent.phaseStartY + (TRANSIT_ALTITUDE - agent.phaseStartY) * t
      if (t >= 1) {
        agent.airborne = true
        if (agent.purpose === 'circle' || agent.purpose === 'takeOff') {
          agent.phase = 'circle'
          agent.phaseTime = 0
          agent.flightAnimation = 'cruise'
          agent.patrolAngle = Math.atan2(
            (agent.position.z - PATROL.center[1]) / PATROL.radiusZ,
            (agent.position.x - PATROL.center[0]) / PATROL.radiusX,
          )
          this.setVisual(agent.id, { state: 'cruise', action: null })
        } else if (agent.purpose === 'follow') {
          agent.phase = 'following'
          agent.phaseTime = 0
          agent.flightAnimation = 'cruise'
          this.setVisual(agent.id, { state: 'cruise', action: null })
        } else if (agent.purpose === 'soar') {
          agent.phase = 'soaring'
          agent.phaseTime = 0
          agent.flightAnimation = 'cruise'
          this.setVisual(agent.id, { state: 'cruise', action: null })
        } else if (agent.purpose === 'hover') {
          agent.phase = 'hovering'
          agent.phaseTime = 0
          agent.flightAnimation = 'cruise'
          this.setVisual(agent.id, { state: 'cruise', action: null })
        } else {
          agent.phase = agent.purpose === 'return' ? 'returning' : 'transit'
          agent.phaseTime = 0
          agent.flightAnimation = 'cruise'
          this.setVisual(agent.id, { state: 'cruise', action: null })
        }
        this.runQueued(agent, wyverns, context.colliders ?? [], commandsCtx)
      }
      return
    }

    if (agent.phase === 'circle' || agent.phase === 'patrol') {
      agent.patrolAngle += PATROL.speed * dt
      const x = PATROL.center[0] + Math.cos(agent.patrolAngle) * PATROL.radiusX
      const z = PATROL.center[1] + Math.sin(agent.patrolAngle) * PATROL.radiusZ
      agent.position.set(x, PATROL.altitude, z)
      agent.yaw = Math.atan2(
        -Math.sin(agent.patrolAngle) * PATROL.radiusX,
        Math.cos(agent.patrolAngle) * PATROL.radiusZ,
      )
      return
    }

    if (agent.phase === 'following') {
      const playerPos = context.playerPosition ?? [0, 0]
      const orbitAngle = agent.phaseTime * 0.9
      const targetX = playerPos[0] + Math.cos(orbitAngle) * 9
      const targetZ = playerPos[1] + Math.sin(orbitAngle) * 9
      const targetY = 20

      const moveX = (targetX - agent.position.x) * Math.min(1, 4 * dt)
      const moveY = (targetY - agent.position.y) * Math.min(1, 4 * dt)
      const moveZ = (targetZ - agent.position.z) * Math.min(1, 4 * dt)

      agent.position.x += moveX
      agent.position.y += moveY
      agent.position.z += moveZ

      const actualSpeed = Math.hypot(moveX, moveZ)
      if (actualSpeed > 1e-3) {
        const targetYaw = Math.atan2(moveX, moveZ)
        const delta = angleDelta(targetYaw, agent.yaw)
        agent.yaw += delta * Math.min(1, 8 * dt)
      }
      return
    }

    if (agent.phase === 'soaring') {
      const angle = agent.phaseTime * 0.2
      const x = PATROL.center[0] + Math.cos(angle) * (PATROL.radiusX * 1.25)
      const z = PATROL.center[1] + Math.sin(angle * 0.8) * (PATROL.radiusZ * 1.25)
      const y = 40 + Math.sin(angle * 0.5) * 4

      agent.position.set(x, y, z)
      const dx = -Math.sin(angle) * (PATROL.radiusX * 1.25)
      const dz = Math.cos(angle * 0.8) * 0.8 * (PATROL.radiusZ * 1.25)
      agent.yaw = Math.atan2(dx, dz)
      return
    }

    if (agent.phase === 'hovering') {
      const hoverY = 18 + Math.sin(agent.phaseTime * 2.5) * 0.5
      agent.position.y = hoverY
      return
    }

    if (agent.phase === 'transit' || agent.phase === 'returning') {
      if (!agent.destination) return
      if (moveFlat(agent, agent.destination, TRANSIT_SPEED, dt) <= 1.5) {
        this.startLanding(agent, agent.destination)
      }
      return
    }

    if (agent.phase === 'landing') {
      const t = smooth01(agent.phaseTime / LAND_SECONDS)
      agent.position.y = agent.phaseStartY * (1 - t)
      if (t >= 1) {
        agent.position.y = 0
        agent.airborne = false
        this.onLanded(agent, wyverns, context.colliders ?? [], commandsCtx)
      }
      return
    }

    if (agent.phase === 'acting') {
      if (agent.phaseTime >= agent.currentActionDuration) {
        const returnAfter = agent.returnAfterAction
        agent.returnAfterAction = false
        this.setVisual(agent.id, { action: null, showFood: false })
        if (commandsCtx) commandsCtx.clearPlayerInteraction()
        if (returnAfter) this.startJourney(agent, agent.base, 'return')
        else this.settle(agent)
      }
      return
    }

    if (agent.phase === 'approachingPlayer') return
  }

  private onLanded(
    agent: Agent,
    wyverns: WyvernInstance[],
    colliders: readonly SanctuaryCollider[],
    commandsCtx?: SanctuaryCommandsContext,
  ): void {
    if (agent.destination) {
      agent.position.x = agent.destination[0]
      agent.position.z = agent.destination[1]
    }
    agent.destination = null

    if (agent.queued) {
      const request = agent.queued
      agent.queued = null
      this.settle(agent)
      if (commandsCtx) {
        this.dispatchCommand(request, wyverns, colliders, commandsCtx)
      }
      return
    }
    if (agent.purpose === 'attack' && agent.attackTarget) {
      face(agent, agent.attackTarget)
      this.playAction(agent, 'attack', 3.34, false, commandsCtx)
      return
    }

    this.settle(agent)
  }

  public settle(agent: Agent): void {
    agent.phase = 'settled'
    agent.phaseTime = 0
    agent.airborne = false
    agent.destination = null
    agent.attackTarget = null
    const atBase = flatDistance(agent.position, agent.base) <= 1
    if (atBase) agent.purpose = null
    this.setVisual(agent.id, {
      state: atBase ? agent.baseState : 'idle',
      action: null,
      showFood: false,
    })
  }

  public startJourney(agent: Agent, destination: SanctuaryPoint, purpose: Purpose): void {
    agent.destination = destination
    agent.purpose = purpose
    agent.attackTarget = purpose === 'attack' ? agent.attackTarget : null
    if (!agent.airborne) this.startTakeoff(agent, purpose)
    else {
      agent.phase = purpose === 'return' || purpose === 'assignment' ? 'returning' : 'transit'
      agent.phaseTime = 0
      agent.flightAnimation = 'cruise'
      this.setVisual(agent.id, { state: 'cruise', action: null, showFood: false })
    }
  }

  public startTakeoff(agent: Agent, purpose: Purpose): void {
    if (agent.destination) {
      face(agent, agent.destination)
    }
    agent.purpose = purpose
    agent.phase = 'takeoff'
    agent.phaseTime = 0
    agent.phaseStartY = agent.position.y
    agent.flightAnimation = 'cruise'
    this.setVisual(agent.id, { state: 'fly', action: null, showFood: false })
  }

  public startLandCommand(agent: Agent): void {
    const occupied = new Set<number>()
    for (const other of this.agents.values()) {
      if (other.id === agent.id || other.airborne) continue
      const index = PERCHES.findIndex(
        (perch) => flatDistance(other.position, perch) < 2,
      )
      if (index >= 0) occupied.add(index)
    }
    const index = findNearestAvailablePerch(
      [agent.position.x, agent.position.z],
      PERCHES,
      occupied,
    )
    const destination = index === null ? agent.base : PERCHES[index]!
    this.startJourney(agent, destination, 'land')
  }

  public startLanding(agent: Agent, destination: SanctuaryPoint): void {
    agent.destination = destination
    agent.phase = 'landing'
    agent.phaseTime = 0
    agent.phaseStartY = agent.position.y
    face(agent, destination)
    agent.flightAnimation = 'cruise'
    this.setVisual(agent.id, { state: 'land', action: null, showFood: false })
  }

  private startPlayerApproach(
    agent: Agent,
    request: SanctuaryCommandRequest,
    colliders: readonly SanctuaryCollider[],
    commandsCtx: SanctuaryCommandsContext,
  ): void {
    const interaction = interactionPoint(
      agent,
      colliders,
      this.jawWorldScratch,
      [agent.position.x, agent.position.z],
    )
    if (!interaction) {
      commandsCtx.setStatus('There is no clear space beside this wyvern.')
      this.settle(agent)
      return
    }
    agent.phase = 'approachingPlayer'
    agent.phaseTime = 0
    agent.queued = request
    const gesture = request.kind === 'offerFood' ? 'offer' : request.kind === 'pet' ? 'pet' : 'calm'
    agent.playerMoveToken = commandsCtx.movePlayer(
      interaction.position,
      gesture,
      interaction.face,
    )
    commandsCtx.setStatus(`Approaching to ${commandName(request.kind).toLowerCase()}…`)
  }

  private playContactAction(
    agent: Agent,
    kind: SanctuaryCommand,
    commandsCtx: SanctuaryCommandsContext,
  ): void {
    if (kind === 'offerFood') this.playAction(agent, 'eat', EAT_SECONDS, true, commandsCtx)
    else if (kind === 'pet') this.playAction(agent, 'nuzzle', 4, false, commandsCtx)
    else this.playAction(agent, 'calm', 5, false, commandsCtx)
  }

  public playAction(
    agent: Agent,
    state: ModelState,
    duration: number,
    showFood = false,
    commandsCtx?: SanctuaryCommandsContext,
  ): void {
    agent.phase = 'acting'
    agent.phaseTime = 0
    agent.actionToken += 1
    agent.activeAction = { state, token: agent.actionToken }
    this.setVisual(agent.id, {
      action: { state, token: agent.actionToken },
      showFood,
    })
    if (commandsCtx) {
      commandsCtx.setStatus(`${state === 'nuzzle' ? 'Petting' : title(state)}…`)
    }
    agent.currentActionDuration = duration
  }

  public playReaction(wyvernId: string, state: ModelState, duration = 4.5): void {
    const agent = this.agents.get(wyvernId)
    if (!agent) return
    this.playAction(agent, state, duration, state === 'eat')
  }

  private runQueued(
    agent: Agent,
    wyverns: WyvernInstance[],
    colliders: readonly SanctuaryCollider[],
    commandsCtx?: SanctuaryCommandsContext,
  ): void {
    if (!agent.queued) return
    const request = agent.queued
    agent.queued = null
    if (commandsCtx) {
      this.dispatchCommand(request, wyverns, colliders, commandsCtx)
    }
  }

  private updateAmbient(
    agent: Agent,
    dt: number,
    wyverns: WyvernInstance[],
    placedObjects?: readonly { propId: string; position: readonly [number, number, number] }[],
  ): void {
    agent.ambientDwell -= dt
    if (agent.ambientDwell > 0) return

    agent.ambientRoll += 1

    if (agent.ambientAction !== null) {
      const rng = createRng(deriveSeed(this.seed, `${agent.id}:ambient-end:${agent.ambientRoll}`))
      agent.ambientDwell = rng.range(AMBIENT_MIN_DWELL, AMBIENT_MAX_DWELL)
      this.setVisual(agent.id, { state: agent.ambientAction === 'sit' ? 'rise' : 'idle' })
      agent.ambientAction = null
      return
    }

    const wyvern = wyverns.find((candidate) => candidate.id === agent.id)

    let drinkBonus = 0
    let eatBonus = 0
    let perchBonus = 0
    let groomBonus = 0
    let sleepBonus = 0
    let sitBonus = 0

    if (placedObjects && placedObjects.length > 0) {
      for (const obj of placedObjects) {
        const dx = agent.position.x - obj.position[0]
        const dz = agent.position.z - obj.position[2]
        const distSq = dx * dx + dz * dz
        if (distSq < 64) {
          if (obj.propId === 'prop.forge.trough' || obj.propId === 'prop.barrel') {
            drinkBonus += 1.5
            eatBonus += 0.8
          } else if (
            obj.propId === 'prop.perch.trunk' ||
            obj.propId === 'prop.perch.stump' ||
            obj.propId === 'prop.perch.rockA' ||
            obj.propId === 'prop.perch.rockB'
          ) {
            perchBonus += 1.5
            sitBonus += 0.8
          } else if (
            obj.propId === 'prop.ring.menhir' ||
            obj.propId === 'prop.roost.runeStone'
          ) {
            groomBonus += 1.5
            sleepBonus += 0.8
          } else if (
            obj.propId === 'prop.burn.lavaColumn' ||
            obj.propId === 'prop.burn.lavaStone'
          ) {
            sleepBonus += 1.0
            sitBonus += 1.0
          }
        }
      }
    }

    const candidates: { state: ModelState; weight: number }[] = [
      { state: 'sleep', weight: 1 + sleepBonus + (wyvern ? wyvern.injury / 40 : 0) },
      { state: 'sit', weight: 1 + sitBonus },
      { state: 'groom', weight: 1 + groomBonus + (wyvern && wyvern.bond > 60 ? 0.5 : 0) },
      { state: 'eat', weight: 1 + eatBonus + (wyvern ? wyvern.hunger / 30 : 0) },
      { state: 'drink', weight: 0.6 + drinkBonus },
      { state: 'perch', weight: 0.8 + perchBonus },
    ]
    const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weight, 0)
    const rng = createRng(deriveSeed(this.seed, `${agent.id}:ambient-pick:${agent.ambientRoll}`))
    let roll = rng.range(0, totalWeight)
    let picked: ModelState = candidates[candidates.length - 1]!.state
    for (const candidate of candidates) {
      if (roll < candidate.weight) {
        picked = candidate.state
        break
      }
      roll -= candidate.weight
    }
    this.setVisual(agent.id, { state: picked })
    agent.ambientAction = picked
    agent.ambientDwell = rng.range(AMBIENT_MIN_HOLD, AMBIENT_MAX_HOLD)
  }
}

export function createSanctuaryDirector(options?: SanctuaryDirectorOptions): SanctuaryDirector {
  return new SanctuaryDirector(options)
}
