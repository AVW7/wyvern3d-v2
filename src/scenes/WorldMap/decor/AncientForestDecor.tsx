'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, Mesh, MeshBasicMaterial } from 'three'

/**
 * Dedicated 3D environment details for Area 3: Whispering Woods & Thornmarch (Ancient Forests).
 * Whispering Woods at [35, 0, 52], Thornmarch at [60, 0, 30].
 */
export function AncientForestDecor() {
  const sporeGroupRef = useRef<Group>(null)
  const runeGroupRef = useRef<Group>(null)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    // Floating pollen spores
    if (sporeGroupRef.current) {
      sporeGroupRef.current.children.forEach((spore, i) => {
        spore.position.y = 3 + Math.sin(t * 1.8 + i) * 1.2
        spore.position.x += Math.cos(t * 1.2 + i) * 0.015
      })
    }
    // Pulsing elven runestones
    if (runeGroupRef.current) {
      runeGroupRef.current.children.forEach((rune, i) => {
        const mat = (rune as Mesh).material as MeshBasicMaterial
        if (mat) {
          mat.opacity = 0.5 + Math.sin(t * 2 + i * 1.5) * 0.4
        }
      })
    }
  })

  // Runestone positions near Whispering Woods & Thornmarch
  const runestonePositions: [number, number, number][] = [
    [32, 1.5, 48],
    [38, 1.5, 54],
    [58, 1.5, 26],
    [64, 1.5, 34],
  ]

  return (
    <group>
      {/* --- Great Elder Tree Canopy (Between Whispering Woods & Thornmarch) [48, 0, 41] --- */}
      <group position={[48, 0, 41]}>
        {/* Massive Trunk Base */}
        <mesh position={[0, 3, 0]} castShadow>
          <cylinderGeometry args={[1.6, 2.8, 6, 12]} />
          <meshStandardMaterial color="#3b2619" roughness={0.9} />
        </mesh>
        {/* Spreading Root Buttresses */}
        {[0, 1.5, 3.1, 4.7].map((rot, i) => (
          <mesh key={`root-${i}`} position={[Math.cos(rot) * 2, 0.4, Math.sin(rot) * 2]} rotation={[0, rot, 0.4]}>
            <boxGeometry args={[2.5, 0.8, 0.8]} />
            <meshStandardMaterial color="#2d1c12" roughness={0.95} />
          </mesh>
        ))}
        {/* Triple Tier Emerald Canopy */}
        <mesh position={[0, 7.5, 0]} castShadow>
          <dodecahedronGeometry args={[4.2]} />
          <meshStandardMaterial color="#166534" roughness={0.7} />
        </mesh>
        <mesh position={[-1.5, 9.5, 1.2]} castShadow>
          <dodecahedronGeometry args={[3.0]} />
          <meshStandardMaterial color="#15803d" roughness={0.65} />
        </mesh>
        <mesh position={[1.8, 9.0, -1.5]} castShadow>
          <dodecahedronGeometry args={[3.2]} />
          <meshStandardMaterial color="#14532d" roughness={0.75} />
        </mesh>
      </group>

      {/* --- Carved Elven Runestones --- */}
      <group ref={runeGroupRef}>
        {runestonePositions.map(([rx, ry, rz], i) => (
          <group key={`runestone-${i}`} position={[rx, ry, rz]}>
            {/* Granite Monolith Pillar */}
            <mesh castShadow>
              <boxGeometry args={[0.9, 3.2, 0.9]} />
              <meshStandardMaterial color="#475569" roughness={0.8} />
            </mesh>
            {/* Inlaid Glowing Rune Crystal */}
            <mesh position={[0, 0.4, 0.48]}>
              <planeGeometry args={[0.5, 1.2]} />
              <meshBasicMaterial color="#86efac" transparent opacity={0.8} />
            </mesh>
          </group>
        ))}
      </group>

      {/* --- Floating Forest Spore Field --- */}
      <group ref={sporeGroupRef} position={[45, 0, 42]}>
        {Array.from({ length: 14 }).map((_, i) => (
          <mesh key={`spore-${i}`} position={[(i % 4 - 1.5) * 6, 3 + (i % 3), ((i % 3) - 1) * 6]}>
            <sphereGeometry args={[0.25, 8, 8]} />
            <meshBasicMaterial color="#bbf7d0" transparent opacity={0.6} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
