'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group, PointLight } from 'three'
import { Prop } from '@/render/assets/props'

interface InteractiveHatcheryNestProps {
  position?: [number, number, number]
  rotationY?: number
  scale?: number
  hasEggs?: boolean
}

/**
 * Interactive Hatchery Brood Cave Nest & Rune Plateaus.
 * Features ambient egg incubation thermal glow and pulsing rune lines.
 */
export function InteractiveHatcheryNest({
  position = [0, 0, 0],
  rotationY = Math.PI,
  scale = 0.75,
  hasEggs = true,
}: InteractiveHatcheryNestProps) {
  const lightRef = useRef<PointLight>(null)
  const eggGlowRef = useRef<Group>(null)
  const clockRef = useRef(0)

  useFrame((_, delta) => {
    clockRef.current += delta
    const t = clockRef.current

    // Thermal heartbeat pulse
    const pulse = 0.7 + Math.sin(t * 2.2) * 0.3
    if (lightRef.current) {
      lightRef.current.intensity = 1.2 * pulse
    }
    if (eggGlowRef.current) {
      eggGlowRef.current.scale.setScalar(1.0 + (pulse - 0.7) * 0.15)
    }
  })

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {/* Base Brood Cave Prop */}
      <Prop id="prop.hatchery.cave" position={[0, 0, 0]} />

      {/* Incubation Hearth Fire & Thermal Glow */}
      <pointLight
        ref={lightRef}
        position={[0, 1.2, -1.0]}
        color="#ff7733"
        distance={6}
        intensity={1.2}
      />

      {/* Egg Bedding Warmth Shimmer */}
      {hasEggs && (
        <group ref={eggGlowRef} position={[0, 0.4, -1.2]}>
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.35, 12, 10]} />
            <meshStandardMaterial
              color="#d4883b"
              emissive="#ff5511"
              emissiveIntensity={0.6}
              roughness={0.6}
            />
          </mesh>
          <mesh position={[-0.25, -0.05, 0.15]}>
            <sphereGeometry args={[0.28, 10, 8]} />
            <meshStandardMaterial
              color="#a8682a"
              emissive="#ff4400"
              emissiveIntensity={0.5}
              roughness={0.7}
            />
          </mesh>
        </group>
      )}
    </group>
  )
}
