import { describe, expect, it } from 'vitest'
import { REGION_LIST } from './data/regions'
import { PHENOMENA, getRegionPhenomenon, isPhenomenonOfRegion } from './data/phenomena'
import { createInitialState } from './state/game'
import { execute } from './executions'
import { getObservedPhenomena, getRegionKnowledge } from './state/atlasKnowledge'

describe('phenomena data', () => {
  it('covers every biome used by any region', () => {
    const biomes = new Set(REGION_LIST.map((r) => r.biome))
    const covered = new Set(PHENOMENA.flatMap((p) => p.biomes))
    for (const biome of biomes) {
      expect(covered.has(biome), `biome ${biome} has no phenomenon`).toBe(true)
    }
  })

  it('has unique ids and valid vocabularies', () => {
    const ids = new Set(PHENOMENA.map((p) => p.id))
    expect(ids.size).toBe(PHENOMENA.length)
    const kinds = new Set(['migration', 'speciesSign', 'vista', 'timed'])
    const ambients = new Set(['birds', 'fireflies', 'spores', 'embers', 'crystalPulses', 'fish', 'deer'])
    for (const p of PHENOMENA) {
      expect(kinds.has(p.kind)).toBe(true)
      expect(ambients.has(p.ambient)).toBe(true)
      expect(p.name.length).toBeGreaterThan(3)
      expect(p.description.length).toBeGreaterThan(15)
      expect(p.biomes.length).toBeGreaterThan(0)
    }
  })

  it('assigns exactly one phenomenon per region', () => {
    for (const def of REGION_LIST) {
      const p = getRegionPhenomenon(def.id)
      expect(p, def.id).not.toBeNull()
      expect(p!.biomes).toContain(def.biome)
    }
  })

  it('validates region ownership', () => {
    expect(isPhenomenonOfRegion('hearthvale', getRegionPhenomenon('hearthvale')!.id)).toBe(true)
    // valley phenomenon does not belong to a coast region
    expect(isPhenomenonOfRegion('sunkenreach', getRegionPhenomenon('hearthvale')!.id)).toBe(false)
  })
})

describe('OBSERVE_PHENOMENON execution', () => {
  it('records observation, emits one event, and is idempotent', () => {
    const state = createInitialState(42)
    const before = state.events.length

    const phenomenon = getRegionPhenomenon('hearthvale')!
    execute(state, { type: 'OBSERVE_PHENOMENON', regionId: 'hearthvale', phenomenonId: phenomenon.id })

    expect(getObservedPhenomena(state, 'hearthvale').map((p) => p.id)).toEqual([phenomenon.id])
    expect(state.events.length).toBe(before + 1)
    const event = state.events[state.events.length - 1]!
    expect(event.kind).toBe('phenomenon_observed')
    expect(event.subjectId).toBe('hearthvale')
    expect(event.objectId).toBe(phenomenon.id)

    const countAfterFirst = state.events.length
    execute(state, { type: 'OBSERVE_PHENOMENON', regionId: 'hearthvale', phenomenonId: phenomenon.id })
    expect(state.events.length).toBe(countAfterFirst)
    expect(getRegionKnowledge(state, 'hearthvale')!.observedPhenomenonIds).toEqual([phenomenon.id])
  })

  it('rejects a phenomenon that belongs to another biome', () => {
    const state = createInitialState(42)
    const before = state.events.length
    const wrong = getRegionPhenomenon('sunkenreach')! // coast
    execute(state, { type: 'OBSERVE_PHENOMENON', regionId: 'hearthvale', phenomenonId: wrong.id })
    expect(state.events.length).toBe(before)
    expect(getObservedPhenomena(state, 'hearthvale')).toEqual([])
  })

  it('rejects invalid ids and regions', () => {
    const state = createInitialState(42)
    const before = state.events.length
    execute(state, { type: 'OBSERVE_PHENOMENON', regionId: 'fake', phenomenonId: 'phenomenon.valley_lark_migration' })
    execute(state, { type: 'OBSERVE_PHENOMENON', regionId: 'hearthvale', phenomenonId: 'nonsense' })
    expect(state.events.length).toBe(before)
  })

  it('marks the region visited and does not consume rng or nextId', () => {
    const state = createInitialState(42)
    const rngBefore = state.rngState
    const nextIdBefore = state.nextId

    const phenomenon = getRegionPhenomenon('greyreach')!
    execute(state, { type: 'RECORD_REGION_VISIT', regionId: 'greyreach' })
    execute(state, { type: 'OBSERVE_PHENOMENON', regionId: 'greyreach', phenomenonId: phenomenon.id })

    expect(getRegionKnowledge(state, 'greyreach')!.visited).toBe(true)
    expect(state.rngState).toBe(rngBefore)
    expect(state.nextId).toBe(nextIdBefore)
  })

  it('grants no resources', () => {
    const state = createInitialState(42)
    const before = { ...state.resources }
    const phenomenon = getRegionPhenomenon('hearthvale')!
    execute(state, { type: 'OBSERVE_PHENOMENON', regionId: 'hearthvale', phenomenonId: phenomenon.id })
    expect(state.resources).toEqual(before)
  })

  it('backfills the field on pre-Stage-4 knowledge records', () => {
    const state = createInitialState(42)
    const knowledge = state.atlasKnowledge.hearthvale!
    delete (knowledge as { observedPhenomenonIds?: string[] }).observedPhenomenonIds

    const phenomenon = getRegionPhenomenon('hearthvale')!
    execute(state, { type: 'OBSERVE_PHENOMENON', regionId: 'hearthvale', phenomenonId: phenomenon.id })
    expect(knowledge.observedPhenomenonIds).toEqual([phenomenon.id])
  })
})
