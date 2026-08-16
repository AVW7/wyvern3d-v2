'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group, MeshBasicMaterial } from 'three'
import { Prop } from '@/render/assets/props'

interface InteractiveAnvilProps {
  position?: [number, number, number]
  rotationY?: number
  scale?: number
  isWorking?: boolean
}

/**
 * Interactive Forge Anvil & Grindstone.
 * Includes strike sparks, hot metal workpiece, and tool resonance feedback.
 */
export function InteractiveAnvil({
  position = [0, 0, 0],
  rotationY = 0,
  scale = 0.55,
  isWorking = false,
}: InteractiveAnvilProps) {
  const sparkGroupRef = useRef<Group>(null)
  const sparkMatRef = useRef<MeshBasicMaterial>(null)
  const clockRef = useRef(0)

  useFrame((_, delta) => {
    if (!sparkGroupRef.current || !sparkMatRef.current) return
    clockRef.current += delta
    const t = clockRef.current

    // Strike spark flare cycle
    const rate = isWorking ? 4 : 1.5
    const flare = Math.pow(Math.max(0, Math.sin(t * rate)), 8)
    sparkMatRef.current.opacity = flare * (isWorking ? 0.9 : 0.3)
    sparkGroupRef.current.scale.setScalar(0.5 + flare * 0.8)
  })

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {/* Base Anvil Prop */}
      <Prop id="prop.forge.anvil" position={[0, 0, 0]} />

      {/* Red-Hot Ingot on Anvil Surface */}
      <mesh position={[0, 0.72, 0.05]}>
        <boxGeometry args={[0.22, 0.06, 0.45]} />
        <meshStandardMaterial
          color="#ff4500"
          emissive="#ff2200"
          emissiveIntensity={1.8}
          roughness={0.4}
        />
      </mesh>

      {/* Dynamic Spark Cluster */}
      <group ref={sparkGroupRef} position={[0, 0.82, 0.05]}>
        <mesh>
          <sphereGeometry args={[0.08, 6, 6]} />
          <meshBasicMaterial
            ref={sparkMatRef}
            color="#ffe066"
            transparent
            opacity={0.2}
          />
        </mesh>
      </group>
    </group>
  )
}
