'use client'

import { create } from 'zustand'
import {
  cloneSanctuaryLayout,
  type PropCatalogEntry,
} from '@/core/state/sanctuaryLayout'
import type { SanctuaryLayoutState } from '@/core/types'

export interface SanctuaryUndoSnapshot {
  token: number
  layout: SanctuaryLayoutState
  action: string
}

interface SanctuaryEditorStore {
  isEditing: boolean
  selectedObjectId: string | null
  placingItem: PropCatalogEntry | null
  dragPosition: [number, number, number] | null
  dragRotationY: number
  gridSnap: boolean
  snapSize: number
  activeCategoryTab: 'all' | 'structure' | 'scenery' | 'furniture' | 'utility'
  pendingUndo: SanctuaryUndoSnapshot | null
  nextUndoToken: number

  enterEditMode(): void
  exitEditMode(): void
  toggleEditMode(): void
  selectObject(id: string | null): void
  startPlacing(item: PropCatalogEntry): void
  cancelPlacing(): void
  setDragPosition(pos: [number, number, number] | null): void
  setDragRotationY(angle: number): void
  rotateActive(deltaAngle: number): void
  toggleGridSnap(): void
  setSnapSize(size: number): void
  setCategoryTab(tab: SanctuaryEditorStore['activeCategoryTab']): void
  stageUndo(layout: SanctuaryLayoutState, action: string): number
  consumeUndo(token: number): SanctuaryUndoSnapshot | null
  clearUndo(token?: number): void
}

export const useSanctuaryEditor = create<SanctuaryEditorStore>()((set, get) => ({
  isEditing: false,
  selectedObjectId: null,
  placingItem: null,
  dragPosition: null,
  dragRotationY: 0,
  gridSnap: true,
  snapSize: 1.0,
  activeCategoryTab: 'all',
  pendingUndo: null,
  nextUndoToken: 1,

  enterEditMode() {
    set({ isEditing: true, selectedObjectId: null, placingItem: null, dragPosition: null })
  },

  exitEditMode() {
    set({ isEditing: false, selectedObjectId: null, placingItem: null, dragPosition: null })
  },

  toggleEditMode() {
    set((s) => ({ isEditing: !s.isEditing, selectedObjectId: null, placingItem: null, dragPosition: null }))
  },

  selectObject(id) {
    set({ selectedObjectId: id, placingItem: null })
  },

  startPlacing(item) {
    set({ placingItem: item, selectedObjectId: null, dragRotationY: 0 })
  },

  cancelPlacing() {
    set({ placingItem: null, dragPosition: null })
  },

  setDragPosition(pos) {
    set((state) => {
      if (
        state.dragPosition?.[0] === pos?.[0] &&
        state.dragPosition?.[1] === pos?.[1] &&
        state.dragPosition?.[2] === pos?.[2]
      ) {
        return state
      }
      return { dragPosition: pos }
    })
  },

  setDragRotationY(angle) {
    set({ dragRotationY: angle })
  },

  rotateActive(deltaAngle) {
    set((state) => ({ dragRotationY: (state.dragRotationY + deltaAngle) % (Math.PI * 2) }))
  },

  toggleGridSnap() {
    set((s) => ({ gridSnap: !s.gridSnap }))
  },

  setSnapSize(size) {
    set({ snapSize: size })
  },

  setCategoryTab(activeCategoryTab) {
    set({ activeCategoryTab })
  },

  stageUndo(layout, action) {
    const token = get().nextUndoToken
    set({
      pendingUndo: { token, layout: cloneSanctuaryLayout(layout), action },
      nextUndoToken: token + 1,
    })
    return token
  },

  consumeUndo(token) {
    const pendingUndo = get().pendingUndo
    if (!pendingUndo || pendingUndo.token !== token) return null
    set({ pendingUndo: null })
    return { ...pendingUndo, layout: cloneSanctuaryLayout(pendingUndo.layout) }
  },

  clearUndo(token) {
    set((state) => (!token || state.pendingUndo?.token === token ? { pendingUndo: null } : state))
  },
}))
