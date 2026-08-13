'use client'

import { useFrame } from '@react-three/fiber'
import { WIND_CLOCK } from '@/render/assets/props'

/**
 * Advances the shared wind clock.
 *
 * One float per frame drives the sway of every instanced grass tuft and fir in
 * the sanctuary, because the displacement itself happens in the vertex shader.
 * The alternative — rewriting a few hundred instance matrices each frame — is
 * exactly the churn `PropInstances` was written to avoid.
 */
export function SanctuaryWind() {
  useFrame((_, rawDelta) => {
    WIND_CLOCK.value += Math.min(rawDelta, 0.05)
  })
  return null
}
