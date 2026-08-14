'use client'

import { Component, useMemo, type ReactNode } from 'react'
import { BIOME_DRESSING, layerAtlas, type BiomeLayer } from '@/render/assets/biomeLibrary'
import { PropInstances } from '@/render/assets/props'
import type { Collider } from '@/render/controllers/CharacterController'
import { biomeHeightAt } from '../terrain/BiomeTerrain'
import { scatterBiome } from './biomeScatter'
import { GroveLandmark } from './GroveLandmark'
import { LandmarkPropInstances } from '../discovery/LandmarkPropInstances'
import { filterScatterNearLandmarks, getRegionLandmarkProps } from '../discovery/landmarkProps'

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
  regionId?: string
  seed?: number
  /** Receives the grove landmark's measured footprint once its model loads. */
  onColliders?: (colliders: Collider[]) => void
}

export function BiomeDressing({ biome, regionId, seed = 42, onColliders }: BiomeDressingProps) {
  const layers: BiomeLayer[] = BIOME_DRESSING[biome] ?? []
  // Landmark props share the discovery anchors; their approach rings must
  // stay readable, so scatter never lands inside them.
  const landmarkPlan = useMemo(
    () => (regionId ? getRegionLandmarkProps(regionId, seed) : []),
    [regionId, seed],
  )

  const placements = useMemo(
    () =>
      scatterBiome(layers, {
        heightAt: (x, z) => biomeHeightAt(biome, x, z, regionId, seed),
        // The grove keeps its middle clear: the world tree and its stone ring
        // own everything inside 32 m.
        clearing: biome === 'grove' ? 32 : 0,
        regionId,
        seed,
      }).map((layerPlacements) =>
        filterScatterNearLandmarks(layerPlacements, landmarkPlan),
      ),
    [biome, layers, regionId, seed, landmarkPlan],
  )

  return (
    <group>
      {biome === 'grove' && <GroveLandmark onColliders={onColliders} />}

      <BiomePropsBoundary>
        <LandmarkPropInstances biome={biome} regionId={regionId} seed={seed} />
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
