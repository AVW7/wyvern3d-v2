import { unitFromSeed } from '@/core/math/rng'
import { getRegionExpeditionActivity, type ExpeditionActivityDef } from '@/core/data/expeditionActivities'

/**
 * Expedition Puzzles & Hazard Positioning.
 *
 * Deterministically places 1–3 interactive activity nodes (runic stones,
 * harmonic resonators, or thermal vent valves) inside the wild biome
 * based on region ID and world seed.
 */

export interface ExpeditionNodeAnchor {
  nodeIndex: number
  x: number
  z: number
  approachRadius: number
  name: string
  label: string
}

export interface RegionExpeditionSpec {
  activity: ExpeditionActivityDef
  nodes: ExpeditionNodeAnchor[]
  /** Center point of the puzzle/hazard cluster. */
  centerX: number
  centerZ: number
  /** Timed cycle period and active window for hazards. */
  cyclePeriod: number
  activeWindow: number
}

const PUZZLE_APPROACH_RADIUS = 6.0
const HAZARD_APPROACH_RADIUS = 7.5

function hashUnit(seed: number, regionId: string, salt: string): number {
  return unitFromSeed(seed, `${regionId}:expedition:${salt}`)
}

/**
 * Generates deterministic 3D node positions for the region's expedition activity.
 * Ensures the activity cluster is placed in an open explorable sector
 * (radius 30m–65m from map center) away from the spawn point and grove center.
 */
export function getRegionExpeditionSpec(
  regionId: string,
  seed: number,
): RegionExpeditionSpec | null {
  const activity = getRegionExpeditionActivity(regionId)
  if (!activity) return null

  // Angle and distance for the cluster center
  const baseAngle = hashUnit(seed, regionId, 'cluster_ang') * Math.PI * 2
  const baseDist = 35 + hashUnit(seed, regionId, 'cluster_dist') * 28 // 35m to 63m from origin
  const centerX = Math.cos(baseAngle) * baseDist
  const centerZ = Math.sin(baseAngle) * baseDist

  const nodeCount = activity.kind === 'puzzle' ? 3 : activity.kind === 'hazard' ? 2 : 1
  const nodes: ExpeditionNodeAnchor[] = []
  const approachRadius =
    activity.kind === 'hazard' ? HAZARD_APPROACH_RADIUS : PUZZLE_APPROACH_RADIUS

  for (let i = 0; i < nodeCount; i++) {
    const nodeOffsetAngle = baseAngle + (i * (Math.PI * 2)) / Math.max(1, nodeCount) + 0.3
    const nodeDist = 8 + hashUnit(seed, regionId, `node_${i}_rad`) * 6
    const nx = centerX + Math.cos(nodeOffsetAngle) * nodeDist
    const nz = centerZ + Math.sin(nodeOffsetAngle) * nodeDist

    let nodeName = `Expedition Site ${i + 1}`
    if (activity.kind === 'puzzle') {
      nodeName = `Resonance Node ${i + 1}`
    } else if (activity.kind === 'hazard') {
      nodeName = `Thermal Fumarole ${i + 1}`
    } else if (activity.kind === 'trail') {
      nodeName = `Flora Survey Marker ${i + 1}`
    } else if (activity.kind === 'survey') {
      nodeName = `Barrow Monolith ${i + 1}`
    }

    nodes.push({
      nodeIndex: i,
      x: nx,
      z: nz,
      approachRadius,
      name: nodeName,
      label: activity.name,
    })
  }

  // Hazards cycle every 18 seconds (active for 8s, dormant for 10s)
  return {
    activity,
    nodes,
    centerX,
    centerZ,
    cyclePeriod: 18,
    activeWindow: 8,
  }
}

/**
 * Checks whether a hazard vent is in an active (venting) or dormant (safe) state.
 */
export function isHazardVentActive(
  regionId: string,
  nodeIndex: number,
  timeSeconds: number,
  seed = 42,
): boolean {
  const phase = hashUnit(seed, regionId, `vent_phase_${nodeIndex}`) * 18
  const cycleTime = (((timeSeconds + phase) % 18) + 18) % 18
  return cycleTime < 8
}
