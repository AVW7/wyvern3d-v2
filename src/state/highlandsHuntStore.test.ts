import { beforeEach, describe, expect, it } from 'vitest'
import { getGameState } from './store'
import { isHighlandsHunter, useHighlandsHunt } from './highlandsHuntStore'

describe('Highlands hunt test session', () => {
  beforeEach(() => {
    useHighlandsHunt.getState().reset()
  })

  it('opens as a separate launcher session and resets cleanly', () => {
    useHighlandsHunt.getState().open('wyvern-adult')

    expect(useHighlandsHunt.getState()).toMatchObject({
      selectedWyvernId: 'wyvern-adult',
      mode: null,
      phase: 'launcher',
    })

    useHighlandsHunt.getState().reset()
    expect(useHighlandsHunt.getState()).toMatchObject({
      selectedWyvernId: null,
      mode: null,
      phase: 'launcher',
    })
  })

  it('requires a selected wyvern before a test mode can start', () => {
    expect(useHighlandsHunt.getState().start('guided')).toBe(false)

    useHighlandsHunt.getState().selectWyvern('wyvern-adult')
    expect(useHighlandsHunt.getState().start('guided')).toBe(true)
    expect(useHighlandsHunt.getState()).toMatchObject({
      mode: 'guided',
      phase: 'search',
      wyvernState: 'fly',
    })
  })

  it('moves a doe through claim, feast, and local respawn lifecycle', () => {
    const session = useHighlandsHunt.getState()
    session.selectWyvern('wyvern-adult')
    session.start('playable')
    const doeId = useHighlandsHunt.getState().does[0]!.id

    expect(useHighlandsHunt.getState().beginFire(doeId)).toBe(true)
    expect(useHighlandsHunt.getState().beginStrike()).toBe(true)
    expect(useHighlandsHunt.getState().does[0]).toMatchObject({
      lifecycle: 'claimed',
      animation: 'death',
    })
    expect(useHighlandsHunt.getState().beginGrip()).toBe(true)
    expect(useHighlandsHunt.getState().beginCarry()).toBe(true)
    expect(useHighlandsHunt.getState().does[0]?.lifecycle).toBe('carried')
    expect(useHighlandsHunt.getState().beginLanding()).toBe(true)
    expect(useHighlandsHunt.getState().beginEat([2, 3])).toBe(true)
    expect(useHighlandsHunt.getState().beginFinish()).toBe(true)
    expect(useHighlandsHunt.getState().finishHunt()).toBe(true)
    expect(useHighlandsHunt.getState().does[0]?.lifecycle).toBe('respawning')

    useHighlandsHunt.getState().respawnDoe(doeId)
    expect(useHighlandsHunt.getState().does[0]).toMatchObject({
      lifecycle: 'alive',
      animation: 'idle',
    })
  })

  it('only regards adult wyverns as test hunters', () => {
    expect(isHighlandsHunter({ stage: 'adult' })).toBe(true)
    expect(isHighlandsHunter({ stage: 'juvenile' })).toBe(false)
    expect(isHighlandsHunter({ stage: 'hatchling' })).toBe(false)
  })

  it('never changes deterministic game state, resources, hunger, or cooldowns', () => {
    const before = JSON.stringify(getGameState())
    const session = useHighlandsHunt.getState()
    session.open('wyvern-adult')
    session.start('guided')
    const doeId = useHighlandsHunt.getState().does[0]!.id
    session.beginFire(doeId)
    session.beginStrike()
    session.beginGrip()
    session.beginCarry()
    session.beginLanding()
    session.beginEat([2, 3])
    session.beginFinish()
    session.finishHunt()
    session.respawnDoe(doeId)

    expect(JSON.stringify(getGameState())).toBe(before)
  })
})
