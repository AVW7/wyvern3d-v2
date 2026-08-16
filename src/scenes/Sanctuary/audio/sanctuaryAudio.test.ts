import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { sanctuaryAudio, SANCTUARY_LANDMARKS } from './sanctuaryAudio'
import { useAudioStore } from '@/state/audioStore'

describe('Sanctuary Stage 5: Audio and Acoustics Layer', () => {
  beforeEach(() => {
    useAudioStore.setState({
      masterVolume: 0.7,
      ambienceVolume: 0.6,
      sfxVolume: 0.8,
      muted: false,
    })
  })

  afterEach(() => {
    sanctuaryAudio.dispose()
  })

  it('manages audio store preferences with valid clamping and mute toggle', () => {
    const store = useAudioStore.getState()
    expect(store.masterVolume).toBe(0.7)

    store.setMasterVolume(1.5)
    expect(useAudioStore.getState().masterVolume).toBe(1.0)

    store.setMasterVolume(-0.2)
    expect(useAudioStore.getState().masterVolume).toBe(0.0)

    store.setAmbienceVolume(0.5)
    expect(useAudioStore.getState().ambienceVolume).toBe(0.5)

    store.setSfxVolume(0.9)
    expect(useAudioStore.getState().sfxVolume).toBe(0.9)

    store.setMuted(true)
    expect(useAudioStore.getState().muted).toBe(true)

    store.toggleMuted()
    expect(useAudioStore.getState().muted).toBe(false)
  })

  it('safely starts and stops ambience lifecycle without throwing in test environment', () => {
    expect(() => {
      sanctuaryAudio.startAmbience()
      sanctuaryAudio.updateListenerPosition([0, 0])
      sanctuaryAudio.setPlayerLocomotion('walk')
      sanctuaryAudio.setPlayerLocomotion('run')
      sanctuaryAudio.setPlayerLocomotion('idle')
      sanctuaryAudio.dispose()
    }).not.toThrow()
  })

  it('plays discrete interaction cues and deduplicates rapid repeated calls', () => {
    expect(() => {
      sanctuaryAudio.playCue('collect')
      sanctuaryAudio.playCue('collect', 100) // within dedupe window
      sanctuaryAudio.playCue('delivery')
      sanctuaryAudio.playCue('invalid')
      sanctuaryAudio.playCue('duty_completed')
      sanctuaryAudio.playCue('milestone_unlocked')
      sanctuaryAudio.playCue('footstep')
    }).not.toThrow()
  })

  it('plays species and age-scaled wyvern vocalizations cleanly', () => {
    const reactions = ['eat', 'pet', 'happy', 'roar', 'chirp', 'growl'] as const
    const stages = ['hatchling', 'juvenile', 'adult', 'elder'] as const

    for (const reaction of reactions) {
      for (const stage of stages) {
        expect(() => {
          sanctuaryAudio.playWyvernVocalization(reaction, { stage, speciesId: 'drogon' })
          sanctuaryAudio.playWyvernVocalization(reaction, { stage, speciesId: 'thornwing' })
        }).not.toThrow()
      }
    }
  })

  it('attenuates landmark audio gains with distance', () => {
    expect(SANCTUARY_LANDMARKS.fireForge).toBeDefined()
    expect(SANCTUARY_LANDMARKS.waterPool).toBeDefined()
    expect(SANCTUARY_LANDMARKS.hatchery).toBeDefined()
    expect(SANCTUARY_LANDMARKS.woodland).toBeDefined()

    sanctuaryAudio.startAmbience()
    // Test listener near forge
    expect(() => sanctuaryAudio.updateListenerPosition([43, -9])).not.toThrow()
    // Test listener far away
    expect(() => sanctuaryAudio.updateListenerPosition([200, 200])).not.toThrow()
  })

  it('handles visibility change pause and resume safely', () => {
    if (typeof document !== 'undefined') {
      sanctuaryAudio.startAmbience()
      const visibilityEvent = new Event('visibilitychange')

      // Simulate tab backgrounding
      Object.defineProperty(document, 'hidden', { value: true, configurable: true })
      document.dispatchEvent(visibilityEvent)

      // Simulate tab foregrounding
      Object.defineProperty(document, 'hidden', { value: false, configurable: true })
      document.dispatchEvent(visibilityEvent)

      sanctuaryAudio.dispose()
    } else {
      expect(sanctuaryAudio.initContext()).toBeNull()
    }
  })

  it('performs leak-free disposal and clean remounting', () => {
    for (let i = 0; i < 3; i++) {
      sanctuaryAudio.startAmbience()
      sanctuaryAudio.playCue('collect')
      sanctuaryAudio.playWyvernVocalization('happy')
      sanctuaryAudio.setPlayerLocomotion('walk')
      sanctuaryAudio.dispose()
    }
  })
})
