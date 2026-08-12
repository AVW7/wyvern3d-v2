'use client'

import { create } from 'zustand'
import type { AssetId } from '@/render/assets/manifest'

const STORAGE_KEY = 'wyvern3d.modelLibrary'

interface ModelLibraryStore {
  disabled: Partial<Record<AssetId, boolean>>
  isEnabled(id: AssetId): boolean
  setEnabled(id: AssetId, enabled: boolean): void
  reset(): void
}

function loadDisabled(): Partial<Record<AssetId, boolean>> {
  if (typeof window === 'undefined') return {}
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value ? JSON.parse(value) : {}
  } catch {
    return {}
  }
}

function persist(disabled: Partial<Record<AssetId, boolean>>): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(disabled))
}

export const useModelLibraryStore = create<ModelLibraryStore>()((set, get) => ({
  disabled: loadDisabled(),

  isEnabled(id) {
    return get().disabled[id] !== true
  },

  setEnabled(id, enabled) {
    set((state) => {
      const disabled = { ...state.disabled }
      if (enabled) delete disabled[id]
      else disabled[id] = true
      persist(disabled)
      return { disabled }
    })
  },

  reset() {
    persist({})
    set({ disabled: {} })
  },
}))
