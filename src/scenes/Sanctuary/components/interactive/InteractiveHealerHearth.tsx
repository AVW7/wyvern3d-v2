'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { PointLight } from 'three'
import { Prop } from '@/render/assets/props'
import { emissiveFor } from '../../atmosphere/fireSources'
import { InteractiveTrough } from './InteractiveTrough'

interface InteractiveHealerHearthProps {
  position?: [number, number, number]
  rotationY?: number
  scale?: number
}

/**
 * Interactive Infirmary Healer's Hearth & Herbal Wash.
 * Provides restorative healing aura, campfire warmth light, and herbal basin.
 */
export function InteractiveHealerHearth({
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
}: InteractiveHealerHearthProps) {
  const lightRef = useRef<PointLight>(null)
  const clockRef = useRef(0)

  useFrame((_, delta) => {
    clockRef.current += delta
    const t = clockRef.current

    // Warm fire flicker
    if (lightRef.current) {
      lightRef.current.intensity = 1.6 + Math.sin(t * 7.0) * 0.25 + Math.cos(t * 11.0) * 0.15
    }
  })

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {/* Stone Floor Plinth */}
      <Prop id="prop.keep.floorB" position={[0, 0, 0]} castShadow={false} />

      {/* Campfire Brazier with Dynamic Light */}
      <Prop
        id="prop.campfire"
        position={[0, 0, -0.6]}
        emissive={emissiveFor('prop.campfire')}
      />
      <pointLight
        ref={lightRef}
        position={[0, 0.8, -0.6]}
        color="#ff7a29"
        distance={7.5}
        intensity={1.6}
      />

      {/* Herbal Wash Basin Trough */}
      <InteractiveTrough
        position={[-1.5, 0, 0.4]}
        rotationY={Math.PI / 2}
        hasWater
        isQuenching={false}
      />

      {/* Healer Examination Stump & Supplies */}
      <Prop id="prop.perch.stump" position={[1.3, 0, -0.4]} />
      <Prop id="prop.logPile" position={[-1.5, 0, -1.2]} rotationY={-0.4} />
      <Prop id="prop.crate" position={[1.4, 0, 0.8]} rotationY={0.3} />
      <Prop
        id="prop.torch"
        position={[-1.8, 0, 1.2]}
        emissive={emissiveFor('prop.torch')}
      />
    </group>
  )
}
