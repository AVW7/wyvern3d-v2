'use client'

import type { ThemeStyle } from '../constants'
import type { PropBase } from '../props/PropBase'
import { AppleCard, LabButton } from './AppleControls'
import { IconFlame, IconTrash, IconPlus } from './Icons'

interface PropPanelProps {
  t: ThemeStyle
  propsList: PropBase[]
  onSpawnDoe: () => void
  onSpawnBird: () => void
  onClearAll: () => void
  onTriggerFireAttack: () => void
}

export function PropPanel({
  t,
  propsList,
  onSpawnDoe,
  onSpawnBird,
  onClearAll,
  onTriggerFireAttack,
}: PropPanelProps) {
  const doeCount = propsList.filter(p => p.type === 'prey_doe').length
  const birdCount = propsList.filter(p => p.type === 'prey_bird').length
  const roastedCount = propsList.filter(p => p.isRoasting || p.roastProgress > 0.5).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <AppleCard title="Food Props & Prey Spawner" subtitle={`Total Active Props: ${propsList.length}`} themeStyle={t}>
        {/* Spawner Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
          <LabButton themeStyle={t} onClick={onSpawnDoe} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
            <IconPlus />
            <span>Big-Doe (+50)</span>
          </LabButton>

          <LabButton themeStyle={t} onClick={onSpawnBird} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
            <IconPlus />
            <span>Small-Bird (+15)</span>
          </LabButton>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <LabButton
            themeStyle={t}
            onClick={onTriggerFireAttack}
            style={{ flex: 1, display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'center', color: '#f97316' }}
          >
            <IconFlame />
            <span>Fire Breath Attack</span>
          </LabButton>

          <LabButton
            themeStyle={t}
            onClick={onClearAll}
            title="Clear all props"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <IconTrash />
          </LabButton>
        </div>

        {/* Prop Summary Counters */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, textAlign: 'center', fontSize: 10, marginBottom: 8 }}>
          <div style={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 6, padding: '4px 6px' }}>
            <div style={{ color: t.muted }}>Big-Doe</div>
            <div style={{ fontWeight: 700, color: t.text }}>{doeCount}</div>
          </div>
          <div style={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 6, padding: '4px 6px' }}>
            <div style={{ color: t.muted }}>Small-Bird</div>
            <div style={{ fontWeight: 700, color: t.text }}>{birdCount}</div>
          </div>
          <div style={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 6, padding: '4px 6px' }}>
            <div style={{ color: t.muted }}>Roasted</div>
            <div style={{ fontWeight: 700, color: t.text }}>{roastedCount}</div>
          </div>
        </div>

        {/* Active Props List */}
        <div style={{ maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {propsList.length === 0 ? (
            <div style={{ fontSize: 10, color: t.muted, textAlign: 'center', padding: '12px 0' }}>
              No active prey props spawned
            </div>
          ) : (
            propsList.map(prop => (
              <div
                key={prop.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '5px 8px',
                  borderRadius: 6,
                  background: t.cardBg,
                  border: `1px solid ${t.border}`,
                  fontSize: 10,
                  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: prop.isDead ? '#f87171' : prop.isRoasting ? '#f97316' : '#4ade80',
                    }}
                  />
                  <span style={{ fontWeight: 600, color: t.text }}>{prop.id}</span>
                </div>
                <div style={{ color: t.muted }}>
                  HP: {prop.hp}/{prop.maxHp}
                </div>
              </div>
            ))
          )}
        </div>
      </AppleCard>
    </div>
  )
}
