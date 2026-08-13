'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  ShaderMaterial,
} from 'three'
import { createRng, deriveSeed } from '@/core/math/rng'
import { useGame, useGameState } from '@/state/store'
import { GROUND_RADIUS } from '../layout'
import { dayPhase, sunElevation } from './palette'
import { fireSourcesFor } from './fireSources'

const MOTE_COUNT = 340
// Low, because the gameplay camera pitch is clamped to [0.05, 1.42] and so
// never looks up — motes above roughly head height are simply never on screen.
const MOTE_CEILING = 7

/**
 * Drifting motes over the grounds.
 *
 * One `Points` draw call for the whole sanctuary. Placement is seeded from the
 * save seed through `createRng(deriveSeed(...))`, never `Math.random()` — the
 * sanctuary must look the same every time it is loaded, and the tick path's
 * `withRng` must never be touched from a render loop or every replay desyncs.
 *
 * Drift happens in the vertex shader off a single time uniform, so the 340
 * positions are uploaded once and never rewritten.
 */
export function Ambience() {
  const state = useGameState()
  const seed = state.seed

  const geometry = useMemo(() => {
    const rng = createRng(deriveSeed(seed, 'sanctuary:motes'))
    const positions = new Float32Array(MOTE_COUNT * 3)
    const offsets = new Float32Array(MOTE_COUNT)
    const scales = new Float32Array(MOTE_COUNT)

    for (let i = 0; i < MOTE_COUNT; i++) {
      // Square-root radius keeps the density even rather than clustering at
      // the centre the way a uniform radius would.
      const radius = Math.sqrt(rng.next()) * (GROUND_RADIUS - 4)
      const angle = rng.next() * Math.PI * 2
      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = rng.range(0.6, MOTE_CEILING)
      positions[i * 3 + 2] = Math.sin(angle) * radius
      offsets[i] = rng.next() * Math.PI * 2
      scales[i] = rng.range(0.5, 1.6)
    }

    const buffer = new BufferGeometry()
    buffer.setAttribute('position', new BufferAttribute(positions, 3))
    buffer.setAttribute('aOffset', new BufferAttribute(offsets, 1))
    buffer.setAttribute('aScale', new BufferAttribute(scales, 1))
    return buffer
  }, [seed])

  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: 0.5 },
          uColor: { value: new Color('#ffe4bd') },
        },
        vertexShader: `
          attribute float aOffset;
          attribute float aScale;
          uniform float uTime;
          varying float vFade;
          void main() {
            vec3 drift = position;
            drift.x += sin(uTime * 0.21 + aOffset) * 1.8;
            drift.z += cos(uTime * 0.17 + aOffset * 1.7) * 1.8;
            drift.y += sin(uTime * 0.32 + aOffset * 2.3) * 0.9;
            vec4 mv = modelViewMatrix * vec4(drift, 1.0);
            // Twinkle, so the field does not read as a static dot grid.
            vFade = 0.45 + 0.55 * sin(uTime * 1.3 + aOffset * 3.1);
            gl_PointSize = aScale * 42.0 / max(-mv.z, 1.0);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uOpacity;
          varying float vFade;
          void main() {
            // Round the square point sprite off into a soft dot.
            float d = length(gl_PointCoord - vec2(0.5));
            if (d > 0.5) discard;
            float soft = smoothstep(0.5, 0.05, d);
            gl_FragColor = vec4(uColor, soft * vFade * uOpacity);
          }
        `,
      }),
    [],
  )

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    material.uniforms.uTime!.value += dt
    // Motes catch the light, so they are strongest in low sun and nearly gone
    // at midday when there is no contrast to catch.
    const elevation = sunElevation(dayPhase(useGame.getState().state.tick))
    const lowSun = 1 - Math.min(1, Math.abs(elevation) * 1.4)
    material.uniforms.uOpacity!.value = 0.34 + lowSun * 0.42
  })

  return <points geometry={geometry} material={material} frustumCulled={false} />
}

const SMOKE_PER_SOURCE = 5
const SMOKE_RISE = 6.5

/** Smoke lifting off the forge and the infirmary fire. */
export function SmokePlumes() {
  const state = useGameState()
  const sources = useMemo(
    () =>
      fireSourcesFor(state.sanctuaryLayout?.objects).filter(
        (source) => source.spec.kind === 'furnace' || source.spec.kind === 'campfire',
      ),
    [state.sanctuaryLayout?.objects],
  )

  const puffs = useRef<(import('three').Sprite | null)[]>([])
  const time = useRef(0)

  useFrame((_, rawDelta) => {
    time.current += Math.min(rawDelta, 0.05)
    for (let i = 0; i < puffs.current.length; i++) {
      const sprite = puffs.current[i]
      if (!sprite) continue
      const source = sources[Math.floor(i / SMOKE_PER_SOURCE)]
      if (!source) continue
      const slot = i % SMOKE_PER_SOURCE
      // Each puff is the same climb, staggered — one loop, no state.
      const t = ((time.current * 0.28 + slot / SMOKE_PER_SOURCE) % 1)
      sprite.position.set(
        source.position[0] + Math.sin(t * 3.1 + slot) * t * 1.4,
        source.position[1] + t * SMOKE_RISE,
        source.position[2] + Math.cos(t * 2.3 + slot) * t * 1.2,
      )
      const size = 0.7 + t * 2.6
      sprite.scale.set(size, size, 1)
      const material = sprite.material as { opacity: number }
      // Fade in off the fire, then out as it disperses.
      material.opacity = Math.sin(t * Math.PI) * 0.22
    }
  })

  return (
    <group name="sanctuary-smoke">
      {sources.flatMap((source, sourceIndex) =>
        Array.from({ length: SMOKE_PER_SOURCE }, (_, slot) => (
          <sprite
            key={`${source.id}-${slot}`}
            ref={(instance) => {
              puffs.current[sourceIndex * SMOKE_PER_SOURCE + slot] = instance
            }}
          >
            <spriteMaterial
              color="#6b6257"
              transparent
              opacity={0}
              depthWrite={false}
              fog
            />
          </sprite>
        )),
      )}
    </group>
  )
}
