'use client'

import { useFrame } from '@react-three/fiber'
import { WIND_CLOCK } from './props'

/**
 * Advances the shared wind clock.
 *
 * One float per frame drives the sway of every instanced grass tuft and tree,
 * because the displacement itself happens in the vertex shader.
 */
export function WindClock() {
  useFrame((_, rawDelta) => {
    WIND_CLOCK.value += Math.min(rawDelta, 0.05)
  })
  return null
}
