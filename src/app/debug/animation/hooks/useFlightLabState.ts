import { useCallback, useMemo, useRef, useState } from 'react'
import { Vector3 } from 'three'
import { getAsset, type ModelState } from '@/render/assets/manifest'
import type { FlightLoopState } from '@/render/flightPose'
import type { FlightLabPoseEdits, LabCamera, LabTheme } from '../FlightLab'
import { GROUPS, NEUTRAL_POSE_EDITS } from '../constants'
import type { SpeedDynamicsState, ControllerIsolationState } from '../components/AnimationControls'
import type { TelemetrySnapshot, LogEntry } from '../components/ReadoutLogPanel'
import { PropManager } from '../systems/PropManager'
import type { PropBase } from '../props/PropBase'

export function useFlightLabState() {
  const [speciesIndex, setSpeciesIndex] = useState(4)
  const [extraScale, setExtraScale] = useState(1.6)
  const [state, setState] = useState<ModelState>('cruise')
  const [auto, setAuto] = useState(false)
  const [horizontalSpeed, setHorizontalSpeed] = useState(18)
  const [verticalSpeed, setVerticalSpeed] = useState(0)
  const [yawRate, setYawRate] = useState(0)
  const [referenceSpeed, setReferenceSpeed] = useState(18)
  const [powered, setPowered] = useState(true)
  const [boosting, setBoosting] = useState(false)
  const [searching, setSearching] = useState(false)
  const [procedural, setProcedural] = useState(false)
  const [frozen, setFrozen] = useState(false)
  const [scrub, setScrub] = useState(0)
  const [camera, setCamera] = useState<LabCamera>('side')
  const [theme, setTheme] = useState<LabTheme>('dark')
  const [overlays, setOverlays] = useState(true)
  const [fireBreath, setFireBreath] = useState(false)
  const [poseComposer, setPoseComposer] = useState(false)
  const [poseEdits, setPoseEdits] = useState<FlightLabPoseEdits>(NEUTRAL_POSE_EDITS)
  const [activeLoop, setActiveLoop] = useState<FlightLoopState>('cruise')
  const [panelOpen, setPanelOpen] = useState(true)
  const [copied, setCopied] = useState(false)

  const [centerTrigger, setCenterTrigger] = useState(0)
  const [zoomFitTrigger, setZoomFitTrigger] = useState(0)
  const [zoomInTrigger, setZoomInTrigger] = useState(0)
  const [zoomOutTrigger, setZoomOutTrigger] = useState(0)
  const [resetCamTrigger, setResetCamTrigger] = useState(0)
  const [transitionDuration, setTransitionDuration] = useState(0.4)

  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'init-1',
      timestamp: new Date().toLocaleTimeString(),
      category: 'SYSTEM',
      level: 'info',
      message: 'Flight Lab modular architecture initialized.',
    },
    {
      id: 'init-2',
      timestamp: new Date().toLocaleTimeString(),
      category: 'SPEED',
      level: 'info',
      message: 'Speed-dependent Head, Neck & Tail dynamics active at 18.0 u/s.',
    },
  ])

  const addLogEntry = useCallback((category: LogEntry['category'], level: LogEntry['level'], message: string, details?: Record<string, unknown>) => {
    const entry: LogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleTimeString(),
      category,
      level,
      message,
      details,
    }
    setLogs(prev => [entry, ...prev.slice(0, 99)])
  }, [])

  const handleChangePoseEdit = useCallback((key: keyof FlightLabPoseEdits, val: number) => {
    setPoseEdits(prev => ({ ...prev, [key]: val }))
  }, [])

  const handleResetPoseEdits = useCallback(() => {
    setPoseEdits(NEUTRAL_POSE_EDITS)
  }, [])

  const handleSelectPreset = useCallback((presetName: string) => {
    setState(presetName as ModelState)
    addLogEntry('POSE', 'info', `Transitioned to pose preset [${presetName}]`, { duration: transitionDuration })
  }, [addLogEntry, transitionDuration])

  const propManager = useMemo(() => new PropManager(), [])
  const [propsList, setPropsList] = useState<PropBase[]>([])
  const [speedDynamics, setSpeedDynamics] = useState<SpeedDynamicsState>({
    airspeed: 18,
    pitchAngle: 0,
    headGazeWeight: 0.8,
    neckStreamFactor: 0.5,
    tailStiffness: 1.0,
    tailWaveAmp: 0.15,
    legTuckWeight: 1.0,
    wingFlutterFreq: 3.0,
  })

  const [controllerIsolation, setControllerIsolation] = useState<ControllerIsolationState>({
    spineWave: true,
    dynamicTail: true,
    gazeController: true,
    dynamicLegs: true,
    wingRefinement: true,
    jawSeal: true,
  })

  const handleChangeSpeedDynamics = useCallback((updates: Partial<SpeedDynamicsState>) => {
    setSpeedDynamics(prev => {
      const next = { ...prev, ...updates }
      if (updates.airspeed !== undefined) {
        setHorizontalSpeed(updates.airspeed)
      }
      return next
    })
    addLogEntry('SPEED', 'info', `Updated speed dynamics parameters`, updates as Record<string, unknown>)
  }, [addLogEntry])

  const handleToggleController = useCallback((key: keyof ControllerIsolationState) => {
    setControllerIsolation(prev => {
      const next = { ...prev, [key]: !prev[key] }
      addLogEntry('SYSTEM', 'info', `Toggled controller [${key}]: ${next[key] ? 'ENABLED' : 'DISABLED'}`)
      return next
    })
  }, [addLogEntry])

  const handleApplySpeedPreset = useCallback((presetName: 'hover' | 'glide' | 'cruise' | 'dive') => {
    const presets = {
      hover: { airspeed: 0, pitchAngle: 0, headGazeWeight: 0.9, neckStreamFactor: 0.1, tailStiffness: 0.5, tailWaveAmp: 0.25 },
      glide: { airspeed: 12, pitchAngle: 2, headGazeWeight: 0.8, neckStreamFactor: 0.4, tailStiffness: 0.8, tailWaveAmp: 0.15 },
      cruise: { airspeed: 22, pitchAngle: 5, headGazeWeight: 0.7, neckStreamFactor: 0.6, tailStiffness: 1.1, tailWaveAmp: 0.12 },
      dive: { airspeed: 50, pitchAngle: -25, headGazeWeight: 0.95, neckStreamFactor: 0.95, tailStiffness: 1.8, tailWaveAmp: 0.05 },
    }
    const update = presets[presetName]
    setSpeedDynamics(prev => ({ ...prev, ...update }))
    setHorizontalSpeed(update.airspeed)
    addLogEntry('SPEED', 'info', `Applied speed preset [${presetName.toUpperCase()}] at ${update.airspeed} u/s`, update)
  }, [addLogEntry])

  const handleSpawnDoe = useCallback(() => {
    propManager.spawnDoe()
    setPropsList(propManager.getAllProps())
    addLogEntry('PREY', 'info', 'Spawned Big-Doe (Large Ground Prey, +50 Food value)')
  }, [propManager, addLogEntry])

  const handleSpawnBird = useCallback(() => {
    propManager.spawnBird()
    setPropsList(propManager.getAllProps())
    addLogEntry('PREY', 'info', 'Spawned Small-Bird (Flying Prey, +15 Food value)')
  }, [propManager, addLogEntry])

  const handleClearProps = useCallback(() => {
    propManager.clearAllProps()
    setPropsList([])
    addLogEntry('PREY', 'info', 'Cleared all active prey props.')
  }, [propManager, addLogEntry])

  const handleTriggerFireAttack = useCallback(() => {
    const wyvernPos = new Vector3(0, 15, 0)
    const hitProps = propManager.applyFireDamage(wyvernPos, 30.0, 40.0, 0.4)
    setPropsList(propManager.getAllProps())
    addLogEntry('ATTACK', 'warn', `Ignited Fire Breath Stream! Hit ${hitProps.length} prey props.`, {
      hitCount: hitProps.length,
      affectedProps: hitProps.map(p => p.id),
    })
  }, [propManager, addLogEntry])

  const handleTriggerScoutMode = useCallback(() => {
    setState('scout')
    setHorizontalSpeed(12)
    setReferenceSpeed(18)
    setSearching(true)
    setBoosting(false)
    addLogEntry('POSE', 'info', 'Triggered Scout Flight Mode: Takeoff & Aerial Search Loiter (searching for food/enemies/resources)')
  }, [addLogEntry])

  const handleTriggerSpeedSprint = useCallback(() => {
    setState('speed')
    setHorizontalSpeed(42)
    setBoosting(true)
    setSearching(false)
    setPoseEdits(prev => ({ ...prev, legTuck: 0.8, footTuck: 0.9, neckPitch: 0, neckYaw: 0, neckAlignment: 1 }))
    addLogEntry('SPEED', 'warn', 'Triggered High-Speed Sprint: Hind legs & feet tucked, neck streamlined with torso at 42.0 u/s')
  }, [addLogEntry])

  const telemetry: TelemetrySnapshot = useMemo(() => ({
    timestamp: Date.now(),
    airspeed: speedDynamics.airspeed,
    pitchAngle: speedDynamics.pitchAngle,
    headOrientation: {
      pitch: (speedDynamics.pitchAngle * Math.PI) / 180,
      yaw: 0,
      roll: 0,
    },
    neckCurve: 1.0 - speedDynamics.neckStreamFactor * 0.5,
    tailExtent: 8.5 * (1.0 + (speedDynamics.airspeed / 60) * 0.4),
    tailFlexAngles: [0.1, 0.15, 0.2, 0.18, 0.12, 0.08].map(a => a * speedDynamics.tailStiffness),
    activeControllers: Object.entries(controllerIsolation)
      .filter(([, enabled]) => enabled)
      .map(([key]) => key),
    contractStatus: 'pass',
    loopState: state,
  }), [speedDynamics, controllerIsolation, state])

  const readout = useRef<HTMLPreElement>(null)

  const handleCopyReadout = useCallback(() => {
    if (readout.current) {
      const text = readout.current.innerText || readout.current.textContent || ''
      if (text) {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          })
          .catch(() => {
            const textarea = document.createElement('textarea')
            textarea.value = text
            document.body.appendChild(textarea)
            textarea.select()
            document.execCommand('copy')
            document.body.removeChild(textarea)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          })
      }
    }
  }, [])

  const groups = useMemo(() => {
    const mapped = getAsset('wyvern.emberback')?.animations ?? {}
    const listed = new Set(GROUPS.flatMap((group) => group.states))
    const missing = (Object.keys(mapped) as ModelState[]).filter((key) => !listed.has(key))
    return missing.length ? [...GROUPS, { label: 'Unlisted', states: missing }] : GROUPS
  }, [])

  const order = useMemo(() => groups.flatMap((group) => group.states), [groups])

  const step = useCallback(
    (delta: number) => {
      setState((current) => {
        const index = order.indexOf(current)
        const next = (index + delta + order.length) % order.length
        return order[next] ?? current
      })
    },
    [order],
  )

  return {
    speciesIndex,
    setSpeciesIndex,
    extraScale,
    setExtraScale,
    state,
    setState,
    auto,
    setAuto,
    horizontalSpeed,
    setHorizontalSpeed,
    verticalSpeed,
    setVerticalSpeed,
    yawRate,
    setYawRate,
    referenceSpeed,
    setReferenceSpeed,
    powered,
    setPowered,
    boosting,
    setBoosting,
    searching,
    setSearching,
    procedural,
    setProcedural,
    frozen,
    setFrozen,
    scrub,
    setScrub,
    camera,
    setCamera,
    theme,
    setTheme,
    overlays,
    setOverlays,
    fireBreath,
    setFireBreath,
    poseComposer,
    setPoseComposer,
    poseEdits,
    setPoseEdits,
    activeLoop,
    setActiveLoop,
    panelOpen,
    setPanelOpen,
    copied,
    centerTrigger,
    setCenterTrigger,
    zoomFitTrigger,
    setZoomFitTrigger,
    zoomInTrigger,
    setZoomInTrigger,
    zoomOutTrigger,
    setZoomOutTrigger,
    resetCamTrigger,
    setResetCamTrigger,
    transitionDuration,
    setTransitionDuration,
    logs,
    setLogs,
    addLogEntry,
    handleChangePoseEdit,
    handleResetPoseEdits,
    handleSelectPreset,
    propsList,
    speedDynamics,
    controllerIsolation,
    handleChangeSpeedDynamics,
    handleToggleController,
    handleApplySpeedPreset,
    handleSpawnDoe,
    handleSpawnBird,
    handleClearProps,
    handleTriggerFireAttack,
    handleTriggerScoutMode,
    handleTriggerSpeedSprint,
    telemetry,
    readout,
    handleCopyReadout,
    groups,
    order,
    step,
  }
}
