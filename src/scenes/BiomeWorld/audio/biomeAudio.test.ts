import { describe, expect, it } from 'vitest'
import { BIOME_ACOUSTICS, biomeAudio } from './biomeAudio'
import { useAudioStore } from '@/state/audioStore'
import { BIOME_PALETTES } from '../atmosphere/biomePalettes'

const ALL_BIOMES = Object.keys(BIOME_PALETTES)

describe('Biome Enhancement Stage 5: Audio and Acoustics Engine', () => {
  it('defines valid acoustics for all 15 biomes', () => {
    for (const biome of ALL_BIOMES) {
      const acoustics = BIOME_ACOUSTICS[biome]
      expect(acoustics).toBeDefined()
      expect(acoustics!.baseFreq).toBeGreaterThan(0)
      expect(acoustics!.filterFreq).toBeGreaterThan(0)
      expect(acoustics!.gain).toBeGreaterThan(0)
      expect(acoustics!.gain).toBeLessThanOrEqual(1.0)
      expect(acoustics!.modulationRate).toBeGreaterThan(0)
    }
  })

  it('manages audio store preferences with valid clamping', () => {
    const store = useAudioStore.getState()
    store.setMasterVolume(1.5)
    expect(useAudioStore.getState().masterVolume).toBe(1.0)

    store.setMasterVolume(-0.5)
    expect(useAudioStore.getState().masterVolume).toBe(0.0)

    store.setMasterVolume(0.8)
    expect(useAudioStore.getState().masterVolume).toBe(0.8)

    store.setMuted(true)
    expect(useAudioStore.getState().muted).toBe(true)
    store.toggleMuted()
    expect(useAudioStore.getState().muted).toBe(false)
  })

  it('safely handles audio lifecycle without crashing in test environments', () => {
    expect(() => {
      biomeAudio.startAmbience('forest', 'clear')
      biomeAudio.playCue('arrival')
      biomeAudio.playCue('chime')
      biomeAudio.playCue('gust')
      biomeAudio.stopAmbience(0.1)
      biomeAudio.dispose()
    }).not.toThrow()
  })
})
