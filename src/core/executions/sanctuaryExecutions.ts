import type { GameState } from '../types'
import { CONFIG } from '../data/config'
import { REGIONS } from '../data/regions'
import { SPECIES } from '../data/species'
import { STATIONS } from '../data/stations'
import {
  canAfford,
  capacityOf,
  emit,
  gain,
  log,
  nextId,
  spend,
  withRng,
} from '../state/game'
import {
  rollSpeciesStats,
  rollSpeciesTraits,
} from '../entities/wyvern'
import { clamp } from '../math/vec'

export function countAssigned(state: GameState, kind: 'training' | 'breeding'): number {
  return Object.values(state.wyverns).filter((w) => w.assignment.kind === kind).length
}

export function assignTraining(state: GameState, wyvernId: string, stationId: string): void {
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

export function cancelAssignment(state: GameState, wyvernId: string): void {
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

export function startBreeding(state: GameState, aId: string, bId: string): void {
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

export function incubateEgg(state: GameState, eggId: string): void {
  const egg = state.eggs[eggId]
  if (!egg || egg.incubatingTicksLeft !== null) return
  const inSlots = Object.values(state.eggs).filter((e) => e.incubatingTicksLeft !== null).length
  if (inSlots >= capacityOf(state, 'hatchery')) {
    return log(state, 'bad', 'Every roost is occupied — upgrade the Hatchery.')
  }
  egg.incubatingTicksLeft = CONFIG.wyvern.incubationTicks
  log(state, 'info', `A ${SPECIES[egg.speciesId]?.name ?? 'wyvern'} egg is set to warm.`)
}

export function feedWyvern(state: GameState, wyvernId: string): void {
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
export function huntWildlife(state: GameState, wyvernId: string, prey: 'deer' | 'bird'): void {
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

export function setWyvernPerch(state: GameState, wyvernId: string, perchIndex: number): void {
  const w = state.wyverns[wyvernId]
  if (!w) return
  w.preferredPerchIndex = perchIndex
  log(state, 'info', `${w.name}'s idle perch assigned to Spot ${perchIndex + 1}.`)
}

export function renameWyvern(state: GameState, wyvernId: string, name: string): void {
  const w = state.wyverns[wyvernId]
  const trimmed = name.trim().slice(0, 24)
  if (!w || trimmed.length === 0) return
  w.name = trimmed
}

export function releaseWyvern(state: GameState, wyvernId: string): void {
  const w = state.wyverns[wyvernId]
  if (!w) return
  cancelAssignment(state, wyvernId)
  delete state.wyverns[wyvernId]
  emit(state, 'wyvern_died', w.id)
  log(state, 'info', `${w.name} is released to the wild.`)
}

export function takeDutyItem(state: GameState, dutyId: number): void {
  if (!state.duties) return
  const duty = state.duties.active.find((d) => d.id === dutyId)
  if (!duty || duty.status !== 'available') return

  duty.status = 'carrying'
  state.duties.carriedDutyId = duty.id
  log(state, 'info', `Collected provisions for duty #${duty.id}.`)
}

export function abandonDutyItem(state: GameState, dutyId: number): void {
  if (!state.duties) return
  const duty = state.duties.active.find((d) => d.id === dutyId)
  if (!duty || duty.status !== 'carrying') return

  duty.status = 'available'
  if (state.duties.carriedDutyId === duty.id) {
    state.duties.carriedDutyId = null
  }
  log(state, 'info', `Returned provisions for duty #${duty.id}.`)
}

export function completeDuty(state: GameState, dutyId: number): void {
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
    checkDutyMilestones(state)

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
    checkDutyMilestones(state)

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
    checkDutyMilestones(state)

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
    checkDutyMilestones(state)

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

export function checkDutyMilestones(state: GameState): void {
  if (!state.duties) return
  if (!state.duties.unlockedMilestones) {
    state.duties.unlockedMilestones = []
  }
  const milestones = CONFIG.duties.milestones ?? []
  for (const milestone of milestones) {
    if (
      state.duties.completed >= milestone.threshold &&
      !state.duties.unlockedMilestones.includes(milestone.id)
    ) {
      state.duties.unlockedMilestones.push(milestone.id)

      if (milestone.grantStorage && state.sanctuaryLayout) {
        if (!state.sanctuaryLayout.storage) {
          state.sanctuaryLayout.storage = {}
        }
        for (const [propId, count] of Object.entries(milestone.grantStorage)) {
          state.sanctuaryLayout.storage[propId] = (state.sanctuaryLayout.storage[propId] ?? 0) + count
        }
      }

      emit(state, 'sanctuary_milestone_unlocked', milestone.id, undefined, {
        milestoneId: milestone.id,
        title: milestone.title,
        dutyCount: state.duties.completed,
      })
      log(state, 'good', `✦ Sanctuary improvement unlocked: ${milestone.title}! New props added to storage.`)
    }
  }
}

export function garrisonWyvern(state: GameState, wyvernId: string, regionId: string | null): void {
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

export function collectRegionEggs(state: GameState, regionId: string): void {
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
