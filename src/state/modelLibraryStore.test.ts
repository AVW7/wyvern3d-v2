import { afterEach, describe, expect, it, vi } from 'vitest'
import { useModelLibraryStore } from './modelLibraryStore'

describe('model library preferences', () => {
  afterEach(() => useModelLibraryStore.getState().reset())

  it('enables finished assets by default', () => {
    expect(useModelLibraryStore.getState().isEnabled('character.player')).toBe(true)
  })

  it('can switch a logical model to its gameplay fallback and restore it', () => {
    useModelLibraryStore.getState().setEnabled('wyvern.emberback', false)
    expect(useModelLibraryStore.getState().isEnabled('wyvern.emberback')).toBe(false)

    useModelLibraryStore.getState().setEnabled('wyvern.emberback', true)
    expect(useModelLibraryStore.getState().isEnabled('wyvern.emberback')).toBe(true)
  })
})

describe('model library hydration', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'window')
    vi.resetModules()
  })

  it('starts empty even when a preference is already stored', async () => {
    // /models is server-rendered and prints a model's readiness as text, so
    // seeding this at module init made the client's first render disagree with
    // the server HTML and threw a hydration error. The stored value is applied
    // by useModelLibraryHydration after mount instead.
    const stored = JSON.stringify({ 'wyvern.emberback': true })
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: { getItem: () => stored, setItem: () => {} } },
    })

    vi.resetModules()
    const module = await import('./modelLibraryStore')

    expect(module.useModelLibraryStore.getState().disabled).toEqual({})
    expect(module.useModelLibraryStore.getState().isEnabled('wyvern.emberback')).toBe(true)
    expect(typeof module.useModelLibraryHydration).toBe('function')
  })
})
