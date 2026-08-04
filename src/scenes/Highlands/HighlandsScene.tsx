'use client'

import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PlaneGeometry, Quaternion, Vector3, type Group, type Object3D } from 'three'
import type { WyvernInstance } from '@/core/types'
import { SPECIES } from '@/core/data/species'
import { GameModel, type ModelActionRequest } from '@/render/assets/GameModel'
import { PropInstances, type PropPlacement } from '@/render/assets/props'
import { PlaceholderWyvern } from '@/render/placeholders/PlaceholderWyvern'
import { WorldLabel } from '@/render/labels/WorldLabel'
import { consumeDrag, consumeWheel } from '@/render/controllers/input'
import { readDirectWyvernFlightInput, stepDirectWyvernFlight } from '@/render/controllers/wyvernFlight'
import { applyBoneOffset, applyLegTuck, applyNeckOffset } from '@/render/boneOffsets'
import {
  HEAD_BONE,
  HIND_LEG_CHAINS,
  JAW_BONE,
  NECK_CHAIN,
  TAIL_CHAIN,
  findBone,
  findChain,
} from '@/render/rigBones'
import { createTailState, dynamicTailController, type TailState } from '@/render/tailController'
import { createLegsState, dynamicLegController, type LegsState } from '@/render/legPhysics'
import { captureClosedJawPose, sealFlightJaw, shouldSealFlightJaw, type ClosedJawPose } from '@/render/flightMouth'
import {
  angleDelta,
  dampHeadNeckPose,
  dampLegTuck,
  headNeckTargets,
  legTuckTarget,
  type HeadNeckPose,
} from '@/render/flightPose'
import { useGameState } from '@/state/store'
import { usePlayerControlStore } from '@/state/playerControlStore'
import {
  HIGHLANDS_DOE_RESPAWN_MS,
  type HighlandsDoe,
  type HighlandsHuntPhase,
  useHighlandsHunt,
} from '@/state/highlandsHuntStore'
import { useCameraStore } from '@/state/cameraStore'

const HIGHLANDS_RADIUS = 96
const TAKEOFF_SECONDS = 3.2
const LAND_SECONDS = 4.67
const SEARCH_SECONDS = 3.5
const STRIKE_SECONDS = 3.333
const CARRY_SECONDS = 6
const HUNT_STRIKE_RADIUS = 11
const HUNT_CONTACT_DISTANCE = 10.5
const FLIGHT_ALTITUDE = 22
const HUNT_REFERENCE_SPEED = 20

interface HighlandsAgent {
  position: Vector3
  yaw: number
  pitch: number
  bank: number
  airborne: boolean
  group: Group | null
  phaseElapsed: number
  phaseOrigin: Vector3
  guidedStage: 'takeoff' | 'transit' | 'search'
  attackHeld: boolean
  transitionQueued: boolean
  jaw: Object3D | null
  jawClosed: ClosedJawPose | null
  headBone: Object3D | null
  neckBones: Object3D[]
  legBones: Object3D[][]
  tailBones: Object3D[]
  tail: TailState
  legs: LegsState
  headNeckPose: HeadNeckPose
  legTuck: number
  previousPosition: Vector3
  previousYaw: number
  carriedDoe: Group | null
}

function createAgent(): HighlandsAgent {
  return {
    position: new Vector3(-42, 0, -34),
    yaw: Math.PI * 0.25,
    pitch: 0,
    bank: 0,
    airborne: false,
    group: null,
    phaseElapsed: 0,
    phaseOrigin: new Vector3(-42, 0, -34),
    guidedStage: 'takeoff',
    attackHeld: false,
    transitionQueued: false,
    jaw: null,
    jawClosed: null,
    headBone: null,
    neckBones: [],
    legBones: [],
    tailBones: [],
    tail: createTailState(),
    legs: createLegsState(),
    headNeckPose: { neckPitch: 0, neckYaw: 0, headPitch: 0, headYaw: 0, headRoll: 0 },
    legTuck: 0,
    previousPosition: new Vector3(-42, 0, -34),
    previousYaw: Math.PI * 0.25,
    carriedDoe: null,
  }
}

/** A small dedicated hunt map, intentionally still inside the persistent canvas. */
export function HighlandsScene() {
  const state = useGameState()
  const selectedWyvernId = useHighlandsHunt((session) => session.selectedWyvernId)
  const sessionToken = useHighlandsHunt((session) => session.sessionToken)
  const wyvern = selectedWyvernId ? state.wyverns[selectedWyvernId] : undefined
  const agent = useRef<HighlandsAgent>(createAgent())

  return (
    <>
      <HighlandsCamera agent={agent} />
      <HighlandsLighting />
      <HighlandsGround />
      <HighlandsDressing />
      <HighlandsWildlife />
      {wyvern?.stage === 'adult' && (
        <HighlandsHuntDirector key={sessionToken} wyvern={wyvern} agent={agent} />
      )}
    </>
  )
}

function HighlandsLighting() {
  return (
    <>
      <hemisphereLight args={['#c8d8e5', '#363d2d', 0.9]} />
      <directionalLight
        position={[-48, 70, 30]}
        intensity={1.65}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-110}
        shadow-camera-right={110}
        shadow-camera-top={110}
        shadow-camera-bottom={-110}
      />
      <fog attach="fog" args={['#9ba9a9', 115, 290]} />
      <color attach="background" args={['#9ba9a9']} />
    </>
  )
}

function HighlandsGround() {
  const geometry = useMemo(() => {
    const ground = new PlaneGeometry(HIGHLANDS_RADIUS * 2, HIGHLANDS_RADIUS * 2, 40, 40)
    const positions = ground.attributes.position!
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index)
      const z = positions.getY(index)
      const edge = Math.min(1, Math.hypot(x, z) / HIGHLANDS_RADIUS)
      const height =
        Math.sin(x * 0.08) * 0.72 +
        Math.cos(z * 0.07 + x * 0.025) * 0.55 +
        edge * edge * 1.8
      positions.setZ(index, height)
    }
    positions.needsUpdate = true
    ground.computeVertexNormals()
    return ground
  }, [])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={geometry} receiveShadow>
      <meshStandardMaterial color="#66744c" roughness={1} />
    </mesh>
  )
}

const HIGHLANDS_HILLS: PropPlacement[] = Array.from({ length: 9 }, (_, index) => {
  const angle = (index / 9) * Math.PI * 2 + 0.18
  const radius = 108 + (index % 3) * 8
  return {
    position: [Math.cos(angle) * radius, -3, Math.sin(angle) * radius],
    rotationY: angle,
    scale: 1 + (index % 4) * 0.18,
  }
})

function ringProps(
  count: number,
  minRadius: number,
  maxRadius: number,
  scale: [number, number],
  offset: number,
): PropPlacement[] {
  return Array.from({ length: count }, (_, index) => {
    const ratio = ((index * 37) % count) / count
    const angle = index * 2.399963229728653 + offset
    const radius = minRadius + ratio * (maxRadius - minRadius)
    return {
      position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius],
      rotationY: angle + Math.PI * 0.5,
      scale: scale[0] + (((index * 17) % 11) / 10) * (scale[1] - scale[0]),
    }
  })
}

const HIGHLANDS_DRESSING: readonly [string, PropPlacement[], boolean][] = [
  ['prop.scatter.firA', ringProps(28, 38, 88, [0.85, 1.4], 0.3), true],
  ['prop.scatter.firB', ringProps(22, 46, 90, [0.8, 1.25], 1.1), true],
  ['prop.scatter.deadTree', ringProps(8, 54, 84, [0.75, 1.1], 0.8), true],
  ['prop.scatter.mysticStone', ringProps(18, 19, 70, [0.75, 1.25], 1.8), true],
  ['prop.perch.trunk', ringProps(9, 46, 80, [0.8, 1.15], 2.2), true],
  ['prop.scatter.grassA', ringProps(92, 5, 85, [0.8, 1.5], 0.1), false],
  ['prop.scatter.grassB', ringProps(86, 8, 84, [0.8, 1.4], 0.9), false],
]

function HighlandsDressing() {
  return (
    <group>
      <PropInstances id="prop.scatter.hill" items={HIGHLANDS_HILLS} color="#617054" />
      {HIGHLANDS_DRESSING.map(([id, items, castShadow]) => (
        <PropInstances key={id} id={id} items={items} castShadow={castShadow} />
      ))}
    </group>
  )
}

function HighlandsWildlife() {
  const does = useHighlandsHunt((session) => session.does)
  return (
    <group name="highlands-wildlife">
      {does.map((doe) => <HighlandsDoeActor key={doe.id} doe={doe} />)}
    </group>
  )
}

function HighlandsDoeActor({ doe }: { doe: HighlandsDoe }) {
  const group = useRef<Group>(null)
  const phase = useMemo(
    () => Array.from(doe.id).reduce((total, character) => total + character.charCodeAt(0), 0) * 0.17,
    [doe.id],
  )

  useEffect(() => {
    if (doe.lifecycle !== 'alive') return
    const delay = 2600 + (Math.round(phase * 10) % 3) * 850
    let interval: number | null = null
    const timeout = window.setTimeout(() => {
      useHighlandsHunt.getState().advanceDoeAmbient(doe.id)
      interval = window.setInterval(() => useHighlandsHunt.getState().advanceDoeAmbient(doe.id), 5600)
    }, delay)
    return () => {
      window.clearTimeout(timeout)
      if (interval) window.clearInterval(interval)
    }
  }, [doe.id, doe.lifecycle, phase])

  useEffect(() => {
    if (doe.lifecycle !== 'respawning') return
    const timeout = window.setTimeout(
      () => useHighlandsHunt.getState().respawnDoe(doe.id),
      HIGHLANDS_DOE_RESPAWN_MS,
    )
    return () => window.clearTimeout(timeout)
  }, [doe.id, doe.lifecycle])

  useFrame((frame) => {
    if (!group.current) return
    if (doe.lifecycle === 'feeding') {
      const t = frame.clock.elapsedTime * 6
      const tug = Math.max(0, Math.sin(t)) * 0.12
      group.current.position.set(doe.position[0], 0.35 + tug * 0.4, doe.position[1] + tug * 0.2)
      group.current.rotation.z = Math.sin(t * 0.5) * 0.08
      return
    }
    if (doe.lifecycle !== 'alive') return
    const t = frame.clock.elapsedTime * 0.18 + phase
    const drift = doe.animation === 'walk' ? 1.25 : 0.35
    const x = doe.position[0] + Math.cos(t) * drift
    const z = doe.position[1] + Math.sin(t * 0.8) * drift * 0.6
    group.current.position.set(x, 0.35, z)
    if (doe.animation === 'walk') {
      group.current.rotation.y = Math.atan2(-Math.sin(t), Math.cos(t * 0.8) * 0.8)
    } else {
      group.current.rotation.y = doe.yaw
    }
  })

  if (doe.lifecycle === 'carried' || doe.lifecycle === 'respawning') return null

  return (
    <group ref={group} position={[doe.position[0], 0.35, doe.position[1]]} rotation={[0, doe.yaw, 0]}>
      <GameModel
        id="wildlife.deer"
        state={doe.animation}
        seed={phase}
        fallback={<DoeFallback />}
      />
    </group>
  )
}

function DoeFallback() {
  return (
    <group position={[0, 0.8, 0]}>
      <mesh castShadow>
        <sphereGeometry args={[0.85, 12, 8]} />
        <meshStandardMaterial color="#9b7657" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.25, 0.72]} castShadow>
        <capsuleGeometry args={[0.24, 0.65, 4, 8]} />
        <meshStandardMaterial color="#9b7657" roughness={0.9} />
      </mesh>
    </group>
  )
}

function HighlandsHuntDirector({
  wyvern,
  agent,
}: {
  wyvern: WyvernInstance
  agent: MutableRefObject<HighlandsAgent>
}) {
  const session = useHighlandsHunt((state) => state)
  const camera = useThree((state) => state.camera)
  const carryPosition = useRef(new Vector3())
  const carryOffset = useRef(new Vector3(0, -0.8, 1.4))
  const carryWorldRotation = useRef(new Quaternion())
  const parentWorldRotation = useRef(new Quaternion())

  useEffect(() => {
    agent.current = createAgent()
    if (session.mode === 'playable') usePlayerControlStore.getState().shiftToWyvern(wyvern.id)
    else usePlayerControlStore.getState().shiftToHuman()
    return () => {
      usePlayerControlStore.getState().shiftToHuman()
    }
  }, [agent, session.sessionToken, session.mode, wyvern.id])

  useEffect(() => {
    agent.current.phaseElapsed = 0
    agent.current.phaseOrigin.copy(agent.current.position)
    if (session.phase === 'carry') {
      const timeout = window.setTimeout(() => {
        useHighlandsHunt.getState().beginLanding()
      }, CARRY_SECONDS * 1000)
      return () => window.clearTimeout(timeout)
    }
    if (session.phase === 'landing') {
      const timeout = window.setTimeout(() => {
        const body = agent.current
        body.position.y = 0
        body.airborne = false
        const live = useHighlandsHunt.getState()
        const doe = live.activeDoeId
          ? live.does.find((candidate) => candidate.id === live.activeDoeId)
          : null
        live.beginEat(doe?.position ?? [body.position.x, body.position.z])
      }, LAND_SECONDS * 1000)
      return () => window.clearTimeout(timeout)
    }
  }, [agent, session.phase])

  const handleActionFinished = useCallback((request: ModelActionRequest) => {
    const body = agent.current
    const live = useHighlandsHunt.getState()
    const doe = live.activeDoeId
      ? live.does.find((candidate) => candidate.id === live.activeDoeId) ?? null
      : null
    if (request.token !== live.wyvernActionToken) return

    if (live.phase === 'fire' && (request.state === 'breathe' || request.state === 'breatheAir')) {
      live.beginStrike()
    } else if (live.phase === 'strike' && request.state === 'attackAir') {
      if (doe) {
        body.position.set(doe.position[0], 0, doe.position[1] - HUNT_CONTACT_DISTANCE)
        face(body, doe.position)
      }
      body.airborne = false
      live.beginGrip()
    } else if (live.phase === 'grip' && request.state === 'huntGrip') {
      body.airborne = true
      live.beginCarry()
    } else if (live.phase === 'eat' && request.state === 'eat') {
      live.beginFinish()
    } else if (live.phase === 'finish' && request.state === 'huntFinish') {
      live.finishHunt()
    } else if (live.phase === 'drop' && request.state === 'drop') {
      live.setWyvernState('scout')
      live.finishHunt()
    }
  }, [agent])

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    const live = useHighlandsHunt.getState()
    const body = agent.current
    const doe = live.activeDoeId
      ? live.does.find((candidate) => candidate.id === live.activeDoeId) ?? null
      : null

    if (live.mode === 'guided' && live.phase === 'search' && doe) {
      updateGuidedSearch(body, doe, dt)
    } else if (live.mode === 'playable' && live.phase === 'ready') {
      const input = readDirectWyvernFlightInput()
      const result = stepDirectWyvernFlight(body, input, camera.rotation.y, dt, {
        boundsRadius: HIGHLANDS_RADIUS,
      })
      useHighlandsHunt.getState().setWyvernState(result.locomotion)

      if (input.attacking && !body.attackHeld) {
        const target = body.position.y <= 4 ? nearestHuntableDoe(body.position, live.does) : null
        if (target) {
          face(body, target.position)
          queueTransition(body, () => useHighlandsHunt.getState().beginFire(target.id))
        }
      }
      body.attackHeld = input.attacking
    } else {
      body.attackHeld = false
    }

    const phase = live.phase
    let targetPitch = 0
    let targetBank = 0

    if (phase === 'strike' && doe) {
      body.phaseElapsed += dt
      const progress = Math.min(1, body.phaseElapsed / STRIKE_SECONDS)
      const eased = smoothstep(progress)
      body.position.x = lerp(body.phaseOrigin.x, doe.position[0], eased)
      body.position.z = lerp(body.phaseOrigin.z, doe.position[1] - HUNT_CONTACT_DISTANCE, eased)
      body.position.y = lerp(body.phaseOrigin.y, 0, eased * eased)
      face(body, doe.position)

      if (progress < 0.68) {
        const diveP = progress / 0.68
        targetPitch = 0.42 * Math.sin(diveP * Math.PI * 0.5)
        targetBank = Math.sin(diveP * Math.PI) * 0.12
      } else {
        const flareP = (progress - 0.68) / 0.32
        targetPitch = lerp(0.42, -0.26, smoothstep(flareP))
        targetBank = 0
      }
    } else if (phase === 'carry' && doe) {
      body.phaseElapsed += dt
      const progress = Math.min(1, body.phaseElapsed / CARRY_SECONDS)
      const angle = Math.PI + progress * Math.PI * 2
      const radius = HUNT_CONTACT_DISTANCE + Math.sin(progress * Math.PI) * 6
      const heave = Math.sin(body.phaseElapsed * Math.PI * 2 * 0.8) * 0.4
      body.position.x = doe.position[0] + Math.sin(angle) * radius
      body.position.z = doe.position[1] + Math.cos(angle) * radius
      body.position.y = Math.sin(progress * Math.PI) * 12 + progress * 8 + heave
      const tangentX = Math.cos(angle)
      const tangentZ = -Math.sin(angle)
      const tangentYaw = Math.atan2(tangentX, tangentZ)
      const landingYaw = yawToward(body.position, doe.position)
      body.yaw = progress > 0.78
        ? lerpAngle(tangentYaw, landingYaw, smoothstep((progress - 0.78) / 0.22))
        : tangentYaw

      targetPitch = -0.22
      targetBank = 0.22
    } else if (phase === 'landing') {
      body.phaseElapsed += dt
      const progress = Math.min(1, body.phaseElapsed / LAND_SECONDS)
      body.position.y = lerp(body.phaseOrigin.y, 0, smoothstep(progress))
      if (doe) face(body, doe.position)

      targetPitch = lerp(0.0, -0.36, smoothstep(Math.min(1, progress * 1.1)))
      if (progress >= 0.85) {
        targetPitch = lerp(targetPitch, 0.0, (progress - 0.85) / 0.15)
      }
      targetBank = 0
    } else if (phase === 'fire') {
      targetPitch = 0.32
      targetBank = -0.05
    } else if (phase === 'grip') {
      targetPitch = 0.10
      targetBank = 0
    } else if (phase === 'eat') {
      targetPitch = 0.05
      targetBank = 0
    } else if (phase === 'finish') {
      targetPitch = 0.02
      targetBank = 0
    } else if (phase === 'search') {
      if (body.guidedStage === 'takeoff') {
        const p = Math.min(1, body.phaseElapsed / TAKEOFF_SECONDS)
        targetPitch = p < 0.7 ? -0.35 * (1 - p / 0.7) - 0.05 : -0.05
        targetBank = 0
      } else if (body.guidedStage === 'search') {
        targetBank = 0.25
        targetPitch = 0.08
      } else {
        targetPitch = -0.05
        targetBank = 0
      }
    }

    body.pitch += (targetPitch - body.pitch) * Math.min(1, dt * 6.5)
    body.bank += (targetBank - body.bank) * Math.min(1, dt * 6.5)

    const horizontalSpeed = Math.hypot(
      body.position.x - body.previousPosition.x,
      body.position.z - body.previousPosition.z,
    ) / Math.max(dt, 1e-4)
    const verticalSpeed = (body.position.y - body.previousPosition.y) / Math.max(dt, 1e-4)
    const yawRate = angleDelta(body.yaw, body.previousYaw) / Math.max(dt, 1e-4)
    body.previousPosition.copy(body.position)
    body.previousYaw = body.yaw

    const targetHeadNeck = body.airborne
      ? headNeckTargets(
          horizontalSpeed,
          verticalSpeed,
          yawRate,
          body.pitch,
          body.bank,
          HUNT_REFERENCE_SPEED,
        )
      : { neckPitch: 0, neckYaw: 0, headPitch: 0, headYaw: 0, headRoll: 0 }
    body.headNeckPose = dampHeadNeckPose(body.headNeckPose, targetHeadNeck, dt)
    body.legTuck = dampLegTuck(
      body.legTuck,
      body.airborne ? legTuckTarget(horizontalSpeed, HUNT_REFERENCE_SPEED) : 0,
      dt,
    )

    if (body.group) {
      body.group.position.copy(body.position)
      body.group.rotation.order = 'YXZ'
      body.group.rotation.set(body.pitch, body.yaw, body.bank)
    }

    if (body.airborne) {
      // High-level hunt motion owns the world trajectory. The local layer only
      // decorates the mixer's authored posture, preserving the speed/hover
      // neck line and leg carriage from the sidecar.
      applyNeckOffset(
        body.neckBones,
        body.headNeckPose.neckPitch,
        body.headNeckPose.neckYaw,
      )
      applyBoneOffset(
        body.headBone,
        body.headNeckPose.headPitch,
        body.headNeckPose.headYaw,
        body.headNeckPose.headRoll,
      )
      for (const chain of body.legBones) {
        applyLegTuck(chain, body.legTuck)
      }

      // Per-manoeuvre tail and legs, same layering as the sanctuary and battle.
      // The hunt has no flight-mode selector of its own, so this reads cruise —
      // the controllers' neutral case — and carries only the turn response.
      body.tail = dynamicTailController(
        body.tailBones,
        yawRate,
        body.bank,
        horizontalSpeed,
        'cruise',
        0.5,
        body.phaseElapsed,
        body.tail,
        dt,
      )
      body.legs = dynamicLegController(
        body.legBones[0] ?? [],
        body.legBones[1] ?? [],
        yawRate,
        horizontalSpeed,
        verticalSpeed,
        body.position.y,
        'cruise',
        0,
        body.phaseElapsed,
        body.legs,
        dt,
      )
      if (shouldSealFlightJaw(session.wyvernState, session.wyvernAction)) {
        sealFlightJaw(body.jaw, body.jawClosed)
      }
    }

    if (body.jaw && body.carriedDoe && (phase === 'carry' || phase === 'landing') && body.group) {
      body.jaw.getWorldPosition(carryPosition.current)
      body.jaw.getWorldQuaternion(carryWorldRotation.current)
      carryPosition.current.add(
        carryOffset.current.clone().applyQuaternion(carryWorldRotation.current),
      )
      body.group.worldToLocal(carryPosition.current)
      body.carriedDoe.position.copy(carryPosition.current)
      body.group.getWorldQuaternion(parentWorldRotation.current)
      body.carriedDoe.quaternion
        .copy(parentWorldRotation.current)
        .invert()
        .multiply(carryWorldRotation.current)
    }
  })

  const action: ModelActionRequest | null = session.wyvernAction
    ? { state: session.wyvernAction, token: session.wyvernActionToken }
    : null
  const activeDoe = session.activeDoeId
    ? session.does.find((candidate) => candidate.id === session.activeDoeId) ?? null
    : null

  return (
    <group
      ref={(group) => {
        agent.current.group = group
        if (group) group.position.copy(agent.current.position)
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <GameModel
        id={`wyvern.${wyvern.speciesId}`}
        state={session.wyvernState}
        action={action}
        seed={wyvern.name.charCodeAt(0) ?? 0}
        scale={1}
        onReady={(root) => {
          agent.current.jaw = findBone(root, JAW_BONE)
          agent.current.jawClosed = captureClosedJawPose(agent.current.jaw, agent.current.jawClosed)
          agent.current.headBone = findBone(root, HEAD_BONE)
          agent.current.neckBones = findChain(root, NECK_CHAIN)
          agent.current.legBones = HIND_LEG_CHAINS.map((chain) => findChain(root, chain))
          agent.current.tailBones = findChain(root, TAIL_CHAIN)
        }}
        onActionFinished={handleActionFinished}
        fallback={<PlaceholderWyvern color={SPECIES[wyvern.speciesId]?.color} scale={1} />}
      />
      <group
        ref={(group) => {
          agent.current.carriedDoe = group
        }}
        visible={session.phase === 'carry' || session.phase === 'landing'}
      >
        <group rotation={[0, 0, Math.PI * 0.5]} scale={0.82}>
          <GameModel id="wildlife.deer" state="death" fallback={<DoeFallback />} />
        </group>
      </group>
      {session.phase === 'fire' && activeDoe && (
        <HuntFireBurst
          horizontalDistance={Math.hypot(
            agent.current.position.x - activeDoe.position[0],
            agent.current.position.z - activeDoe.position[1],
          )}
          verticalDistance={agent.current.position.y}
        />
      )}
      <WorldLabel
        position={[0, 14, 0]}
        text={wyvern.name}
        color={SPECIES[wyvern.speciesId]?.color ?? '#d4af37'}
      />
    </group>
  )
}

function updateGuidedSearch(agent: HighlandsAgent, doe: HighlandsDoe, dt: number): void {
  const session = useHighlandsHunt.getState()
  agent.phaseElapsed += dt

  if (agent.guidedStage === 'takeoff') {
    agent.airborne = true
    agent.position.y = Math.sin(Math.min(1, agent.phaseElapsed / TAKEOFF_SECONDS) * Math.PI * 0.5) * FLIGHT_ALTITUDE
    if (agent.phaseElapsed >= TAKEOFF_SECONDS) {
      agent.guidedStage = 'transit'
      agent.phaseElapsed = 0
      agent.airborne = true
      queueTransition(agent, () => session.setWyvernState('scout'))
    }
    return
  }

  const approach = landingPoint(doe.position, agent.position)
  if (agent.guidedStage === 'transit') {
    const remaining = moveToward(agent, approach, 20, dt)
    agent.position.y += (FLIGHT_ALTITUDE - agent.position.y) * Math.min(1, dt * 3)
    if (remaining <= 0.5) {
      agent.guidedStage = 'search'
      agent.phaseElapsed = 0
      queueTransition(agent, () => session.setWyvernState('scout'))
    }
    return
  }

  const orbit = agent.phaseElapsed * 0.55
  agent.position.x = doe.position[0] + Math.sin(orbit) * 14
  agent.position.z = doe.position[1] + Math.cos(orbit) * 14
  agent.position.y = FLIGHT_ALTITUDE
  face(agent, doe.position)
  if (agent.phaseElapsed >= SEARCH_SECONDS) {
    queueTransition(agent, () => session.beginFire(doe.id))
  }
}

function queueTransition(agent: HighlandsAgent, transition: () => unknown): void {
  if (agent.transitionQueued) return
  agent.transitionQueued = true
  window.setTimeout(() => {
    transition()
    agent.transitionQueued = false
  }, 0)
}

function HuntFireBurst({
  horizontalDistance,
  verticalDistance,
}: {
  horizontalDistance: number
  verticalDistance: number
}) {
  const downwardPitch = Math.atan2(verticalDistance, Math.max(1, horizontalDistance))
  const time = useRef(0)
  const lightRef = useRef<import('three').PointLight>(null)
  const innerRef = useRef<import('three').Mesh>(null)

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    time.current += dt
    if (lightRef.current) {
      lightRef.current.intensity = 7.5 + Math.sin(time.current * 32) * 2.8
    }
    if (innerRef.current) {
      const scale = 1 + Math.sin(time.current * 24) * 0.09
      innerRef.current.scale.set(scale, 1, scale)
    }
  })

  return (
    <group position={[0, 4.8, 6.5]} rotation={[Math.PI * 0.5 + downwardPitch * 0.7, 0, 0]}>
      {/* Inner white-hot plasma core */}
      <mesh ref={innerRef} position={[0, -5, 0]}>
        <coneGeometry args={[1.8, 10, 16, 1, true]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.94} depthWrite={false} />
      </mesh>
      {/* Main fire jet */}
      <mesh position={[0, -5.6, 0]}>
        <coneGeometry args={[3.4, 12, 16, 1, true]} />
        <meshBasicMaterial color="#ff7e16" transparent opacity={0.72} depthWrite={false} />
      </mesh>
      {/* Outer expanding flame halo */}
      <mesh position={[0, -6.2, 0]}>
        <coneGeometry args={[4.6, 13.5, 16, 1, true]} />
        <meshBasicMaterial color="#e03a00" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <pointLight ref={lightRef} color="#ff6a18" intensity={8} distance={28} />
    </group>
  )
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value)
}

function yawToward(position: Vector3, target: readonly [number, number]): number {
  return Math.atan2(target[0] - position.x, target[1] - position.z)
}

function lerpAngle(start: number, end: number, amount: number): number {
  const delta = Math.atan2(Math.sin(end - start), Math.cos(end - start))
  return start + delta * amount
}

function moveToward(
  agent: HighlandsAgent,
  target: readonly [number, number],
  speed: number,
  dt: number,
): number {
  const dx = target[0] - agent.position.x
  const dz = target[1] - agent.position.z
  const distance = Math.hypot(dx, dz)
  if (distance <= 1e-4) return 0
  const step = Math.min(distance, speed * dt)
  agent.position.x += (dx / distance) * step
  agent.position.z += (dz / distance) * step
  face(agent, target)
  return distance - step
}

function landingPoint(target: readonly [number, number], from: Vector3): [number, number] {
  const dx = from.x - target[0]
  const dz = from.z - target[1]
  const length = Math.hypot(dx, dz) || 1
  return [target[0] + (dx / length) * 9, target[1] + (dz / length) * 9]
}

function face(agent: HighlandsAgent, target: readonly [number, number]): void {
  const dx = target[0] - agent.position.x
  const dz = target[1] - agent.position.z
  if (Math.hypot(dx, dz) > 1e-4) agent.yaw = Math.atan2(dx, dz)
}

function nearestHuntableDoe(position: Vector3, does: readonly HighlandsDoe[]): HighlandsDoe | null {
  let closest: HighlandsDoe | null = null
  let distance = HUNT_STRIKE_RADIUS
  for (const doe of does) {
    if (doe.lifecycle !== 'alive') continue
    const current = Math.hypot(position.x - doe.position[0], position.z - doe.position[1])
    if (current <= distance) {
      closest = doe
      distance = current
    }
  }
  return closest
}

function HighlandsCamera({ agent }: { agent: MutableRefObject<HighlandsAgent> }) {
  const camera = useThree((state) => state.camera)
  const yaw = useRef(-0.7)
  const pitch = useRef(0.47)
  const distance = useRef(42)
  const desired = useRef(new Vector3())
  const target = useRef(new Vector3())

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    const settings = useCameraStore.getState()
    const hunt = useHighlandsHunt.getState()
    const drag = consumeDrag()
    yaw.current += drag.x * 0.004 * (settings.invertX ? -1 : 1) * settings.sensitivity
    pitch.current = Math.max(0.18, Math.min(1.12, pitch.current + drag.y * 0.003 * (settings.invertY ? 1 : -1) * settings.sensitivity))
    distance.current += consumeWheel() * 0.03 * settings.zoomSpeed
    distance.current = Math.max(20, Math.min(85, distance.current))

    const activeDoe = hunt.activeDoeId
      ? hunt.does.find((candidate) => candidate.id === hunt.activeDoeId) ?? null
      : null
    const cinematic = hunt.mode === 'guided' && hunt.phase !== 'launcher'
    const framesPrey = cinematic && activeDoe && ['fire', 'strike', 'grip', 'landing', 'eat', 'finish'].includes(hunt.phase)

    target.current.copy(agent.current.position)
    if (framesPrey && activeDoe) {
      target.current.x = (target.current.x + activeDoe.position[0]) * 0.5
      target.current.z = (target.current.z + activeDoe.position[1]) * 0.5
      target.current.y = Math.max(2.8, agent.current.position.y * 0.52)
    } else {
      target.current.y += agent.current.airborne ? 5 : 4
    }

    const shotDistance = !cinematic
      ? distance.current
      : hunt.phase === 'search'
        ? 38
        : hunt.phase === 'fire'
          ? 28
          : hunt.phase === 'strike'
            ? 26
            : hunt.phase === 'grip'
              ? 20
              : hunt.phase === 'carry'
                ? 36
                : hunt.phase === 'landing'
                  ? 28
                  : hunt.phase === 'eat'
                    ? 22
                    : hunt.phase === 'finish'
                      ? 24
                      : 34
    const shotPitch = cinematic && ['grip', 'landing', 'eat', 'finish'].includes(hunt.phase)
      ? 0.34
      : pitch.current
    desired.current.set(
      target.current.x + Math.sin(yaw.current) * shotDistance * Math.cos(shotPitch),
      target.current.y + shotDistance * Math.sin(shotPitch),
      target.current.z + Math.cos(yaw.current) * shotDistance * Math.cos(shotPitch),
    )
    camera.position.lerp(desired.current, 1 - Math.exp(-settings.smoothing * dt))
    camera.lookAt(target.current)
  })

  return null
}

export function highlandsPhaseLabel(phase: HighlandsHuntPhase): string {
  switch (phase) {
    case 'search':
      return 'searching from above'
    case 'fire':
      return 'committing to a fire pass'
    case 'strike':
      return 'diving onto the doe'
    case 'grip':
      return 'securing the doe'
    case 'carry':
      return 'carrying the doe aloft'
    case 'landing':
      return 'bringing the catch down'
    case 'eat':
      return 'feeding'
    case 'finish':
      return 'finishing the feast'
    case 'complete':
      return 'test feast complete'
    case 'ready':
      return 'ready to hunt'
    default:
      return 'choose a hunt test'
  }
}
