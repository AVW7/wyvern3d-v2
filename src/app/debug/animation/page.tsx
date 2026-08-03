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

const FlightLab = dynamic(() => import('./FlightLab').then((m) => m.FlightLab), { ssr: false })

/** Grounded animation presets for testing */
const GROUNDED_PRESETS = [
  { id: 'idle', label: 'Idle' },
  { id: 'rest', label: 'Rest' },
  { id: 'sleep', label: 'Sleep' },
  { id: 'sit', label: 'Sit' },
  { id: 'eat', label: 'Eat' },
  { id: 'drink', label: 'Drink' },
  { id: 'groom', label: 'Groom' },
  { id: 'attack', label: 'Attack' },
  { id: 'nuzzle', label: 'Nuzzle' },
  { id: 'calm', label: 'Calm' },
  { id: 'perch', label: 'Perch' },
  { id: 'hop', label: 'Hop' },
  { id: 'walk', label: 'Walk' },
  { id: 'breathe', label: 'Breathe' },
  { id: 'death', label: 'Death' },
  { id: 'rise', label: 'Rise' },
  { id: 'seated', label: 'Seated' },
  { id: 'pickUp', label: 'PickUp' },
  { id: 'huntGrip', label: 'HuntGrip' },
  { id: 'huntCarry', label: 'HuntCarry' },
  { id: 'drop', label: 'Drop' },
  { id: 'huntFinish', label: 'HuntFinish' },
  { id: 'fly', label: 'Fly' },
  { id: 'airborne', label: 'Airborne' },
  { id: 'cruise', label: 'Cruise' },
  { id: 'scout', label: 'Scout' },
  { id: 'speed', label: 'Speed' },
  { id: 'glide', label: 'Glide' },
  { id: 'dive', label: 'Dive' },
  { id: 'bankLeft', label: 'BankL' },
  { id: 'bankRight', label: 'BankR' },
  { id: 'hover', label: 'Hover' },
  { id: 'land', label: 'Land' },
  { id: 'breatheAir', label: 'BreatheAir' },
  { id: 'attackAir', label: 'AttackAir' },
]

export default function FlightLabPage() {
  const state = useFlightLabState()

  useFlightLabShortcuts({
    step: state.step,
    setAuto: state.setAuto,
    setFrozen: state.setFrozen,
    setCenterTrigger: state.setCenterTrigger,
    setZoomFitTrigger: state.setZoomFitTrigger,
    setZoomInTrigger: state.setZoomInTrigger,
    setZoomOutTrigger: state.setZoomOutTrigger,
    setPanelOpen: state.setPanelOpen,
  })

  if (process.env.NODE_ENV === 'production') {
    return (
      <div id="game-root">
        <div className="overlay">
          <div className="panel">
            <h2>Flight Animation Lab</h2>
            <p className="subtitle">Development tool. Not available in production builds.</p>
          </div>
        </div>
      </div>
    )
  }

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
        .flight-lab-topbar {
          position: absolute !important;
          top: 12px !important;
          left: 12px !important;
          right: 12px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 10px !important;
          padding: 8px 14px !important;
          background: ${t.bg} !important;
          backdrop-filter: blur(24px) saturate(190%) !important;
          -webkit-backdrop-filter: blur(24px) saturate(190%) !important;
          border: 1px solid ${t.border} !important;
          border-top: 1px solid ${t.borderTop} !important;
          border-radius: 14px !important;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15) !important;
          z-index: 20 !important;
          pointer-events: auto !important;
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
        .flight-lab-panel {
          position: absolute !important;
          top: 78px !important;
          right: 16px !important;
          left: auto !important;
          bottom: 16px !important;
          transform: none !important;
          width: 330px !important;
          max-width: calc(100vw - 32px) !important;
          max-height: calc(100vh - 94px) !important;
          overflow-y: auto !important;
          pointer-events: auto !important;
          background: ${t.panelBg} !important;
          backdrop-filter: blur(24px) saturate(190%) !important;
          -webkit-backdrop-filter: blur(24px) saturate(190%) !important;
          border: 1px solid ${t.border} !important;
          border-top: 1px solid ${t.borderTop} !important;
          border-radius: 14px !important;
          box-shadow: 0 20px 48px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15) !important;
          padding: 14px !important;
          color: ${t.text} !important;
          z-index: 10 !important;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .flight-lab-panel::-webkit-scrollbar {
          width: 6px;
        }
        .flight-lab-panel::-webkit-scrollbar-track {
          background: transparent;
        }
        .flight-lab-panel::-webkit-scrollbar-thumb {
          background: ${t.border};
          border-radius: 3px;
        }
        .flight-lab-panel::before {
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
        @media (max-width: 900px) {
          .flight-lab-topbar {
            flex-wrap: wrap !important;
            gap: 8px !important;
          }
          .flight-lab-panel {
            top: 116px !important;
            bottom: 16px !important;
            left: 16px !important;
            right: 16px !important;
            width: auto !important;
            max-height: calc(100vh - 132px) !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .apple-button, .flight-lab-panel, .flight-lab-topbar {
            transition: none !important;
            transform: none !important;
          }
        }
        @media (prefers-reduced-transparency: reduce) {
          .flight-lab-topbar, .flight-lab-panel {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: ${t.panelBgSolid} !important;
          }
        }
      `}</style>
      <Suspense fallback={null}>
        <FlightLab
          speciesId={species.id}
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
          centerTrigger={state.centerTrigger}
          zoomFitTrigger={state.zoomFitTrigger}
          zoomInTrigger={state.zoomInTrigger}
          zoomOutTrigger={state.zoomOutTrigger}
          resetCamTrigger={state.resetCamTrigger}
        />
      </Suspense>

      <div className="overlay">
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
        <FlightLabTopbar
          t={t}
          camera={state.camera}
          setCamera={state.setCamera}
          theme={state.theme}
          setTheme={state.setTheme}
          frozen={state.frozen}
          setFrozen={state.setFrozen}
          panelOpen={state.panelOpen}
          setPanelOpen={state.setPanelOpen}
          setCenterTrigger={state.setCenterTrigger}
          setZoomFitTrigger={state.setZoomFitTrigger}
          setZoomInTrigger={state.setZoomInTrigger}
          setZoomOutTrigger={state.setZoomOutTrigger}
          setResetCamTrigger={state.setResetCamTrigger}
        />

        {state.panelOpen && (
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
            species={species}
            extraScale={state.extraScale}
            setExtraScale={state.setExtraScale}
            groundedPresets={GROUNDED_PRESETS}
            activePreset={GROUNDED_PRESETS.find(p => p.id === state.state)?.id}
            onSelectPreset={state.handleSelectPreset}
          />
        )}
      </div>
    </div>
  )
}
