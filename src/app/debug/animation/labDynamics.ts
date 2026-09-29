import type { ControllerIsolationState, SpeedDynamicsState } from './components/AnimationControls'

export const DEFAULT_SPEED_DYNAMICS: SpeedDynamicsState = {
  airspeed: 18,
  pitchAngle: 0,
  headGazeWeight: 0.8,
  neckStreamFactor: 0.5,
  tailStiffness: 1,
  tailWaveAmp: 0.15,
  legTuckWeight: 1,
  wingFlutterFreq: 3,
}

export const DEFAULT_CONTROLLER_ISOLATION: ControllerIsolationState = {
  spineWave: true,
  dynamicTail: true,
  gazeController: true,
  dynamicLegs: true,
  wingRefinement: true,
  jawSeal: true,
}

export const SPEED_PRESETS = {
  hover: {
    airspeed: 0,
    pitchAngle: 6,
    headGazeWeight: 0.9,
    neckStreamFactor: 0.1,
    tailStiffness: 0.5,
    tailWaveAmp: 0.25,
    legTuckWeight: 0.4,
    wingFlutterFreq: 2.2,
  },
  glide: {
    airspeed: 12,
    pitchAngle: 2,
    headGazeWeight: 0.8,
    neckStreamFactor: 0.4,
    tailStiffness: 0.8,
    tailWaveAmp: 0.15,
    legTuckWeight: 0.7,
    wingFlutterFreq: 2.6,
  },
  cruise: {
    airspeed: 22,
    pitchAngle: 0,
    headGazeWeight: 0.7,
    neckStreamFactor: 0.6,
    tailStiffness: 1.1,
    tailWaveAmp: 0.12,
    legTuckWeight: 1,
    wingFlutterFreq: 3,
  },
  speed: {
    airspeed: 42,
    pitchAngle: -4,
    headGazeWeight: 0.9,
    neckStreamFactor: 0.9,
    tailStiffness: 1.6,
    tailWaveAmp: 0.07,
    legTuckWeight: 1.25,
    wingFlutterFreq: 3.8,
  },
  dive: {
    airspeed: 50,
    pitchAngle: -25,
    headGazeWeight: 0.95,
    neckStreamFactor: 0.95,
    tailStiffness: 1.8,
    tailWaveAmp: 0.05,
    legTuckWeight: 1.2,
    wingFlutterFreq: 1.4,
  },
} as const

export type SpeedPresetName = keyof typeof SPEED_PRESETS

/** Convert the pitch slider into a climb/sink rate the auto director can read. */
export function verticalSpeedFromPitch(airspeed: number, pitchDeg: number): number {
  const pitchRad = (pitchDeg * Math.PI) / 180
  return Math.tan(pitchRad) * Math.max(airspeed, 1)
}

/** Extra body pitch (radians) layered on top of `flightPoseTargets`. */
export function extraPitchFromSlider(pitchDeg: number): number {
  return (pitchDeg * Math.PI) / 180
}

/** Gaze blend 0–0.4. The slider is the user's share of the intelligent look layer. */
export function gazeBlendFromWeight(headGazeWeight: number, trackingVelocity: number): number {
  const raw = Math.min(trackingVelocity * 0.1, 0.4)
  return raw * Math.min(1, Math.max(0, headGazeWeight))
}

/** Scale authored neck pitch toward the streamlined spearhead as the stream slider rises. */
export function scaleNeckStream(neckPitch: number, neckStreamFactor: number): number {
  const factor = Math.min(1, Math.max(0, neckStreamFactor))
  return neckPitch * (0.35 + factor * 0.65)
}

/** Speed fed to the tail stiffness curve. Higher slider = stiffer / less fluid. */
export function tailSpeedForStiffness(airspeed: number, tailStiffness: number): number {
  return airspeed * Math.min(2, Math.max(0.1, tailStiffness))
}

/** Aggression argument for the tail controller, derived from the wave-amp slider. */
export function tailAggressionFromWave(tailWaveAmp: number): number {
  return Math.min(2, Math.max(0, tailWaveAmp / 0.15))
}

export function scaleLegTuck(tuck: number, weight: number): number {
  return tuck * Math.min(1.5, Math.max(0, weight))
}

/** Turbulence fed to the wing controller. Frequency slider scales the authored 3 Hz default. */
export function wingTurbulenceFromSlider(
  baseTurbulence: number,
  wingFlutterFreq: number,
): number {
  const freqScale = Math.min(2, Math.max(0, wingFlutterFreq / 3))
  return baseTurbulence * freqScale
}

export function activeControllerNames(isolation: ControllerIsolationState): string[] {
  return (Object.entries(isolation) as [keyof ControllerIsolationState, boolean][])
    .filter(([, enabled]) => enabled)
    .map(([key]) => key)
}

export function applySpeedPreset(
  current: SpeedDynamicsState,
  name: SpeedPresetName,
): SpeedDynamicsState {
  return { ...current, ...SPEED_PRESETS[name] }
}
