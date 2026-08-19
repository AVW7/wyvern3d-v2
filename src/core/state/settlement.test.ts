import { describe, expect, it } from 'vitest'
import { CONFIG } from '../data/config'
import { REGIONS } from '../data/regions'
import { createInitialState } from './game'
import {
  regionSettlementReading,
  settlementCondition,
  settlementReading,
  settlementTrend,
} from './settlement'
import type { SettlementCondition } from '../types'

const VALID: SettlementCondition[] = ['prospering', 'strained', 'resentful', 'revolting', 'hostile']
const { strainedAt, resentfulAt, revoltingAt } = CONFIG.region.settlement

describe('settlementCondition', () => {
  it('resolves every unrest value in 0..100 to a valid condition', () => {
    for (let unrest = 0; unrest <= 100; unrest += 0.5) {
      expect(VALID).toContain(settlementCondition('player', unrest))
    }
  })

  it('bands match the configured thresholds at their exact boundaries', () => {
    expect(settlementCondition('player', 0)).toBe('prospering')
    expect(settlementCondition('player', strainedAt - 0.01)).toBe('prospering')
    expect(settlementCondition('player', strainedAt)).toBe('strained')
    expect(settlementCondition('player', resentfulAt - 0.01)).toBe('strained')
    expect(settlementCondition('player', resentfulAt)).toBe('resentful')
    expect(settlementCondition('player', revoltingAt - 0.01)).toBe('resentful')
    expect(settlementCondition('player', revoltingAt)).toBe('revolting')
    expect(settlementCondition('player', CONFIG.region.revoltAt)).toBe('revolting')
  })

  it('is monotonic — rising unrest never improves the condition', () => {
    const rank = ['prospering', 'strained', 'resentful', 'revolting']
    let last = 0
    for (let unrest = 0; unrest <= 100; unrest += 0.5) {
      const here = rank.indexOf(settlementCondition('player', unrest))
      expect(here).toBeGreaterThanOrEqual(last)
      last = here
    }
  })

  it('reads hostile on enemy ground at any unrest', () => {
    for (const unrest of [0, strainedAt, resentfulAt, revoltingAt, 100]) {
      expect(settlementCondition('enemy', unrest)).toBe('hostile')
    }
  })
})

describe('settlementTrend', () => {
  it('an ungarrisoned holding is worsening', () => {
    expect(settlementTrend('player', 0)).toBe('worsening')
  })

  it('a garrison that out-suppresses the tick gain is improving', () => {
    // Suppression is strength/10 * unrestPerGarrison; solve for comfortably over.
    const needed = (CONFIG.region.unrestPerTick / CONFIG.region.unrestPerGarrison) * 10
    expect(settlementTrend('player', needed * 2)).toBe('improving')
  })

  it('a garrison sized to exactly hold the line reads holding, not a flicker', () => {
    const exact = (CONFIG.region.unrestPerTick / CONFIG.region.unrestPerGarrison) * 10
    expect(settlementTrend('player', exact)).toBe('holding')
  })

  it('royal_garrison halves the gain, so a garrison that only held now improves', () => {
    const exact = (CONFIG.region.unrestPerTick / CONFIG.region.unrestPerGarrison) * 10
    expect(settlementTrend('player', exact, 0.5)).toBe('improving')
  })

  it('grand_taxation raises the gain, so the same garrison loses ground', () => {
    const exact = (CONFIG.region.unrestPerTick / CONFIG.region.unrestPerGarrison) * 10
    expect(settlementTrend('player', exact, 1.1)).toBe('worsening')
  })

  it('enemy ground has no trend of its own', () => {
    expect(settlementTrend('enemy', 0)).toBe('holding')
    expect(settlementTrend('enemy', 5000)).toBe('holding')
  })
})

describe('settlementReading', () => {
  it('carries condition, trend and the raw unrest together', () => {
    const reading = settlementReading('player', 60, 0)
    expect(reading).toEqual({ condition: 'resentful', trend: 'worsening', unrest: 60 })
  })

  it('condition and trend are independent — same band, opposite trajectories', () => {
    const heavy = (CONFIG.region.unrestPerTick / CONFIG.region.unrestPerGarrison) * 10 * 2
    const falling = settlementReading('player', 60, heavy)
    const rising = settlementReading('player', 60, 0)
    expect(falling.condition).toBe(rising.condition)
    expect(falling.trend).toBe('improving')
    expect(rising.trend).toBe('worsening')
  })
})

describe('regionSettlementReading', () => {
  it('resolves a reading for all 22 regions on a fresh state', () => {
    const state = createInitialState(1)
    for (const id of Object.keys(REGIONS)) {
      const reading = regionSettlementReading(state, id)
      expect(reading, id).not.toBeNull()
      expect(VALID, id).toContain(reading!.condition)
    }
  })

  it('returns null for an unknown region rather than inventing one', () => {
    expect(regionSettlementReading(createInitialState(1), 'nowhere')).toBeNull()
  })

  it('the home region always reads prospering, even with unrest forced high', () => {
    const state = createInitialState(1)
    const home = Object.keys(REGIONS).find((id) => REGIONS[id]?.starting)!
    state.regions[home]!.unrest = 99
    // regionTick zeroes the seat's unrest and it can never revolt, so the
    // reading must not contradict the soft-lock exemption that guards it.
    expect(regionSettlementReading(state, home)!.condition).toBe('prospering')
  })

  it('an enemy region reads hostile on a fresh state', () => {
    const state = createInitialState(1)
    const enemy = Object.keys(REGIONS).find((id) => state.regions[id]?.owner === 'enemy')!
    expect(regionSettlementReading(state, enemy)!.condition).toBe('hostile')
  })
})

describe('authored settlement data', () => {
  it('every settlement has a non-empty name and a tier of 1..3', () => {
    for (const def of Object.values(REGIONS)) {
      if (!def.settlement) continue
      expect(def.settlement.name.length, def.id).toBeGreaterThan(0)
      expect([1, 2, 3], def.id).toContain(def.settlement.tier)
    }
  })

  it('every settlement anchor stays inside its own map node cap', () => {
    for (const def of Object.values(REGIONS)) {
      if (!def.settlement) continue
      const { x, z } = def.settlement.offset
      // The offset is a fraction of the node radius, so this is scale-free:
      // 0.6 leaves room for the cluster spread around the anchor.
      expect(Math.hypot(x, z), def.id).toBeLessThanOrEqual(0.6)
    }
  })

  it('leaves genuinely uninhabited regions without a settlement', () => {
    const uninhabited = Object.values(REGIONS).filter((d) => !d.settlement)
    expect(uninhabited.length).toBeGreaterThan(0)
  })
})
