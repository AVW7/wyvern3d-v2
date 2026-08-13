'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh, MeshStandardMaterial } from 'three'
import type { Agent } from '../director/wyvernDirector'
import { PERCHES } from '../layout'

/**
 * Downwash dust under a wyvern taking off or landing.
 *
 * This deliberately does not reuse `render/vfx/GroundDustVFX`, which takes its
 * `active` flag and `position` as React props. In the sanctuary neither is
 * available that way: agent positions are `Vector3`s mutated in place every
 * frame and phases live on the same ref'd agent object, so feeding them through
 * React would mean a re-render per frame — the one thing this scene must never
 * do. Reading the agent map directly in a single `useFrame` keeps it free.
 *
 * The ring is pinned to y=0 rather than parented to the wyvern, because the
 * dust belongs to the ground the downwash hits, not to the animal.
 */
const RING_COUNT = PERCHES.length
const FADE_SECONDS = 1.4

export function SanctuaryDust({ agents }: { agents: React.RefObject<Map<string, Agent>> }) {
  const rings = useRef<(Mesh | null)[]>([])
  const progress = useRef<number[]>(Array.from({ length: RING_COUNT }, () => 0))

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    const map = agents.current
    if (!map) return

    let slot = 0
    for (const agent of map.values()) {
      if (slot >= RING_COUNT) break
      const ring = rings.current[slot]
      if (!ring) {
        slot++
        continue
      }

      const kicking = agent.phase === 'takeoff' || agent.phase === 'landing'
      const elapsed = progress.current[slot] ?? 0
      // Restart while kicking, otherwise let the last burst finish and settle.
      const next = kicking ? (elapsed + dt) % FADE_SECONDS : elapsed + dt
      progress.current[slot] = next

      if (!kicking && next >= FADE_SECONDS) {
        ring.visible = false
        slot++
        continue
      }

      const t = Math.min(1, next / FADE_SECONDS)
      ring.visible = true
      ring.position.set(agent.position.x, 0.06, agent.position.z)
      const spread = 2 + t * 7
      ring.scale.set(spread, 1, spread)
      const material = ring.material as MeshStandardMaterial
      // Sine so it swells and fades rather than popping out at full strength.
      material.opacity = Math.sin(t * Math.PI) * 0.4
      slot++
    }

    for (let i = slot; i < RING_COUNT; i++) {
      const ring = rings.current[i]
      if (ring) ring.visible = false
    }
  })

  return (
    <group name="sanctuary-dust">
      {Array.from({ length: RING_COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(instance) => {
            rings.current[i] = instance
          }}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
          renderOrder={6}
        >
          <ringGeometry args={[0.5, 1, 28]} />
          <meshStandardMaterial
            color="#9e917d"
            transparent
            opacity={0}
            depthWrite={false}
            roughness={1}
          />
        </mesh>
      ))}
    </group>
  )
}
