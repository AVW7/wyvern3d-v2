import { skyStateFor, SkyState } from '../../Sanctuary/atmosphere/palette'

export function mapSkyStateFor(tick: number): SkyState & { nightBoost: number } {
  const base = skyStateFor(tick)
  const isNight = base.bucket === 'night'
  const nightBoost = isNight ? 1.0 : base.bucket === 'dusk' || base.bucket === 'dawn' ? 0.5 : 0.0

  return {
    ...base,
    fogNear: 140,
    fogFar: 480,
    nightBoost,
  }
}
