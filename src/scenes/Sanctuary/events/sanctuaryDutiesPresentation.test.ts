import { describe, expect, it } from 'vitest'
import { createInitialState } from '@/core/state/game'
import type { GameEvent } from '@/core/types'

describe('Sanctuary Stage 2: Request Readability & Reactions', () => {
  it('duties are associated with valid subjects and readable statuses', () => {
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

    expect(state.duties.active).toHaveLength(1)
    const duty = state.duties.active[0]!
    expect(duty.status).toBe('available')
    expect(state.wyverns[duty.subjectId]?.name).toBe(wyvern.name)
  })

  it('sanctuary_duty_completed event contains subjectId and payload', () => {
    const event: GameEvent = {
      seq: 10,
      tick: 5,
      kind: 'sanctuary_duty_completed',
      subjectId: 'wy_1',
      payload: {
        dutyId: 1,
        dutyKind: 'feed',
        bondBonus: 1,
      },
    }

    expect(event.kind).toBe('sanctuary_duty_completed')
    expect(event.subjectId).toBe('wy_1')
    expect(event.payload?.dutyKind).toBe('feed')
    expect(event.payload?.bondBonus).toBe(1)
  })

  it('wyvern rename maintains correct reference in duties state', () => {
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

    wyvern.name = 'Pyrothrax the Fierce'
    const activeDuty = state.duties.active[0]!
    expect(state.wyverns[activeDuty.subjectId]?.name).toBe('Pyrothrax the Fierce')
  })
})
