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
  | 'economy'
  | 'realm'

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
  /** Active queue of structured transient feedback notices (max 3 stacked). */
  toasts: InteractionNotice[]
  /** Shared, structured transient feedback for player interactions (most recent toast). */
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
  toasts: [],
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
    if (notice === null) return set({ toasts: [], toast: null })
    const input = typeof notice === 'string' ? { message: notice } : notice
    set((state) => {
      const currentToasts = state.toast === null ? [] : state.toasts
      const lastId = currentToasts.length > 0
        ? currentToasts[currentToasts.length - 1]!.id
        : (state.toast?.id ?? 0)
      const newNotice: InteractionNotice = {
        id: lastId + 1,
        tone: input.tone ?? 'status',
        message: input.message,
        expiresAt: Date.now() + (input.durationMs ?? 5000),
        undoToken: input.undoToken,
      }
      const toasts = [...currentToasts, newNotice].slice(-3)
      return {
        toasts,
        toast: toasts[toasts.length - 1] ?? null,
      }
    })
  },
  clearNotice: (id) =>
    set((state) => {
      if (!id) return { toasts: [], toast: null }
      const currentToasts = state.toast === null ? [] : state.toasts
      const toasts = currentToasts.filter((t) => t.id !== id)
      return {
        toasts,
        toast: toasts.length > 0 ? toasts[toasts.length - 1]! : null,
      }
    }),
  toggleHud: () => set((s) => ({ hudHidden: !s.hudHidden })),
}))
