import type { GameState } from '../types'
import { CONFIG } from '../data/config'
import { REGIONS } from '../data/regions'
import { UNITS } from '../data/units'
import { capacityOf, log, RESOURCE_IDS } from '../state/game'
import { clamp } from '../math/vec'

/** Yield multiplier for a region, falling linearly with unrest. */
export function yieldMultiplier(unrest: number): number {
  const t = clamp(unrest / 100, 0, 1)
  return 1 - (1 - CONFIG.region.minYieldMultiplier) * t
}

/** Total food eaten per tick by the whole wyvern roster. */
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

  // Regional conquest yields
  for (const region of Object.values(state.regions)) {
    if (region.owner !== 'player') continue
    const def = REGIONS[region.id]
    if (!def) continue
    const mult = yieldMultiplier(region.unrest)
    for (const id of RESOURCE_IDS) net[id] = (net[id] ?? 0) + (def.yields[id] ?? 0) * mult
  }

  // Sanctuary Aqueduct Water output
  const aqueductLvl = state.buildings.aqueduct ?? 0
  if (aqueductLvl > 0) {
    net.water = (net.water ?? 0) + CONFIG.economy.waterPerAqueductLevel * aqueductLvl
  }

  // Sanctuary Farm Production
  const farmWorkers = state.economy?.population?.assigned?.farm ?? 0
  if (farmWorkers > 0) {
    net.food = (net.food ?? 0) + CONFIG.economy.foodPerFarmWorker * farmWorkers
    net.water = (net.water ?? 0) - CONFIG.economy.waterPerFarmWorker * farmWorkers
  }

  // Sanctuary Foundry Smelting (Ore -> Iron + Gold)
  const foundryWorkers = state.economy?.population?.assigned?.foundry ?? 0
  if (foundryWorkers > 0 && state.resources.ore >= CONFIG.economy.orePerSmelt * foundryWorkers) {
    net.ore = (net.ore ?? 0) - CONFIG.economy.orePerSmelt * foundryWorkers
    net.iron = (net.iron ?? 0) + CONFIG.economy.ironPerSmelt * foundryWorkers
    net.gold = (net.gold ?? 0) + CONFIG.economy.goldPerSmelt * foundryWorkers
  }

  // Sanctuary Sawmill Processing
  const sawmillWorkers = state.economy?.population?.assigned?.sawmill ?? 0
  if (sawmillWorkers > 0) {
    net.timber = (net.timber ?? 0) + CONFIG.economy.timberBonusPerWorker * sawmillWorkers
  }

  // Villager Population Upkeep
  const totalPop = state.economy?.population?.total ?? 0
  if (totalPop > 0) {
    net.food = (net.food ?? 0) - CONFIG.economy.foodPerPerson * totalPop
    net.water = (net.water ?? 0) - CONFIG.economy.waterPerPerson * totalPop
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

  // 1. Water Collection from Wells & Aqueducts
  const aqueductLvl = state.buildings.aqueduct ?? 0
  if (aqueductLvl > 0) {
    state.resources.water += CONFIG.economy.waterPerAqueductLevel * aqueductLvl
  }

  // 2. Sanctuary Farm Production
  const farmWorkers = state.economy?.population?.assigned?.farm ?? 0
  if (farmWorkers > 0 && state.resources.water >= CONFIG.economy.waterPerFarmWorker * farmWorkers) {
    state.resources.water -= CONFIG.economy.waterPerFarmWorker * farmWorkers
    state.resources.food += CONFIG.economy.foodPerFarmWorker * farmWorkers
  }

  // 3. Wildlife Pasture Breeding & Harvesting
  const pastureLvl = state.buildings.pasture ?? 0
  if (pastureLvl > 0 && state.economy?.livestock) {
    // Every 30 ticks, livestock reproduces when food and water are available
    if (state.tick > 0 && state.tick % CONFIG.economy.breedingTicks.deer === 0) {
      for (const [animal, count] of Object.entries(state.economy.livestock)) {
        if (count >= 2) {
          const cap = capacityOf(state, 'pasture')
          const totalAnimals = Object.values(state.economy.livestock).reduce((a, b) => a + b, 0)
          if (totalAnimals < cap) {
            state.economy.livestock[animal as keyof typeof state.economy.livestock] += 1
            state.resources.food += CONFIG.economy.harvestYields[animal as keyof typeof CONFIG.economy.harvestYields]?.food ?? 10
            state.resources.hide += CONFIG.economy.harvestYields[animal as keyof typeof CONFIG.economy.harvestYields]?.hide ?? 1
          }
        }
      }
    }
  }

  // 4. Foundry Smelting (Ore -> Iron + Gold)
  const foundryWorkers = state.economy?.population?.assigned?.foundry ?? 0
  if (foundryWorkers > 0 && state.resources.ore >= CONFIG.economy.orePerSmelt * foundryWorkers) {
    state.resources.ore -= CONFIG.economy.orePerSmelt * foundryWorkers
    state.resources.iron += CONFIG.economy.ironPerSmelt * foundryWorkers
    state.resources.gold += CONFIG.economy.goldPerSmelt * foundryWorkers
  }

  // 5. Sawmill Timber Processing
  const sawmillWorkers = state.economy?.population?.assigned?.sawmill ?? 0
  if (sawmillWorkers > 0) {
    state.resources.timber += CONFIG.economy.timberBonusPerWorker * sawmillWorkers
  }

  // 6. Villager Population Consumption & Growth
  const housingLvl = state.buildings.housing ?? 0
  const popCap = capacityOf(state, 'housing') || (CONFIG.starting.population + housingLvl * CONFIG.economy.populationPerHousingLevel)
  const totalPop = state.economy?.population?.total ?? 0
  if (totalPop > 0) {
    const popFoodNeeded = CONFIG.economy.foodPerPerson * totalPop
    const popWaterNeeded = CONFIG.economy.waterPerPerson * totalPop
    state.resources.food = Math.max(0, state.resources.food - popFoodNeeded)
    state.resources.water = Math.max(0, state.resources.water - popWaterNeeded)
  }
  // Population grows slowly when food & water are plentiful
  if (state.tick % 40 === 0 && totalPop < popCap && state.resources.food > 100 && state.resources.water > 50) {
    if (state.economy?.population) {
      state.economy.population.total += 1
      log(state, 'good', 'A new villager has arrived at the sanctuary.')
    }
  }

  // 7. Wyvern Food & Starvation Upkeep
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

  // 8. Squad Gold Upkeep
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
