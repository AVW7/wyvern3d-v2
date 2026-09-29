'use client'

import type { ThemeStyle } from '../constants'
import { AppleCard, LabButton, Slider } from './AppleControls'

export interface SpeedDynamicsState {
  airspeed: number
  pitchAngle: number
  headGazeWeight: number
  neckStreamFactor: number
  tailStiffness: number
  tailWaveAmp: number
  legTuckWeight: number
  wingFlutterFreq: number
}

export interface ControllerIsolationState {
  spineWave: boolean
  dynamicTail: boolean
  gazeController: boolean
  dynamicLegs: boolean
  wingRefinement: boolean
  jawSeal: boolean
}

interface AnimationControlsProps {
  t: ThemeStyle
  speedDynamics: SpeedDynamicsState
  onChangeSpeedDynamics: (updates: Partial<SpeedDynamicsState>) => void
  controllerIsolation: ControllerIsolationState
  onToggleController: (controllerKey: keyof ControllerIsolationState) => void
  onApplyPreset: (presetName: 'hover' | 'glide' | 'cruise' | 'speed' | 'dive') => void
}

export function AnimationControls({
  t,
  speedDynamics,
  onChangeSpeedDynamics,
  controllerIsolation,
  onToggleController,
  onApplyPreset,
}: AnimationControlsProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Airspeed & Pitch Controls Card */}
      <AppleCard
        title="Airspeed & Flight Pitch"
        subtitle={`${speedDynamics.airspeed.toFixed(1)} u/s · Pitch ${speedDynamics.pitchAngle.toFixed(1)}°`}
        themeStyle={t}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          <LabButton
            themeStyle={t}
            onClick={() => onApplyPreset('hover')}
            active={speedDynamics.airspeed === 0}
          >
            Hover (0)
          </LabButton>
          <LabButton
            themeStyle={t}
            onClick={() => onApplyPreset('glide')}
            active={speedDynamics.airspeed === 12}
          >
            Glide (12)
          </LabButton>
          <LabButton
            themeStyle={t}
            onClick={() => onApplyPreset('cruise')}
            active={speedDynamics.airspeed === 22}
          >
            Cruise (22)
          </LabButton>
          <LabButton
            themeStyle={t}
            onClick={() => onApplyPreset('speed')}
            active={speedDynamics.airspeed === 42}
          >
            Sprint (42)
          </LabButton>
          <LabButton
            themeStyle={t}
            onClick={() => onApplyPreset('dive')}
            active={speedDynamics.airspeed === 50}
          >
            Dive (50)
          </LabButton>
        </div>

        <Slider
          label="airspeed (0 - 60 u/s)"
          value={speedDynamics.airspeed}
          min={0}
          max={60}
          step={0.5}
          textColor={t.text}
          mutedColor={t.muted}
          accentColor={t.accentColor}
          onChange={(airspeed) => onChangeSpeedDynamics({ airspeed })}
        />
        <Slider
          label="pitch angle (-30° to +45°)"
          value={speedDynamics.pitchAngle}
          min={-30}
          max={45}
          step={1}
          textColor={t.text}
          mutedColor={t.muted}
          accentColor={t.accentColor}
          onChange={(pitchAngle) => onChangeSpeedDynamics({ pitchAngle })}
        />
      </AppleCard>

      {/* Head, Neck & Tail Dynamics Card */}
      <AppleCard title="Head, Neck & Tail Dynamics" themeStyle={t}>
        <div style={{ fontSize: 11, fontWeight: 600, color: t.text, marginBottom: 4 }}>
          Head & Neck Tuning
        </div>
        <Slider
          label="gaze lock weight"
          value={speedDynamics.headGazeWeight}
          min={0}
          max={1}
          step={0.05}
          textColor={t.text}
          mutedColor={t.muted}
          accentColor={t.accentColor}
          onChange={(headGazeWeight) => onChangeSpeedDynamics({ headGazeWeight })}
        />
        <Slider
          label="neck aerodynamic stream"
          value={speedDynamics.neckStreamFactor}
          min={0}
          max={1}
          step={0.05}
          textColor={t.text}
          mutedColor={t.muted}
          accentColor={t.accentColor}
          onChange={(neckStreamFactor) => onChangeSpeedDynamics({ neckStreamFactor })}
        />

        <div style={{ fontSize: 11, fontWeight: 600, color: t.text, margin: '8px 0 4px 0' }}>
          Tail Flex & Drag
        </div>
        <Slider
          label="tail stiffness weight"
          value={speedDynamics.tailStiffness}
          min={0.1}
          max={2.0}
          step={0.05}
          textColor={t.text}
          mutedColor={t.muted}
          accentColor={t.accentColor}
          onChange={(tailStiffness) => onChangeSpeedDynamics({ tailStiffness })}
        />
        <Slider
          label="wave amplitude"
          value={speedDynamics.tailWaveAmp}
          min={0}
          max={0.3}
          step={0.01}
          textColor={t.text}
          mutedColor={t.muted}
          accentColor={t.accentColor}
          onChange={(tailWaveAmp) => onChangeSpeedDynamics({ tailWaveAmp })}
        />
      </AppleCard>

      {/* Procedural Isolation Matrix Card */}
      <AppleCard title="System Isolation Toggles" themeStyle={t}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {Object.entries(controllerIsolation).map(([key, enabled]) => (
            <label
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '5px 8px',
                borderRadius: 6,
                background: enabled ? 'rgba(59, 130, 246, 0.12)' : t.cardBg,
                border: `1px solid ${enabled ? t.accentColor : t.border}`,
                color: enabled ? t.text : t.muted,
                fontSize: 11,
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <span style={{ textTransform: 'capitalize' }}>
                {key.replace(/([A-Z])/g, ' $1')}
              </span>
              <input
                type="checkbox"
                checked={enabled}
                onChange={() => onToggleController(key as keyof ControllerIsolationState)}
                style={{ accentColor: t.accentColor, cursor: 'pointer' }}
              />
            </label>
          ))}
        </div>
      </AppleCard>
    </div>
  )
}
