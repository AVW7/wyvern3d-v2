import type { GameState } from '../types'
import { CONFIG } from '../data/config'
import { REGIONS } from '../data/regions'
import { UNITS } from '../data/units'
import { RESOURCE_IDS, log } from '../state/game'
import { clamp } from '../math/vec'

/** Yield multiplier for a region, falling linearly with unrest. */
export function yieldMultiplier(unrest: number): number {
  const t = clamp(unrest / 100, 0, 1)
  return 1 - (1 - CONFIG.region.minYieldMultiplier) * t
}

/** Total food eaten per tick by the whole roster. */
export function foodDemand(state: GameState): number {
  let total = 0
  for (const w of Object.values(state.wyverns)) {
    total += CONFIG.wyvern.upkeepByStage[w.stage]
  }
  return total
}

/** Total gold upkeep per tick across all squads. */
export function goldDemand(state: GameState): number {
  let total = 0
  for (const squad of Object.values(state.squads)) {
    const unit = UNITS[squad.unitId]
    if (unit) total += (unit.upkeep * squad.strength) / CONFIG.army.upkeepDivisor
  }
  return total
}

/** Net per-tick resource change, for the UI's income readout. */
export function netIncome(state: GameState): Record<string, number> {
  const net: Record<string, number> = {}
  for (const id of RESOURCE_IDS) net[id] = 0

  for (const region of Object.values(state.regions)) {
    if (region.owner !== 'player') continue
    const def = REGIONS[region.id]
    if (!def) continue
    const mult = yieldMultiplier(region.unrest)
    for (const id of RESOURCE_IDS) net[id] = (net[id] ?? 0) + (def.yields[id] ?? 0) * mult
  }

  net.food = (net.food ?? 0) - foodDemand(state)
  net.gold = (net.gold ?? 0) - goldDemand(state)
  return net
}

export function economyTick(state: GameState): void {
  // Production from held regions.
  for (const region of Object.values(state.regions)) {
    if (region.owner !== 'player') continue
    const def = REGIONS[region.id]
    if (!def) continue
    const mult = yieldMultiplier(region.unrest)
    for (const id of RESOURCE_IDS) {
      state.resources[id] += (def.yields[id] ?? 0) * mult
    }
  }

  // Food: shortfall drives hunger, which is what makes over-collecting costly.
  const food = foodDemand(state)
  const fed = state.resources.food >= food
  state.resources.food = Math.max(0, state.resources.food - food)
  for (const w of Object.values(state.wyverns)) {
    w.hunger = clamp(
      w.hunger + (fed ? -CONFIG.wyvern.hungerFall : CONFIG.wyvern.hungerRise),
      0,
      100,
    )
    if (w.hunger > CONFIG.wyvern.starvingAt) {
      w.bond = clamp(w.bond - CONFIG.wyvern.bondDecayWhenStarving, 0, CONFIG.wyvern.maxBond)
    }
  }
  if (!fed && Object.keys(state.wyverns).length > 0 && state.tick % 10 === 0) {
    log(state, 'bad', 'The wyverns are going hungry.')
  }

  // Gold: shortfall causes desertion.
  const gold = goldDemand(state)
  const paid = state.resources.gold >= gold
  state.resources.gold = Math.max(0, state.resources.gold - gold)
  if (!paid) {
    for (const squad of Object.values(state.squads)) {
      squad.strength -= CONFIG.army.desertionPerTick
      if (squad.strength <= 0) {
        delete state.squads[squad.id]
        log(state, 'bad', `Unpaid ${UNITS[squad.unitId]?.name ?? 'troops'} have deserted.`)
      }
    }
  }

  for (const id of RESOURCE_IDS) {
    state.resources[id] = Math.max(0, Math.round(state.resources[id] * 100) / 100)
  }
}
