import type { GameState } from '../types'
import type { Intent } from '../intents'
import { CONFIG } from '../data/config'
import { REGIONS } from '../data/regions'
import { SPECIES } from '../data/species'
import { UNITS } from '../data/units'
import {
  emit,
  gain,
  isAttackable,
  log,
  nextId,
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
import { ensureAtlasKnowledge } from '../state/atlasKnowledge'

export function createTamed(speciesId: string, id: string, n: number, rng: Rng) {
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

export function launchAttack(
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

export function resolveBattle(state: GameState, result: GameState['lastBattle']): void {
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
