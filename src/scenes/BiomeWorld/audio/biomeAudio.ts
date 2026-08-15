import { useAudioStore } from '@/state/audioStore'

export interface BiomeAudioAcoustics {
  baseFreq: number
  filterFreq: number
  filterType: BiquadFilterType
  modulationRate: number
  gain: number
}

export const BIOME_ACOUSTICS: Record<string, BiomeAudioAcoustics> = {
  valley: { baseFreq: 140, filterFreq: 380, filterType: 'lowpass', modulationRate: 0.2, gain: 0.15 },
  forest: { baseFreq: 120, filterFreq: 420, filterType: 'lowpass', modulationRate: 0.25, gain: 0.18 },
  coast: { baseFreq: 90, filterFreq: 550, filterType: 'bandpass', modulationRate: 0.12, gain: 0.22 },
  marsh: { baseFreq: 85, filterFreq: 320, filterType: 'lowpass', modulationRate: 0.18, gain: 0.16 },
  moor: { baseFreq: 160, filterFreq: 600, filterType: 'bandpass', modulationRate: 0.35, gain: 0.2 },
  swamp: { baseFreq: 80, filterFreq: 280, filterType: 'lowpass', modulationRate: 0.15, gain: 0.18 },
  mountain: { baseFreq: 220, filterFreq: 750, filterType: 'bandpass', modulationRate: 0.45, gain: 0.24 },
  highland: { baseFreq: 180, filterFreq: 680, filterType: 'bandpass', modulationRate: 0.4, gain: 0.2 },
  cavern: { baseFreq: 65, filterFreq: 220, filterType: 'lowpass', modulationRate: 0.08, gain: 0.25 },
  jungle: { baseFreq: 130, filterFreq: 480, filterType: 'lowpass', modulationRate: 0.3, gain: 0.2 },
  grove: { baseFreq: 150, filterFreq: 440, filterType: 'lowpass', modulationRate: 0.22, gain: 0.16 },
  ashland: { baseFreq: 75, filterFreq: 260, filterType: 'lowpass', modulationRate: 0.14, gain: 0.22 },
  tundra: { baseFreq: 240, filterFreq: 820, filterType: 'highpass', modulationRate: 0.28, gain: 0.18 },
  barrens: { baseFreq: 170, filterFreq: 520, filterType: 'bandpass', modulationRate: 0.38, gain: 0.19 },
  spire: { baseFreq: 260, filterFreq: 900, filterType: 'bandpass', modulationRate: 0.5, gain: 0.25 },
}

class BiomeAudioManager {
  private ctx: AudioContext | null = null
  private noiseNode: AudioBufferSourceNode | null = null
  private filterNode: BiquadFilterNode | null = null
  private gainNode: GainNode | null = null
  private lfoNode: OscillatorNode | null = null
  private lfoGain: GainNode | null = null
  private currentBiome: string | null = null
  private isRunning = false

  private initContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const bufferSize = ctx.sampleRate * 2
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const output = buffer.getChannelData(0)
    let lastOut = 0.0

    // Generate gentle brown/pink noise
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1
      lastOut = (lastOut + 0.02 * white) / 1.02
      output[i] = lastOut * 3.5
    }
    return buffer
  }

  public startAmbience(biome: string, _weather?: string): void {
    const ctx = this.initContext()
    if (!ctx) return

    const { masterVolume, ambienceVolume, muted } = useAudioStore.getState()
    const targetGain = muted ? 0 : masterVolume * ambienceVolume

    if (this.isRunning && this.currentBiome === biome) {
      if (this.gainNode) {
        this.gainNode.gain.setTargetAtTime(targetGain * (BIOME_ACOUSTICS[biome]?.gain ?? 0.2), ctx.currentTime, 0.4)
      }
      return
    }

    this.stopAmbience(0.3)

    const acoustics = BIOME_ACOUSTICS[biome] ?? BIOME_ACOUSTICS.valley!
    const noiseBuffer = this.createNoiseBuffer(ctx)

    const source = ctx.createBufferSource()
    source.buffer = noiseBuffer
    source.loop = true

    const filter = ctx.createBiquadFilter()
    filter.type = acoustics.filterType
    filter.frequency.setValueAtTime(acoustics.filterFreq, ctx.currentTime)
    filter.Q.setValueAtTime(2.0, ctx.currentTime)

    // LFO for subtle breathing/wind modulation
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.setValueAtTime(acoustics.modulationRate, ctx.currentTime)

    const lfoGain = ctx.createGain()
    lfoGain.gain.setValueAtTime(acoustics.filterFreq * 0.25, ctx.currentTime)

    lfo.connect(lfoGain)
    lfoGain.connect(filter.frequency)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, targetGain * acoustics.gain), ctx.currentTime + 0.6)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)

    source.start()
    lfo.start()

    this.noiseNode = source
    this.filterNode = filter
    this.lfoNode = lfo
    this.lfoGain = lfoGain
    this.gainNode = gain
    this.currentBiome = biome
    this.isRunning = true
  }

  public stopAmbience(fadeDurationSec = 0.4): void {
    if (!this.isRunning || !this.ctx) return

    if (this.gainNode) {
      try {
        this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, this.ctx.currentTime)
        this.gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + fadeDurationSec)
      } catch {
        // Fallback for immediate mute
      }
    }

    const oldSource = this.noiseNode
    const oldLfo = this.lfoNode

    setTimeout(() => {
      try {
        oldSource?.stop()
        oldSource?.disconnect()
        oldLfo?.stop()
        oldLfo?.disconnect()
      } catch {
        // Ignore already stopped
      }
    }, fadeDurationSec * 1000 + 50)

    this.isRunning = false
    this.currentBiome = null
  }

  public setLodAudioScale(scale: number): void {
    if (!this.isRunning || !this.ctx || !this.gainNode || !this.currentBiome) return
    const { masterVolume, ambienceVolume, muted } = useAudioStore.getState()
    const baseTarget = muted ? 0 : masterVolume * ambienceVolume
    const acoustics = BIOME_ACOUSTICS[this.currentBiome] ?? BIOME_ACOUSTICS.valley!
    const effectiveGain = baseTarget * acoustics.gain * Math.max(0, Math.min(1, scale))
    this.gainNode.gain.setTargetAtTime(effectiveGain, this.ctx.currentTime, 0.2)
  }

  public playCue(type: 'arrival' | 'chime' | 'gust'): void {
    const ctx = this.initContext()
    if (!ctx) return

    const { masterVolume, sfxVolume, muted } = useAudioStore.getState()
    if (muted) return
    const targetGain = masterVolume * sfxVolume * 0.25

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    if (type === 'arrival') {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(220, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.4)
    } else if (type === 'chime') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(660, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3)
    } else {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(140, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.5)
    }

    gain.gain.setValueAtTime(targetGain, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start()
    osc.stop(ctx.currentTime + 0.65)
  }

  public dispose(): void {
    this.stopAmbience(0.1)
    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        this.ctx.close().catch(() => {})
      } catch {
        // Already closed
      }
    }
    this.ctx = null
  }
}

export const biomeAudio = new BiomeAudioManager()
