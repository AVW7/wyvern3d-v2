'use client'

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, Points } from 'three'
import type { WeatherParticleKind } from './biomeWeather'

interface BiomeWeatherParticlesProps {
  kind: WeatherParticleKind
  count: number
  windSpeed?: number
}

const BOUNDS_RADIUS = 35
const BOUNDS_HEIGHT = 28

export function BiomeWeatherParticles({
  kind,
  count,
  windSpeed = 1.0,
}: BiomeWeatherParticlesProps) {
  const { camera } = useThree()
  const pointsRef = useRef<Points>(null)

  const activeCount = Math.min(500, Math.max(0, count))

  const { geometry, velocities } = useMemo(() => {
    if (kind === 'none' || activeCount === 0) {
      return { geometry: null, velocities: null }
    }

    const positions = new Float32Array(activeCount * 3)
    const vel = new Float32Array(activeCount * 3)

    for (let i = 0; i < activeCount; i++) {
      const idx = i * 3
      const angle = Math.random() * Math.PI * 2
      const radius = Math.random() * BOUNDS_RADIUS
      positions[idx] = Math.cos(angle) * radius
      positions[idx + 1] = Math.random() * BOUNDS_HEIGHT - 4
      positions[idx + 2] = Math.sin(angle) * radius

      if (kind === 'rain') {
        vel[idx] = (Math.random() - 0.5) * 0.5
        vel[idx + 1] = -18 - Math.random() * 8
        vel[idx + 2] = (Math.random() - 0.5) * 0.5
      } else if (kind === 'snow') {
        vel[idx] = (Math.random() - 0.5) * 1.5
        vel[idx + 1] = -2.5 - Math.random() * 2.0
        vel[idx + 2] = (Math.random() - 0.5) * 1.5
      } else if (kind === 'ash') {
        vel[idx] = (Math.random() - 0.5) * 2.0
        vel[idx + 1] = -1.2 - Math.random() * 1.8
        vel[idx + 2] = (Math.random() - 0.5) * 2.0
      } else {
        // spores / embers
        vel[idx] = (Math.random() - 0.5) * 1.2
        vel[idx + 1] = (Math.random() - 0.2) * 1.0
        vel[idx + 2] = (Math.random() - 0.5) * 1.2
      }
    }

    const geom = new BufferGeometry()
    geom.setAttribute('position', new BufferAttribute(positions, 3))
    return { geometry: geom, velocities: vel }
  }, [kind, activeCount])

  const particleColor =
    kind === 'rain'
      ? '#93c5fd'
      : kind === 'snow'
        ? '#f8fafc'
        : kind === 'ash'
          ? '#78716c'
          : '#bef264'

  const particleSize = kind === 'rain' ? 0.35 : kind === 'snow' ? 0.45 : 0.3

  useFrame((_, delta) => {
    if (!geometry || !velocities || !pointsRef.current) return

    const posAttr = geometry.getAttribute('position') as BufferAttribute
    const pos = posAttr.array as Float32Array
    const dt = Math.min(delta, 0.05)
    const camPos = camera.position

    for (let i = 0; i < activeCount; i++) {
      const idx = i * 3
      const curX = pos[idx] ?? 0
      const curY = pos[idx + 1] ?? 0
      const curZ = pos[idx + 2] ?? 0
      const vx = velocities[idx] ?? 0
      const vy = velocities[idx + 1] ?? 0
      const vz = velocities[idx + 2] ?? 0

      let nextX = curX + (vx + windSpeed * 0.4) * dt
      let nextY = curY + vy * dt
      let nextZ = curZ + (vz + windSpeed * 0.2) * dt

      // Wrap relative to camera
      const relX = nextX - camPos.x
      const relY = nextY - camPos.y
      const relZ = nextZ - camPos.z

      if (relY < -8) nextY = camPos.y + BOUNDS_HEIGHT - 6
      else if (relY > BOUNDS_HEIGHT) nextY = camPos.y - 4

      if (Math.hypot(relX, relZ) > BOUNDS_RADIUS) {
        const backAngle = Math.random() * Math.PI * 2
        nextX = camPos.x + Math.cos(backAngle) * (BOUNDS_RADIUS - 2)
        nextZ = camPos.z + Math.sin(backAngle) * (BOUNDS_RADIUS - 2)
      }

      pos[idx] = nextX
      pos[idx + 1] = nextY
      pos[idx + 2] = nextZ
    }

    posAttr.needsUpdate = true
  })

  if (!geometry || kind === 'none') return null

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={particleSize}
        color={particleColor}
        transparent
        opacity={kind === 'rain' ? 0.65 : 0.85}
        depthWrite={false}
      />
    </points>
  )
}
