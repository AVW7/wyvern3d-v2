import type { BiomePalette } from './biomePalettes'

export type WeatherType = 'clear' | 'fog' | 'rain' | 'snow' | 'ash' | 'wind' | 'storm'
export type WeatherParticleKind = 'none' | 'rain' | 'snow' | 'ash' | 'embers' | 'spores'

export interface WeatherProfile {
  type: WeatherType
  name: string
  description: string
  fogNearMult: number
  fogFarMult: number
  fogColorShift?: string
  sunIntensityMult: number
  hemiIntensityMult: number
  sunColor?: string
  windSpeed: number
  windGust: number
  particleKind: WeatherParticleKind
  particleCount: number
  accentColorShift?: string
}

export const WEATHER_PROFILES: Record<WeatherType, WeatherProfile> = {
  clear: {
    type: 'clear',
    name: 'Clear Sky',
    description: 'Calm conditions and peak natural visibility.',
    fogNearMult: 1.0,
    fogFarMult: 1.0,
    sunIntensityMult: 1.0,
    hemiIntensityMult: 1.0,
    windSpeed: 1.0,
    windGust: 1.5,
    particleKind: 'none',
    particleCount: 0,
  },
  fog: {
    type: 'fog',
    name: 'Dense Mist',
    description: 'Low-lying mist rolling through the terrain.',
    fogNearMult: 0.5,
    fogFarMult: 0.65,
    sunIntensityMult: 0.75,
    hemiIntensityMult: 0.85,
    windSpeed: 0.6,
    windGust: 1.0,
    particleKind: 'spores',
    particleCount: 80,
  },
  rain: {
    type: 'rain',
    name: 'Steady Rain',
    description: 'Continuous rainfall with overcast skies.',
    fogNearMult: 0.7,
    fogFarMult: 0.8,
    sunIntensityMult: 0.8,
    hemiIntensityMult: 0.9,
    windSpeed: 2.2,
    windGust: 3.5,
    particleKind: 'rain',
    particleCount: 320,
  },
  snow: {
    type: 'snow',
    name: 'Snowfall',
    description: 'Gentle snowfall with cold, diffusing light.',
    fogNearMult: 0.65,
    fogFarMult: 0.75,
    sunIntensityMult: 0.85,
    hemiIntensityMult: 0.95,
    windSpeed: 1.6,
    windGust: 2.8,
    particleKind: 'snow',
    particleCount: 240,
  },
  ash: {
    type: 'ash',
    name: 'Volcanic Ashfall',
    description: 'Drifting cinder particles and sulfurous haze.',
    fogNearMult: 0.6,
    fogFarMult: 0.7,
    sunIntensityMult: 0.7,
    hemiIntensityMult: 0.8,
    windSpeed: 1.8,
    windGust: 3.0,
    particleKind: 'ash',
    particleCount: 220,
  },
  wind: {
    type: 'wind',
    name: 'Highland Gale',
    description: 'Brisk wind currents carrying vegetation and dust.',
    fogNearMult: 0.9,
    fogFarMult: 0.95,
    sunIntensityMult: 1.0,
    hemiIntensityMult: 1.0,
    windSpeed: 3.5,
    windGust: 5.2,
    particleKind: 'spores',
    particleCount: 140,
  },
  storm: {
    type: 'storm',
    name: 'Thunderstorm',
    description: 'Turbulent weather with heavy precipitation and strong wind.',
    fogNearMult: 0.55,
    fogFarMult: 0.7,
    sunIntensityMult: 0.6,
    hemiIntensityMult: 0.75,
    windSpeed: 4.2,
    windGust: 6.5,
    particleKind: 'rain',
    particleCount: 450,
  },
}

export const BIOME_WEATHER_MATRIX: Record<string, WeatherType[]> = {
  valley: ['clear', 'wind', 'fog', 'rain'],
  forest: ['clear', 'rain', 'fog', 'wind'],
  coast: ['clear', 'wind', 'rain', 'storm'],
  marsh: ['rain', 'fog', 'storm', 'clear'],
  moor: ['fog', 'wind', 'rain', 'clear'],
  swamp: ['fog', 'rain', 'storm', 'clear'],
  mountain: ['wind', 'clear', 'storm', 'snow'],
  highland: ['wind', 'clear', 'rain', 'fog'],
  cavern: ['fog', 'clear', 'wind'],
  jungle: ['rain', 'storm', 'fog', 'clear'],
  grove: ['clear', 'wind', 'fog', 'rain'],
  ashland: ['ash', 'fog', 'storm', 'wind'],
  tundra: ['snow', 'wind', 'clear', 'fog'],
  barrens: ['wind', 'clear', 'storm', 'fog'],
  spire: ['wind', 'storm', 'clear', 'fog'],
}

/** Minimum allowable fog distance to guarantee landmark contrast and fair navigation. */
export const MIN_FOG_FAR_FLOOR = 140

/**
 * Returns deterministic daily weather for a given region.
 * Weather updates once per in-game day (every 24 ticks).
 */
export function getDeterministicRegionWeather(
  biome: string,
  regionId: string,
  dayOrTick: number = 0,
  seed = 42,
): WeatherType {
  const options = BIOME_WEATHER_MATRIX[biome] ?? ['clear', 'wind']
  const day = Math.floor(dayOrTick / 24)

  let hash = seed + day * 1337
  for (let i = 0; i < regionId.length; i++) {
    hash = (hash * 31 + regionId.charCodeAt(i)) >>> 0
  }

  const idx = Math.abs(hash) % options.length
  return options[idx]!
}

/**
 * Blends a base biome palette with an active weather profile while enforcing visibility floors.
 */
export function getEffectiveWeatherPalette(
  basePalette: BiomePalette,
  weather: WeatherProfile,
): BiomePalette {
  const rawFogFar = basePalette.fogFar * weather.fogFarMult
  const effectiveFogFar = Math.max(MIN_FOG_FAR_FLOOR, rawFogFar)
  const effectiveFogNear = Math.min(
    effectiveFogFar - 20,
    Math.max(10, basePalette.fogNear * weather.fogNearMult),
  )

  return {
    ...basePalette,
    fogNear: effectiveFogNear,
    fogFar: effectiveFogFar,
    sunIntensity: basePalette.sunIntensity * weather.sunIntensityMult,
    hemiIntensity: basePalette.hemiIntensity * weather.hemiIntensityMult,
    sunColor: weather.sunColor ?? basePalette.sunColor,
    fogColor: weather.fogColorShift ?? basePalette.fogColor,
    accentColor: weather.accentColorShift ?? basePalette.accentColor,
  }
}
