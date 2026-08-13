'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { PointLight } from 'three'

/**
 * Dedicated 3D environment details for Area 6: Serpentfang Jungle & Stonewatch Highland.
 * Serpentfang [30, 0, -10], Stonewatch [95, 0, -5].
 */
export function JungleHighlandDecor() {
  const signalFireRef = useRef<PointLight>(null)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (signalFireRef.current) {
      signalFireRef.current.intensity = 1.6 + Math.sin(t * 7) * 0.4
    }
  })

  return (
    <group>
      {/* --- Serpentfang Ancient Temple Ruins [30, 0, -10] --- */}
      <group position={[30, 0, -10]}>
        {/* Step Pyramid Base */}
        <mesh position={[0, 0.6, -5]} castShadow receiveShadow>
          <boxGeometry args={[9, 1.2, 9]} />
          <meshStandardMaterial color="#2d4a36" roughness={0.9} />
        </mesh>
        <mesh position={[0, 1.5, -5]} castShadow receiveShadow>
          <boxGeometry args={[6.5, 0.8, 6.5]} />
          <meshStandardMaterial color="#274230" roughness={0.85} />
        </mesh>
        {/* Carved Serpent Shrine Pillars */}
        {[-2.5, 2.5].map((sx, i) => (
          <mesh key={`serpent-${i}`} position={[sx, 2.8, -5]} castShadow>
            <cylinderGeometry args={[0.5, 0.7, 2.6, 8]} />
            <meshStandardMaterial color="#1f3627" roughness={0.8} />
          </mesh>
        ))}
        {/* Tropical Palm Canopy Cluster */}
        {([[-6, 0.8, -2], [7, 0.8, -8], [-5, 0.8, -9]] as [number, number, number][]).map(([px, py, pz], i) => (
          <group key={`palm-${i}`} position={[px, py, pz]}>
            <mesh position={[0, 2, 0]} castShadow>
              <cylinderGeometry args={[0.3, 0.5, 4, 8]} />
              <meshStandardMaterial color="#4a3b25" roughness={0.9} />
            </mesh>
            <mesh position={[0, 4.2, 0]} castShadow>
              <sphereGeometry args={[2.2, 12, 12]} />
              <meshStandardMaterial color="#15803d" roughness={0.6} />
            </mesh>
          </group>
        ))}
      </group>

      {/* --- Stonewatch High Lookout Tower [95, 0, -5] --- */}
      <group position={[95, 0, -5]}>
        {/* Cliff Base Platform */}
        <mesh position={[4, 1.0, 0]} castShadow>
          <cylinderGeometry args={[5, 6, 2, 12]} />
          <meshStandardMaterial color="#57534e" roughness={0.9} />
        </mesh>
        {/* Stone Watchtower Shaft */}
        <mesh position={[4, 5.5, 0]} castShadow>
          <cylinderGeometry args={[2.2, 2.8, 7, 12]} />
          <meshStandardMaterial color="#78716c" roughness={0.7} />
        </mesh>
        {/* Top Guard Roof */}
        <mesh position={[4, 9.8, 0]} castShadow>
          <coneGeometry args={[3, 1.8, 12]} />
          <meshStandardMaterial color="#44403c" roughness={0.5} />
        </mesh>
        {/* Signal Fire Brazier */}
        <pointLight ref={signalFireRef} position={[4, 9.2, 0]} color="#f97316" distance={25} />
      </group>
    </group>
  )
}
