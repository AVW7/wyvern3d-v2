'use client'

import { useMemo } from 'react'
import { PropInstances, type PropPlacement } from '@/render/assets/props'
import type { Collider } from '@/render/controllers/CharacterController'
import { BIOME_WORLD_RADIUS, biomeHeightAt } from '../terrain/BiomeTerrain'
import { GroveLandmark } from './GroveLandmark'

function generateRingProps(
  biome: string,
  count: number,
  minRadius: number,
  maxRadius: number,
  scaleRange: [number, number],
  offset: number,
): PropPlacement[] {
  return Array.from({ length: count }, (_, index) => {
    const ratio = ((index * 37) % count) / count
    const angle = index * 2.399963229728653 + offset
    const radius = minRadius + ratio * (maxRadius - minRadius)
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    return {
      position: [x, biomeHeightAt(biome, x, z), z],
      rotationY: angle + Math.PI * 0.5,
      scale: scaleRange[0] + (((index * 17) % 11) / 10) * (scaleRange[1] - scaleRange[0]),
    }
  })
}

interface BiomeDressingProps {
  biome: string
  /** Receives the grove landmark's measured footprint once its model loads. */
  onColliders?: (colliders: Collider[]) => void
}

export function BiomeDressing({ biome, onColliders }: BiomeDressingProps) {
  const dressingConfigs = useMemo(() => {
    const countMult =
      biome === 'forest' || biome === 'jungle' ? 1.4 : biome === 'grove' ? 1.2 : biome === 'cavern' ? 0.6 : 1.0

    // The grove keeps its middle clear: the world tree and its stone ring own
    // everything inside 32 m, so scatter starts outside that.
    const clearing = biome === 'grove' ? 32 : 0
    const inner = (radius: number) => Math.max(radius, clearing)

    const ring = (
      count: number,
      minRadius: number,
      maxRadius: number,
      scaleRange: [number, number],
      offset: number,
    ) => generateRingProps(biome, Math.round(count * countMult), inner(minRadius), maxRadius, scaleRange, offset)

    const firA = ring(26, 25, BIOME_WORLD_RADIUS - 15, [0.85, 1.4], 0.3)
    const firB = ring(20, 30, BIOME_WORLD_RADIUS - 10, [0.8, 1.25], 1.1)
    const deadTree = ring(12, 20, BIOME_WORLD_RADIUS - 20, [0.75, 1.1], 0.8)
    const mysticStone = ring(18, 15, BIOME_WORLD_RADIUS - 25, [0.75, 1.3], 1.8)
    const grassA = ring(60, 5, BIOME_WORLD_RADIUS - 20, [0.8, 1.5], 0.1)

    return { firA, firB, deadTree, mysticStone, grassA }
  }, [biome])

  return (
    <group>
      <PropInstances id="prop.scatter.mysticStone" items={dressingConfigs.mysticStone} castShadow />
      <PropInstances id="prop.scatter.deadTree" items={dressingConfigs.deadTree} castShadow />

      {biome === 'grove' && <GroveLandmark onColliders={onColliders} />}

      {(biome === 'forest' || biome === 'jungle' || biome === 'valley' || biome === 'highland' || biome === 'tundra' || biome === 'grove') && (
        <>
          <PropInstances id="prop.scatter.firA" items={dressingConfigs.firA} castShadow />
          <PropInstances id="prop.scatter.firB" items={dressingConfigs.firB} castShadow />
        </>
      )}

      {(biome === 'forest' || biome === 'jungle' || biome === 'valley' || biome === 'coast' || biome === 'marsh' || biome === 'grove') && (
        <PropInstances id="prop.scatter.grassA" items={dressingConfigs.grassA} castShadow={false} />
      )}
    </group>
  )
}
