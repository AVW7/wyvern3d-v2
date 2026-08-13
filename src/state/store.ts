'use client'

import { create } from 'zustand'
import type { GameState } from '@/core/types'
import type { Intent, IntentLog } from '@/core/intents'
import { execute } from '@/core/executions'
import { createInitialState } from '@/core/state/game'
import { executeNextTick } from '@/core/state/tick'
import { loadGame, localStorageAdapter, saveGame, SAVE_KEY } from '@/core/state/save'

export type SceneMode = 'sanctuary' | 'worldmap' | 'battle' | 'highlands' | 'biome'

interface GameStore {
  /** The live core state. Mutated in place — never spread or cloned per frame. */
  state: GameState
  /** Bumped on every mutation so React knows to re-read. See useGameState(). */
  revision: number
  mode: SceneMode
  selectedRegion: string | null
  /** Recorded for replay: (seed, intents) reproduces the whole session. */
  intentLog: IntentLog
  loaded: boolean

  dispatch(intent: Intent): void
  tick(): void
  setMode(mode: SceneMode): void
  selectRegion(id: string | null): void
  save(): void
  load(): boolean
  reset(seed?: number): void
  exportReplay(): string
}

const INITIAL_SEED = 20260729

export const useGame = create<GameStore>()((set, get) => ({
  state: createInitialState(INITIAL_SEED),
  revision: 0,
  mode: 'sanctuary',
  selectedRegion: null,
  intentLog: { seed: INITIAL_SEED, entries: [] },
  loaded: false,

  /**
   * Applies an intent immediately and records it against the current tick.
   *
   * Immediate application is safe for replay because systems only run at tick
   * boundaries: an intent dispatched while `state.tick === N` lands before
   * tick N's systems either way. That gives zero input latency while keeping
   * `executeNextTick(state, [intent])` an exact replay of what happened.
   */
  dispatch(intent) {
    const { state, intentLog, revision } = get()
    intentLog.entries.push({ tick: state.tick, intent })
    execute(state, intent)
    set({ revision: revision + 1 })
  },

  tick() {
    const { state, revision } = get()
    executeNextTick(state)
    set({ revision: revision + 1 })
  },

  setMode(mode) {
    set({ mode })
  },

  selectRegion(id) {
    set({ selectedRegion: id })
  },

  save() {
    saveGame(localStorageAdapter, get().state, Date.now())
  },

  load() {
    const result = loadGame(localStorageAdapter, Date.now())
    if (!result) return false
    set({
      state: result.state,
      revision: get().revision + 1,
      // A loaded session starts a fresh log — the old one belongs to the state
      // that was serialized, and mixing them would produce an invalid replay.
      intentLog: { seed: result.state.seed, entries: [] },
      loaded: true,
    })
    return true
  },

  reset(seed = INITIAL_SEED) {
    localStorageAdapter.remove(SAVE_KEY)
    set({
      state: createInitialState(seed),
      revision: get().revision + 1,
      intentLog: { seed, entries: [] },
      mode: 'sanctuary',
      selectedRegion: null,
      loaded: true,
    })
  },

  exportReplay() {
    return JSON.stringify(get().intentLog, null, 2)
  },
}))

/**
 * Subscribes to state changes and returns the live core state.
 *
 * Because the core mutates in place, an object-returning selector would always
 * be reference-equal and never re-render. Subscribing to `revision` and then
 * reading the state fresh is what makes mutation-in-place safe for React.
 */
export function useGameState(): GameState {
  useGame((s) => s.revision)
  return useGame.getState().state
}

/** Direct, non-reactive access — for useFrame loops that must not re-render. */
export const getGameState = (): GameState => useGame.getState().state

export const dispatch = (intent: Intent): void => useGame.getState().dispatch(intent)
