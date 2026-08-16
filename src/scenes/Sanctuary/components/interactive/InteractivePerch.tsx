'use client'

import { Prop } from '@/render/assets/props'
import { useSanctuaryColors } from '@/state/sanctuaryColorsStore'

interface InteractivePerchProps {
  propId: 'prop.perch.trunk' | 'prop.perch.stump' | 'prop.perch.rockA' | 'prop.perch.rockB'
  position?: [number, number, number]
  rotationY?: number
  scale?: number
  isOccupied?: boolean
}

/**
 * Interactive Perch & Roosting Post.
 * Visual resting surface with grip contact accents for sanctuary wyverns.
 */
export function InteractivePerch({
  propId,
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
  isOccupied = false,
}: InteractivePerchProps) {
  const roost = useSanctuaryColors((s) => s.roost)

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <Prop
        id={propId}
        position={[0, 0, 0]}
        color={propId.startsWith('prop.roost') ? roost : undefined}
      />
      {/* Claw landing wear accent mark */}
      {isOccupied && (
        <mesh position={[0, 0.45, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.25, 0.35, 8]} />
          <meshBasicMaterial color="#3a2e20" transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  )
}
