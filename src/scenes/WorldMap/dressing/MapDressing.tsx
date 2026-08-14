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
      {Object.entries(plan).map(([key, group]) => {
        const items = group.items.map((p) => ({
          position: p.position,
          rotationY: p.rotationY,
          scale: p.scale,
        }))

        const wind = group.items[0]?.wind

        return (
          <PropInstances
            key={key}
            id={group.propId}
            items={items}
            color={group.color}
            wind={wind}
            castShadow={false}
          />
        )
      })}
    </group>
  )
}
