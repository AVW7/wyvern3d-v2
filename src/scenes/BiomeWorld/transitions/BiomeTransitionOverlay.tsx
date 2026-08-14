'use client'

import { useEffect, useState } from 'react'
import { useGame } from '@/state/store'
import { useAudioStore } from '@/state/audioStore'
import { REGIONS, REGION_LIST, STARTING_REGION } from '@/core/data/regions'
import { getBiomePalette } from '../atmosphere/biomePalettes'
import { biomeAudio } from '../audio/biomeAudio'

interface BiomeTransitionOverlayProps {
  regionId?: string
  onComplete?: () => void
}

export function BiomeTransitionOverlay({
  regionId,
  onComplete,
}: BiomeTransitionOverlayProps) {
  const setMode = useGame((s) => s.setMode)
  const effectiveRegionId = regionId ?? STARTING_REGION
  const regionDef = REGIONS[effectiveRegionId] ?? REGION_LIST[0]!
  const palette = getBiomePalette(regionDef.biome)
  const reducedMotion = useAudioStore((s) => s.reducedMotion)

  const [visible, setVisible] = useState(true)
  const [fading, setFading] = useState(false)

  const dismiss = () => {
    setFading(true)
    biomeAudio.playCue('arrival')
    setTimeout(() => {
      setVisible(false)
      onComplete?.()
    }, reducedMotion ? 50 : 350)
  }

  useEffect(() => {
    // Keyboard shortcut to skip: Space or Enter or Escape
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') {
        e.preventDefault()
        dismiss()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    // Auto fade-out timer
    const timer = setTimeout(
      () => {
        dismiss()
      },
      reducedMotion ? 200 : 1200,
    )

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      clearTimeout(timer)
    }
  }, [reducedMotion])

  if (!visible) return null

  return (
    <div
      className="liquid-glass"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 900,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: `radial-gradient(circle at center, ${palette.background} 0%, rgba(10, 10, 16, 0.94) 80%)`,
        opacity: fading ? 0 : 1,
        transition: reducedMotion ? 'opacity 0.05s ease' : 'opacity 0.35s ease',
        cursor: 'pointer',
        pointerEvents: fading ? 'none' : 'auto',
      }}
      onClick={dismiss}
    >
      <div
        style={{
          textAlign: 'center',
          maxWidth: 480,
          padding: '24px 32px',
          borderRadius: 16,
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
        }}
      >
        <span
          style={{
            fontSize: 12,
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: palette.accentColor,
            fontWeight: 700,
          }}
        >
          {regionDef.biome} Expedition
        </span>
        <h1
          style={{
            fontSize: 32,
            margin: '8px 0 12px',
            color: '#fff',
            textShadow: '0 2px 10px rgba(0,0,0,0.5)',
          }}
        >
          {regionDef.name}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
          {regionDef.atlas?.summary ?? `Venturing into the territory of ${regionDef.name}.`}
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            className="primary"
            style={{ padding: '8px 18px', fontSize: 12 }}
            onClick={(e) => {
              e.stopPropagation()
              dismiss()
            }}
          >
            Enter Region (Space)
          </button>
          <button
            style={{ padding: '8px 14px', fontSize: 12 }}
            onClick={(e) => {
              e.stopPropagation()
              setMode('worldmap')
            }}
          >
            Return to Map
          </button>
        </div>
      </div>
    </div>
  )
}
