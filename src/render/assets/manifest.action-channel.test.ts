import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { ASSETS } from './manifest'
import type { ClipSpec, ModelState } from './manifest'

/**
 * The action channel is one-shot only, and nothing enforces it at the type
 * level.
 *
 * `GameModel` emits `onActionFinished` for `loop: false` specs alone, and that
 * callback is the only thing that clears a tell — every caller
 * (`BattleScene`, the sanctuary director) drops its action when the token comes
 * back. A looping spec never reports finished, so the tell plays forever, the
 * base locomotion state stays overridden, and anything reading
 * `action?.state` latches on. `breathe` shipped that way: `BreathVFX` restarts
 * its burst for as long as `action?.state === 'breathe'`, so one breath attack
 * left the fire running permanently.
 */
const ACTION_STATES: ModelState[] = ['attack', 'attackAir', 'breathe']

/**
 * Only assets that actually load a model.
 *
 * A `url: null` entry falls back to the procedural placeholder and never
 * reaches a mixer, so its animations map is inert. The unit entries are in that
 * state today, and their `attack` is deliberately left looping: `attack` is
 * legitimate as a *base* state, where looping is what you want, and only
 * becomes a one-shot when it is dispatched through the action channel. Wiring a
 * real unit model is what would bring those specs under this rule.
 */
function specsFor(state: ModelState): { entry: string; spec: ClipSpec }[] {
  const out: { entry: string; spec: ClipSpec }[] = []
  for (const [entry, asset] of Object.entries(ASSETS)) {
    if (!asset.url) continue
    const spec = asset.animations?.[state]
    if (!spec) continue
    for (const one of Array.isArray(spec) ? spec : [spec]) out.push({ entry, spec: one })
  }
  return out
}

describe('action-channel clip specs', () => {
  it.each(ACTION_STATES)('%s is a one-shot in every asset that defines it', (state) => {
    const specs = specsFor(state)
    expect(specs.length).toBeGreaterThan(0)
    for (const { entry, spec } of specs) {
      expect(
        spec.loop,
        `${entry}.${state} must set loop:false — a looping action-channel spec ` +
          'never emits onActionFinished, so the tell can never be cleared',
      ).toBe(false)
    }
  })

  it('is the complete list of states the action channel plays', () => {
    // Guards the list above against drift: a new setAction/startAction call
    // site introduces a state that has to be one-shot too.
    const sources = [
      '../../scenes/Battle/BattleScene.tsx',
      '../../scenes/Sanctuary/director/wyvernDirector.ts',
      '../../state/highlandsHuntStore.ts',
    ].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'))

    const found = new Set<string>()
    for (const source of sources) {
      for (const match of source.matchAll(/setAction\(\s*\{\s*state:\s*([^,]+),/g)) {
        for (const literal of match[1]!.matchAll(/'([A-Za-z]+)'/g)) found.add(literal[1]!)
      }
    }
    // BattleScene picks `attackAir` or `attack` from one ternary, plus `breathe`.
    expect([...found].sort()).toEqual([...ACTION_STATES].sort())
  })
})
