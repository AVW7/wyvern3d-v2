import { GameState } from '../types'
import { CONFIG } from '../data/config'
import { REGION_LIST } from '../data/regions'

/**
 * Ensures that all defined regions exist in `state.regions`.
 * Missing regions (e.g. added in code after a save file was created) are inserted
 * with default initial state. Pure, no side effects, no RNG, no wall clock.
 */
export function ensureRegions(state: GameState): GameState {
  if (!state.regions) {
    state.regions = {}
  }
  for (const def of REGION_LIST) {
    if (!state.regions[def.id]) {
      state.regions[def.id] = {
        id: def.id,
        owner: def.starting ? 'player' : 'enemy',
        unrest: 0,
        garrison: def.garrison.map((g) => ({ ...g })),
        eggsAvailable: def.starting ? 0 : CONFIG.region.eggsOnConquest,
        conqueredAtTick: def.starting ? 0 : null,
      }
    }
  }
  return state
}
