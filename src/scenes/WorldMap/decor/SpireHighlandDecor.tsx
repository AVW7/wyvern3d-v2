'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, PointLight } from 'three'

/**
 * Dedicated 3D environment details for Area 7: Tier 3 & 4 Spire Peaks & Northern Reaches.
 * Duskspire [0, 0, -125], Shadow Citadel [0, 0, -95], Frostgate [-45, 0, -75].
 */
export function SpireHighlandDecor() {
  const vortexGroupRef = useRef<Group>(null)
  const duskCrystalLightRef = useRef<PointLight>(null)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    // Revolving void energy rings above Duskspire
    if (vortexGroupRef.current) {
      vortexGroupRef.current.rotation.y = t * 0.8
      vortexGroupRef.current.rotation.x = Math.sin(t * 0.5) * 0.15
    }
    // Duskspire apex crystal light pulse
    if (duskCrystalLightRef.current) {
      duskCrystalLightRef.current.intensity = 2.5 + Math.sin(t * 5) * 0.6
    }
  })

  return (
    <group>
      {/* --- Duskspire Void Monolith & Energy Apex [0, 0, -125] --- */}
      <group position={[0, 0, -125]}>
        {/* Monolith Tower Base */}
        <mesh position={[0, 6, 0]} castShadow>
          <boxGeometry args={[4.5, 16, 4.5]} />
          <meshStandardMaterial color="#1a1025" roughness={0.3} metalness={0.9} />
        </mesh>

        {/* Orbiting Void Energy Rings */}
        <group ref={vortexGroupRef} position={[0, 16, 0]}>
          <mesh rotation={[Math.PI / 3, 0, 0]}>
            <torusGeometry args={[5, 0.25, 8, 32]} />
            <meshBasicMaterial color="#a855f7" transparent opacity={0.7} />
          </mesh>
          <mesh rotation={[-Math.PI / 4, 0, Math.PI / 4]}>
            <torusGeometry args={[6.5, 0.2, 8, 32]} />
            <meshBasicMaterial color="#c084fc" transparent opacity={0.5} />
          </mesh>
        </group>

        {/* Floating Apex Crystal Core */}
        <mesh position={[0, 17, 0]}>
          <octahedronGeometry args={[2.2]} />
          <meshStandardMaterial color="#e879f9" emissive="#c084fc" emissiveIntensity={0.8} roughness={0.1} />
        </mesh>
        <pointLight ref={duskCrystalLightRef} position={[0, 17, 0]} color="#d8b4fe" distance={40} />
      </group>

      {/* --- Shadow Citadel Gothic Keep [0, 0, -95] --- */}
      <group position={[0, 0, -95]}>
        {/* Central Fortress Tower */}
        <mesh position={[0, 4.5, 0]} castShadow>
          <boxGeometry args={[8, 10, 8]} />
          <meshStandardMaterial color="#0f172a" roughness={0.6} metalness={0.7} />
        </mesh>
        {/* Corner Turret Spires */}
        {([[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5]] as [number, number][]).map(([tx, tz], i) => (
          <mesh key={`turret-${i}`} position={[tx, 6, tz]} castShadow>
            <coneGeometry args={[1.6, 6, 8]} />
            <meshStandardMaterial color="#1e1b4b" roughness={0.5} metalness={0.8} />
          </mesh>
        ))}
      </group>

      {/* --- Frostgate Glacier Arch [-45, 0, -75] --- */}
      <group position={[-45, 0, -75]}>
        <mesh position={[0, 3.5, 0]} rotation={[0, 0.4, 0]} castShadow>
          <torusGeometry args={[4.5, 1.2, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#bae6fd" roughness={0.2} metalness={0.6} />
        </mesh>
      </group>
    </group>
  )
}
