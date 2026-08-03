import type { BattleSetup, GameState } from '../types'
import type { EncounterConfig } from './types'
import { REGIONS } from '../data/regions'
import { effectiveStats } from '../entities/wyvern'

/**
 * Builds an encounter config from world state.
 *
 * Kept separate from `createEncounter` so the sim itself has no knowledge of
 * GameState — that is what lets the balance harness fabricate arbitrary
 * matchups without constructing a whole save.
 */
export function buildEncounterConfig(state: GameState, setup: BattleSetup): EncounterConfig {
  const def = REGIONS[setup.regionId]
  const region = state.regions[setup.regionId]

  const wyverns = setup.wyvernIds.flatMap((id) => {
    const w = state.wyverns[id]
    if (!w) return []
    return [
      {
        sourceId: w.id,
        speciesId: w.speciesId,
        name: w.name,
        bond: w.bond,
        // Effective, not raw: hunger and injury follow a wyvern into battle.
        stats: effectiveStats(w),
      },
    ]
  })

  const squads = setup.squadIds.flatMap((id) => {
    const s = state.squads[id]
    if (!s || s.strength <= 0) return []
    return [{ sourceId: s.id, unitId: s.unitId, strength: s.strength }]
  })

  return {
    regionId: setup.regionId,
    seed: setup.seed,
    attackers: { wyverns, squads },
    defenders: {
      // The live garrison, which shrinks if the region was softened earlier.
      squads: (region?.garrison ?? def?.garrison ?? []).map((g) => ({ ...g })),
      wyverns: (def?.defenders ?? []).map((speciesId) => ({ speciesId, tier: def?.tier ?? 1 })),
    },
    pilotedSourceId: setup.pilotedWyvernId,
  }
}
