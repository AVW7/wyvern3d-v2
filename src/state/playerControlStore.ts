'use client'

import { create } from 'zustand'

export type ControlMode = 'human' | 'wyvern'

export interface PlayerControlState {
  controlMode: ControlMode
  activeWyvernId: string | null
  
  shiftToHuman: () => void
  shiftToWyvern: (wyvernId: string) => void
  toggleShift: (availableWyvernIds?: string[]) => void
  setActiveWyvernId: (wyvernId: string | null) => void
}

export const usePlayerControlStore = create<PlayerControlState>()((set, get) => ({
  controlMode: 'human',
  activeWyvernId: null,

  shiftToHuman: () => set({ controlMode: 'human' }),
  
  shiftToWyvern: (wyvernId: string) => set({ controlMode: 'wyvern', activeWyvernId: wyvernId }),

  setActiveWyvernId: (wyvernId: string | null) => set({ activeWyvernId: wyvernId }),

  toggleShift: (availableWyvernIds: string[] = []) => {
    const { controlMode, activeWyvernId } = get()
    if (controlMode === 'wyvern') {
      set({ controlMode: 'human' })
    } else {
      const targetId = activeWyvernId ?? availableWyvernIds[0] ?? null
      if (targetId) {
        set({ controlMode: 'wyvern', activeWyvernId: targetId })
      }
    }
  },
}))
