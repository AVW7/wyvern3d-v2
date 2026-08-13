'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, Mesh } from 'three'
import { SPECIES } from '@/core/data/species'

interface PatrolWyvernData {
  id: string
  center: [number, number, number]
  radius: number
  speed: number
}

const PATROLS: PatrolWyvernData[] = [
  { id: 'emberback', center: [0, 16, 50], radius: 18, speed: 0.35 },
  { id: 'cragwing', center: [-70, 18, -10], radius: 16, speed: 0.3 },
  { id: 'mirefang', center: [45, 16, -12], radius: 15, speed: 0.4 },
  { id: 'frostmaw', center: [-10, 22, -65], radius: 20, speed: 0.25 },
  { id: 'duskwyrm', center: [0, 26, -110], radius: 22, speed: 0.2 },
]

/** Single animated 3D flying wyvern silhouette with flapping wings */
function FlyingWyvern({ id, center, radius, speed, index }: PatrolWyvernData & { index: number }) {
  const groupRef = useRef<Group>(null)
  const leftWingRef = useRef<Mesh>(null)
  const rightWingRef = useRef<Mesh>(null)
  const color = SPECIES[id]?.color ?? '#d4562a'

  useFrame((state) => {
    const t = state.clock.elapsedTime * speed + index * 1.5
    const flap = Math.sin(state.clock.elapsedTime * 10 + index) * 0.4

    if (groupRef.current) {
      const x = center[0] + Math.cos(t) * radius
      const z = center[2] + Math.sin(t) * radius
      const y = center[1] + Math.sin(t * 2) * 1.5

      groupRef.current.position.set(x, y, z)
      // Heading tangent direction
      groupRef.current.rotation.y = -t + Math.PI / 2
      groupRef.current.rotation.z = Math.sin(t * 2) * 0.1
    }

    if (leftWingRef.current) leftWingRef.current.rotation.z = flap
    if (rightWingRef.current) rightWingRef.current.rotation.z = -flap
  })

  return (
    <group ref={groupRef}>
      {/* Torso */}
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[0.8, 0.6, 2.2]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 0.2, 1.4]} castShadow>
        <octahedronGeometry args={[0.5]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>

      {/* Tail */}
      <mesh position={[0, 0.1, -1.6]} rotation={[-0.2, 0, 0]} castShadow>
        <coneGeometry args={[0.3, 2, 6]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>

      {/* Left Wing */}
      <mesh ref={leftWingRef} position={[-0.4, 0.2, 0]} rotation={[0, 0.3, 0]}>
        <boxGeometry args={[3.2, 0.1, 1.2]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>

      {/* Right Wing */}
      <mesh ref={rightWingRef} position={[0.4, 0.2, 0]} rotation={[0, -0.3, 0]}>
        <boxGeometry args={[3.2, 0.1, 1.2]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
    </group>
  )
}

/** Animated flying wyverns patrolling across world map territories */
export function PatrolWyverns() {
  return (
    <group>
      {PATROLS.map((p, i) => (
        <FlyingWyvern key={`wyvern-${p.id}-${i}`} {...p} index={i} />
      ))}
    </group>
  )
}
