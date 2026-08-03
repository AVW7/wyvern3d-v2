import type { GameState } from '../types'
import { CONFIG } from '../data/config'
import { SPECIES } from '../data/species'
import { STATIONS } from '../data/stations'
import { capacityOf, log, nextId, withRng } from '../state/game'
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

/** Training, breeding, incubation, growth and recovery — one tick of sanctuary life. */
export function sanctuaryTick(state: GameState): void {
  trainingTick(state)
  breedingTick(state)
  incubationTick(state)
  growthTick(state)
  recoveryTick(state)
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

    withRng(state, (rng) => {
      // The hatchling takes after whichever parent the roll favours.
      const speciesId = rng.chance(0.5) ? w.speciesId : partner.speciesId
      const id = nextId(state, 'egg')
      state.eggs[id] = createEgg({
        id,
        speciesId,
        stats: breedStats(w.stats, partner.stats, rng),
        traits: breedTraits(w.traits, partner.traits, speciesId, rng),
        parents: [w.id, partner.id],
      })
    })
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
    log(state, 'good', `A ${SPECIES[egg.speciesId]?.name ?? 'wyvern'} has hatched.`)
  }
}

function growthTick(state: GameState): void {
  for (const w of Object.values(state.wyverns)) {
    if (w.stage === 'adult') continue
    w.ageTicks += 1

    if (w.stage === 'hatchling' && w.ageTicks >= CONFIG.wyvern.hatchlingTicks) {
      w.stage = 'juvenile'
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
      log(state, 'good', `${w.name} has come of age and can ride to war.`)
    }
  }
}

function recoveryTick(state: GameState): void {
  // Base recovery even without an infirmary; each level speeds it up.
  const rate = CONFIG.wyvern.healPerTick * (capacityOf(state, 'infirmary') + 1)
  for (const w of Object.values(state.wyverns)) {
    if (w.injury > 0) w.injury = Math.max(0, w.injury - rate)
    if (w.breedCooldown > 0) w.breedCooldown -= 1
  }
}
