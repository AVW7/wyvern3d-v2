'use client'

import { create } from 'zustand'
import { cloneSanctuaryLayout } from '@/core/state/sanctuaryLayout'
import type { SanctuaryLayoutState } from '@/core/types'

export interface LayoutSnapshot {
  id: string
  name: string
  createdAt: number
  objectCount: number
  layout: SanctuaryLayoutState
}

export const MAX_LAYOUT_SNAPSHOTS = 5
const STORAGE_KEY = 'wyvern3d_sanctuary_snapshots'

interface SanctuarySnapshotStore {
  snapshots: LayoutSnapshot[]
  isOpen: boolean
  setOpen(open: boolean): void
  toggleOpen(): void
  saveSnapshot(name: string, layout: SanctuaryLayoutState): { success: boolean; error?: string }
  deleteSnapshot(id: string): void
  renameSnapshot(id: string, newName: string): void
  getSnapshot(id: string): LayoutSnapshot | null
}

function loadInitialSnapshots(): LayoutSnapshot[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is LayoutSnapshot =>
          typeof item?.id === 'string' &&
          typeof item?.name === 'string' &&
          typeof item?.createdAt === 'number' &&
          Array.isArray(item?.layout?.objects),
      )
    }
  } catch {
    // Ignore corrupt localStorage
  }
  return []
}

function persistSnapshots(snapshots: LayoutSnapshot[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots))
  } catch {
    // Ignore storage write failure
  }
}

export const useSanctuarySnapshots = create<SanctuarySnapshotStore>()((set, get) => ({
  snapshots: loadInitialSnapshots(),
  isOpen: false,

  setOpen(isOpen) {
    set({ isOpen })
  },

  toggleOpen() {
    set((state) => ({ isOpen: !state.isOpen }))
  },

  saveSnapshot(name, layout) {
    const trimmed = name.trim().slice(0, 32)
    if (!trimmed) {
      return { success: false, error: 'Snapshot name cannot be empty.' }
    }

    const current = get().snapshots
    if (current.length >= MAX_LAYOUT_SNAPSHOTS) {
      return {
        success: false,
        error: `Maximum limit of ${MAX_LAYOUT_SNAPSHOTS} snapshots reached. Delete an existing snapshot to save a new one.`,
      }
    }

    const newSnapshot: LayoutSnapshot = {
      id: `snap_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: trimmed,
      createdAt: Date.now(),
      objectCount: layout.objects.length,
      layout: cloneSanctuaryLayout(layout),
    }

    const updated = [newSnapshot, ...current]
    persistSnapshots(updated)
    set({ snapshots: updated })
    return { success: true }
  },

  deleteSnapshot(id) {
    const updated = get().snapshots.filter((s) => s.id !== id)
    persistSnapshots(updated)
    set({ snapshots: updated })
  },

  renameSnapshot(id, newName) {
    const trimmed = newName.trim().slice(0, 32)
    if (!trimmed) return
    const updated = get().snapshots.map((s) => (s.id === id ? { ...s, name: trimmed } : s))
    persistSnapshots(updated)
    set({ snapshots: updated })
  },

  getSnapshot(id) {
    return get().snapshots.find((s) => s.id === id) ?? null
  },
}))
