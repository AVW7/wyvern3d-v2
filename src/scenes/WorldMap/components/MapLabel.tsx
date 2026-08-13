'use client'

import React, { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Group } from 'three'
import { WorldLabel } from '@/render/labels/WorldLabel'

interface MapLabelProps {
  text: string
  subText?: string
  position: [number, number, number]
  tier: number
  color?: string
}

export function MapLabel({ text, subText, position, _tier, color = '#ffffff' }: MapLabelProps & { _tier?: number }) {
  const groupRef = useRef<Group>(null)
  const camera = useThree((s) => s.camera)

  useFrame(() => {
    if (groupRef.current) {
      const dist = camera.position.distanceTo(groupRef.current.position)
      const targetScale = Math.max(0.5, Math.min(2.5, dist / 150))
      groupRef.current.scale.setScalar(targetScale)
    }
  })

  return (
    <group ref={groupRef} position={position}>
      <WorldLabel text={text} position={[0, 0, 0]} size={3.6} variant="map" color={color} />
      {subText && (
        <WorldLabel text={subText} position={[0, -2.5, 0]} size={2.1} variant="default" color={color} />
      )}
    </group>
  )
}
