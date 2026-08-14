import type { BuildingId, GameEventKind, GameState, LogEntry, RegionState, Resources, ResourceId } from '../types'
import { BUILDINGS } from '../data/buildings'
import { CONFIG, SAVE_VERSION } from '../data/config'
import { REGIONS, STARTING_REGION } from '../data/regions'
import { SPECIES } from '../data/species'
import { createRng, type Rng } from '../math/rng'
import { createWyvern, nameFor, rollSpeciesStats, rollSpeciesTraits } from '../entities/wyvern'

export const RESOURCE_IDS: ResourceId[] = ['food', 'gold', 'ore', 'timber', 'arcane', 'water', 'hide', 'iron']

export const emptyResources = (): Resources => ({
  food: 0,
  gold: 0,
  ore: 0,
  timber: 0,
  arcane: 0,
  water: 0,
  hide: 0,
  iron: 0,
})

/**
 * Runs `fn` with an RNG resumed from the state's stored cursor, then writes the
 * cursor back. Every random draw in the core must go through this — unseeded
 * random draws silently break replay and the balance harness.
 */
export function withRng<T>(state: GameState, fn: (rng: Rng) => T): T {
  const rng = createRng(state.rngState)
  const result = fn(rng)
  state.rngState = rng.state()
  return result
}

export function nextId(state: GameState, prefix: string): string {
  state.nextId += 1
  return `${prefix}_${state.nextId}`
}

export function log(state: GameState, kind: LogEntry['kind'], message: string): void {
  state.log.push({ tick: state.tick, kind, message })
  if (state.log.length > CONFIG.logLimit) state.log.splice(0, state.log.length - CONFIG.logLimit)
}

export function emit(
  state: GameState,
  kind: GameEventKind,
  subjectId: string,
  objectId?: string,
  payload?: Record<string, unknown>,
): void {
  state.events.push({
    seq: state.nextEventSeq++,
    tick: state.tick,
    kind,
    subjectId,
    objectId,
    payload,
  })
  if (state.events.length > CONFIG.eventLimit) {
    state.events.splice(0, state.events.length - CONFIG.eventLimit)
  }
}

export const canAfford = (state: GameState, cost: Partial<Resources>): boolean =>
  RESOURCE_IDS.every((id) => state.resources[id] >= (cost[id] ?? 0))

export function spend(state: GameState, cost: Partial<Resources>): void {
  for (const id of RESOURCE_IDS) state.resources[id] -= cost[id] ?? 0
}

export function gain(state: GameState, amount: Partial<Resources>): void {
  for (const id of RESOURCE_IDS) state.resources[id] += amount[id] ?? 0
}

/** Slot capacity granted by a building at its current level. 0 when unbuilt. */
export function capacityOf(state: GameState, id: BuildingId): number {
  const level = state.buildings[id] ?? 0
  if (level <= 0) return 0
  const tiers = BUILDINGS[id]?.capacityPerLevel ?? []
  return tiers[Math.min(level, tiers.length) - 1] ?? 0
}

export const ownedRegions = (state: GameState): RegionState[] =>
  Object.values(state.regions).filter((r) => r.owner === 'player')

/** A region is attackable when an adjacent region is already held. */
export function isAttackable(state: GameState, regionId: string): boolean {
  const region = state.regions[regionId]
  const def = REGIONS[regionId]
  if (!region || !def || region.owner === 'player') return false
  return def.neighbors.some((n) => state.regions[n]?.owner === 'player')
}

import { createDefaultSanctuaryLayout } from './sanctuaryLayout'
import { ensureRegions } from './regionsState'
import { ensureAtlasKnowledge } from './atlasKnowledge'

export function createInitialState(seed: number): GameState {
  const state: GameState = {
    saveVersion: SAVE_VERSION,
    seed,
    rngState: seed >>> 0,
    tick: 0,
    resources: { ...CONFIG.starting.resources },
    wyverns: {},
    eggs: {},
    squads: {},
    regions: {},
    atlasKnowledge: {},
    duties: {
      nextSeq: 1,
      active: [],
      carriedDutyId: null,
      completed: 0,
    },
    buildings: {
      hatchery: 1,
      trainingGrounds: 1,
      barracks: 1,
      infirmary: 0,
      farm: 1,
      aqueduct: 1,
      pasture: 1,
      foundry: 0,
      sawmill: 0,
      housing: 1,
      academy: 1,
      apothecary: 1,
      blacksmith: 0,
    },
    economy: {
      population: {
        total: CONFIG.starting.population,
        assigned: { farm: 2, aqueduct: 2, pasture: 2, foundry: 0, sawmill: 0, housing: 0, academy: 1, apothecary: 1, blacksmith: 0 },
      },
      livestock: { ...CONFIG.starting.livestock },
    },
    realm: {
      ruler: {
        title: 'king',
        edict: 'conquest_harvest',
        prestige: 10,
      },
      grandMaster: {
        masteryLevels: { fire: 1, water: 1, earth: 1, air: 1 },
        activeFocus: 'fire',
      },
      philosophies: {
        unlocked: ['balance'],
        activeResearch: null,
        researchProgress: 0,
      },
      equipment: {
        wyvern_armor: 0,
        flame_spears: 0,
        iron_shields: 0,
      },
      elixirs: {
        vitality_salve: 3,
        dragon_tonic: 1,
        growth_elixir: 0,
      },
      history: [
        {
          tick: 0,
          title: 'The Royal Banners Rise',
          description: 'The King has declared Hearthvale the high throne of the dragon realm.',
          category: 'royal',
        },
      ],
    },
    sanctuaryLayout: createDefaultSanctuaryLayout(),
    nextId: 0,
    log: [],
    nextEventSeq: 0,
    events: [],
    pendingBattle: null,
    lastBattle: null,
  }

  ensureRegions(state)
  ensureAtlasKnowledge(state)

  withRng(state, (rng) => {
    for (const speciesId of CONFIG.starting.wyverns) {
      if (!SPECIES[speciesId]) continue
      const id = nextId(state, 'wy')
      state.wyverns[id] = createWyvern({
        id,
        speciesId,
        name: nameFor(speciesId, state.nextId),
        stats: rollSpeciesStats(speciesId, rng),
        traits: rollSpeciesTraits(speciesId, rng),
        stage: 'adult',
        origin: 'starter',
        bond: 60,
      })
    }
  })

  for (const s of CONFIG.starting.squads) {
    const id = nextId(state, 'sq')
    state.squads[id] = { id, unitId: s.unitId, strength: s.strength, stationedAt: null }
  }

  log(state, 'info', `The banners rise over ${REGIONS[STARTING_REGION]?.name ?? 'the valley'}.`)
  return state
}
