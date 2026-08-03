import type { PropPlacement } from '@/render/assets/props'
import { SANCTUARY_STATIONS } from '@/core/data/sanctuaryStations'
import {
  BREEDING_POSTS,
  GROUND_RADIUS,
  INFIRMARY_POST,
  KEEP,
  PERCHES,
  ROOSTS,
  TRAINING_POSTS,
} from './layout'

/**
 * Where every piece of sanctuary scenery stands.
 *
 * Separated from the scene component because it is arithmetic, not rendering:
 * it can be reasoned about and tested without a WebGL context, and the scene
 * stays a description of what is drawn rather than a pile of loops.
 *
 * Placement is seeded rather than random. A sanctuary that rearranged itself on
 * every remount would be disorienting to play and impossible to screenshot-
 * compare, so the scatter is generated once from a fixed seed.
 *
 * Nothing here is gameplay. Colliders and station radii come from layout.ts and
 * are only *read* by this module, so scenery can never change where the player
 * can walk or what they can interact with.
 */

/** Deterministic PRNG. Not from core/rng: this is cosmetic and never replayed. */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const TAU = Math.PI * 2

// ---------------------------------------------------------------------------
// The keep
// ---------------------------------------------------------------------------

/** Wall segments, alternating between the two wall props for variety. */
function wallRun(
  from: [number, number],
  to: [number, number],
  segments: PropPlacement[][],
): void {
  const [x0, z0] = from
  const [x1, z1] = to
  const length = Math.hypot(x1 - x0, z1 - z0)
  // The wall prop is 4.42 m wide; stepping slightly under that overlaps the
  // joins so the run reads as continuous stonework rather than a picket fence.
  const count = Math.max(1, Math.round(length / 4.0))
  const rotationY = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2

  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count
    segments[i % segments.length]!.push({
      position: [x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t],
      rotationY,
    })
  }
}

const { centerX, centerZ, halfW, halfD, doorWidth } = KEEP
const north = centerZ - halfD
const south = centerZ + halfD
const west = centerX - halfW
const east = centerX + halfW

const wallA: PropPlacement[] = []
const wallB: PropPlacement[] = []

wallRun([west, north], [east, north], [wallA, wallB])
wallRun([west, north], [west, south], [wallA, wallB])
wallRun([east, north], [east, south], [wallA, wallB])
// South face, split around the doorway the player walks through.
wallRun([west, south], [centerX - doorWidth / 2, south], [wallA, wallB])
wallRun([centerX + doorWidth / 2, south], [east, south], [wallA, wallB])

export const KEEP_WALLS = { wallA, wallB }

export const KEEP_GATE: PropPlacement = { position: [centerX, 0, south], rotationY: 0 }

export const KEEP_PILLARS: PropPlacement[] = [
  { position: [west, 0, north] },
  { position: [east, 0, north] },
  { position: [west, 0, south] },
  { position: [east, 0, south] },
]

/**
 * Flagstones over the keep interior.
 *
 * Spacing is wider than the tiles in z so the darker floor beneath shows
 * through as grout, and yaw is restricted to 0/180° so a rotated tile keeps its
 * footprint and cannot overlap its neighbour into z-fighting.
 */
function keepFloor(): Record<'floorA' | 'floorB' | 'floorC', PropPlacement[]> {
  const rng = mulberry32(0x5ea1)
  const tiles = { floorA: [] as PropPlacement[], floorB: [] as PropPlacement[], floorC: [] as PropPlacement[] }
  const keys = ['floorA', 'floorB', 'floorC'] as const

  const stepX = 1.6
  const stepZ = 2.1
  const countX = Math.floor((halfW * 2) / stepX)
  const countZ = Math.floor((halfD * 2) / stepZ)

  for (let i = 0; i < countX; i++) {
    for (let j = 0; j < countZ; j++) {
      tiles[keys[(i + j * 2) % 3]!].push({
        position: [
          west + (i + 0.5) * stepX + (rng() - 0.5) * 0.12,
          0,
          north + (j + 0.5) * stepZ + (rng() - 0.5) * 0.12,
        ],
        rotationY: rng() < 0.5 ? 0 : Math.PI,
      })
    }
  }

  return tiles
}

export const KEEP_FLOOR = keepFloor()

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const pathA: PropPlacement[] = []
const pathB: PropPlacement[] = []

/**
 * A small number of instanced flagstones turns the expanded grounds into a
 * legible campus. Runs stop outside each station's visual footprint, leaving
 * the activity areas open for wyverns and interaction markers.
 */
function pathRun(from: [number, number], to: [number, number]): void {
  const [x0, z0] = from
  const [x1, z1] = to
  const length = Math.hypot(x1 - x0, z1 - z0)
  const count = Math.max(1, Math.round(length / 3.2))
  const rotationY = Math.atan2(x1 - x0, z1 - z0)

  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count
    const target = i % 2 === 0 ? pathA : pathB
    target.push({
      position: [x0 + (x1 - x0) * t, 0.025, z0 + (z1 - z0) * t],
      rotationY: rotationY + (i % 3 === 0 ? 0.08 : -0.04),
      scale: i % 4 === 0 ? 1.06 : 1,
    })
  }
}

// Central processional path, then shorter branches to each functional wing.
pathRun([0, -11], [0, 24])
pathRun([-3, 2], [-24, 2])
pathRun([3, -1], [28, 7])
pathRun([10, -7], [26, -11])
pathRun([6, 24], [27.5, 30])
pathRun([-6, 24], [-31.5, 25])

export const PATHS: Record<'prop.pathA' | 'prop.pathB', PropPlacement[]> = {
  'prop.pathA': pathA,
  'prop.pathB': pathB,
}

// ---------------------------------------------------------------------------
// Scatter
// ---------------------------------------------------------------------------

/** Circles the scatter must not intrude on: the keep, every station, every perch. */
function exclusions(): { x: number; z: number; r: number }[] {
  const zones = [
    // The keep, as a circle around its diagonal — deliberately generous, so no
    // tree ends up pressed against the wall the player walks along.
    { x: centerX, z: centerZ, r: Math.hypot(halfW, halfD) + 4 },
    ...Object.values(SANCTUARY_STATIONS).map((station) => ({
      x: station.position[0],
      z: station.position[1],
      r: station.clearance,
    })),
    // Wide, because a full-grown wyvern stands ~44 units nose-to-tail: any
    // tree closer than this ends up growing through it.
    ...PERCHES.map(([x, z]) => ({ x, z, r: 22 })),
    ...Object.values(TRAINING_POSTS).map(([x, z]) => ({ x, z, r: 18 })),
    ...BREEDING_POSTS.map(([x, z]) => ({ x, z, r: 18 })),
    { x: INFIRMARY_POST[0], z: INFIRMARY_POST[1], r: 18 },
    ...ROOSTS.map(([x, z]) => ({ x, z, r: 3 })),
  ]
  return zones
}

function scatter(
  seed: number,
  count: number,
  options: { minRadius: number; maxRadius: number; minScale: number; maxScale: number; spacing: number },
): PropPlacement[] {
  const rng = mulberry32(seed)
  const zones = exclusions()
  const placed: PropPlacement[] = []

  // Rejection sampling. The sanctuary has plenty of free ground, so a bounded
  // number of tries per prop is enough; falling short just means slightly
  // sparser dressing, never a hang.
  for (let attempt = 0; attempt < count * 40 && placed.length < count; attempt++) {
    const angle = rng() * TAU
    const radius = options.minRadius + rng() * (options.maxRadius - options.minRadius)
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius

    if (zones.some((zone) => Math.hypot(x - zone.x, z - zone.z) < zone.r)) continue
    if (placed.some((p) => Math.hypot(x - p.position[0], z - p.position[2]) < options.spacing)) continue

    placed.push({
      position: [x, 0, z],
      rotationY: rng() * TAU,
      scale: options.minScale + rng() * (options.maxScale - options.minScale),
    })
  }

  return placed
}

/**
 * Woodland, thickening toward the rim so the grounds stay open to fly and fight
 * in while the horizon still reads as enclosed rather than as a cut-off disc.
 */
export const SCATTER: Record<string, PropPlacement[]> = {
  'prop.scatter.firA': scatter(0xf1a, 34, {
    minRadius: 26,
    maxRadius: GROUND_RADIUS - 3,
    minScale: 0.8,
    maxScale: 1.3,
    spacing: 4,
  }),
  'prop.scatter.firB': scatter(0xf1b, 30, {
    minRadius: 24,
    maxRadius: GROUND_RADIUS - 3,
    minScale: 0.9,
    maxScale: 1.4,
    spacing: 4,
  }),
  'prop.scatter.firC': scatter(0xf1c, 18, {
    minRadius: 34,
    maxRadius: GROUND_RADIUS - 2,
    minScale: 0.7,
    maxScale: 1.1,
    spacing: 6,
  }),
  'prop.scatter.deadTree': scatter(0xdea, 10, {
    minRadius: 30,
    maxRadius: GROUND_RADIUS - 5,
    minScale: 0.7,
    maxScale: 1.0,
    spacing: 8,
  }),
  'prop.scatter.mysticStone': scatter(0x57e, 16, {
    minRadius: 14,
    maxRadius: GROUND_RADIUS - 8,
    minScale: 0.7,
    maxScale: 1.2,
    spacing: 7,
  }),
  'prop.perch.trunk': scatter(0x709, 12, {
    minRadius: 16,
    maxRadius: GROUND_RADIUS - 8,
    minScale: 0.8,
    maxScale: 1.2,
    spacing: 9,
  }),
  'prop.scatter.grassA': scatter(0x67a, 130, {
    minRadius: 8,
    maxRadius: GROUND_RADIUS - 4,
    minScale: 0.8,
    maxScale: 1.6,
    spacing: 2.5,
  }),
  'prop.scatter.grassB': scatter(0x67b, 110, {
    minRadius: 8,
    maxRadius: GROUND_RADIUS - 4,
    minScale: 0.8,
    maxScale: 1.5,
    spacing: 2.5,
  }),
}

/** Hills ringing the horizon, sat outside the walkable bounds. */
export const HILLS: PropPlacement[] = Array.from({ length: 7 }, (_, i) => {
  const angle = (i / 7) * TAU + 0.4
  const radius = GROUND_RADIUS + 14
  return {
    position: [Math.cos(angle) * radius, -2, Math.sin(angle) * radius],
    rotationY: angle,
    scale: 0.9 + (i % 3) * 0.25,
  }
})
