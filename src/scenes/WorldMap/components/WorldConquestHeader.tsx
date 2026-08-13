'use client'

import { useMemo } from 'react'
import { WorldLabel } from '@/render/labels/WorldLabel'
import { REGION_LIST } from '@/core/data/regions'
import { useGameState } from '@/state/store'

/** 3D World Conquest Banner displaying held region count and total income */
export function WorldConquestHeader() {
  const state = useGameState()

  const { ownedCount, totalYields } = useMemo(() => {
    let ownedCount = 0
    const yields: Record<string, number> = { food: 0, gold: 0, ore: 0, timber: 0, arcane: 0 }

    for (const rDef of REGION_LIST) {
      const rState = state.regions[rDef.id]
      if (rState?.owner === 'player') {
        ownedCount++
        for (const [k, v] of Object.entries(rDef.yields)) {
          if (v) yields[k] = (yields[k] ?? 0) + v
        }
      }
    }
    return { ownedCount, totalYields: yields }
  }, [state])

  const incomeText = `Income/hr: 🌾 ${totalYields.food} · 💰 ${totalYields.gold} · ⛏ ${totalYields.ore} · 🪵 ${totalYields.timber} · ✨ ${totalYields.arcane}`

  return (
    <group position={[0, 16, 96]}>
      {/* Wooden Arch Banner Frame */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[48, 4.5, 0.4]} />
        <meshStandardMaterial color="#1e293b" roughness={0.7} />
      </mesh>
      {/* Banner Border Highlight */}
      <mesh position={[0, 0, 0.22]}>
        <planeGeometry args={[47.2, 4.0]} />
        <meshStandardMaterial color="#0f172a" roughness={0.8} />
      </mesh>

      {/* Main Title */}
      <WorldLabel
        text={`WYVERN CONQUEST BOARD — ${ownedCount} / ${REGION_LIST.length} REGIONS HELD`}
        position={[0, 0.8, 0.4]}
        size={3.4}
        variant="station"
        color="#86efac"
      />

      {/* Income Subtitle */}
      <WorldLabel
        text={incomeText}
        position={[0, -0.9, 0.4]}
        size={2.2}
        variant="default"
        color="#fdba74"
      />
    </group>
  )
}
