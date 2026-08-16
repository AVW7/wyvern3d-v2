'use client'

import { useMemo, useEffect } from 'react'
import { PlaneGeometry } from 'three'
import { getBiomePalette } from '../atmosphere/biomePalettes'
import {
  WEATHER_PROFILES,
  getEffectiveWeatherPalette,
  type WeatherType,
} from '../atmosphere/biomeWeather'
import { BIOME_WORLD_RADIUS, surfaceHeight } from './biomeHeight'
import { getRegionWaterBody } from './biomeWater'
import { BiomeWaterSurface } from './BiomeWaterSurface'

export { BIOME_WORLD_RADIUS, GROVE_MOUND_HEIGHT, biomeHeightAt } from './biomeHeight'

interface BiomeTerrainProps {
  biome: string
  regionId?: string
  seed?: number
  /** Active deterministic weather, shared with the atmosphere so water fog matches. */
  weather?: WeatherType
}

export function BiomeTerrain({ biome, regionId, seed = 42, weather }: BiomeTerrainProps) {
  const palette = useMemo(() => getBiomePalette(biome), [biome])

  const geometry = useMemo(() => {
    const ground = new PlaneGeometry(BIOME_WORLD_RADIUS * 2, BIOME_WORLD_RADIUS * 2, 48, 48)
    const positions = ground.attributes.position!

    for (let i = 0; i < positions.count; i += 1) {
      positions.setZ(i, surfaceHeight(biome, positions.getX(i), positions.getY(i), regionId, seed))
    }

    positions.needsUpdate = true
    ground.computeVertexNormals()
    return ground
  }, [biome, regionId, seed])

  useEffect(() => () => geometry.dispose(), [geometry])

  const water = useMemo(
    () => getRegionWaterBody(biome, regionId, seed),
    [biome, regionId, seed],
  )

  const waterPalette = useMemo(() => {
    if (!water) return null
    const profile = weather ? WEATHER_PROFILES[weather] ?? WEATHER_PROFILES.clear : WEATHER_PROFILES.clear
    return getEffectiveWeatherPalette(palette, profile)
  }, [water, weather, palette])

  const windSpeed = weather ? (WEATHER_PROFILES[weather] ?? WEATHER_PROFILES.clear).windSpeed : 1

  return (
    <group>
      {/* Main Ground Mesh */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={geometry} receiveShadow castShadow>
        <meshStandardMaterial color={palette.groundColor} roughness={0.85} />
      </mesh>

      {/* Animated sea / bog / lava surface for water biomes */}
      {water && waterPalette && (
        <BiomeWaterSurface
          body={water}
          biome={biome}
          regionId={regionId}
          seed={seed}
          radius={BIOME_WORLD_RADIUS * water.extent}
          palette={waterPalette}
          windSpeed={windSpeed}
        />
      )}
    </group>
  )
}
