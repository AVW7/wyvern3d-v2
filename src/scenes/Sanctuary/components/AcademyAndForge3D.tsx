'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, PointLight } from 'three'
import { useGameState } from '@/state/store'

/**
 * 3D Realm Facilities in the Sanctuary:
 * 1. Philosophy Lyceum Courtyard [-35, 0, 10]
 * 2. Healing Apothecary & Herb Garden [-25, 0, 30]
 * 3. Master Blacksmith Armory Forge [30, 0, 5]
 * 4. Grand Master Elemental Bending Spire [0, 0, -35]
 */
export function AcademyAndForge3D() {
  const state = useGameState()
  const elementalRingRef = useRef<Group>(null)
  const cauldronLightRef = useRef<PointLight>(null)
  const blacksmithLightRef = useRef<PointLight>(null)

  useFrame((r3fState) => {
    const t = r3fState.clock.elapsedTime

    // Grand Master elemental ring rotation
    if (elementalRingRef.current) {
      elementalRingRef.current.rotation.y = t * 0.8
      elementalRingRef.current.position.y = 4.5 + Math.sin(t * 2) * 0.3
    }

    // Apothecary cauldron bubbling light
    if (cauldronLightRef.current) {
      cauldronLightRef.current.intensity = 1.8 + Math.sin(t * 6) * 0.5
    }

    // Blacksmith spark light
    if (blacksmithLightRef.current) {
      blacksmithLightRef.current.intensity = 2.2 + Math.sin(t * 10) * 0.6
    }
  })

  const academyLvl = state.buildings.academy ?? 0
  const apothecaryLvl = state.buildings.apothecary ?? 0
  const blacksmithLvl = state.buildings.blacksmith ?? 0

  return (
    <group>
      {/* --- 1. Philosophy Lyceum Courtyard [-35, 0, 10] --- */}
      {academyLvl > 0 && (
        <group position={[-35, 0, 10]}>
          {/* Stone Plinth Courtyard */}
          <mesh position={[0, 0.2, 0]} receiveShadow>
            <cylinderGeometry args={[6, 6, 0.4, 16]} />
            <meshStandardMaterial color="#475569" roughness={0.8} />
          </mesh>
          {/* Marble Columns */}
          {Array.from({ length: 6 }, (_, i) => {
            const angle = (i / 6) * Math.PI * 2
            return (
              <mesh key={`column-${i}`} position={[Math.cos(angle) * 4.8, 2.2, Math.sin(angle) * 4.8]} castShadow>
                <cylinderGeometry args={[0.3, 0.4, 4.0, 8]} />
                <meshStandardMaterial color="#cbd5e1" roughness={0.4} />
              </mesh>
            )
          })}
          {/* Lectern with Glowing Philosophy Scroll */}
          <mesh position={[0, 1.2, 0]} castShadow>
            <boxGeometry args={[1.2, 1.4, 0.8]} />
            <meshStandardMaterial color="#78350f" roughness={0.8} />
          </mesh>
          <mesh position={[0, 2.0, 0]}>
            <sphereGeometry args={[0.5, 12, 12]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
        </group>
      )}

      {/* --- 2. Healing Apothecary & Herb Garden [-25, 0, 30] --- */}
      {apothecaryLvl > 0 && (
        <group position={[-25, 0, 30]}>
          {/* Herb Garden Bed */}
          <mesh position={[0, 0.1, 0]} receiveShadow>
            <boxGeometry args={[8, 0.2, 6]} />
            <meshStandardMaterial color="#3f2e1e" roughness={0.9} />
          </mesh>
          {/* Herbal Plants */}
          {[-2.5, 0, 2.5].map((x, i) => (
            <mesh key={`herb-${i}`} position={[x, 0.5, 0]}>
              <sphereGeometry args={[0.6, 8, 8]} />
              <meshStandardMaterial color="#10b981" roughness={0.7} />
            </mesh>
          ))}
          {/* Boiling Cauldron */}
          <group position={[4, 0, 0]}>
            <mesh position={[0, 0.8, 0]} castShadow>
              <cylinderGeometry args={[1.0, 1.2, 1.2, 12]} />
              <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.4} />
            </mesh>
            {/* Cyan Potion Surface */}
            <mesh position={[0, 1.35, 0]}>
              <cylinderGeometry args={[0.9, 0.9, 0.05, 12]} />
              <meshStandardMaterial color="#06b6d4" roughness={0.2} />
            </mesh>
            <pointLight ref={cauldronLightRef} position={[0, 1.8, 0]} color="#22d3ee" distance={12} />
          </group>
        </group>
      )}

      {/* --- 3. Master Blacksmith Armory Forge [30, 0, 5] --- */}
      {blacksmithLvl > 0 && (
        <group position={[30, 0, 5]}>
          {/* Stone Forge Shed */}
          <mesh position={[0, 2.2, 0]} castShadow>
            <boxGeometry args={[6, 4.4, 5]} />
            <meshStandardMaterial color="#1e293b" roughness={0.9} />
          </mesh>
          {/* Glowing Forge Fireplace */}
          <mesh position={[0, 1.2, 2.55]}>
            <planeGeometry args={[2.2, 2.2]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
          <pointLight ref={blacksmithLightRef} position={[0, 1.8, 3.2]} color="#f97316" distance={18} />
          {/* Armor Plating Racks */}
          <mesh position={[4, 1.0, 1]} castShadow>
            <boxGeometry args={[1.5, 2.0, 0.4]} />
            <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.3} />
          </mesh>
        </group>
      )}

      {/* --- 4. Grand Master Elemental Bending Spire [0, 0, -35] --- */}
      <group position={[0, 0, -35]}>
        {/* Ancient Stone Spire Base */}
        <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[4, 5.5, 3.0, 16]} />
          <meshStandardMaterial color="#334155" roughness={0.8} />
        </mesh>
        {/* Floating Apex Crystal & Rotating Elemental Rings */}
        <group ref={elementalRingRef} position={[0, 4.5, 0]}>
          {/* Central Apex Crystal */}
          <mesh position={[0, 0, 0]} castShadow>
            <octahedronGeometry args={[1.4]} />
            <meshStandardMaterial color="#f59e0b" roughness={0.2} metalness={0.9} emissive="#f59e0b" emissiveIntensity={0.6} />
          </mesh>
          {/* 4 Elemental Shrines Orbiting */}
          {[
            { element: 'fire', color: '#ef4444', pos: [2.8, 0, 0] },
            { element: 'water', color: '#38bdf8', pos: [-2.8, 0, 0] },
            { element: 'earth', color: '#10b981', pos: [0, 0, 2.8] },
            { element: 'air', color: '#fef08a', pos: [0, 0, -2.8] },
          ].map((node, i) => (
            <mesh key={`el-${i}`} position={node.pos as [number, number, number]}>
              <sphereGeometry args={[0.5, 12, 12]} />
              <meshBasicMaterial color={node.color} />
            </mesh>
          ))}
        </group>
        {/* Grand Master NPC Avatar Stand */}
        <group position={[0, 3.1, 2.8]}>
          <mesh position={[0, 0.7, 0]} castShadow>
            <cylinderGeometry args={[0.4, 0.4, 1.4, 8]} />
            <meshStandardMaterial color="#0f172a" roughness={0.6} />
          </mesh>
          <mesh position={[0, 1.6, 0]} castShadow>
            <sphereGeometry args={[0.3, 8, 8]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.5} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
