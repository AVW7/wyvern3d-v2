import { REGIONS } from '@/core/data/regions'
import { deriveSeed } from '@/core/math/rng'

/**
 * Deterministic landmark anchors for a biome region (Atlas Stage 2).
 *
 * Biome Enhancement Stage 1 will place authored landmark meshes; until then
 * these anchors are the discoverable positions — a marker label seated on the
 * terrain at a stable spot derived from region id + world seed. The atlas is
 * the single persistent record of finding one; the anchor itself has no
 * authority.
 */

export interface LandmarkAnchor {
  landmarkId: string
  name: string
  category: string
  /** World XZ position inside the explorable radius. */
  x: number
  z: number
  /** How close the surveyor must get, in metres. */
  approachRadius: number
}

/** Exploration bound mirrored from biomeTraversal (kept in sync by test). */
const MAX_ANCHOR_RADIUS = 72
/** Arrival spawn is [0, -18]; keep anchors out of its clearing. */
const SPAWN: [number, number] = [0, -18]
const SPAWN_CLEARANCE = 14
/** Golden angle keeps successive anchors apart without stripes. */
const GOLDEN_ANGLE = 2.399963229728653

const BASE_RADIUS = 34
const RADIUS_STEP = 13
const APPROACH_RADIUS = 9

/** Bounded deterministic offset in [0, 1) from region id, salt and index. */
function hashUnit(seed: number, regionId: string, salt: string, index: number): number {
  return (deriveSeed(seed, `${regionId}:${salt}:${index}`) >>> 0) / 4294967296
}

/**
 * The Elderroot Grove already has a hero landmark composition — the world tree
 * on the central mound ringed by standing stones — so its anchors sit on the
 * real scenery rather than on derived points.
 */
const GROVE_ANCHOR_OVERRIDES: Record<string, [number, number]> = {
  elderrootgrove_world_tree: [0, 0],
  // On the stone ring (radius 26) — exact coordinates in landmarkAnchors.test.
  elderrootgrove_druid_circle: [26 * Math.SQRT1_2, -26 * Math.SQRT1_2],
}

/**
 * Stable anchors for every authored landmark of a region. Same region id +
 * seed always produce the same positions; two regions never share a layout
 * because the hash is salted with the region id.
 */
export function getRegionLandmarkAnchors(regionId: string, seed: number): LandmarkAnchor[] {
  const def = REGIONS[regionId]
  const landmarks = def?.atlas?.landmarks ?? []
  if (landmarks.length === 0) return []

  return landmarks.map((landmark, index) => {
    const override = GROVE_ANCHOR_OVERRIDES[landmark.id]
    let x: number
    let z: number

    if (override) {
      ;[x, z] = override
    } else {
      const angle =
        index * GOLDEN_ANGLE + hashUnit(seed, regionId, 'angle', index) * Math.PI * 2
      const radius = Math.min(
        MAX_ANCHOR_RADIUS,
        BASE_RADIUS + index * RADIUS_STEP + hashUnit(seed, regionId, 'radius', index) * 6,
      )
      x = Math.cos(angle) * radius
      z = Math.sin(angle) * radius

      // Never inside the arrival clearing: push it outward along its bearing.
      const spawnDist = Math.hypot(x - SPAWN[0], z - SPAWN[1])
      if (spawnDist < SPAWN_CLEARANCE) {
        const len = Math.max(1e-6, Math.hypot(x, z))
        x = (x / len) * (SPAWN_CLEARANCE + Math.hypot(SPAWN[0], SPAWN[1]))
        z = (z / len) * (SPAWN_CLEARANCE + Math.hypot(SPAWN[0], SPAWN[1]))
      }
    }

    return {
      landmarkId: landmark.id,
      name: landmark.name,
      category: landmark.category,
      x,
      z,
      approachRadius: APPROACH_RADIUS,
    }
  })
}

/**
 * The nearest not-yet-discovered anchor whose approach ring contains the
 * surveyor. Pure proximity adapter between the explorer position and the
 * discovery intent — the UI/scene never re-derives these rules.
 */
export function nearestSurveyableLandmark(
  anchors: LandmarkAnchor[],
  discoveredIds: readonly string[],
  position: [number, number],
): LandmarkAnchor | null {
  const discovered = new Set(discoveredIds)
  let best: LandmarkAnchor | null = null
  let bestDist = Infinity

  for (const anchor of anchors) {
    if (discovered.has(anchor.landmarkId)) continue
    const dist = Math.hypot(position[0] - anchor.x, position[1] - anchor.z)
    if (dist <= anchor.approachRadius && dist < bestDist) {
      bestDist = dist
      best = anchor
    }
  }
  return best
}
