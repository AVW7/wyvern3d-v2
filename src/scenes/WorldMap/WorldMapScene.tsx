'use client'

import React, { useMemo } from 'react'
import { REGION_LIST } from '@/core/data/regions'
import { useGame, useGameState } from '@/state/store'
import { useUi } from '@/state/uiStore'
import { useMapUiStore } from '@/state/mapUiStore'
import { MapCamera } from './components/MapCamera'
import { RegionNode } from './components/RegionNode'
import { SupplyLines } from './components/SupplyLines'
import { MapGround } from './terrain/MapGround'
import { MapAtmosphere } from './atmosphere/MapAtmosphere'
import { MapDressing } from './dressing/MapDressing'
import { MapBeacons } from './atmosphere/MapBeacons'
import { MapAmbience } from './atmosphere/MapAmbience'
import { WindClock } from '@/render/assets/WindClock'
import { buildMapGraph, mapSignature } from './mapGraph'

/**
 * The world map: an interactive 3D tactical board for every region in REGIONS.
 * High visual quality, graph-driven terrain, shared atmosphere, and prop dressing.
 */
export function WorldMapScene() {
  const state = useGameState()
  const selected = useGame((s) => s.selectedRegion)
  const selectRegion = useGame((s) => s.selectRegion)
  const openPanel = useUi((s) => s.open)

  const hovered = useMapUiStore((s) => s.hovered)
  const setHovered = useMapUiStore((s) => s.setHovered)
  const setInspected = useMapUiStore((s) => s.setInspected)

  // Compute map graph memoized by map signature
  const sig = mapSignature(state)
  const { nodes, edges } = useMemo(() => buildMapGraph(state), [sig])

  return (
    <>
      <MapCamera />
      <MapAtmosphere />
      <WindClock />

      {/* Graph-Driven Terrain & Ground */}
      <MapGround />

      {/* Data-Driven Atlas Scenery Dressing */}
      <MapDressing />

      {/* Budgeted Beacons & Motes Ambience */}
      <MapBeacons />
      <MapAmbience />

      {/* Batch-rendered Supply Lines */}
      <SupplyLines edges={edges} />

      {/* Region Nodes */}
      {REGION_LIST.map((def) => {
        const node = nodes[def.id]
        if (!node) return null
        return (
          <RegionNode
            key={def.id}
            node={node}
            selected={selected === def.id}
            isHovered={hovered === def.id}
            onPointerOver={() => setHovered(def.id)}
            onPointerOut={() => setHovered(null)}
            onSelect={() => {
              selectRegion(def.id)
              setInspected(def.id)
              openPanel('warTable')
            }}
          />
        )
      })}
    </>
  )
}
