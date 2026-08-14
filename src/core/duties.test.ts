import { describe, expect, it } from 'vitest'
import { createInitialState } from './state/game'
import { execute } from './executions'
import { advanceTicks } from './state/tick'
import { migrate } from './state/save'
import { CONFIG } from './data/config'
import type { GameState } from './types'

describe('Sanctuary Gameplay Stage 0: Feed-Duty Vertical Slice', () => {
  it('generates a feed duty during sanctuary tick when a wyvern is hungry (hunger >= 30)', () => {
    const state = createInitialState(42)
    const wyvern = Object.values(state.wyverns)[0]!
    expect(state.duties.active).toHaveLength(0)

    // Not hungry enough (hunger 20 drops to 14, still < 30)
    wyvern.hunger = 20
    advanceTicks(state, 1)
    expect(state.duties.active).toHaveLength(0)

    // Reaches hunger threshold (hunger 45 drops to 39, >= 30)
    wyvern.hunger = 45
    advanceTicks(state, 1)
    expect(state.duties.active).toHaveLength(1)

    const duty = state.duties.active[0]!
    expect(duty.kind).toBe('feed')
    expect(duty.subjectId).toBe(wyvern.id)
    expect(duty.status).toBe('available')
  })

  it('respects the 3-duty active cap', () => {
    const state = createInitialState(42)
    // Add extra wyverns
    state.wyverns.wy_2 = { ...Object.values(state.wyverns)[0]!, id: 'wy_2', name: 'Wyvern 2', hunger: 80 }
    state.wyverns.wy_3 = { ...Object.values(state.wyverns)[0]!, id: 'wy_3', name: 'Wyvern 3', hunger: 80 }
    state.wyverns.wy_4 = { ...Object.values(state.wyverns)[0]!, id: 'wy_4', name: 'Wyvern 4', hunger: 80 }
    state.wyverns.wy_5 = { ...Object.values(state.wyverns)[0]!, id: 'wy_5', name: 'Wyvern 5', hunger: 80 }

    advanceTicks(state, 5)
    expect(state.duties.active.length).toBe(CONFIG.duties.maxActive)
    expect(state.duties.active.length).toBe(3)
  })

  it('selects candidates deterministically by sorted wyvern id', () => {
    const state = createInitialState(42)
    state.wyverns.wy_b = { ...Object.values(state.wyverns)[0]!, id: 'wy_b', name: 'Beta', hunger: 60 }
    state.wyverns.wy_a = { ...Object.values(state.wyverns)[0]!, id: 'wy_a', name: 'Alpha', hunger: 60 }

    // Make initial wyvern full
    Object.values(state.wyverns)[0]!.hunger = 0

    advanceTicks(state, 1)
    expect(state.duties.active).toHaveLength(1)
    // wy_a comes before wy_b in alphabetical sort
    expect(state.duties.active[0]!.subjectId).toBe('wy_a')
  })

  it('does not spawn duplicate duties for the same wyvern', () => {
    const state = createInitialState(42)
    const wyvern = Object.values(state.wyverns)[0]!
    wyvern.hunger = 90

    advanceTicks(state, 10)
    expect(state.duties.active).toHaveLength(1)
    expect(state.duties.active[0]!.subjectId).toBe(wyvern.id)
  })

  it('handles duty take and abandon item lifecycle', () => {
    const state = createInitialState(42)
    const wyvern = Object.values(state.wyverns)[0]!
    wyvern.hunger = 60
    advanceTicks(state, 1)

    const duty = state.duties.active[0]!
    expect(duty.status).toBe('available')
    expect(state.duties.carriedDutyId).toBeNull()

    // Take item
    execute(state, { type: 'TAKE_DUTY_ITEM', dutyId: duty.id })
    expect(duty.status).toBe('carrying')
    expect(state.duties.carriedDutyId).toBe(duty.id)

    // Abandon item
    execute(state, { type: 'ABANDON_DUTY_ITEM', dutyId: duty.id })
    expect(duty.status).toBe('available')
    expect(state.duties.carriedDutyId).toBeNull()
  })

  it('completes feed duty, spends food, relieves hunger, increases bond, and emits event', () => {
    const state = createInitialState(42)
    const wyvern = Object.values(state.wyverns)[0]!
    wyvern.hunger = 60
    const bondBefore = wyvern.bond
    const eventsBefore = state.events.length

    advanceTicks(state, 1)
    const duty = state.duties.active[0]!
    const foodBefore = state.resources.food
    const hungerBefore = wyvern.hunger

    execute(state, { type: 'TAKE_DUTY_ITEM', dutyId: duty.id })
    execute(state, { type: 'COMPLETE_DUTY', dutyId: duty.id })

    // Active duty removed, completed counter incremented
    expect(state.duties.active).toHaveLength(0)
    expect(state.duties.carriedDutyId).toBeNull()
    expect(state.duties.completed).toBe(1)

    // Food spent & hunger relieved
    expect(state.resources.food).toBe(foodBefore - CONFIG.wyvern.feedCost)
    expect(wyvern.hunger).toBe(Math.max(0, hungerBefore - CONFIG.wyvern.feedRelief))
    expect(wyvern.bond).toBe(bondBefore + CONFIG.duties.feedBondBonus)

    // Typed event emitted
    expect(state.events.length).toBe(eventsBefore + 1)
    const lastEvent = state.events[state.events.length - 1]!
    expect(lastEvent.kind).toBe('sanctuary_duty_completed')
    expect(lastEvent.subjectId).toBe(wyvern.id)
    expect(lastEvent.payload?.dutyId).toBe(duty.id)
    expect(lastEvent.payload?.kind).toBe('feed')
  })

  it('rejects duty completion when food is insufficient', () => {
    const state = createInitialState(42)
    const wyvern = Object.values(state.wyverns)[0]!
    wyvern.hunger = 60

    advanceTicks(state, 1)
    const duty = state.duties.active[0]!

    state.resources.food = 5 // less than feedCost (25)
    const hungerBefore = wyvern.hunger

    execute(state, { type: 'COMPLETE_DUTY', dutyId: duty.id })

    // No change
    expect(state.duties.active).toHaveLength(1)
    expect(state.duties.completed).toBe(0)
    expect(state.resources.food).toBe(5)
    expect(wyvern.hunger).toBe(hungerBefore)
  })

  it('prunes active duties if subject wyvern is released or removed', () => {
    const state = createInitialState(42)
    const wyvern = Object.values(state.wyverns)[0]!
    wyvern.hunger = 50

    advanceTicks(state, 1)
    expect(state.duties.active).toHaveLength(1)

    // Release wyvern
    execute(state, { type: 'RELEASE_WYVERN', wyvernId: wyvern.id })
    advanceTicks(state, 1)

    expect(state.duties.active).toHaveLength(0)
    expect(state.duties.carriedDutyId).toBeNull()
  })

  it('never mutates rngState or nextId when generating or completing duties', () => {
    const state = createInitialState(42)
    const wyvern = Object.values(state.wyverns)[0]!
    wyvern.hunger = 50

    const rngBefore = state.rngState
    const nextIdBefore = state.nextId

    advanceTicks(state, 1)
    const duty = state.duties.active[0]!
    execute(state, { type: 'TAKE_DUTY_ITEM', dutyId: duty.id })
    execute(state, { type: 'COMPLETE_DUTY', dutyId: duty.id })

    expect(state.rngState).toBe(rngBefore)
    expect(state.nextId).toBe(nextIdBefore)
  })

  it('migrates older save version 10 by initializing duties state', () => {
    const stateV10 = {
      ...createInitialState(100),
      saveVersion: 10,
      duties: undefined as unknown as GameState['duties'],
    }

    const migrated = migrate(stateV10)
    expect(migrated.saveVersion).toBe(11)
    expect(migrated.duties).toBeDefined()
    expect(migrated.duties.nextSeq).toBe(1)
    expect(migrated.duties.active).toEqual([])
    expect(migrated.duties.carriedDutyId).toBeNull()
    expect(migrated.duties.completed).toBe(0)
  })
})
