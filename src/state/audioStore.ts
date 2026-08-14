import { create } from 'zustand'

export interface AudioPreferencesState {
  masterVolume: number
  ambienceVolume: number
  sfxVolume: number
  muted: boolean
  reducedMotion: boolean
  setMasterVolume: (v: number) => void
  setAmbienceVolume: (v: number) => void
  setSfxVolume: (v: number) => void
  setMuted: (m: boolean) => void
  toggleMuted: () => void
  setReducedMotion: (rm: boolean) => void
}

export const useAudioStore = create<AudioPreferencesState>((set) => ({
  masterVolume: 0.7,
  ambienceVolume: 0.6,
  sfxVolume: 0.8,
  muted: false,
  reducedMotion: false,
  setMasterVolume: (v) => set({ masterVolume: Math.max(0, Math.min(1, v)) }),
  setAmbienceVolume: (v) => set({ ambienceVolume: Math.max(0, Math.min(1, v)) }),
  setSfxVolume: (v) => set({ sfxVolume: Math.max(0, Math.min(1, v)) }),
  setMuted: (muted) => set({ muted }),
  toggleMuted: () => set((s) => ({ muted: !s.muted })),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
}))
