'use client'

import { useMemo, useEffect } from 'react'
import { PlaneGeometry } from 'three'
import { getBiomePalette } from '../atmosphere/biomePalettes'
import { BIOME_WORLD_RADIUS, surfaceHeight } from './biomeHeight'

export { BIOME_WORLD_RADIUS, GROVE_MOUND_HEIGHT, biomeHeightAt } from './biomeHeight'

interface BiomeTerrainProps {
  biome: string
}

export function BiomeTerrain({ biome }: BiomeTerrainProps) {
  const palette = useMemo(() => getBiomePalette(biome), [biome])

  const geometry = useMemo(() => {
    const ground = new PlaneGeometry(BIOME_WORLD_RADIUS * 2, BIOME_WORLD_RADIUS * 2, 48, 48)
    const positions = ground.attributes.position!

    for (let i = 0; i < positions.count; i += 1) {
      positions.setZ(i, surfaceHeight(biome, positions.getX(i), positions.getY(i)))
    }

    positions.needsUpdate = true
    ground.computeVertexNormals()
    return ground
  }, [biome])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <group>
      {/* Main Ground Mesh */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={geometry} receiveShadow castShadow>
        <meshStandardMaterial color={palette.groundColor} roughness={0.85} />
      </mesh>

      {/* Sea / Liquid Plane for Coast and Marsh biomes */}
      {biome === 'coast' && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]} receiveShadow>
          <planeGeometry args={[BIOME_WORLD_RADIUS * 2.4, BIOME_WORLD_RADIUS * 2.4]} />
          <meshStandardMaterial color="#1e40af" roughness={0.2} metalness={0.8} transparent opacity={0.8} />
        </mesh>
      )}

      {(biome === 'marsh' || biome === 'swamp') && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]} receiveShadow>
          <planeGeometry args={[BIOME_WORLD_RADIUS * 2, BIOME_WORLD_RADIUS * 2]} />
          <meshStandardMaterial color="#14532d" roughness={0.4} transparent opacity={0.6} />
        </mesh>
      )}

      {biome === 'ashland' && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
          <planeGeometry args={[BIOME_WORLD_RADIUS * 2, BIOME_WORLD_RADIUS * 2]} />
          <meshStandardMaterial color="#ea580c" emissive="#c2410c" emissiveIntensity={0.6} roughness={0.3} />
        </mesh>
      )}
    </group>
  )
}
