'use client'

import { create } from 'zustand'

export type PanelId =
  | 'roster'
  | 'training'
  | 'hatchery'
  | 'breeding'
  | 'barracks'
  | 'infirmary'
  | 'warTable'
  | 'help'
  | 'camera'

export type InteractionNoticeTone = 'status' | 'success' | 'warning' | 'error'

export interface InteractionNotice {
  id: number
  tone: InteractionNoticeTone
  message: string
  /** Absolute wall-clock expiry for transient UI only; never stored in GameState. */
  expiresAt: number
  /** Token consumed by Sanctuary Architect's one-step undo action. */
  undoToken?: number
}

export interface InteractionNoticeInput {
  tone?: InteractionNoticeTone
  message: string
  durationMs?: number
  undoToken?: number
}

interface UiStore {
  openPanel: PanelId | null
  /** Set by the sanctuary scene when the player walks near a station. */
  nearby: { id: string; label: string; panel: PanelId } | null
  /** Which station the training panel should default to. */
  focusedStation: string | null
  /** Which wyvern the roster should lead with, set by clicking one in-world. */
  focusedWyvern: string | null
  /** Shared, structured transient feedback for player interactions. */
  toast: InteractionNotice | null
  /** When true, all HUD elements are hidden for a clean viewport. */
  hudHidden: boolean

  open(panel: PanelId, station?: string): void
  /** Opens the roster on one specific wyvern. */
  openWyvern(wyvernId: string): void
  close(): void
  setNearby(nearby: UiStore['nearby']): void
  notify(notice: string | InteractionNoticeInput | null): void
  clearNotice(id?: number): void
  toggleHud(): void
}

export const useUi = create<UiStore>()((set) => ({
  openPanel: null,
  nearby: null,
  focusedStation: null,
  focusedWyvern: null,
  toast: null,
  hudHidden: false,

  open: (panel, station) =>
    set({ openPanel: panel, focusedStation: station ?? null, focusedWyvern: null }),
  openWyvern: (wyvernId) => set({ openPanel: 'roster', focusedWyvern: wyvernId }),
  close: () => set({ openPanel: null, focusedWyvern: null }),
  // Called from a per-frame loop, so it must stay a no-op when unchanged or it
  // would re-render the UI every frame.
  setNearby: (nearby) =>
    set((s) =>
      s.nearby?.id === nearby?.id ? s : { nearby },
    ),
  notify: (notice) => {
    if (notice === null) return set({ toast: null })
    const input = typeof notice === 'string' ? { message: notice } : notice
    set((state) => ({
      toast: {
        id: (state.toast?.id ?? 0) + 1,
        tone: input.tone ?? 'status',
        message: input.message,
        expiresAt: Date.now() + (input.durationMs ?? 5000),
        undoToken: input.undoToken,
      },
    }))
  },
  clearNotice: (id) => set((state) => (!id || state.toast?.id === id ? { toast: null } : state)),
  toggleHud: () => set((s) => ({ hudHidden: !s.hudHidden })),
}))
