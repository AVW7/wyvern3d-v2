'use client'

import { useMemo, useState } from 'react'
import { GROUPS, type ThemeStyle } from '../constants'
import { AppleCard, LabButton } from './AppleControls'
import type { GroundedPreset } from './FlightLabControlPanel'

interface ClipPresetCardProps {
  t: ThemeStyle
  groundedPresets: GroundedPreset[]
  activePreset?: string
  onSelectPreset: (presetId: string) => void
}

export function ClipPresetCard({
  t,
  groundedPresets,
  activePreset,
  onSelectPreset,
}: ClipPresetCardProps) {
  const [presetCategory, setPresetCategory] = useState('all')

  const groupMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const group of GROUPS) {
      for (const st of group.states) map.set(st, group.label)
    }
    return map
  }, [])

  const uniqueClipsCount = useMemo(
    () => new Set(groundedPresets.map((preset) => preset.clip ?? preset.id)).size,
    [groundedPresets],
  )
  const aliasCount = useMemo(
    () => groundedPresets.filter((preset) => (preset.clip && preset.clip !== preset.id) || (preset.shared && preset.shared > 1)).length,
    [groundedPresets],
  )
  const filteredPresets = useMemo(() => {
    if (presetCategory === 'all') return groundedPresets
    if (presetCategory === 'aliases') {
      return groundedPresets.filter((preset) => (preset.clip && preset.clip !== preset.id) || (preset.shared && preset.shared > 1))
    }
    return groundedPresets.filter((preset) => groupMap.get(preset.id)?.toLowerCase() === presetCategory.toLowerCase())
  }, [groundedPresets, presetCategory, groupMap])

  const activePresetObj = groundedPresets.find((preset) => preset.id === activePreset)
  const activeClipName = activePresetObj?.clip ?? activePreset

  return (
    <AppleCard
      title="Animation Clips"
      subtitle={`${groundedPresets.length} presets · ${uniqueClipsCount} distinct clips (${aliasCount} shared)`}
      themeStyle={t}
    >
      {activePresetObj && (
        <div
          style={{
            fontSize: 10,
            padding: '4px 8px',
            borderRadius: 6,
            background: t.cardBg,
            border: `1px solid ${t.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
            marginBottom: 6,
          }}
        >
          <div>
            <span>Preset: </span>
            <strong style={{ color: t.text }}>{activePresetObj.label}</strong>
            <span> → Clip: </span>
            <span style={{ color: t.accentColor, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: 600 }}>
              {activeClipName}
            </span>
          </div>
          {activePresetObj.clip && activePresetObj.clip !== activePresetObj.id ? (
            <span
              style={{
                fontSize: 8.5,
                padding: '1px 5px',
                borderRadius: 4,
                background: 'rgba(234, 179, 8, 0.15)',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                color: '#eab308',
                fontWeight: 600,
              }}
              title={`Shares '${activePresetObj.clip}' with ${activePresetObj.shared ?? 1} states`}
            >
              Alias ({activePresetObj.shared}x)
            </span>
          ) : (
            <span
              style={{
                fontSize: 8.5,
                padding: '1px 5px',
                borderRadius: 4,
                background: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                color: '#22c55e',
                fontWeight: 600,
              }}
            >
              Unique
            </span>
          )}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 3,
          marginBottom: 6,
          padding: 2,
          background: t.segmentedBg,
          borderRadius: 6,
          border: `1px solid ${t.border}`,
        }}
      >
        {[
          { id: 'all', label: `All (${groundedPresets.length})` },
          { id: 'flight', label: 'Flight' },
          { id: 'ground', label: 'Ground' },
          { id: 'hunt', label: 'Hunt' },
          { id: 'ambient', label: 'Ambient' },
          { id: 'aliases', label: `Shared (${aliasCount})` },
        ].map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setPresetCategory(cat.id)}
            style={{
              fontSize: 9,
              fontWeight: presetCategory === cat.id ? 700 : 500,
              padding: '2px 6px',
              borderRadius: 4,
              border: 'none',
              background: presetCategory === cat.id ? t.accentColor : 'transparent',
              color: presetCategory === cat.id ? t.buttonActiveText : t.muted,
              cursor: 'pointer',
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {filteredPresets.map((preset) => {
          const isAlias = preset.clip && preset.clip !== preset.id
          const isSelected = activePreset === preset.id
          return (
            <LabButton
              key={preset.id}
              active={isSelected}
              themeStyle={t}
              onClick={() => onSelectPreset(preset.id)}
              title={`Preset: ${preset.label} → Plays clip: ${preset.clip ?? preset.id}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, padding: '3px 6px' }}
            >
              <span>{preset.label}</span>
              {isAlias && (
                <span
                  style={{
                    fontSize: 8,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    opacity: isSelected ? 0.9 : 0.65,
                    background: isSelected ? 'rgba(0, 0, 0, 0.2)' : t.cardBg,
                    padding: '0 3px',
                    borderRadius: 3,
                    border: `1px solid ${t.border}`,
                  }}
                >
                  →{preset.clip}
                </span>
              )}
            </LabButton>
          )
        })}
      </div>
    </AppleCard>
  )
}
