import { SANCTUARY_STATIONS } from '@/core/data/sanctuaryStations'
import { PATHS } from '../dressing'
import { GROUND_RADIUS, KEEP } from '../layout'

/**
 * Ground colour and outer relief for the sanctuary.
 *
 * Pure arithmetic so it can be unit tested without a WebGL context, and so the
 * ground mesh stays a description of geometry rather than a pile of noise
 * functions.
 *
 * The walkable disc stays perfectly flat. Three separate ground-plane raycasts
 * assume y=0 — `CharacterController` (click-to-move), `SanctuaryWyverns`
 * (attack targeting) and `SanctuaryEditorControls` (placement) — and so do the
 * player's height, wyvern landing and every prop placement. All relief
 * therefore lives outside `GROUND_RADIUS`, where nothing gameplay-facing reads.
 */

export type Rgb = [number, number, number]

/** Every path flagstone, flattened once — the ground samples against these. */
const PATH_POINTS: [number, number][] = Object.values(PATHS)
  .flat()
  .map((placement) => [placement.position[0], placement.position[2]])

const STATION_CIRCLES = Object.values(SANCTUARY_STATIONS).map((station) => ({
  x: station.position[0],
  z: station.position[1],
  r: station.radius,
}))

import { smoothNoise } from '@/render/math/valueNoise'

function nearestPathDistance(x: number, z: number): number {
  let best = Infinity
  for (const [px, pz] of PATH_POINTS) {
    const d = Math.hypot(x - px, z - pz)
    if (d < best) best = d
  }
  return best
}

/** How worn the ground is here, 0 untouched grass to 1 bare earth. */
export function wearAt(x: number, z: number): number {
  let wear = 0

  // Foot traffic beside the flagstone runs.
  const pathDistance = nearestPathDistance(x, z)
  if (pathDistance < 4) wear = Math.max(wear, 1 - pathDistance / 4)

  // Ground trampled bare where the player actually stands to use a station.
  for (const circle of STATION_CIRCLES) {
    const d = Math.hypot(x - circle.x, z - circle.z)
    const reach = circle.r + 2
    if (d < reach) wear = Math.max(wear, (1 - d / reach) * 0.85)
  }

  // The keep courtyard is walked flat.
  const insideKeep =
    Math.abs(x - KEEP.centerX) < KEEP.halfW + 2 && Math.abs(z - KEEP.centerZ) < KEEP.halfD + 2
  if (insideKeep) wear = Math.max(wear, 0.5)

  return Math.min(1, wear)
}

const DIRT: Rgb = [0.36, 0.29, 0.21]
const MOSS: Rgb = [0.19, 0.26, 0.15]

function hexToRgb(hex: string): Rgb {
  const value = hex.replace('#', '')
  return [
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255,
  ]
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

/**
 * The grass-independent part of a vertex's colour.
 *
 * Split out because `wearAt` walks every path stone and station for each
 * vertex, and the ground has thousands — while the editor's colour picker fires
 * continuously as it is dragged. These factors never change, so they are
 * computed once and only the cheap mix below re-runs on a recolour.
 */
export interface GroundFactors {
  shade: number
  rim: number
  wear: number
}

export function groundFactorsAt(x: number, z: number): GroundFactors {
  // Broad patchiness, then a finer break-up so it does not read as one blur.
  const broad = smoothNoise(x * 0.045, z * 0.045)
  const fine = smoothNoise(x * 0.21, z * 0.21)
  const radius = Math.hypot(x, z)
  return {
    shade: 0.86 + broad * 0.22 + fine * 0.08,
    // Mossier and darker toward the treeline, where the canopy closes in.
    rim: Math.max(0, (radius - GROUND_RADIUS * 0.65) / (GROUND_RADIUS * 0.35)),
    wear: wearAt(x, z),
  }
}

/** Cheap: everything expensive already happened in `groundFactorsAt`. */
export function groundColorFrom(factors: GroundFactors, base: Rgb): Rgb {
  let color: Rgb = [base[0] * factors.shade, base[1] * factors.shade, base[2] * factors.shade]
  color = mix(color, MOSS, Math.min(0.45, factors.rim * 0.45))
  // Wear goes on last, so a path through the treeline still reads as a path.
  return mix(color, DIRT, factors.wear * 0.8)
}

/**
 * Vertex colour for a point on the walkable ground.
 *
 * `grass` is the player's own colour from the editor, so recolouring the
 * sanctuary still works — the variation is layered on top of their choice
 * rather than replacing it.
 */
export function groundColorAt(x: number, z: number, grass: string): Rgb {
  return groundColorFrom(groundFactorsAt(x, z), hexToRgb(grass))
}

export { hexToRgb }

/**
 * Height of the outer landform, as a function of distance from the centre.
 *
 * Pinned to exactly 0 at the inner rim so there is no seam against the flat
 * disc, then rising toward the horizon so the grounds stop looking like a
 * coloured plate floating in fog.
 */
/**
 * Where the outer mesh's *geometry* begins. It deliberately overlaps the
 * walkable disc by a metre so the two never show a gap at the join.
 */
export const OUTER_INNER_RADIUS = GROUND_RADIUS - 1
export const OUTER_OUTER_RADIUS = 132

/**
 * Where the outer mesh's *height* begins — strictly at the walkable edge, not
 * at the geometry edge. Keeping these two separate is what lets the annulus
 * overlap to hide the seam while every point the player can reach stays exactly
 * flat. Collapsing them lifts the disc rim by a few millimetres, which is
 * invisible but quietly falsifies the invariant everything else depends on.
 */
const RELIEF_START = GROUND_RADIUS

export function outerHeightAt(x: number, z: number): number {
  const radius = Math.hypot(x, z)
  // Epsilon, not a bare `<=`: a point built as (cos(a)*r, sin(a)*r) can land a
  // few ulps outside r, and the walkable disc being *exactly* flat is the
  // invariant the whole stage rests on. Better to guarantee it here than to
  // loosen the test that checks it.
  if (radius <= RELIEF_START + 1e-9) return 0
  const t = Math.min(1, (radius - RELIEF_START) / (OUTER_OUTER_RADIUS - RELIEF_START))
  // Eased so the ground leaves the flat disc tangentially rather than kinking.
  const ramp = t * t * (3 - 2 * t)
  const ridges =
    Math.sin(Math.atan2(z, x) * 3.1) * 2.4 + Math.sin(Math.atan2(z, x) * 7.3 + 1.2) * 1.1
  return ramp * (7 + ridges * ramp)
}
