'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh, MeshStandardMaterial } from 'three'
import { Prop } from '@/render/assets/props'

interface InteractiveTroughProps {
  position?: [number, number, number]
  rotationY?: number
  scale?: number
  hasWater?: boolean
  isQuenching?: boolean
}

/**
 * Interactive Feeding & Quenching Trough.
 * Combines the static trough wooden/stone basin with an animated liquid surface
 * and subtle steam/bubble accents.
 */
export function InteractiveTrough({
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
  hasWater = true,
  isQuenching = false,
}: InteractiveTroughProps) {
  const waterMeshRef = useRef<Mesh>(null)
  const clockRef = useRef(0)

  useFrame((_, delta) => {
    if (!waterMeshRef.current || !hasWater) return
    clockRef.current += delta
    const t = clockRef.current

    // Gentle liquid ripple oscillation
    const liquidY = 0.42 + Math.sin(t * 1.8) * 0.008
    waterMeshRef.current.position.y = liquidY

    const mat = waterMeshRef.current.material as MeshStandardMaterial
    if (mat) {
      // Dynamic water shimmer
      mat.roughness = 0.15 + Math.sin(t * 2.5) * 0.05
    }
  })

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {/* Base Trough Prop */}
      <Prop id="prop.forge.trough" position={[0, 0, 0]} />

      {/* Animated Water / Quenching Liquid Surface */}
      {hasWater && (
        <mesh
          ref={waterMeshRef}
          position={[0, 0.42, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[1.35, 0.65]} />
          <meshStandardMaterial
            color={isQuenching ? '#2a4d5a' : '#336677'}
            roughness={0.2}
            metalness={0.1}
            transparent
            opacity={0.88}
          />
        </mesh>
      )}

      {/* Steam / Heat Haze Accent for Forge Quenching */}
      {isQuenching && (
        <mesh position={[0, 0.55, 0]}>
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshBasicMaterial color="#d0e0e8" transparent opacity={0.18} />
        </mesh>
      )}
    </group>
  )
}
