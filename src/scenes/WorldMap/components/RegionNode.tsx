'use client'

import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, type Mesh, type Group } from 'three'
import { WorldLabel } from '@/render/labels/WorldLabel'
import { SPECIES } from '@/core/data/species'
import { GROUND_DECAL } from '@/scenes/Sanctuary/groundDecal'
import { MapNode } from '../mapGraph'
import { nodeRadius, statusColor, nodeGroundColor } from '../nodeVisuals'
import { getTierGeometries, getSharedNodeMaterial } from '../mapResources'
import { wasDrag } from '../interaction'

export interface RegionNodeProps {
  node: MapNode
  selected: boolean
  isHovered: boolean
  onPointerOver: () => void
  onPointerOut: () => void
  onSelect: () => void
}

export function RegionNode({
  node,
  selected,
  isHovered,
  onPointerOver,
  onPointerOut,
  onSelect,
}: RegionNodeProps) {
  const groupRef = useRef<Group>(null)
  const ringRef = useRef<Mesh>(null)

  const { def, owner, attackable, unrest, garrisonStrength } = node
  const baseHeight = 0.8 + def.tier * 0.9
  const radius = nodeRadius(def.tier)
  const speciesColor = SPECIES[def.nativeSpecies]?.color ?? '#888'
  const isHeld = owner === 'player'

  const tierGeom = getTierGeometries(def.tier)
  const sharedMaterial = getSharedNodeMaterial()
  const groundColor = nodeGroundColor(def.biome)
  const badgeColor = statusColor(owner, attackable)

  useFrame((frameState, delta) => {
    const t = frameState.clock.elapsedTime

    if (groupRef.current) {
      const targetScale = selected || isHovered ? 1.05 : 1.0
      groupRef.current.scale.x = MathUtils.lerp(groupRef.current.scale.x, targetScale, delta * 8)
      groupRef.current.scale.z = MathUtils.lerp(groupRef.current.scale.z, targetScale, delta * 8)
    }

    if (ringRef.current) {
      const pulse = attackable && !isHeld ? 1 + Math.sin(t * 2.8) * 0.08 : 1
      const targetScale = selected || isHovered ? pulse * 1.15 : pulse
      ringRef.current.scale.setScalar(targetScale)
    }
  })

  return (
    <group position={[def.position.x, 0, def.position.z]} ref={groupRef}>
      {/* Terrain Elevation Pedestal */}
      <mesh
        position={[0, baseHeight / 2, 0]}
        geometry={tierGeom.baseGeometry}
        material={sharedMaterial}
        receiveShadow
        castShadow
      />

      {/* Biome Top Cap */}
      <mesh
        position={[0, baseHeight + 0.3, 0]}
        castShadow
        onClick={(e) => {
          e.stopPropagation()
          if (!wasDrag(e)) {
            onSelect()
          }
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
          onPointerOver()
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto'
          onPointerOut()
        }}
      >
        <cylinderGeometry args={[radius, radius + 0.4, 0.6, 32]} />
        <meshStandardMaterial color={groundColor} roughness={0.75} />
      </mesh>

      {/* Status Emblem Ring */}
      <mesh
        ref={ringRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, baseHeight + 0.75, 0]}
        geometry={tierGeom.ringGeometry}
        renderOrder={10}
      >
        <meshBasicMaterial
          color={selected ? '#ffe6a8' : speciesColor}
          opacity={selected ? 0.95 : isHovered ? 0.8 : 0.5}
          {...GROUND_DECAL}
        />
      </mesh>

      {/* Conquered Glow Ring */}
      {isHeld && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, baseHeight + 0.76, 0]}
          renderOrder={11}
        >
          <ringGeometry args={[radius + 0.6, radius + 1.2, 32]} />
          <meshBasicMaterial color="#22c55e" opacity={0.25} {...GROUND_DECAL} />
        </mesh>
      )}

      {/* Unrest Bar — player owned regions */}
      {isHeld && unrest > 0 && (
        <mesh position={[0, baseHeight + 1.0, radius + 1.2]}>
          <boxGeometry args={[(unrest / 100) * radius * 1.5, 0.3, 0.3]} />
          <meshBasicMaterial color={unrest > 65 ? '#ef4444' : '#f59e0b'} />
        </mesh>
      )}

      {/* Garrison Strength Indicator Bar */}
      {!isHeld && garrisonStrength > 0 && (
        <mesh position={[0, baseHeight + 1.0, radius + 1.2]}>
          <boxGeometry args={[Math.min(radius * 1.8, Math.max(0.4, garrisonStrength / 200)), 0.3, 0.3]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
      )}

      {/* World Labels */}
      <WorldLabel text={def.name} position={[0, baseHeight + 7.5, 0]} size={3.6} variant="map" />
      <WorldLabel
        text={isHeld ? 'HELD' : attackable ? 'REACHABLE' : `TIER ${def.tier}`}
        position={[0, baseHeight + 4.8, 0]}
        size={2.1}
        variant="default"
        color={badgeColor}
      />
    </group>
  )
}
