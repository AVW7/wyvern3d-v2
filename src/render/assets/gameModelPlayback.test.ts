import { describe, expect, it } from 'vitest'

import {
  canReuseLoopAction,
  normalizedPlaybackPhase,
  resolveClipSpec,
  shouldApplyNext,
} from './gameModelPlayback'

describe('GameModel playback helpers', () => {
  it('resolves deterministic clip pools for positive, negative, and invalid seeds', () => {
    const pool = [{ clip: 'a' }, { clip: 'b' }, { clip: 'c' }]
    expect(resolveClipSpec(pool, 4)?.clip).toBe('b')
    expect(resolveClipSpec(pool, -4)?.clip).toBe('b')
    expect(resolveClipSpec(pool, Number.NaN)?.clip).toBe('a')
    expect(resolveClipSpec([], 1)).toBeUndefined()
  })

  it('preserves normalized loop phase and wraps negative action time', () => {
    expect(normalizedPlaybackPhase(1.5, 3)).toBe(0.5)
    expect(normalizedPlaybackPhase(4.5, 3)).toBe(0.5)
    expect(normalizedPlaybackPhase(-0.75, 3)).toBe(0.75)
    expect(normalizedPlaybackPhase(1, 0)).toBeNull()
  })

  it('rejects a stale next transition after gameplay requests another state', () => {
    expect(shouldApplyNext('fly', 'fly')).toBe(true)
    expect(shouldApplyNext('land', 'fly')).toBe(false)
  })

  it('does not reuse a command action as a base loop without restoring playback mode', () => {
    expect(canReuseLoopAction(false, false, 'flight', 'flight')).toBe(true)
    expect(canReuseLoopAction(true, false, 'flight', 'flight')).toBe(false)
    expect(canReuseLoopAction(false, true, 'flight', 'flight')).toBe(false)
  })
})
