'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import type { FlightLoopState } from '@/render/flightPose'
import { SPECIES, THEME_STYLES } from './constants'
import { FlightLabUI } from './components/FlightLabUI'
import { FlightLabTopbar } from './components/FlightLabTopbar'
import { FlightLabControlPanel } from './components/FlightLabControlPanel'
import { useFlightLabState } from './hooks/useFlightLabState'
import { useFlightLabShortcuts } from './hooks/useFlightLabShortcuts'
import { IconEye } from './components/Icons'
import type { FlightLabProps } from './FlightLab'
import type { LabSearch } from './labPresets'

const FlightLab = dynamic<FlightLabProps>(() => import('./FlightLab').then((m) => m.FlightLab), { ssr: false })

export function FlightLabClient({ initial }: { initial?: Partial<LabSearch> }) {
  const state = useFlightLabState(initial)

  useFlightLabShortcuts({
    step: state.step,
    setAuto: state.setAuto,
    setFrozen: state.setFrozen,
    setCenterTrigger: state.setCenterTrigger,
    setZoomFitTrigger: state.setZoomFitTrigger,
    setZoomInTrigger: state.setZoomInTrigger,
    setZoomOutTrigger: state.setZoomOutTrigger,
    setPanelOpen: state.setPanelOpen,
    setHideUI: state.setHideUI,
  })

  const species = SPECIES[state.speciesIndex] ?? SPECIES[0]!
  const t = THEME_STYLES[state.theme]

  return (
    <div
      id="game-root"
      style={{
        color: t.text,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
      }}
    >
      <style>{`
        .apple-button:active:not(:disabled) {
          transform: scale(0.96) !important;
        }
        .apple-button:hover:not(:disabled) {
          filter: brightness(1.08);
        }
        .apple-kbd {
          font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, monospace !important;
          font-size: 9px !important;
          font-weight: 600 !important;
          padding: 1px 5px !important;
          border-radius: 4px !important;
          background: rgba(0, 0, 0, 0.25) !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.3) !important;
          color: currentColor !important;
        }
        .flight-lab-overlay {
          position: fixed;
          inset: 0;
          pointer-events: none;
          display: flex;
          flex-direction: column;
          padding: 8px 12px 12px;
          gap: 8px;
          z-index: 10;
          box-sizing: border-box;
        }
        .flight-lab-topbar {
          position: relative !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 6px !important;
          flex-wrap: wrap !important;
          padding: 5px 10px !important;
          background: ${t.bg} !important;
          backdrop-filter: blur(24px) saturate(190%) !important;
          -webkit-backdrop-filter: blur(24px) saturate(190%) !important;
          border: 1px solid ${t.border} !important;
          border-top: 1px solid ${t.borderTop} !important;
          border-radius: 10px !important;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15) !important;
          z-index: 20 !important;
          pointer-events: auto !important;
          width: 100% !important;
          box-sizing: border-box !important;
          flex-shrink: 0 !important;
        }
        .flight-lab-topbar::before {
          content: '';
          position: absolute;
          top: 0;
          left: 6%;
          right: 6%;
          height: 1px;
          background: linear-gradient(90deg, transparent, ${t.accentColor}, transparent);
          opacity: 0.5;
          pointer-events: none;
        }
        .flight-lab-panels-container {
          display: flex !important;
          justify-content: space-between !important;
          align-items: stretch !important;
          flex: 1 1 0% !important;
          min-height: 0 !important;
          pointer-events: none !important;
          gap: 12px !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }
        .flight-lab-panel,
        .flight-lab-left-panel {
          position: relative !important;
          top: auto !important;
          bottom: auto !important;
          left: auto !important;
          right: auto !important;
          transform: none !important;
          animation: none !important;
          max-height: 100% !important;
          overflow-y: auto !important;
          pointer-events: auto !important;
          background: ${t.panelBg} !important;
          backdrop-filter: blur(24px) saturate(190%) !important;
          -webkit-backdrop-filter: blur(24px) saturate(190%) !important;
          border: 1px solid ${t.border} !important;
          border-top: 1px solid ${t.borderTop} !important;
          border-radius: 14px !important;
          box-shadow: 0 20px 48px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15) !important;
          padding: 10px !important;
          color: ${t.text} !important;
          z-index: 10 !important;
          box-sizing: border-box !important;
          transition: border-color 0.2s ease, background-color 0.2s ease !important;
        }
        .flight-lab-panel {
          width: 360px !important;
          max-width: min(360px, calc(50vw - 20px)) !important;
          flex-shrink: 0 !important;
        }
        .flight-lab-left-panel {
          width: 360px !important;
          max-width: min(360px, calc(50vw - 20px)) !important;
          flex-shrink: 0 !important;
        }
        .flight-lab-panel::-webkit-scrollbar,
        .flight-lab-left-panel::-webkit-scrollbar {
          width: 6px;
        }
        .flight-lab-panel::-webkit-scrollbar-track,
        .flight-lab-left-panel::-webkit-scrollbar-track {
          background: transparent;
        }
        .flight-lab-panel::-webkit-scrollbar-thumb,
        .flight-lab-left-panel::-webkit-scrollbar-thumb {
          background: ${t.border};
          border-radius: 3px;
        }
        .flight-lab-panel::before,
        .flight-lab-left-panel::before {
          content: '';
          position: absolute;
          top: 0;
          left: 8%;
          right: 8%;
          height: 1px;
          background: linear-gradient(90deg, transparent, ${t.accentColor}, transparent);
          opacity: 0.4;
          pointer-events: none;
        }
        @media (max-width: 768px) {
          .flight-lab-panels-container {
            flex-direction: column !important;
            overflow-y: auto !important;
            pointer-events: auto !important;
          }
          .flight-lab-panel,
          .flight-lab-left-panel {
            width: 100% !important;
            max-width: 100% !important;
            flex-shrink: 1 !important;
            max-height: none !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .apple-button, .flight-lab-panel, .flight-lab-left-panel, .flight-lab-topbar {
            transition: none !important;
            transform: none !important;
          }
        }
        @media (prefers-reduced-transparency: reduce) {
          .flight-lab-topbar, .flight-lab-panel, .flight-lab-left-panel {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: ${t.panelBgSolid} !important;
          }
        }
      `}</style>
      <Suspense fallback={null}>
        <FlightLab
          speciesId={species.id}
          compareId={state.compareId}
          requestedState={state.state}
          auto={state.auto}
          scale={state.extraScale}
          horizontalSpeed={state.horizontalSpeed}
          verticalSpeed={state.verticalSpeed}
          yawRate={state.yawRate}
          referenceSpeed={state.referenceSpeed}
          powered={state.powered}
          boosting={state.boosting}
          searching={state.searching}
          procedural={state.procedural}
          frozen={state.frozen}
          scrub={state.frozen ? state.scrub : null}
          camera={state.camera}
          theme={state.theme}
          overlays={state.overlays}
          fireBreath={state.fireBreath}
          poseComposer={state.poseComposer}
          poseEdits={state.poseEdits}
          readout={state.readout}
          onActiveState={(s) => state.setActiveLoop(s as FlightLoopState)}
          onTelemetry={state.handleLiveTelemetry}
          controllerIsolation={state.controllerIsolation}
          speedDynamics={state.speedDynamics}
          transitionDuration={state.transitionDuration}
          propManager={state.propManager}
          propsList={state.propsList}
          centerTrigger={state.centerTrigger}
          zoomFitTrigger={state.zoomFitTrigger}
          zoomInTrigger={state.zoomInTrigger}
          zoomOutTrigger={state.zoomOutTrigger}
          resetCamTrigger={state.resetCamTrigger}
        />
      </Suspense>

      <div className="flight-lab-overlay">
        {!state.hideUI && (
          <>
            <FlightLabTopbar
              t={t}
              camera={state.camera}
              setCamera={state.setCamera}
              theme={state.theme}
              setTheme={state.setTheme}
              frozen={state.frozen}
              setFrozen={state.setFrozen}
              auto={state.auto}
              setAuto={state.setAuto}
              panelOpen={state.panelOpen}
              setPanelOpen={state.setPanelOpen}
              hideUI={state.hideUI}
              setHideUI={state.setHideUI}
              setCenterTrigger={state.setCenterTrigger}
              setZoomFitTrigger={state.setZoomFitTrigger}
              setZoomInTrigger={state.setZoomInTrigger}
              setZoomOutTrigger={state.setZoomOutTrigger}
              setResetCamTrigger={state.setResetCamTrigger}
            />

            {state.panelOpen && (
              <div className="flight-lab-panels-container">
                <FlightLabUI
                  t={t}
                  telemetry={state.telemetry}
                  logs={state.logs}
                  speedDynamics={state.speedDynamics}
                  onChangeSpeedDynamics={state.handleChangeSpeedDynamics}
                  controllerIsolation={state.controllerIsolation}
                  onToggleController={state.handleToggleController}
                  onApplyPreset={state.handleApplySpeedPreset}
                  onClearLogs={() => state.setLogs([])}
                  poseEdits={state.poseEdits}
                  poseComposer={state.poseComposer}
                  onTogglePoseComposer={state.setPoseComposer}
                  onChangePoseEdit={state.handleChangePoseEdit}
                  onResetPoseEdits={state.handleResetPoseEdits}
                  onSelectPreset={state.handleSelectPreset}
                  transitionDuration={state.transitionDuration}
                  onChangeTransitionDuration={state.setTransitionDuration}
                />

                <FlightLabControlPanel
                  t={t}
                  readout={state.readout}
                  copied={state.copied}
                  handleCopyReadout={state.handleCopyReadout}
                  onTriggerScoutMode={state.handleTriggerScoutMode}
                  onTriggerSpeedSprint={state.handleTriggerSpeedSprint}
                  onTriggerFireAttack={state.handleTriggerFireAttack}
                  propsList={state.propsList}
                  onSpawnDoe={state.handleSpawnDoe}
                  onSpawnBird={state.handleSpawnBird}
                  onClearProps={state.handleClearProps}
                  procedural={state.procedural}
                  setProcedural={state.setProcedural}
                  frozen={state.frozen}
                  setFrozen={state.setFrozen}
                  scrub={state.scrub}
                  setScrub={state.setScrub}
                  fireBreath={state.fireBreath}
                  setFireBreath={state.setFireBreath}
                  overlays={state.overlays}
                  setOverlays={state.setOverlays}
                  speciesIndex={state.speciesIndex}
                  setSpeciesIndex={state.setSpeciesIndex}
                  compareId={state.compareId}
                  setCompareId={state.setCompareId}
                  species={species}
                  extraScale={state.extraScale}
                  setExtraScale={state.setExtraScale}
                  groundedPresets={state.annotatedPresets}
                  activePreset={state.annotatedPresets.find((preset) => preset.id === state.state)?.id}
                  onSelectPreset={state.handleSelectPreset}
                />
              </div>
            )}
          </>
        )}

        {state.hideUI && (
          <button
            onClick={() => state.setHideUI(false)}
            className="apple-button liquid-glass"
            title="Show UI (HotKey: H or P or Esc)"
            style={{
              position: 'absolute',
              top: 10,
              right: 12,
              zIndex: 30,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              fontSize: 10.5,
              fontWeight: 600,
              background: t.panelBg,
              color: t.text,
              border: `1px solid ${t.border}`,
              borderTop: `1px solid ${t.borderTop}`,
              borderRadius: 14,
              backdropFilter: 'blur(24px) saturate(190%)',
              WebkitBackdropFilter: 'blur(24px) saturate(190%)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
              cursor: 'pointer',
              pointerEvents: 'auto',
            }}
          >
            <IconEye />
            <span>Show UI</span>
            <kbd className="apple-kbd">H</kbd>
          </button>
        )}
      </div>
    </div>
  )
}
