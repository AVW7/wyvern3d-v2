'use client'

import { useRef } from 'react'
import type { Group } from 'three'
import { Prop } from '@/render/assets/props'

interface InteractiveSupplyContainerProps {
  type: 'barrel' | 'crate'
  position?: [number, number, number]
  rotationY?: number
  scale?: number
  hasSupplies?: boolean
}

/**
 * Interactive Supply Barrel / Wooden Crate.
 * Displays provision readiness, cloth tie-downs, and physical supply pickup affordance.
 */
export function InteractiveSupplyContainer({
  type,
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
  hasSupplies = true,
}: InteractiveSupplyContainerProps) {
  const containerRef = useRef<Group>(null)

  return (
    <group ref={containerRef} position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {/* Base Prop */}
      <Prop id={type === 'barrel' ? 'prop.barrel' : 'prop.crate'} position={[0, 0, 0]} />

      {/* Sack / Ration Cloth Overflow when stocked */}
      {hasSupplies && (
        <mesh position={[0, type === 'barrel' ? 0.95 : 0.65, 0]}>
          <sphereGeometry args={[type === 'barrel' ? 0.22 : 0.18, 8, 8]} />
          <meshStandardMaterial color="#8b5a2b" roughness={0.9} />
        </mesh>
      )}
    </group>
  )
}
