'use client'

import { useEffect } from 'react'
import { create } from 'zustand'

const STORAGE_KEY = 'wyvern3d.sanctuaryColors'

export const DEFAULT_SANCTUARY_COLORS = {
  grass: '#6f7d55',
  soil: '#8a7a5c',
  roost: '#8a7a5c',
}

interface SanctuaryColorsStore {
  grass: string
  soil: string
  roost: string
  setGrass(color: string): void
  setSoil(color: string): void
  setRoost(color: string): void
  reset(): void
}

function loadInitial(): typeof DEFAULT_SANCTUARY_COLORS {
  if (typeof window === 'undefined') return DEFAULT_SANCTUARY_COLORS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SANCTUARY_COLORS
    return { ...DEFAULT_SANCTUARY_COLORS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SANCTUARY_COLORS
  }
}

function persist(colors: { grass: string; soil: string; roost: string }): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(colors))
}

/**
 * The store starts on the defaults on both the server and the client's first
 * render; `useSanctuaryColorsHydration` applies the saved palette after mount.
 *
 * Seeding from localStorage at module init would make those two disagree the
 * moment anything server-rendered reads a colour — the same hydration mismatch
 * that `modelLibraryStore` shipped with. Nothing renders these on the server
 * today, so this is a structural guard rather than a live bug fix.
 */
export const useSanctuaryColors = create<SanctuaryColorsStore>()((set, get) => ({
  ...DEFAULT_SANCTUARY_COLORS,

  setGrass(color) {
    set({ grass: color })
    persist({ ...get(), grass: color })
  },
  setSoil(color) {
    set({ soil: color })
    persist({ ...get(), soil: color })
  },
  setRoost(color) {
    set({ roost: color })
    persist({ ...get(), roost: color })
  },
  reset() {
    set(DEFAULT_SANCTUARY_COLORS)
    persist(DEFAULT_SANCTUARY_COLORS)
  },
}))

let hydrated = false

/**
 * Applies the saved palette once, after mount. Repeat calls are no-ops.
 *
 * Call it from any tree that reads a sanctuary colour — the play route covers
 * the scene, the ground and the editor HUD.
 */
export function useSanctuaryColorsHydration(): void {
  useEffect(() => {
    if (hydrated) return
    hydrated = true
    const stored = loadInitial()
    useSanctuaryColors.setState(stored)
  }, [])
}
