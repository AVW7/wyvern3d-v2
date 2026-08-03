'use client'

import type { PropBase } from '../props/PropBase'
import {
  EXTRA_SCALES,
  SPECIES,
  type ThemeStyle,
} from '../constants'
import { AppleCard, AppleToggle, LabButton, Slider } from './AppleControls'
import {
  IconCheck,
  IconCopy,
  IconFlame,
  IconKeyboard,
  IconPlus,
  IconTarget,
  IconTrash,
  IconWind,
} from './Icons'

interface FlightLabControlPanelProps {
  t: ThemeStyle
  readout: React.RefObject<HTMLPreElement | null>
  copied: boolean
  handleCopyReadout: () => void
  onTriggerScoutMode?: () => void
  onTriggerSpeedSprint?: () => void
  onTriggerFireAttack?: () => void
  propsList?: PropBase[]
  onSpawnDoe?: () => void
  onSpawnBird?: () => void
  onClearProps?: () => void
  procedural: boolean
  setProcedural: (procedural: boolean) => void
  frozen: boolean
  setFrozen: (frozen: boolean) => void
  scrub: number
  setScrub: (scrub: number) => void
  fireBreath: boolean
  setFireBreath: (fireBreath: boolean) => void
  overlays: boolean
  setOverlays: (overlays: boolean) => void
  speciesIndex: number
  setSpeciesIndex: (index: number) => void
  species: { id: string; label: string; scale: number }
  extraScale: number
  setExtraScale: (scale: number) => void
  /** Grounded animation presets */
  groundedPresets?: { id: string; label: string }[]
  activePreset?: string
  onSelectPreset?: (presetId: string) => void
}

export function FlightLabControlPanel({
  t,
  readout,
  copied,
  handleCopyReadout,
  onTriggerScoutMode,
  onTriggerSpeedSprint,
  onTriggerFireAttack,
  propsList = [],
  onSpawnDoe,
  onSpawnBird,
  onClearProps,
  procedural,
  setProcedural,
  frozen,
  setFrozen,
  scrub,
  setScrub,
  fireBreath,
  setFireBreath,
  overlays,
  setOverlays,
  speciesIndex,
  setSpeciesIndex,
  species,
  extraScale,
  setExtraScale,
  groundedPresets,
  activePreset,
  onSelectPreset,
}: FlightLabControlPanelProps) {
  const doeCount = propsList.filter(p => p.type === 'prey_doe').length
  const birdCount = propsList.filter(p => p.type === 'prey_bird').length

  return (
    <div
      className="panel flight-lab-panel liquid-glass"
      style={{
        position: 'absolute',
        top: 78,
        right: 16,
        left: 'auto',
        transform: 'none',
        width: 360,
        maxHeight: 'calc(100vh - 94px)',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* Presets & Behavior Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${t.border}`, paddingBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.accentColor }}>
          Presets & Behavior Lab
        </div>
        <span style={{ fontSize: 9, color: t.muted, textTransform: 'uppercase' }}>Develop & Test</span>
      </div>

      {/* Core Principle Banner */}
      <div
        style={{
          fontSize: 10,
          color: t.text,
          background: `linear-gradient(135deg, ${t.accentColor}15, ${t.cardBg})`,
          padding: '8px 10px',
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          border: `1px solid ${t.accentColor}30`,
        }}
      >
        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: t.accentColor }}>◆</span> Core Flight Principles
        </div>
        <div style={{ color: t.muted, lineHeight: 1.4 }}>
          • <strong style={{ color: t.text }}>Head always steers</strong> — like a house, the head points where you're going<br/>
          • <strong style={{ color: t.text }}>Body follows speed</strong> — tuck legs for aerodynamics at high speed<br/>
          • <strong style={{ color: t.text }}>Actions chain</strong> — takeoff → search → engage → return
        </div>
      </div>

      {/* Animation Clips Card - Grounded Presets */}
      {groundedPresets && onSelectPreset && (
        <AppleCard title="Animation Clips" subtitle="Grounded behavior presets" themeStyle={t}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {groundedPresets.map((preset) => (
              <LabButton
                key={preset.id}
                active={activePreset === preset.id}
                themeStyle={t}
                onClick={() => onSelectPreset(preset.id)}
              >
                {preset.label}
              </LabButton>
            ))}
          </div>
        </AppleCard>
      )}

      {/* Quick Shortcuts Bar */}
      <div
        style={{
          fontSize: 10,
          color: t.muted,
          background: t.cardBg,
          padding: '6px 10px',
          borderRadius: 8,
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          alignItems: 'center',
          border: `1px solid ${t.border}`,
          borderTop: `1px solid ${t.borderTop}`,
        }}
      >
        <IconKeyboard />
        <span style={{ fontWeight: 600 }}>Hotkeys:</span>
        <span>←/→ clips</span>
        <span>Space freeze</span>
        <span>C center</span>
        <span>F fit</span>
        <span>+/- zoom</span>
      </div>

      {/* Behavior Actions Card - Develop & Test Presets */}
      <AppleCard title="Behavior Actions" subtitle="Test complete action sequences" themeStyle={t}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {onTriggerScoutMode && (
            <LabButton
              themeStyle={t}
              onClick={onTriggerScoutMode}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconTarget />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600 }}>Scout Flight Mode</span>
                  <span style={{ fontSize: 9, color: t.muted }}>Takeoff → Search → Engage → Return</span>
                </div>
              </div>
              <span style={{ fontSize: 9, color: t.accentColor, fontWeight: 600 }}>12 u/s</span>
            </LabButton>
          )}

          {onTriggerSpeedSprint && (
            <LabButton
              themeStyle={t}
              onClick={onTriggerSpeedSprint}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconWind />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600 }}>High-Speed Sprint</span>
                  <span style={{ fontSize: 9, color: t.muted }}>Legs tucked, head streamlined</span>
                </div>
              </div>
              <span style={{ fontSize: 9, color: t.accentColor, fontWeight: 600 }}>42+ u/s</span>
            </LabButton>
          )}

          {onTriggerFireAttack && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <LabButton
                themeStyle={t}
                onClick={() => {
                  setFireBreath(true)
                  onTriggerFireAttack()
                }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '7px 8px', color: '#f97316' }}
                title="Instant fire burst (0 cooldown — click repeatedly)"
              >
                <IconFlame />
                <span style={{ fontWeight: 600 }}>Fire Attack</span>
              </LabButton>

              <LabButton
                themeStyle={t}
                active={fireBreath}
                onClick={() => setFireBreath(!fireBreath)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '7px 8px' }}
                title="Continuous repeat stream loop for inspection & testing"
              >
                <span style={{ fontWeight: 600 }}>{fireBreath ? 'Stop Loop' : 'Repeat Loop'}</span>
              </LabButton>
            </div>
          )}
        </div>

        {/* Action Readout */}
        <div
          style={{
            marginTop: 10,
            padding: '8px 10px',
            background: t.readoutBg,
            border: `1px solid ${t.border}`,
            borderRadius: 8,
            fontSize: 10,
            color: t.muted,
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 600, color: t.text, marginBottom: 4 }}>Readout:</div>
          <div>• <strong style={{ color: t.text }}>Scout</strong>: Takeoff → Aerial Loiter (search for food/enemy/resource from sky) → Engage → Return</div>
          <div>• <strong style={{ color: t.text }}>Sprint</strong>: Hind legs tucked for aerodynamics, head leads body orientation</div>
          <div>• <strong style={{ color: t.text }}>Fire Attack</strong>: Mouth stream, head tracks target, body stabilizes</div>
        </div>
      </AppleCard>

      {/* Prey Props Spawner Card */}
      {onSpawnDoe && onSpawnBird && (
        <AppleCard title="Prey Props Spawner" subtitle={`Active Prey Props: ${propsList.length}`} themeStyle={t}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
            <LabButton themeStyle={t} onClick={onSpawnDoe} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
              <IconPlus />
              <span>Big-Doe ({doeCount})</span>
            </LabButton>

            <LabButton themeStyle={t} onClick={onSpawnBird} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
              <IconPlus />
              <span>Small-Bird ({birdCount})</span>
            </LabButton>
          </div>
          {onClearProps && propsList.length > 0 && (
            <LabButton themeStyle={t} onClick={onClearProps} style={{ width: '100%', display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
              <IconTrash />
              <span>Clear Prey Props</span>
            </LabButton>
          )}
        </AppleCard>
      )}

      {/* Layers Card */}
      <AppleCard title="Simulation Layers" themeStyle={t}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <AppleToggle
            checked={procedural}
            onChange={setProcedural}
            label="Procedural pitch/bank"
            sublabel="Authored posture must read with OFF"
            themeStyle={t}
          />
          <AppleToggle
            checked={frozen}
            onChange={setFrozen}
            label="Freeze mixer"
            sublabel="Pause clip playback for frame inspection"
            themeStyle={t}
          />
          <Slider
            label="phase scrub"
            value={scrub}
            min={0}
            max={1}
            step={0.001}
            disabled={!frozen}
            textColor={t.text}
            mutedColor={t.muted}
            accentColor={t.accentColor}
            onChange={setScrub}
          />
          <LabButton
            themeStyle={t}
            active={fireBreath}
            onClick={() => {
              const next = !fireBreath
              setFireBreath(next)
              if (next && onTriggerFireAttack) onTriggerFireAttack()
            }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', width: '100%' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconFlame />
              <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                <span style={{ fontWeight: 600 }}>Fire Breath Stream</span>
                <span style={{ fontSize: 9, color: t.muted }}>Mouth-attached fire jet cone & particles</span>
              </div>
            </div>
            <span style={{ fontSize: 9, color: fireBreath ? '#f97316' : t.muted, fontWeight: 600 }}>
              {fireBreath ? 'ACTIVE' : 'IGNITE'}
            </span>
          </LabButton>
          <AppleToggle
            checked={overlays}
            onChange={setOverlays}
            label="Overlays & Bone Markers"
            sublabel="Origin axes, bounding boxes & key bones"
            themeStyle={t}
          />
        </div>
      </AppleCard>

      {/* Model Scale Card */}
      <AppleCard
        title="Model Scale & Species"
        subtitle={`Effective scale ${(species.scale * extraScale).toFixed(2)}x`}
        themeStyle={t}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {SPECIES.map((item, i) => (
            <LabButton
              key={item.id}
              active={i === speciesIndex}
              themeStyle={t}
              onClick={() => setSpeciesIndex(i)}
            >
              {item.label}
            </LabButton>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
          {EXTRA_SCALES.map((item) => (
            <LabButton
              key={item.label}
              active={item.value === extraScale}
              themeStyle={t}
              onClick={() => setExtraScale(item.value)}
            >
              {item.label}
            </LabButton>
          ))}
        </div>
      </AppleCard>

      {/* Telemetry Readout Card */}
      <AppleCard title="Xcode Telemetry Console" themeStyle={t}>
        <div
          style={{
            background: t.readoutBg,
            border: `1px solid ${t.border}`,
            borderRadius: 10,
            padding: 10,
            boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.4)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: t.muted,
                fontWeight: 700,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: t.accentColor,
                  boxShadow: `0 0 6px ${t.accentColor}`,
                }}
              />
              Live Rig Telemetry
            </div>
            <LabButton
              themeStyle={t}
              onClick={handleCopyReadout}
              title="Copy live telemetry to clipboard"
              style={{
                fontSize: 10,
                padding: '2px 8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {copied ? <IconCheck /> : <IconCopy />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </LabButton>
          </div>
          <pre
            ref={readout}
            onClick={handleCopyReadout}
            title="Click to copy telemetry to clipboard"
            style={{
              fontSize: 10.5,
              lineHeight: 1.45,
              margin: 0,
              whiteSpace: 'pre',
              color: t.readoutText,
              fontFamily:
                'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
              cursor: 'pointer',
              overflowX: 'auto',
            }}
          />
        </div>
      </AppleCard>
    </div>
  )
}
