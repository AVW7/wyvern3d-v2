import { describe, expect, it } from 'vitest'
import { createInitialState } from '../state/game'
import { regionVisibility, visibilityMap } from './visibility'

describe('regionVisibility', () => {
  it('fresh state maps Hearthvale as held, its 5 neighbors as frontier, and Duskspire as rumoured', () => {
    const state = createInitialState(1)
    expect(regionVisibility(state, 'hearthvale')).toBe('held')
    expect(regionVisibility(state, 'ashfen')).toBe('frontier')
    expect(regionVisibility(state, 'duskspire')).toBe('rumoured')
  })

  it('taking Ashfen promotes Emberwaste from rumoured to known/frontier', () => {
    const state = createInitialState(1)
    if (state.regions['ashfen']) {
      state.regions['ashfen'].owner = 'player'
    }
    const vis = regionVisibility(state, 'emberwaste')
    expect(vis).not.toBe('rumoured')
  })

  it('visibilityMap produces entries for all 22 regions', () => {
    const state = createInitialState(1)
    const map = visibilityMap(state)
    expect(Object.keys(map).length).toBe(22)
  })
})
