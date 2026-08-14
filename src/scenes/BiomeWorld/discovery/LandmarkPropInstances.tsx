'use client'

import { useMemo } from 'react'
import { PropInstances } from '@/render/assets/props'
import { biomeHeightAt } from '../terrain/BiomeTerrain'
import { getRegionLandmarkProps, landmarkDrawPlacements } from './landmarkProps'

/**
 * Authored landmark props for a biome region (Biome Enhancement Stage 1).
 *
 * Draws one approved atlas prop per authored landmark at its discovery
 * anchor — so the landmark you survey is the silhouette you walked up to.
 * Draws through the same instanced atlas path as scatter, so landmarks ride
 * the existing atlas cache and degrade gracefully when the atlas is missing
 * (the enclosing BiomePropsBoundary in BiomeDressing covers that case).
 */
export function LandmarkPropInstances({ biome, regionId, seed = 42 }: { biome: string; regionId?: string; seed?: number }) {
  const groups = useMemo(() => {
    if (!regionId) return []
    const plan = getRegionLandmarkProps(regionId, seed)
    return landmarkDrawPlacements(plan, (x, z) => biomeHeightAt(biome, x, z, regionId, seed))
  }, [biome, regionId, seed])

  if (groups.length === 0) return null

  return (
    <group>
      {groups.map(({ propId, items }) => (
        <PropInstances key={propId} id={propId} items={items} castShadow />
      ))}
    </group>
  )
}
