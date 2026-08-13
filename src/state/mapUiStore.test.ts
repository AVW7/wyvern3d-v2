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
})
