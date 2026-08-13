import { describe, expect, it } from 'vitest'
import { execute } from './executions'
import { SAVE_VERSION } from './data/config'
import { REGIONS } from './data/regions'
import { SPECIES } from './data/species'
import { createInitialState } from './state/game'
import { migrate } from './state/save'
import type { GameState } from './types'

function versionThreeState(seed = 73): GameState {
  const state = createInitialState(seed)
  state.saveVersion = 3
  return state
}

function ownThornmarch(state: GameState): void {
  state.regions.thornmarch!.owner = 'player'
}

describe('Thornwing content', () => {
  it('defines the intended tier-two forest ambusher', () => {
    expect(SPECIES.thornwing).toEqual({
      id: 'thornwing',
      name: 'Thornwing',
      color: '#688c4a',
      tier: 2,
      baseStats: { power: 29, speed: 34, stamina: 25, firepower: 22, armor: 17 },
      growth: { power: 2.7, speed: 3.1, stamina: 1.9, firepower: 2.1, armor: 1.4 },
      traitPool: ['skittish', 'venomous', 'loyal'],
    })
    expect(REGIONS.thornmarch!.nativeSpecies).toBe('thornwing')
  })

  it('awards Thornwing eggs through ordinary Thornmarch conquest', () => {
    const state = createInitialState(17)
    const wyvernId = Object.keys(state.wyverns)[0]!

    execute(state, {
      type: 'LAUNCH_ATTACK',
      regionId: 'thornmarch',
      wyvernIds: [wyvernId],
      squadIds: [],
      pilotedWyvernId: wyvernId,
      mode: 'play',
    })
    execute(state, {
      type: 'RESOLVE_BATTLE',
      result: {
        regionId: 'thornmarch',
        victory: true,
        duration: 1,
        wyverns: {
          [wyvernId]: { injury: 0, xp: 0, bondDelta: 0, died: false },
        },
        squads: {},
        eggsLooted: 2,
        tamed: null,
        loot: {},
      },
    })

    expect(state.regions.thornmarch!.owner).toBe('player')
    expect(Object.values(state.eggs)).toHaveLength(2)
    expect(Object.values(state.eggs).every((egg) => egg.speciesId === 'thornwing')).toBe(true)
  })
})

describe('Thornwing save migration', () => {
  it('grants one deterministic egg to an eligible owner without advancing rngState', () => {
    const original = versionThreeState()
    ownThornmarch(original)
    const replayRngState = original.rngState
    const previousNextId = original.nextId
    const equivalent = JSON.parse(JSON.stringify(original)) as GameState

    const migrated = migrate(original)
    const migratedAgain = migrate(equivalent)
    const thornwingEggs = Object.values(migrated.eggs).filter(
      (egg) => egg.speciesId === 'thornwing',
    )
    const repeatedEggs = Object.values(migratedAgain.eggs).filter(
      (egg) => egg.speciesId === 'thornwing',
    )

    expect(migrated.saveVersion).toBe(SAVE_VERSION)
    expect(thornwingEggs).toHaveLength(1)
    expect(thornwingEggs[0]!.id).toBe(`egg_${previousNextId + 1}`)
    expect(thornwingEggs[0]).toEqual(repeatedEggs[0])
    expect(migrated.rngState).toBe(replayRngState)
    expect(migratedAgain.rngState).toBe(replayRngState)
  })

  it('is idempotent after granting the compatibility egg', () => {
    const old = versionThreeState()
    ownThornmarch(old)
    const migrated = migrate(old)
    const nextIdAfterGrant = migrated.nextId

    const migratedAgain = migrate(migrated)

    expect(migratedAgain).toBe(migrated)
    expect(migratedAgain.nextId).toBe(nextIdAfterGrant)
    expect(
      Object.values(migratedAgain.eggs).filter((egg) => egg.speciesId === 'thornwing'),
    ).toHaveLength(1)
  })

  it('does not grant an egg before Thornmarch is owned', () => {
    const old = versionThreeState()
    const nextIdBeforeMigration = old.nextId

    const migrated = migrate(old)

    expect(Object.values(migrated.eggs).some((egg) => egg.speciesId === 'thornwing')).toBe(
      false,
    )
    expect(migrated.nextId).toBe(nextIdBeforeMigration)
  })

  it('does not duplicate an existing Thornwing egg', () => {
    const old = versionThreeState()
    ownThornmarch(old)
    old.eggs.egg_existing = {
      id: 'egg_existing',
      speciesId: 'thornwing',
      parents: null,
      rolledStats: { ...SPECIES.thornwing!.baseStats },
      rolledTraits: ['loyal'],
      incubatingTicksLeft: null,
    }
    const nextIdBeforeMigration = old.nextId

    const migrated = migrate(old)

    expect(Object.values(migrated.eggs).filter((egg) => egg.speciesId === 'thornwing')).toHaveLength(
      1,
    )
    expect(migrated.nextId).toBe(nextIdBeforeMigration)
  })

  it('does not grant an egg when a Thornwing is already in the roster', () => {
    const old = versionThreeState()
    ownThornmarch(old)
    const existing = Object.values(old.wyverns)[0]!
    old.wyverns.wy_thornwing = {
      ...existing,
      id: 'wy_thornwing',
      speciesId: 'thornwing',
      name: 'Briar',
    }
    const nextIdBeforeMigration = old.nextId

    const migrated = migrate(old)

    expect(Object.values(migrated.eggs).some((egg) => egg.speciesId === 'thornwing')).toBe(
      false,
    )
    expect(migrated.nextId).toBe(nextIdBeforeMigration)
  })
})
