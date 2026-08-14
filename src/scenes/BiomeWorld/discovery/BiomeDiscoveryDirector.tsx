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
import { getRegionLandmarkAnchors, nearestSurveyableLandmark } from './landmarkAnchors'

/**
 * Discovery director for a biome expedition (Atlas Stage 2).
 *
 * Three jobs, none of them per-frame React state:
 * 1. Dispatch the first-visit intent once the biome scene is actually
 *    mounted — inspecting a map row is not a visit. The execution is
 *    idempotent, so remounts after mode flips cannot double-log.
 * 2. Survey landmarks: while the on-foot player stands inside an undiscovered
 *    anchor's approach ring, the shared `nearby` prompt offers the survey and
 *    E confirms it. Discovery is a deliberate action, never a passive mount
 *    side effect.
 * 3. Render discovered landmark labels and one-shot discovery flourishes.
 *
 * Proximity is checked from the shared `playerPosition` store — the same
 * guarded source the sanctuary uses — via a rAF loop that only touches React
 * state when the surveyable landmark actually changes.
 */

/** How long a discovery flourish label stays up. */
const FLOURISH_DURATION_MS = 6000

interface Flourish {
  key: number
  text: string
  x: number
  y: number
  z: number
}

export function BiomeDiscoveryDirector() {
  const state = useGameState()
  const revision = useGame((s) => s.revision)
  const selectedRegion = useGame((s) => s.selectedRegion)
  const controlMode = usePlayerControlStore((c) => c.controlMode)

  const regionId = selectedRegion ?? STARTING_REGION
  const regionDef = REGIONS[regionId] ?? REGION_LIST[0]!
  const knowledge = getRegionKnowledge(state, regionId)
  const seed = state.seed
  const biome = regionDef.biome

  const anchors = useMemo(() => getRegionLandmarkAnchors(regionId, seed), [regionId, seed])
  // The core mutates GameState in place; revision keys the derived lists.
  const discoveredIds = useMemo(
    () => knowledge?.discoveredLandmarkIds ?? [],
    [knowledge, revision],
  )

  // --- 1. Scene-ready first visit --------------------------------------
  // The execution no-ops for an already-visited region, but a no-op intent
  // would still bloat the replay log on every remount, so guard on the live
  // state before dispatching.
  useEffect(() => {
    const live = useGame.getState().state
    const alreadyVisited = live.atlasKnowledge[regionId]?.visited
    if (!alreadyVisited) {
      dispatch({ type: 'RECORD_REGION_VISIT', regionId })
    }
  }, [regionId])

  // --- 2. Proximity survey loop ----------------------------------------
  const [surveyable, setSurveyable] = useState<{
    landmarkId: string
    name: string
  } | null>(null)
  const surveyableRef = useRef(surveyable)
  surveyableRef.current = surveyable
  const discoveredRef = useRef(discoveredIds)
  discoveredRef.current = discoveredIds
  const anchorsRef = useRef(anchors)
  anchorsRef.current = anchors
  const interactLatch = useRef(false)

  useEffect(() => {
    // Only the on-foot surveyor can discover landmarks.
    if (controlMode !== 'human') return

    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)

      const player = useSanctuaryCommands.getState().playerPosition
      const next = nearestSurveyableLandmark(anchorsRef.current, discoveredRef.current, player)
      const currentId = surveyableRef.current?.landmarkId ?? null
      const nextId = next?.landmarkId ?? null
      if (currentId !== nextId) {
        setSurveyable(next ? { landmarkId: next.landmarkId, name: next.name } : null)
      }

      // Edge-triggered E: one discovery per press, only with a target.
      const pressed = isDown(...CONTROLS.interact)
      if (pressed && !interactLatch.current && next) {
        dispatch({ type: 'DISCOVER_LANDMARK', regionId, landmarkId: next.landmarkId })
      }
      interactLatch.current = pressed
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [controlMode, regionId])

  // The shared nearby prompt renders "E Survey <name>" in the HUD. Nothing
  // else in the biome scene claims it, and `setNearby` is change-guarded.
  const surveyPromptId = surveyable ? `landmark:${surveyable.landmarkId}` : null
  useEffect(() => {
    useUi
      .getState()
      .setNearby(
        surveyPromptId && controlMode === 'human'
          ? {
              id: surveyPromptId,
              label: `Survey ${surveyable!.name} — record in the World Atlas`,
              // The biome scene never opens panels on E; the survey itself is
              // handled by the rAF loop above. Panel is required by the type.
              panel: 'help',
            }
          : null,
      )
  }, [surveyPromptId, surveyable, controlMode])
  // Release the prompt when the director unmounts (leaving the biome scene).
  useEffect(() => {
    return () => {
      if (useUi.getState().nearby?.id.startsWith('landmark:')) {
        useUi.getState().setNearby(null)
      }
    }
  }, [])

  // --- 3. Discovery flourish -------------------------------------------
  const [flourishes, setFlourishes] = useState<Flourish[]>([])
  const flourishSeq = useRef(0)
  const knownCountRef = useRef(discoveredIds.length)

  useEffect(() => {
    if (discoveredIds.length > knownCountRef.current) {
      const lastId = discoveredIds[discoveredIds.length - 1]
      const anchor = anchors.find((a) => a.landmarkId === lastId)
      if (anchor) {
        const key = ++flourishSeq.current
        const y = biomeHeightAt(biome, anchor.x, anchor.z, regionId, seed) + 12
        setFlourishes((prev) => [
          ...prev,
          { key, text: `✦ ${anchor.name} discovered`, x: anchor.x, y, z: anchor.z },
        ])
        window.setTimeout(() => {
          setFlourishes((prev) => prev.filter((f) => f.key !== key))
        }, FLOURISH_DURATION_MS)
      }
    }
    knownCountRef.current = discoveredIds.length
  }, [discoveredIds, anchors, biome, regionId, seed])

  return (
    <group>
      {/* Undiscovered landmark labels stay hidden — discovery-first. */}
      {anchors
        .filter((a) => discoveredIds.includes(a.landmarkId))
        .map((anchor) => {
          const y = biomeHeightAt(biome, anchor.x, anchor.z, regionId, seed) + 8
          return (
            <WorldLabel
              key={anchor.landmarkId}
              position={[anchor.x, y, anchor.z]}
              text={`✦ ${anchor.name}`}
              size={2.4}
              variant="default"
            />
          )
        })}
      {flourishes.map((f) => (
        <WorldLabel
          key={f.key}
          position={[f.x, f.y, f.z]}
          text={f.text}
          size={3.4}
          variant="map"
          color="#ffe6a8"
        />
      ))}
    </group>
  )
}
