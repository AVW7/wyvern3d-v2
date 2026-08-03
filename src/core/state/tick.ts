import type { GameState } from '../types'
import type { Intent } from '../intents'
import { execute } from '../executions'
import { autoResolve } from '../combat/autoResolve'
import { economyTick } from '../systems/economy'
import { regionTick } from '../systems/regions'
import { sanctuaryTick } from '../systems/sanctuary'

/**
 * Advances the world by exactly one tick.
 *
 * Order matters and is fixed: intents first (so a command issued this tick
 * takes effect this tick), then production, then the sanctuary, then unrest.
 * Changing this order changes outcomes, which would invalidate every existing
 * replay — so don't, without bumping the save version.
 */
export function executeNextTick(state: GameState, intents: readonly Intent[] = []): void {
  for (const intent of intents) {
    execute(state, intent)
  }

  // An auto-resolve attack is fought and settled within the tick that launched
  // it. A playable one parks in `pendingBattle` until the Battle scene reports
  // back with a RESOLVE_BATTLE intent.
  if (state.pendingBattle?.mode === 'auto') {
    const result = autoResolve(state, state.pendingBattle)
    execute(state, { type: 'RESOLVE_BATTLE', result })
  }

  economyTick(state)
  sanctuaryTick(state)
  regionTick(state)

  state.tick += 1
}

/** Fast-forwards `count` ticks with no player input — used for offline catch-up. */
export function advanceTicks(state: GameState, count: number): void {
  for (let i = 0; i < count; i++) executeNextTick(state)
}
