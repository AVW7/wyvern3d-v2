import { describe, expect, it } from 'vitest'
import { createWyvern, getWyvernLevelProgress, getWyvernStatPercentages } from './wyvern'
import { CONFIG } from '../data/config'

describe('wyvern quick level and stat percentages', () => {
  const dummyWyvern = () =>
    createWyvern({
      id: 'w1',
      speciesId: 'emberback',
      name: 'Test Wyvern',
      stats: { power: 10, speed: 10, stamina: 10, firepower: 10, armor: 10 },
      traits: [],
      stage: 'adult',
      origin: 'tamed',
      bond: 50,
    })

  it('calculates level progress correctly at level 1 with 0 XP', () => {
    const w = dummyWyvern()
    const progress = getWyvernLevelProgress(w)

    expect(progress.currentXp).toBe(0)
    expect(progress.requiredXp).toBe(CONFIG.wyvern.xpPerLevel * 1)
    expect(progress.xpPercent).toBe(0)
    expect(progress.isMaxLevel).toBe(false)
    expect(progress.canLevelUp).toBe(false)
  })

  it('calculates percentage accurately when partially leveled', () => {
    const w = dummyWyvern()
    const req = CONFIG.wyvern.xpPerLevel * 1
    w.xp = req * 0.75 // 75%
    const progress = getWyvernLevelProgress(w)

    expect(progress.xpPercent).toBeCloseTo(75)
    expect(progress.canLevelUp).toBe(false)
  })

  it('detects max level reached', () => {
    const w = dummyWyvern()
    w.level = CONFIG.wyvern.maxLevel
    const progress = getWyvernLevelProgress(w)

    expect(progress.isMaxLevel).toBe(true)
    expect(progress.xpPercent).toBe(100)
    expect(progress.canLevelUp).toBe(false)
  })

  it('calculates stat percentages correctly', () => {
    const w = dummyWyvern()
    w.injury = 50 // 50 / 200 => 25% injury, 75% health
    w.hunger = 20 // 80% fed
    w.bond = 85

    const stats = getWyvernStatPercentages(w)
    expect(stats.healthPercent).toBe(75)
    expect(stats.fedPercent).toBe(80)
    expect(stats.bondPercent).toBe(85)
    expect(stats.growthPercent).toBe(100) // adult
  })
})
