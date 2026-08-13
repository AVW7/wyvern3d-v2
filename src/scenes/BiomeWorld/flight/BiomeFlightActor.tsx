'use client'

import { useRef, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3, type Group, type Object3D } from 'three'
import type { WyvernInstance } from '@/core/types'
import { SPECIES } from '@/core/data/species'
import { GameModel } from '@/render/assets/GameModel'
import { PlaceholderWyvern } from '@/render/placeholders/PlaceholderWyvern'
import { WorldLabel } from '@/render/labels/WorldLabel'
import { readDirectWyvernFlightInput, stepDirectWyvernFlight } from '@/render/controllers/wyvernFlight'
import { consumeDrag, consumeWheel } from '@/render/controllers/input'
import { applyBoneOffset, applyLegTuck, applyNeckOffset } from '@/render/boneOffsets'
import { HEAD_BONE, HIND_LEG_CHAINS, JAW_BONE, NECK_CHAIN, TAIL_CHAIN, findBone, findChain } from '@/render/rigBones'
import { createTailState, dynamicTailController, type TailState } from '@/render/tailController'
import { createLegsState, type LegsState } from '@/render/legPhysics'
import { captureClosedJawPose, type ClosedJawPose } from '@/render/flightMouth'
import { angleDelta, dampHeadNeckPose, dampLegTuck, headNeckTargets, legTuckTarget, type HeadNeckPose } from '@/render/flightPose'
import { BIOME_WORLD_RADIUS } from '../terrain/BiomeTerrain'

const FLIGHT_REF_SPEED = 20

export interface BiomeFlightAgent {
  position: Vector3
  yaw: number
  pitch: number
  bank: number
  airborne: boolean
  group: Group | null
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
}

export function createBiomeFlightAgent(): BiomeFlightAgent {
  return {
    position: new Vector3(0, 0, 0),
    yaw: 0,
    pitch: 0,
    bank: 0,
    airborne: false,
    group: null,
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
    previousPosition: new Vector3(0, 0, 0),
    previousYaw: 0,
  }
}

interface BiomeFlightActorProps {
  wyvern: WyvernInstance
}

export function BiomeFlightActor({ wyvern }: BiomeFlightActorProps) {
  const agentRef = useRef<BiomeFlightAgent>(createBiomeFlightAgent())

  return (
    <>
      <BiomeFlightCamera agentRef={agentRef} />
      <BiomeFlightModel wyvern={wyvern} agentRef={agentRef} />
    </>
  )
}

function BiomeFlightCamera({ agentRef }: { agentRef: MutableRefObject<BiomeFlightAgent> }) {
  const { camera } = useThree()
  const sphericalRef = useRef({ yaw: Math.PI, pitch: 0.35, distance: 34 })
  const targetLookAt = useRef(new Vector3(0, 6, 0))

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    const drag = consumeDrag()
    const wheel = consumeWheel()

    if (drag.x !== 0 || drag.y !== 0) {
      sphericalRef.current.yaw -= drag.x * 0.005
      sphericalRef.current.pitch = Math.max(0.08, Math.min(1.2, sphericalRef.current.pitch - drag.y * 0.005))
    }

    if (wheel !== 0) {
      sphericalRef.current.distance = Math.max(12, Math.min(75, sphericalRef.current.distance + wheel * 0.025))
    }

    const pos = agentRef.current.position
    const lookTarget = new Vector3(pos.x, pos.y + 4, pos.z)
    targetLookAt.current.lerp(lookTarget, Math.min(1, dt * 8))

    const dist = sphericalRef.current.distance
    const pitch = sphericalRef.current.pitch
    const yaw = sphericalRef.current.yaw

    const camX = targetLookAt.current.x + Math.sin(yaw) * Math.cos(pitch) * dist
    const camY = targetLookAt.current.y + Math.sin(pitch) * dist
    const camZ = targetLookAt.current.z + Math.cos(yaw) * Math.cos(pitch) * dist

    camera.position.set(camX, camY, camZ)
    camera.lookAt(targetLookAt.current)
  })

  return null
}

function BiomeFlightModel({
  wyvern,
  agentRef,
}: {
  wyvern: WyvernInstance
  agentRef: MutableRefObject<BiomeFlightAgent>
}) {
  const { camera } = useThree()

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    const agent = agentRef.current

    const input = readDirectWyvernFlightInput()
    const result = stepDirectWyvernFlight(agent, input, camera.rotation.y, dt, {
      boundsRadius: BIOME_WORLD_RADIUS - 10,
    })

    const horizontalSpeed = Math.hypot(
      agent.position.x - agent.previousPosition.x,
      agent.position.z - agent.previousPosition.z,
    ) / Math.max(dt, 1e-4)
    const verticalSpeed = (agent.position.y - agent.previousPosition.y) / Math.max(dt, 1e-4)
    const yawRate = angleDelta(agent.yaw, agent.previousYaw) / Math.max(dt, 1e-4)

    agent.previousPosition.copy(agent.position)
    agent.previousYaw = agent.yaw

    const targetHeadNeck = agent.airborne
      ? headNeckTargets(horizontalSpeed, verticalSpeed, yawRate, agent.pitch, agent.bank, FLIGHT_REF_SPEED)
      : { neckPitch: 0, neckYaw: 0, headPitch: 0, headYaw: 0, headRoll: 0 }

    agent.headNeckPose = dampHeadNeckPose(agent.headNeckPose, targetHeadNeck, dt)
    agent.legTuck = dampLegTuck(
      agent.legTuck,
      agent.airborne ? legTuckTarget(horizontalSpeed, FLIGHT_REF_SPEED) : 0,
      dt,
    )

    if (agent.group) {
      agent.group.position.copy(agent.position)
      agent.group.rotation.order = 'YXZ'
      agent.group.rotation.set(agent.pitch, agent.yaw, agent.bank)
    }

    if (agent.airborne) {
      applyNeckOffset(agent.neckBones, agent.headNeckPose.neckPitch, agent.headNeckPose.neckYaw)
      applyBoneOffset(
        agent.headBone,
        agent.headNeckPose.headPitch,
        agent.headNeckPose.headYaw,
        agent.headNeckPose.headRoll,
      )
      for (const chain of agent.legBones) {
        applyLegTuck(chain, agent.legTuck)
      }

      const flightMode =
        result.locomotion === 'idle' || result.locomotion === 'walk' ? 'cruise' : result.locomotion

      agent.tail = dynamicTailController(
        agent.tailBones,
        yawRate,
        agent.bank,
        horizontalSpeed,
        flightMode,
        0.5,
        0,
        agent.tail,
        dt,
      )
    }
  })

  return (
    <group
      ref={(group) => {
        agentRef.current.group = group
      }}
    >
      <GameModel
        id={`wyvern.${wyvern.speciesId}`}
        state="scout"
        seed={wyvern.name.charCodeAt(0) ?? 0}
        scale={1}
        onReady={(root) => {
          agentRef.current.jaw = findBone(root, JAW_BONE)
          agentRef.current.jawClosed = captureClosedJawPose(agentRef.current.jaw, agentRef.current.jawClosed)
          agentRef.current.headBone = findBone(root, HEAD_BONE)
          agentRef.current.neckBones = findChain(root, NECK_CHAIN)
          agentRef.current.legBones = HIND_LEG_CHAINS.map((chain) => findChain(root, chain))
          agentRef.current.tailBones = findChain(root, TAIL_CHAIN)
        }}
        fallback={<PlaceholderWyvern color={SPECIES[wyvern.speciesId]?.color} scale={1} />}
      />
      <WorldLabel
        position={[0, 12, 0]}
        text={wyvern.name}
        color={SPECIES[wyvern.speciesId]?.color ?? '#d4af37'}
      />
    </group>
  )
}
