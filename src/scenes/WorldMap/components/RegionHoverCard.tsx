'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, MathUtils } from 'three'
import { WorldLabel } from '@/render/labels/WorldLabel'
import { SPECIES } from '@/core/data/species'
import { UNITS } from '@/core/data/units'
import type { RegionHoverCardProps } from '../types'

const RESOURCE_ICONS: Record<string, string> = {
  food: '🌾',
  gold: '💰',
  ore: '⛏',
  timber: '🪵',
  arcane: '✨',
}

export function RegionHoverCard({ def, state }: RegionHoverCardProps) {
  const groupRef = useRef<Group>(null)
  
  const baseHeight = 0.8 + def.tier * 0.9
  const targetHeight = baseHeight + 12
  const startHeight = baseHeight + 10

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.position.y = MathUtils.lerp(
        groupRef.current.position.y,
        targetHeight,
        delta * 5
      )
      const newScale = MathUtils.lerp(groupRef.current.scale.x, 1.0, delta * 5)
      groupRef.current.scale.setScalar(newScale)
    }
  })

  const isHeld = state?.owner === 'player'
  const titleColor = isHeld ? '#86efac' : '#fdba74'

  // Line 2: Yields
  const yields = def.yields || {}
  const yieldsText = Object.entries(yields)
    .map(([k, v]) => `${RESOURCE_ICONS[k] ?? ''} ${v} ${k}`)
    .join(' · ')

  // Line 3: Garrison & Info
  const garrison = def.garrison || []
  const totalStrength = garrison.reduce((acc, g) => acc + g.strength, 0)
  
  let dominantUnit = ''
  if (garrison.length > 0) {
    const dom = [...garrison].sort((a, b) => b.strength - a.strength)[0]
    if (dom) {
      dominantUnit = UNITS[dom.unitId]?.name ?? dom.unitId
    }
  }
  const garrisonBreakdown = totalStrength > 0 ? `${totalStrength} (${dominantUnit})` : '0'
  
  const defenders = def.defenders || []
  const wyvernsCount = defenders.length
  const speciesObj = SPECIES[def.nativeSpecies]
  const speciesName = speciesObj?.name ?? def.nativeSpecies
  const speciesTraits = speciesObj?.traitPool.join(', ') ?? 'none'

  let line3 = `Native: ${speciesName} | Garrison: ${garrisonBreakdown} | Wyverns: ${wyvernsCount}`
  if (isHeld && state?.unrest !== undefined) {
    line3 += ` | Unrest: ${state.unrest}%`
  }

  const line4 = `Traits: ${speciesTraits}`

  return (
    <group ref={groupRef} position={[def.position.x, startHeight, def.position.z]} scale={0.8}>
      <WorldLabel
        text={`${def.name} (${def.biome.toUpperCase()})`}
        position={[0, 0, 0]}
        size={3.2}
        variant="station"
        color={titleColor}
      />
      
      <WorldLabel
        text={yieldsText}
        position={[0, -3.0, 0]}
        size={2.4}
        variant="default"
      />

      <WorldLabel
        text={line3}
        position={[0, -5.5, 0]}
        size={2.0}
        variant="default"
      />

      <WorldLabel
        text={line4}
        position={[0, -7.8, 0]}
        size={1.8}
        variant="default"
        color="#cbd5e1"
      />
    </group>
  )
}
