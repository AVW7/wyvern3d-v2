'use client'

import { useEffect } from 'react'
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

/**
 * The store starts empty on both the server and the client's first render.
 *
 * Seeding `disabled` from localStorage at module init used to make those two
 * disagree: `/models` is server-rendered and prints a model's readiness as
 * text, so a stored preference had React hydrating "Disabled" over a server
 * "Active" and throwing a hydration error. The preference is applied by
 * `useModelLibraryHydration` instead, one tick later.
 */
export const useModelLibraryStore = create<ModelLibraryStore>()((set, get) => ({
  disabled: {},

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

let hydrated = false

/**
 * Applies the persisted preferences once, after mount.
 *
 * Call it from any tree that renders store-dependent output — the model
 * library page, and the play route so the world honours the preference from
 * its first frame. Repeat calls are no-ops.
 */
export function useModelLibraryHydration(): void {
  useEffect(() => {
    if (hydrated) return
    hydrated = true
    const stored = loadDisabled()
    if (Object.keys(stored).length > 0) useModelLibraryStore.setState({ disabled: stored })
  }, [])
}
