'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { REGIONS, REGION_LIST, STARTING_REGION } from '@/core/data/regions'
import { getRegionKnowledge } from '@/core/state/atlasKnowledge'
import { dispatch, useGame, useGameState } from '@/state/store'
import { usePlayerControlStore } from '@/state/playerControlStore'
import { useSanctuaryCommands } from '@/state/sanctuaryCommands'
import { useUi } from '@/state/uiStore'
import { CONTROLS, isDown } from '@/render/controllers/input'
import { WorldLabel } from '@/render/labels/WorldLabel'
import { biomeHeightAt } from '../terrain/BiomeTerrain'
import {
  getRegionExpeditionSpec,
  isHazardVentActive,
  type ExpeditionNodeAnchor,
} from './expeditionPuzzles'

/**
 * Expedition Activity Director.
 *
 * Handles interactive in-world puzzle nodes, ancient rune alignments,
 * and environmental hazard surveying in wild biomes.
 *
 * Sequence:
 * 1. Surveyor approaches an uncompleted activity node.
 * 2. If hazard: surveyor must approach when vent is dormant.
 * 3. If multi-node puzzle: nodes can be activated, unlocking the mystery once all are active.
 * 4. Dispatches COMPLETE_EXPEDITION_ACTIVITY once all nodes are engaged.
 * 5. Emits typed event, logs mystery solve, and renders persistent WorldLabel markers.
 */

const FLOURISH_DURATION_MS = 6500

export function ExpeditionActivityDirector() {
  const state = useGameState()
  const revision = useGame((s) => s.revision)
  const selectedRegion = useGame((s) => s.selectedRegion)
  const controlMode = usePlayerControlStore((c) => c.controlMode)

  const regionId = selectedRegion ?? STARTING_REGION
  const regionDef = REGIONS[regionId] ?? REGION_LIST[0]!
  const biome = regionDef.biome
  const seed = state.seed

  const spec = useMemo(() => getRegionExpeditionSpec(regionId, seed), [regionId, seed])
  const completed = useMemo(() => {
    const knowledge = getRegionKnowledge(state, regionId)
    return !!knowledge?.completedActivityIds.includes(spec?.activity.id ?? '')
  }, [state, regionId, spec, revision])

  const [activeNodes, setActiveNodes] = useState<number[]>([])
  const activeNodesRef = useRef(activeNodes)
  activeNodesRef.current = activeNodes

  const completedRef = useRef(completed)
  completedRef.current = completed

  // Reset activated nodes when changing region
  useEffect(() => {
    setActiveNodes([])
  }, [regionId])

  // --- Proximity & Interaction Loop ------------------------------------
  const [nearestPrompt, setNearestPrompt] = useState<{
    node: ExpeditionNodeAnchor
    isHazardSafe: boolean
  } | null>(null)
  const nearestPromptRef = useRef(nearestPrompt)
  nearestPromptRef.current = nearestPrompt
  const interactLatch = useRef(false)

  useEffect(() => {
    if (controlMode !== 'human' || !spec || completed) {
      setNearestPrompt(null)
      return
    }

    let raf = 0
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const nowSec = now / 1000

      const player = useSanctuaryCommands.getState().playerPosition
      let closest: { node: ExpeditionNodeAnchor; isHazardSafe: boolean } | null = null
      let minDist = Infinity

      for (const node of spec.nodes) {
        if (activeNodesRef.current.includes(node.nodeIndex)) continue

        const dist = Math.hypot(player[0] - node.x, player[1] - node.z)
        if (dist <= node.approachRadius && dist < minDist) {
          minDist = dist
          const isHazard = spec.activity.kind === 'hazard'
          const isActive = isHazard
            ? isHazardVentActive(regionId, node.nodeIndex, nowSec, seed)
            : false
          closest = { node, isHazardSafe: !isActive }
        }
      }

      if (
        (nearestPromptRef.current?.node.nodeIndex ?? null) !==
          (closest?.node.nodeIndex ?? null) ||
        nearestPromptRef.current?.isHazardSafe !== closest?.isHazardSafe
      ) {
        setNearestPrompt(closest)
      }

      // Change-guarded UI prompt update
      const ui = useUi.getState()
      const current = ui.nearby?.id ?? null
      const promptId = closest ? `expedition:${spec.activity.id}:${closest.node.nodeIndex}` : null

      if (
        promptId !== current &&
        !(current !== null && (current.startsWith('landmark:') || current.startsWith('phenomenon:')))
      ) {
        if (closest && promptId) {
          let label = `Activate ${closest.node.name} [E]`
          if (spec.activity.kind === 'hazard') {
            label = closest.isHazardSafe
              ? `Survey Quiescent Vent [E]`
              : `⚠️ Thermal Vent Superheated — Wait to Subside`
          } else if (spec.activity.kind === 'puzzle') {
            label = `Tune Resonance Glyph [E]`
          } else if (spec.activity.kind === 'trail') {
            label = `Catalogue Flora Specimen [E]`
          }
          ui.setNearby({ id: promptId, label, panel: 'help' })
        } else if (current && current.startsWith('expedition:')) {
          ui.setNearby(null)
        }
      }

      // Handle Key Interaction
      const pressed = isDown(...CONTROLS.interact)
      if (
        pressed &&
        !interactLatch.current &&
        closest &&
        closest.isHazardSafe &&
        current === promptId
      ) {
        const nextActive = [...activeNodesRef.current, closest.node.nodeIndex]
        setActiveNodes(nextActive)

        // Check if all nodes in spec are now activated
        if (nextActive.length >= spec.nodes.length) {
          dispatch({
            type: 'COMPLETE_EXPEDITION_ACTIVITY',
            regionId,
            activityId: spec.activity.id,
          })
        }
      }
      interactLatch.current = pressed
    }

    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      const ui = useUi.getState()
      if (ui.nearby?.id.startsWith('expedition:')) {
        ui.setNearby(null)
      }
    }
  }, [controlMode, regionId, seed, spec, completed])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const ui = useUi.getState()
      if (ui.nearby?.id.startsWith('expedition:')) {
        ui.setNearby(null)
      }
    }
  }, [])

  // --- Completion Flourish ---------------------------------------------
  const [flourish, setFlourish] = useState<{
    key: number
    x: number
    y: number
    z: number
    name: string
    tag: string
  } | null>(null)
  const flourishSeq = useRef(0)
  const wasCompletedRef = useRef(completed)

  useEffect(() => {
    if (completed && !wasCompletedRef.current && spec) {
      const key = ++flourishSeq.current
      const y = biomeHeightAt(biome, spec.centerX, spec.centerZ, regionId, seed) + 14
      setFlourish({
        key,
        x: spec.centerX,
        y,
        z: spec.centerZ,
        name: spec.activity.name,
        tag: spec.activity.knowledgeTag,
      })
      window.setTimeout(() => {
        setFlourish((prev) => (prev?.key === key ? null : prev))
      }, FLOURISH_DURATION_MS)
    }
    wasCompletedRef.current = completed
  }, [completed, spec, biome, regionId, seed])

  if (!spec) return null

  return (
    <group>
      {/* 3D Visual Nodes / Monoliths */}
      {spec.nodes.map((node) => {
        const y = biomeHeightAt(biome, node.x, node.z, regionId, seed)
        const isNodeActive = activeNodes.includes(node.nodeIndex) || completed
        return (
          <group key={node.nodeIndex} position={[node.x, y, node.z]}>
            {/* Interactive Physical Pillar */}
            <mesh position={[0, 1.8, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.5, 0.7, 3.6, 6]} />
              <meshStandardMaterial
                color={isNodeActive ? spec.activity.themeColor : '#475569'}
                roughness={0.4}
                metalness={0.2}
                emissive={isNodeActive ? spec.activity.themeColor : '#0f172a'}
                emissiveIntensity={isNodeActive ? 0.6 : 0.1}
              />
            </mesh>

            {/* Resonant Beacon Cap */}
            <mesh position={[0, 3.9, 0]}>
              <octahedronGeometry args={[0.45]} />
              <meshStandardMaterial
                color={spec.activity.themeColor}
                emissive={spec.activity.themeColor}
                emissiveIntensity={isNodeActive ? 1.0 : 0.2}
              />
            </mesh>

            {/* In-world label */}
            <WorldLabel
              position={[0, 5.2, 0]}
              text={isNodeActive ? `✦ ${node.name} [Aligned]` : `✧ ${node.name}`}
              size={2.0}
              color={isNodeActive ? spec.activity.themeColor : '#cbd5e1'}
              variant="default"
            />
          </group>
        )
      })}

      {/* Completion Monolith Banner */}
      {completed && (
        <WorldLabel
          position={[
            spec.centerX,
            biomeHeightAt(biome, spec.centerX, spec.centerZ, regionId, seed) + 9,
            spec.centerZ,
          ]}
          text={`✦ Mystery Solved: ${spec.activity.name} [${spec.activity.knowledgeTag}]`}
          size={2.6}
          color={spec.activity.themeColor}
          variant="map"
        />
      )}

      {/* Flourish Toast */}
      {flourish && (
        <WorldLabel
          key={flourish.key}
          position={[flourish.x, flourish.y, flourish.z]}
          text={`✦ EXPEDITION DISCOVERY: ${flourish.name} — ${flourish.tag}`}
          size={3.4}
          color="#fef08a"
          variant="map"
        />
      )}
    </group>
  )
}
