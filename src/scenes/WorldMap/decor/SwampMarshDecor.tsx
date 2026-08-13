'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, Mesh, MeshBasicMaterial } from 'three'

/**
 * Dedicated 3D environment details for Area 4: Ashfen & Mirelands (Swamp & Marshlands).
 * Ashfen at [0, 0, 30], Mirelands at [60, 0, -15].
 */
export function SwampMarshDecor() {
  const wispGroupRef = useRef<Group>(null)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    // Floating swamp wisps bobbing
    if (wispGroupRef.current) {
      wispGroupRef.current.children.forEach((wisp, i) => {
        wisp.position.y = 1.8 + Math.sin(t * 2.2 + i * 1.2) * 0.5
        const mat = (wisp as Mesh).material as MeshBasicMaterial
        if (mat) {
          mat.opacity = 0.4 + Math.sin(t * 3 + i) * 0.35
        }
      })
    }
  })

  // Lilypad positions in Ashfen bog pools
  const lilypads: [number, number, number][] = [
    [-6, 0.38, 28],
    [-4, 0.38, 32],
    [5, 0.38, 27],
    [7, 0.38, 31],
  ]

  // Wooden boardwalk plank offsets
  const boardwalkPlanks: [number, number, number][] = [
    [-3, 0.45, 24],
    [-2, 0.45, 26],
    [-1, 0.45, 28],
    [0, 0.45, 30],
    [1, 0.45, 32],
    [2, 0.45, 34],
  ]

  return (
    <group>
      {/* --- Ashfen Bog Ponds & Lilypads [0, 0, 30] --- */}
      <group position={[0, 0, 30]}>
        {/* Murky Water Pool */}
        <mesh position={[0, 0.35, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[9, 24]} />
          <meshStandardMaterial color="#1a382b" roughness={0.3} metalness={0.4} transparent opacity={0.85} />
        </mesh>
        {/* Floating Lilypads */}
        {lilypads.map(([lx, ly, lz], i) => (
          <mesh key={`pad-${i}`} position={[lx, ly, lz - 30]} rotation={[-Math.PI / 2, 0, i]}>
            <circleGeometry args={[0.9, 12]} />
            <meshStandardMaterial color="#15803d" roughness={0.8} />
          </mesh>
        ))}
        {/* Sunken Wooden Boardwalk */}
        {boardwalkPlanks.map(([bx, by, bz], i) => (
          <mesh key={`plank-${i}`} position={[bx, by, bz - 30]} rotation={[0, 0.4, 0]} castShadow>
            <boxGeometry args={[2.2, 0.15, 0.7]} />
            <meshStandardMaterial color="#3f2e21" roughness={0.9} />
          </mesh>
        ))}
      </group>

      {/* --- Mirelands Weeping Willow Trees [60, 0, -15] --- */}
      <group position={[60, 0, -15]}>
        {/* Willow Tree 1 */}
        <group position={[-5, 0.8, -4]}>
          <mesh position={[0, 2, 0]} castShadow>
            <cylinderGeometry args={[0.6, 1.0, 4, 8]} />
            <meshStandardMaterial color="#332419" roughness={0.9} />
          </mesh>
          {/* Weeping Canopy */}
          <mesh position={[0, 4.5, 0]} castShadow>
            <coneGeometry args={[3.2, 3.5, 10]} />
            <meshStandardMaterial color="#166534" roughness={0.8} />
          </mesh>
        </group>
        {/* Willow Tree 2 */}
        <group position={[6, 0.8, 5]}>
          <mesh position={[0, 2, 0]} castShadow>
            <cylinderGeometry args={[0.5, 0.9, 4, 8]} />
            <meshStandardMaterial color="#332419" roughness={0.9} />
          </mesh>
          <mesh position={[0, 4.2, 0]} castShadow>
            <coneGeometry args={[2.8, 3.2, 10]} />
            <meshStandardMaterial color="#14532d" roughness={0.8} />
          </mesh>
        </group>
      </group>

      {/* --- Floating Swamp Wisps --- */}
      <group ref={wispGroupRef}>
        {([
          [-4, 1.8, 28],
          [5, 1.8, 33],
          [56, 1.8, -12],
          [64, 1.8, -18],
        ] as [number, number, number][]).map(([wx, wy, wz], i) => (
          <mesh key={`wisp-${i}`} position={[wx, wy, wz]}>
            <sphereGeometry args={[0.35, 12, 12]} />
            <meshBasicMaterial color="#38bdf8" transparent opacity={0.7} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
