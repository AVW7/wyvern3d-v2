'use client'

import { useState } from 'react'
import type { ThemeStyle } from '../constants'
import { IconSliders, IconTerminal, IconLayers, IconContrast } from './Icons'
import { AnimationControls, type SpeedDynamicsState, type ControllerIsolationState } from './AnimationControls'
import { PoseTransitionPanel } from './PoseTransitionPanel'
import { ReadoutLogPanel, type TelemetrySnapshot, type LogEntry } from './ReadoutLogPanel'
import type { FlightLabPoseEdits } from '../FlightLab'
import { LabButton } from './AppleControls'

interface FlightLabUIProps {
  t: ThemeStyle
  telemetry: TelemetrySnapshot
  logs: LogEntry[]
  speedDynamics: SpeedDynamicsState
  onChangeSpeedDynamics: (updates: Partial<SpeedDynamicsState>) => void
  controllerIsolation: ControllerIsolationState
  onToggleController: (controllerKey: keyof ControllerIsolationState) => void
  onApplyPreset: (presetName: 'hover' | 'glide' | 'cruise' | 'dive') => void
  onClearLogs?: () => void
  poseEdits: FlightLabPoseEdits
  poseComposer: boolean
  onTogglePoseComposer: (enabled: boolean) => void
  onChangePoseEdit: (key: keyof FlightLabPoseEdits, val: number) => void
  onResetPoseEdits: () => void
  onSelectPreset: (presetName: string) => void
  transitionDuration: number
  onChangeTransitionDuration: (duration: number) => void
}

export function FlightLabUI({
  t,
  telemetry,
  logs,
  speedDynamics,
  onChangeSpeedDynamics,
  controllerIsolation,
  onToggleController,
  onApplyPreset,
  onClearLogs,
  poseEdits,
  poseComposer,
  onTogglePoseComposer,
  onChangePoseEdit,
  onResetPoseEdits,
  onSelectPreset,
  transitionDuration,
  onChangeTransitionDuration,
}: FlightLabUIProps) {
  const [activeTab, setActiveTab] = useState<'composer' | 'dynamics' | 'isolation' | 'exporter'>('composer')

  return (
    <div
      style={{
        position: 'absolute',
        top: 78,
        left: 16,
        width: 360,
        maxHeight: 'calc(100vh - 94px)',
        overflowY: 'auto',
        background: t.panelBg,
        backdropFilter: 'blur(24px) saturate(190%)',
        WebkitBackdropFilter: 'blur(24px) saturate(190%)',
        border: `1px solid ${t.border}`,
        borderTop: `1px solid ${t.borderTop}`,
        borderRadius: 14,
        boxShadow: '0 20px 48px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
        padding: 12,
        color: t.text,
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        pointerEvents: 'auto',
      }}
    >
      {/* Manual Control Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${t.border}`, paddingBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.accentColor }}>
          Manual Control Studio
        </div>
        <span style={{ fontSize: 9, color: t.muted, textTransform: 'uppercase' }}>Create Presets</span>
      </div>

      {/* Instructions Banner */}
      <div
        style={{
          fontSize: 10,
          color: t.muted,
          background: t.cardBg,
          padding: '6px 10px',
          borderRadius: 8,
          border: `1px solid ${t.border}`,
          lineHeight: 1.4,
        }}
      >
        Use these controls to <strong style={{ color: t.text }}>craft poses</strong> and test speed dynamics. 
        Export to presets on the right panel when ready.
      </div>

      {/* Dock Tabs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 4,
          padding: 3,
          background: t.segmentedBg,
          borderRadius: 10,
          border: `1px solid ${t.border}`,
        }}
      >
        <LabButton
          themeStyle={t}
          active={activeTab === 'composer'}
          onClick={() => setActiveTab('composer')}
          title="Manual Pose Offsets"
          style={{ fontSize: 10, padding: '4px 6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}
        >
          <IconSliders />
          <span>Pose</span>
        </LabButton>

        <LabButton
          themeStyle={t}
          active={activeTab === 'dynamics'}
          onClick={() => setActiveTab('dynamics')}
          title="Flight Dynamics"
          style={{ fontSize: 10, padding: '4px 6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}
        >
          <IconLayers />
          <span>Dynamics</span>
        </LabButton>

        <LabButton
          themeStyle={t}
          active={activeTab === 'isolation'}
          onClick={() => setActiveTab('isolation')}
          title="System Isolation Matrix"
          style={{ fontSize: 10, padding: '4px 6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}
        >
          <IconContrast />
          <span>Isolate</span>
        </LabButton>

        <LabButton
          themeStyle={t}
          active={activeTab === 'exporter'}
          onClick={() => setActiveTab('exporter')}
          title="Telemetry Exporter"
          style={{ fontSize: 10, padding: '4px 6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}
        >
          <IconTerminal />
          <span>Export</span>
        </LabButton>
      </div>

      {/* Dock Active Panel */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'composer' && (
          <PoseTransitionPanel
            t={t}
            poseEdits={poseEdits}
            poseComposer={poseComposer}
            onTogglePoseComposer={onTogglePoseComposer}
            onChangePoseEdit={onChangePoseEdit}
            onResetPoseEdits={onResetPoseEdits}
            onSelectPreset={onSelectPreset}
            activePreset={telemetry.loopState}
            transitionDuration={transitionDuration}
            onChangeTransitionDuration={onChangeTransitionDuration}
          />
        )}

        {activeTab === 'dynamics' && (
          <AnimationControls
            t={t}
            speedDynamics={speedDynamics}
            onChangeSpeedDynamics={onChangeSpeedDynamics}
            controllerIsolation={controllerIsolation}
            onToggleController={onToggleController}
            onApplyPreset={onApplyPreset}
          />
        )}

        {activeTab === 'isolation' && (
          <AnimationControls
            t={t}
            speedDynamics={speedDynamics}
            onChangeSpeedDynamics={onChangeSpeedDynamics}
            controllerIsolation={controllerIsolation}
            onToggleController={onToggleController}
            onApplyPreset={onApplyPreset}
          />
        )}

        {activeTab === 'exporter' && (
          <ReadoutLogPanel
            t={t}
            telemetry={telemetry}
            logs={logs}
            onClearLogs={onClearLogs}
          />
        )}
      </div>
    </div>
  )
}
