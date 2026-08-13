import { create } from 'zustand'

export interface MapUiState {
  hovered: string | null
  inspected: string | null
  setHovered: (id: string | null) => void
  setInspected: (id: string | null) => void
  clear: () => void
}

export const useMapUiStore = create<MapUiState>((set) => ({
  hovered: null,
  inspected: null,

  setHovered: (id) =>
    set((state) => {
      if (state.hovered === id) return state
      return { hovered: id }
    }),

  setInspected: (id) =>
    set((state) => {
      if (state.inspected === id) return state
      return { inspected: id }
    }),

  clear: () =>
    set((state) => {
      if (state.hovered === null && state.inspected === null) return state
      return { hovered: null, inspected: null }
    }),
}))
