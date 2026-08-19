import type { GameState } from '../types'
import { CONFIG } from '../data/config'
import { REGIONS } from '../data/regions'
import { emit, log } from '../state/game'
import { settlementCondition } from '../state/settlement'
import { clamp } from '../math/vec'

/**
 * Unrest is the pressure valve. Without it the game is monotone growth: take a
 * region, bank the income, repeat. With it, holding ground costs troops, which
 * is the only reason armies matter outside of an assault.
 */
export function regionTick(state: GameState): void {
  for (const region of Object.values(state.regions)) {
    if (region.owner !== 'player') continue

    // The starting region is the player's seat, not a conquered territory — it
    // never grows unrest and can never revolt. Without this the home region
    // eventually flips, and because an attack requires an adjacent held region
    // that leaves the player with zero regions and no legal move: a soft-lock.
    if (REGIONS[region.id]?.starting) {
      region.unrest = 0
      continue
    }

    const edict = state.realm?.ruler?.edict
    const edictMult = edict === 'royal_garrison' ? 0.5 : edict === 'grand_taxation' ? 1.1 : 1.0
    const hasDominion = state.realm?.philosophies?.unlocked?.includes('dominion')
    const suppressionMult = hasDominion ? 1.1 : 1.0

    const garrison = Object.values(state.squads)
      .filter((s) => s.stationedAt === region.id)
      .reduce((sum, s) => sum + s.strength, 0)

    const suppression = (garrison / 10) * CONFIG.region.unrestPerGarrison * suppressionMult
    // Sampled before the update so a band crossing can be detected without
    // storing the previous condition — no new save state, no migration.
    const conditionBefore = settlementCondition(region.owner, region.unrest)
    region.unrest = clamp(
      region.unrest + CONFIG.region.unrestPerTick * edictMult - suppression,
      0,
      CONFIG.region.revoltAt,
    )

    const conditionAfter = settlementCondition(region.owner, region.unrest)
    if (conditionAfter !== conditionBefore) {
      emit(state, 'settlement_condition_changed', region.id, undefined, {
        from: conditionBefore,
        to: conditionAfter,
      })
    }

    if (region.unrest >= CONFIG.region.revoltAt) {
      revolt(state, region.id)
      continue
    }

    // Wyvern garrison egg regeneration: matching species regenerates eggs
    const def = REGIONS[region.id]
    if (def && state.tick > 0 && state.tick % CONFIG.region.eggRegenTicks === 0) {
      const garrisonedWyvern = Object.values(state.wyverns).find(
        (w) => w.assignment.kind === 'garrison' && w.assignment.regionId === region.id
      )
      if (garrisonedWyvern && garrisonedWyvern.speciesId === def.nativeSpecies) {
        region.eggsAvailable = Math.min(region.eggsAvailable + 1, CONFIG.region.maxEggsHeld)
      }
    }
  }
}

function revolt(state: GameState, regionId: string): void {
  const region = state.regions[regionId]
  const def = REGIONS[regionId]
  if (!region || !def) return

  region.owner = 'enemy'
  region.unrest = 0
  region.conqueredAtTick = null
  region.garrison = def.garrison.map((g) => ({ ...g }))
  region.eggsAvailable = CONFIG.region.eggsOnConquest

  // Any squad stationed there is lost with the region.
  for (const squad of Object.values(state.squads)) {
    if (squad.stationedAt === regionId) delete state.squads[squad.id]
  }

  log(state, 'bad', `${def.name} has risen in revolt and thrown you out.`)
  if (state.realm?.history) {
    state.realm.history.unshift({
      tick: state.tick,
      title: `Revolt at ${def.name}`,
      description: `High unrest caused ${def.name} to rise up against player rule.`,
      category: 'revolt',
    })
  }
}
