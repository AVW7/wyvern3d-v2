import { create } from 'zustand'
import type { Intent } from '@/core/intents'

export type ContextActionPriority = 'delivery' | 'dutySource' | 'station' | 'wyvern'

export interface ContextAction {
  id: string
  label: string
  priority: ContextActionPriority
  disabledReason?: string
  /** If the context action opens a panel instead of emitting an intent directly */
  panel?: string
  station?: string
  /** Intent to dispatch when triggered */
  intent?: Intent
}

interface ContextActionState {
  currentAction: ContextAction | null
  setCurrentAction: (action: ContextAction | null) => void
  clear: () => void
}

export const useContextActionStore = create<ContextActionState>((set) => ({
  currentAction: null,
  setCurrentAction: (action) =>
    set((state) => {
      // Change guard: Avoid unnecessary state publication if identical
      if (!action && !state.currentAction) return state
      if (
        action &&
        state.currentAction &&
        action.id === state.currentAction.id &&
        action.label === state.currentAction.label &&
        action.disabledReason === state.currentAction.disabledReason
      ) {
        return state
      }
      return { currentAction: action }
    }),
  clear: () => set({ currentAction: null }),
}))
