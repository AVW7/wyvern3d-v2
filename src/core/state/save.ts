import type { GameState } from '../types'
import { CONFIG, SAVE_VERSION } from '../data/config'
import { createEgg, rollSpeciesStats, rollSpeciesTraits } from '../entities/wyvern'
import { createRng, deriveSeed } from '../math/rng'
import { nextId } from './game'
import { advanceTicks } from './tick'
import { ensureSanctuaryLayout, migrateLegacySanctuaryLayout } from './sanctuaryLayout'
import { ensureRegions } from './regionsState'
import { ensureAtlasKnowledge } from './atlasKnowledge'

/**
 * Storage is behind an interface so a server-backed save can replace
 * localStorage later without any other file changing.
 */
export interface SaveAdapter {
  read(key: string): string | null
  write(key: string, value: string): void
  remove(key: string): void
}

export const SAVE_KEY = 'wyvern3d.save.v1'

export interface SaveEnvelope {
  version: number
  /** Wall-clock ms at write time. Lives in the envelope, never in GameState —
   *  the core must stay free of real time to remain deterministic. */
  savedAt: number
  state: GameState
}

export const localStorageAdapter: SaveAdapter = {
  read: (key) => (typeof window === 'undefined' ? null : window.localStorage.getItem(key)),
  write: (key, value) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value)
  },
  remove: (key) => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(key)
  },
}

/** In-memory adapter for tests and the headless harnesses. */
export function memoryAdapter(): SaveAdapter {
  const store = new Map<string, string>()
  return {
    read: (key) => store.get(key) ?? null,
    write: (key, value) => void store.set(key, value),
    remove: (key) => void store.delete(key),
  }
}

type Migration = (state: GameState) => GameState

/**
 * Ordered migrations, indexed by the version they upgrade *from*.
 * Add a new entry whenever SAVE_VERSION is bumped; never edit an old one.
 */
const MIGRATIONS: Record<number, Migration> = {
  // 0 -> 1: pre-release saves lacked the battle hand-off fields.
  0: (state) => ({
    ...state,
    pendingBattle: state.pendingBattle ?? null,
    lastBattle: state.lastBattle ?? null,
    saveVersion: 1,
  }),
  // 1 -> 2: spread the default sanctuary into its new campus layout without
  // touching any structure that the player has already moved in the editor.
  1: (state) => ({
    ...state,
    sanctuaryLayout: migrateLegacySanctuaryLayout(ensureSanctuaryLayout(state)),
    saveVersion: 2,
  }),
  // 2 -> 3: hunting is rate-limited per wyvern. Treat an existing roster as
  // rested so loading an old save does not make the first hunt wait 45 ticks.
  2: (state) => ({
    ...state,
    wyverns: Object.fromEntries(
      Object.entries(state.wyverns).map(([id, wyvern]) => [
        id,
        {
          ...wyvern,
          lastHuntTick: wyvern.lastHuntTick ?? -CONFIG.wyvern.huntCooldownTicks,
        },
      ]),
    ),
    saveVersion: 3,
  }),
  // 3 -> 4: Thornmarch now yields Thornwing eggs. Give established owners one
  // deterministic egg without consuming the save's replay RNG stream.
  3: (state) => {
    const migrated: GameState = {
      ...state,
      eggs: { ...state.eggs },
      saveVersion: 4,
    }
    const ownsThornmarch = state.regions.thornmarch?.owner === 'player'
    const alreadyHasThornwing =
      Object.values(state.eggs).some((egg) => egg.speciesId === 'thornwing') ||
      Object.values(state.wyverns).some((wyvern) => wyvern.speciesId === 'thornwing')

    if (!ownsThornmarch || alreadyHasThornwing) return migrated

    const rng = createRng(deriveSeed(state.seed, 'save-v4:thornwing-egg'))
    let id = nextId(migrated, 'egg')
    while (migrated.eggs[id]) id = nextId(migrated, 'egg')
    migrated.eggs[id] = createEgg({
      id,
      speciesId: 'thornwing',
      stats: rollSpeciesStats('thornwing', rng),
      traits: rollSpeciesTraits('thornwing', rng),
      parents: null,
    })
    return migrated
  },
  // 4 -> 5: Sanctuary Economy, Agriculture, Wildlife Breeding & Infrastructure
  4: (state) => {
    const migrated: GameState = {
      ...state,
      resources: {
        ...state.resources,
        water: state.resources.water ?? 150,
        hide: state.resources.hide ?? 20,
        iron: state.resources.iron ?? 15,
      },
      buildings: {
        ...state.buildings,
        farm: state.buildings.farm ?? 0,
        aqueduct: state.buildings.aqueduct ?? 0,
        pasture: state.buildings.pasture ?? 0,
        foundry: state.buildings.foundry ?? 0,
        sawmill: state.buildings.sawmill ?? 0,
        housing: state.buildings.housing ?? 0,
      },
      economy: state.economy ?? {
        population: {
          total: 10,
          assigned: { farm: 2, aqueduct: 2, pasture: 2, foundry: 2, sawmill: 2, housing: 0 },
        },
        livestock: { deer: 4, boar: 2, goat: 3, bird: 8 },
      },
      saveVersion: 5,
    }
    return migrated
  },
  // 5 -> 6: Realm Governance, Ruler Edicts, Philosophy Academy & History Codex
  5: (state) => {
    const migrated: GameState = {
      ...state,
      buildings: {
        ...state.buildings,
        academy: state.buildings.academy ?? 1,
        apothecary: state.buildings.apothecary ?? 1,
        blacksmith: state.buildings.blacksmith ?? 0,
      },
      realm: state.realm ?? {
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
            tick: state.tick,
            title: 'The Royal Sovereign Rises',
            description: 'The realm realm framework was established.',
            category: 'royal',
          },
        ],
      },
      saveVersion: 6,
    }
    return migrated
  },
  // 6 -> 7: Ensure region state completeness for newly added regions
  6: (state) => {
    const migrated = ensureRegions(state)
    return {
      ...migrated,
      saveVersion: 7,
    }
  },
  // 7 -> 8: Unified Edict Yield Multipliers & Strategic Region Actions
  7: (state) => ({
    ...state,
    saveVersion: 8,
  }),
  // 8 -> 9: Discrete Game Events Stream and Sequence Counter
  8: (state) => ({
    ...state,
    nextEventSeq: state.nextEventSeq ?? (state.events?.length ?? 0),
    events: state.events ?? [],
    saveVersion: 9,
  }),
  // 9 -> 10: World Atlas Content & Persistent Knowledge Contract
  9: (state) => {
    const migrated = ensureAtlasKnowledge(state)
    return {
      ...migrated,
      saveVersion: 10,
    }
  },
  // 10 -> 11: Sanctuary Care Duties & Physical Routine Loop
  10: (state) => {
    const migrated = ensureSanctuaryDuties(state)
    return {
      ...migrated,
      saveVersion: 11,
    }
  },
}

export function ensureSanctuaryDuties(state: GameState): GameState {
  if (!state.duties) {
    state.duties = {
      nextSeq: 1,
      active: [],
      carriedDutyId: null,
      completed: 0,
    }
  }
  return state
}

export function migrate(state: GameState): GameState {
  let current = state
  let guard = 0
  while ((current.saveVersion ?? 0) < SAVE_VERSION) {
    const from = current.saveVersion ?? 0
    const step = MIGRATIONS[from]
    if (!step) {
      throw new Error(`No migration from save version ${from} to ${SAVE_VERSION}`)
    }
    current = step(current)
    // A migration that fails to advance the version would spin forever.
    if (++guard > 64) throw new Error('Migration loop did not converge')
  }
  return current
}

export function serialize(state: GameState, now: number): string {
  const envelope: SaveEnvelope = { version: SAVE_VERSION, savedAt: now, state }
  return JSON.stringify(envelope)
}

export interface LoadResult {
  state: GameState
  /** Ticks fast-forwarded to cover time spent away. */
  offlineTicks: number
}

/**
 * Parses a save and applies offline catch-up.
 *
 * `now` is passed in rather than read from `Date` so this stays testable and
 * so the core keeps its no-wall-clock guarantee.
 */
export function deserialize(raw: string, now: number): LoadResult | null {
  let envelope: SaveEnvelope
  try {
    envelope = JSON.parse(raw) as SaveEnvelope
  } catch {
    return null
  }
  if (!envelope?.state) return null

  const state = migrate(envelope.state)
  ensureRegions(state)
  ensureSanctuaryLayout(state)
  ensureAtlasKnowledge(state)
  ensureSanctuaryDuties(state)

  const elapsedMs = Math.max(0, now - (envelope.savedAt ?? now))
  const offlineTicks = Math.min(
    Math.floor(elapsedMs / 1000 / CONFIG.secondsPerTick),
    CONFIG.maxOfflineTicks,
  )
  if (offlineTicks > 0) advanceTicks(state, offlineTicks)

  return { state, offlineTicks }
}

export function saveGame(adapter: SaveAdapter, state: GameState, now: number): void {
  adapter.write(SAVE_KEY, serialize(state, now))
}

export function loadGame(adapter: SaveAdapter, now: number): LoadResult | null {
  const raw = adapter.read(SAVE_KEY)
  return raw === null ? null : deserialize(raw, now)
}
