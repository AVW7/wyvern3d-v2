'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, PointLight } from 'three'

/**
 * Dedicated 3D environment details for Area 1: Hearthvale (Home Sanctuary Valley).
 * Located at X: 0, Z: 75.
 */
export function HearthvaleDecor() {
  const brazierLight = useRef<PointLight>(null)
  const flagGroupRef = useRef<Group>(null)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    // Warm fire pit light flicker
    if (brazierLight.current) {
      brazierLight.current.intensity = 1.8 + Math.sin(t * 8) * 0.35 + Math.cos(t * 13) * 0.15
    }
    // Subtle flag sway
    if (flagGroupRef.current) {
      flagGroupRef.current.children.forEach((flag, i) => {
        flag.rotation.z = Math.sin(t * 2.5 + i) * 0.08
      })
    }
  })

  // Orchard tree positions around Hearthvale (x:0, z:75)
  const trees: [number, number, number][] = [
    [-9, 0.8, 70],
    [10, 0.8, 68],
    [-11, 0.8, 80],
    [12, 0.8, 78],
    [-5, 0.8, 86],
    [6, 0.8, 87],
  ]

  // Banner flag post positions
  const bannerPosts: [number, number, number][] = [
    [-7, 1.2, 72],
    [7, 1.2, 72],
    [-7, 1.2, 82],
    [7, 1.2, 82],
  ]

  return (
    <group position={[0, 0, 75]}>
      {/* Central Sanctuary Plaza Stone Base Ring */}
      <mesh position={[0, 0.45, 0]} receiveShadow>
        <cylinderGeometry args={[11, 12, 0.3, 32]} />
        <meshStandardMaterial color="#3d493a" roughness={0.8} />
      </mesh>

      {/* Inner Sanctuary Cobblestone Circle */}
      <mesh position={[0, 0.62, 0]}>
        <cylinderGeometry args={[8.5, 8.5, 0.1, 32]} />
        <meshStandardMaterial color="#4f5b4c" roughness={0.7} />
      </mesh>

      {/* Ancient Valley Gate Arch (South side facing entrance) */}
      <group position={[0, 0.8, 14]}>
        {/* Left Stone Pillar */}
        <mesh position={[-3.5, 2.5, 0]} castShadow>
          <boxGeometry args={[1.2, 5, 1.2]} />
          <meshStandardMaterial color="#5a6556" roughness={0.85} />
        </mesh>
        {/* Right Stone Pillar */}
        <mesh position={[3.5, 2.5, 0]} castShadow>
          <boxGeometry args={[1.2, 5, 1.2]} />
          <meshStandardMaterial color="#5a6556" roughness={0.85} />
        </mesh>
        {/* Wooden Arch Lintel */}
        <mesh position={[0, 5.2, 0]} castShadow>
          <boxGeometry args={[8.4, 0.8, 1.0]} />
          <meshStandardMaterial color="#5c4028" roughness={0.7} />
        </mesh>
      </group>

      {/* Sanctuary Fire Pit / Hatchery Brazier */}
      <group position={[0, 0.8, -4]}>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[1.2, 1.5, 1.0, 12]} />
          <meshStandardMaterial color="#2a2d28" roughness={0.9} />
        </mesh>
        {/* Emissive Fire Core */}
        <mesh position={[0, 1.1, 0]}>
          <sphereGeometry args={[0.7, 12, 12]} />
          <meshBasicMaterial color="#f97316" />
        </mesh>
        <pointLight ref={brazierLight} position={[0, 1.8, 0]} color="#ff8800" distance={25} />
      </group>

      {/* Tranquil Reflection Pool / Stream */}
      <mesh position={[-12, 0.35, 2]} rotation={[-Math.PI / 2, 0, 0.2]}>
        <planeGeometry args={[6, 18]} />
        <meshStandardMaterial color="#1e40af" roughness={0.1} metalness={0.8} transparent opacity={0.8} />
      </mesh>

      {/* Valley Orchards (Foliage & Fruit Blossoms) */}
      {trees.map(([tx, ty, tz], i) => (
        <group key={`tree-${i}`} position={[tx, ty, tz - 75]}>
          {/* Trunk */}
          <mesh position={[0, 1.2, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.5, 2.4, 8]} />
            <meshStandardMaterial color="#4a3525" roughness={0.9} />
          </mesh>
          {/* Canopy */}
          <mesh position={[0, 3.2, 0]} castShadow>
            <dodecahedronGeometry args={[1.8]} />
            <meshStandardMaterial color="#15803d" roughness={0.7} />
          </mesh>
          {/* Fruit Blossoms */}
          <mesh position={[0.8, 3.5, 0.8]}>
            <sphereGeometry args={[0.3, 8, 8]} />
            <meshStandardMaterial color="#ef4444" roughness={0.4} />
          </mesh>
          <mesh position={[-0.8, 2.8, -0.6]}>
            <sphereGeometry args={[0.3, 8, 8]} />
            <meshStandardMaterial color="#f97316" roughness={0.4} />
          </mesh>
        </group>
      ))}

      {/* Perimeter Waypost Flags */}
      <group ref={flagGroupRef}>
        {bannerPosts.map(([bx, by, bz], i) => (
          <group key={`flag-${i}`} position={[bx, by, bz - 75]}>
            {/* Pole */}
            <mesh position={[0, 2.5, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 5, 8]} />
              <meshStandardMaterial color="#78350f" />
            </mesh>
            {/* Pennant Flag */}
            <mesh position={[0.6, 4.3, 0]} rotation={[0, 0, -0.2]}>
              <planeGeometry args={[1.2, 0.8]} />
              <meshStandardMaterial color="#22c55e" roughness={0.5} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}
