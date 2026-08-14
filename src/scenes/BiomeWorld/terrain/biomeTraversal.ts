import type { Collider } from '@/render/controllers/CharacterController'
import { BIOME_DRESSING } from '@/render/assets/biomeLibrary'
import { scatterLayer } from '../dressing/biomeScatter'
import { biomeHeightAt } from './biomeHeight'
import { GROVE_COLLIDERS } from '../dressing/GroveLandmark'
import {
  filterScatterNearLandmarks,
  getRegionLandmarkProps,
} from '../discovery/landmarkProps'

/** Solid prop collision half-widths / radii in metres. */
export const SOLID_PROP_RADII: Record<string, number> = {
  'prop.biome.tree.hero': 1.2,
  'prop.biome.tree.canopy': 0.9,
  'prop.biome.tree.broadleaf': 0.7,
  'prop.biome.tree.crown': 0.7,
  'prop.biome.tree.apple': 0.6,
  'prop.biome.tree.conifer': 0.6,
  'prop.biome.tree.gnarlA': 0.8,
  'prop.biome.tree.gnarlB': 0.8,
  'prop.biome.cave.pillar': 1.4,
  'prop.biome.cave.stump': 0.9,
  'prop.biome.rock.cliff': 3.0,
  'prop.biome.rock.cluster': 1.6,
  'prop.biome.rock.smallA': 0.7,
  'prop.biome.rock.smallB': 0.7,
  'prop.biome.landmark.obelisk': 1.2,
  'prop.biome.landmark.shrine': 2.0,
  'prop.biome.landmark.well': 1.4,
  'prop.biome.landmark.hut': 2.2,
  'prop.biome.crystal.cluster': 1.1,
}

export type TraversalZoneKind =
  | 'arrival'
  | 'central'
  | 'groundLoop'
  | 'landingClearing'
  | 'hazardous'
  | 'approach'

export interface TraversalZone {
  id: string
  kind: TraversalZoneKind
  center: [number, number]
  radius: number
  description: string
}

export interface LandingEvaluation {
  safe: boolean
  slope: number
  minDistanceToObstacle: number
  reason?: 'steep_slope' | 'obstructed' | 'out_of_bounds'
}

/** Standard spawn anchor for biome arrival. */
export const BIOME_SPAWN_ANCHOR: [number, number] = [0, -18]

/** Maximum slope angle in radians (~20 degrees) considered safe for landing. */
export const MAX_LANDING_SLOPE = 0.35

/** Safe inner and outer radius bounds for exploration. */
export const MIN_EXPLORATION_RADIUS = 2
export const MAX_EXPLORATION_RADIUS = 95

/**
 * Returns authored and derived traversal zones for a given biome and region.
 */
export function getRegionTraversalZones(
  biome: string,
  regionId: string,
  _seed = 42,
): TraversalZone[] {
  const isGrove = biome === 'grove'
  const centralRadius = isGrove ? 16 : 8

  const zones: TraversalZone[] = [
    {
      id: `${regionId}-arrival`,
      kind: 'arrival',
      center: BIOME_SPAWN_ANCHOR,
      radius: 6.0,
      description: 'Expedition arrival clearing',
    },
    {
      id: `${regionId}-central`,
      kind: 'central',
      center: [0, 0],
      radius: centralRadius,
      description: isGrove ? 'Elderroot Grove Mound Sanctuary' : 'Central Landmark Focal Clearing',
    },
    {
      id: `${regionId}-ground-loop`,
      kind: 'groundLoop',
      center: [0, 0],
      radius: 35.0,
      description: 'Primary navigable ground loop',
    },
    {
      id: `${regionId}-landing-north`,
      kind: 'landingClearing',
      center: [0, 28],
      radius: 6.0,
      description: 'Northern Aerial Touchdown Zone',
    },
    {
      id: `${regionId}-landing-east`,
      kind: 'landingClearing',
      center: [28, 0],
      radius: 6.0,
      description: 'Eastern Aerial Touchdown Zone',
    },
    {
      id: `${regionId}-landing-west`,
      kind: 'landingClearing',
      center: [-28, 0],
      radius: 6.0,
      description: 'Western Aerial Touchdown Zone',
    },
    {
      id: `${regionId}-boundary-peril`,
      kind: 'hazardous',
      center: [0, 0],
      radius: MAX_EXPLORATION_RADIUS,
      description: 'Hazardous perimeter slope and deep boundary water',
    },
  ]

  return zones
}

/**
 * Returns lightweight authored colliders for solid scenery across any biome.
 */
export function getRegionColliders(
  biome: string,
  regionId: string,
  seed = 42,
): Collider[] {
  const colliders: Collider[] = []

  // 1. Grove central landmark colliders
  if (biome === 'grove') {
    colliders.push(...GROVE_COLLIDERS)
  }

  // 1b. Authored landmark props (Biome Stage 1): solid at their anchors,
  // using the authored radius data rather than loaded model bounds.
  const landmarkPlan = getRegionLandmarkProps(regionId, seed)
  for (const landmark of landmarkPlan) {
    if (landmark.colliderRadius <= 0) continue
    colliders.push({
      x: landmark.anchor.x,
      z: landmark.anchor.z,
      halfW: landmark.colliderRadius * landmark.scale,
      halfD: landmark.colliderRadius * landmark.scale,
    })
  }

  // 2. Derive solid colliders from dressing layers
  const layers = BIOME_DRESSING[biome] ?? []
  const heightAt = (x: number, z: number) => biomeHeightAt(biome, x, z, regionId, seed)

  for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
    const layer = layers[layerIdx]!
    const baseRadius = SOLID_PROP_RADII[layer.prop]
    if (!baseRadius) continue // Low vegetation/pebbles are not blocking

    const placements = filterScatterNearLandmarks(
      scatterLayer(layer, {
        heightAt,
        regionId,
        seed,
        offset: layerIdx * 0.7,
        clearing: biome === 'grove' ? 14 : 4,
      }),
      landmarkPlan,
    )

    for (const p of placements) {
      const [x, , z] = p.position
      // Never block the arrival spawn clearing
      if (Math.hypot(x - BIOME_SPAWN_ANCHOR[0], z - BIOME_SPAWN_ANCHOR[1]) < 4.5) continue

      const effectiveScale = p.scale ?? 1.0
      const effectiveRadius = baseRadius * effectiveScale
      colliders.push({
        x,
        z,
        halfW: effectiveRadius,
        halfD: effectiveRadius,
      })
    }
  }

  return colliders
}

/**
 * Evaluates whether a point is safely traversable and free of blocking colliders.
 */
export function isPositionTraversable(
  x: number,
  z: number,
  colliders: Collider[],
  clearance = 0.4,
): boolean {
  for (const c of colliders) {
    const minX = c.x - c.halfW - clearance
    const maxX = c.x + c.halfW + clearance
    const minZ = c.z - c.halfD - clearance
    const maxZ = c.z + c.halfD + clearance

    if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) {
      return false
    }
  }
  return true
}

/**
 * Evaluates the suitability of a location for wyvern landing or touch-down.
 */
export function evaluateLandingSafety(
  x: number,
  z: number,
  heightFn: (x: number, z: number) => number,
  colliders: Collider[],
  maxSlope = MAX_LANDING_SLOPE,
): LandingEvaluation {
  const distFromCenter = Math.hypot(x, z)
  if (distFromCenter > MAX_EXPLORATION_RADIUS) {
    return {
      safe: false,
      slope: 1.0,
      minDistanceToObstacle: 0,
      reason: 'out_of_bounds',
    }
  }

  // Sample local slope gradient
  const delta = 1.0
  const yE = heightFn(x + delta, z)
  const yW = heightFn(x - delta, z)
  const yN = heightFn(x, z + delta)
  const yS = heightFn(x, z - delta)

  const dx = (yE - yW) / (2 * delta)
  const dz = (yN - yS) / (2 * delta)
  const slope = Math.atan(Math.hypot(dx, dz))

  // Find distance to closest collider
  let minObstacleDist = Infinity
  for (const c of colliders) {
    const dxObs = Math.max(0, Math.abs(x - c.x) - c.halfW)
    const dzObs = Math.max(0, Math.abs(z - c.z) - c.halfD)
    const dist = Math.hypot(dxObs, dzObs)
    if (dist < minObstacleDist) {
      minObstacleDist = dist
    }
  }

  if (slope > maxSlope) {
    return {
      safe: false,
      slope,
      minDistanceToObstacle: minObstacleDist,
      reason: 'steep_slope',
    }
  }

  if (minObstacleDist < 2.0) {
    return {
      safe: false,
      slope,
      minDistanceToObstacle: minObstacleDist,
      reason: 'obstructed',
    }
  }

  return {
    safe: true,
    slope,
    minDistanceToObstacle: minObstacleDist,
  }
}

/**
 * Returns safe recovery coordinates for a player or wyvern that fell or went out-of-bounds.
 */
export function getSafeRecoveryAnchor(
  biome: string,
  regionId: string,
  seed = 42,
): [number, number, number] {
  const [spawnX, spawnZ] = BIOME_SPAWN_ANCHOR
  const y = biomeHeightAt(biome, spawnX, spawnZ, regionId, seed) + 0.1
  return [spawnX, y, spawnZ]
}
