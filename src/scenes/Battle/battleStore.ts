'use client'

import { create } from 'zustand'

export interface BattleSnapshot {
  time: number
  /** 0..1 */
  hp: number
  stamina: number
  enemiesLeft: number
  alliesLeft: number
  canTame: boolean
}

interface BattleStore extends BattleSnapshot {
  message: string | null
  selectedAllyId: string | null
  /** Consumed by the battle scene's frame loop and forwarded to the sim. */
  orderRequest: { allyId: string; targetId: string } | null
  /** Broadcast orders keyed off a counter so repeats still fire. */
  broadcast: { kind: 'regroup' | 'hold' | 'clear'; nonce: number } | null

  sync(next: BattleSnapshot): void
  select(actorId: string, side: 'attacker' | 'defender'): void
  consumeOrder(): BattleStore['orderRequest']
  consumeBroadcast(): BattleStore['broadcast']
  issueBroadcast(kind: 'regroup' | 'hold' | 'clear'): void
  setMessage(message: string | null): void
  reset(): void
}

const EMPTY: BattleSnapshot = {
  time: 0,
  hp: 1,
  stamina: 1,
  enemiesLeft: 0,
  alliesLeft: 0,
  canTame: false,
}

export const useBattle = create<BattleStore>()((set, get) => ({
  ...EMPTY,
  message: null,
  selectedAllyId: null,
  orderRequest: null,
  broadcast: null,

  /**
   * Called every frame from the sim loop, so it must not set state unless
   * something a human could see has changed. Bars are compared at 1% and the
   * clock at 0.1s — anything finer would re-render the HUD 60 times a second
   * for no visible benefit.
   */
  sync(next) {
    const prev = get()
    const changed =
      Math.abs(prev.hp - next.hp) > 0.01 ||
      Math.abs(prev.stamina - next.stamina) > 0.01 ||
      Math.abs(prev.time - next.time) > 0.1 ||
      prev.enemiesLeft !== next.enemiesLeft ||
      prev.alliesLeft !== next.alliesLeft ||
      prev.canTame !== next.canTame
    if (changed) set(next)
  },

  select(actorId, side) {
    if (side === 'attacker') {
      set({ selectedAllyId: actorId, message: 'Wyvern selected — click a target to order an attack.' })
      return
    }
    const allyId = get().selectedAllyId
    if (!allyId) {
      set({ message: 'Select one of your own first.' })
      return
    }
    set({ orderRequest: { allyId, targetId: actorId }, message: 'Order given.' })
  },

  consumeOrder() {
    const order = get().orderRequest
    if (order) set({ orderRequest: null })
    return order
  },

  consumeBroadcast() {
    const b = get().broadcast
    if (b) set({ broadcast: null })
    return b
  },

  issueBroadcast(kind) {
    set({ broadcast: { kind, nonce: get().broadcast ? get().broadcast!.nonce + 1 : 1 } })
  },

  setMessage(message) {
    set({ message })
  },

  reset() {
    set({ ...EMPTY, message: null, selectedAllyId: null, orderRequest: null, broadcast: null })
  },
}))
