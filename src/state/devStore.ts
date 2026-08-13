import { useSyncExternalStore } from 'react'

let revealAllState = false

if (typeof window !== 'undefined') {
  try {
    const params = new URLSearchParams(window.location.search)
    revealAllState = params.get('reveal') === '1'
  } catch {
    // Ignore error in non-browser envs
  }
}

const listeners = new Set<() => void>()

export const devStore = {
  get revealAll(): boolean {
    return revealAllState
  },
  setRevealAll(value: boolean): void {
    if (revealAllState === value) return
    revealAllState = value
    listeners.forEach((listener) => listener())
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

export function useDevStore<T>(selector: (state: typeof devStore) => T): T {
  return useSyncExternalStore(
    devStore.subscribe,
    () => selector(devStore),
    () => selector(devStore)
  )
}
