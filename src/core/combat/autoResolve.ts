import type { BattleResult, BattleSetup, GameState } from '../types'
import type { EncounterConfig } from './types'
import { createEncounter } from './encounter'
import { buildEncounterConfig } from './setup'
import { CONFIG } from '../data/config'

/**
 * Runs an encounter to completion with no player at the controls.
 *
 * This is the same `createEncounter` the playable battle uses, stepped at the
 * same fixed dt — the only difference is that nobody is piloting, so the AI
 * flies every wyvern. That is what guarantees auto-resolve and a played battle
 * stay balanced against each other: there is only one combat model.
 */
export function autoResolveConfig(config: EncounterConfig): BattleResult {
  // Handing the piloted wyvern to the AI is the whole of "auto".
  const sim = createEncounter({ ...config, pilotedSourceId: null })
  const step = CONFIG.battle.step
  const maxSteps = Math.ceil(CONFIG.battle.maxDuration / step) + 1

  for (let i = 0; i < maxSteps && sim.outcome === 'ongoing'; i++) {
    sim.step(step)
    // Take any tame the fight offers; without a pilot there is no one to decide.
    if (sim.canTame()) sim.attemptTame()
  }

  return sim.result()
}

export function autoResolve(state: GameState, setup: BattleSetup): BattleResult {
  return autoResolveConfig(buildEncounterConfig(state, setup))
}
