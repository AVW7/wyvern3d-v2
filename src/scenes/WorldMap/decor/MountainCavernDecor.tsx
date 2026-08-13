'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { PointLight } from 'three'

/**
 * Dedicated 3D environment details for Area 5: Cinderpeaks, Ironhold & Crystal Grotto.
 * Cinderpeaks [-60, 0, -15], Ironhold [-30, 0, -10], Crystal Grotto [0, 0, -10].
 */
export function MountainCavernDecor() {
  const lavaLightRef = useRef<PointLight>(null)
  const crystalLightRef = useRef<PointLight>(null)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    // Cinderpeaks magma vent pulse
    if (lavaLightRef.current) {
      lavaLightRef.current.intensity = 2.2 + Math.sin(t * 6) * 0.5 + Math.cos(t * 9) * 0.25
    }
    // Crystal Grotto purple glow pulse
    if (crystalLightRef.current) {
      crystalLightRef.current.intensity = 1.5 + Math.sin(t * 3) * 0.4
    }
  })

  return (
    <group>
      {/* --- Cinderpeaks Volcanic Magma Pit [-60, 0, -15] --- */}
      <group position={[-60, 0, -15]}>
        {/* Lava Crater Pool */}
        <mesh position={[0, 0.45, -5]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[5.5, 16]} />
          <meshBasicMaterial color="#ea580c" />
        </mesh>
        {/* Inner Liquid Lava Core */}
        <mesh position={[0, 0.48, -5]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[3.8, 16]} />
          <meshBasicMaterial color="#fef08a" />
        </mesh>
        <pointLight ref={lavaLightRef} position={[0, 2, -5]} color="#f97316" distance={30} />
      </group>

      {/* --- Ironhold Fortress Battlements [-30, 0, -10] --- */}
      <group position={[-30, 0, -10]}>
        {/* Main Iron Gate Rampart */}
        <mesh position={[0, 1.2, 7]} castShadow>
          <boxGeometry args={[12, 2.4, 2]} />
          <meshStandardMaterial color="#334155" roughness={0.7} metalness={0.6} />
        </mesh>
        {/* Twin Gate Towers */}
        <mesh position={[-5.5, 2.8, 7]} castShadow>
          <boxGeometry args={[2.5, 5.6, 2.5]} />
          <meshStandardMaterial color="#1e293b" roughness={0.6} metalness={0.7} />
        </mesh>
        <mesh position={[5.5, 2.8, 7]} castShadow>
          <boxGeometry args={[2.5, 5.6, 2.5]} />
          <meshStandardMaterial color="#1e293b" roughness={0.6} metalness={0.7} />
        </mesh>
        {/* Iron Portcullis Grill */}
        <mesh position={[0, 1.2, 7.8]}>
          <planeGeometry args={[4, 2.4]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.3} />
        </mesh>
      </group>

      {/* --- Crystal Grotto Amethyst Formations [0, 0, -10] --- */}
      <group position={[0, 0, -10]}>
        {/* Cavern Portal Archway */}
        <mesh position={[0, 2.5, -4]} castShadow>
          <torusGeometry args={[3.8, 0.9, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#475569" roughness={0.9} />
        </mesh>
        {/* Giant Amethyst Crystal Cluster */}
        {[-2, 0, 2.2].map((cx, i) => (
          <mesh key={`crys-${i}`} position={[cx, 1.6, -4]} rotation={[0.2, i * 0.8, (i % 2) * 0.3]}>
            <octahedronGeometry args={[1.2]} />
            <meshStandardMaterial color="#a855f7" emissive="#7c3aed" emissiveIntensity={0.6} roughness={0.2} metalness={0.8} />
          </mesh>
        ))}
        <pointLight ref={crystalLightRef} position={[0, 3, -4]} color="#c084fc" distance={25} />
      </group>
    </group>
  )
}
