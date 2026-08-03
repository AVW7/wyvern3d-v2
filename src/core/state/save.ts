import type { GameState } from '../types'
import { CONFIG, SAVE_VERSION } from '../data/config'
import { advanceTicks } from './tick'
import { ensureSanctuaryLayout, migrateLegacySanctuaryLayout } from './sanctuaryLayout'

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
  ensureSanctuaryLayout(state)

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
