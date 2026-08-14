import { describe, expect, it } from 'vitest'
import {
  BIOME_WEATHER_MATRIX,
  WEATHER_PROFILES,
  getDeterministicRegionWeather,
  getEffectiveWeatherPalette,
  MIN_FOG_FAR_FLOOR,
  type WeatherType,
} from './biomeWeather'
import { BIOME_PALETTES } from './biomePalettes'
import { createInitialState } from '@/core/state/game'

const ALL_BIOMES = Object.keys(BIOME_PALETTES)

describe('Biome Enhancement Stage 3: Weather and Environmental Dynamics', () => {
  it('ensures every biome has at least 2 distinct weather options', () => {
    for (const biome of ALL_BIOMES) {
      const weatherList = BIOME_WEATHER_MATRIX[biome]
      expect(weatherList).toBeDefined()
      expect(weatherList!.length).toBeGreaterThanOrEqual(2)
      for (const w of weatherList!) {
        expect(WEATHER_PROFILES[w]).toBeDefined()
      }
    }
  })

  it('ensures all weather profiles have valid positive parameters', () => {
    const weatherKeys = Object.keys(WEATHER_PROFILES) as WeatherType[]
    for (const key of weatherKeys) {
      const p = WEATHER_PROFILES[key]
      expect(p.fogNearMult).toBeGreaterThan(0)
      expect(p.fogFarMult).toBeGreaterThan(0)
      expect(p.sunIntensityMult).toBeGreaterThan(0)
      expect(p.hemiIntensityMult).toBeGreaterThan(0)
      expect(p.windSpeed).toBeGreaterThan(0)
      expect(p.particleCount).toBeGreaterThanOrEqual(0)
      expect(p.particleCount).toBeLessThanOrEqual(500)
    }
  })

  it('selects weather deterministically from seed, regionId, and day', () => {
    const w1 = getDeterministicRegionWeather('forest', 'hearthvale', 0, 42)
    const w2 = getDeterministicRegionWeather('forest', 'hearthvale', 0, 42)
    expect(w1).toBe(w2)

    // Tick within same day (tick 12 is still day 0) produces identical weather
    const wIntraDay = getDeterministicRegionWeather('forest', 'hearthvale', 12, 42)
    expect(wIntraDay).toBe(w1)

    // Check multiple days to verify rotation
    const dailyWeathers = new Set<WeatherType>()
    for (let day = 0; day < 20; day++) {
      dailyWeathers.add(getDeterministicRegionWeather('forest', 'hearthvale', day * 24, 42))
    }
    expect(dailyWeathers.size).toBeGreaterThanOrEqual(2)
  })

  it('enforces visibility floor so fogFar is never less than MIN_FOG_FAR_FLOOR', () => {
    for (const biome of ALL_BIOMES) {
      const base = BIOME_PALETTES[biome]!
      for (const weatherKey of Object.keys(WEATHER_PROFILES) as WeatherType[]) {
        const profile = WEATHER_PROFILES[weatherKey]
        const blended = getEffectiveWeatherPalette(base, profile)

        expect(blended.fogFar).toBeGreaterThanOrEqual(MIN_FOG_FAR_FLOOR)
        expect(blended.fogNear).toBeLessThan(blended.fogFar)
        expect(blended.fogNear).toBeGreaterThanOrEqual(10)
        expect(blended.sunIntensity).toBeGreaterThan(0)
        expect(blended.hemiIntensity).toBeGreaterThan(0)
      }
    }
  })

  it('never mutates GameState or core simulation variables', () => {
    const state = createInitialState(100)
    const rngBefore = state.rngState
    const tickBefore = state.tick
    const resourcesBefore = { ...state.resources }

    const weather = getDeterministicRegionWeather('ashland', 'cinderpeaks', state.tick, state.seed)
    const palette = getEffectiveWeatherPalette(BIOME_PALETTES.ashland!, WEATHER_PROFILES[weather])

    expect(palette).toBeDefined()
    expect(state.rngState).toBe(rngBefore)
    expect(state.tick).toBe(tickBefore)
    expect(state.resources).toEqual(resourcesBefore)
  })
})
