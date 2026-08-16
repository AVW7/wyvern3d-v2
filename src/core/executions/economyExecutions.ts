import type {
  BuildingId,
  ElixirType,
  EquipmentType,
  ElementalAffinity,
  GameState,
  PhilosophyId,
  Resources,
  RulerEdict,
  RulerTitle,
} from '../types'
import { BUILDINGS } from '../data/buildings'
import { CONFIG } from '../data/config'
import { PHILOSOPHIES } from '../data/philosophies'
import { REGIONS } from '../data/regions'
import { UNITS } from '../data/units'
import {
  canAfford,
  capacityOf,
  log,
  nextId,
  spend,
} from '../state/game'
import { clamp } from '../math/vec'

/** Unit costs are quoted per 10 troops. */
export function scaledCost(base: Partial<Resources>, strength: number): Partial<Resources> {
  const factor = strength / 10
  const out: Partial<Resources> = {}
  for (const [k, v] of Object.entries(base) as [keyof Resources, number][]) {
    out[k] = Math.round(v * factor)
  }
  return out
}

export function recruitSquad(state: GameState, unitId: string, strength: number): void {
  const unit = UNITS[unitId]
  const size = Math.round(strength)
  if (!unit || size <= 0) return
  if (Object.keys(state.squads).length >= capacityOf(state, 'barracks')) {
    return log(state, 'bad', 'No room for another squad — upgrade the Barracks.')
  }
  const cost = scaledCost(unit.cost, size)
  if (!canAfford(state, cost)) return log(state, 'bad', `Not enough to raise ${size} ${unit.name}.`)

  spend(state, cost)
  const id = nextId(state, 'sq')
  state.squads[id] = { id, unitId, strength: size, stationedAt: null }
  log(state, 'good', `${size} ${unit.name} answer the call.`)
}

export function disbandSquad(state: GameState, squadId: string): void {
  const squad = state.squads[squadId]
  if (!squad) return
  delete state.squads[squadId]
  log(state, 'info', `A squad of ${UNITS[squad.unitId]?.name ?? 'troops'} is disbanded.`)
}

export function stationSquad(state: GameState, squadId: string, regionId: string | null): void {
  const squad = state.squads[squadId]
  if (!squad) return
  if (regionId !== null && state.regions[regionId]?.owner !== 'player') {
    return log(state, 'bad', 'You do not hold that region.')
  }
  squad.stationedAt = regionId
  const where = regionId ? (REGIONS[regionId]?.name ?? regionId) : 'the sanctuary'
  log(state, 'info', `Squad redeployed to ${where}.`)
}

export function upgradeBuilding(state: GameState, buildingId: string): void {
  const def = BUILDINGS[buildingId]
  if (!def) return
  const level = state.buildings[def.id] ?? 0
  if (level >= def.maxLevel) return log(state, 'bad', `${def.name} is already at its full extent.`)
  const cost = def.costPerLevel[level] ?? {}
  if (!canAfford(state, cost)) return log(state, 'bad', `Not enough materials to extend the ${def.name}.`)

  spend(state, cost)
  state.buildings[def.id] = level + 1
  log(state, 'good', `${def.name} extended to level ${level + 1}.`)
}

export function setAssignedWorkers(state: GameState, buildingId: BuildingId, count: number): void {
  if (!state.economy) return
  const targetCount = Math.max(0, Math.round(count))
  const assigned = state.economy.population.assigned
  const current = (assigned as Record<string, number>)[buildingId] ?? 0
  const totalPop = state.economy.population.total
  const totalAssigned = Object.values(assigned).reduce((a, b) => (a ?? 0) + (b ?? 0), 0)
  const idle = Math.max(0, totalPop - totalAssigned)

  const diff = targetCount - current
  if (diff > 0 && idle < diff) {
    return log(state, 'bad', 'Not enough idle villagers to assign.')
  }

  ;(assigned as Record<string, number>)[buildingId] = targetCount
  log(state, 'info', `Assigned ${targetCount} workers to ${BUILDINGS[buildingId]?.name ?? buildingId}.`)
}

export function setRulerTitle(state: GameState, title: RulerTitle): void {
  if (!state.realm) return
  state.realm.ruler.title = title
  log(state, 'info', `The sovereign title was set to ${title.toUpperCase()}.`)
}

export function setRulerEdict(state: GameState, edict: RulerEdict): void {
  if (!state.realm) return
  state.realm.ruler.edict = edict
  const names: Record<RulerEdict, string> = {
    conquest_harvest: 'Conquest Harvest (+25% yields)',
    royal_garrison: 'Royal Garrison (-50% unrest)',
    dragon_harmony: 'Dragon Harmony (+20% bond)',
    grand_taxation: 'Grand Taxation (+50% gold)',
  }
  log(state, 'good', `Royal Edict enacted: ${names[edict]}.`)
  state.realm.history.unshift({
    tick: state.tick,
    title: 'New Royal Edict',
    description: `The sovereign enacted the edict: ${names[edict]}.`,
    category: 'royal',
  })
}

export function upgradeElementalMastery(state: GameState, element: ElementalAffinity): void {
  if (!state.realm) return
  const currentLvl = state.realm.grandMaster.masteryLevels[element] ?? 0
  if (currentLvl >= CONFIG.grandMaster.maxMasteryLevel) {
    return log(state, 'bad', `${element.toUpperCase()} Mastery is already maxed.`)
  }
  const cost = CONFIG.grandMaster.costPerLevel[currentLvl] ?? {}
  if (!canAfford(state, cost)) {
    return log(state, 'bad', `Insufficient resources to advance ${element.toUpperCase()} Mastery.`)
  }

  spend(state, cost)
  state.realm.grandMaster.masteryLevels[element] = currentLvl + 1
  state.realm.grandMaster.activeFocus = element
  log(state, 'good', `Grand Master advanced ${element.toUpperCase()} Elemental Mastery to Level ${currentLvl + 1}!`)
  state.realm.history.unshift({
    tick: state.tick,
    title: `${element.toUpperCase()} Mastery Tier ${currentLvl + 1}`,
    description: `Grand Master unlocked elemental mastery level ${currentLvl + 1}.`,
    category: 'mastery',
  })
}

export function researchPhilosophy(state: GameState, philosophyId: PhilosophyId): void {
  if (!state.realm) return
  if (state.realm.philosophies.unlocked.includes(philosophyId)) {
    return log(state, 'bad', 'Philosophy treatise already unlocked.')
  }
  const def = PHILOSOPHIES[philosophyId]
  if (!def) return

  if (!canAfford(state, def.researchCost)) {
    return log(state, 'bad', `Insufficient supplies to initiate research into ${def.name}.`)
  }

  spend(state, def.researchCost)
  state.realm.philosophies.activeResearch = philosophyId
  state.realm.philosophies.researchProgress = 0
  log(state, 'info', `Began research into ${def.name}.`)
}

export function craftEquipment(state: GameState, equipmentType: EquipmentType): void {
  if (!state.realm) return
  const cost = CONFIG.crafting.equipmentCosts[equipmentType]
  if (!canAfford(state, cost)) {
    return log(state, 'bad', `Insufficient materials to craft ${equipmentType.replace('_', ' ')}.`)
  }

  spend(state, cost)
  state.realm.equipment[equipmentType] = (state.realm.equipment[equipmentType] ?? 0) + 1
  const names: Record<EquipmentType, string> = {
    wyvern_armor: 'Dragon-Scale Armor Plating',
    flame_spears: 'Flame-Hardened Spear Tips',
    iron_shields: 'Heavy Iron Vanguard Shields',
  }
  log(state, 'good', `Blacksmith forged ${names[equipmentType]}!`)
}

export function brewElixir(state: GameState, elixirType: ElixirType): void {
  if (!state.realm) return
  const cost = CONFIG.crafting.elixirCosts[elixirType]
  if (!canAfford(state, cost)) {
    return log(state, 'bad', `Insufficient herbs/arcane to brew ${elixirType.replace('_', ' ')}.`)
  }

  spend(state, cost)
  state.realm.elixirs[elixirType] = (state.realm.elixirs[elixirType] ?? 0) + 1
  log(state, 'good', `Apothecary brewed ${elixirType.replace('_', ' ')}!`)
}

export function useElixir(state: GameState, elixirType: ElixirType, wyvernId: string): void {
  if (!state.realm) return
  const count = state.realm.elixirs[elixirType] ?? 0
  if (count <= 0) return log(state, 'bad', 'No elixirs of that type in stock.')
  const wyvern = state.wyverns[wyvernId]
  if (!wyvern) return

  state.realm.elixirs[elixirType] -= 1

  if (elixirType === 'vitality_salve') {
    wyvern.injury = Math.max(0, wyvern.injury - 40)
    log(state, 'good', `Applied Vitality Salve to ${wyvern.name}. Injury reduced by 40.`)
  } else if (elixirType === 'dragon_tonic') {
    wyvern.hunger = Math.max(0, wyvern.hunger - 50)
    wyvern.bond = clamp(wyvern.bond + 15, 0, CONFIG.wyvern.maxBond)
    log(state, 'good', `Administered Dragon Tonic to ${wyvern.name}. Hunger relieved & bond +15.`)
  } else if (elixirType === 'growth_elixir') {
    wyvern.ageTicks += CONFIG.wyvern.hatchlingTicks
    log(state, 'good', `Growth Elixir accelerated ${wyvern.name}'s maturity.`)
  }
}
