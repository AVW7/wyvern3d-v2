/**
 * The sanctuary's time-of-day palette.
 *
 * Pure arithmetic, deliberately free of `three` and of React, so it is unit
 * testable under the repo's node-environment vitest config and so the scene
 * component stays a description of what is lit rather than a pile of colour
 * maths.
 *
 * Phase is driven from `GameState.tick`, which already exists, is save-backed,
 * survives offline catch-up and is replay-stable. Nothing here writes to core;
 * time of day is presentation and needs no new state and no save migration.
 */

export type Rgb = readonly [number, number, number]

/**
 * Ticks per full day. `CONFIG.secondsPerTick` is 1, so this is a twelve-minute
 * cycle — long enough that the light is stable while the player works at a
 * station, short enough that they see more than one mood in a session.
 */
export const SANCTUARY_DAY_TICKS = 720

export type DayBucket = 'night' | 'dawn' | 'day' | 'dusk'

/**
 * Phase the world starts at on tick 0.
 *
 * Without this a new game opens at midnight, because tick 0 would map to phase
 * 0. Mid-morning instead: the sun is already up and still climbing, which is
 * the sanctuary at its most readable and the right first impression.
 */
export const DAY_START_PHASE = 0.34

/** Phase 0 is midnight, 0.25 sunrise, 0.5 noon, 0.75 sunset. */
export function dayPhase(tick: number): number {
  const phase = (tick / SANCTUARY_DAY_TICKS + DAY_START_PHASE) % 1
  return phase < 0 ? phase + 1 : phase
}

export function dayBucket(phase: number): DayBucket {
  if (phase < 0.2 || phase >= 0.85) return 'night'
  if (phase < 0.32) return 'dawn'
  if (phase < 0.72) return 'day'
  return 'dusk'
}

/**
 * Sun height, -1 at midnight through +1 at noon. The key light follows this;
 * below the horizon it is clamped off so the scene does not get lit from under
 * the ground.
 */
export function sunElevation(phase: number): number {
  return -Math.cos(phase * Math.PI * 2)
}

/**
 * Key-light direction. The sun tracks an arc rather than sitting still, which
 * is what makes shadows sweep across the flagstones over a cycle.
 */
export function sunDirection(phase: number): Rgb {
  const angle = phase * Math.PI * 2
  const elevation = sunElevation(phase)
  // A tilted arc, so the sun is never exactly overhead — overhead light flattens
  // every silhouette in the scene at noon.
  return [Math.sin(angle) * 0.75, Math.max(elevation, -0.2), Math.cos(angle) * 0.35 - 0.25]
}

interface Stop {
  phase: number
  sun: Rgb
  /** Hemisphere sky colour. */
  skyFill: Rgb
  /** Hemisphere ground bounce. */
  groundFill: Rgb
  fog: Rgb
  /** Sky dome, horizon then zenith. */
  horizon: Rgb
  zenith: Rgb
  sunIntensity: number
  fillIntensity: number
  exposure: number
}

const rgb = (r: number, g: number, b: number): Rgb => [r / 255, g / 255, b / 255]

/**
 * Keyframes around the cycle. Values are art direction, not physics — the goal
 * is the warm/cool separation that makes a scene read as lit rather than
 * shaded, so the sun stays warm at every hour and the fill stays cool.
 */
const STOPS: Stop[] = [
  {
    phase: 0.0, // midnight
    sun: rgb(120, 150, 205),
    skyFill: rgb(52, 68, 104),
    groundFill: rgb(18, 20, 26),
    fog: rgb(26, 33, 52),
    horizon: rgb(38, 48, 74),
    zenith: rgb(10, 14, 28),
    sunIntensity: 0.16,
    fillIntensity: 0.34,
    exposure: 1.06,
  },
  {
    phase: 0.25, // sunrise
    sun: rgb(255, 176, 116),
    skyFill: rgb(150, 172, 205),
    groundFill: rgb(74, 60, 46),
    fog: rgb(206, 178, 168),
    horizon: rgb(244, 180, 140),
    zenith: rgb(78, 116, 178),
    sunIntensity: 1.25,
    fillIntensity: 0.5,
    exposure: 1.0,
  },
  {
    phase: 0.5, // noon
    sun: rgb(255, 240, 214),
    skyFill: rgb(188, 212, 230),
    groundFill: rgb(74, 64, 52),
    fog: rgb(188, 205, 214),
    horizon: rgb(176, 208, 232),
    zenith: rgb(62, 122, 196),
    sunIntensity: 1.85,
    fillIntensity: 0.42,
    exposure: 0.95,
  },
  {
    phase: 0.75, // sunset
    sun: rgb(255, 150, 92),
    skyFill: rgb(158, 158, 190),
    groundFill: rgb(78, 58, 44),
    fog: rgb(212, 162, 140),
    horizon: rgb(246, 158, 110),
    zenith: rgb(72, 96, 152),
    sunIntensity: 1.15,
    fillIntensity: 0.48,
    exposure: 1.02,
  },
]

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
}

export interface SkyState {
  sun: Rgb
  skyFill: Rgb
  groundFill: Rgb
  fog: Rgb
  horizon: Rgb
  zenith: Rgb
  sunIntensity: number
  fillIntensity: number
  exposure: number
  direction: Rgb
  bucket: DayBucket
  fogNear: number
  fogFar: number
}

/**
 * Fog distances.
 *
 * The shipped values were 140-350 against a 60-unit ground radius, which put
 * the near plane of the fog beyond the far rim — nothing in the sanctuary was
 * ever fogged, which is a large part of why it read as a diorama on a flat
 * card. These distances actually reach the treeline, and tighten at night.
 */
function fogRange(phase: number): [number, number] {
  const night = 1 - Math.max(0, sunElevation(phase))
  // Far distance reaches past the outer landform (which runs to r=132) in
  // daylight, so the horizon hills keep their colour and read as terrain rather
  // than dissolving into a flat band. At night it closes right in.
  return [lerp(58, 30, night), lerp(300, 120, night)]
}

/** Full lighting state for a tick. Called once per frame; allocates one object. */
export function skyStateFor(tick: number): SkyState {
  const phase = dayPhase(tick)

  let from = STOPS[STOPS.length - 1]!
  let to = STOPS[0]!
  let span = STOPS[0]!.phase + 1 - from.phase
  let local = (phase - from.phase + 1) % 1

  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i]!
    const b = STOPS[i + 1]!
    if (phase >= a.phase && phase < b.phase) {
      from = a
      to = b
      span = b.phase - a.phase
      local = phase - a.phase
      break
    }
  }

  const t = span === 0 ? 0 : local / span
  // Smoothstep, so the light eases through sunrise and sunset rather than
  // sliding at a constant rate through the most visible part of the cycle.
  const e = t * t * (3 - 2 * t)
  const [fogNear, fogFar] = fogRange(phase)

  return {
    sun: lerpRgb(from.sun, to.sun, e),
    skyFill: lerpRgb(from.skyFill, to.skyFill, e),
    groundFill: lerpRgb(from.groundFill, to.groundFill, e),
    fog: lerpRgb(from.fog, to.fog, e),
    horizon: lerpRgb(from.horizon, to.horizon, e),
    zenith: lerpRgb(from.zenith, to.zenith, e),
    sunIntensity: lerp(from.sunIntensity, to.sunIntensity, e),
    fillIntensity: lerp(from.fillIntensity, to.fillIntensity, e),
    exposure: lerp(from.exposure, to.exposure, e),
    direction: sunDirection(phase),
    bucket: dayBucket(phase),
    fogNear,
    fogFar,
  }
}
