'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, Color } from 'three'
import type { PointLight, Sprite, SpriteMaterial } from 'three'
import { useSanctuaryCommands } from '@/state/sanctuaryCommands'
import { dayPhase, sunElevation } from './palette'
import { fireSourcesFor, selectLitSources, type FireSource } from './fireSources'
import { useGame, useGameState } from '@/state/store'

/**
 * Hard ceiling on simultaneous dynamic lights.
 *
 * Each unshadowed point light adds one lighting iteration to the fragment
 * shader of every lit material in the scene. Four is comfortable; the sixteen
 * fires a fully-decorated sanctuary can hold would not be. None of these cast
 * shadows — a second shadow-casting light would double the shadow pass.
 */
const LIGHT_BUDGET = 4

/** Per-source flicker, so two torches never pulse in lockstep. */
function flicker(time: number, seed: number): number {
  return (
    Math.sin(time * 11.3 + seed * 5.1) * 0.5 +
    Math.sin(time * 27.7 + seed * 2.3) * 0.3 +
    Math.sin(time * 43.1 + seed * 8.7) * 0.2
  )
}

function seedOf(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 997
  return hash / 997
}

/**
 * Firelight for the sanctuary.
 *
 * Every fire gets a flame sprite; only the nearest few get a real point light.
 * The whole rig fades up after sunset and down at dawn, which is what makes the
 * torches feel purposeful rather than decorative.
 */
export function Firelight() {
  const state = useGameState()
  const sources = useMemo(
    () => fireSourcesFor(state.sanctuaryLayout?.objects),
    [state.sanctuaryLayout?.objects],
  )

  // Hashing every fire's id once per frame would be pure waste in the hot
  // loop; the set only changes when the player edits the layout.
  const seeds = useMemo(() => {
    const map = new Map<string, number>()
    for (const source of sources) map.set(source.id, seedOf(source.id))
    return map
  }, [sources])

  const lights = useRef<(PointLight | null)[]>([])
  const sprites = useRef<(Sprite | null)[]>([])
  const litRef = useRef<FireSource[]>([])
  const resortTimer = useRef(0)
  const time = useRef(0)
  const tint = useRef(new Color())

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    time.current += dt

    // Night weight: fires read as light sources after dusk and as embers at
    // noon, so the rig has something to do across the whole cycle.
    const phase = dayPhase(useGame.getState().state.tick)
    const night = Math.min(1, Math.max(0, 0.55 - sunElevation(phase)) / 1.1)
    const ambient = 0.35 + night * 0.65

    // Re-sorting every frame would be wasted work — the player cannot outrun a
    // 14-metre falloff in a quarter second, and a stable set stops a light
    // popping between two equidistant torches.
    resortTimer.current -= dt
    if (resortTimer.current <= 0) {
      resortTimer.current = 0.25
      const [px, pz] = useSanctuaryCommands.getState().playerPosition
      litRef.current = selectLitSources(sources, [px, pz], LIGHT_BUDGET)
    }

    for (let i = 0; i < LIGHT_BUDGET; i++) {
      const light = lights.current[i]
      if (!light) continue
      const source = litRef.current[i]
      if (!source) {
        light.intensity = 0
        light.visible = false
        continue
      }
      light.visible = true
      light.position.set(...source.position)
      light.distance = source.spec.distance * source.scale
      tint.current.set(source.spec.color)
      light.color.copy(tint.current)
      const wobble = flicker(time.current, seeds.get(source.id) ?? 0)
      light.intensity = source.spec.intensity * ambient * (1 + wobble * 0.22)
    }

    for (let i = 0; i < sprites.current.length; i++) {
      const sprite = sprites.current[i]
      const source = sources[i]
      if (!sprite || !source) continue
      const wobble = flicker(time.current, seeds.get(source.id) ?? 0)
      const size = source.spec.size * source.scale * (1 + wobble * 0.14)
      sprite.scale.set(size * 2, size * 2.6, 1)
      const material = sprite.material as SpriteMaterial
      material.opacity = (0.5 + night * 0.45) * (1 + wobble * 0.18)
    }
  })

  return (
    <group name="sanctuary-firelight">
      {Array.from({ length: LIGHT_BUDGET }, (_, i) => (
        <pointLight
          key={i}
          ref={(instance) => {
            lights.current[i] = instance
          }}
          castShadow={false}
          intensity={0}
          decay={2}
        />
      ))}
      {sources.map((source, i) => (
        <sprite
          key={source.id}
          ref={(instance) => {
            sprites.current[i] = instance
          }}
          position={source.position}
        >
          <spriteMaterial
            color={source.spec.color}
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
            opacity={0.7}
            fog={false}
            toneMapped={false}
          />
        </sprite>
      ))}
    </group>
  )
}
