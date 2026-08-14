import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SANCTUARY_COLORS, useSanctuaryColors } from './sanctuaryColorsStore'

describe('sanctuary colours', () => {
  afterEach(() => {
    useSanctuaryColors.getState().reset()
    Reflect.deleteProperty(globalThis, 'window')
    vi.resetModules()
  })

  it('defaults the ground, soil and roost palette', () => {
    expect(useSanctuaryColors.getState().grass).toBe(DEFAULT_SANCTUARY_COLORS.grass)
    expect(useSanctuaryColors.getState().soil).toBe(DEFAULT_SANCTUARY_COLORS.soil)
    expect(useSanctuaryColors.getState().roost).toBe(DEFAULT_SANCTUARY_COLORS.roost)
  })

  it('recolours one channel without disturbing the others', () => {
    useSanctuaryColors.getState().setGrass('#123456')
    expect(useSanctuaryColors.getState().grass).toBe('#123456')
    expect(useSanctuaryColors.getState().soil).toBe(DEFAULT_SANCTUARY_COLORS.soil)
  })

  it('starts on the defaults even when a palette is already stored', async () => {
    // The client's first render has to match the server HTML: seeding this at
    // module init is the hydration mismatch modelLibraryStore shipped with.
    // useSanctuaryColorsHydration applies the stored palette after mount.
    const stored = JSON.stringify({ grass: '#ff0000' })
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: { getItem: () => stored, setItem: () => {} } },
    })

    vi.resetModules()
    const module = await import('./sanctuaryColorsStore')

    expect(module.useSanctuaryColors.getState().grass).toBe(DEFAULT_SANCTUARY_COLORS.grass)
    expect(typeof module.useSanctuaryColorsHydration).toBe('function')
  })
})
