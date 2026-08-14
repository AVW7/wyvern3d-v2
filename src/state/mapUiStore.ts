import { create } from 'zustand'

export interface MapUiState {
  hovered: string | null
  inspected: string | null
  /** Atlas drawer open state (presentation-only; not in GameState). */
  atlasOpen: boolean
  setHovered: (id: string | null) => void
  setInspected: (id: string | null) => void
  setAtlasOpen: (open: boolean) => void
  toggleAtlas: () => void
  clear: () => void
}

export const useMapUiStore = create<MapUiState>((set) => ({
  hovered: null,
  inspected: null,
  atlasOpen: false,

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

  setAtlasOpen: (open) =>
    set((state) => {
      if (state.atlasOpen === open) return state
      return { atlasOpen: open }
    }),

  toggleAtlas: () =>
    set((state) => {
      return { atlasOpen: !state.atlasOpen }
    }),

  clear: () =>
    set((state) => {
      if (state.hovered === null && state.inspected === null && !state.atlasOpen) return state
      return { hovered: null, inspected: null, atlasOpen: false }
    }),
}))
