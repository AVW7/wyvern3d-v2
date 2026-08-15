import { describe, expect, it } from 'vitest'
import { createInitialState } from '@/core/state/game'
import { resolveContextAction, getSupplySourcePositions } from './actionResolver'
import type { Interactable } from '../layout'

describe('Sanctuary Stage 1: Context Action & Proximity Resolver', () => {
  const dummyInteractables: Interactable[] = [
    { id: 'warTable', label: 'War Table', panel: 'warTable', position: [0, -26], radius: 3.5 },
    { id: 'roster', label: 'Roster Ledger', panel: 'roster', position: [-8, -26], radius: 3.0 },
  ]

  it('resolves station when near an interactable station', () => {
    const state = createInitialState(42)
    const action = resolveContextAction({
      playerPosition: [0, -25], // within radius 3.5 of [0, -26]
      state,
      interactables: dummyInteractables,
      wyvernPositions: { wy_1: [-38, -22] },
    })

    expect(action).not.toBeNull()
    expect(action?.priority).toBe('station')
    expect(action?.id).toBe('warTable')
    expect(action?.label).toBe('War Table')
  })

  it('resolves supply source when a feed duty is available and player is near barrel/crate', () => {
    const state = createInitialState(42)
    const wyvern = Object.values(state.wyverns)[0]!
    state.duties.active = [
      {
        id: 1,
        kind: 'feed',
        subjectId: wyvern.id,
        status: 'available',
        createdTick: 1,
      },
    ]
    state.resources.food = 100

    const sources = getSupplySourcePositions(state)
    const firstSource = sources[0]!

    const action = resolveContextAction({
      playerPosition: [firstSource.position[0], firstSource.position[1]],
      state,
      interactables: dummyInteractables,
      wyvernPositions: { [wyvern.id]: [-38, -22] },
    })

    expect(action).not.toBeNull()
    expect(action?.priority).toBe('dutySource')
    expect(action?.label).toContain(`Take Ration (for ${wyvern.name})`)
    expect(action?.intent).toEqual({ type: 'TAKE_DUTY_ITEM', dutyId: 1 })
    expect(action?.disabledReason).toBeUndefined()
  })

  it('marks supply action disabled if player lacks food', () => {
    const state = createInitialState(42)
    const wyvern = Object.values(state.wyverns)[0]!
    state.duties.active = [
      {
        id: 1,
        kind: 'feed',
        subjectId: wyvern.id,
        status: 'available',
        createdTick: 1,
      },
    ]
    state.resources.food = 0 // not enough food

    const sources = getSupplySourcePositions(state)
    const firstSource = sources[0]!

    const action = resolveContextAction({
      playerPosition: [firstSource.position[0], firstSource.position[1]],
      state,
      interactables: dummyInteractables,
      wyvernPositions: { [wyvern.id]: [-38, -22] },
    })

    expect(action).not.toBeNull()
    expect(action?.priority).toBe('dutySource')
    expect(action?.disabledReason).toBe('No Food Available')
    expect(action?.intent).toBeUndefined()
  })

  it('prioritizes delivery over station or inspection when carrying a duty item near target wyvern', () => {
    const state = createInitialState(42)
    const wyvern = Object.values(state.wyverns)[0]!
    state.duties.active = [
      {
        id: 1,
        kind: 'feed',
        subjectId: wyvern.id,
        status: 'carrying',
        createdTick: 1,
      },
    ]
    state.duties.carriedDutyId = 1

    const wyvernPos: [number, number] = [0, -25] // close to both warTable and wyvern
    const action = resolveContextAction({
      playerPosition: [0, -25],
      state,
      interactables: dummyInteractables,
      wyvernPositions: { [wyvern.id]: wyvernPos },
    })

    expect(action).not.toBeNull()
    expect(action?.priority).toBe('delivery')
    expect(action?.label).toBe(`Feed ${wyvern.name}`)
    expect(action?.intent).toEqual({ type: 'COMPLETE_DUTY', dutyId: 1 })
  })

  it('resolves medicine duty delivery when carrying medicine to injured wyvern', () => {
    const state = createInitialState(42)
    const wyvern = Object.values(state.wyverns)[0]!
    state.duties.active = [
      {
        id: 2,
        kind: 'medicine',
        subjectId: wyvern.id,
        status: 'carrying',
        createdTick: 1,
      },
    ]
    state.duties.carriedDutyId = 2

    const action = resolveContextAction({
      playerPosition: [-38, -20],
      state,
      interactables: dummyInteractables,
      wyvernPositions: { [wyvern.id]: [-38, -22] },
    })

    expect(action).not.toBeNull()
    expect(action?.priority).toBe('delivery')
    expect(action?.label).toBe(`Treat ${wyvern.name}`)
    expect(action?.intent).toEqual({ type: 'COMPLETE_DUTY', dutyId: 2 })
  })

  it('resolves direct companionship duty when near wyvern', () => {
    const state = createInitialState(42)
    const wyvern = Object.values(state.wyverns)[0]!
    state.duties.active = [
      {
        id: 3,
        kind: 'companionship',
        subjectId: wyvern.id,
        status: 'available',
        createdTick: 1,
      },
    ]

    const action = resolveContextAction({
      playerPosition: [-38, -20],
      state,
      interactables: dummyInteractables,
      wyvernPositions: { [wyvern.id]: [-38, -22] },
    })

    expect(action).not.toBeNull()
    expect(action?.priority).toBe('delivery')
    expect(action?.label).toBe(`Bond with ${wyvern.name}`)
    expect(action?.intent).toEqual({ type: 'COMPLETE_DUTY', dutyId: 3 })
  })

  it('resolves direct flight exercise duty when near wyvern', () => {
    const state = createInitialState(42)
    const wyvern = Object.values(state.wyverns)[0]!
    state.duties.active = [
      {
        id: 4,
        kind: 'flightExercise',
        subjectId: wyvern.id,
        status: 'available',
        createdTick: 1,
      },
    ]

    const action = resolveContextAction({
      playerPosition: [-38, -20],
      state,
      interactables: dummyInteractables,
      wyvernPositions: { [wyvern.id]: [-38, -22] },
    })

    expect(action).not.toBeNull()
    expect(action?.priority).toBe('delivery')
    expect(action?.label).toBe(`Exercise ${wyvern.name}`)
    expect(action?.intent).toEqual({ type: 'COMPLETE_DUTY', dutyId: 4 })
  })

  it('suppresses context action in edit mode or target mode', () => {
    const state = createInitialState(42)
    const actionInEdit = resolveContextAction({
      playerPosition: [0, -25],
      state,
      interactables: dummyInteractables,
      wyvernPositions: {},
      isEditing: true,
    })
    expect(actionInEdit).toBeNull()

    const actionInTarget = resolveContextAction({
      playerPosition: [0, -25],
      state,
      interactables: dummyInteractables,
      wyvernPositions: {},
      targetMode: true,
    })
    expect(actionInTarget).toBeNull()
  })

  it('resolves wyvern inspection when close to a wyvern and not carrying a duty', () => {
    const state = createInitialState(42)
    const wyvern = Object.values(state.wyverns)[0]!
    const action = resolveContextAction({
      playerPosition: [-38, -20],
      state,
      interactables: dummyInteractables,
      wyvernPositions: { [wyvern.id]: [-38, -22] },
    })

    expect(action).not.toBeNull()
    expect(action?.priority).toBe('wyvern')
    expect(action?.label).toBe(`Inspect ${wyvern.name}`)
  })
})
