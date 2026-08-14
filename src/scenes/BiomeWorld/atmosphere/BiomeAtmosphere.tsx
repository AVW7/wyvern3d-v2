'use client'

import { useMemo } from 'react'
import { getBiomePalette } from './biomePalettes'
import {
  WEATHER_PROFILES,
  getDeterministicRegionWeather,
  getEffectiveWeatherPalette,
  type WeatherType,
} from './biomeWeather'
import { BiomeWeatherParticles } from './BiomeWeatherParticles'

interface BiomeAtmosphereProps {
  biome: string
  regionId: string
  seed?: number
  tick?: number
  weatherOverride?: WeatherType | null
}

export function BiomeAtmosphere({
  biome,
  regionId,
  seed = 42,
  tick = 0,
  weatherOverride = null,
}: BiomeAtmosphereProps) {
  const activeWeatherType = useMemo(
    () => weatherOverride ?? getDeterministicRegionWeather(biome, regionId, tick, seed),
    [biome, regionId, tick, seed, weatherOverride],
  )

  const weatherProfile = WEATHER_PROFILES[activeWeatherType] ?? WEATHER_PROFILES.clear
  const basePalette = useMemo(() => getBiomePalette(biome), [biome])
  const effectivePalette = useMemo(
    () => getEffectiveWeatherPalette(basePalette, weatherProfile),
    [basePalette, weatherProfile],
  )

  return (
    <>
      {/* Dynamic Hemisphere Ambient Light */}
      <hemisphereLight
        args={[
          effectivePalette.hemiSky,
          effectivePalette.hemiGround,
          effectivePalette.hemiIntensity,
        ]}
      />

      {/* Sun / Key Light */}
      <directionalLight
        position={effectivePalette.sunPosition}
        intensity={effectivePalette.sunIntensity}
        color={effectivePalette.sunColor}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-120}
        shadow-camera-right={120}
        shadow-camera-top={120}
        shadow-camera-bottom={-120}
      />

      {/* Depth Fog */}
      <fog
        attach="fog"
        args={[effectivePalette.fogColor, effectivePalette.fogNear, effectivePalette.fogFar]}
      />

      {/* Background Clear Color */}
      <color attach="background" args={[effectivePalette.background]} />

      {/* Ambient Weather Particle Cloud */}
      <BiomeWeatherParticles
        kind={weatherProfile.particleKind}
        count={weatherProfile.particleCount}
        windSpeed={weatherProfile.windSpeed}
      />
    </>
  )
}
