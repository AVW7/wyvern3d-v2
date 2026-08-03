import { describe, expect, it, beforeEach } from 'vitest'
import { usePlayerControlStore } from './playerControlStore'

describe('playerControlStore', () => {
  beforeEach(() => {
    usePlayerControlStore.setState({
      controlMode: 'human',
      activeWyvernId: null,
    })
  })

  it('starts in human mode with no active wyvern', () => {
    const state = usePlayerControlStore.getState()
    expect(state.controlMode).toBe('human')
    expect(state.activeWyvernId).toBeNull()
  })

  it('shifts to wyvern mode with specified id', () => {
    usePlayerControlStore.getState().shiftToWyvern('wyvern-1')
    const state = usePlayerControlStore.getState()
    expect(state.controlMode).toBe('wyvern')
    expect(state.activeWyvernId).toBe('wyvern-1')
  })

  it('shifts back to human mode', () => {
    usePlayerControlStore.getState().shiftToWyvern('wyvern-1')
    usePlayerControlStore.getState().shiftToHuman()
    const state = usePlayerControlStore.getState()
    expect(state.controlMode).toBe('human')
  })

  it('toggles shift between human and wyvern using available wyverns', () => {
    usePlayerControlStore.getState().toggleShift(['w-1', 'w-2'])
    let state = usePlayerControlStore.getState()
    expect(state.controlMode).toBe('wyvern')
    expect(state.activeWyvernId).toBe('w-1')

    usePlayerControlStore.getState().toggleShift(['w-1', 'w-2'])
    state = usePlayerControlStore.getState()
    expect(state.controlMode).toBe('human')
  })
})
