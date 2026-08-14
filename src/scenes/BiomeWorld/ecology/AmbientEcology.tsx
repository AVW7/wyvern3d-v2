'use client'

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Points } from 'three'
import { biomeHeightAt } from '../terrain/BiomeTerrain'
import { ambientAgentPosition, getRegionAmbientSpec, type AmbientAgentSpec } from './ambientPaths'

/**
 * Ambient ecology renderer (Biome Enhancement Stage 4).
 *
 * Draws a region's characteristic phenomenon as one pooled Points cloud:
 * birds, fireflies, spores or embers circling on deterministic paths.
 * Distance LOD fades the whole system out beyond LOD_FAR, and the update
 * loop is skipped entirely when fully faded — no per-agent objects, no
 * per-frame allocations, positions mutate a single buffer.
 */

/** Beyond this distance the ambient system stops updating and rendering. */
const LOD_FAR = 130
const LOD_FADE_START = 90

/** Per-ambient visual vocabulary. */
const VISUALS: Record<AmbientAgentSpec['ambient'], { color: string; size: number }> = {
  birds: { color: '#e8e4d8', size: 0.5 },
  fireflies: { color: '#d9f99d', size: 0.35 },
  spores: { color: '#bef264', size: 0.3 },
  embers: { color: '#fb923c', size: 0.35 },
  crystalPulses: { color: '#a5b4fc', size: 0.4 },
  fish: { color: '#93c5fd', size: 0.3 },
  deer: { color: '#d6c4a8', size: 0.45 },
}

export function AmbientEcology({ biome, regionId, seed = 42 }: { biome: string; regionId?: string; seed?: number }) {
  const { camera } = useThree()
  const pointsRef = useRef<Points>(null)

  const spec = useMemo(
    () => (regionId ? getRegionAmbientSpec(regionId, seed) : null),
    [regionId, seed],
  )
  const biomeRef = useRef(biome)
  biomeRef.current = biome
  const regionRef = useRef(regionId)
  regionRef.current = regionId
  const seedRef = useRef(seed)
  seedRef.current = seed

  const geometry = useMemo(() => {
    if (!spec) return null
    const positions = new Float32Array(spec.count * 3)
    const geom = new BufferGeometry()
    geom.setAttribute('position', new BufferAttribute(positions, 3))
    return geom
  }, [spec])

  useFrame((frameState) => {
    if (!spec || !geometry || !pointsRef.current) return
    const material = pointsRef.current.material as { opacity: number }
    const t = frameState.clock.elapsedTime

    // Distance LOD: fade with distance, stop updating when fully faded.
    const dist = camera.position.distanceTo(pointsRef.current.position)
    if (dist > LOD_FAR) {
      material.opacity = 0
      pointsRef.current.visible = false
      return
    }
    pointsRef.current.visible = true
    const fade = dist <= LOD_FADE_START ? 1 : 1 - (dist - LOD_FADE_START) / (LOD_FAR - LOD_FADE_START)
    material.opacity = 0.85 * fade

    const posAttr = geometry.getAttribute('position') as BufferAttribute
    const arr = posAttr.array as Float32Array
    const groundAt = (x: number, z: number) =>
      biomeHeightAt(biomeRef.current, x, z, regionRef.current, seedRef.current)

    for (let i = 0; i < spec.count; i++) {
      const p = ambientAgentPosition(spec, i, t)
      const idx = i * 3
      arr[idx] = p.x
      arr[idx + 1] = groundAt(p.x, p.z) + p.y
      arr[idx + 2] = p.z
    }
    posAttr.needsUpdate = true
  })

  if (!spec || !geometry) return null
  const visual = VISUALS[spec.ambient] ?? VISUALS.spores

  return (
    <points ref={pointsRef} geometry={geometry} position={[spec.x, 0, spec.z]}>
      <pointsMaterial
        color={visual.color}
        size={visual.size}
        transparent
        opacity={0.85}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  )
}
