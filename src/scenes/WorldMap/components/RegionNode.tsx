'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, type Mesh, type Group, type MeshBasicMaterial } from 'three'
import { WorldLabel } from '@/render/labels/WorldLabel'
import { SPECIES } from '@/core/data/species'
import type { RegionNodeProps } from '../types'

/** 3D Resource Yield Indicators placed around the region pedestal */
function ResourceBadges({ yields, radius, baseHeight }: { yields: Record<string, number | undefined>; radius: number; baseHeight: number }) {
  const activeYields = Object.entries(yields).filter(([_, val]) => val && val > 0)
  if (activeYields.length === 0) return null

  return (
    <group position={[0, baseHeight + 0.6, 0]}>
      {activeYields.map(([res, amount], i) => {
        const angle = (i * Math.PI * 2) / activeYields.length - Math.PI / 2
        const rx = Math.cos(angle) * (radius - 1.2)
        const rz = Math.sin(angle) * (radius - 1.2)

        return (
          <group key={res} position={[rx, 0, rz]}>
            {/* Base Pedestal Marker */}
            <mesh position={[0, 0.1, 0]}>
              <cylinderGeometry args={[0.7, 0.8, 0.2, 12]} />
              <meshStandardMaterial color="#1e293b" roughness={0.8} />
            </mesh>

            {/* Food 🌾 */}
            {res === 'food' && (
              <mesh position={[0, 0.5, 0]}>
                <cylinderGeometry args={[0.4, 0.2, 0.7, 8]} />
                <meshStandardMaterial color="#22c55e" roughness={0.6} />
              </mesh>
            )}

            {/* Gold 💰 */}
            {res === 'gold' && (
              <mesh position={[0, 0.5, 0]} rotation={[0, 0.4, 0]}>
                <boxGeometry args={[0.7, 0.5, 0.5]} />
                <meshStandardMaterial color="#eab308" metalness={0.9} roughness={0.2} />
              </mesh>
            )}

            {/* Ore ⛏ */}
            {res === 'ore' && (
              <mesh position={[0, 0.5, 0]} rotation={[0.4, 0.2, 0]}>
                <dodecahedronGeometry args={[0.45]} />
                <meshStandardMaterial color="#64748b" roughness={0.7} metalness={0.5} />
              </mesh>
            )}

            {/* Timber 🪵 */}
            {res === 'timber' && (
              <mesh position={[0, 0.5, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.25, 0.25, 0.8, 8]} />
                <meshStandardMaterial color="#a16207" roughness={0.9} />
              </mesh>
            )}

            {/* Arcane ✨ */}
            {res === 'arcane' && (
              <mesh position={[0, 0.7, 0]}>
                <octahedronGeometry args={[0.4]} />
                <meshStandardMaterial color="#c084fc" emissive="#a855f7" emissiveIntensity={0.6} roughness={0.2} />
              </mesh>
            )}

            {/* Amount Badge Label */}
            <WorldLabel text={`+${amount}`} position={[0, 1.4, 0]} size={1.6} color="#ffffff" variant="default" />
          </group>
        )
      })}
    </group>
  )
}

/** Biome-aware 3D Region Node */
export function RegionNode({
  def,
  color,
  biomeColor,
  owned,
  attackable,
  unrest,
  selected,
  isHovered,
  onPointerOver,
  onPointerOut,
  onSelect,
}: RegionNodeProps) {
  const groupRef = useRef<Group>(null)
  const ring = useRef<Mesh>(null)
  const spireRingRef = useRef<Mesh>(null)
  const conqueredRingRef = useRef<Mesh>(null)
  
  const baseHeight = 0.8 + def.tier * 0.9
  const radius = 5 + def.tier * 0.8
  const speciesColor = SPECIES[def.nativeSpecies]?.color ?? '#888'
  const totalGarrison = def.garrison.reduce((acc, g) => acc + g.strength, 0)
  const garrisonWidth = Math.max(0.1, totalGarrison / 200)

  useFrame((frameState) => {
    const t = frameState.clock.elapsedTime

    if (groupRef.current) {
      const targetGroupScale = selected || isHovered ? 1.06 : 1.0
      groupRef.current.scale.x = MathUtils.lerp(groupRef.current.scale.x, targetGroupScale, 0.1)
      groupRef.current.scale.z = MathUtils.lerp(groupRef.current.scale.z, targetGroupScale, 0.1)
    }

    if (ring.current) {
      const pulse = attackable && !owned ? 1 + Math.sin(t * 2.8) * 0.08 : 1
      const targetScale = selected || isHovered ? pulse * 1.18 : pulse
      ring.current.scale.setScalar(targetScale)
    }

    if (spireRingRef.current) {
      spireRingRef.current.rotation.z = t * 0.5
    }

    if (conqueredRingRef.current) {
      const mat = conqueredRingRef.current.material as MeshBasicMaterial
      if (mat) {
        mat.opacity = 0.15 + Math.sin(t * 1.5) * 0.05
      }
    }
  })

  return (
    <group position={[def.position.x, 0, def.position.z]} ref={groupRef}>
      {/* Terrain Elevation Pedestal */}
      <mesh position={[0, baseHeight / 2, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[radius + 0.8, radius + 1.6, baseHeight, 24]} />
        <meshStandardMaterial color="#2d3830" roughness={0.9} />
      </mesh>

      {/* Biome Top Cap */}
      <mesh
        position={[0, baseHeight + 0.3, 0]}
        castShadow
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
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
        <cylinderGeometry args={[radius, radius + 0.4, 0.6, 24]} />
        <meshStandardMaterial color={color} roughness={0.75} />
      </mesh>

      {/* Biome Center Core Indicator */}
      <mesh position={[0, baseHeight + 0.65, 0]}>
        <cylinderGeometry args={[radius * 0.65, radius * 0.65, 0.15, 24]} />
        <meshStandardMaterial color={biomeColor} roughness={0.6} />
      </mesh>

      {/* Biome Specific Decor */}
      {def.biome === 'forest' && (
        <group position={[0, baseHeight + 0.6, 0]}>
          <mesh position={[-radius * 0.4, 0.75, radius * 0.2]}>
            <coneGeometry args={[0.6, 1.5, 8]} />
            <meshStandardMaterial color="#166534" roughness={0.8} />
          </mesh>
          <mesh position={[radius * 0.3, 0.75, -radius * 0.3]}>
            <coneGeometry args={[0.6, 1.5, 8]} />
            <meshStandardMaterial color="#166534" roughness={0.8} />
          </mesh>
          <mesh position={[radius * 0.1, 0.75, radius * 0.4]}>
            <coneGeometry args={[0.6, 1.5, 8]} />
            <meshStandardMaterial color="#166534" roughness={0.8} />
          </mesh>
        </group>
      )}
      {def.biome === 'mountain' && (
        <group position={[0, baseHeight + 0.6, 0]}>
          <mesh position={[-radius * 0.2, 1, -radius * 0.2]}>
            <coneGeometry args={[0.8, 2, 6]} />
            <meshStandardMaterial color="#64748b" roughness={0.9} />
          </mesh>
          <mesh position={[radius * 0.3, 1, radius * 0.2]}>
            <coneGeometry args={[0.8, 2, 6]} />
            <meshStandardMaterial color="#64748b" roughness={0.9} />
          </mesh>
        </group>
      )}
      {def.biome === 'coast' && (
        <group position={[0, baseHeight + 0.65, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[3, 0.15, 8, 32]} />
            <meshBasicMaterial color="#38bdf8" transparent opacity={0.4} />
          </mesh>
        </group>
      )}
      {def.biome === 'tundra' && (
        <group position={[0, baseHeight + 0.6, 0]}>
          <mesh position={[-radius * 0.3, 0.25, radius * 0.3]}>
            <icosahedronGeometry args={[0.5]} />
            <meshStandardMaterial color="#bae6fd" roughness={0.2} metalness={0.8} />
          </mesh>
          <mesh position={[radius * 0.4, 0.25, -radius * 0.2]}>
            <icosahedronGeometry args={[0.5]} />
            <meshStandardMaterial color="#bae6fd" roughness={0.2} metalness={0.8} />
          </mesh>
        </group>
      )}
      {def.biome === 'spire' && (
        <group position={[0, baseHeight + 0.7, 0]}>
          <mesh ref={spireRingRef} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.5, 2.2, 32]} />
            <meshBasicMaterial color="#7c3aed" transparent opacity={0.6} />
          </mesh>
        </group>
      )}
      {def.biome === 'cavern' && (
        <group position={[0, baseHeight + 0.6, 0]}>
          <mesh position={[-radius * 0.3, 0.2, -radius * 0.2]}>
            <octahedronGeometry args={[0.4]} />
            <meshStandardMaterial color="#a855f7" emissive="#7c3aed" emissiveIntensity={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[radius * 0.2, 0.2, radius * 0.3]}>
            <octahedronGeometry args={[0.4]} />
            <meshStandardMaterial color="#a855f7" emissive="#7c3aed" emissiveIntensity={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[radius * 0.4, 0.2, -radius * 0.4]}>
            <octahedronGeometry args={[0.4]} />
            <meshStandardMaterial color="#a855f7" emissive="#7c3aed" emissiveIntensity={0.5} roughness={0.4} />
          </mesh>
        </group>
      )}

      {/* 3D Resource Output Indicators */}
      <ResourceBadges yields={def.yields} radius={radius} baseHeight={baseHeight} />

      {/* Status Emblem Ring */}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, baseHeight + 0.75, 0]}>
        <ringGeometry args={[radius + 0.5, radius + 1.4, 32]} />
        <meshBasicMaterial
          color={selected ? '#ffe6a8' : speciesColor}
          transparent
          opacity={selected ? 0.95 : isHovered ? 0.8 : 0.5}
        />
      </mesh>

      {/* Conquered Glow Ring */}
      {owned && (
        <mesh ref={conqueredRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, baseHeight + 0.75, 0]}>
          <ringGeometry args={[radius + 2, radius + 2.8, 32]} />
          <meshBasicMaterial color="#22c55e" transparent opacity={0.2} />
        </mesh>
      )}

      {/* Sanctuary Starting Beacon Banner */}
      {def.starting && (
        <group position={[0, baseHeight + 1.2, 0]}>
          <mesh position={[0, 3.5, 0]}>
            <cylinderGeometry args={[0.4, 0.4, 7, 12]} />
            <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[0, 7.5, 0]}>
            <octahedronGeometry args={[1.4]} />
            <meshBasicMaterial color="#86efac" />
          </mesh>
        </group>
      )}

      {/* Spire Peak Crowns for Tier 4 */}
      {def.tier === 4 && (
        <group position={[0, baseHeight + 1.0, 0]}>
          <mesh position={[0, 4, 0]}>
            <coneGeometry args={[2.5, 8, 8]} />
            <meshStandardMaterial color="#2b141d" roughness={0.4} metalness={0.7} />
          </mesh>
        </group>
      )}

      {/* Unrest Bar — only shown on player-owned regions with unrest */}
      {owned && unrest > 0 && (
        <mesh position={[0, baseHeight + 1.0, radius + 2.2]}>
          <boxGeometry args={[(unrest / 100) * radius * 1.6, 0.4, 0.4]} />
          <meshBasicMaterial color={unrest > 65 ? '#ef4444' : '#f59e0b'} />
        </mesh>
      )}

      {/* Garrison Strength Indicator */}
      {!owned && totalGarrison > 0 && (
        <mesh position={[0, baseHeight + 3.5, 0]}>
          <boxGeometry args={[garrisonWidth, 0.2, 0.2]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
      )}

      {/* Labels */}
      <WorldLabel text={def.name} position={[0, baseHeight + 7.5, 0]} size={3.6} variant="map" />
      <WorldLabel
        text={owned ? 'HELD' : attackable ? 'REACHABLE' : `TIER ${def.tier}`}
        position={[0, baseHeight + 4.8, 0]}
        size={2.1}
        variant="default"
        color={owned ? '#86efac' : attackable ? '#fdba74' : '#cbd5e1'}
      />
    </group>
  )
}
