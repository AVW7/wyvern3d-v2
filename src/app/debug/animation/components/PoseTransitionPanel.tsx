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
            label="body yaw"
            value={poseEdits.bodyYaw}
            min={-1.5}
            max={1.5}
            step={0.01}
            disabled={!poseComposer}
            textColor={t.text}
            mutedColor={t.muted}
            accentColor={t.accentColor}
            onChange={(val) => onChangePoseEdit('bodyYaw', val)}
          />
          <Slider
            label="body roll"
            value={poseEdits.bodyRoll}
            min={-1.5}
            max={1.5}
            step={0.01}
            disabled={!poseComposer}
            textColor={t.text}
            mutedColor={t.muted}
            accentColor={t.accentColor}
            onChange={(val) => onChangePoseEdit('bodyRoll', val)}
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

          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: t.accentColor, marginBottom: 4 }}>WING & MEMBRANE CONFIG</div>
            <Slider
              label="Wing Fold (Closed <-> Open)"
              value={poseEdits.wingFold}
              min={-1.0}
              max={1.5}
              step={0.01}
              disabled={!poseComposer}
              textColor={t.text}
              mutedColor={t.muted}
              accentColor={t.accentColor}
              onChange={(val) => onChangePoseEdit('wingFold', val)}
            />
            <Slider
              label="Wing Height (Down <-> Up)"
              value={poseEdits.wingHeight}
              min={-1.5}
              max={1.5}
              step={0.01}
              disabled={!poseComposer}
              textColor={t.text}
              mutedColor={t.muted}
              accentColor={t.accentColor}
              onChange={(val) => onChangePoseEdit('wingHeight', val)}
            />
            <Slider
              label="Membrane Billow / Spread"
              value={poseEdits.membraneBillow}
              min={-1.0}
              max={1.0}
              step={0.01}
              disabled={!poseComposer}
              textColor={t.text}
              mutedColor={t.muted}
              accentColor={t.accentColor}
              onChange={(val) => onChangePoseEdit('membraneBillow', val)}
            />
          </div>

          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: t.accentColor, marginBottom: 4 }}>LEFT WING POINT</div>
            <Slider
              label="L Wing Pitch"
              value={poseEdits.leftWingPitch}
              min={-1.5}
              max={1.5}
              step={0.01}
              disabled={!poseComposer}
              textColor={t.text}
              mutedColor={t.muted}
              accentColor={t.accentColor}
              onChange={(val) => onChangePoseEdit('leftWingPitch', val)}
            />
            <Slider
              label="L Wing Yaw"
              value={poseEdits.leftWingYaw}
              min={-1.5}
              max={1.5}
              step={0.01}
              disabled={!poseComposer}
              textColor={t.text}
              mutedColor={t.muted}
              accentColor={t.accentColor}
              onChange={(val) => onChangePoseEdit('leftWingYaw', val)}
            />
            <Slider
              label="L Wing Roll"
              value={poseEdits.leftWingRoll}
              min={-1.5}
              max={1.5}
              step={0.01}
              disabled={!poseComposer}
              textColor={t.text}
              mutedColor={t.muted}
              accentColor={t.accentColor}
              onChange={(val) => onChangePoseEdit('leftWingRoll', val)}
            />
          </div>

          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: t.accentColor, marginBottom: 4 }}>RIGHT WING POINT</div>
            <Slider
              label="R Wing Pitch"
              value={poseEdits.rightWingPitch}
              min={-1.5}
              max={1.5}
              step={0.01}
              disabled={!poseComposer}
              textColor={t.text}
              mutedColor={t.muted}
              accentColor={t.accentColor}
              onChange={(val) => onChangePoseEdit('rightWingPitch', val)}
            />
            <Slider
              label="R Wing Yaw"
              value={poseEdits.rightWingYaw}
              min={-1.5}
              max={1.5}
              step={0.01}
              disabled={!poseComposer}
              textColor={t.text}
              mutedColor={t.muted}
              accentColor={t.accentColor}
              onChange={(val) => onChangePoseEdit('rightWingYaw', val)}
            />
            <Slider
              label="R Wing Roll"
              value={poseEdits.rightWingRoll}
              min={-1.5}
              max={1.5}
              step={0.01}
              disabled={!poseComposer}
              textColor={t.text}
              mutedColor={t.muted}
              accentColor={t.accentColor}
              onChange={(val) => onChangePoseEdit('rightWingRoll', val)}
            />
          </div>

          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: t.accentColor, marginBottom: 4 }}>LIMBS & LEGS</div>
            <Slider
              label="L Leg Pitch"
              value={poseEdits.leftLegPitch}
              min={-1.5}
              max={1.5}
              step={0.01}
              disabled={!poseComposer}
              textColor={t.text}
              mutedColor={t.muted}
              accentColor={t.accentColor}
              onChange={(val) => onChangePoseEdit('leftLegPitch', val)}
            />
            <Slider
              label="L Leg Yaw"
              value={poseEdits.leftLegYaw}
              min={-1.5}
              max={1.5}
              step={0.01}
              disabled={!poseComposer}
              textColor={t.text}
              mutedColor={t.muted}
              accentColor={t.accentColor}
              onChange={(val) => onChangePoseEdit('leftLegYaw', val)}
            />
            <Slider
              label="R Leg Pitch"
              value={poseEdits.rightLegPitch}
              min={-1.5}
              max={1.5}
              step={0.01}
              disabled={!poseComposer}
              textColor={t.text}
              mutedColor={t.muted}
              accentColor={t.accentColor}
              onChange={(val) => onChangePoseEdit('rightLegPitch', val)}
            />
            <Slider
              label="R Leg Yaw"
              value={poseEdits.rightLegYaw}
              min={-1.5}
              max={1.5}
              step={0.01}
              disabled={!poseComposer}
              textColor={t.text}
              mutedColor={t.muted}
              accentColor={t.accentColor}
              onChange={(val) => onChangePoseEdit('rightLegYaw', val)}
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
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <LabButton
              disabled={!isEdited || !poseComposer}
              themeStyle={t}
              onClick={onResetPoseEdits}
              style={{ flex: 1 }}
            >
              Reset Offsets
            </LabButton>

            <LabButton
              disabled={!poseComposer}
              themeStyle={t}
              onClick={() => {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(poseEdits, null, 2));
                const downloadAnchor = document.createElement('a');
                downloadAnchor.setAttribute("href", dataStr);
                downloadAnchor.setAttribute("download", `wyvern_pose_edits_${Date.now()}.json`);
                document.body.appendChild(downloadAnchor);
                downloadAnchor.click();
                downloadAnchor.remove();
              }}
              style={{ flex: 1, backgroundColor: t.accentColor, color: '#fff' }}
            >
              Export Pose File (.json)
            </LabButton>
          </div>
        </div>
      </AppleCard>
    </div>
  )
}
