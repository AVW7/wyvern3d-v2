import { describe, expect, it, beforeEach } from 'vitest'
import { useMapUiStore } from './mapUiStore'

describe('mapUiStore', () => {
  beforeEach(() => {
    useMapUiStore.getState().clear()
  })

  it('updates hovered and inspected', () => {
    const store = useMapUiStore.getState()
    expect(store.hovered).toBeNull()

    store.setHovered('ashfen')
    expect(useMapUiStore.getState().hovered).toBe('ashfen')

    store.setInspected('ashfen')
    expect(useMapUiStore.getState().inspected).toBe('ashfen')
  })

  it('no-ops when setting identical values', () => {
    useMapUiStore.getState().setHovered('hearthvale')
    const state1 = useMapUiStore.getState()
    useMapUiStore.getState().setHovered('hearthvale')
    const state2 = useMapUiStore.getState()
    expect(state1).toBe(state2)
  })

  it('manages atlas drawer open state', () => {
    const store = useMapUiStore.getState()
    expect(store.atlasOpen).toBe(false)

    store.toggleAtlas()
    expect(useMapUiStore.getState().atlasOpen).toBe(true)

    // Same-value set is a no-op
    const state1 = useMapUiStore.getState()
    useMapUiStore.getState().setAtlasOpen(true)
    expect(useMapUiStore.getState()).toBe(state1)

    useMapUiStore.getState().setAtlasOpen(false)
    expect(useMapUiStore.getState().atlasOpen).toBe(false)
  })

  it('clear() also closes the atlas drawer', () => {
    useMapUiStore.getState().toggleAtlas()
    useMapUiStore.getState().clear()
    expect(useMapUiStore.getState().atlasOpen).toBe(false)
  })
})
