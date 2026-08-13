import { describe, expect, it } from 'vitest'
import { createInitialState } from '@/core/state/game'
import type { SanctuaryPlacedObject } from '@/core/types'
import {
  FIRE_SPECS,
  emissiveFor,
  fireSourcesFor,
  isFireProp,
  selectLitSources,
} from './fireSources'

function fire(id: string, propId: string, x: number, z: number, scale?: number): SanctuaryPlacedObject {
  return {
    id,
    propId,
    position: [x, 0, z],
    rotationY: 0,
    category: 'utility',
    label: id,
    ...(scale === undefined ? {} : { scale }),
  } as SanctuaryPlacedObject
}

describe('sanctuary fire sources', () => {
  it('finds the fires in the shipped default layout', () => {
    const state = createInitialState(4242)
    const sources = fireSourcesFor(state.sanctuaryLayout.objects)
    // Four torches, the infirmary campfire, the forge furnace and the volcano.
    expect(sources.length).toBeGreaterThanOrEqual(6)
    expect(sources.some((s) => s.propId === 'prop.torch')).toBe(true)
    expect(sources.some((s) => s.propId === 'prop.campfire')).toBe(true)
    expect(sources.some((s) => s.propId === 'prop.forge.furnace')).toBe(true)
  })

  it('lifts the flame to the measured height of its prop', () => {
    // Every atlas prop rests on y=0, so the flame offset is the prop's height.
    const [torch] = fireSourcesFor([fire('t', 'prop.torch', 0, 0)])
    expect(torch!.position[1]).toBeCloseTo(FIRE_SPECS['prop.torch']!.height)
  })

  it('scales the flame height with the object scale', () => {
    const [volcano] = fireSourcesFor([fire('v', 'prop.burn.volcano', 0, 0, 0.8)])
    expect(volcano!.position[1]).toBeCloseTo(FIRE_SPECS['prop.burn.volcano']!.height * 0.8)
  })

  it('ignores props that are not fires', () => {
    expect(fireSourcesFor([fire('c', 'prop.crate', 0, 0)])).toEqual([])
    expect(isFireProp('prop.crate')).toBe(false)
    expect(isFireProp('prop.torch')).toBe(true)
    expect(emissiveFor('prop.crate')).toBeUndefined()
    expect(emissiveFor('prop.torch')).toBeDefined()
  })

  it('never exceeds the light budget however many fires are placed', () => {
    // The editor stocks six spare torches and four lava stones on top of the
    // six default fires; the shader cost is what makes this a hard ceiling.
    const many = Array.from({ length: 16 }, (_, i) => fire(`t${i}`, 'prop.torch', i * 3, 0))
    const sources = fireSourcesFor(many)
    expect(sources).toHaveLength(16)
    expect(selectLitSources(sources, [0, 0], 4)).toHaveLength(4)
    expect(selectLitSources(sources, [0, 0], 0)).toHaveLength(0)
  })

  it('lights the fires nearest the player', () => {
    const sources = fireSourcesFor([
      fire('far', 'prop.torch', 50, 0),
      fire('near', 'prop.torch', 2, 0),
      fire('mid', 'prop.torch', 20, 0),
    ])
    expect(selectLitSources(sources, [0, 0], 2).map((s) => s.id)).toEqual(['near', 'mid'])
    // And it follows the player rather than being fixed.
    expect(selectLitSources(sources, [50, 0], 1).map((s) => s.id)).toEqual(['far'])
  })

  it('breaks ties deterministically so a light cannot flicker between two fires', () => {
    const sources = fireSourcesFor([
      fire('b', 'prop.torch', 10, 0),
      fire('a', 'prop.torch', -10, 0),
    ])
    expect(selectLitSources(sources, [0, 0], 1).map((s) => s.id)).toEqual(['a'])
    expect(selectLitSources(sources.slice().reverse(), [0, 0], 1).map((s) => s.id)).toEqual(['a'])
  })

  it('returns a stable emissive object so the material cache is not thrashed', () => {
    expect(emissiveFor('prop.torch')).toBe(emissiveFor('prop.torch'))
  })
})
