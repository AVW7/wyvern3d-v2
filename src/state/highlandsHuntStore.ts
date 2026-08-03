'use client'

import { create } from 'zustand'
import type { WyvernInstance } from '@/core/types'
import type { ModelState } from '@/render/assets/manifest'

export type HighlandsMode = 'guided' | 'playable' | 'explore'
export type HighlandsHuntPhase =
  | 'launcher'
  | 'ready'
  | 'search'
  | 'fire'
  | 'strike'
  | 'grip'
  | 'carry'
  | 'drop'
  | 'landing'
  | 'eat'
  | 'finish'
  | 'complete'
export type HighlandsDoeLifecycle = 'alive' | 'claimed' | 'carried' | 'feeding' | 'respawning'
export type HighlandsDoeAnimation = Extract<ModelState, 'idle' | 'walk' | 'eat' | 'death'>

export interface HighlandsDoe {
  id: string
  position: [number, number]
  yaw: number
  lifecycle: HighlandsDoeLifecycle
  animation: HighlandsDoeAnimation
}

const DOE_SPAWNS: readonly Omit<HighlandsDoe, 'lifecycle' | 'animation'>[] = [
  { id: 'doe-meadow', position: [-7, 13], yaw: Math.PI * 0.82 },
  { id: 'doe-ridge', position: [30, -18], yaw: -Math.PI * 0.2 },
]

export const HIGHLANDS_DOE_RESPAWN_MS = 8000

export function createHighlandsDoes(): HighlandsDoe[] {
  return DOE_SPAWNS.map((doe) => ({ ...doe, position: [...doe.position] as [number, number], lifecycle: 'alive', animation: 'idle' }))
}

/** Highlands is currently an adult-only animation and interaction test. */
export function isHighlandsHunter(
  wyvern: Pick<WyvernInstance, 'stage'> | null | undefined,
): wyvern is Pick<WyvernInstance, 'stage'> & { stage: 'adult' } {
  return wyvern?.stage === 'adult'
}

interface HighlandsHuntState {
  /** The adult shown in the current test session. Never serialized into GameState. */
  selectedWyvernId: string | null
  mode: HighlandsMode | null
  phase: HighlandsHuntPhase
  activeDoeId: string | null
  does: HighlandsDoe[]
  wyvernState: ModelState
  wyvernAction: ModelState | null
  wyvernActionToken: number
  /** Increments each time the scene should reset its local transforms. */
  sessionToken: number

  open(selectedWyvernId?: string | null): void
  selectWyvern(wyvernId: string): void
  start(mode: HighlandsMode): boolean
  setWyvernState(state: ModelState): void
  startAction(state: ModelState): void
  claimDoe(doeId: string): boolean
  beginFire(doeId: string): boolean
  beginStrike(): boolean
  beginGrip(): boolean
  beginCarry(): boolean
  beginDrop(): boolean
  beginLanding(): boolean
  beginEat(position: [number, number]): boolean
  beginFinish(): boolean
  finishHunt(): boolean
  advanceDoeAmbient(doeId: string): void
  respawnDoe(doeId: string): void
  reset(): void
}

function freshSession(selectedWyvernId: string | null, token: number) {
  return {
    selectedWyvernId,
    mode: null,
    phase: 'launcher' as const,
    activeDoeId: null,
    does: createHighlandsDoes(),
    wyvernState: 'idle' as ModelState,
    wyvernAction: null,
    wyvernActionToken: 0,
    sessionToken: token,
  }
}

/**
 * Highlands' entire hunt loop is presentation state. It deliberately does not
 * dispatch an intent or reference resources, hunger, cooldowns, saves, or the
 * deterministic simulation clock.
 */
export const useHighlandsHunt = create<HighlandsHuntState>()((set, get) => ({
  ...freshSession(null, 0),

  open(selectedWyvernId = null) {
    set((state) => freshSession(selectedWyvernId, state.sessionToken + 1))
  },

  selectWyvern(wyvernId) {
    set((state) =>
      state.selectedWyvernId === wyvernId
        ? state
        : { selectedWyvernId: wyvernId },
    )
  },

  start(mode) {
    const state = get()
    if (!state.selectedWyvernId) return false
    const target = state.does.find((doe) => doe.lifecycle === 'alive')
    if (!target) return false

    set((current) => ({
      mode,
      phase: mode === 'guided' ? 'search' : 'ready',
      activeDoeId: target.id,
      wyvernState: mode === 'guided' ? 'fly' : 'idle',
      wyvernAction: null,
      sessionToken: current.sessionToken + 1,
    }))
    return true
  },

  setWyvernState(wyvernState) {
    set((state) => (state.wyvernState === wyvernState ? state : { wyvernState }))
  },

  startAction(wyvernAction) {
    set((state) => ({
      wyvernAction,
      wyvernActionToken: state.wyvernActionToken + 1,
    }))
  },

  claimDoe(doeId) {
    const doe = get().does.find((candidate) => candidate.id === doeId)
    if (!doe || doe.lifecycle !== 'alive') return false
    set((state) => ({
      does: state.does.map((candidate) =>
        candidate.id === doeId
          ? { ...candidate, lifecycle: 'claimed', animation: 'death' }
          : candidate,
      ),
      activeDoeId: doeId,
    }))
    return true
  },

  beginFire(doeId) {
    const target = get().does.find((doe) => doe.id === doeId && doe.lifecycle === 'alive')
    if (!target || !['search', 'ready'].includes(get().phase)) return false
    set((state) => ({
      phase: 'fire',
      activeDoeId: doeId,
      wyvernAction: 'breatheAir',
      wyvernActionToken: state.wyvernActionToken + 1,
    }))
    return true
  },

  beginStrike() {
    const doeId = get().activeDoeId
    if (!doeId || get().phase !== 'fire' || !get().claimDoe(doeId)) return false
    set((state) => ({
      phase: 'strike',
      wyvernState: 'dive',
      wyvernAction: 'attackAir',
      wyvernActionToken: state.wyvernActionToken + 1,
    }))
    return true
  },

  beginGrip() {
    if (get().phase !== 'strike') return false
    set((state) => ({
      phase: 'grip',
      wyvernState: 'idle',
      wyvernAction: 'huntGrip',
      wyvernActionToken: state.wyvernActionToken + 1,
    }))
    return true
  },

  beginCarry() {
    const doeId = get().activeDoeId
    if (!doeId || get().phase !== 'grip') return false
    set((state) => ({
      phase: 'carry',
      wyvernState: 'huntCarry',
      wyvernAction: null,
      does: state.does.map((doe) =>
        doe.id === doeId ? { ...doe, lifecycle: 'carried' } : doe,
      ),
    }))
    return true
  },

  beginDrop() {
    if (get().phase !== 'carry') return false
    set((state) => ({
      phase: 'drop',
      wyvernState: 'fly',
      wyvernAction: 'drop',
      wyvernActionToken: state.wyvernActionToken + 1,
    }))
    return true
  },

  beginLanding() {
    if (get().phase !== 'carry') return false
    set({ phase: 'landing', wyvernState: 'land', wyvernAction: null })
    return true
  },

  beginEat(position) {
    const doeId = get().activeDoeId
    if (!doeId || get().phase !== 'landing') return false
    set((state) => ({
      phase: 'eat',
      wyvernState: 'idle',
      wyvernAction: 'eat',
      wyvernActionToken: state.wyvernActionToken + 1,
      does: state.does.map((doe) =>
        doe.id === doeId
          ? { ...doe, position: [...position] as [number, number], lifecycle: 'feeding' }
          : doe,
      ),
    }))
    return true
  },

  beginFinish() {
    const doeId = get().activeDoeId
    if (!doeId || get().phase !== 'eat') return false
    set((state) => ({
      phase: 'finish',
      wyvernAction: 'huntFinish',
      wyvernActionToken: state.wyvernActionToken + 1,
      does: state.does.map((doe) =>
        doe.id === doeId ? { ...doe, lifecycle: 'respawning' } : doe,
      ),
    }))
    return true
  },

  finishHunt() {
    const doeId = get().activeDoeId
    if (!doeId || get().phase !== 'finish') return false
    set(() => ({
      phase: 'complete',
      wyvernState: 'idle',
      wyvernAction: null,
    }))
    return true
  },

  advanceDoeAmbient(doeId) {
    set((state) => ({
      does: state.does.map((doe) => {
        if (doe.id !== doeId || doe.lifecycle !== 'alive') return doe
        const animation: HighlandsDoeAnimation =
          doe.animation === 'idle' ? 'walk' : doe.animation === 'walk' ? 'eat' : 'idle'
        return { ...doe, animation }
      }),
    }))
  },

  respawnDoe(doeId) {
    set((state) => ({
      does: state.does.map((doe) =>
        doe.id === doeId && doe.lifecycle === 'respawning'
          ? { ...doe, lifecycle: 'alive', animation: 'idle' }
          : doe,
      ),
    }))
  },

  reset() {
    set((state) => freshSession(null, state.sessionToken + 1))
  },
}))
