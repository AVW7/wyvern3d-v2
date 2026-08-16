import { describe, expect, it } from 'vitest'

import {
  canReuseLoopAction,
  normalizedPlaybackPhase,
  resolveClipSpec,
  resolvePlantSpec,
  shouldApplyNext,
} from './gameModelPlayback'
import { ASSETS } from './manifest'
import type { ClipSpec, ModelState } from './manifest'

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

  it('plants an action-channel tell on the base state it interrupts', () => {
    const idle: ClipSpec = { clip: 'idle', yOffset: 152.89 }
    const tell: ClipSpec = { clip: 'breath', loop: false, yOffset: 0 }
    expect(resolvePlantSpec(tell, idle, true)).toBe(idle)
    // Requested as an ordinary base state, a tell still plants on its own pose.
    expect(resolvePlantSpec(tell, tell, false)).toBe(tell)
    // A base state with no manifest entry leaves the tell as the only offset.
    expect(resolvePlantSpec(tell, undefined, true)).toBe(tell)
  })
})

/**
 * The pop this closes, in the numbers that caused it.
 *
 * `GameModel` positions the model from the planting spec's `yOffset`, and both
 * tells carry 0 while the grounded loops carry a real measured drop. Sourcing
 * that from the *playing* spec meant a grounded wyvern translated the moment it
 * bit or breathed, and back when the tell cleared.
 */
describe('action-channel tells do not translate the model', () => {
  const WYVERN = ASSETS['wyvern.mirefang']!
  const offsetOf = (state: ModelState): number => {
    const spec = resolveClipSpec(WYVERN.animations?.[state], 0)
    return spec?.yOffset ?? WYVERN.yOffset ?? 0
  }

  const GROUNDED: ModelState[] = ['idle', 'walk', 'rest']
  const TELLS: ModelState[] = ['attack', 'attackAir', 'breathe', 'breatheAir']

  it('still has tells whose own offset differs from every grounded loop', () => {
    // If this ever stops being true the inheritance is harmless rather than
    // load-bearing, and this suite should be re-read rather than deleted.
    for (const tell of TELLS) {
      for (const base of GROUNDED) {
        expect(offsetOf(tell)).not.toBe(offsetOf(base))
      }
    }
  })

  it.each(TELLS)('%s inherits each grounded loop it can interrupt', (tell) => {
    const tellSpec = resolveClipSpec(WYVERN.animations?.[tell], 0)
    for (const base of GROUNDED) {
      const baseSpec = resolveClipSpec(WYVERN.animations?.[base], 0)
      const planted = resolvePlantSpec(tellSpec, baseSpec, true)
      expect(
        planted?.yOffset,
        `${tell} over ${base} must not move the model`,
      ).toBe(offsetOf(base))
    }
  })

  it('leaves an airborne tell at the airborne plant of zero', () => {
    const tellSpec = resolveClipSpec(WYVERN.animations?.breatheAir, 0)
    const cruise = resolveClipSpec(WYVERN.animations?.cruise, 0)
    expect(resolvePlantSpec(tellSpec, cruise, true)?.yOffset).toBe(0)
  })
})
