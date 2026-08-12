import { afterEach, describe, expect, it } from 'vitest'
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
