import type { GameState } from '../types'
import { CONFIG } from '../data/config'
import { PHILOSOPHIES } from '../data/philosophies'
import { SPECIES } from '../data/species'
import { STATIONS } from '../data/stations'
import { capacityOf, emit, log, nextId, withRng } from '../state/game'
import {
  bondRate,
  breedStats,
  breedTraits,
  createEgg,
  createWyvern,
  nameFor,
  traitModifiers,
} from '../entities/wyvern'
import { clamp } from '../math/vec'

/** Training, breeding, incubation, growth, recovery and care duties — one tick of sanctuary life. */
export function sanctuaryTick(state: GameState): void {
  trainingTick(state)
  breedingTick(state)
  incubationTick(state)
  growthTick(state)
  recoveryTick(state)
  philosophyTick(state)
  dutiesTick(state)
}

function trainingTick(state: GameState): void {
  for (const w of Object.values(state.wyverns)) {
    if (w.assignment.kind !== 'training') continue
    w.assignment.ticksLeft -= 1
    if (w.assignment.ticksLeft > 0) continue

    const station = STATIONS[w.assignment.stationId]
    w.assignment = { kind: 'idle' }
    if (!station) continue

    w.stats[station.stat] += station.gain
    // Traits scale bond gain, so a Loyal wyvern becomes battle-reliable much
    // faster than a Stubborn one on the same schedule.
    w.bond = clamp(w.bond + station.bond * bondRate(w.traits), 0, CONFIG.wyvern.maxBond)
    emit(state, 'training_completed', w.id, station.id, { stat: station.stat, gain: station.gain, bond: station.bond })
    log(state, 'good', `${w.name} finishes at the ${station.name}. ${station.stat} +${station.gain}.`)
  }
}

function breedingTick(state: GameState): void {
  for (const w of Object.values(state.wyverns)) {
    if (w.assignment.kind !== 'breeding') continue
    w.assignment.ticksLeft -= 1
    if (w.assignment.ticksLeft > 0) continue

    const partner = state.wyverns[w.assignment.partnerId]
    // Both halves of the pair finish on the same tick. Only the lower id
    // produces the egg, or we would create two.
    const isLeader = !partner || w.id < partner.id
    w.assignment = { kind: 'idle' }
    w.breedCooldown = CONFIG.wyvern.breedCooldown
    if (!isLeader || !partner) continue

    partner.assignment = { kind: 'idle' }
    partner.breedCooldown = CONFIG.wyvern.breedCooldown

    let eggId = ''
    withRng(state, (rng) => {
      // The hatchling takes after whichever parent the roll favours.
      const speciesId = rng.chance(0.5) ? w.speciesId : partner.speciesId
      const id = nextId(state, 'egg')
      eggId = id
      state.eggs[id] = createEgg({
        id,
        speciesId,
        stats: breedStats(w.stats, partner.stats, rng),
        traits: breedTraits(w.traits, partner.traits, speciesId, rng),
        parents: [w.id, partner.id],
      })
    })
    emit(state, 'egg_laid', eggId, partner.id, { speciesId: state.eggs[eggId]?.speciesId, parents: [w.id, partner.id] })
    log(state, 'good', `${w.name} and ${partner.name} have produced an egg.`)
  }
}

function incubationTick(state: GameState): void {
  for (const egg of Object.values(state.eggs)) {
    if (egg.incubatingTicksLeft === null) continue
    egg.incubatingTicksLeft -= 1
    if (egg.incubatingTicksLeft > 0) continue

    delete state.eggs[egg.id]
    const id = nextId(state, 'wy')
    state.wyverns[id] = createWyvern({
      id,
      speciesId: egg.speciesId,
      name: nameFor(egg.speciesId, state.nextId),
      stats: egg.rolledStats,
      traits: egg.rolledTraits,
      stage: 'hatchling',
      origin: 'hatched',
      // Hatchlings imprint on you — the cheapest route to a high-bond mount.
      bond: 45,
    })
    emit(state, 'egg_hatched', id, egg.speciesId, { speciesId: egg.speciesId, stage: 'hatchling' })
    log(state, 'good', `A ${SPECIES[egg.speciesId]?.name ?? 'wyvern'} has hatched.`)
  }
}

function growthTick(state: GameState): void {
  for (const w of Object.values(state.wyverns)) {
    if (w.stage === 'adult') continue
    w.ageTicks += 1

    if (w.stage === 'hatchling' && w.ageTicks >= CONFIG.wyvern.hatchlingTicks) {
      w.stage = 'juvenile'
      emit(state, 'stage_promoted', w.id, undefined, { stage: 'juvenile' })
      log(state, 'info', `${w.name} is now a juvenile.`)
    } else if (
      w.stage === 'juvenile' &&
      w.ageTicks >= CONFIG.wyvern.hatchlingTicks + CONFIG.wyvern.juvenileTicks
    ) {
      w.stage = 'adult'
      // Maturity is where trait modifiers land, so an adult's sheet finally
      // reflects its lineage.
      const mods = traitModifiers(w.traits)
      for (const [stat, value] of Object.entries(mods)) {
        w.stats[stat as keyof typeof w.stats] += (value ?? 0) * 0.5
      }
      emit(state, 'stage_promoted', w.id, undefined, { stage: 'adult' })
      log(state, 'good', `${w.name} has come of age and can ride to war.`)
    }
  }
}

function recoveryTick(state: GameState): void {
  const waterMastery = state.realm?.grandMaster?.masteryLevels?.water ?? 0
  const hasStoicism = state.realm?.philosophies?.unlocked?.includes('stoicism')
  const stoicismMult = hasStoicism ? 1.25 : 1.0
  const waterMult = 1 + waterMastery * CONFIG.grandMaster.waterBonusPerLevel

  // Base recovery even without an infirmary; each level speeds it up.
  const rate = CONFIG.wyvern.healPerTick * (capacityOf(state, 'infirmary') + 1) * stoicismMult * waterMult
  for (const w of Object.values(state.wyverns)) {
    if (w.injury > 0) w.injury = Math.max(0, w.injury - rate)
    if (w.breedCooldown > 0) w.breedCooldown -= 1
  }
}

function philosophyTick(state: GameState): void {
  if (!state.realm?.philosophies?.activeResearch) return
  const academyWorkers = state.economy?.population?.assigned?.academy ?? 0
  if (academyWorkers <= 0) return

  state.realm.philosophies.researchProgress += 1
  const targetId = state.realm.philosophies.activeResearch
  const targetDef = PHILOSOPHIES[targetId]
  if (!targetDef) return

  if (state.realm.philosophies.researchProgress >= targetDef.researchDurationTicks) {
    state.realm.philosophies.unlocked.push(targetId)
    state.realm.philosophies.activeResearch = null
    state.realm.philosophies.researchProgress = 0

    log(state, 'good', `Sanctuary Scholars completed research on ${targetDef.name}!`)
    state.realm.history.unshift({
      tick: state.tick,
      title: `Unlocked: ${targetDef.name}`,
      description: `The scholars completed the treatise on ${targetDef.subtitle}.`,
      category: 'philosophy',
    })
  }
}

function dutiesTick(state: GameState): void {
  if (!state.duties) return

  // Prune any active duties whose subject wyvern no longer exists
  state.duties.active = state.duties.active.filter((d) => state.wyverns[d.subjectId])
  if (state.duties.carriedDutyId && !state.duties.active.some((d) => d.id === state.duties.carriedDutyId)) {
    state.duties.carriedDutyId = null
  }

  // If active duty cap is reached, do not generate new ones
  if (state.duties.active.length >= CONFIG.duties.maxActive) return

  const existingSubjects = new Set(state.duties.active.map((d) => d.subjectId))
  const allWyverns = Object.values(state.wyverns).sort((a, b) => a.id.localeCompare(b.id))

  // 1. Feed duty: hungry wyverns (hunger >= 30)
  const hungryWyverns = allWyverns.filter(
    (w) => w.hunger >= CONFIG.duties.feed.threshold && !existingSubjects.has(w.id),
  )
  if (hungryWyverns.length > 0) {
    const candidate = hungryWyverns[0]!
    const dutyId = state.duties.nextSeq++
    state.duties.active.push({
      id: dutyId,
      kind: 'feed',
      subjectId: candidate.id,
      createdTick: state.tick,
      status: 'available',
    })
    log(state, 'info', `${candidate.name} is hungry and awaits feeding.`)
    return
  }

  // 2. Medicine duty: injured wyverns (injury >= 30)
  const injuredWyverns = allWyverns.filter(
    (w) => w.injury >= CONFIG.duties.medicine.injuryThreshold && !existingSubjects.has(w.id),
  )
  if (injuredWyverns.length > 0) {
    const candidate = injuredWyverns[0]!
    const dutyId = state.duties.nextSeq++
    state.duties.active.push({
      id: dutyId,
      kind: 'medicine',
      subjectId: candidate.id,
      createdTick: state.tick,
      status: 'available',
    })
    log(state, 'info', `${candidate.name} is injured and needs medicine.`)
    return
  }

  // 3. Companionship duty: idle wyverns with lower bond (bond <= 70)
  const lonelyWyverns = allWyverns.filter(
    (w) =>
      w.assignment.kind === 'idle' &&
      w.bond <= CONFIG.duties.companionship.maxBondThreshold &&
      !existingSubjects.has(w.id),
  )
  if (lonelyWyverns.length > 0) {
    const candidate = lonelyWyverns[0]!
    const dutyId = state.duties.nextSeq++
    state.duties.active.push({
      id: dutyId,
      kind: 'companionship',
      subjectId: candidate.id,
      createdTick: state.tick,
      status: 'available',
    })
    log(state, 'info', `${candidate.name} seeks companionship.`)
    return
  }

  // 4. Flight exercise duty: idle flight-capable wyverns (juvenile or adult)
  const flightWyverns = allWyverns.filter(
    (w) =>
      w.assignment.kind === 'idle' &&
      (w.stage === 'juvenile' || w.stage === 'adult') &&
      !existingSubjects.has(w.id),
  )
  if (flightWyverns.length > 0) {
    const candidate = flightWyverns[0]!
    const dutyId = state.duties.nextSeq++
    state.duties.active.push({
      id: dutyId,
      kind: 'flightExercise',
      subjectId: candidate.id,
      createdTick: state.tick,
      status: 'available',
    })
    log(state, 'info', `${candidate.name} is ready for flight ring exercise.`)
    return
  }
}
