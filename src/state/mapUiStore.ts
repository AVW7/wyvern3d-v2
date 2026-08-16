import { create } from 'zustand'
import type { AtlasLayerId } from '@/core/state/atlasLayers'

const STORAGE_KEY_LAYER = 'wyvern_atlas_layer'

function getInitialLayer(): AtlasLayerId {
  if (typeof window === 'undefined') return 'political'
  try {
    const saved = localStorage.getItem(STORAGE_KEY_LAYER) as AtlasLayerId | null
    if (
      saved &&
      [
        'political',
        'biome',
        'yields',
        'unrest',
        'garrison',
        'species',
        'exploration',
      ].includes(saved)
    ) {
      return saved
    }
  } catch {
    // Ignore storage read failures in private/isolated contexts
  }
  return 'political'
}

export interface MapUiState {
  hovered: string | null
  inspected: string | null
  /** Strategic map layer (presentation-only; not in GameState). */
  activeLayer: AtlasLayerId
  /** Atlas drawer open state (presentation-only; not in GameState). */
  atlasOpen: boolean
  /** Region ID currently being viewed in the full dossier (null if closed). */
  dossierRegionId: string | null
  setHovered: (id: string | null) => void
  setInspected: (id: string | null) => void
  setActiveLayer: (layer: AtlasLayerId) => void
  setAtlasOpen: (open: boolean) => void
  toggleAtlas: () => void
  setDossierRegionId: (id: string | null) => void
  clear: () => void
}

export const useMapUiStore = create<MapUiState>((set) => ({
  hovered: null,
  inspected: null,
  activeLayer: getInitialLayer(),
  atlasOpen: false,
  dossierRegionId: null,

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

  setActiveLayer: (layer) =>
    set((state) => {
      if (state.activeLayer === layer) return state
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY_LAYER, layer)
        } catch {
          // Ignore write failure
        }
      }
      return { activeLayer: layer }
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

  setDossierRegionId: (id) =>
    set((state) => {
      if (state.dossierRegionId === id) return state
      return { dossierRegionId: id }
    }),

  clear: () =>
    set((state) => {
      if (
        state.hovered === null &&
        state.inspected === null &&
        !state.atlasOpen &&
        state.dossierRegionId === null
      ) {
        return state
      }
      return { hovered: null, inspected: null, atlasOpen: false, dossierRegionId: null }
    }),
}))

