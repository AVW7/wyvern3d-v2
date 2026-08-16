import { useAudioStore } from '@/state/audioStore'

export type SanctuaryAudioCue =
  | 'collect'
  | 'delivery'
  | 'invalid'
  | 'duty_completed'
  | 'milestone_unlocked'
  | 'footstep'

export type WyvernVocalReaction =
  | 'eat'
  | 'pet'
  | 'happy'
  | 'roar'
  | 'chirp'
  | 'growl'

export interface SpatialLandmark {
  name: string
  position: [number, number]
  maxDistance: number
  baseVolume: number
}

export const SANCTUARY_LANDMARKS: Record<string, SpatialLandmark> = {
  fireForge: {
    name: 'Fire & Forge',
    position: [43, -9],
    maxDistance: 32,
    baseVolume: 0.22,
  },
  waterPool: {
    name: 'Sanctuary Pool',
    position: [-16, 22],
    maxDistance: 28,
    baseVolume: 0.18,
  },
  hatchery: {
    name: 'Hatchery Roosts',
    position: [13, -3],
    maxDistance: 26,
    baseVolume: 0.2,
  },
  woodland: {
    name: 'Woodland Perimeter',
    position: [-35, 10],
    maxDistance: 36,
    baseVolume: 0.15,
  },
}

class SanctuaryAudioManager {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private ambienceGain: GainNode | null = null
  private sfxGain: GainNode | null = null

  // Ambience bed nodes
  private outdoorBedSource: AudioBufferSourceNode | null = null
  private outdoorFilter: BiquadFilterNode | null = null
  private outdoorLfo: OscillatorNode | null = null

  // Spatial landmark nodes
  private landmarkNodes: Map<
    string,
    {
      source: AudioBufferSourceNode | OscillatorNode
      gain: GainNode
      filter?: BiquadFilterNode
      lfo?: OscillatorNode
    }
  > = new Map()

  // Locomotion & footsteps
  private playerLocomotion: 'idle' | 'walk' | 'run' = 'idle'
  private footstepInterval: ReturnType<typeof setInterval> | null = null
  private lastFootstepTime = 0

  // Deduplication map
  private lastCuePlayTime: Map<string, number> = new Map()

  // State flags
  private isRunning = false
  private isUnlocked = false
  private boundVisibilityHandler: (() => void) | null = null
  private boundUnlockHandler: (() => void) | null = null

  public initContext(): AudioContext | null {
    if (typeof window === 'undefined') return null

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioCtx) {
        try {
          this.ctx = new AudioCtx()
        } catch {
          // Context initialization fallback
          return null
        }
      }
    }

    if (this.ctx && !this.masterGain) {
      this.setupAudioGraph(this.ctx)
      this.setupListeners()
    }

    if (this.ctx && this.ctx.state === 'suspended' && this.isUnlocked) {
      this.ctx.resume().catch(() => {
        // user interaction pending
      })
    }

    return this.ctx
  }

  private setupAudioGraph(ctx: AudioContext): void {
    this.masterGain = ctx.createGain()
    this.ambienceGain = ctx.createGain()
    this.sfxGain = ctx.createGain()

    this.ambienceGain.connect(this.masterGain)
    this.sfxGain.connect(this.masterGain)
    this.masterGain.connect(ctx.destination)

    this.syncVolumes()
  }

  private setupListeners(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return

    // Unlock audio context on user gesture
    if (!this.boundUnlockHandler) {
      this.boundUnlockHandler = () => {
        this.isUnlocked = true
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {
            // gesture retry handled on next event
          })
        }
        this.removeUnlockListeners()
      }
      window.addEventListener('pointerdown', this.boundUnlockHandler, { passive: true })
      window.addEventListener('keydown', this.boundUnlockHandler, { passive: true })
      window.addEventListener('touchstart', this.boundUnlockHandler, { passive: true })
    }

    // Handle tab visibility pause/resume
    if (!this.boundVisibilityHandler) {
      this.boundVisibilityHandler = () => {
        if (!this.ctx) return
        if (document.hidden) {
          if (this.ctx.state === 'running') {
            this.ctx.suspend().catch(() => {
              // suspend fallback
            })
          }
        } else {
          if (this.ctx.state === 'suspended' && this.isUnlocked) {
            this.ctx.resume().catch(() => {
              // resume fallback
            })
          }
        }
      }
      document.addEventListener('visibilitychange', this.boundVisibilityHandler)
    }
  }

  private removeUnlockListeners(): void {
    if (typeof window === 'undefined' || !this.boundUnlockHandler) return
    window.removeEventListener('pointerdown', this.boundUnlockHandler)
    window.removeEventListener('keydown', this.boundUnlockHandler)
    window.removeEventListener('touchstart', this.boundUnlockHandler)
  }

  public syncVolumes(): void {
    if (!this.ctx || !this.masterGain || !this.ambienceGain || !this.sfxGain) return
    const { masterVolume, ambienceVolume, sfxVolume, muted } = useAudioStore.getState()
    const now = this.ctx.currentTime

    const targetMaster = muted ? 0 : Math.max(0, Math.min(1, masterVolume))
    const targetAmbience = Math.max(0, Math.min(1, ambienceVolume))
    const targetSfx = Math.max(0, Math.min(1, sfxVolume))

    this.masterGain.gain.setTargetAtTime(targetMaster, now, 0.05)
    this.ambienceGain.gain.setTargetAtTime(targetAmbience, now, 0.05)
    this.sfxGain.gain.setTargetAtTime(targetSfx, now, 0.05)
  }

  private createNoiseBuffer(ctx: AudioContext, durationSeconds = 3): AudioBuffer {
    const bufferSize = ctx.sampleRate * durationSeconds
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const output = buffer.getChannelData(0)
    let lastOut = 0.0

    // Filtered pink/brown noise
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1
      lastOut = (lastOut + 0.02 * white) / 1.02
      output[i] = lastOut * 3.0
    }
    return buffer
  }

  /**
   * Starts the continuous sanctuary environment bed and spatial landmark loops.
   */
  public startAmbience(): void {
    const ctx = this.initContext()
    if (!ctx || !this.ambienceGain) return
    if (this.isRunning) return

    this.isRunning = true
    this.syncVolumes()

    // 1. Outdoor wind/rustle ambient bed
    const noiseBuffer = this.createNoiseBuffer(ctx, 4)
    const bedSource = ctx.createBufferSource()
    bedSource.buffer = noiseBuffer
    bedSource.loop = true

    const bedFilter = ctx.createBiquadFilter()
    bedFilter.type = 'lowpass'
    bedFilter.frequency.setValueAtTime(320, ctx.currentTime)
    bedFilter.Q.setValueAtTime(1.5, ctx.currentTime)

    const bedGain = ctx.createGain()
    bedGain.gain.setValueAtTime(0.18, ctx.currentTime)

    // LFO for slow breathing breeze
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.setValueAtTime(0.15, ctx.currentTime)
    const lfoGain = ctx.createGain()
    lfoGain.gain.setValueAtTime(80, ctx.currentTime)

    lfo.connect(lfoGain)
    lfoGain.connect(bedFilter.frequency)

    bedSource.connect(bedFilter)
    bedFilter.connect(bedGain)
    bedGain.connect(this.ambienceGain)

    try {
      bedSource.start(0)
      lfo.start(0)
    } catch {
      // safe fallback in environments without audio output
    }

    this.outdoorBedSource = bedSource
    this.outdoorFilter = bedFilter
    this.outdoorLfo = lfo

    // 2. Start spatial landmark loops
    this.startSpatialLandmarks(ctx)
  }

  private startSpatialLandmarks(ctx: AudioContext): void {
    if (!this.ambienceGain) return

    for (const key of Object.keys(SANCTUARY_LANDMARKS)) {
      const landmarkGain = ctx.createGain()
      landmarkGain.gain.setValueAtTime(0, ctx.currentTime) // initial muted until player near
      landmarkGain.connect(this.ambienceGain)

      if (key === 'fireForge') {
        // Crackle & warm low rumble
        const noise = this.createNoiseBuffer(ctx, 2)
        const source = ctx.createBufferSource()
        source.buffer = noise
        source.loop = true

        const filter = ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.setValueAtTime(220, ctx.currentTime)
        filter.Q.setValueAtTime(3.0, ctx.currentTime)

        source.connect(filter)
        filter.connect(landmarkGain)
        try {
          source.start(0)
        } catch {
          // audio buffer start fallback
        }

        this.landmarkNodes.set(key, { source, gain: landmarkGain, filter })
      } else if (key === 'waterPool') {
        // Filtered babbling / splashing
        const noise = this.createNoiseBuffer(ctx, 2)
        const source = ctx.createBufferSource()
        source.buffer = noise
        source.loop = true

        const filter = ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.setValueAtTime(450, ctx.currentTime)
        filter.Q.setValueAtTime(2.2, ctx.currentTime)

        source.connect(filter)
        filter.connect(landmarkGain)
        try {
          source.start(0)
        } catch {
          // audio buffer start fallback
        }

        this.landmarkNodes.set(key, { source, gain: landmarkGain, filter })
      } else if (key === 'hatchery') {
        // Soft warm harmonic hum
        const osc = ctx.createOscillator()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(174, ctx.currentTime) // Solfeggio 174 Hz warm tonic

        osc.connect(landmarkGain)
        try {
          osc.start(0)
        } catch {
          // oscillator start fallback
        }

        this.landmarkNodes.set(key, { source: osc, gain: landmarkGain })
      } else if (key === 'woodland') {
        // Whispering leaves
        const noise = this.createNoiseBuffer(ctx, 3)
        const source = ctx.createBufferSource()
        source.buffer = noise
        source.loop = true

        const filter = ctx.createBiquadFilter()
        filter.type = 'highpass'
        filter.frequency.setValueAtTime(600, ctx.currentTime)
        filter.Q.setValueAtTime(1.0, ctx.currentTime)

        source.connect(filter)
        filter.connect(landmarkGain)
        try {
          source.start(0)
        } catch {
          // audio buffer start fallback
        }

        this.landmarkNodes.set(key, { source, gain: landmarkGain, filter })
      }
    }
  }

  /**
   * Updates positional spatial landmark gains according to player coordinates.
   */
  public updateListenerPosition(playerPosition: [number, number]): void {
    if (!this.ctx || !this.isRunning) return
    const now = this.ctx.currentTime

    for (const [key, landmark] of Object.entries(SANCTUARY_LANDMARKS)) {
      const node = this.landmarkNodes.get(key)
      if (!node) continue

      const dx = playerPosition[0] - landmark.position[0]
      const dz = playerPosition[1] - landmark.position[1]
      const dist = Math.sqrt(dx * dx + dz * dz)

      // Inverse quadratic rolloff with smooth clamp
      const factor = Math.max(0, Math.min(1, 1 - dist / landmark.maxDistance))
      const targetGain = factor * factor * landmark.baseVolume

      node.gain.gain.setTargetAtTime(targetGain, now, 0.1)
    }
  }

  /**
   * Synchronizes player movement state to trigger subtle footsteps.
   */
  public setPlayerLocomotion(locomotion: 'idle' | 'walk' | 'run'): void {
    if (this.playerLocomotion === locomotion) return
    this.playerLocomotion = locomotion

    if (this.footstepInterval) {
      clearInterval(this.footstepInterval)
      this.footstepInterval = null
    }

    if (locomotion === 'walk' || locomotion === 'run') {
      const intervalMs = locomotion === 'run' ? 280 : 440
      // Immediate step
      this.playFootstep()
      this.footstepInterval = setInterval(() => {
        this.playFootstep()
      }, intervalMs)
    }
  }

  public playFootstep(): void {
    const ctx = this.initContext()
    if (!ctx || !this.sfxGain) return
    const { masterVolume, sfxVolume, muted } = useAudioStore.getState()
    if (muted || masterVolume === 0 || sfxVolume === 0) return

    const now = ctx.currentTime
    if (now - this.lastFootstepTime < 0.15) return
    this.lastFootstepTime = now

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const filter = ctx.createBiquadFilter()

    // Soft pitch drop & noise crunch
    const basePitch = this.playerLocomotion === 'run' ? 110 : 85
    const pitchOffset = (Math.random() - 0.5) * 15
    osc.type = 'sine'
    osc.frequency.setValueAtTime(basePitch + pitchOffset, now)
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.08)

    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(350, now)

    gain.gain.setValueAtTime(0.08, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.sfxGain)

    try {
      osc.start(now)
      osc.stop(now + 0.08)
    } catch {
      // footstep audio fallback
    }
  }

  /**
   * Plays discrete interaction sound cues with deduplication.
   */
  public playCue(cue: SanctuaryAudioCue, dedupeWindowMs = 50): void {
    const ctx = this.initContext()
    if (!ctx || !this.sfxGain) return
    const { masterVolume, sfxVolume, muted } = useAudioStore.getState()
    if (muted || masterVolume === 0 || sfxVolume === 0) return

    const now = performance.now()
    const lastTime = this.lastCuePlayTime.get(cue) ?? 0
    if (now - lastTime < dedupeWindowMs) return
    this.lastCuePlayTime.set(cue, now)

    const audioNow = ctx.currentTime

    switch (cue) {
      case 'collect': {
        // Bright ascending 2-note pickup chime
        this.playTone(ctx, 523.25, audioNow, 0.08, 'sine', 0.2) // C5
        this.playTone(ctx, 783.99, audioNow + 0.07, 0.12, 'triangle', 0.22) // G5
        break
      }

      case 'delivery': {
        // Warm 2-note confirmation
        this.playTone(ctx, 440.0, audioNow, 0.1, 'triangle', 0.22) // A4
        this.playTone(ctx, 659.25, audioNow + 0.08, 0.18, 'sine', 0.25) // E5
        break
      }

      case 'invalid': {
        // Low double prompt thud
        this.playTone(ctx, 160.0, audioNow, 0.07, 'sawtooth', 0.15, 200)
        this.playTone(ctx, 120.0, audioNow + 0.09, 0.1, 'sawtooth', 0.18, 160)
        break
      }

      case 'duty_completed': {
        // Triumphant harmonic arpeggio
        this.playTone(ctx, 523.25, audioNow, 0.18, 'sine', 0.25) // C5
        this.playTone(ctx, 659.25, audioNow + 0.08, 0.22, 'sine', 0.25) // E5
        this.playTone(ctx, 783.99, audioNow + 0.16, 0.28, 'triangle', 0.28) // G5
        this.playTone(ctx, 1046.5, audioNow + 0.24, 0.45, 'sine', 0.3) // C6
        break
      }

      case 'milestone_unlocked': {
        // Rich brassy fanfare flourish
        const chords = [
          { f: 392.0, t: audioNow, d: 0.35, v: 0.2 }, // G4
          { f: 523.25, t: audioNow, d: 0.4, v: 0.22 }, // C5
          { f: 659.25, t: audioNow + 0.12, d: 0.45, v: 0.25 }, // E5
          { f: 783.99, t: audioNow + 0.24, d: 0.55, v: 0.28 }, // G5
          { f: 1046.5, t: audioNow + 0.36, d: 0.75, v: 0.32 }, // C6
        ]
        chords.forEach((c) => {
          this.playTone(ctx, c.f, c.t, c.d, 'triangle', c.v)
        })
        break
      }

      case 'footstep': {
        this.playFootstep()
        break
      }
    }
  }

  private playTone(
    ctx: AudioContext,
    freq: number,
    startTime: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.2,
    filterFreq?: number,
  ): void {
    if (!this.sfxGain) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = type
    osc.frequency.setValueAtTime(freq, startTime)

    gain.gain.setValueAtTime(volume, startTime)
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)

    if (filterFreq) {
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(filterFreq, startTime)
      osc.connect(filter)
      filter.connect(gain)
    } else {
      osc.connect(gain)
    }

    gain.connect(this.sfxGain)

    try {
      osc.start(startTime)
      osc.stop(startTime + duration)
    } catch {
      // tone oscillator fallback
    }
  }

  /**
   * Plays species & age-safe vocal cues without tying animation state to audio duration.
   */
  public playWyvernVocalization(
    reaction: WyvernVocalReaction,
    options?: {
      stage?: 'hatchling' | 'juvenile' | 'adult' | 'elder'
      speciesId?: string
    },
  ): void {
    const ctx = this.initContext()
    if (!ctx || !this.sfxGain) return
    const { masterVolume, sfxVolume, muted } = useAudioStore.getState()
    if (muted || masterVolume === 0 || sfxVolume === 0) return

    const now = ctx.currentTime
    const stage = options?.stage ?? 'adult'
    const pitchScale =
      stage === 'hatchling'
        ? 2.2
        : stage === 'juvenile'
          ? 1.5
          : stage === 'elder'
            ? 0.75
            : 1.0

    const isThornwing = options?.speciesId === 'thornwing'

    switch (reaction) {
      case 'eat': {
        // Satisfied chirp / throat swallow
        const base = (isThornwing ? 260 : 200) * pitchScale
        this.playTone(ctx, base, now, 0.18, 'triangle', 0.22)
        this.playTone(ctx, base * 1.35, now + 0.1, 0.22, 'sine', 0.2)
        break
      }

      case 'pet': {
        // Low purring vibrato
        const base = (isThornwing ? 160 : 130) * pitchScale
        const osc = ctx.createOscillator()
        const lfo = ctx.createOscillator()
        const lfoGain = ctx.createGain()
        const gain = ctx.createGain()

        osc.type = 'triangle'
        osc.frequency.setValueAtTime(base, now)

        lfo.type = 'sine'
        lfo.frequency.setValueAtTime(24, now)
        lfoGain.gain.setValueAtTime(base * 0.15, now)

        lfo.connect(lfoGain)
        lfoGain.connect(osc.frequency)

        gain.gain.setValueAtTime(0.2, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)

        osc.connect(gain)
        gain.connect(this.sfxGain)

        try {
          osc.start(now)
          lfo.start(now)
          osc.stop(now + 0.5)
          lfo.stop(now + 0.5)
        } catch {
          // purr oscillator fallback
        }
        break
      }

      case 'happy': {
        // Rising melodic whistle
        const base = (isThornwing ? 480 : 380) * pitchScale
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = 'sine'
        osc.frequency.setValueAtTime(base, now)
        osc.frequency.exponentialRampToValueAtTime(base * 1.6, now + 0.25)

        gain.gain.setValueAtTime(0.22, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28)

        osc.connect(gain)
        gain.connect(this.sfxGain)

        try {
          osc.start(now)
          osc.stop(now + 0.28)
        } catch {
          // whistle oscillator fallback
        }
        break
      }

      case 'chirp': {
        // Quick high pip
        const base = 600 * pitchScale
        this.playTone(ctx, base, now, 0.08, 'sine', 0.2)
        break
      }

      case 'growl':
      case 'roar': {
        // Resonant throat roar
        const base = (isThornwing ? 140 : 110) * pitchScale
        const osc = ctx.createOscillator()
        const filter = ctx.createBiquadFilter()
        const gain = ctx.createGain()

        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(base, now)
        osc.frequency.exponentialRampToValueAtTime(base * 0.7, now + 0.45)

        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(450 * pitchScale, now)
        filter.frequency.exponentialRampToValueAtTime(150, now + 0.45)

        gain.gain.setValueAtTime(0.25, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)

        osc.connect(filter)
        filter.connect(gain)
        gain.connect(this.sfxGain)

        try {
          osc.start(now)
          osc.stop(now + 0.5)
        } catch {
          // roar oscillator fallback
        }
        break
      }
    }
  }

  /**
   * Completely disposes of all audio nodes, intervals, and listeners.
   */
  public dispose(): void {
    if (this.footstepInterval) {
      clearInterval(this.footstepInterval)
      this.footstepInterval = null
    }

    this.removeUnlockListeners()

    if (typeof document !== 'undefined' && this.boundVisibilityHandler) {
      document.removeEventListener('visibilitychange', this.boundVisibilityHandler)
      this.boundVisibilityHandler = null
    }

    try {
      this.outdoorBedSource?.stop()
      this.outdoorBedSource?.disconnect()
      this.outdoorLfo?.stop()
      this.outdoorLfo?.disconnect()

      for (const node of this.landmarkNodes.values()) {
        try {
          if ('stop' in node.source) {
            node.source.stop()
          }
          node.source.disconnect()
          node.gain.disconnect()
          node.filter?.disconnect()
          node.lfo?.stop()
          node.lfo?.disconnect()
        } catch {
          // node disconnect fallback
        }
      }
      this.landmarkNodes.clear()

      this.masterGain?.disconnect()
      this.ambienceGain?.disconnect()
      this.sfxGain?.disconnect()

      if (this.ctx && this.ctx.state !== 'closed') {
        this.ctx.close().catch(() => {
          // context close fallback
        })
      }
    } catch {
      // cleanup fallback
    }

    this.ctx = null
    this.masterGain = null
    this.ambienceGain = null
    this.sfxGain = null
    this.outdoorBedSource = null
    this.outdoorFilter = null
    this.outdoorLfo = null
    this.isRunning = false
    this.isUnlocked = false
    this.playerLocomotion = 'idle'
    this.lastCuePlayTime.clear()
  }
}

export const sanctuaryAudio = new SanctuaryAudioManager()
