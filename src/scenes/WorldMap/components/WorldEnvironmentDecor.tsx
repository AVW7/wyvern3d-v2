'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, Mesh, MeshBasicMaterial } from 'three'
import { HearthvaleDecor } from '../decor/HearthvaleDecor'
import { CoastalHarborsDecor } from '../decor/CoastalHarborsDecor'
import { AncientForestDecor } from '../decor/AncientForestDecor'
import { SwampMarshDecor } from '../decor/SwampMarshDecor'
import { MountainCavernDecor } from '../decor/MountainCavernDecor'
import { JungleHighlandDecor } from '../decor/JungleHighlandDecor'
import { SpireHighlandDecor } from '../decor/SpireHighlandDecor'
import { PatrolWyverns } from '../decor/PatrolWyverns'

// 1. BiomeScenery (static mostly)
function BiomeScenery() {
  const mountainPositions = [
    [-65, 0, -25], [-63, 0, -28], [-68, 0, -22],
    [90, 0, -10], [93, 0, -12], [88, 0, -8]
  ] as [number, number, number][]

  const pinePositions = [
    [45, 0, 42], [42, 0, 44], [48, 0, 40], [45, 0, 46],
    [-40, 0, 55], [-43, 0, 52], [-38, 0, 58], [-35, 0, 53]
  ] as [number, number, number][]

  const crystalPositions = [
    [5, 0, -5], [3, 0, -7], [7, 0, -3], [5, 0, -8]
  ] as [number, number, number][]

  const volcanicPositions = [
    [-5, 0, -55], [-8, 0, -52], [-2, 0, -58], [-6, 0, -54]
  ] as [number, number, number][]

  const icyPositions = [
    [75, 0, -65], [78, 0, -62], [72, 0, -68],
    [-50, 0, -70], [-53, 0, -67], [-48, 0, -72]
  ] as [number, number, number][]

  const coastalPositions = [
    [-95, 0, 0], [-92, 0, 3], [-96, 0, -4],
    [-80, 0, -50], [-78, 0, -53], [-82, 0, -48]
  ] as [number, number, number][]

  return (
    <group>
      {/* Mountains */}
      {mountainPositions.map((pos, i) => (
        <mesh key={`mount-${i}`} position={pos} scale={[5, 10 + (i % 3) * 2, 5]} rotation-y={i}>
          <coneGeometry args={[1, 1, 4]} />
          <meshStandardMaterial color="#4a5568" roughness={0.9} />
        </mesh>
      ))}

      {/* Pines */}
      {pinePositions.map((pos, i) => (
        <group key={`pine-${i}`} position={pos} scale={[2, 3 + (i % 2), 2]}>
          <mesh position={[0, 1.5, 0]}>
            <coneGeometry args={[1, 3, 5]} />
            <meshStandardMaterial color="#2f855a" roughness={1} />
          </mesh>
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 1, 5]} />
            <meshStandardMaterial color="#744210" />
          </mesh>
        </group>
      ))}

      {/* Crystals */}
      {crystalPositions.map((pos, i) => (
        <mesh key={`crys-${i}`} position={pos} scale={[1, 6 + (i % 3) * 2, 1]} rotation-x={(i % 2) * 0.2} rotation-z={(i % 3) * 0.1}>
          <cylinderGeometry args={[0, 0.5, 1, 6]} />
          <meshStandardMaterial color="#9f7aea" roughness={0.1} metalness={0.8} />
        </mesh>
      ))}

      {/* Volcanic */}
      {volcanicPositions.map((pos, i) => (
        <mesh key={`volc-${i}`} position={pos} scale={[3, 3 + (i % 2), 3]} rotation-y={i} rotation-x={i % 2}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#2d3748" roughness={1} />
        </mesh>
      ))}

      {/* Icy */}
      {icyPositions.map((pos, i) => (
        <mesh key={`ice-${i}`} position={pos} scale={[1.5, 8 + (i % 3) * 2, 1.5]} rotation-y={i}>
          <coneGeometry args={[1, 1, 4]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.2} metalness={0.1} />
        </mesh>
      ))}

      {/* Coastal */}
      {coastalPositions.map((pos, i) => (
        <mesh key={`coast-${i}`} position={pos} scale={[3, 2, 4]} rotation-x={(i % 2) * 0.3} rotation-y={i} rotation-z={(i % 3) * 0.2}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#718096" roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

// 2. Animated Sea
function AnimatedSea() {
  const seaRef = useRef<Mesh>(null)

  useFrame((state) => {
    if (seaRef.current) {
      seaRef.current.position.y = -1.5 + Math.sin(state.clock.elapsedTime * 0.4) * 0.3
    }
  })

  return (
    <mesh ref={seaRef} rotation-x={-Math.PI / 2} position={[0, -1.5, 0]}>
      <ringGeometry args={[50, 150, 64]} />
      <meshStandardMaterial color="#0f2942" transparent opacity={0.6} roughness={0.1} metalness={0.2} />
    </mesh>
  )
}

// 3. Floating Embers
function FloatingEmbers() {
  const embersRef = useRef<Group>(null)

  useFrame((state) => {
    if (embersRef.current) {
      embersRef.current.children.forEach((ember, i) => {
        ember.position.y += 0.05 + (i * 0.01)
        ember.position.x += Math.sin(state.clock.elapsedTime * 2 + i) * 0.02
        if (ember.position.y > 10) {
          ember.position.y = 0
        }
      })
    }
  })

  return (
    <group ref={embersRef} position={[0, 3, -50]}>
      {Array.from({ length: 12 }).map((_, i) => (
        <mesh key={`ember-${i}`} position={[(i % 4 - 1.5) * 4, i * 0.8, ((i % 3) - 1) * 4]}>
          <sphereGeometry args={[0.3, 8, 8]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  )
}

// 4. Fog Clouds
function FogClouds() {
  const cloudGroup1 = useRef<Group>(null)
  const cloudGroup2 = useRef<Group>(null)

  useFrame((state) => {
    if (cloudGroup1.current) {
      cloudGroup1.current.rotation.y = state.clock.elapsedTime * 0.02
    }
    if (cloudGroup2.current) {
      cloudGroup2.current.rotation.y = -state.clock.elapsedTime * 0.04
    }
  })

  return (
    <group>
      {/* Tier 3/4 Cloud Bank */}
      <group ref={cloudGroup1} position={[0, 15, -40]}>
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={`cloud1-${i}`} position={[Math.cos(i * Math.PI / 4) * 20, (i % 3) * 2, Math.sin(i * Math.PI / 4) * 20]} scale={[8, 3, 6]}>
            <sphereGeometry args={[1, 16, 16]} />
            <meshStandardMaterial color="#cbd5e1" transparent opacity={0.5} roughness={1} />
          </mesh>
        ))}
      </group>

      {/* Obsidian Ridge / Emberwaste Cloud Ring */}
      <group ref={cloudGroup2} position={[-5, 10, -55]}>
        {Array.from({ length: 5 }).map((_, i) => (
          <mesh key={`cloud2-${i}`} position={[Math.cos(i * Math.PI * 2 / 5) * 12, (i % 2), Math.sin(i * Math.PI * 2 / 5) * 12]} scale={[5, 2, 4]}>
            <sphereGeometry args={[1, 16, 16]} />
            <meshStandardMaterial color="#475569" transparent opacity={0.6} roughness={1} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

// 5. Fireflies
function Fireflies() {
  const firefliesRef = useRef<Group>(null)

  useFrame((state) => {
    if (firefliesRef.current) {
      firefliesRef.current.children.forEach((fly, i) => {
        const mat = (fly as Mesh).material as MeshBasicMaterial
        if (mat) {
          mat.opacity = 0.4 + Math.sin(state.clock.elapsedTime * 3 + i) * 0.4
        }
        fly.position.y += Math.sin(state.clock.elapsedTime * 2 + i) * 0.01
      })
    }
  })

  const positions = [
    [45, 5, 42], [47, 4, 40], [42, 6, 45], [44, 4.5, 39],
    [-40, 5, 55], [-42, 6, 52], [-38, 4, 58], [-39, 5.5, 53]
  ] as [number, number, number][]

  return (
    <group ref={firefliesRef}>
      {positions.map((pos, i) => (
        <mesh key={`fly-${i}`} position={pos}>
          <sphereGeometry args={[0.4, 8, 8]} />
          <meshBasicMaterial color="#fef08a" transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  )
}

export function WorldEnvironmentDecor() {
  return (
    <group>
      <BiomeScenery />
      <AnimatedSea />
      <FloatingEmbers />
      <FogClouds />
      <Fireflies />
      <HearthvaleDecor />
      <CoastalHarborsDecor />
      <AncientForestDecor />
      <SwampMarshDecor />
      <MountainCavernDecor />
      <JungleHighlandDecor />
      <SpireHighlandDecor />
      <PatrolWyverns />
    </group>
  )
}
