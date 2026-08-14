import { REGIONS } from '@/core/data/regions'
import { deriveSeed } from '@/core/math/rng'
import { SOLID_PROP_RADII } from '../terrain/biomeTraversal'
import type { PropPlacement } from '@/render/assets/props'
import { getRegionLandmarkAnchors, type LandmarkAnchor } from './landmarkAnchors'

/**
 * Landmark prop assignment (Biome Enhancement Stage 1).
 *
 * Every authored landmark gets an approved atlas prop at its anchor — the
 * same anchors the atlas discovery system uses, so the thing you survey is
 * the thing you see. Assignments are authored data (category → prop, with
 * biome-flavoured naturals); transforms are derived deterministically from
 * region id + seed. The mesh stays cosmetic: collision and approach rules
 * come from the authored radius data here, never from model bounds.
 */

/** Approved atlas prop for each landmark category. */
const CATEGORY_PROPS: Record<string, string> = {
  monolith: 'prop.biome.landmark.obelisk',
  shrine: 'prop.biome.landmark.shrine',
  settlement: 'prop.biome.landmark.hut',
  ruin: 'prop.biome.landmark.well',
}

/**
 * `natural` landmarks read as the biome's own hero scenery, so they borrow the
 * tallest approved silhouette of that biome family.
 */
const NATURAL_PROPS_BY_BIOME: Record<string, string> = {
  forest: 'prop.biome.tree.hero',
  jungle: 'prop.biome.tree.hero',
  valley: 'prop.biome.tree.hero',
  grove: 'prop.biome.tree.hero',
  marsh: 'prop.biome.tree.gnarlB',
  swamp: 'prop.biome.tree.gnarlB',
  moor: 'prop.biome.rock.cliff',
  mountain: 'prop.biome.rock.cliff',
  highland: 'prop.biome.rock.cliff',
  spire: 'prop.biome.rock.cliff',
  coast: 'prop.biome.rock.cliff',
  tundra: 'prop.biome.rock.cliff',
  barrens: 'prop.biome.rock.cluster',
  ashland: 'prop.biome.rock.cliff',
  cavern: 'prop.biome.cave.pillar',
}

const DEFAULT_NATURAL_PROP = 'prop.biome.rock.cluster'

/** Authored world-space scale per category — landmarks read larger than scatter. */
const CATEGORY_SCALE: Record<string, number> = {
  monolith: 1.6,
  shrine: 1.4,
  settlement: 1.3,
  ruin: 1.5,
  natural: 1.75,
}

/**
 * Landmarks already embodied by the region's authored composition — the grove
 * world tree and its stone ring — so no extra prop is placed.
 */
const EXISTING_COMPOSITION = new Set([
  'elderrootgrove_world_tree',
  'elderrootgrove_druid_circle',
])

export interface LandmarkPropPlacement {
  anchor: LandmarkAnchor
  /** Approved atlas prop id, or null when the composition already renders it. */
  propId: string | null
  /** Authored scale multiplier (>= 1: heroes, not scatter). */
  scale: number
  /** Deterministic facing, radians. */
  rotationY: number
  /** Authored collision radius before scale. */
  colliderRadius: number
  /** True when the region's existing composition already provides the mesh. */
  existingComposition: boolean
}

function propForCategory(category: string, biome: string): string {
  if (category === 'natural') {
    return NATURAL_PROPS_BY_BIOME[biome] ?? DEFAULT_NATURAL_PROP
  }
  return CATEGORY_PROPS[category] ?? DEFAULT_NATURAL_PROP
}

/**
 * Full landmark prop plan for a region: one placement per authored landmark,
 * seated on the shared discovery anchors. Same region + seed always produces
 * the identical plan.
 */
export function getRegionLandmarkProps(regionId: string, seed: number): LandmarkPropPlacement[] {
  const def = REGIONS[regionId]
  if (!def) return []

  return getRegionLandmarkAnchors(regionId, seed).map((anchor) => {
    const existing = EXISTING_COMPOSITION.has(anchor.landmarkId)
    const propId = existing ? null : propForCategory(anchor.category, def.biome)
    const scale = CATEGORY_SCALE[anchor.category] ?? 1.4
    const rotationY =
      ((deriveSeed(seed, `${regionId}:face:${anchor.landmarkId}`) >>> 0) % 6283) / 1000

    return {
      anchor,
      propId,
      scale,
      rotationY,
      colliderRadius: propId ? (SOLID_PROP_RADII[propId] ?? 1.2) : 0,
      existingComposition: existing,
    }
  })
}

/** Placements that need a drawn prop (existing compositions excluded). */
export function landmarkDrawPlacements(
  placements: LandmarkPropPlacement[],
  heightAt: (x: number, z: number) => number,
): { propId: string; items: PropPlacement[] }[] {
  const byProp = new Map<string, PropPlacement[]>()
  for (const placement of placements) {
    if (!placement.propId) continue
    const items = byProp.get(placement.propId) ?? []
    items.push({
      position: [placement.anchor.x, heightAt(placement.anchor.x, placement.anchor.z), placement.anchor.z],
      rotationY: placement.rotationY,
      scale: placement.scale,
    })
    byProp.set(placement.propId, items)
  }
  return [...byProp.entries()].map(([propId, items]) => ({ propId, items }))
}

/**
 * Removes scatter placements that would sit inside a landmark's approach
 * ring, so every landmark has a readable arrival composition. Pure filter:
 * everything outside the rings passes through untouched.
 */
export function filterScatterNearLandmarks<P extends PropPlacement>(
  placements: P[],
  landmarks: LandmarkPropPlacement[],
  clearance = 7,
): P[] {
  if (landmarks.length === 0) return placements
  return placements.filter((p) => {
    const [x, , z] = p.position
    return !landmarks.some((lm) =>
      Math.hypot(x - lm.anchor.x, z - lm.anchor.z) < clearance + lm.colliderRadius * lm.scale,
    )
  })
}
