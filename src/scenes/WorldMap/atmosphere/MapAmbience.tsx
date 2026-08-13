'use client'

import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, ShaderMaterial } from 'three'
import { createRng, deriveSeed } from '@/core/math/rng'
import { useGameState } from '@/state/store'
import { LAND_RADIUS } from '../terrain/mapTerrain'

const MOTE_COUNT = 400

export function MapAmbience() {
  const seed = useGameState().seed
  const matRef = useRef<ShaderMaterial | null>(null)

  const geometry = useMemo(() => {
    const rng = createRng(deriveSeed(seed, 'worldmap:motes'))
    const positions = new Float32Array(MOTE_COUNT * 3)
    const offsets = new Float32Array(MOTE_COUNT)
    const scales = new Float32Array(MOTE_COUNT)

    for (let i = 0; i < MOTE_COUNT; i++) {
      const radius = Math.sqrt(rng.next()) * LAND_RADIUS
      const angle = rng.next() * Math.PI * 2
      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = rng.range(2.0, 35.0)
      positions[i * 3 + 2] = Math.sin(angle) * radius
      offsets[i] = rng.next() * Math.PI * 2
      scales[i] = rng.range(0.6, 1.8)
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
        },
        vertexShader: `
          attribute float aOffset;
          attribute float aScale;
          uniform float uTime;
          varying float vAlpha;

          void main() {
            vec3 pos = position;
            pos.x += sin(uTime * 0.4 + aOffset) * 2.5;
            pos.z += cos(uTime * 0.3 + aOffset) * 2.5;
            pos.y += sin(uTime * 0.5 + aOffset) * 1.5;

            vAlpha = 0.3 + 0.3 * sin(uTime * 1.2 + aOffset);
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_PointSize = (18.0 / -mvPosition.z) * aScale;
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          varying float vAlpha;
          void main() {
            float d = length(gl_PointCoord - vec2(0.5));
            if (d > 0.5) discard;
            float falloff = smoothstep(0.5, 0.0, d);
            gl_FragColor = vec4(0.85, 0.92, 1.0, falloff * vAlpha);
          }
        `,
      }),
    []
  )

  useFrame((state) => {
    if (matRef.current && matRef.current.uniforms.uTime) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime
    }
  })

  return (
    <points geometry={geometry}>
      <primitive object={material} ref={matRef} attach="material" />
    </points>
  )
}
