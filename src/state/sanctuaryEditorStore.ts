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
  timestamp?: number
}

const MAX_UNDO_STACK = 20

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

  // Bounded Undo / Redo history
  undoStack: SanctuaryUndoSnapshot[]
  redoStack: SanctuaryUndoSnapshot[]
  preDragLayout: SanctuaryLayoutState | null
  isPlacementValid: boolean

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
  setPlacementValid(valid: boolean): void
  setPreDragLayout(layout: SanctuaryLayoutState | null): void

  // History operations
  pushUndo(layout: SanctuaryLayoutState, action: string): number
  undo(currentLayout: SanctuaryLayoutState): SanctuaryUndoSnapshot | null
  redo(currentLayout: SanctuaryLayoutState): SanctuaryUndoSnapshot | null
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
  undoStack: [],
  redoStack: [],
  preDragLayout: null,
  isPlacementValid: true,

  enterEditMode() {
    set({ isEditing: true, selectedObjectId: null, placingItem: null, dragPosition: null, preDragLayout: null })
  },

  exitEditMode() {
    set({ isEditing: false, selectedObjectId: null, placingItem: null, dragPosition: null, preDragLayout: null })
  },

  toggleEditMode() {
    set((s) => ({
      isEditing: !s.isEditing,
      selectedObjectId: null,
      placingItem: null,
      dragPosition: null,
      preDragLayout: null,
    }))
  },

  selectObject(id) {
    set({ selectedObjectId: id, placingItem: null })
  },

  startPlacing(item) {
    set({ placingItem: item, selectedObjectId: null, dragRotationY: 0 })
  },

  cancelPlacing() {
    set({ placingItem: null, dragPosition: null, preDragLayout: null })
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

  setPlacementValid(isPlacementValid) {
    set((state) => (state.isPlacementValid === isPlacementValid ? state : { isPlacementValid }))
  },

  setPreDragLayout(preDragLayout) {
    set({ preDragLayout: preDragLayout ? cloneSanctuaryLayout(preDragLayout) : null })
  },

  pushUndo(layout, action) {
    const token = get().nextUndoToken
    const snapshot: SanctuaryUndoSnapshot = {
      token,
      layout: cloneSanctuaryLayout(layout),
      action,
      timestamp: Date.now(),
    }

    set((state) => {
      const nextStack = [...state.undoStack, snapshot]
      if (nextStack.length > MAX_UNDO_STACK) {
        nextStack.shift()
      }
      return {
        undoStack: nextStack,
        redoStack: [], // New action clears redo stack
        pendingUndo: snapshot,
        nextUndoToken: token + 1,
      }
    })

    return token
  },

  undo(currentLayout) {
    const { undoStack } = get()
    if (undoStack.length === 0) return null

    const previousSnapshot = undoStack[undoStack.length - 1]!
    const remainingUndo = undoStack.slice(0, -1)

    const redoSnapshot: SanctuaryUndoSnapshot = {
      token: get().nextUndoToken,
      layout: cloneSanctuaryLayout(currentLayout),
      action: previousSnapshot.action,
      timestamp: Date.now(),
    }

    set((state) => {
      const nextRedo = [...state.redoStack, redoSnapshot]
      if (nextRedo.length > MAX_UNDO_STACK) {
        nextRedo.shift()
      }
      return {
        undoStack: remainingUndo,
        redoStack: nextRedo,
        pendingUndo: null,
        nextUndoToken: state.nextUndoToken + 1,
      }
    })

    return {
      ...previousSnapshot,
      layout: cloneSanctuaryLayout(previousSnapshot.layout),
    }
  },

  redo(currentLayout) {
    const { redoStack } = get()
    if (redoStack.length === 0) return null

    const targetSnapshot = redoStack[redoStack.length - 1]!
    const remainingRedo = redoStack.slice(0, -1)

    const undoSnapshot: SanctuaryUndoSnapshot = {
      token: get().nextUndoToken,
      layout: cloneSanctuaryLayout(currentLayout),
      action: targetSnapshot.action,
      timestamp: Date.now(),
    }

    set((state) => {
      const nextUndo = [...state.undoStack, undoSnapshot]
      if (nextUndo.length > MAX_UNDO_STACK) {
        nextUndo.shift()
      }
      return {
        undoStack: nextUndo,
        redoStack: remainingRedo,
        pendingUndo: null,
        nextUndoToken: state.nextUndoToken + 1,
      }
    })

    return {
      ...targetSnapshot,
      layout: cloneSanctuaryLayout(targetSnapshot.layout),
    }
  },

  stageUndo(layout, action) {
    return get().pushUndo(layout, action)
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
