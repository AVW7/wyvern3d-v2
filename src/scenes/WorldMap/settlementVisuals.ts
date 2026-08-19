import type { SettlementCondition, SettlementDef, SettlementTrend } from '@/core/types'

/**
 * The one palette settlement condition resolves through, mirroring the role
 * `nodeVisuals.ts` plays for ownership status. Nothing here recomputes a
 * threshold — the condition arrives already derived from core.
 */
export const SETTLEMENT_COLORS: Record<SettlementCondition, string> = {
  prospering: '#4ade80',
  strained: '#fbbf24',
  resentful: '#f97316',
  revolting: '#ef4444',
  hostile: '#64748b',
}

/**
 * Hearth light. Prospering settlements are lit and busy; as unrest climbs the
 * windows go dark, which reads at map camera distance where a colour shift
 * alone does not.
 */
export const SETTLEMENT_HEARTH: Record<SettlementCondition, number> = {
  prospering: 1.0,
  strained: 0.62,
  resentful: 0.3,
  revolting: 0.08,
  hostile: 0.18,
}

export const TREND_MARK: Record<SettlementTrend, string> = {
  improving: '▲',
  holding: '■',
  worsening: '▼',
}

export interface SettlementBuilding {
  /** Local offset from the settlement anchor. */
  x: number
  z: number
  width: number
  depth: number
  height: number
  /** Radians. */
  rotation: number
}

/**
 * Deterministic building layout for one settlement.
 *
 * Derived from the region id and the authored tier, never from `Math.random()`
 * and never from the tick RNG — this runs in a render path, and drawing from
 * `withRng` there would advance `state.rngState` and desync every replay.
 * A plain string hash is enough: the layout must be stable across remounts and
 * identical in every session, which is a stronger guarantee than a seeded
 * sequence would give here.
 *
 * **Everything is a fraction of `nodeRadius`, and deliberately not to
 * architectural scale.** A region on this map is a disc four to five units
 * across; a real 6 m longhouse on it is a third of a pixel at map camera
 * distance. The world map is a strategic surface, so a settlement has to read
 * as a symbol sized against its own node, the way the status ring and unrest
 * bar already do.
 */
export function settlementBuildings(
  regionId: string,
  settlement: SettlementDef,
  nodeRadius: number,
): SettlementBuilding[] {
  const count = settlement.tier * 2 + 1
  const out: SettlementBuilding[] = []

  let h = 2166136261
  for (let i = 0; i < regionId.length; i++) {
    h ^= regionId.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  // Successive values off the same hash, kept in [0,1).
  const next = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }

  // Cluster footprint grows with tier but stays inside the cap alongside the
  // authored anchor offset, which is itself capped at 0.6 of the radius.
  const spread = nodeRadius * (0.07 + settlement.tier * 0.05)
  const foot = nodeRadius * 0.15
  const storey = nodeRadius * 0.42

  for (let i = 0; i < count; i++) {
    // Ring-ish cluster: angle marches around, radius jitters within the tier.
    const angle = (i / count) * Math.PI * 2 + next() * 0.55
    const radius = i === 0 ? 0 : (0.55 + next() * 0.45) * spread
    out.push({
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      width: foot * (0.82 + next() * 0.5),
      depth: foot * (0.82 + next() * 0.5),
      // The centre building is the hall: always the tallest of the cluster.
      height: storey * (i === 0 ? 1.45 : 0.72 + next() * 0.55),
      rotation: next() * Math.PI,
    })
  }
  return out
}
