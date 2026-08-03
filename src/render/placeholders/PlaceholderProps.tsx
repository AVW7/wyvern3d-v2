'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'

/** Stand-in building: a plinth, a body and a roof. Footprint comes from props. */
export function PlaceholderBuilding({
  color = '#8a7a5c',
  width = 6,
  depth = 6,
  height = 4,
  roof = true,
}: {
  color?: string
  width?: number
  depth?: number
  height?: number
  roof?: boolean
}) {
  return (
    <group>
      <mesh position={[0, 0.15, 0]} receiveShadow>
        <boxGeometry args={[width + 0.8, 0.3, depth + 0.8]} />
        <meshStandardMaterial color="#5a5248" roughness={0.95} />
      </mesh>
      <mesh position={[0, height / 2 + 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      {roof && (
        <mesh position={[0, height + 0.3 + height * 0.22, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[Math.max(width, depth) * 0.78, height * 0.45, 4]} />
          <meshStandardMaterial color="#4a3f36" roughness={0.9} />
        </mesh>
      )}
    </group>
  )
}

/** Stand-in soldier. Instanced squads use their own path; this is for singles. */
export function PlaceholderUnit({ color = '#8a7a5c', scale = 1 }: { color?: string; scale?: number }) {
  return (
    <group scale={scale}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <capsuleGeometry args={[0.28, 0.8, 4, 8]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.65, 0]} castShadow>
        <sphereGeometry args={[0.24, 10, 8]} />
        <meshStandardMaterial color="#c9b8a0" roughness={0.7} />
      </mesh>
    </group>
  )
}

/**
 * Stand-in for the player's sim.
 *
 * Takes `movingRef` rather than a boolean prop: the walk state changes every
 * frame, and passing it as a prop would re-render the whole scene 60 times a
 * second. Reading the ref inside useFrame costs nothing.
 */
export type CharacterGesture = 'none' | 'offer' | 'pet' | 'calm'

export function PlaceholderCharacter({
  movingRef,
  gestureRef,
}: {
  movingRef?: React.RefObject<boolean>
  gestureRef?: React.RefObject<CharacterGesture>
}) {
  const root = useRef<Group>(null)
  const leftArm = useRef<Group>(null)
  const rightArm = useRef<Group>(null)

  useFrame((state) => {
    if (!root.current) return
    const moving = movingRef?.current ?? false
    root.current.position.y = moving ? Math.abs(Math.sin(state.clock.elapsedTime * 9)) * 0.09 : 0

    const gesture = gestureRef?.current ?? 'none'
    const leftTarget = gesture === 'pet' ? -1.25 : gesture === 'calm' ? -0.8 : 0
    const rightTarget = gesture === 'offer' ? -1.0 : 0
    if (leftArm.current) {
      leftArm.current.rotation.x += (leftTarget - leftArm.current.rotation.x) * 0.16
      leftArm.current.rotation.z +=
        ((gesture === 'calm' ? -0.25 : 0) - leftArm.current.rotation.z) * 0.16
    }
    if (rightArm.current) {
      rightArm.current.rotation.x += (rightTarget - rightArm.current.rotation.x) * 0.16
      rightArm.current.rotation.z +=
        ((gesture === 'offer' ? 0.2 : 0) - rightArm.current.rotation.z) * 0.16
    }
  })

  return (
    <group ref={root}>
      <mesh position={[0, 0.95, 0]} castShadow>
        <capsuleGeometry args={[0.3, 0.85, 4, 10]} />
        <meshStandardMaterial color="#3f5f7a" roughness={0.75} />
      </mesh>
      <mesh position={[0, 1.72, 0]} castShadow>
        <sphereGeometry args={[0.26, 12, 10]} />
        <meshStandardMaterial color="#d8c0a4" roughness={0.65} />
      </mesh>
      {/* a nub facing +Z so the character's heading is legible */}
      <mesh position={[0, 1.72, 0.24]}>
        <boxGeometry args={[0.16, 0.1, 0.14]} />
        <meshStandardMaterial color="#2c3e50" />
      </mesh>
      <group ref={leftArm} position={[-0.36, 1.35, 0]}>
        <mesh position={[0, -0.3, 0]} castShadow>
          <capsuleGeometry args={[0.09, 0.45, 3, 7]} />
          <meshStandardMaterial color="#3f5f7a" roughness={0.75} />
        </mesh>
      </group>
      <group ref={rightArm} position={[0.36, 1.35, 0]}>
        <mesh position={[0, -0.3, 0]} castShadow>
          <capsuleGeometry args={[0.09, 0.45, 3, 7]} />
          <meshStandardMaterial color="#3f5f7a" roughness={0.75} />
        </mesh>
      </group>
    </group>
  )
}

/** Stand-in egg, used in the hatchery roosts. */
export function PlaceholderEgg({ color = '#cbbfa8', scale = 1 }: { color?: string; scale?: number }) {
  return (
    <mesh scale={[scale, scale * 1.35, scale]} position={[0, 0.4 * scale, 0]} castShadow>
      <sphereGeometry args={[0.35, 14, 12]} />
      <meshStandardMaterial color={color} roughness={0.55} />
    </mesh>
  )
}
