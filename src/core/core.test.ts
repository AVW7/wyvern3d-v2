import { describe, expect, it } from 'vitest'
import { createInitialState, capacityOf, isAttackable } from './state/game'
import { executeNextTick, advanceTicks } from './state/tick'
import { execute } from './executions'
import { REGIONS, REGION_LIST } from './data/regions'
import { SPECIES } from './data/species'
import { UNITS } from './data/units'
import { STATIONS } from './data/stations'
import { CONFIG } from './data/config'
import { createRng } from './math/rng'
import { autoResolveConfig } from './combat/autoResolve'
import { buildEncounterConfig } from './combat/setup'
import { createEncounter } from './combat/encounter'
import { serialize, deserialize, migrate } from './state/save'
import { breedStats, effectiveStats, rollSpeciesStats, STAT_IDS } from './entities/wyvern'
import type { Intent } from './intents'
import type { GameState } from './types'

describe('content data', () => {
  it('has symmetric region adjacency', () => {
    for (const region of REGION_LIST) {
      for (const neighbor of region.neighbors) {
        const other = REGIONS[neighbor]
        expect(other, `${region.id} -> unknown region ${neighbor}`).toBeDefined()
        expect(other!.neighbors, `${neighbor} is missing back-link to ${region.id}`).toContain(
          region.id,
        )
      }
    }
  })

  it('references only defined species and units', () => {
    for (const region of REGION_LIST) {
      expect(SPECIES[region.nativeSpecies], `${region.id} native species`).toBeDefined()
      for (const g of region.garrison) expect(UNITS[g.unitId], `${region.id} garrison`).toBeDefined()
      for (const d of region.defenders) expect(SPECIES[d], `${region.id} defender`).toBeDefined()
    }
    for (const unit of Object.values(UNITS)) {
      for (const other of unit.strongAgainst) expect(UNITS[other]).toBeDefined()
    }
  })

  it('reaches every region from the start via owned-adjacency', () => {
    // If a region is unreachable the player can never conquer it.
    const start = REGION_LIST.find((r) => r.starting)!
    const seen = new Set([start.id])
    const queue = [start.id]
    while (queue.length > 0) {
      const id = queue.shift()!
      for (const n of REGIONS[id]!.neighbors) {
        if (!seen.has(n)) {
          seen.add(n)
          queue.push(n)
        }
      }
    }
    expect(seen.size).toBe(REGION_LIST.length)
  })
})

describe('rng', () => {
  it('is reproducible from a seed', () => {
    const a = createRng(1234)
    const b = createRng(1234)
    const drawsA = Array.from({ length: 50 }, () => a.next())
    const drawsB = Array.from({ length: 50 }, () => b.next())
    expect(drawsA).toEqual(drawsB)
  })

  it('resumes exactly from a serialized cursor', () => {
    const a = createRng(99)
    for (let i = 0; i < 10; i++) a.next()
    const resumed = createRng(a.state())
    expect(resumed.next()).toBe(a.next())
  })

  it('produces values in range', () => {
    const rng = createRng(7)
    for (let i = 0; i < 1000; i++) {
      const v = rng.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
      const n = rng.int(3, 6)
      expect(n).toBeGreaterThanOrEqual(3)
      expect(n).toBeLessThanOrEqual(6)
    }
  })
})

describe('world tick determinism', () => {
  it('produces identical state from the same seed and intents', () => {
    const intents: { tick: number; intent: Intent }[] = [
      { tick: 2, intent: { type: 'UPGRADE_BUILDING', buildingId: 'hatchery' } },
      { tick: 4, intent: { type: 'RECRUIT_SQUAD', unitId: 'archer', strength: 20 } },
      { tick: 6, intent: { type: 'STATION_SQUAD', squadId: 'sq_2', regionId: 'hearthvale' } },
    ]

    const run = (): GameState => {
      const state = createInitialState(42)
      for (let t = 0; t < 60; t++) {
        executeNextTick(
          state,
          intents.filter((e) => e.tick === t).map((e) => e.intent),
        )
      }
      return state
    }

    expect(JSON.stringify(run())).toEqual(JSON.stringify(run()))
  })

  it('diverges for different seeds', () => {
    const a = createInitialState(1)
    const b = createInitialState(2)
    advanceTicks(a, 30)
    advanceTicks(b, 30)
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b))
  })

  it('advances the tick counter exactly once per call', () => {
    const state = createInitialState(5)
    advanceTicks(state, 25)
    expect(state.tick).toBe(25)
  })
})

describe('economy', () => {
  it('produces resources from held regions', () => {
    const state = createInitialState(3)
    // Remove the roster so food upkeep doesn't mask production.
    state.wyverns = {}
    state.squads = {}
    const before = state.resources.timber
    advanceTicks(state, 10)
    expect(state.resources.timber).toBeGreaterThan(before)
  })

  it('starves the roster when upkeep outruns production', () => {
    const state = createInitialState(3)
    state.resources.food = 0
    // One adult eats 1.6/tick but Hearthvale yields 3/tick, so a single wyvern
    // never goes hungry. Overload the roster to create real scarcity.
    const base = Object.values(state.wyverns)[0]!
    const bondBefore = base.bond
    for (let i = 0; i < 20; i++) {
      state.wyverns[`wy_glut${i}`] = { ...base, id: `wy_glut${i}`, hunger: 0 }
    }

    // Long enough for hunger to climb past the starving threshold (60), which
    // is the point at which bond starts to erode.
    advanceTicks(state, 40)

    expect(state.resources.food).toBe(0)
    expect(state.wyverns.wy_glut0!.hunger).toBeGreaterThan(CONFIG.wyvern.starvingAt)
    // Prolonged hunger erodes bond — the cost of over-collecting.
    expect(state.wyverns.wy_glut0!.bond).toBeLessThan(bondBefore)
  })

  it('never lets any resource go negative', () => {
    const state = createInitialState(11)
    for (const id of ['food', 'gold', 'ore', 'timber', 'arcane'] as const) {
      state.resources[id] = 0
    }
    advanceTicks(state, 50)
    for (const value of Object.values(state.resources)) {
      expect(value).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('sanctuary systems', () => {
  it('completes training and grants the station stat', () => {
    const state = createInitialState(8)
    const wyvern = Object.values(state.wyverns)[0]!
    const before = wyvern.stats.speed
    execute(state, { type: 'ASSIGN_TRAINING', wyvernId: wyvern.id, stationId: 'flightRing' })
    expect(wyvern.assignment.kind).toBe('training')

    advanceTicks(state, STATIONS.flightRing!.duration + 1)
    expect(wyvern.assignment.kind).toBe('idle')
    expect(wyvern.stats.speed).toBe(before + STATIONS.flightRing!.gain)
  })

  it('updates preferred perch spot for a wyvern', () => {
    const state = createInitialState(8)
    const wyvern = Object.values(state.wyverns)[0]!
    expect(wyvern.preferredPerchIndex).toBeUndefined()

    execute(state, { type: 'SET_WYVERN_PERCH', wyvernId: wyvern.id, perchIndex: 3 })
    expect(wyvern.preferredPerchIndex).toBe(3)
  })

  it('awards food from a confirmed hunt once per recovery window', () => {
    const state = createInitialState(8)
    const wyvern = Object.values(state.wyverns)[0]!
    const foodBefore = state.resources.food

    execute(state, { type: 'HUNT_WILDLIFE', wyvernId: wyvern.id, prey: 'deer' })
    expect(state.resources.food).toBe(foodBefore + CONFIG.wyvern.huntFood.deer)

    execute(state, { type: 'HUNT_WILDLIFE', wyvernId: wyvern.id, prey: 'bird' })
    expect(state.resources.food).toBe(foodBefore + CONFIG.wyvern.huntFood.deer)
  })

  it('refuses training beyond the slot capacity', () => {
    const state = createInitialState(8)
    const wyvern = Object.values(state.wyverns)[0]!
    // trainingGrounds level 1 == 1 slot
    expect(capacityOf(state, 'trainingGrounds')).toBe(1)
    execute(state, { type: 'ASSIGN_TRAINING', wyvernId: wyvern.id, stationId: 'flightRing' })

    const extraId = 'wy_extra'
    state.wyverns[extraId] = { ...wyvern, id: extraId, assignment: { kind: 'idle' } }
    execute(state, { type: 'ASSIGN_TRAINING', wyvernId: extraId, stationId: 'huntingPen' })
    expect(state.wyverns[extraId]!.assignment.kind).toBe('idle')
  })

  it('hatches an incubated egg into a hatchling and grows it to adult', () => {
    const state = createInitialState(8)
    const eggId = 'egg_test'
    state.eggs[eggId] = {
      id: eggId,
      speciesId: 'cragwing',
      parents: null,
      rolledStats: rollSpeciesStats('cragwing', createRng(1)),
      rolledTraits: [],
      incubatingTicksLeft: null,
    }
    const rosterBefore = Object.keys(state.wyverns).length

    execute(state, { type: 'INCUBATE_EGG', eggId })
    advanceTicks(state, CONFIG.wyvern.incubationTicks + 1)

    expect(state.eggs[eggId]).toBeUndefined()
    expect(Object.keys(state.wyverns).length).toBe(rosterBefore + 1)

    const hatched = Object.values(state.wyverns).find((w) => w.origin === 'hatched')!
    expect(hatched.stage).toBe('hatchling')

    advanceTicks(state, CONFIG.wyvern.hatchlingTicks + CONFIG.wyvern.juvenileTicks + 2)
    expect(hatched.stage).toBe('adult')
  })

  it('produces exactly one egg per breeding pair', () => {
    const state = createInitialState(8)
    const base = Object.values(state.wyverns)[0]!
    base.bond = 90
    const mate = { ...base, id: 'wy_mate', bond: 90, assignment: { kind: 'idle' as const } }
    state.wyverns[mate.id] = mate

    execute(state, { type: 'START_BREEDING', aId: base.id, bId: mate.id })
    expect(base.assignment.kind).toBe('breeding')

    advanceTicks(state, CONFIG.wyvern.breedDuration + 1)
    expect(Object.keys(state.eggs).length).toBe(1)
    expect(base.assignment.kind).toBe('idle')
    expect(state.wyverns[mate.id]!.assignment.kind).toBe('idle')
    expect(base.breedCooldown).toBeGreaterThan(0)
  })

  it('releases the partner when a breeding assignment is cancelled', () => {
    const state = createInitialState(8)
    const base = Object.values(state.wyverns)[0]!
    base.bond = 90
    const mate = { ...base, id: 'wy_mate', bond: 90, assignment: { kind: 'idle' as const } }
    state.wyverns[mate.id] = mate

    execute(state, { type: 'START_BREEDING', aId: base.id, bId: mate.id })
    execute(state, { type: 'CANCEL_ASSIGNMENT', wyvernId: base.id })

    expect(base.assignment.kind).toBe('idle')
    expect(state.wyverns[mate.id]!.assignment.kind).toBe('idle')
  })
})

describe('genetics', () => {
  it('keeps bred stats near the parental mean', () => {
    const rng = createRng(77)
    const a = rollSpeciesStats('frostmaw', rng)
    const b = rollSpeciesStats('frostmaw', rng)

    for (let i = 0; i < 300; i++) {
      const child = breedStats(a, b, rng)
      for (const id of STAT_IDS) {
        const mean = (a[id] + b[id]) / 2
        // spread() is bounded at ±18% of the mean, so this can never blow up.
        expect(child[id]).toBeGreaterThanOrEqual(Math.floor(mean * 0.8))
        expect(child[id]).toBeLessThanOrEqual(Math.ceil(mean * 1.2))
      }
    }
  })

  it('degrades effective stats for hunger, injury and immaturity', () => {
    const state = createInitialState(4)
    const w = Object.values(state.wyverns)[0]!
    const healthy = effectiveStats(w).power

    w.hunger = 95
    expect(effectiveStats(w).power).toBeLessThan(healthy)

    w.hunger = 0
    w.injury = 50
    expect(effectiveStats(w).power).toBeLessThan(healthy)

    w.injury = 0
    w.stage = 'hatchling'
    expect(effectiveStats(w).power).toBeLessThan(healthy)
  })
})

describe('conquest', () => {
  it('only permits attacks adjacent to a held region', () => {
    const state = createInitialState(9)
    expect(isAttackable(state, 'ashfen')).toBe(true)
    expect(isAttackable(state, 'duskspire')).toBe(false)
    expect(isAttackable(state, 'hearthvale')).toBe(false)
  })

  it('backfills missing regions on save deserialization', () => {
    const state = createInitialState(42)
    if (state.regions['ashfen']) {
      state.regions['ashfen'].garrison = []
      state.regions['ashfen'].unrest = 45
    }
    delete (state.regions as Record<string, unknown>)['duskspire']
    expect(state.regions['duskspire']).toBeUndefined()

    const serialized = serialize(state, 1000)
    const loaded = deserialize(serialized, 1000)
    expect(loaded).not.toBeNull()
    const restored = loaded!.state
    expect(restored.regions['duskspire']).toBeDefined()
    expect(restored.regions['duskspire']?.garrison.length).toBeGreaterThan(0)
    expect(restored.regions['ashfen']?.unrest).toBe(45)
    expect(restored.regions['ashfen']?.garrison).toEqual([])
  })

  it('flips a region on an auto-resolved victory and pays out', () => {
    const state = createInitialState(9)
    // Give the player enough force that the first region is a formality.
    state.resources.gold = 9999
    state.resources.timber = 9999
    state.buildings.barracks = 3
    for (let i = 0; i < 3; i++) {
      execute(state, { type: 'RECRUIT_SQUAD', unitId: 'archer', strength: 90 })
    }
    const wyvernIds = Object.keys(state.wyverns)
    const squadIds = Object.keys(state.squads)

    executeNextTick(state, [
      {
        type: 'LAUNCH_ATTACK',
        regionId: 'ashfen',
        wyvernIds,
        squadIds,
        pilotedWyvernId: wyvernIds[0] ?? null,
        mode: 'auto',
      },
    ])

    expect(state.pendingBattle).toBeNull()
    expect(state.lastBattle).not.toBeNull()
    expect(state.lastBattle!.victory).toBe(true)
    expect(state.regions.ashfen!.owner).toBe('player')
    expect(Object.keys(state.eggs).length).toBeGreaterThan(0)
  })

  it('rejects an attack on a non-adjacent region', () => {
    const state = createInitialState(9)
    execute(state, {
      type: 'LAUNCH_ATTACK',
      regionId: 'duskspire',
      wyvernIds: Object.keys(state.wyverns),
      squadIds: [],
      pilotedWyvernId: null,
      mode: 'auto',
    })
    expect(state.pendingBattle).toBeNull()
  })

  it('revolts a held region left ungarrisoned long enough', () => {
    const state = createInitialState(9)
    state.regions.ashfen!.owner = 'player'
    state.regions.ashfen!.unrest = CONFIG.region.revoltAt - 1
    advanceTicks(state, 5)
    expect(state.regions.ashfen!.owner).toBe('enemy')
  })

  it('never lets the home region revolt, so the player cannot be soft-locked', () => {
    const state = createInitialState(9)
    const home = REGION_LIST.find((r) => r.starting)!.id
    // Run far longer than it takes an ordinary region to hit 100 unrest.
    advanceTicks(state, 600)
    expect(state.regions[home]!.owner).toBe('player')
    expect(state.regions[home]!.unrest).toBe(0)
    // And there is always at least one legal attack available.
    expect(Object.keys(REGIONS).some((id) => isAttackable(state, id))).toBe(true)
  })

  it('suppresses unrest with a stationed garrison', () => {
    const state = createInitialState(9)
    state.regions.ashfen!.owner = 'player'
    state.regions.ashfen!.unrest = 50
    state.squads.sq_garrison = {
      id: 'sq_garrison',
      unitId: 'spearman',
      strength: 200,
      stationedAt: 'ashfen',
    }
    state.resources.gold = 99999
    advanceTicks(state, 10)
    expect(state.regions.ashfen!.unrest).toBeLessThan(50)
  })
})

describe('combat sim', () => {
  it('is deterministic for a fixed seed', () => {
    const state = createInitialState(21)
    const setup = {
      regionId: 'ashfen',
      seed: 1337,
      wyvernIds: Object.keys(state.wyverns),
      squadIds: Object.keys(state.squads),
      pilotedWyvernId: null,
      mode: 'auto' as const,
    }
    const config = buildEncounterConfig(state, setup)
    const a = autoResolveConfig(config)
    const b = autoResolveConfig(config)
    expect(a).toEqual(b)
  })

  it('always terminates', () => {
    const state = createInitialState(21)
    for (const regionId of Object.keys(REGIONS)) {
      const config = buildEncounterConfig(state, {
        regionId,
        seed: 5,
        wyvernIds: Object.keys(state.wyverns),
        squadIds: Object.keys(state.squads),
        pilotedWyvernId: null,
        mode: 'auto',
      })
      const result = autoResolveConfig(config)
      expect(result.duration).toBeLessThanOrEqual(CONFIG.battle.maxDuration + 1)
    }
  })

  it('never reports more survivors than a squad started with', () => {
    const state = createInitialState(31)
    state.resources.gold = 9999
    state.buildings.barracks = 3
    execute(state, { type: 'RECRUIT_SQUAD', unitId: 'spearman', strength: 60 })

    const config = buildEncounterConfig(state, {
      regionId: 'greyreach',
      seed: 808,
      wyvernIds: Object.keys(state.wyverns),
      squadIds: Object.keys(state.squads),
      pilotedWyvernId: null,
      mode: 'auto',
    })
    const result = autoResolveConfig(config)
    for (const [id, survivors] of Object.entries(result.squads)) {
      expect(survivors).toBeLessThanOrEqual(state.squads[id]!.strength)
      expect(survivors).toBeGreaterThanOrEqual(0)
    }
  })

  it('melee ground units cannot damage a flying wyvern', () => {
    // Spearmen alone should never beat a wyvern — they cannot reach it.
    const sim = createEncounter({
      regionId: 'ashfen',
      seed: 4,
      attackers: {
        wyverns: [
          {
            sourceId: 'w1',
            speciesId: 'emberback',
            name: 'Test',
            bond: 100,
            stats: { power: 30, speed: 30, stamina: 30, firepower: 30, armor: 20 },
          },
        ],
        squads: [],
      },
      defenders: { wyverns: [], squads: [{ unitId: 'spearman', strength: 200 }] },
      pilotedSourceId: null,
    })
    for (let i = 0; i < 4000 && sim.outcome === 'ongoing'; i++) sim.step(CONFIG.battle.step)

    expect(sim.outcome).toBe('victory')
    expect(sim.result().wyverns.w1!.died).toBe(false)
  })

  it('archers can damage a flying wyvern', () => {
    const sim = createEncounter({
      regionId: 'ashfen',
      seed: 4,
      attackers: {
        wyverns: [
          {
            sourceId: 'w1',
            speciesId: 'emberback',
            name: 'Test',
            bond: 100,
            stats: { power: 10, speed: 20, stamina: 10, firepower: 5, armor: 5 },
          },
        ],
        squads: [],
      },
      defenders: { wyverns: [], squads: [{ unitId: 'archer', strength: 250 }] },
      pilotedSourceId: null,
    })
    for (let i = 0; i < 4000 && sim.outcome === 'ongoing'; i++) sim.step(CONFIG.battle.step)

    expect(sim.result().wyverns.w1!.injury).toBeGreaterThan(0)
  })

  it('low bond causes disobedience', () => {
    // With bond 0 the disobedience roll fires often; over many wyverns at
    // least one should refuse.
    const sim = createEncounter({
      regionId: 'ashfen',
      seed: 12,
      attackers: {
        wyverns: Array.from({ length: 12 }, (_, i) => ({
          sourceId: `w${i}`,
          speciesId: 'emberback',
          name: `T${i}`,
          bond: 0,
          stats: { power: 20, speed: 20, stamina: 20, firepower: 20, armor: 20 },
        })),
        squads: [],
      },
      defenders: { wyverns: [], squads: [{ unitId: 'spearman', strength: 10 }] },
      pilotedSourceId: null,
    })
    expect(sim.actors.some((a) => a.disobedient)).toBe(true)
  })

  it('high bond wyverns obey', () => {
    const sim = createEncounter({
      regionId: 'ashfen',
      seed: 12,
      attackers: {
        wyverns: Array.from({ length: 12 }, (_, i) => ({
          sourceId: `w${i}`,
          speciesId: 'emberback',
          name: `T${i}`,
          bond: 100,
          stats: { power: 20, speed: 20, stamina: 20, firepower: 20, armor: 20 },
        })),
        squads: [],
      },
      defenders: { wyverns: [], squads: [{ unitId: 'spearman', strength: 10 }] },
      pilotedSourceId: null,
    })
    expect(sim.actors.every((a) => !a.disobedient)).toBe(true)
  })
})

describe('save', () => {
  it('round-trips a state unchanged when no time has passed', () => {
    const state = createInitialState(55)
    advanceTicks(state, 12)
    const raw = serialize(state, 1_000_000)
    const loaded = deserialize(raw, 1_000_000)
    expect(loaded).not.toBeNull()
    expect(loaded!.offlineTicks).toBe(0)
    expect(loaded!.state).toEqual(state)
  })

  it('fast-forwards offline time up to the cap', () => {
    const state = createInitialState(55)
    const raw = serialize(state, 0)
    const dayInMs = 1000 * 60 * 60 * 24
    const loaded = deserialize(raw, dayInMs)!
    expect(loaded.offlineTicks).toBe(CONFIG.maxOfflineTicks)
    expect(loaded.state.tick).toBe(CONFIG.maxOfflineTicks)
  })

  it('returns null for malformed data instead of throwing', () => {
    expect(deserialize('not json', 0)).toBeNull()
    expect(deserialize('{}', 0)).toBeNull()
  })

  it('migrates a version 0 save', () => {
    const state = createInitialState(55)
    const old = { ...state, saveVersion: 0 } as GameState
    const migrated = migrate(old)
    expect(migrated.saveVersion).toBe(8)
    expect(migrated.resources.water).toBeDefined()
    expect(migrated.resources.hide).toBeDefined()
    expect(migrated.resources.iron).toBeDefined()
  })

  it('moves untouched legacy sanctuary defaults but preserves edited stations', () => {
    const old = createInitialState(55)
    old.saveVersion = 1

    const huntingPen = old.sanctuaryLayout.objects.find((object) => object.id === 'huntingPen')!
    const flightRing = old.sanctuaryLayout.objects.find((object) => object.id === 'flightRing')!
    huntingPen.position = [-18, 0, 2]
    flightRing.position = [7, 0, 7]

    const migrated = migrate(old)

    expect(migrated.saveVersion).toBe(8)
    expect(huntingPen.position).toEqual([-30, 0, 2])
    expect(flightRing.position).toEqual([7, 0, 7])
  })

  it('processes sanctuary production ticks and worker assignments', () => {
    const state = createInitialState(42)
    const initialWater = state.resources.water
    const initialFood = state.resources.food

    // Execute next tick
    executeNextTick(state)
    expect(state.resources.water).toBeGreaterThan(initialWater)
    expect(state.resources.food).toBeGreaterThan(initialFood)

    // Assign worker to foundry
    executeNextTick(state, [{ type: 'SET_ASSIGNED_WORKERS', buildingId: 'foundry', count: 2 }])
    expect(state.economy.population.assigned.foundry).toBe(2)
  })

  it('handles ruler title, edicts, elemental mastery, and elixir crafting', () => {
    const state = createInitialState(101)

    // Switch title & edict
    executeNextTick(state, [{ type: 'SET_RULER_TITLE', title: 'queen' }])
    expect(state.realm.ruler.title).toBe('queen')

    executeNextTick(state, [{ type: 'SET_RULER_EDICT', edict: 'royal_garrison' }])
    expect(state.realm.ruler.edict).toBe('royal_garrison')

    // Upgrade elemental mastery
    state.resources.arcane = 500
    state.resources.gold = 500
    executeNextTick(state, [{ type: 'UPGRADE_ELEMENTAL_MASTERY', element: 'fire' }])
    expect(state.realm.grandMaster.masteryLevels.fire).toBe(2)

    // Brew & Use Vitality Salve
    state.resources.water = 100
    state.resources.food = 100
    state.resources.arcane = 50
    const wyvernId = Object.keys(state.wyverns)[0]!
    state.wyverns[wyvernId]!.injury = 50

    executeNextTick(state, [{ type: 'BREW_ELIXIR', elixirType: 'vitality_salve' }])
    const countBefore = state.realm.elixirs.vitality_salve
    executeNextTick(state, [{ type: 'USE_ELIXIR', elixirType: 'vitality_salve', wyvernId }])
    expect(state.realm.elixirs.vitality_salve).toBe(countBefore - 1)
    expect(state.wyverns[wyvernId]!.injury).toBeLessThan(10)
  })
})
