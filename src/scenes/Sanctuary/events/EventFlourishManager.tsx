'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  Group,
  InstancedMesh,
  Object3D,
  Vector3,
} from 'three'
import type { GameEvent } from '@/core/types'
import { advanceTicks } from '@/core/state/tick'
import { useGame, useGameState } from '@/state/store'
import { WorldLabel } from '@/render/labels/WorldLabel'
import { PERCHES, ROOSTS, TRAINING_POSTS } from '../layout'
import { useGameEventStream } from './useGameEventStream'

interface ActiveFlourish {
  id: number
  type: 'hatch' | 'levelup' | 'promotion' | 'training'
  position: [number, number, number]
  label: string
  subtitle?: string
  color: string
  startTime: number
  duration: number
  particles?: {
    vel: Vector3
    pos: Vector3
    rot: Vector3
    rotSpeed: Vector3
    scale: number
  }[]
}

const HATCH_DURATION = 3.0
const LEVELUP_DURATION = 3.5
const MAX_PARTICLES = 32

const tempObj = new Object3D()

/**
 * Visual flourish manager for discrete GameEvents.
 * Renders egg burst particles, expanding spectral auras, and floating delta labels.
 */
export function EventFlourishManager() {
  const state = useGameState()
  const [flourishes, setFlourishes] = useState<ActiveFlourish[]>([])
  const nextFlourishId = useRef(1)
  const clockRef = useRef(0)

  // Register dev window handle __wyvern.advance(n)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const existing = (window as unknown as { __wyvern?: Record<string, unknown> }).__wyvern ?? {}
      ;(window as unknown as { __wyvern: Record<string, unknown> }).__wyvern = {
        ...existing,
        advance: (n: number) => {
          const gameStore = useGame.getState()
          advanceTicks(gameStore.state, n)
          useGame.setState({ revision: gameStore.revision + 1 })
        },
      }
    }
  }, [])

  const resolveWyvernPosition = useCallback(
    (wyvernId: string): [number, number, number] => {
      const wyvern = state.wyverns[wyvernId]
      if (!wyvern) return [0, 0, 0]

      if (wyvern.assignment.kind === 'training') {
        const post = TRAINING_POSTS[wyvern.assignment.stationId]
        if (post) return [post[0], 0, post[1]]
      }

      const perchIdx = wyvern.preferredPerchIndex ?? 0
      const perch = PERCHES[perchIdx % PERCHES.length]
      if (perch) return [perch[0], 0, perch[1]]

      return [0, 0, 0]
    },
    [state.wyverns],
  )

  const handleGameEvent = useCallback(
    (event: GameEvent) => {
      const now = clockRef.current
      const id = nextFlourishId.current++

      if (event.kind === 'egg_hatched') {
        const roost = ROOSTS[0] ?? [11, 0]
        const pos: [number, number, number] = [roost[0], 0.5, roost[1]]

        // Generate shell burst particles
        const particles: ActiveFlourish['particles'] = []
        for (let i = 0; i < MAX_PARTICLES; i++) {
          const angle = Math.random() * Math.PI * 2
          const elevation = 0.3 + Math.random() * 0.7
          const speed = 4 + Math.random() * 8
          particles.push({
            pos: new Vector3(pos[0], pos[1] + 0.3, pos[2]),
            vel: new Vector3(
              Math.cos(angle) * speed * (1 - elevation),
              elevation * speed,
              Math.sin(angle) * speed * (1 - elevation),
            ),
            rot: new Vector3(Math.random() * Math.PI, Math.random() * Math.PI, 0),
            rotSpeed: new Vector3(
              (Math.random() - 0.5) * 8,
              (Math.random() - 0.5) * 8,
              (Math.random() - 0.5) * 8,
            ),
            scale: 0.15 + Math.random() * 0.25,
          })
        }

        setFlourishes((prev) => [
          ...prev,
          {
            id,
            type: 'hatch',
            position: pos,
            label: '✦ EGG HATCHED ✦',
            subtitle: 'NEWBORN IMPRINTED',
            color: '#ffd700',
            startTime: now,
            duration: HATCH_DURATION,
            particles,
          },
        ])
      } else if (event.kind === 'wyvern_leveled') {
        const pos = resolveWyvernPosition(event.subjectId)
        const lvl = (event.payload?.level as number) ?? ''

        setFlourishes((prev) => [
          ...prev,
          {
            id,
            type: 'levelup',
            position: pos,
            label: `LEVEL UP! Lv.${lvl}`,
            subtitle: state.wyverns[event.subjectId]?.name ?? 'WYVERN',
            color: '#60a5fa',
            startTime: now,
            duration: LEVELUP_DURATION,
          },
        ])
      } else if (event.kind === 'stage_promoted') {
        const pos = resolveWyvernPosition(event.subjectId)
        const stage = ((event.payload?.stage as string) ?? 'ADULT').toUpperCase()

        setFlourishes((prev) => [
          ...prev,
          {
            id,
            type: 'promotion',
            position: pos,
            label: `✦ MATURED: ${stage} ✦`,
            subtitle: state.wyverns[event.subjectId]?.name ?? 'WYVERN',
            color: '#34d399',
            startTime: now,
            duration: LEVELUP_DURATION,
          },
        ])
      } else if (event.kind === 'training_completed') {
        const stationId = event.objectId ?? 'trainingGrounds'
        const post = TRAINING_POSTS[stationId] ?? [0, 0]
        const pos: [number, number, number] = [post[0], 0, post[1]]
        const wyvernName = state.wyverns[event.subjectId]?.name ?? 'Wyvern'

        setFlourishes((prev) => [
          ...prev,
          {
            id,
            type: 'training',
            position: pos,
            label: 'TRAINING COMPLETE',
            subtitle: wyvernName.toUpperCase(),
            color: '#fbbf24',
            startTime: now,
            duration: LEVELUP_DURATION,
          },
        ])
      }
    },
    [resolveWyvernPosition, state.wyverns],
  )

  useGameEventStream({ onEvent: handleGameEvent })

  useFrame((_, delta) => {
    clockRef.current += delta
    const now = clockRef.current

    // Clean up finished flourishes
    setFlourishes((prev) => {
      const remaining = prev.filter((f) => now - f.startTime < f.duration)
      return remaining.length === prev.length ? prev : remaining
    })
  })

  return (
    <group name="event-flourishes">
      {flourishes.map((f) => (
        <FlourishInstance key={f.id} flourish={f} getNow={() => clockRef.current} />
      ))}
    </group>
  )
}

function FlourishInstance({
  flourish,
  getNow,
}: {
  flourish: ActiveFlourish
  getNow: () => number
}) {
  const groupRef = useRef<Group>(null)
  const instancedRef = useRef<InstancedMesh>(null)
  const ringRef = useRef<Group>(null)

  const auraColor =
    flourish.type === 'hatch'
      ? '#ffd700'
      : flourish.type === 'levelup'
        ? '#38bdf8'
        : flourish.type === 'promotion'
          ? '#4ade80'
          : '#f59e0b'

  useFrame((_, delta) => {
    const elapsed = getNow() - flourish.startTime
    const progress = Math.min(1, Math.max(0, elapsed / flourish.duration))
    const fade = Math.max(0, 1 - progress)

    // Animate expanding aura ring
    if (ringRef.current) {
      const ringScale = 1 + progress * 4.5
      ringRef.current.scale.set(ringScale, ringScale, ringScale)
      ringRef.current.position.y = flourish.position[1] + progress * 3.5
    }

    // Animate particle burst if present
    if (flourish.particles && instancedRef.current) {
      for (let i = 0; i < flourish.particles.length; i++) {
        const p = flourish.particles[i]!
        p.vel.y -= 9.8 * delta // gravity
        p.pos.addScaledVector(p.vel, delta)
        p.rot.addScaledVector(p.rotSpeed, delta)

        if (p.pos.y < 0) {
          p.pos.y = 0
          p.vel.y *= -0.3
          p.vel.x *= 0.8
          p.vel.z *= 0.8
        }

        tempObj.position.copy(p.pos)
        tempObj.rotation.set(p.rot.x, p.rot.y, p.rot.z)
        const particleScale = p.scale * fade
        tempObj.scale.set(particleScale, particleScale, particleScale)
        tempObj.updateMatrix()
        instancedRef.current.setMatrixAt(i, tempObj.matrix)
      }
      instancedRef.current.instanceMatrix.needsUpdate = true
    }
  })

  const elapsed = getNow() - flourish.startTime
  const progress = Math.min(1, Math.max(0, elapsed / flourish.duration))
  const floatHeight = flourish.position[1] + 3.0 + progress * 2.5
  const opacity = Math.max(0, Math.min(1, (1 - progress) * 1.5))

  return (
    <group ref={groupRef} position={[flourish.position[0], 0, flourish.position[2]]}>
      {/* Floating WorldLabel Banner */}
      <WorldLabel
        text={flourish.label}
        subtitle={flourish.subtitle}
        color={flourish.color}
        variant="station"
        size={1.6}
        position={[0, floatHeight, 0]}
        opacity={opacity}
      />

      {/* Expanding Spectral Ground Aura Ring */}
      <group ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
        <mesh>
          <ringGeometry args={[1.6, 2.2, 32]} />
          <meshBasicMaterial
            color={auraColor}
            transparent
            opacity={opacity * 0.75}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Particle Shell / Spark Bursts */}
      {flourish.particles && (
        <instancedMesh
          ref={instancedRef}
          args={[undefined, undefined, flourish.particles.length]}
        >
          <boxGeometry args={[0.3, 0.3, 0.3]} />
          <meshBasicMaterial
            color={auraColor}
            transparent
            opacity={opacity * 0.9}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </instancedMesh>
      )}
    </group>
  )
}
