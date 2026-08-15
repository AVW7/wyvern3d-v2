import type { BuildingId, ElixirType, EquipmentType, ElementalAffinity, GameState, PhilosophyId, Resources, RulerEdict, RulerTitle } from '../types'
import type { Intent } from '../intents'
import { BUILDINGS } from '../data/buildings'
import { CONFIG } from '../data/config'
import { PHILOSOPHIES } from '../data/philosophies'
import { REGIONS } from '../data/regions'
import { REGION_ATLAS_DATA } from '../data/atlas'
import { PHENOMENA, isPhenomenonOfRegion } from '../data/phenomena'
import { SPECIES } from '../data/species'
import { STATIONS } from '../data/stations'
import { UNITS } from '../data/units'
import {
  canAfford,
  capacityOf,
  emit,
  gain,
  isAttackable,
  log,
  nextId,
  spend,
  withRng,
} from '../state/game'
import {
  applyXp,
  createWyvern,
  isDeployable,
  nameFor,
  rollSpeciesStats,
  rollSpeciesTraits,
} from '../entities/wyvern'
import { deriveSeed, type Rng } from '../math/rng'
import { clamp } from '../math/vec'

import {
  cloneSanctuaryLayout,
  createDefaultSanctuaryLayout,
  ensureSanctuaryLayout,
} from '../state/sanctuaryLayout'
import { ensureAtlasKnowledge } from '../state/atlasKnowledge'

/**
 * Executions are the ONLY code permitted to mutate GameState. Every one of
 * them re-validates its intent — intents arriving from a replay or a future
 * server are untrusted, and a rejected intent must leave state untouched.
 */
export function execute(state: GameState, intent: Intent): void {
  switch (intent.type) {
    case 'RECORD_REGION_VISIT':
      return recordRegionVisit(state, intent.regionId)
    case 'DISCOVER_LANDMARK':
      return discoverLandmark(state, intent.regionId, intent.landmarkId)
    case 'OBSERVE_PHENOMENON':
      return observePhenomenon(state, intent.regionId, intent.phenomenonId)
    case 'TAKE_DUTY_ITEM':
      return takeDutyItem(state, intent.dutyId)
    case 'ABANDON_DUTY_ITEM':
      return abandonDutyItem(state, intent.dutyId)
    case 'COMPLETE_DUTY':
      return completeDuty(state, intent.dutyId)
    case 'ASSIGN_TRAINING':
      return assignTraining(state, intent.wyvernId, intent.stationId)
    case 'CANCEL_ASSIGNMENT':
      return cancelAssignment(state, intent.wyvernId)
    case 'GARRISON_WYVERN':
      return garrisonWyvern(state, intent.wyvernId, intent.regionId)
    case 'COLLECT_REGION_EGGS':
      return collectRegionEggs(state, intent.regionId)
    case 'START_BREEDING':
      return startBreeding(state, intent.aId, intent.bId)
    case 'INCUBATE_EGG':
      return incubateEgg(state, intent.eggId)
    case 'FEED_WYVERN':
      return feedWyvern(state, intent.wyvernId)
    case 'HUNT_WILDLIFE':
      return huntWildlife(state, intent.wyvernId, intent.prey)
    case 'SET_WYVERN_PERCH':
      return setWyvernPerch(state, intent.wyvernId, intent.perchIndex)
    case 'RENAME_WYVERN':
      return renameWyvern(state, intent.wyvernId, intent.name)
    case 'RELEASE_WYVERN':
      return releaseWyvern(state, intent.wyvernId)
    case 'RECRUIT_SQUAD':
      return recruitSquad(state, intent.unitId, intent.strength)
    case 'DISBAND_SQUAD':
      return disbandSquad(state, intent.squadId)
    case 'STATION_SQUAD':
      return stationSquad(state, intent.squadId, intent.regionId)
    case 'UPGRADE_BUILDING':
      return upgradeBuilding(state, intent.buildingId)
    case 'SET_ASSIGNED_WORKERS':
      return setAssignedWorkers(state, intent.buildingId, intent.count)
    case 'SET_RULER_TITLE':
      return setRulerTitle(state, intent.title)
    case 'SET_RULER_EDICT':
      return setRulerEdict(state, intent.edict)
    case 'UPGRADE_ELEMENTAL_MASTERY':
      return upgradeElementalMastery(state, intent.element)
    case 'RESEARCH_PHILOSOPHY':
      return researchPhilosophy(state, intent.philosophyId)
    case 'CRAFT_EQUIPMENT':
      return craftEquipment(state, intent.equipmentType)
    case 'BREW_ELIXIR':
      return brewElixir(state, intent.elixirType)
    case 'USE_ELIXIR':
      return useElixir(state, intent.elixirType, intent.wyvernId)
    case 'LAUNCH_ATTACK':
      return launchAttack(state, intent)
    case 'RESOLVE_BATTLE':
      return resolveBattle(state, intent.result)
    case 'ABORT_BATTLE':
      state.pendingBattle = null
      return
    case 'ADD_SANCTUARY_OBJECT':
      return addSanctuaryObject(state, intent)
    case 'MOVE_SANCTUARY_OBJECT':
      return moveSanctuaryObject(state, intent.id, intent.position, intent.rotationY)
    case 'ROTATE_SANCTUARY_OBJECT':
      return rotateSanctuaryObject(state, intent.id, intent.rotationY)
    case 'STORE_SANCTUARY_OBJECT':
      return storeSanctuaryObject(state, intent.id)
    case 'RESET_SANCTUARY_LAYOUT':
      return resetSanctuaryLayout(state)
    case 'RESTORE_SANCTUARY_LAYOUT':
      return restoreSanctuaryLayout(state, intent.layout)
  }
}

// ---------------------------------------------------------------------------
// Sanctuary
// ---------------------------------------------------------------------------

function countAssigned(state: GameState, kind: 'training' | 'breeding'): number {
  return Object.values(state.wyverns).filter((w) => w.assignment.kind === kind).length
}

function assignTraining(state: GameState, wyvernId: string, stationId: string): void {
  const w = state.wyverns[wyvernId]
  const station = STATIONS[stationId]
  if (!w || !station) return
  if (w.assignment.kind !== 'idle') return log(state, 'bad', `${w.name} is already busy.`)
  if (countAssigned(state, 'training') >= capacityOf(state, 'trainingGrounds')) {
    return log(state, 'bad', 'No free training slot — upgrade the Training Grounds.')
  }
  if (!canAfford(state, station.cost)) return log(state, 'bad', `Not enough supplies for the ${station.name}.`)

  spend(state, station.cost)
  w.assignment = { kind: 'training', stationId, ticksLeft: station.duration }
  log(state, 'info', `${w.name} begins training at the ${station.name}.`)
}

function cancelAssignment(state: GameState, wyvernId: string): void {
  const w = state.wyverns[wyvernId]
  if (!w || w.assignment.kind === 'idle') return
  // Breeding is a pair — cancelling one has to release the partner too,
  // or the partner is stranded in a breeding assignment forever.
  if (w.assignment.kind === 'breeding') {
    const partner = state.wyverns[w.assignment.partnerId]
    if (partner && partner.assignment.kind === 'breeding') partner.assignment = { kind: 'idle' }
  }
  w.assignment = { kind: 'idle' }
  log(state, 'info', `${w.name} is recalled.`)
}

function startBreeding(state: GameState, aId: string, bId: string): void {
  const a = state.wyverns[aId]
  const b = state.wyverns[bId]
  if (!a || !b || a.id === b.id) return
  for (const w of [a, b]) {
    if (w.stage !== 'adult') return log(state, 'bad', `${w.name} is not yet grown.`)
    if (w.assignment.kind !== 'idle') return log(state, 'bad', `${w.name} is already busy.`)
    if (w.bond < CONFIG.wyvern.breedBond) return log(state, 'bad', `${w.name} does not trust you enough.`)
    if (w.breedCooldown > 0) return log(state, 'bad', `${w.name} needs more time to recover.`)
  }
  if (capacityOf(state, 'hatchery') <= 0) return log(state, 'bad', 'Build a Hatchery first.')

  const duration = CONFIG.wyvern.breedDuration
  a.assignment = { kind: 'breeding', partnerId: b.id, ticksLeft: duration }
  b.assignment = { kind: 'breeding', partnerId: a.id, ticksLeft: duration }
  log(state, 'info', `${a.name} and ${b.name} are paired.`)
}

function incubateEgg(state: GameState, eggId: string): void {
  const egg = state.eggs[eggId]
  if (!egg || egg.incubatingTicksLeft !== null) return
  const inSlots = Object.values(state.eggs).filter((e) => e.incubatingTicksLeft !== null).length
  if (inSlots >= capacityOf(state, 'hatchery')) {
    return log(state, 'bad', 'Every roost is occupied — upgrade the Hatchery.')
  }
  egg.incubatingTicksLeft = CONFIG.wyvern.incubationTicks
  log(state, 'info', `A ${SPECIES[egg.speciesId]?.name ?? 'wyvern'} egg is set to warm.`)
}

function feedWyvern(state: GameState, wyvernId: string): void {
  const w = state.wyverns[wyvernId]
  if (!w) return
  if (state.resources.food < CONFIG.wyvern.feedCost) return log(state, 'bad', 'Not enough food.')
  state.resources.food -= CONFIG.wyvern.feedCost
  w.hunger = clamp(w.hunger - CONFIG.wyvern.feedRelief, 0, 100)
  log(state, 'good', `${w.name} is fed.`)
}

/**
 * The render layer confirms a physical prey hit, then records the resulting
 * harvest through this normal replay-safe intent. The prey's pose and respawn
 * clock remain cosmetic, but the food reward is authoritative and rate-limited.
 */
function huntWildlife(state: GameState, wyvernId: string, prey: 'deer' | 'bird'): void {
  const w = state.wyverns[wyvernId]
  if (!w || w.stage !== 'adult' || w.assignment.kind !== 'idle') return
  if (prey !== 'deer' && prey !== 'bird') return
  if (state.tick < w.lastHuntTick + CONFIG.wyvern.huntCooldownTicks) {
    return log(state, 'bad', `${w.name} needs time before another hunt.`)
  }
  const food = CONFIG.wyvern.huntFood[prey]
  w.lastHuntTick = state.tick
  gain(state, { food })
  log(state, 'good', `${w.name} brings back ${food} food from a ${prey} hunt.`)
}

function setWyvernPerch(state: GameState, wyvernId: string, perchIndex: number): void {
  const w = state.wyverns[wyvernId]
  if (!w) return
  w.preferredPerchIndex = perchIndex
  log(state, 'info', `${w.name}'s idle perch assigned to Spot ${perchIndex + 1}.`)
}

function renameWyvern(state: GameState, wyvernId: string, name: string): void {
  const w = state.wyverns[wyvernId]
  const trimmed = name.trim().slice(0, 24)
  if (!w || trimmed.length === 0) return
  w.name = trimmed
}

function releaseWyvern(state: GameState, wyvernId: string): void {
  const w = state.wyverns[wyvernId]
  if (!w) return
  cancelAssignment(state, wyvernId)
  delete state.wyverns[wyvernId]
  emit(state, 'wyvern_died', w.id)
  log(state, 'info', `${w.name} is released to the wild.`)
}

// ---------------------------------------------------------------------------
// Sanctuary Duties
// ---------------------------------------------------------------------------

function takeDutyItem(state: GameState, dutyId: number): void {
  if (!state.duties) return
  const duty = state.duties.active.find((d) => d.id === dutyId)
  if (!duty || duty.status !== 'available') return

  duty.status = 'carrying'
  state.duties.carriedDutyId = duty.id
  log(state, 'info', `Collected provisions for duty #${duty.id}.`)
}

function abandonDutyItem(state: GameState, dutyId: number): void {
  if (!state.duties) return
  const duty = state.duties.active.find((d) => d.id === dutyId)
  if (!duty || duty.status !== 'carrying') return

  duty.status = 'available'
  if (state.duties.carriedDutyId === duty.id) {
    state.duties.carriedDutyId = null
  }
  log(state, 'info', `Returned provisions for duty #${duty.id}.`)
}

function completeDuty(state: GameState, dutyId: number): void {
  if (!state.duties) return
  const dutyIndex = state.duties.active.findIndex((d) => d.id === dutyId)
  if (dutyIndex === -1) return
  const duty = state.duties.active[dutyIndex]!

  const wyvern = state.wyverns[duty.subjectId]
  if (!wyvern) {
    // Subject no longer exists
    state.duties.active.splice(dutyIndex, 1)
    if (state.duties.carriedDutyId === duty.id) state.duties.carriedDutyId = null
    return log(state, 'bad', 'The duty subject is no longer in the sanctuary.')
  }

  if (duty.kind === 'feed') {
    if (state.resources.food < CONFIG.wyvern.feedCost) {
      return log(state, 'bad', 'Not enough food to complete the feed duty.')
    }

    state.resources.food -= CONFIG.wyvern.feedCost
    wyvern.hunger = clamp(wyvern.hunger - CONFIG.wyvern.feedRelief, 0, 100)
    wyvern.bond = clamp(wyvern.bond + CONFIG.duties.feed.bondBonus, 0, CONFIG.wyvern.maxBond)

    state.duties.active.splice(dutyIndex, 1)
    if (state.duties.carriedDutyId === duty.id) {
      state.duties.carriedDutyId = null
    }
    state.duties.completed += 1

    emit(state, 'sanctuary_duty_completed', wyvern.id, undefined, {
      dutyId: duty.id,
      kind: duty.kind,
      bondGain: CONFIG.duties.feed.bondBonus,
    })
    log(state, 'good', `Completed feed duty for ${wyvern.name}. Hunger relieved & bond +${CONFIG.duties.feed.bondBonus}.`)
    return
  }

  if (duty.kind === 'medicine') {
    if (
      state.resources.water < CONFIG.duties.medicine.costWater ||
      state.resources.arcane < CONFIG.duties.medicine.costArcane
    ) {
      return log(state, 'bad', 'Not enough water/arcane supplies for medicine.')
    }

    state.resources.water -= CONFIG.duties.medicine.costWater
    state.resources.arcane -= CONFIG.duties.medicine.costArcane
    wyvern.injury = clamp(wyvern.injury - CONFIG.duties.medicine.injuryRelief, 0, 100)
    wyvern.bond = clamp(wyvern.bond + CONFIG.duties.medicine.bondBonus, 0, CONFIG.wyvern.maxBond)

    state.duties.active.splice(dutyIndex, 1)
    if (state.duties.carriedDutyId === duty.id) {
      state.duties.carriedDutyId = null
    }
    state.duties.completed += 1

    emit(state, 'sanctuary_duty_completed', wyvern.id, undefined, {
      dutyId: duty.id,
      kind: duty.kind,
      bondGain: CONFIG.duties.medicine.bondBonus,
    })
    log(state, 'good', `Treated injuries for ${wyvern.name}. Injury relieved & bond +${CONFIG.duties.medicine.bondBonus}.`)
    return
  }

  if (duty.kind === 'companionship') {
    if (wyvern.assignment.kind !== 'idle') {
      return log(state, 'bad', `${wyvern.name} is currently busy.`)
    }

    wyvern.bond = clamp(wyvern.bond + CONFIG.duties.companionship.bondBonus, 0, CONFIG.wyvern.maxBond)

    state.duties.active.splice(dutyIndex, 1)
    if (state.duties.carriedDutyId === duty.id) {
      state.duties.carriedDutyId = null
    }
    state.duties.completed += 1

    emit(state, 'sanctuary_duty_completed', wyvern.id, undefined, {
      dutyId: duty.id,
      kind: duty.kind,
      bondGain: CONFIG.duties.companionship.bondBonus,
    })
    log(state, 'good', `Reassured ${wyvern.name}. Bond +${CONFIG.duties.companionship.bondBonus}.`)
    return
  }

  if (duty.kind === 'flightExercise') {
    if (wyvern.stage === 'hatchling') {
      return log(state, 'bad', 'Hatchlings cannot perform flight exercises.')
    }
    if (wyvern.assignment.kind !== 'idle') {
      return log(state, 'bad', `${wyvern.name} is currently busy.`)
    }

    wyvern.bond = clamp(wyvern.bond + CONFIG.duties.flightExercise.bondBonus, 0, CONFIG.wyvern.maxBond)
    wyvern.stats.stamina += CONFIG.duties.flightExercise.staminaGain

    state.duties.active.splice(dutyIndex, 1)
    if (state.duties.carriedDutyId === duty.id) {
      state.duties.carriedDutyId = null
    }
    state.duties.completed += 1

    emit(state, 'sanctuary_duty_completed', wyvern.id, undefined, {
      dutyId: duty.id,
      kind: duty.kind,
      bondGain: CONFIG.duties.flightExercise.bondBonus,
    })
    log(
      state,
      'good',
      `Completed flight ring exercise with ${wyvern.name}. Stamina +${CONFIG.duties.flightExercise.staminaGain} & bond +${CONFIG.duties.flightExercise.bondBonus}.`,
    )
    return
  }
}

function garrisonWyvern(state: GameState, wyvernId: string, regionId: string | null): void {
  const w = state.wyverns[wyvernId]
  if (!w) return

  if (regionId === null) {
    if (w.assignment.kind === 'garrison') {
      w.assignment = { kind: 'idle' }
      log(state, 'info', `${w.name} recalled to sanctuary.`)
    }
    return
  }

  const region = state.regions[regionId]
  if (!region || region.owner !== 'player') {
    return log(state, 'bad', 'You do not hold that region.')
  }

  if (w.stage !== 'adult') {
    return log(state, 'bad', 'Only adult wyverns can be garrisoned.')
  }

  w.assignment = { kind: 'garrison', regionId }
  log(state, 'good', `${w.name} posted to garrison ${REGIONS[regionId]?.name ?? regionId}.`)
}

function collectRegionEggs(state: GameState, regionId: string): void {
  const region = state.regions[regionId]
  const def = REGIONS[regionId]
  if (!region || !def || region.owner !== 'player') return

  if (region.eggsAvailable <= 0) {
    return log(state, 'info', `No eggs available in ${def.name}.`)
  }

  region.eggsAvailable -= 1
  withRng(state, (rng) => {
    const id = nextId(state, 'egg')
    state.eggs[id] = {
      id,
      speciesId: def.nativeSpecies,
      parents: null,
      rolledStats: rollSpeciesStats(def.nativeSpecies, rng),
      rolledTraits: rollSpeciesTraits(def.nativeSpecies, rng),
      incubatingTicksLeft: null,
    }
  })
  log(state, 'good', `Collected 1 ${SPECIES[def.nativeSpecies]?.name ?? 'wyvern'} egg from ${def.name}.`)
}

// ---------------------------------------------------------------------------
// Armies
// ---------------------------------------------------------------------------

/** Unit costs are quoted per 10 troops. */
function scaledCost(base: Partial<Resources>, strength: number): Partial<Resources> {
  const factor = strength / 10
  const out: Partial<Resources> = {}
  for (const [k, v] of Object.entries(base) as [keyof Resources, number][]) {
    out[k] = Math.round(v * factor)
  }
  return out
}

function recruitSquad(state: GameState, unitId: string, strength: number): void {
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

function disbandSquad(state: GameState, squadId: string): void {
  const squad = state.squads[squadId]
  if (!squad) return
  delete state.squads[squadId]
  log(state, 'info', `A squad of ${UNITS[squad.unitId]?.name ?? 'troops'} is disbanded.`)
}

function stationSquad(state: GameState, squadId: string, regionId: string | null): void {
  const squad = state.squads[squadId]
  if (!squad) return
  if (regionId !== null && state.regions[regionId]?.owner !== 'player') {
    return log(state, 'bad', 'You do not hold that region.')
  }
  squad.stationedAt = regionId
  const where = regionId ? (REGIONS[regionId]?.name ?? regionId) : 'the sanctuary'
  log(state, 'info', `Squad redeployed to ${where}.`)
}

function upgradeBuilding(state: GameState, buildingId: string): void {
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

function setAssignedWorkers(state: GameState, buildingId: BuildingId, count: number): void {
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

function setRulerTitle(state: GameState, title: RulerTitle): void {
  if (!state.realm) return
  state.realm.ruler.title = title
  log(state, 'info', `The sovereign title was set to ${title.toUpperCase()}.`)
}

function setRulerEdict(state: GameState, edict: RulerEdict): void {
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

function upgradeElementalMastery(state: GameState, element: ElementalAffinity): void {
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

function researchPhilosophy(state: GameState, philosophyId: PhilosophyId): void {
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

function craftEquipment(state: GameState, equipmentType: EquipmentType): void {
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

function brewElixir(state: GameState, elixirType: ElixirType): void {
  if (!state.realm) return
  const cost = CONFIG.crafting.elixirCosts[elixirType]
  if (!canAfford(state, cost)) {
    return log(state, 'bad', `Insufficient herbs/arcane to brew ${elixirType.replace('_', ' ')}.`)
  }

  spend(state, cost)
  state.realm.elixirs[elixirType] = (state.realm.elixirs[elixirType] ?? 0) + 1
  log(state, 'good', `Apothecary brewed ${elixirType.replace('_', ' ')}!`)
}

function useElixir(state: GameState, elixirType: ElixirType, wyvernId: string): void {
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

// ---------------------------------------------------------------------------
// Conquest
// ---------------------------------------------------------------------------

function launchAttack(
  state: GameState,
  intent: Extract<Intent, { type: 'LAUNCH_ATTACK' }>,
): void {
  if (state.pendingBattle) return log(state, 'bad', 'A campaign is already under way.')
  if (!isAttackable(state, intent.regionId)) return log(state, 'bad', 'That region cannot be reached from your holdings.')

  const wyvernIds = intent.wyvernIds.filter((id) => {
    const w = state.wyverns[id]
    return w !== undefined && isDeployable(w)
  })
  const squadIds = intent.squadIds.filter((id) => state.squads[id]?.stationedAt === null)

  if (wyvernIds.length === 0 && squadIds.length === 0) {
    return log(state, 'bad', 'Nothing fit to march.')
  }

  const piloted =
    intent.pilotedWyvernId && wyvernIds.includes(intent.pilotedWyvernId)
      ? intent.pilotedWyvernId
      : (wyvernIds[0] ?? null)

  state.pendingBattle = {
    regionId: intent.regionId,
    // Derived from world seed + tick + region, so the same attack always plays
    // out from the same starting conditions on replay.
    seed: deriveSeed(state.seed, `${intent.regionId}:${state.tick}`),
    wyvernIds,
    squadIds,
    pilotedWyvernId: piloted,
    mode: intent.mode,
  }
  log(state, 'info', `The host moves on ${REGIONS[intent.regionId]?.name ?? intent.regionId}.`)
}

function resolveBattle(state: GameState, result: GameState['lastBattle']): void {
  if (!result) return
  const pending = state.pendingBattle
  if (!pending || pending.regionId !== result.regionId) return

  state.pendingBattle = null
  state.lastBattle = result

  // Wyvern outcomes: injuries and XP land whether you won or lost.
  for (const [id, outcome] of Object.entries(result.wyverns)) {
    const w = state.wyverns[id]
    if (!w) continue
    if (outcome.died) {
      delete state.wyverns[id]
      emit(state, 'wyvern_died', id, result.regionId)
      log(state, 'bad', `${w.name} fell at ${REGIONS[result.regionId]?.name ?? result.regionId}.`)
      continue
    }
    w.injury = clamp(w.injury + outcome.injury, 0, 100)
    w.bond = clamp(w.bond + outcome.bondDelta, 0, CONFIG.wyvern.maxBond)
    const levels = applyXp(w, outcome.xp)
    if (levels > 0) {
      emit(state, 'wyvern_leveled', id, undefined, { level: w.level, levelsGained: levels })
      log(state, 'good', `${w.name} reaches level ${w.level}.`)
    }
  }

  // Squad casualties.
  for (const [id, survivors] of Object.entries(result.squads)) {
    const squad = state.squads[id]
    if (!squad) continue
    squad.strength = Math.max(0, Math.round(survivors))
    if (squad.strength === 0) {
      delete state.squads[id]
      log(state, 'bad', `A squad of ${UNITS[squad.unitId]?.name ?? 'troops'} was wiped out.`)
    }
  }

  const region = state.regions[result.regionId]
  const def = REGIONS[result.regionId]
  if (!region || !def) return

  if (!result.victory) {
    log(state, 'bad', `The assault on ${def.name} was thrown back.`)
    return
  }

  region.owner = 'player'
  region.unrest = 25
  region.garrison = []
  region.conqueredAtTick = state.tick
  gain(state, result.loot)

  log(state, 'good', `${def.name} falls. The banners are yours.`)

  // Conquer marks region visited and maps adjacent neighbors in the atlas.
  ensureAtlasKnowledge(state)
  const knowledge = state.atlasKnowledge[result.regionId]
  if (knowledge && !knowledge.visited) {
    knowledge.visited = true
    knowledge.mapped = true
    if (knowledge.firstVisitedTick === null) knowledge.firstVisitedTick = state.tick
    emit(state, 'region_visited', result.regionId)
    for (const neighborId of def.neighbors) {
      if (state.atlasKnowledge[neighborId]) {
        state.atlasKnowledge[neighborId].mapped = true
      }
    }
  }

  // Loot eggs of the region's native species — this is the main collection path.
  const eggs = Math.min(result.eggsLooted, region.eggsAvailable)
  region.eggsAvailable -= eggs
  if (eggs > 0) {
    withRng(state, (rng) => {
      for (let i = 0; i < eggs; i++) {
        const id = nextId(state, 'egg')
        state.eggs[id] = {
          id,
          speciesId: def.nativeSpecies,
          parents: null,
          rolledStats: rollSpeciesStats(def.nativeSpecies, rng),
          rolledTraits: rollSpeciesTraits(def.nativeSpecies, rng),
          incubatingTicksLeft: null,
        }
      }
    })
    log(state, 'good', `${eggs} ${SPECIES[def.nativeSpecies]?.name ?? 'wyvern'} egg(s) recovered.`)
  }

  // A wild wyvern tamed mid-battle joins as an adult, but distrustful.
  if (result.tamed) {
    withRng(state, (rng) => {
      const id = nextId(state, 'wy')
      state.wyverns[id] = createTamed(result.tamed!, id, state.nextId, rng)
    })
    log(state, 'good', `A wild ${SPECIES[result.tamed]?.name ?? 'wyvern'} submits to you.`)
  }
}

// ---------------------------------------------------------------------------
// World Atlas Discovery
// ---------------------------------------------------------------------------

function recordRegionVisit(state: GameState, regionId: string): void {
  const def = REGIONS[regionId]
  if (!def) return

  ensureAtlasKnowledge(state)
  const knowledge = state.atlasKnowledge[regionId]
  if (!knowledge) return

  // Idempotent: if already visited, do not re-emit or re-log
  if (knowledge.visited) return

  knowledge.visited = true
  knowledge.mapped = true
  if (knowledge.firstVisitedTick === null) {
    knowledge.firstVisitedTick = state.tick
  }

  // Discovering/visiting a region maps all its immediate neighbors
  for (const neighborId of def.neighbors) {
    if (state.atlasKnowledge[neighborId]) {
      state.atlasKnowledge[neighborId].mapped = true
    }
  }

  emit(state, 'region_visited', regionId)
  log(state, 'info', `Explored ${def.name}. Recorded in the World Atlas.`)
}

function discoverLandmark(state: GameState, regionId: string, landmarkId: string): void {
  const def = REGIONS[regionId]
  const atlas = REGION_ATLAS_DATA[regionId]
  if (!def || !atlas) return

  const landmarkDef = atlas.landmarks.find((lm) => lm.id === landmarkId)
  if (!landmarkDef) return

  ensureAtlasKnowledge(state)
  const knowledge = state.atlasKnowledge[regionId]
  if (!knowledge) return

  // Idempotent: return early if already discovered
  if (knowledge.discoveredLandmarkIds.includes(landmarkId)) return

  knowledge.discoveredLandmarkIds.push(landmarkId)
  knowledge.visited = true
  knowledge.mapped = true
  if (knowledge.firstVisitedTick === null) {
    knowledge.firstVisitedTick = state.tick
  }

  emit(state, 'landmark_discovered', regionId, landmarkId)
  log(state, 'good', `Discovered landmark: ${landmarkDef.name} in ${def.name}.`)
}

function observePhenomenon(state: GameState, regionId: string, phenomenonId: string): void {
  const def = REGIONS[regionId]
  if (!def) return
  // The phenomenon must belong to this region's biome family.
  if (!isPhenomenonOfRegion(regionId, phenomenonId)) return
  const phenomenon = PHENOMENA.find((p) => p.id === phenomenonId)
  if (!phenomenon) return

  ensureAtlasKnowledge(state)
  const knowledge = state.atlasKnowledge[regionId]
  if (!knowledge) return
  // Backfill the field for pre-Stage-4 saves.
  if (!knowledge.observedPhenomenonIds) knowledge.observedPhenomenonIds = []

  // Idempotent: a repeated observation adds nothing.
  if (knowledge.observedPhenomenonIds.includes(phenomenonId)) return

  knowledge.observedPhenomenonIds.push(phenomenonId)
  knowledge.visited = true
  knowledge.mapped = true
  if (knowledge.firstVisitedTick === null) {
    knowledge.firstVisitedTick = state.tick
  }

  emit(state, 'phenomenon_observed', regionId, phenomenonId)
  log(state, 'good', `Observed ${phenomenon.name} in ${def.name}.`)
}

function createTamed(speciesId: string, id: string, n: number, rng: Rng) {
  return createWyvern({
    id,
    speciesId,
    name: nameFor(speciesId, n),
    stats: rollSpeciesStats(speciesId, rng),
    traits: rollSpeciesTraits(speciesId, rng),
    stage: 'adult',
    origin: 'tamed',
    // Tamed wyverns start hostile-adjacent: they will disobey until trained.
    bond: 15,
  })
}

// ---------------------------------------------------------------------------
// Sanctuary Layout Management
// ---------------------------------------------------------------------------

function addSanctuaryObject(
  state: GameState,
  intent: Extract<Intent, { type: 'ADD_SANCTUARY_OBJECT' }>,
): void {
  const layout = ensureSanctuaryLayout(state)
  const count = layout.storage[intent.propId] ?? 0
  const isStructure = intent.category === 'structure'

  if (!isStructure && count <= 0) {
    return log(state, 'bad', `No ${intent.label} available in storage.`)
  }

  if (!isStructure) {
    layout.storage[intent.propId] = Math.max(0, count - 1)
  }

  const id = nextId(state, 'obj')
  layout.objects.push({
    id,
    propId: intent.propId,
    position: intent.position,
    rotationY: intent.rotationY,
    scale: intent.scale,
    category: intent.category,
    label: intent.label,
    interactableId: intent.interactableId,
    station: intent.station,
    panel: intent.panel,
    radius: intent.radius,
  })

  log(state, 'good', `Placed ${intent.label} in sanctuary.`)
}

function moveSanctuaryObject(
  state: GameState,
  id: string,
  position: [number, number, number],
  rotationY?: number,
): void {
  const layout = ensureSanctuaryLayout(state)
  const obj = layout.objects.find((o) => o.id === id)
  if (!obj) return
  obj.position = position
  if (rotationY !== undefined) obj.rotationY = rotationY
}

function rotateSanctuaryObject(state: GameState, id: string, rotationY: number): void {
  const layout = ensureSanctuaryLayout(state)
  const obj = layout.objects.find((o) => o.id === id)
  if (!obj) return
  obj.rotationY = rotationY
}

function storeSanctuaryObject(state: GameState, id: string): void {
  const layout = ensureSanctuaryLayout(state)
  const idx = layout.objects.findIndex((o) => o.id === id)
  if (idx === -1) return
  const [removed] = layout.objects.splice(idx, 1)
  if (removed && removed.category !== 'structure') {
    layout.storage[removed.propId] = (layout.storage[removed.propId] ?? 0) + 1
  }
  if (removed) {
    log(state, 'info', `Stored ${removed.label} to inventory.`)
  }
}

function resetSanctuaryLayout(state: GameState): void {
  state.sanctuaryLayout = createDefaultSanctuaryLayout()
  log(state, 'info', 'Sanctuary layout reset to default.')
}

function restoreSanctuaryLayout(state: GameState, layout: GameState['sanctuaryLayout']): void {
  state.sanctuaryLayout = cloneSanctuaryLayout(layout)
  log(state, 'info', 'Sanctuary layout restored.')
}
