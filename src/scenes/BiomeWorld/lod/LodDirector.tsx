'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { resolveLod } from './biomeLod'
import { useBiomeLod } from './biomeLodStore'

/**
 * Single driver component for Biome LOD (Stage 6).
 * Computes camera distance to origin, evaluates the hysteresis band,
 * and updates the shared `useBiomeLod` store only on level transitions.
 */
export function LodDirector() {
  const { camera } = useThree()
  const lastCheck = useRef(0)

  useFrame((state) => {
    // Throttle distance checks to ~10Hz (every 0.1s)
    const t = state.clock.elapsedTime
    if (t - lastCheck.current < 0.1) return
    lastCheck.current = t

    const dist = camera.position.length()
    const current = useBiomeLod.getState().level
    const next = resolveLod(dist, current)
    if (next !== current) {
      useBiomeLod.getState().setLevel(next)
    }
  })

  return null
}
