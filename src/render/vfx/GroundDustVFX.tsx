'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, Mesh, MeshStandardMaterial } from 'three'

interface GroundDustVFXProps {
  active: boolean
  position: [number, number, number]
}

/**
 * Radial expanding ground-dust ring at y=0 during takeoff/landing or low hover.
 */
export function GroundDustVFX({ active, position }: GroundDustVFXProps) {
  const groupRef = useRef<Group>(null)
  const ringRef = useRef<Mesh>(null)
  const materialRef = useRef<MeshStandardMaterial>(null)
  const progress = useRef(0)

  useFrame((_, dt) => {
    if (!groupRef.current || !ringRef.current || !materialRef.current) return

    if (active) {
      progress.current = (progress.current + dt * 1.5) % 1.0
      const p = progress.current
      const scale = 1 + p * 8
      const opacity = Math.sin(p * Math.PI) * 0.45

      ringRef.current.scale.set(scale, 1, scale)
      materialRef.current.opacity = opacity
      groupRef.current.position.set(position[0], 0.05, position[2])
      groupRef.current.visible = true
    } else {
      groupRef.current.visible = false
      progress.current = 0
    }
  })

  return (
    <group ref={groupRef} visible={false}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.5, 2.5, 32]} />
        <meshStandardMaterial
          ref={materialRef}
          color="#9e917d"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
