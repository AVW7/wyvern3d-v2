'use client'

import { useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Plane, Raycaster, Vector2, Vector3 } from 'three'
import type { WyvernInstance } from '@/core/types'
import { clamp } from '@/core/math/vec'
import { consumeClick, pointer } from '@/render/controllers/input'
import { useSanctuaryCommands } from '@/state/sanctuaryCommands'
import { SanctuaryDust } from './atmosphere/SanctuaryDust'
import { SanctuaryWildlife } from './atmosphere/SanctuaryWildlife'
import { useCameraStore } from '@/state/cameraStore'
import { usePlayerControlStore } from '@/state/playerControlStore'
import { useGame } from '@/state/store'
import { useHighlandsHunt } from '@/state/highlandsHuntStore'
import { GROUND_RADIUS } from './layout'
import { useGameEventStream } from './events/useGameEventStream'
import { sanctuaryAudio } from './audio/sanctuaryAudio'
import {
  findSafeAttackLanding,
  type SanctuaryCollider,
  type SanctuaryPoint,
} from './commandLogic'
import {
  createSanctuaryDirector,
  hasAttackTargetBlocker,
  isActorClearTarget,
  phaseLabel,
  round2,
  type Agent,
  type SanctuaryCommandsContext,
  type SanctuaryDirector,
} from './director/wyvernDirector'
import {
  modelHeight,
  SanctuaryWyvernActor,
} from './components/SanctuaryWyvernActor'
import {
  AttackTargetReticle,
  PatrolMarkers,
} from './components/AttackTargetPicker'

const GROUND = new Plane(new Vector3(0, 1, 0), 0)

interface SanctuaryWyvernsProps {
  wyverns: WyvernInstance[]
  colliders: readonly SanctuaryCollider[]
  placedObjects?: readonly { propId: string; position: readonly [number, number, number] }[]
  /** Save seed, for deterministic-per-agent (but purely cosmetic) ambient rolls. */
  seed: number
}

export function SanctuaryWyverns({ wyverns, colliders, placedObjects, seed }: SanctuaryWyvernsProps) {
  const camera = useThree((state) => state.camera)
  const scene = useThree((state) => state.scene)
  const size = useThree((state) => state.size)
  const directorRef = useRef<SanctuaryDirector>(createSanctuaryDirector({ seed }))
  const agentsRef = useRef<Map<string, Agent>>(directorRef.current.agents)
  const raycaster = useRef(new Raycaster())
  const ndc = useRef(new Vector2())
  const projected = useRef(new Vector3())
  const [, setVisualVersion] = useState(0)
  const selectedId = useSanctuaryCommands((state) => state.selectedWyvernId)

  // Sync director state whenever wyvern roster or seed changes
  directorRef.current.syncWyverns(wyverns, seed)
  agentsRef.current = directorRef.current.agents

  const commandsCtx: SanctuaryCommandsContext = {
    setStatus: (status) => useSanctuaryCommands.getState().setStatus(status),
    movePlayer: (target, gesture, faceTarget) =>
      useSanctuaryCommands.getState().movePlayer(target, gesture, faceTarget),
    clearPlayerInteraction: () => useSanctuaryCommands.getState().clearPlayerInteraction(),
    acknowledgePlayerMove: () => useSanctuaryCommands.getState().acknowledgePlayerMove(),
    openHighlandsHunt: (wyvernId) => {
      useHighlandsHunt.getState().open(wyvernId)
      useGame.getState().setMode('highlands')
    },
    // The clip is presentation; the meal itself goes through the normal intent
    // path so hunger, food stock and the log all move with it.
    feedWyvern: (wyvernId) => useGame.getState().dispatch({ type: 'FEED_WYVERN', wyvernId }),
  }

  useGameEventStream({
    onEvent: (event) => {
      if (event.kind === 'sanctuary_duty_completed') {
        const wyvernId = event.subjectId
        if (wyvernId) {
          directorRef.current.playReaction(wyvernId, 'eat', 4.5)
          const wyvern = wyverns.find((w) => w.id === wyvernId)
          sanctuaryAudio.playWyvernVocalization('eat', {
            stage: wyvern?.stage,
            speciesId: wyvern?.speciesId,
          })
        }
      }
    },
  })

  useFrame((threeState, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    const director = directorRef.current
    const commands = useSanctuaryCommands.getState()
    const selected = commands.selectedWyvernId
    const selectedWyvern = wyverns.find((wyvern) => wyvern.id === selected)
    const selectedAgent = selected ? director.agents.get(selected) : undefined

    // 1. Attack target raycasting and interactive placement
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
        ? isActorClearTarget(target, director.agents.values(), commands.playerPosition)
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

    // 2. Process incoming command requests
    if (
      selectedAgent &&
      commands.request &&
      commands.request.wyvernId === selectedAgent.id &&
      commands.request.token !== selectedAgent.lastRequestToken
    ) {
      selectedAgent.lastRequestToken = commands.request.token
      director.dispatchCommand(commands.request, wyverns, colliders, commandsCtx)
      commands.acknowledgeCommand(commands.request.token)
    }

    // 3. Process player approach movement results
    const playerMoveResult = commands.playerMoveResult
    if (playerMoveResult) {
      director.handlePlayerMoveResult(playerMoveResult, commandsCtx)
    }

    // 4. Step the deep director simulation engine
    const { controlMode, activeWyvernId } = usePlayerControlStore.getState()
    director.step(
      dt,
      {
        playerPosition: commands.playerPosition,
        playerLocomotion: commands.playerLocomotion,
        controlMode,
        activeWyvernId,
        cameraRotationY: camera.rotation.y,
        elapsedTime: threeState.clock.elapsedTime,
        colliders,
        placedObjects,
      },
      wyverns,
      commandsCtx,
    )

    // Trigger visual reconciliation if animations changed
    setVisualVersion((v) => v + 1)

    // 5. Update command wheel 2D anchor projection (frozen in place once open to prevent hover jitter)
    if (selectedAgent && selectedWyvern) {
      const currentAnchor = useSanctuaryCommands.getState().wheelAnchor
      if (!currentAnchor.visible) {
        projected.current
          .set(
            selectedAgent.position.x,
            selectedAgent.position.y + modelHeight(selectedWyvern) * 0.65,
            selectedAgent.position.z,
          )
          .project(camera)
        const visible = projected.current.z > -1 && projected.current.z < 1
        const wheelDiameter = clamp(Math.min(size.width, size.height) * 0.62, 272, 348)
        const reach = wheelDiameter / 2 + 14
        const topbarBottom = document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0
        const marginX = Math.min(reach, size.width / 2)
        const marginBottom = Math.min(reach, size.height / 2)
        const marginTop = Math.min(Math.max(reach, topbarBottom + reach), size.height - marginBottom)
        commands.setWheelAnchor({
          x: Math.round(clamp((projected.current.x * 0.5 + 0.5) * size.width, marginX, size.width - marginX)),
          y: Math.round(clamp((-projected.current.y * 0.5 + 0.5) * size.height, marginTop, size.height - marginBottom)),
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

    // 6. Broadcast active wyvern position for Camera Follow Wyvern mode
    let wyvernTargetAgent = (controlMode === 'wyvern' && activeWyvernId)
      ? director.agents.get(activeWyvernId)
      : selectedAgent

    if (controlMode === 'wyvern' && useCameraStore.getState().followTarget !== 'wyvern') {
      useCameraStore.getState().setFollowTarget('wyvern')
    } else if (controlMode === 'human' && useCameraStore.getState().followTarget === 'wyvern' && !selectedAgent) {
      useCameraStore.getState().setFollowTarget('character')
    }

    if (!wyvernTargetAgent) {
      for (const agent of director.agents.values()) {
        if (agent.airborne) {
          wyvernTargetAgent = agent
          break
        }
      }
      if (!wyvernTargetAgent && director.agents.size > 0) {
        wyvernTargetAgent = director.agents.values().next().value
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

  return (
    <>
      {wyverns.map((wyvern) => {
        const agent = directorRef.current.agents.get(wyvern.id)
        const visual = directorRef.current.getVisual(wyvern.id)
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
            onModelReady={(root) => {
              agent.rig.mount(root)
            }}
            onActionFinished={(request) => {
              directorRef.current.onActionFinished(wyvern.id, request.token)
            }}
            onSelect={() => {
              useSanctuaryCommands.getState().select(wyvern.id)
            }}
          />
        )
      })}
      <SanctuaryDust agents={agentsRef} />
      <SanctuaryWildlife agents={agentsRef} />
      <AttackTargetReticle />
      <PatrolMarkers />
    </>
  )
}
