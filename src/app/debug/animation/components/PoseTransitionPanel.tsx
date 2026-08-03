'use client'

import type { ThemeStyle } from '../constants'
import type { FlightLabPoseEdits } from '../FlightLab'
import { NEUTRAL_POSE_EDITS } from '../constants'
import { AppleCard, AppleToggle, LabButton, Slider } from './AppleControls'

interface PoseTransitionPanelProps {
  t: ThemeStyle
  poseEdits: FlightLabPoseEdits
  poseComposer: boolean
  onTogglePoseComposer: (enabled: boolean) => void
  onChangePoseEdit: (key: keyof FlightLabPoseEdits, val: number) => void
  onResetPoseEdits: () => void
  onSelectPreset: (presetName: string) => void
  activePreset?: string
  transitionDuration: number
  onChangeTransitionDuration: (duration: number) => void
}

const PRESET_LIST = [
  { name: 'cruise', label: 'Cruise' },
  { name: 'dive', label: 'Dive' },
  { name: 'hover', label: 'Hover' },
  { name: 'speed', label: 'Speed' },
  { name: 'glide', label: 'Glide' },
  { name: 'bankLeft', label: 'Bank Left' },
  { name: 'bankRight', label: 'Bank Right' },
  { name: 'landing', label: 'Landing' },
  { name: 'perched', label: 'Perched' },
]

export function PoseTransitionPanel({
  t,
  poseEdits,
  poseComposer,
  onTogglePoseComposer,
  onChangePoseEdit,
  onResetPoseEdits,
  onSelectPreset,
  activePreset = 'cruise',
  transitionDuration,
  onChangeTransitionDuration,
}: PoseTransitionPanelProps) {
  const isEdited = (Object.keys(NEUTRAL_POSE_EDITS) as (keyof FlightLabPoseEdits)[]).some(
    k => poseEdits[k] !== NEUTRAL_POSE_EDITS[k]
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Pose Composer Enable Toggle */}
      <AppleCard themeStyle={t}>
        <AppleToggle
          checked={poseComposer}
          onChange={onTogglePoseComposer}
          label="Enable Pose Composer"
          sublabel={poseComposer ? "Manual offsets active — sliders apply to rig" : "OFF — only animation clips play"}
          themeStyle={t}
        />
      </AppleCard>

      {/* Pose Presets Card */}
      <AppleCard title="Pose Transition Presets" subtitle={`Active preset: ${activePreset}`} themeStyle={t}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 8 }}>
          {PRESET_LIST.map(p => (
            <LabButton
              key={p.name}
              themeStyle={t}
              active={activePreset === p.name}
              onClick={() => onSelectPreset(p.name)}
            >
              {p.label}
            </LabButton>
          ))}
        </div>

        <Slider
          label="transition duration (seconds)"
          value={transitionDuration}
          min={0.05}
          max={2.0}
          step={0.05}
          textColor={t.text}
          mutedColor={t.muted}
          accentColor={t.accentColor}
          onChange={onChangeTransitionDuration}
        />
      </AppleCard>

      {/* Pose Composer Offsets Card */}
      <AppleCard title="Pose Composer Offsets" subtitle={poseComposer ? "Editing active" : "Enable composer to edit"} themeStyle={t}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Slider
            label="body X (side)"
            value={poseEdits.bodyX}
            min={-20}
            max={20}
            step={0.25}
            disabled={!poseComposer}
            textColor={t.text}
            mutedColor={t.muted}
            accentColor={t.accentColor}
            onChange={(val) => onChangePoseEdit('bodyX', val)}
          />
          <Slider
            label="body Y (altitude)"
            value={poseEdits.bodyY}
            min={-20}
            max={20}
            step={0.25}
            disabled={!poseComposer}
            textColor={t.text}
            mutedColor={t.muted}
            accentColor={t.accentColor}
            onChange={(val) => onChangePoseEdit('bodyY', val)}
          />
          <Slider
            label="body Z (travel)"
            value={poseEdits.bodyZ}
            min={-20}
            max={20}
            step={0.25}
            disabled={!poseComposer}
            textColor={t.text}
            mutedColor={t.muted}
            accentColor={t.accentColor}
            onChange={(val) => onChangePoseEdit('bodyZ', val)}
          />
          <Slider
            label="flight pitch angle"
            value={poseEdits.bodyPitch}
            min={-1.5}
            max={1.5}
            step={0.01}
            disabled={!poseComposer}
            textColor={t.text}
            mutedColor={t.muted}
            accentColor={t.accentColor}
            onChange={(val) => onChangePoseEdit('bodyPitch', val)}
          />
          <Slider
            label="neck pitch"
            value={poseEdits.neckPitch}
            min={-0.6}
            max={0.6}
            step={0.01}
            disabled={!poseComposer}
            textColor={t.text}
            mutedColor={t.muted}
            accentColor={t.accentColor}
            onChange={(val) => onChangePoseEdit('neckPitch', val)}
          />
          <Slider
            label="neck yaw"
            value={poseEdits.neckYaw}
            min={-0.6}
            max={0.6}
            step={0.01}
            disabled={!poseComposer}
            textColor={t.text}
            mutedColor={t.muted}
            accentColor={t.accentColor}
            onChange={(val) => onChangePoseEdit('neckYaw', val)}
          />
          <Slider
            label="tail pitch"
            value={poseEdits.tailPitch}
            min={-0.6}
            max={0.6}
            step={0.01}
            disabled={!poseComposer}
            textColor={t.text}
            mutedColor={t.muted}
            accentColor={t.accentColor}
            onChange={(val) => onChangePoseEdit('tailPitch', val)}
          />
          <Slider
            label="tail bend (yaw)"
            value={poseEdits.tailYaw}
            min={-0.6}
            max={0.6}
            step={0.01}
            disabled={!poseComposer}
            textColor={t.text}
            mutedColor={t.muted}
            accentColor={t.accentColor}
            onChange={(val) => onChangePoseEdit('tailYaw', val)}
          />
          <Slider
            label="hind-leg tuck"
            value={poseEdits.legTuck}
            min={-1}
            max={1}
            step={0.01}
            disabled={!poseComposer}
            textColor={t.text}
            mutedColor={t.muted}
            accentColor={t.accentColor}
            onChange={(val) => onChangePoseEdit('legTuck', val)}
          />

          <LabButton
            disabled={!isEdited || !poseComposer}
            themeStyle={t}
            onClick={onResetPoseEdits}
            style={{ marginTop: 6, width: '100%' }}
          >
            Reset pose offsets
          </LabButton>
        </div>
      </AppleCard>
    </div>
  )
}
