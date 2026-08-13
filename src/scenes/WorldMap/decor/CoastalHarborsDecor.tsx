'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, SpotLight } from 'three'

/**
 * Dedicated 3D environment details for Area 2: Sunkenreach & Saltcrag (Coastal Harbors).
 * Sunkenreach at [-35, 0, 52], Saltcrag at [-95, 0, -5].
 */
export function CoastalHarborsDecor() {
  const beaconLightRef = useRef<SpotLight>(null)
  const foamRef = useRef<Group>(null)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    // Revolving lighthouse beacon at Saltcrag
    if (beaconLightRef.current) {
      beaconLightRef.current.target.position.x = -95 + Math.cos(t * 1.5) * 30
      beaconLightRef.current.target.position.z = -5 + Math.sin(t * 1.5) * 30
      beaconLightRef.current.target.updateMatrixWorld()
    }
    // Tide foam bobbing
    if (foamRef.current) {
      foamRef.current.position.y = Math.sin(t * 1.2) * 0.15
    }
  })

  return (
    <group>
      {/* --- Sunkenreach Harbor Docks & Shipwreck [-35, 0, 52] --- */}
      <group position={[-35, 0, 52]}>
        {/* Wooden Main Pier */}
        <mesh position={[-6, 0.4, 2]} rotation={[0, 0.3, 0]} castShadow receiveShadow>
          <boxGeometry args={[10, 0.4, 2.2]} />
          <meshStandardMaterial color="#4a3728" roughness={0.8} />
        </mesh>
        {/* Dock Pilings */}
        {[-10, -6, -2].map((x, i) => (
          <mesh key={`piling-${i}`} position={[x, -0.2, 2]}>
            <cylinderGeometry args={[0.25, 0.3, 2, 8]} />
            <meshStandardMaterial color="#2d2219" roughness={0.9} />
          </mesh>
        ))}
        {/* Sunken Shipwreck Hull */}
        <group position={[-12, -0.2, 8]} rotation={[0.4, -0.5, 0.3]}>
          <mesh castShadow>
            <boxGeometry args={[8, 2.5, 3]} />
            <meshStandardMaterial color="#36251b" roughness={0.9} />
          </mesh>
          {/* Broken Mast */}
          <mesh position={[0, 3, 0]} rotation={[0, 0, 0.5]}>
            <cylinderGeometry args={[0.2, 0.3, 6, 8]} />
            <meshStandardMaterial color="#241812" />
          </mesh>
        </group>
      </group>

      {/* --- Saltcrag Lighthouse & Watchtower [-95, 0, -5] --- */}
      <group position={[-95, 0, -5]}>
        {/* Stone Foundation Mound */}
        <mesh position={[-4, 1.2, 0]} castShadow>
          <cylinderGeometry args={[4, 5, 2.4, 16]} />
          <meshStandardMaterial color="#4a5568" roughness={0.9} />
        </mesh>
        {/* Lighthouse Tower Structure */}
        <mesh position={[-4, 5.5, 0]} castShadow>
          <cylinderGeometry args={[1.8, 2.6, 7, 16]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.6} />
        </mesh>
        {/* Lantern Room Glass Housing */}
        <mesh position={[-4, 9.5, 0]}>
          <cylinderGeometry args={[1.5, 1.5, 1.6, 12]} />
          <meshStandardMaterial color="#38bdf8" transparent opacity={0.6} metalness={0.9} />
        </mesh>
        {/* Conical Roof */}
        <mesh position={[-4, 11, 0]} castShadow>
          <coneGeometry args={[2, 1.8, 12]} />
          <meshStandardMaterial color="#991b1b" roughness={0.4} />
        </mesh>

        {/* Dynamic Revolving Beacon Light */}
        <spotLight
          ref={beaconLightRef}
          position={[-4, 9.5, 0]}
          color="#fef08a"
          intensity={4}
          angle={0.4}
          penumbra={0.3}
          distance={80}
        />
      </group>

      {/* Coastal Tide Foam Rings */}
      <group ref={foamRef} position={[-65, 0, 25]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[12, 14, 32]} />
          <meshBasicMaterial color="#e0f2fe" transparent opacity={0.35} />
        </mesh>
      </group>
    </group>
  )
}
