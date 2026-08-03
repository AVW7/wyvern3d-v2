'use client'

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

export const useSanctuaryColors = create<SanctuaryColorsStore>()((set, get) => ({
  ...loadInitial(),

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
