import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Vector3 } from 'three'
import { getAsset, type AssetId, type ModelState } from '@/render/assets/manifest'
import type { FlightLoopState } from '@/render/flightPose'
import type { FlightLabPoseEdits, LabCamera, LabTheme } from '../FlightLab'
import { GROUPS, NEUTRAL_POSE_EDITS, SPECIES } from '../constants'
import type { SpeedDynamicsState, ControllerIsolationState } from '../components/AnimationControls'
import type { LogEntry } from '../components/ReadoutLogPanel'
import { PropManager } from '../systems/PropManager'
import type { PropBase } from '../props/PropBase'
import {
  DEFAULT_CONTROLLER_ISOLATION,
  DEFAULT_SPEED_DYNAMICS,
  applySpeedPreset,
  type SpeedPresetName,
} from '../labDynamics'
import { annotatePresets, flightLabAltitude, parseLabSearch, resolveRequestedState, serializeLabSearch } from '../labPresets'
import { EMPTY_TELEMETRY, type LabTelemetry } from '../labTelemetry'

function nextLogId(serial: number): string {
  return `log-${serial}`
}

import type { LabSearch } from '../labPresets'

export function useFlightLabState(initialOverride?: Partial<LabSearch>) {
  const initial = useMemo(() => {
    if (initialOverride && Object.keys(initialOverride).length > 0) {
      return initialOverride
    }
    if (typeof window === 'undefined') return {}
    return parseLabSearch(new URLSearchParams(window.location.search))
  }, [initialOverride])

  const [speciesIndex, setSpeciesIndex] = useState(initial.speciesIndex ?? 0)
  // The asset shown beside the rig for A/B, or null for a single model. Not in
  // the shareable lab search params: it is a review aid, not part of the pose a
  // link is meant to reproduce.
  const [compareId, setCompareId] = useState<AssetId | null>(null)
  const [extraScale, setExtraScale] = useState(1)
  const [state, setState] = useState<ModelState>(initial.state ?? 'idle')
  const [auto, setAuto] = useState(initial.auto ?? false)
  const [horizontalSpeed, setHorizontalSpeed] = useState(initial.speed ?? 0)
  const [verticalSpeed, setVerticalSpeed] = useState(0)
  const [yawRate, setYawRate] = useState(0)
  const [referenceSpeed, setReferenceSpeed] = useState(18)
  const [powered, setPowered] = useState(true)
  const [boosting, setBoosting] = useState(false)
  const [searching, setSearching] = useState(false)
  const [procedural, setProcedural] = useState(initial.procedural ?? false)
  const [frozen, setFrozen] = useState(false)
  const [scrub, setScrub] = useState(0)
  const [camera, setCamera] = useState<LabCamera>(initial.camera ?? 'side')
  const [theme, setTheme] = useState<LabTheme>(initial.theme ?? 'dark')
  const [overlays, setOverlays] = useState(true)
  const [fireBreath, setFireBreath] = useState(false)
  const [poseComposer, setPoseComposer] = useState(false)
  const [poseEdits, setPoseEdits] = useState<FlightLabPoseEdits>(NEUTRAL_POSE_EDITS)
  const [activeLoop, setActiveLoop] = useState<FlightLoopState>('cruise')
  const [panelOpen, setPanelOpen] = useState(true)
  const [hideUI, setHideUI] = useState(false)
  const [copied, setCopied] = useState(false)
  const [centerTrigger, setCenterTrigger] = useState(0)
  const [zoomFitTrigger, setZoomFitTrigger] = useState(0)
  const [zoomInTrigger, setZoomInTrigger] = useState(0)
  const [zoomOutTrigger, setZoomOutTrigger] = useState(0)
  const [resetCamTrigger, setResetCamTrigger] = useState(0)
  const [transitionDuration, setTransitionDuration] = useState(0.4)
  const [telemetry, setTelemetry] = useState<LabTelemetry>(EMPTY_TELEMETRY)
  const logSerial = useRef(2)

  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'init-1',
      timestamp: '00:00:00',
      category: 'SYSTEM',
      level: 'info',
      message: 'Flight Lab ready. Isolation, speed sliders, and telemetry now read the live rig.',
    },
    {
      id: 'init-2',
      timestamp: '00:00:00',
      category: 'SYSTEM',
      level: 'info',
      message: 'Share a view with ?species=&state=&procedural=&auto=&speed=&camera=&theme=',
    },
  ])

  const addLogEntry = useCallback((category: LogEntry['category'], level: LogEntry['level'], message: string, details?: Record<string, unknown>) => {
    logSerial.current += 1
    const entry: LogEntry = {
      id: nextLogId(logSerial.current),
      timestamp: `${logSerial.current}`,
      category,
      level,
      message,
      details,
    }
    setLogs((prev) => [entry, ...prev.slice(0, 99)])
  }, [])

  const handleChangePoseEdit = useCallback((key: keyof FlightLabPoseEdits, val: number) => {
    setPoseEdits((prev) => ({ ...prev, [key]: val }))
  }, [])

  const handleResetPoseEdits = useCallback(() => {
    setPoseEdits(NEUTRAL_POSE_EDITS)
  }, [])

  const handleSelectPreset = useCallback((presetName: string) => {
    const resolved = resolveRequestedState(presetName)
    if (!resolved) {
      addLogEntry('POSE', 'warn', `Ignored unknown preset [${presetName}]`)
      return
    }
    setAuto(false)
    setState(resolved)
    addLogEntry('POSE', 'info', `Requested pose [${resolved}]`, { duration: transitionDuration })
  }, [addLogEntry, transitionDuration])

  const propManager = useMemo(() => new PropManager(), [])
  const [propsList, setPropsList] = useState<PropBase[]>([])
  const [speedDynamics, setSpeedDynamics] = useState<SpeedDynamicsState>({
    ...DEFAULT_SPEED_DYNAMICS,
    airspeed: initial.speed ?? DEFAULT_SPEED_DYNAMICS.airspeed,
  })
  const [controllerIsolation, setControllerIsolation] = useState<ControllerIsolationState>(DEFAULT_CONTROLLER_ISOLATION)

  const handleLiveTelemetry = useCallback((sample: LabTelemetry) => {
    setTelemetry(sample)
    if (sample.contractStatus === 'fail') {
      addLogEntry('CONTRACT', 'error', sample.contractNotes[0] ?? 'Contract failed')
    }
  }, [addLogEntry])

  const handleChangeSpeedDynamics = useCallback((updates: Partial<SpeedDynamicsState>) => {
    setSpeedDynamics((prev) => {
      const next = { ...prev, ...updates }
      if (updates.airspeed !== undefined) setHorizontalSpeed(updates.airspeed)
      return next
    })
  }, [])

  const handleToggleController = useCallback((key: keyof ControllerIsolationState) => {
    setControllerIsolation((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      addLogEntry('SYSTEM', 'info', `Toggled controller [${key}]: ${next[key] ? 'ENABLED' : 'DISABLED'}`)
      return next
    })
  }, [addLogEntry])

  const handleApplySpeedPreset = useCallback((presetName: SpeedPresetName) => {
    setSpeedDynamics((prev) => {
      const next = applySpeedPreset(prev, presetName)
      setHorizontalSpeed(next.airspeed)
      return next
    })
    addLogEntry('SPEED', 'info', `Applied speed preset [${presetName}]`)
  }, [addLogEntry])

  const handleSpawnDoe = useCallback(() => {
    propManager.spawnDoe()
    setPropsList(propManager.getAllProps())
    addLogEntry('PREY', 'info', 'Spawned doe (visible ground prey)')
  }, [propManager, addLogEntry])

  const handleSpawnBird = useCallback(() => {
    propManager.spawnBird()
    setPropsList(propManager.getAllProps())
    addLogEntry('PREY', 'info', 'Spawned bird (visible aerial prey)')
  }, [propManager, addLogEntry])

  const handleClearProps = useCallback(() => {
    propManager.clearAllProps()
    setPropsList([])
    addLogEntry('PREY', 'info', 'Cleared prey.')
  }, [propManager, addLogEntry])

  const handleTriggerFireAttack = useCallback(() => {
    const origin = new Vector3(0, flightLabAltitude(state), 0)
    const hitProps = propManager.applyFireDamage(origin, 30, 40, 0.4)
    setPropsList(propManager.getAllProps())
    addLogEntry('ATTACK', 'warn', `Fire breath from live wyvern hit ${hitProps.length} prey.`, {
      hitCount: hitProps.length,
      affectedProps: hitProps.map((prop) => prop.id),
    })
  }, [propManager, addLogEntry, state])

  const handleTriggerScoutMode = useCallback(() => {
    setState('scout')
    setHorizontalSpeed(12)
    setSpeedDynamics((prev) => ({ ...prev, airspeed: 12, pitchAngle: 2 }))
    setReferenceSpeed(18)
    setSearching(true)
    setBoosting(false)
    setAuto(false)
    addLogEntry('POSE', 'info', 'Scout: searching gaze + 12 u/s loiter')
  }, [addLogEntry])

  const handleTriggerSpeedSprint = useCallback(() => {
    setState('speed')
    setHorizontalSpeed(42)
    setSpeedDynamics((prev) => ({ ...prev, airspeed: 42, pitchAngle: -8, neckStreamFactor: 1, tailStiffness: 1.6 }))
    setBoosting(true)
    setSearching(false)
    setAuto(false)
    setPoseEdits((prev) => ({ ...prev, legTuck: 0.8, footTuck: 0.9, neckPitch: 0, neckYaw: 0, neckAlignment: 1 }))
    addLogEntry('SPEED', 'warn', 'Sprint: 42 u/s, legs tucked, neck streamlined')
  }, [addLogEntry])

  const readout = useRef<HTMLPreElement>(null)

  const handleCopyReadout = useCallback(() => {
    if (!readout.current) return
    const text = readout.current.innerText || readout.current.textContent || ''
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      setCopied(false)
    })
  }, [])

  const species = SPECIES[speciesIndex] ?? SPECIES[0]!
  const annotatedPresets = useMemo(() => annotatePresets(species.id), [species.id])

  const groups = useMemo(() => {
    const mapped = getAsset(species.id)?.animations ?? {}
    const listed = new Set(GROUPS.flatMap((group) => group.states))
    const missing = (Object.keys(mapped) as ModelState[]).filter((key) => !listed.has(key))
    return missing.length ? [...GROUPS, { label: 'Unlisted', states: missing }] : GROUPS
  }, [species.id])

  const order = useMemo(() => groups.flatMap((group) => group.states), [groups])

  const step = useCallback((delta: number) => {
    setState((current) => {
      const index = order.indexOf(current)
      const next = (index + delta + order.length) % order.length
      return order[next] ?? current
    })
  }, [order])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const query = serializeLabSearch({
      speciesIndex,
      state,
      procedural,
      auto,
      speed: horizontalSpeed,
      camera,
      theme,
    })
    const next = `${window.location.pathname}${query}`
    if (`${window.location.pathname}${window.location.search}` !== next) {
      window.history.replaceState(null, '', next)
    }
  }, [speciesIndex, state, procedural, auto, horizontalSpeed, camera, theme])

  return {
    speciesIndex,
    setSpeciesIndex,
    compareId,
    setCompareId,
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
    hideUI,
    setHideUI,
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
    handleLiveTelemetry,
    telemetry,
    readout,
    handleCopyReadout,
    groups,
    order,
    step,
    annotatedPresets,
    propManager,
  }
}
