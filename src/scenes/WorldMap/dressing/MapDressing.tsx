'use client'

import React, { useMemo } from 'react'
import { PropInstances } from '@/render/assets/props'
import { useGameState } from '@/state/store'
import { planDressing } from './dressingPlan'

export function MapDressing() {
  const seed = useGameState().seed
  const plan = useMemo(() => planDressing(seed), [seed])

  return (
    <group>
      {Object.entries(plan).map(([propId, placements]) => {
        const items = placements.map((p) => ({
          position: p.position,
          rotationY: p.rotationY,
          scale: p.scale,
        }))

        const wind = placements[0]?.wind

        return <PropInstances key={propId} id={propId} items={items} wind={wind} castShadow={false} />
      })}
    </group>
  )
}
