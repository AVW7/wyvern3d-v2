'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { GameModel } from '@/render/assets/GameModel'
import { useGameState } from '@/state/store'
import type { Agent } from '../director/wyvernDirector'
import { alarmLevel, fleeHeading, placeDeer } from './wildlifeLogic'

/**
 * Ambient deer at the treeline.
 *
 * Kept small on purpose. `wildlife.deer` currently has `url: null` in the
 * manifest, so every one of these renders the cheap procedural fallback below;
 * if a real model is ever assigned to that slot it must stay non-skinned at
 * this count, because the documented 60fps ceiling for this scene is already
 * spent on eight skinned wyverns.
 */
const HERD_SIZE = 5

export function SanctuaryWildlife({ agents }: { agents: React.RefObject<Map<string, Agent>> }) {
  const state = useGameState()
  const herd = useMemo(() => placeDeer(state.seed, HERD_SIZE), [state.seed])
  const groups = useRef<(Group | null)[]>([])
  // A group we own, so the grazing bob never depends on what GameModel happens
  // to render — reaching into children[0] would silently start translating the
  // whole animal the day `wildlife.deer` is given a real model.
  const bodies = useRef<(Group | null)[]>([])
  const alarm = useRef<number[]>(herd.map(() => 0))
  const flee = useRef<number[]>(herd.map(() => 0))
  const time = useRef(0)

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    time.current += dt

    const map = agents.current
    const threats: { x: number; z: number; airborne: boolean }[] = []
    if (map) {
      for (const agent of map.values()) {
        threats.push({ x: agent.position.x, z: agent.position.z, airborne: agent.airborne })
      }
    }

    for (let i = 0; i < herd.length; i++) {
      const group = groups.current[i]
      const deer = herd[i]
      if (!group || !deer) continue

      const target = alarmLevel(deer, threats)
      // Alarm rises fast and decays slowly — a deer settles long after the
      // thing that spooked it has gone.
      const current = alarm.current[i] ?? 0
      const rate = target > current ? 6 : 0.5
      const level = current + (target - current) * Math.min(1, rate * dt)
      alarm.current[i] = level

      const heading = fleeHeading(deer, threats)
      if (heading !== null) flee.current[i] = heading
      const away = flee.current[i] ?? 0

      // Grazing drift when calm, a run away from the threat when not.
      const wander = time.current * 0.25 + deer.phase
      const driftX = Math.cos(wander) * 1.6
      const driftZ = Math.sin(wander * 0.8) * 1.2
      const bolt = level * 9

      group.position.set(
        deer.home[0] + driftX + Math.sin(away) * bolt,
        0,
        deer.home[1] + driftZ + Math.cos(away) * bolt,
      )
      group.rotation.y =
        level > 0.05 ? away : deer.facing + Math.sin(wander * 0.6) * 0.5
      // Body dips while grazing, stills while alert.
      const body = bodies.current[i]
      if (body) body.position.setY(Math.sin(time.current * 2 + deer.phase) * 0.05 * (1 - level))
    }
  })

  return (
    <group name="sanctuary-wildlife">
      {herd.map((deer, i) => (
        <group
          key={deer.id}
          ref={(instance) => {
            groups.current[i] = instance
          }}
          position={[deer.home[0], 0, deer.home[1]]}
        >
          <group
            ref={(instance) => {
              bodies.current[i] = instance
            }}
          >
            <GameModel
              id="wildlife.deer"
              state="idle"
              seed={i}
              scale={0.9}
              fallback={<DeerFallback />}
            />
          </group>
        </group>
      ))}
    </group>
  )
}

/** Matches the Highlands doe stand-in, so the two maps read consistently. */
function DeerFallback() {
  return (
    <group position={[0, 0.42, 0]}>
      <mesh castShadow>
        <sphereGeometry args={[0.62, 10, 7]} />
        <meshStandardMaterial color="#8d6b4e" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.34, 0.52]} castShadow>
        <capsuleGeometry args={[0.17, 0.46, 4, 7]} />
        <meshStandardMaterial color="#8d6b4e" roughness={0.95} />
      </mesh>
      {[-0.28, 0.28].map((x) =>
        [-0.3, 0.3].map((z) => (
          <mesh key={`${x},${z}`} position={[x, -0.34, z]} castShadow>
            <capsuleGeometry args={[0.06, 0.4, 3, 5]} />
            <meshStandardMaterial color="#6f5238" roughness={1} />
          </mesh>
        )),
      )}
    </group>
  )
}
