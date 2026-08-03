'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group, Mesh } from 'three'

interface Props {
  color?: string
  scale?: number
  /** Wing beat speed. 0 freezes the wings (perched). */
  flapSpeed?: number
  /** Phase offset so a flight of wyverns doesn't beat in lockstep. */
  phase?: number
}

/**
 * Stand-in wyvern: capsule body, cone snout, two flapping wings.
 *
 * The wing animation mutates rotation inside useFrame rather than driving React
 * state — the R3F cardinal rule. Every placeholder in this folder follows it.
 */
export function PlaceholderWyvern({ color = '#d4562a', scale = 1, flapSpeed = 6, phase = 0 }: Props) {
  const leftWing = useRef<Mesh>(null)
  const rightWing = useRef<Mesh>(null)
  const body = useRef<Group>(null)

  useFrame((state) => {
    if (flapSpeed <= 0) return
    const t = state.clock.elapsedTime * flapSpeed + phase
    const beat = Math.sin(t)
    if (leftWing.current) leftWing.current.rotation.z = 0.35 + beat * 0.5
    if (rightWing.current) rightWing.current.rotation.z = -0.35 - beat * 0.5
    // A slight bob sells the flapping far better than wing motion alone.
    if (body.current) body.current.position.y = Math.sin(t) * 0.12
  })

  return (
    <group ref={body} scale={scale}>
      {/* body */}
      <mesh castShadow>
        <capsuleGeometry args={[0.45, 1.5, 4, 12]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>

      {/* neck + head */}
      <mesh position={[0, 0.35, 0.95]} rotation={[Math.PI / 2.6, 0, 0]} castShadow>
        <capsuleGeometry args={[0.22, 0.7, 4, 8]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.5, 1.5]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.22, 0.6, 8]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>

      {/* tail */}
      <mesh position={[0, -0.1, -1.3]} rotation={[-Math.PI / 2.2, 0, 0]}>
        <coneGeometry args={[0.18, 1.4, 6]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>

      {/* wings — pivot at the shoulder so rotation.z reads as a flap */}
      <group position={[0.35, 0.2, 0]}>
        <mesh ref={leftWing} position={[0.9, 0, 0]} castShadow>
          <boxGeometry args={[1.9, 0.06, 1.1]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
      </group>
      <group position={[-0.35, 0.2, 0]}>
        <mesh ref={rightWing} position={[-0.9, 0, 0]} castShadow>
          <boxGeometry args={[1.9, 0.06, 1.1]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
      </group>

      {/* hind legs */}
      <mesh position={[0.3, -0.5, -0.4]}>
        <capsuleGeometry args={[0.12, 0.4, 4, 6]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      <mesh position={[-0.3, -0.5, -0.4]}>
        <capsuleGeometry args={[0.12, 0.4, 4, 6]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
    </group>
  )
}
