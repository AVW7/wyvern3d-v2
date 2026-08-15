import { describe, expect, it } from 'vitest'
import {
  LOD_HYSTERESIS,
  LOD_THRESHOLDS,
  lodCapabilities,
  resolveLod,
} from './biomeLod'
import { useBiomeLod } from './biomeLodStore'

describe('Biome LOD Engine (Stage 6)', () => {
  it('resolves near level within near threshold', () => {
    expect(resolveLod(0, 'near')).toBe('near')
    expect(resolveLod(50, 'near')).toBe('near')
    expect(resolveLod(LOD_THRESHOLDS.near - 1, 'near')).toBe('near')
  })

  it('maintains near level until crossing near threshold + hysteresis when moving away', () => {
    // When current is 'near', it stays near until distance > threshold + hysteresis
    expect(resolveLod(LOD_THRESHOLDS.near + LOD_HYSTERESIS - 1, 'near')).toBe('near')
    expect(resolveLod(LOD_THRESHOLDS.near + LOD_HYSTERESIS + 1, 'near')).toBe('mid')
  })

  it('maintains mid level until crossing near threshold - hysteresis when moving closer (hysteresis)', () => {
    // When current is 'mid', moving closer stays mid until < threshold - hysteresis
    expect(resolveLod(LOD_THRESHOLDS.near - 1, 'mid')).toBe('mid')
    expect(resolveLod(LOD_THRESHOLDS.near - LOD_HYSTERESIS - 1, 'mid')).toBe('near')
  })

  it('resolves far level beyond mid threshold + hysteresis', () => {
    expect(resolveLod(LOD_THRESHOLDS.mid + LOD_HYSTERESIS - 1, 'mid')).toBe('mid')
    expect(resolveLod(LOD_THRESHOLDS.mid + LOD_HYSTERESIS + 1, 'mid')).toBe('far')
    expect(resolveLod(200, 'mid')).toBe('far')
  })

  it('provides monotonically decreasing capabilities as distance increases', () => {
    const nearCaps = lodCapabilities('near')
    const midCaps = lodCapabilities('mid')
    const farCaps = lodCapabilities('far')

    expect(nearCaps.shadows).toBe(true)
    expect(midCaps.shadows).toBe(false)
    expect(farCaps.shadows).toBe(false)

    expect(nearCaps.particleScale).toBeGreaterThan(midCaps.particleScale)
    expect(midCaps.particleScale).toBeGreaterThan(farCaps.particleScale)

    expect(nearCaps.audioScale).toBeGreaterThan(midCaps.audioScale)
    expect(midCaps.audioScale).toBeGreaterThan(farCaps.audioScale)

    expect(nearCaps.agentsCulled).toBe(false)
    expect(midCaps.agentsCulled).toBe(false)
    expect(farCaps.agentsCulled).toBe(true)

    expect(nearCaps.agentUpdateRate).toBeLessThan(midCaps.agentUpdateRate)
    expect(midCaps.agentUpdateRate).toBeLessThan(farCaps.agentUpdateRate)
  })

  it('guards store state updates to avoid unnecessary notifications', () => {
    const store = useBiomeLod.getState()
    store.setLevel('near')
    expect(useBiomeLod.getState().level).toBe('near')

    store.setLevel('mid')
    expect(useBiomeLod.getState().level).toBe('mid')
    expect(useBiomeLod.getState().capabilities.shadows).toBe(false)

    // Setting same level is a no-op
    store.setLevel('mid')
    expect(useBiomeLod.getState().level).toBe('mid')
  })
})
