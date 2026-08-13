'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Plane, Raycaster, Vector2, Vector3 } from 'three'
import type { WyvernInstance } from '@/core/types'
import type { ModelState } from '@/render/assets/manifest'
import { clamp } from '@/core/math/vec'
import { createRng, deriveSeed } from '@/core/math/rng'
import { consumeClick, pointer } from '@/render/controllers/input'
import { readDirectWyvernFlightInput, stepDirectWyvernFlight } from '@/render/controllers/wyvernFlight'
import { applyBoneOffset, applyLegTuck } from '@/render/boneOffsets'
import { captureClosedJawPose, isMouthAction, sealFlightJaw } from '@/render/flightMouth'
import { propagateFullBodyWave, calculatePhase } from '@/render/spineWave'
import { createTailState, dynamicTailController } from '@/render/tailController'
import { createLegsState, dynamicLegController } from '@/render/legPhysics'
import {
  intelligentHeadNeckController,
  fromSpatialTarget,
  horizonTarget,
  type GazeTarget,
  type FlightContext,
} from '@/render/gazeController'
import {
  angleDelta,
  dampFlightPose,
  dampHeadNeckPose,
  dampLegTuck,
  flightAnimationState,
  flightPoseTargets,
  headNeckTargets,
  legTuckTarget,
} from '@/render/flightPose'
import {
  useSanctuaryCommands,
  type SanctuaryCommand,
  type SanctuaryCommandRequest,
} from '@/state/sanctuaryCommands'
import { SanctuaryDust } from './atmosphere/SanctuaryDust'
import { SanctuaryWildlife } from './atmosphere/SanctuaryWildlife'
import { useCameraStore } from '@/state/cameraStore'
import { usePlayerControlStore } from '@/state/playerControlStore'
import { useGame } from '@/state/store'
import { useHighlandsHunt } from '@/state/highlandsHuntStore'
import {
  GROUND_RADIUS,
  PATROL,
  PERCHES,
} from './layout'
import {
  allocateStablePerches,
  findNearestAvailablePerch,
  findSafeAttackLanding,
  stableIdHash,
  yawToward,
  type PerchAssignments,
  type SanctuaryCollider,
  type SanctuaryPoint,
} from './commandLogic'
import {
  calculateHeadTargetAngles,
  dampHeadPose,
  resolveGazeTarget,
  type SpatialAgent,
} from './director/spatialAwareness'
import {
  baseFor,
  commandName,
  flatDistance,
  hasAttackTargetBlocker,
  interactionPoint,
  isActorClearTarget,
  isCruisePhase,
  isFlightPhase,
  isNonInterruptible,
  phaseLabel,
  round2,
  smooth01,
  type Agent,
  type Purpose,
  type VisualState,
} from './director/wyvernDirector'
import {
  modelHeight,
  SanctuaryWyvernActor,
} from './components/SanctuaryWyvernActor'
import {
  AttackTargetReticle,
  PatrolMarkers,
} from './components/AttackTargetPicker'

const TAKEOFF_SECONDS = 8.12
const LAND_SECONDS = 4.67
const EAT_SECONDS = 6 / 0.85
const TRANSIT_SPEED = 18
const TRANSIT_ALTITUDE = 22
const NEAR_ATTACK = 12
const GROUND = new Plane(new Vector3(0, 1, 0), 0)

let rememberedPerchAssignments: PerchAssignments = {}

interface SanctuaryWyvernsProps {
  wyverns: WyvernInstance[]
  colliders: readonly SanctuaryCollider[]
  /** Save seed, for deterministic-per-agent (but purely cosmetic) ambient rolls. */
  seed: number
}

const AMBIENT_MIN_DWELL = 15
const AMBIENT_MAX_DWELL = 45
const AMBIENT_MIN_HOLD = 8
const AMBIENT_MAX_HOLD = 20

export function SanctuaryWyverns({ wyverns, colliders, seed }: SanctuaryWyvernsProps) {
  const camera = useThree((state) => state.camera)
  const scene = useThree((state) => state.scene)
  const size = useThree((state) => state.size)
  const agents = useRef(new Map<string, Agent>())
  const perchAssignments = useRef<PerchAssignments>(rememberedPerchAssignments)
  const raycaster = useRef(new Raycaster())
  const ndc = useRef(new Vector2())
  const projected = useRef(new Vector3())
  const jawWorld = useRef(new Vector3())
  const anchorClock = useRef(0)
  const [visuals, setVisuals] = useState<Record<string, VisualState>>({})
  const selectedId = useSanctuaryCommands((state) => state.selectedWyvernId)

  const ids = wyverns.map((wyvern) => wyvern.id)
  const idKey = ids.join('|')
  perchAssignments.current = allocateStablePerches(
    ids,
    PERCHES.length,
    perchAssignments.current,
  )
  useEffect(() => {
    rememberedPerchAssignments = perchAssignments.current
  }, [idKey])

  const bases = useMemo(() => {
    const result = new Map<string, { position: SanctuaryPoint; state: ModelState }>()
    for (const wyvern of wyverns) {
      result.set(wyvern.id, baseFor(wyvern, perchAssignments.current))
    }
    return result
  }, [idKey, wyverns])

  const baseSignature = wyverns
    .map((wyvern) => {
      const base = bases.get(wyvern.id)
      return `${wyvern.id}:${base?.position[0]},${base?.position[1]}:${base?.state}`
    })
    .join('|')

  useEffect(() => {
    const live = new Set(ids)
    for (const [id] of agents.current) {
      if (!live.has(id)) agents.current.delete(id)
    }

    setVisuals((current) => {
      const next = { ...current }
      for (const id of Object.keys(next)) {
        if (!live.has(id)) delete next[id]
      }
      for (const wyvern of wyverns) {
        const base = bases.get(wyvern.id)!
        const existing = agents.current.get(wyvern.id)
        if (existing) {
          existing.base = base.position
          existing.baseState = base.state
          continue
        }
        const angle =
          wyvern.assignment.kind === 'idle'
            ? yawToward(base.position, PATROL.center)
            : ((stableIdHash(wyvern.id) % 1000) / 1000) * Math.PI * 2
        agents.current.set(wyvern.id, {
          id: wyvern.id,
          group: null,
          jaw: null,
          jawClosed: null,
          headBone: null,
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
          currentActionDuration: 4,
          playerMoveToken: null,
          patrolAngle: angle,
          returnAfterAction: false,
          flightPose: { pitch: 0, bank: 0 },
          headNeckPose: { neckPitch: 0, neckYaw: 0, headPitch: 0, headYaw: 0, headRoll: 0 },
          intelligentHeadNeck: {
            neckPitch: 0,
            neckYaw: 0,
            headPitch: 0,
            headYaw: 0,
            headRoll: 0,
            lastTargetWorld: new Vector3(0, 0, 1),
            trackingVelocity: 0,
          },
          neckBones: [],
          spineBones: [],
          legBones: [],
          tailBones: [],
          tailState: createTailState(),
          legsState: createLegsState(),
          flightLegTuck: 0,
          flightAnimation: 'cruise',
          powered: true,
          // Staggered by id so freshly-created agents don't all roll their
          // first ambient action on the same frame.
          ambientDwell: AMBIENT_MIN_DWELL + (stableIdHash(wyvern.id) % 30),
          ambientRoll: 0,
          ambientAction: null,
        })
        next[wyvern.id] = { state: base.state, action: null, showFood: false }
      }
      return next
    })
  }, [baseSignature, idKey])

  const setVisual = (id: string, patch: Partial<VisualState>) => {
    setVisuals((current) => {
      const old = current[id]
      if (!old) return current
      const next = { ...old, ...patch }
      if (
        old.state === next.state &&
        old.action?.token === next.action?.token &&
        old.showFood === next.showFood
      ) {
        return current
      }
      return { ...current, [id]: next }
    })
  }

  useFrame((threeState, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    const commands = useSanctuaryCommands.getState()
    const selected = commands.selectedWyvernId
    const selectedWyvern = wyverns.find((wyvern) => wyvern.id === selected)
    const selectedAgent = selected ? agents.current.get(selected) : undefined

    if (commands.targetMode && selectedAgent) {
      ndc.current.set(pointer.x, pointer.y)
      raycaster.current.setFromCamera(ndc.current, camera)
      const hit = new Vector3()
      const hasHit = raycaster.current.ray.intersectPlane(GROUND, hit) !== null
      const target: SanctuaryPoint | null = hasHit ? [hit.x, hit.z] : null
      const blocker = target
        ? raycaster.current
            .intersectObjects(scene.children, true)
            .find(
              (intersection) =>
                hasAttackTargetBlocker(intersection.object) &&
                intersection.distance < raycaster.current.ray.origin.distanceTo(hit),
            )
        : null
      const actorsClear = target
        ? isActorClearTarget(target, agents.current.values(), commands.playerPosition)
        : false
      const landing = target && !blocker && actorsClear
        ? findSafeAttackLanding(
            target,
            [selectedAgent.position.x, selectedAgent.position.z],
            {
              boundsRadius: GROUND_RADIUS,
              colliders,
              targetClearance: 0.75,
              landingClearance: 5.5,
            },
          )
        : null
      commands.previewTarget(target ? [round2(target[0]), round2(target[1])] : null, landing !== null)
      if (consumeClick()) {
        if (target && landing) commands.confirmAttack([target[0], target[1]])
        else commands.rejectTarget()
      }
    }

    if (
      selectedAgent &&
      commands.request &&
      commands.request.wyvernId === selectedAgent.id &&
      commands.request.token !== selectedAgent.lastRequestToken
    ) {
      selectedAgent.lastRequestToken = commands.request.token
      if (isNonInterruptible(selectedAgent.phase)) {
        selectedAgent.queued = commands.request
        commands.setStatus(`${commandName(commands.request.kind)} queued.`)
        commands.acknowledgeCommand(commands.request.token)
      } else {
        beginCommand(selectedAgent, commands.request)
        commands.acknowledgeCommand(commands.request.token)
      }
    }

    const playerMoveResult = commands.playerMoveResult
    if (playerMoveResult) {
      for (const agent of agents.current.values()) {
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
          commands.acknowledgePlayerMove()
          playContactAction(agent, request.kind)
        } else {
          commands.clearPlayerInteraction()
          settle(agent)
          commands.setStatus('Interaction cancelled.')
        }
        break
      }
    }

    // Spatial Awareness: Collect positions of spatial agents
    const spatialAgents: SpatialAgent[] = Array.from(agents.current.values()).map((a) => ({
      id: a.id,
      position: { x: a.position.x, y: a.position.y, z: a.position.z },
      yaw: a.yaw,
      airborne: a.airborne,
    }))
    const playerVec = commands.playerPosition
      ? { x: commands.playerPosition[0], y: 0, z: commands.playerPosition[1] }
      : null

    const { controlMode, activeWyvernId } = usePlayerControlStore.getState()

    for (const agent of agents.current.values()) {
      const previousX = agent.position.x
      const previousY = agent.position.y
      const previousZ = agent.position.z
      const previousYaw = agent.yaw

      if (controlMode === 'wyvern' && activeWyvernId === agent.id) {
        updatePlayerControlledWyvern(agent, dt)
      } else {
        updateAgent(agent, dt)
      }

      // Environmental Perception & Gaze Tracking
      if (agent.phase === 'settled' && agent.headBone) {
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
        agent.headBone.rotation.set(agent.headPitch, agent.headYaw, 0, 'YXZ')
      } else if (
        !isFlightPhase(agent.phase) &&
        agent.headBone &&
        (agent.headPitch !== 0 || agent.headYaw !== 0)
      ) {
        const damped = dampHeadPose(
          { pitch: agent.headPitch, yaw: agent.headYaw },
          { pitch: 0, yaw: 0 },
          dt,
        )
        agent.headPitch = damped.pitch
        agent.headYaw = damped.yaw
        agent.headBone.rotation.set(agent.headPitch, agent.headYaw, 0, 'YXZ')
      }

      if (agent.group) {
        agent.group.position.copy(agent.position)
        const horizontalSpeed =
          Math.hypot(agent.position.x - previousX, agent.position.z - previousZ) /
          Math.max(dt, 1e-4)
        const verticalSpeed = (agent.position.y - previousY) / Math.max(dt, 1e-4)
        const yawRate = angleDelta(agent.yaw, previousYaw) / Math.max(dt, 1e-4)
        const target = isFlightPhase(agent.phase)
          ? flightPoseTargets(
              verticalSpeed,
              horizontalSpeed,
              yawRate,
              agent.phaseTime,
              TRANSIT_SPEED,
            )
          : { pitch: 0, bank: 0 }
        agent.flightPose = dampFlightPose(agent.flightPose, target, dt)

        const targetHeadNeck = isFlightPhase(agent.phase)
          ? headNeckTargets(
              horizontalSpeed,
              verticalSpeed,
              yawRate,
              agent.flightPose.pitch,
              agent.flightPose.bank,
              TRANSIT_SPEED,
            )
          : { neckPitch: 0, neckYaw: 0, headPitch: 0, headYaw: 0, headRoll: 0 }
        agent.headNeckPose = dampHeadNeckPose(agent.headNeckPose, targetHeadNeck, dt)
        
        // PHASE 2: Intelligent head/neck controller for flight
        // Applies predictive gaze tracking with mode-specific behavior
        if (isFlightPhase(agent.phase)) {
          // Build gaze target from current focus
          const gazeTarget: GazeTarget | null = playerVec
            ? fromSpatialTarget(
                { x: playerVec.x, y: playerVec.y, z: playerVec.z },
                'player',
                0.6
              )
            : horizonTarget()
          
          // Build body pose for controller
          const bodyPose = {
            position: agent.position,
            velocity: new Vector3(
              agent.position.x - previousX,
              agent.position.y - previousY,
              agent.position.z - previousZ
            ).divideScalar(Math.max(dt, 0.001)),
            yaw: agent.yaw,
            pitch: agent.flightPose.pitch,
            bank: agent.flightPose.bank,
          }
          
          // Build flight context
          const flightContext: FlightContext = {
            horizontalSpeed,
            verticalSpeed,
            turnRate: yawRate,
            turbulence: Math.abs(verticalSpeed) > 5 ? 0.3 : 0,
            flightMode: agent.flightAnimation,
            time: agent.phaseTime,
          }
          
          // Update intelligent head/neck controller
          agent.intelligentHeadNeck = intelligentHeadNeckController(
            bodyPose,
            gazeTarget,
            flightContext,
            agent.intelligentHeadNeck,
            dt
          )
          
          // Blend intelligent controller output with aerodynamic pose
          // Intelligent adds on top of aerodynamic, prioritized by tracking velocity
          const blendFactor = clamp(agent.intelligentHeadNeck.trackingVelocity * 0.1, 0, 0.4)
          agent.headNeckPose.neckPitch += agent.intelligentHeadNeck.neckPitch * blendFactor
          agent.headNeckPose.neckYaw += agent.intelligentHeadNeck.neckYaw * blendFactor
          agent.headNeckPose.headPitch += agent.intelligentHeadNeck.headPitch * blendFactor
          agent.headNeckPose.headYaw += agent.intelligentHeadNeck.headYaw * blendFactor
          agent.headNeckPose.headRoll += agent.intelligentHeadNeck.headRoll * blendFactor
        }
        
        agent.flightLegTuck = dampLegTuck(
          agent.flightLegTuck,
          isFlightPhase(agent.phase) ? legTuckTarget(horizontalSpeed, TRANSIT_SPEED) : 0,
          dt,
        )

        if (isCruisePhase(agent.phase)) {
          // Speed is now passed for every cruise phase, not just 'hovering'.
          // That used to risk entering hover on a slow patrol turn; what makes
          // it safe is that 'soaring' — the one phase whose orbit dips below
          // the hover threshold — declares itself unpowered, and glide outranks
          // hover in the selector. Every other cruise phase stays above 6.
          const nextAnimation = flightAnimationState(
            agent.flightAnimation,
            agent.flightPose.bank,
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
            setVisual(agent.id, { state: nextAnimation })
          }
        }

        agent.group.rotation.order = 'YXZ'
        agent.group.rotation.set(
          agent.flightPose.pitch,
          agent.yaw,
          agent.flightPose.bank,
        )

        if (isFlightPhase(agent.phase)) {
          // The mixer writes the authored neck/leg pose first. Compose the
          // measured aerodynamic response onto it; setting Euler angles here
          // would discard the clip's mode-specific carriage every frame.
          
          // PHASE 1: Spine wave propagation for fluid body coordination
          const phase = calculatePhase(agent.phaseTime)
          propagateFullBodyWave(
            { spine: agent.spineBones, neck: agent.neckBones },
            phase,
            horizontalSpeed,
            yawRate
          )
          
          // Existing neck pose (now additive on top of spine wave)
          agent.neckBones.forEach((bone) => {
            applyBoneOffset(bone, agent.headNeckPose.neckPitch, agent.headNeckPose.neckYaw)
          })
          applyBoneOffset(
            agent.headBone,
            agent.headNeckPose.headPitch,
            agent.headNeckPose.headYaw,
            agent.headNeckPose.headRoll,
          )
          for (const chain of agent.legBones) {
            applyLegTuck(chain, agent.flightLegTuck)
          }
          agent.tailState = dynamicTailController(
            agent.tailBones,
            yawRate,
            agent.flightPose.bank,
            horizontalSpeed,
            agent.flightAnimation,
            0.5,
            threeState.clock.elapsedTime,
            agent.tailState,
            dt,
          )
          agent.legsState = dynamicLegController(
            agent.legBones[0] ?? [],
            agent.legBones[1] ?? [],
            yawRate,
            horizontalSpeed,
            verticalSpeed,
            agent.position.y,
            agent.flightAnimation,
            0,
            threeState.clock.elapsedTime,
            agent.legsState,
            dt,
          )
          if (!isMouthAction(agent.activeAction?.state ?? null)) {
            sealFlightJaw(agent.jaw, agent.jawClosed)
          }
        }
      }

      if (
        agent.phase === 'settled' &&
        agent.purpose === 'assignment' &&
        flatDistance(agent.position, agent.base) <= 1
      ) {
        agent.purpose = null
      }
    }

    if (selectedAgent && selectedWyvern) {
      anchorClock.current += dt
      if (anchorClock.current >= 0.05) {
        anchorClock.current = 0
        projected.current
          .set(
            selectedAgent.position.x,
            selectedAgent.position.y + modelHeight(selectedWyvern) * 0.65,
            selectedAgent.position.z,
          )
          .project(camera)
        const visible = projected.current.z > -1 && projected.current.z < 1
        // Keep-out reach so the command wheel never runs off the viewport
        // edge. Mirrors the wheel's own CSS sizing — clamp(272px, 62vmin,
        // 348px) in globals.css — because a fixed margin sized for the
        // desktop-max wheel is too large on a short viewport and too small
        // on a wide one. Buttons orbit inside the disc, so the wheel's own
        // half-width is the whole reach, plus a little breathing room.
        const wheelDiameter = clamp(Math.min(size.width, size.height) * 0.62, 272, 348)
        const reach = wheelDiameter / 2 + 14
        // The topbar's actual height varies (its resource pills wrap onto a
        // second row on narrow viewports), so a static px guess undercounts
        // it there. Measuring the real DOM node keeps the wheel from sliding
        // under it at any viewport size instead of guessing a chrome height.
        const topbarBottom = document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0
        const marginX = Math.min(reach, size.width / 2)
        const marginBottom = Math.min(reach, size.height / 2)
        const marginTop = Math.min(Math.max(reach, topbarBottom + reach), size.height - marginBottom)
        commands.setWheelAnchor({
          x: clamp((projected.current.x * 0.5 + 0.5) * size.width, marginX, size.width - marginX),
          y: clamp((-projected.current.y * 0.5 + 0.5) * size.height, marginTop, size.height - marginBottom),
          visible,
        })
      }
      commands.setAgent({
        phase: selectedAgent.phase,
        airborne: selectedAgent.airborne,
        hatchling: selectedWyvern.stage === 'hatchling',
        adult: selectedWyvern.stage === 'adult',
        label: phaseLabel(selectedAgent),
      })
    } else if (commands.agent) {
      commands.setAgent(null)
    }

    // Broadcast active wyvern position for Camera Follow Wyvern mode
    let wyvernTargetAgent = (controlMode === 'wyvern' && activeWyvernId)
      ? agents.current.get(activeWyvernId)
      : selectedAgent

    if (controlMode === 'wyvern' && useCameraStore.getState().followTarget !== 'wyvern') {
      useCameraStore.getState().setFollowTarget('wyvern')
    } else if (controlMode === 'human' && useCameraStore.getState().followTarget === 'wyvern' && !selectedAgent) {
      useCameraStore.getState().setFollowTarget('character')
    }

    if (!wyvernTargetAgent) {
      for (const agent of agents.current.values()) {
        if (agent.airborne) {
          wyvernTargetAgent = agent
          break
        }
      }
      if (!wyvernTargetAgent && agents.current.size > 0) {
        wyvernTargetAgent = agents.current.values().next().value
      }
    }
    if (wyvernTargetAgent) {
      useCameraStore.getState().setWyvernTargetPosition([
        wyvernTargetAgent.position.x,
        wyvernTargetAgent.position.y + 2.0,
        wyvernTargetAgent.position.z,
      ])
    } else {
      useCameraStore.getState().setWyvernTargetPosition(null)
    }
  })

  const beginCommand = (agent: Agent, request: SanctuaryCommandRequest) => {
    const commands = useSanctuaryCommands.getState()
    const wyvern = wyverns.find((candidate) => candidate.id === agent.id)
    if (agent.phase === 'approachingPlayer') {
      agent.playerMoveToken = null
      commands.clearPlayerInteraction()
    }
    agent.queued = null
    commands.setStatus(null)

    if (request.kind === 'takeOff' || request.kind === 'circle') {
      if (wyvern?.stage === 'hatchling') {
        commands.setStatus('Hatchlings are not ready to take off.')
      } else if (!agent.airborne) {
        startTakeoff(agent, 'circle')
      } else {
        agent.purpose = 'circle'
        agent.phase = 'circle'
        agent.phaseTime = 0
        agent.flightAnimation = 'cruise'
        setVisual(agent.id, { state: 'cruise', action: null })
      }
      return
    }
    if (request.kind === 'follow') {
      if (wyvern?.stage === 'hatchling') {
        commands.setStatus('Hatchlings cannot follow from the air.')
      } else if (!agent.airborne) {
        startTakeoff(agent, 'follow')
      } else {
        agent.purpose = 'follow'
        agent.phase = 'following'
        agent.phaseTime = 0
        agent.flightAnimation = 'cruise'
        setVisual(agent.id, { state: 'cruise', action: null })
      }
      return
    }
    if (request.kind === 'soar') {
      if (wyvern?.stage === 'hatchling') {
        commands.setStatus('Hatchlings cannot soar.')
      } else if (!agent.airborne) {
        startTakeoff(agent, 'soar')
      } else {
        agent.purpose = 'soar'
        agent.phase = 'soaring'
        agent.phaseTime = 0
        agent.flightAnimation = 'cruise'
        setVisual(agent.id, { state: 'cruise', action: null })
      }
      return
    }
    if (request.kind === 'hover') {
      if (wyvern?.stage === 'hatchling') {
        commands.setStatus('Hatchlings cannot hover.')
      } else if (!agent.airborne) {
        startTakeoff(agent, 'hover')
      } else {
        agent.purpose = 'hover'
        agent.phase = 'hovering'
        agent.phaseTime = 0
        agent.flightAnimation = 'cruise'
        setVisual(agent.id, { state: 'cruise', action: null })
      }
      return
    }
    if (request.kind === 'land') {
      if (agent.airborne) startLandCommand(agent)
      return
    }
    if (request.kind === 'return') {
      startJourney(agent, agent.base, 'return')
      return
    }
    if (request.kind === 'findFood') {
      if (wyvern?.stage !== 'adult') {
        commands.setStatus('Only adult wyverns can enter the Highlands hunt test.')
        return
      }
      useHighlandsHunt.getState().open(agent.id)
      useGame.getState().setMode('highlands')
      commands.setStatus('Highlands hunt test opened.')
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
      if (
        !landing ||
        !isActorClearTarget(
          request.target,
          agents.current.values(),
          useSanctuaryCommands.getState().playerPosition,
        )
      ) {
        commands.setStatus('That ground is not safe for an attack.')
        return
      }
      agent.attackTarget = request.target
      agent.purpose = 'attack'
      if (!agent.airborne && flatDistance(agent.position, request.target) <= NEAR_ATTACK) {
        face(agent, request.target)
        playAction(agent, 'attack', 3.34)
      } else {
        if (wyvern?.stage === 'hatchling') {
          commands.setStatus('Choose a point closer to this hatchling.')
          return
        }
        startJourney(agent, landing, 'attack')
      }
      return
    }

    if (request.kind === 'offerFood' || request.kind === 'pet' || request.kind === 'calm') {
      if (agent.airborne) {
        agent.queued = request
        startLandCommand(agent)
      } else {
        startPlayerApproach(agent, request)
      }
    }
  }

  const actionLatch = useRef<{ breath: boolean; attack: boolean }>({ breath: false, attack: false })

  const updatePlayerControlledWyvern = (agent: Agent, dt: number) => {
    agent.phaseTime += dt
    const input = readDirectWyvernFlightInput()
    let action: ModelState | null = null

    if (input.breathing && !actionLatch.current.breath) {
      agent.actionToken += 1
      action = 'breathe'
    }
    actionLatch.current.breath = input.breathing

    if (input.attacking && !actionLatch.current.attack) {
      agent.actionToken += 1
      action = agent.airborne ? 'attackAir' : 'attack'
    }
    actionLatch.current.attack = input.attacking

    const flight = stepDirectWyvernFlight(agent, input, camera.rotation.y, dt, {
      boundsRadius: GROUND_RADIUS,
    })
    agent.phase = flight.airborne ? (flight.climbing ? 'soaring' : 'transit') : 'settled'
    agent.powered = flight.airborne
    setVisual(agent.id, { state: flight.locomotion, action: null })
    // Base locomotion is updated every frame, but an action request is a
    // discrete edge. Apply it last so the frame's cruise/idle update cannot
    // erase the strike before GameModel receives the new token.
    if (action) {
      agent.activeAction = { token: agent.actionToken, state: action }
      setVisual(agent.id, { action: { token: agent.actionToken, state: action } })
    }
  }

  const updateAgent = (agent: Agent, dt: number) => {
    agent.phaseTime += dt
    // The director's soaring orbit is the one phase that is genuinely a ride:
    // a wide Lissajous figure held at 36-44 units with no destination to reach.
    // It is also the only cruise phase whose speed dips under the hover
    // threshold, so declaring it unpowered is what keeps it out of the hover
    // clip — glide outranks hover in the selector for exactly this reason.
    agent.powered = agent.phase !== 'soaring'

    if (agent.phase === 'settled') {
      if (
        agent.purpose === null &&
        flatDistance(agent.position, agent.base) > 1
      ) {
        agent.purpose = 'assignment'
        startJourney(agent, agent.base, 'assignment')
      }
      runQueued(agent)
      // Ambient scheduling only applies to truly idle wyverns (no assignment
      // loop to protect) that didn't just get sent on a journey or a queued
      // command above.
      if (agent.purpose === null && agent.queued === null && agent.baseState === 'idle') {
        updateAmbient(agent, dt)
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
          setVisual(agent.id, { state: 'cruise', action: null })
        } else if (agent.purpose === 'follow') {
          agent.phase = 'following'
          agent.phaseTime = 0
          agent.flightAnimation = 'cruise'
          setVisual(agent.id, { state: 'cruise', action: null })
        } else if (agent.purpose === 'soar') {
          agent.phase = 'soaring'
          agent.phaseTime = 0
          agent.flightAnimation = 'cruise'
          setVisual(agent.id, { state: 'cruise', action: null })
        } else if (agent.purpose === 'hover') {
          agent.phase = 'hovering'
          agent.phaseTime = 0
          agent.flightAnimation = 'cruise'
          setVisual(agent.id, { state: 'cruise', action: null })
        } else {
          agent.phase = agent.purpose === 'return' ? 'returning' : 'transit'
          agent.phaseTime = 0
          agent.flightAnimation = 'cruise'
          setVisual(agent.id, { state: 'cruise', action: null })
        }
        runQueued(agent)
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
      const playerPos = useSanctuaryCommands.getState().playerPosition
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
        startLanding(agent, agent.destination)
      }
      return
    }

    if (agent.phase === 'landing') {
      const t = smooth01(agent.phaseTime / LAND_SECONDS)
      agent.position.y = agent.phaseStartY * (1 - t)
      if (t >= 1) {
        agent.position.y = 0
        agent.airborne = false
        onLanded(agent)
      }
      return
    }

    if (agent.phase === 'acting') {
      const duration = actionDuration(agent)
      if (agent.phaseTime >= duration) {
        const returnAfter = agent.returnAfterAction
        agent.returnAfterAction = false
        setVisual(agent.id, { action: null, showFood: false })
        useSanctuaryCommands.getState().clearPlayerInteraction()
        if (returnAfter) startJourney(agent, agent.base, 'return')
        else settle(agent)
      }
      return
    }

    if (agent.phase === 'approachingPlayer') return
  }

  const onLanded = (agent: Agent) => {
    if (agent.destination) {
      agent.position.x = agent.destination[0]
      agent.position.z = agent.destination[1]
    }
    agent.destination = null

    if (agent.queued) {
      const request = agent.queued
      agent.queued = null
      settle(agent)
      beginCommand(agent, request)
      return
    }
    if (agent.purpose === 'attack' && agent.attackTarget) {
      face(agent, agent.attackTarget)
      playAction(agent, 'attack', 3.34)
      return
    }

    settle(agent)
  }

  const startPlayerApproach = (agent: Agent, request: SanctuaryCommandRequest) => {
    const commands = useSanctuaryCommands.getState()
    const interaction = interactionPoint(
      agent,
      colliders,
      jawWorld.current,
      commands.playerPosition,
    )
    if (!interaction) {
      commands.setStatus('There is no clear space beside this wyvern.')
      settle(agent)
      return
    }
    agent.phase = 'approachingPlayer'
    agent.phaseTime = 0
    agent.queued = request
    const gesture = request.kind === 'offerFood' ? 'offer' : request.kind === 'pet' ? 'pet' : 'calm'
    agent.playerMoveToken = commands.movePlayer(
      interaction.position,
      gesture,
      interaction.face,
    )
    commands.setStatus(`Approaching to ${commandName(request.kind).toLowerCase()}…`)
  }

  const playContactAction = (agent: Agent, kind: SanctuaryCommand) => {
    if (kind === 'offerFood') playAction(agent, 'eat', EAT_SECONDS, true)
    else if (kind === 'pet') playAction(agent, 'nuzzle', 4)
    else playAction(agent, 'calm', 5)
  }

  const playAction = (
    agent: Agent,
    state: ModelState,
    duration: number,
    showFood = false,
  ) => {
    agent.phase = 'acting'
    agent.phaseTime = 0
    agent.actionToken += 1
    agent.activeAction = { state, token: agent.actionToken }
    setVisual(agent.id, {
      action: { state, token: agent.actionToken },
      showFood,
    })
    useSanctuaryCommands.getState().setStatus(`${state === 'nuzzle' ? 'Petting' : title(state)}…`)
    agent.currentActionDuration = duration
  }

  const startJourney = (agent: Agent, destination: SanctuaryPoint, purpose: Purpose) => {
    agent.destination = destination
    agent.purpose = purpose
    agent.attackTarget = purpose === 'attack' ? agent.attackTarget : null
    if (!agent.airborne) startTakeoff(agent, purpose)
    else {
      agent.phase = purpose === 'return' || purpose === 'assignment' ? 'returning' : 'transit'
      agent.phaseTime = 0
      agent.flightAnimation = 'cruise'
      setVisual(agent.id, { state: 'cruise', action: null, showFood: false })
    }
  }

  const startTakeoff = (agent: Agent, purpose: Purpose) => {
    if (agent.destination) {
      face(agent, agent.destination)
    }
    agent.purpose = purpose
    agent.phase = 'takeoff'
    agent.phaseTime = 0
    agent.phaseStartY = agent.position.y
    agent.flightAnimation = 'cruise'
    setVisual(agent.id, { state: 'fly', action: null, showFood: false })
  }

  const startLandCommand = (agent: Agent) => {
    const occupied = new Set<number>()
    for (const other of agents.current.values()) {
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
    startJourney(agent, destination, 'land')
  }

  const startLanding = (agent: Agent, destination: SanctuaryPoint) => {
    agent.destination = destination
    agent.phase = 'landing'
    agent.phaseTime = 0
    agent.phaseStartY = agent.position.y
    face(agent, destination)
    agent.flightAnimation = 'cruise'
    setVisual(agent.id, { state: 'land', action: null, showFood: false })
  }

  const settle = (agent: Agent) => {
    agent.phase = 'settled'
    agent.phaseTime = 0
    agent.airborne = false
    agent.destination = null
    agent.attackTarget = null
    const atBase = flatDistance(agent.position, agent.base) <= 1
    if (atBase) agent.purpose = null
    setVisual(agent.id, {
      state: atBase ? agent.baseState : 'idle',
      action: null,
      showFood: false,
    })
  }

  const runQueued = (agent: Agent) => {
    if (!agent.queued) return
    const request = agent.queued
    agent.queued = null
    beginCommand(agent, request)
  }

  // Picks sleep/groom/eat/drink/perch/sit between idle loops so a roost of
  // settled wyverns feels inhabited rather than frozen on one pose. Draws come
  // from a per-agent RNG derived from the save seed — never `Math.random()`,
  // never the tick-path `withRng` — so this stays purely cosmetic and cannot
  // desync a replay or the balance harness.
  const updateAmbient = (agent: Agent, dt: number) => {
    agent.ambientDwell -= dt
    if (agent.ambientDwell > 0) return

    agent.ambientRoll += 1

    if (agent.ambientAction !== null) {
      const rng = createRng(deriveSeed(seed, `${agent.id}:ambient-end:${agent.ambientRoll}`))
      agent.ambientDwell = rng.range(AMBIENT_MIN_DWELL, AMBIENT_MAX_DWELL)
      // `sit` chains through the manifest's own `seated` -> `rise` -> `idle`
      // sequence; every other ambient action is a plain loop that just needs
      // to hand back to `idle` directly.
      setVisual(agent.id, { state: agent.ambientAction === 'sit' ? 'rise' : 'idle' })
      agent.ambientAction = null
      return
    }

    const wyvern = wyverns.find((candidate) => candidate.id === agent.id)
    const candidates: { state: ModelState; weight: number }[] = [
      { state: 'sleep', weight: 1 + (wyvern ? wyvern.injury / 40 : 0) },
      { state: 'sit', weight: 1 },
      { state: 'groom', weight: 1 + (wyvern && wyvern.bond > 60 ? 0.5 : 0) },
      { state: 'eat', weight: 1 + (wyvern ? wyvern.hunger / 30 : 0) },
      { state: 'drink', weight: 0.6 },
      { state: 'perch', weight: 0.8 },
    ]
    const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weight, 0)
    const rng = createRng(deriveSeed(seed, `${agent.id}:ambient-pick:${agent.ambientRoll}`))
    let roll = rng.range(0, totalWeight)
    let picked: ModelState = candidates[candidates.length - 1]!.state
    for (const candidate of candidates) {
      if (roll < candidate.weight) {
        picked = candidate.state
        break
      }
      roll -= candidate.weight
    }
    setVisual(agent.id, { state: picked })
    agent.ambientAction = picked
    agent.ambientDwell = rng.range(AMBIENT_MIN_HOLD, AMBIENT_MAX_HOLD)
  }

  const actionDuration = (agent: Agent): number => agent.currentActionDuration

  return (
    <>
      {wyverns.map((wyvern) => {
        const agent = agents.current.get(wyvern.id)
        const visual = visuals[wyvern.id] ?? {
          state: 'idle',
          action: null,
          showFood: false,
        }
        if (!agent) return null
        return (
          <SanctuaryWyvernActor
            key={wyvern.id}
            wyvern={wyvern}
            visual={visual}
            selected={wyvern.id === selectedId}
            airborne={agent.airborne}
            onGroupReady={(group) => {
              agent.group = group
              if (group) group.position.copy(agent.position)
            }}
            onJawReady={(jaw) => {
              agent.jaw = jaw
              agent.jawClosed = captureClosedJawPose(jaw, agent.jawClosed)
            }}
            onHeadReady={(head) => {
              agent.headBone = head
            }}
            onNeckBonesReady={(bones) => {
              agent.neckBones = bones
            }}
            onSpineBonesReady={(bones) => {
              agent.spineBones = bones
            }}
            onLegBonesReady={(bones) => {
              agent.legBones = bones
            }}
            onTailBonesReady={(bones) => {
              agent.tailBones = bones
            }}
            onActionFinished={(request) => {
              if (agent.activeAction?.token === request.token) agent.activeAction = null
            }}
            onSelect={() => {
              useSanctuaryCommands.getState().select(wyvern.id)
            }}
          />
        )
      })}
      <SanctuaryDust agents={agents} />
      <SanctuaryWildlife agents={agents} />
      <AttackTargetReticle />
      <PatrolMarkers />
    </>
  )
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
