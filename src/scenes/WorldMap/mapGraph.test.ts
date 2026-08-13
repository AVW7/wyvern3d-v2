import { describe, expect, it } from 'vitest'
import { createInitialState } from '../../core/state/game'
import { buildMapGraph, mapSignature, pathToRegion } from './mapGraph'

describe('mapGraph', () => {
  it('builds 51 unique undirected edges from 22 regions', () => {
    const state = createInitialState(1)
    const { nodes, edges } = buildMapGraph(state)
    expect(Object.keys(nodes).length).toBe(22)
    expect(edges.length).toBe(51)
  })

  it('reads live garrison state instead of static definition', () => {
    const state = createInitialState(1)
    if (state.regions['ashfen']) {
      state.regions['ashfen'].garrison = []
    }
    const graph = buildMapGraph(state)
    expect(graph.nodes['ashfen']?.garrison).toEqual([])
    expect(graph.nodes['ashfen']?.garrisonStrength).toBe(0)
  })

  it('mapSignature is stable across no-op tick and changes on conquest/mutation', () => {
    const state = createInitialState(1)
    const sig1 = mapSignature(state)
    const sig2 = mapSignature(state)
    expect(sig1).toBe(sig2)

    if (state.regions['ashfen']) {
      state.regions['ashfen'].owner = 'player'
    }
    const sig3 = mapSignature(state)
    expect(sig1).not.toBe(sig3)
  })

  it('pathToRegion finds shortest path to target region', () => {
    const state = createInitialState(1)
    const path = pathToRegion(state, 'duskspire')
    expect(path).not.toBeNull()
    expect(path![0]).toBe('hearthvale')
    expect(path![path!.length - 1]).toBe('duskspire')
  })
})
