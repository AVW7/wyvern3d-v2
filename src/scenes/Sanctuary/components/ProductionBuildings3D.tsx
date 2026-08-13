'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, PointLight } from 'three'
import { useGameState } from '@/state/store'

/**
 * 3D Production & Infrastructure Facilities in the Sanctuary scene:
 * - Farm Crop Plots & Windmill
 * - Water Well & Aqueduct Trough
 * - Wildlife Grazing Pens (Deer, Boar, Goats)
 * - Iron Foundry & Smelter Furnace (with flame glow)
 * - Sawmill & Log Stacks
 * - Villager Cottages
 */
export function ProductionBuildings3D() {
  const state = useGameState()
  const windmillRef = useRef<Group>(null)
  const furnaceLightRef = useRef<PointLight>(null)
  const deerGroupRef = useRef<Group>(null)

  useFrame((r3fState) => {
    const t = r3fState.clock.elapsedTime

    // Windmill blades rotation
    if (windmillRef.current) {
      windmillRef.current.rotation.z = t * 1.2
    }

    // Furnace glow flicker
    if (furnaceLightRef.current) {
      furnaceLightRef.current.intensity = 2.0 + Math.sin(t * 8) * 0.4
    }

    // Grazing livestock idle head-bobbing
    if (deerGroupRef.current) {
      deerGroupRef.current.children.forEach((deer, i) => {
        deer.rotation.x = Math.sin(t * 1.5 + i) * 0.08
      })
    }
  })

  const farmLvl = state.buildings.farm ?? 0
  const aqueductLvl = state.buildings.aqueduct ?? 0
  const pastureLvl = state.buildings.pasture ?? 0
  const foundryLvl = state.buildings.foundry ?? 0
  const sawmillLvl = state.buildings.sawmill ?? 0
  const housingLvl = state.buildings.housing ?? 0

  return (
    <group>
      {/* --- 1. Farm Plot & Windmill [-25, 0, -15] --- */}
      {farmLvl > 0 && (
        <group position={[-25, 0, -15]}>
          {/* Soil Field Bed */}
          <mesh position={[0, 0.1, 0]} receiveShadow>
            <boxGeometry args={[12, 0.2, 10]} />
            <meshStandardMaterial color="#3f2e1e" roughness={0.9} />
          </mesh>
          {/* Crop Rows */}
          {[-3, -1, 1, 3].map((z, i) => (
            <mesh key={`crop-${i}`} position={[0, 0.4, z]}>
              <boxGeometry args={[10, 0.4, 0.8]} />
              <meshStandardMaterial color="#65a30d" roughness={0.8} />
            </mesh>
          ))}
          {/* Windmill Tower */}
          <group position={[-5, 0, 0]}>
            <mesh position={[0, 3, 0]} castShadow>
              <cylinderGeometry args={[0.8, 1.4, 6, 8]} />
              <meshStandardMaterial color="#78350f" roughness={0.8} />
            </mesh>
            {/* Blades */}
            <group ref={windmillRef} position={[0, 5.5, 0.9]}>
              {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((rot, i) => (
                <mesh key={`blade-${i}`} rotation={[0, 0, rot]}>
                  <boxGeometry args={[0.3, 3.2, 0.05]} />
                  <meshStandardMaterial color="#fef08a" />
                </mesh>
              ))}
            </group>
          </group>
        </group>
      )}

      {/* --- 2. Water Well & Aqueduct Trough [-15, 0, 20] --- */}
      {aqueductLvl > 0 && (
        <group position={[-15, 0, 20]}>
          {/* Stone Well Basin */}
          <mesh position={[0, 0.6, 0]} castShadow>
            <cylinderGeometry args={[1.5, 1.8, 1.2, 16]} />
            <meshStandardMaterial color="#475569" roughness={0.8} />
          </mesh>
          {/* Water Surface */}
          <mesh position={[0, 0.9, 0]}>
            <cylinderGeometry args={[1.3, 1.3, 0.1, 16]} />
            <meshStandardMaterial color="#0284c7" roughness={0.1} metalness={0.8} />
          </mesh>
          {/* Roof Posts & Canopy */}
          <mesh position={[0, 2.5, 0]} castShadow>
            <coneGeometry args={[2.0, 1.2, 4]} />
            <meshStandardMaterial color="#78350f" roughness={0.7} />
          </mesh>
        </group>
      )}

      {/* --- 3. Wildlife Grazing Pasture Pen [25, 0, -15] --- */}
      {pastureLvl > 0 && (
        <group position={[25, 0, -15]}>
          {/* Fence Perimeter */}
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[12, 1.0, 10]} />
            <meshStandardMaterial color="#78350f" wireframe />
          </mesh>
          {/* Grazing Animals */}
          <group ref={deerGroupRef}>
            {([[-2, 0.6, -1], [2, 0.6, 2], [0, 0.6, -3]] as [number, number, number][]).map((pos, i) => (
              <group key={`livestock-${i}`} position={pos}>
                {/* Animal Body */}
                <mesh position={[0, 0.5, 0]} castShadow>
                  <boxGeometry args={[0.8, 0.8, 1.4]} />
                  <meshStandardMaterial color="#92400e" roughness={0.8} />
                </mesh>
                {/* Animal Head */}
                <mesh position={[0, 1.0, 0.8]} castShadow>
                  <boxGeometry args={[0.5, 0.5, 0.6]} />
                  <meshStandardMaterial color="#78350f" roughness={0.8} />
                </mesh>
              </group>
            ))}
          </group>
        </group>
      )}

      {/* --- 4. Iron Foundry & Smelter Furnace [20, 0, 15] --- */}
      {foundryLvl > 0 && (
        <group position={[20, 0, 15]}>
          {/* Smelter Brick Structure */}
          <mesh position={[0, 2.0, 0]} castShadow>
            <boxGeometry args={[4, 4, 4]} />
            <meshStandardMaterial color="#334155" roughness={0.9} />
          </mesh>
          {/* Glowing Coal Opening */}
          <mesh position={[0, 1.0, 2.05]}>
            <planeGeometry args={[1.8, 1.8]} />
            <meshBasicMaterial color="#ea580c" />
          </mesh>
          <pointLight ref={furnaceLightRef} position={[0, 1.5, 2.5]} color="#f97316" distance={15} />
          {/* Anvil */}
          <mesh position={[3, 0.6, 1]} castShadow>
            <boxGeometry args={[1.2, 1.0, 0.6]} />
            <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.3} />
          </mesh>
        </group>
      )}

      {/* --- 5. Lumber Sawmill [-20, 0, 5] --- */}
      {sawmillLvl > 0 && (
        <group position={[-20, 0, 5]}>
          {/* Woodworking Shed */}
          <mesh position={[0, 1.8, 0]} castShadow>
            <boxGeometry args={[5, 3.6, 4]} />
            <meshStandardMaterial color="#451a03" roughness={0.8} />
          </mesh>
          {/* Log Stacks */}
          {[0, 0.6, 1.2].map((y, i) => (
            <mesh key={`log-${i}`} position={[3, 0.3 + y, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.3, 0.3, 3, 8]} />
              <meshStandardMaterial color="#78350f" roughness={0.9} />
            </mesh>
          ))}
        </group>
      )}

      {/* --- 6. Villager Housing Cottages [15, 0, 35] --- */}
      {housingLvl > 0 && (
        <group position={[15, 0, 35]}>
          {([[-3, 0], [3, 0]] as [number, number][]).map(([hx, hz], i) => (
            <group key={`cottage-${i}`} position={[hx, 0, hz]}>
              <mesh position={[0, 1.5, 0]} castShadow>
                <boxGeometry args={[3.2, 3.0, 3.2]} />
                <meshStandardMaterial color="#d97706" roughness={0.8} />
              </mesh>
              {/* Roof */}
              <mesh position={[0, 3.6, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
                <coneGeometry args={[2.8, 1.8, 4]} />
                <meshStandardMaterial color="#78350f" roughness={0.6} />
              </mesh>
            </group>
          ))}
        </group>
      )}
    </group>
  )
}
