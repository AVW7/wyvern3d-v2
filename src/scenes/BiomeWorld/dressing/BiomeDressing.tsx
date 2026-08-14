'use client'

import { Component, useMemo, type ReactNode } from 'react'
import { BIOME_DRESSING, layerAtlas, type BiomeLayer } from '@/render/assets/biomeLibrary'
import { PropInstances } from '@/render/assets/props'
import type { Collider } from '@/render/controllers/CharacterController'
import { biomeHeightAt } from '../terrain/BiomeTerrain'
import { scatterBiome } from './biomeScatter'
import { GroveLandmark } from './GroveLandmark'

/**
 * The biome atlas is a generated file (scripts/build-biome-atlas.mjs) and an
 * unlicensed source is deliberately withheld from it, so it can legitimately be
 * absent. Without this the whole canvas would die on a 404 from useGLTF; with
 * it, a missing atlas costs the scatter and nothing else.
 */
class BiomePropsBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  override render() {
    return this.state.failed ? null : this.props.children
  }
}

interface BiomeDressingProps {
  biome: string
  /** Receives the grove landmark's measured footprint once its model loads. */
  onColliders?: (colliders: Collider[]) => void
}

export function BiomeDressing({ biome, onColliders }: BiomeDressingProps) {
  const layers: BiomeLayer[] = BIOME_DRESSING[biome] ?? []

  const placements = useMemo(
    () =>
      scatterBiome(layers, {
        heightAt: (x, z) => biomeHeightAt(biome, x, z),
        // The grove keeps its middle clear: the world tree and its stone ring
        // own everything inside 32 m.
        clearing: biome === 'grove' ? 32 : 0,
      }),
    [biome, layers],
  )

  return (
    <group>
      {biome === 'grove' && <GroveLandmark onColliders={onColliders} />}

      <BiomePropsBoundary>
        {layers.map((layer, index) => (
          <PropInstances
            key={`${layer.prop}:${index}`}
            id={layer.prop}
            atlas={layerAtlas(layer)}
            items={placements[index] ?? []}
            castShadow={layer.castShadow ?? true}
            color={layer.color}
            wind={layer.wind}
          />
        ))}
      </BiomePropsBoundary>
    </group>
  )
}
