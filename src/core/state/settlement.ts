import type { GameState, SettlementCondition, SettlementReading, SettlementTrend } from '../types'
import { CONFIG } from '../data/config'
import { REGIONS } from '../data/regions'

/**
 * Unrest with a face.
 *
 * `unrest` is already the pressure valve on holding ground, but it only ever
 * surfaced as a number and a revolt threshold. This turns it into a condition
 * the world map can draw: how the people of a held region are taking it.
 *
 * Two separate readings, deliberately not merged:
 *
 * - `condition` is where unrest stands *now*, in bands from `CONFIG.region.settlement`.
 * - `trend` is where it is *heading*, from whether the stationed garrison
 *   out-suppresses the per-tick unrest gain.
 *
 * Folding garrison into the condition band would double-count it, because
 * `regionTick` already subtracts garrison suppression from unrest every tick —
 * a well-garrisoned region shows a low band *because* of its troops. Trend is
 * the part the player genuinely cannot read off the unrest number: two regions
 * at 60 unrest are in the same state but not on the same trajectory.
 */

/** Enemy ground has inhabitants too, so the reading is total over every region. */
export function settlementCondition(owner: 'player' | 'enemy', unrest: number): SettlementCondition {
  if (owner !== 'player') return 'hostile'
  const { strainedAt, resentfulAt, revoltingAt } = CONFIG.region.settlement
  if (unrest >= revoltingAt) return 'revolting'
  if (unrest >= resentfulAt) return 'resentful'
  if (unrest >= strainedAt) return 'strained'
  return 'prospering'
}

/**
 * Net unrest direction under the current garrison.
 *
 * `unrestRateMultiplier` carries the ruler edict that `regionTick` applies to
 * the gain side (`royal_garrison` 0.5, `grand_taxation` 1.1). It is a parameter
 * rather than a state read so this stays a pure function of its inputs.
 */
export function settlementTrend(
  owner: 'player' | 'enemy',
  garrisonStrength: number,
  unrestRateMultiplier = 1,
  suppressionMultiplier = 1,
): SettlementTrend {
  if (owner !== 'player') return 'holding'
  const gain = CONFIG.region.unrestPerTick * unrestRateMultiplier
  const suppression =
    (garrisonStrength / 10) * CONFIG.region.unrestPerGarrison * suppressionMultiplier
  const net = gain - suppression
  // A dead band keeps a garrison sized to exactly hold the line from flickering
  // between improving and worsening on floating-point noise.
  if (net < -CONFIG.region.settlement.trendDeadband) return 'improving'
  if (net > CONFIG.region.settlement.trendDeadband) return 'worsening'
  return 'holding'
}

export function settlementReading(
  owner: 'player' | 'enemy',
  unrest: number,
  garrisonStrength: number,
  unrestRateMultiplier = 1,
  suppressionMultiplier = 1,
): SettlementReading {
  return {
    condition: settlementCondition(owner, unrest),
    trend: settlementTrend(owner, garrisonStrength, unrestRateMultiplier, suppressionMultiplier),
    unrest,
  }
}

/** The multipliers `regionTick` derives from realm state, so trend matches the sim. */
export function unrestModifiers(state: GameState): {
  unrestRateMultiplier: number
  suppressionMultiplier: number
} {
  const edict = state.realm?.ruler?.edict
  return {
    unrestRateMultiplier: edict === 'royal_garrison' ? 0.5 : edict === 'grand_taxation' ? 1.1 : 1.0,
    suppressionMultiplier: state.realm?.philosophies?.unlocked?.includes('dominion') ? 1.1 : 1.0,
  }
}

/**
 * Reading for one region straight off game state.
 *
 * The home region is exempt from unrest in `regionTick` and can never revolt,
 * so it always reads `prospering` — the seat of the realm is not a conquest.
 */
export function regionSettlementReading(state: GameState, regionId: string): SettlementReading | null {
  const region = state.regions[regionId]
  if (!region) return null

  const garrisonStrength = Object.values(state.squads)
    .filter((s) => s.stationedAt === regionId)
    .reduce((sum, s) => sum + s.strength, 0)

  const { unrestRateMultiplier, suppressionMultiplier } = unrestModifiers(state)
  return settlementReading(
    region.owner,
    REGIONS[regionId]?.starting ? 0 : region.unrest,
    garrisonStrength,
    unrestRateMultiplier,
    suppressionMultiplier,
  )
}
