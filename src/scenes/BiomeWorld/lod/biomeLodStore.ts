import { create } from 'zustand'
import type { LodCapabilities, LodLevel } from './biomeLod'
import { lodCapabilities } from './biomeLod'

/**
 * Shared LOD state. `LodDirector` is the only writer; scene subsystems read
 * via selectors. All setters are change-guarded so selectors only re-render
 * on real transitions.
 */
interface BiomeLodStore {
  level: LodLevel
  capabilities: LodCapabilities
  setLevel: (level: LodLevel) => void
}

export const useBiomeLod = create<BiomeLodStore>()((set) => ({
  level: 'near',
  capabilities: lodCapabilities('near'),
  setLevel: (level) =>
    set((s) => (s.level === level ? s : { level, capabilities: lodCapabilities(level) })),
}))
