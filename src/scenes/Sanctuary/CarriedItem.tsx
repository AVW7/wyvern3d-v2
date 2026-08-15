'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group } from 'three'
import { useGameState } from '@/state/store'
import { useSanctuaryCommands } from '@/state/sanctuaryCommands'

/**
 * Visual 3D representation of a carried duty item attached to the player.
 * Mutates Three.js group transform directly in useFrame to avoid React re-renders.
 */
export function CarriedItem() {
  const groupRef = useRef<Group>(null)
  const state = useGameState()
  const carriedDutyId = state.duties?.carriedDutyId
  const activeCarriedDuty = carriedDutyId !== null
    ? state.duties?.active.find((d) => d.id === carriedDutyId && d.status === 'carrying')
    : null

  useFrame(() => {
    if (!groupRef.current) return

    if (!activeCarriedDuty) {
      groupRef.current.visible = false
      return
    }

    groupRef.current.visible = true
    const playerPos = useSanctuaryCommands.getState().playerPosition
    // Place in front/hand area of player: y ~ 0.9, slightly offset
    groupRef.current.position.set(playerPos[0], 0.9, playerPos[1])
  })

  return (
    <group ref={groupRef} visible={false}>
      {/* Ration bundle / sack */}
      <mesh castShadow position={[0.2, 0, 0.3]}>
        <sphereGeometry args={[0.28, 12, 10]} />
        <meshStandardMaterial color="#8b5a2b" roughness={0.8} />
      </mesh>
      {/* Tied rope top accent */}
      <mesh position={[0.2, 0.22, 0.3]}>
        <cylinderGeometry args={[0.08, 0.12, 0.12, 8]} />
        <meshStandardMaterial color="#c2b280" roughness={0.9} />
      </mesh>
    </group>
  )
}
