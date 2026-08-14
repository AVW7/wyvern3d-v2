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
  getRegionObservationVantage,
  isPhenomenonActive,
} from './observationVantage'

/**
 * Observation director (Biome Enhancement Stage 4).
 *
 * The region's authored observation activity: while the on-foot surveyor
 * stands at the phenomenon's vantage (beside the ambient loop), the shared
 * `nearby` prompt offers the observation and E records it in the World Atlas
 * via OBSERVE_PHENOMENON. Timed phenomena only offer the prompt inside their
 * deterministic window, so "time an environmental phenomenon" is real play.
 *
 * Same rules as the landmark director: rAF proximity loop that touches React
 * state only on change, edge-triggered E, landmark prompts win conflicts
 * (discovery stays primary), and the prompt is namespaced for safe cleanup.
 */

/** How long the observation flourish label stays up. */
const FLOURISH_DURATION_MS = 6000

export function ObservationDirector() {
  const state = useGameState()
  const revision = useGame((s) => s.revision)
  const selectedRegion = useGame((s) => s.selectedRegion)
  const controlMode = usePlayerControlStore((c) => c.controlMode)

  const regionId = selectedRegion ?? STARTING_REGION
  const regionDef = REGIONS[regionId] ?? REGION_LIST[0]!
  const biome = regionDef.biome
  const seed = state.seed

  const vantage = useMemo(
    () => getRegionObservationVantage(regionId, seed),
    [regionId, seed],
  )
  // The core mutates GameState in place; revision keys the derived value.
  const observed = useMemo(() => {
    const knowledge = getRegionKnowledge(state, regionId)
    return !!knowledge?.observedPhenomenonIds.includes(vantage?.phenomenonId ?? '')
  }, [state, regionId, vantage, revision])
  const observedRef = useRef(observed)
  observedRef.current = observed
  const vantageRef = useRef(vantage)
  vantageRef.current = vantage

  // --- Proximity + E loop ----------------------------------------------
  const [offerable, setOfferable] = useState<{ id: string; name: string } | null>(null)
  const offerableRef = useRef(offerable)
  offerableRef.current = offerable
  const interactLatch = useRef(false)

  useEffect(() => {
    // Only the on-foot surveyor can observe; nothing to do once recorded.
    if (controlMode !== 'human' || !vantage || observed) {
      setOfferable(null)
      return
    }

    const promptId = `phenomenon:${vantage.phenomenonId}`
    let raf = 0
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)

      const player = useSanctuaryCommands.getState().playerPosition
      const inRange =
        Math.hypot(player[0] - vantage.x, player[1] - vantage.z) <= vantage.approachRadius
      const active = isPhenomenonActive(regionId, vantage.kind, now / 1000, seed)

      const next = inRange && active && !observedRef.current
        ? { id: vantage.phenomenonId, name: vantage.name }
        : null
      if ((offerableRef.current?.id ?? null) !== (next?.id ?? null)) {
        setOfferable(next)
      }

      // The shared prompt: per-frame but change-guarded, and landmark
      // prompts win — a nearby undiscovered landmark stays the E action.
      const ui = useUi.getState()
      const current = ui.nearby?.id ?? null
      const desired = next ? promptId : null
      if (desired !== current && !(current !== null && current.startsWith('landmark:'))) {
        ui.setNearby(
          desired
            ? {
                id: promptId,
                label: `Observe ${vantage.name}${vantage.kind === 'timed' ? ' — the phenomenon is active now' : ''}`,
                // The biome scene never opens panels on E; the observation
                // itself is handled here. Panel is required by the type.
                panel: 'help',
              }
            : null,
        )
      }

      // Edge-triggered E: only when this prompt actually owns the HUD slot.
      const pressed = isDown(...CONTROLS.interact)
      if (pressed && !interactLatch.current && next && current === promptId) {
        dispatch({ type: 'OBSERVE_PHENOMENON', regionId, phenomenonId: vantage.phenomenonId })
      }
      interactLatch.current = pressed
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      // The loop owns the prompt only while running; hand it back so a
      // completed observation or mode flip can't leave a stale prompt.
      const ui = useUi.getState()
      if (ui.nearby?.id === `phenomenon:${vantage.phenomenonId}`) {
        ui.setNearby(null)
      }
    }
  }, [controlMode, regionId, seed, vantage, observed])

  // Release the prompt when the director unmounts (leaving the biome scene)
  // or when observation completes mid-range.
  useEffect(() => {
    return () => {
      const ui = useUi.getState()
      if (ui.nearby?.id.startsWith('phenomenon:')) {
        ui.setNearby(null)
      }
    }
  }, [])

  // --- Observation flourish ---------------------------------------------
  const [flourish, setFlourish] = useState<{ key: number; x: number; y: number; z: number } | null>(null)
  const flourishSeq = useRef(0)
  const wasObservedRef = useRef(observed)

  useEffect(() => {
    if (observed && !wasObservedRef.current && vantage) {
      const key = ++flourishSeq.current
      const y = biomeHeightAt(biome, vantage.x, vantage.z, regionId, seed) + 12
      setFlourish({ key, x: vantage.x, y, z: vantage.z })
      window.setTimeout(() => {
        setFlourish((prev) => (prev?.key === key ? null : prev))
      }, FLOURISH_DURATION_MS)
    }
    wasObservedRef.current = observed
  }, [observed, vantage, biome, regionId, seed])

  return (
    <group>
      {/* Observed phenomenon label stays at the vantage as a record. */}
      {observed && vantage && (
        <WorldLabel
          position={[vantage.x, biomeHeightAt(biome, vantage.x, vantage.z, regionId, seed) + 8, vantage.z]}
          text={`◉ ${vantage.name}`}
          size={2.4}
          variant="default"
        />
      )}
      {flourish && (
        <WorldLabel
          key={flourish.key}
          position={[flourish.x, flourish.y, flourish.z]}
          text={`◉ Recorded in the World Atlas — ${vantage?.name ?? ''}`}
          size={3.4}
          variant="map"
          color="#ffe6a8"
        />
      )}
    </group>
  )
}
