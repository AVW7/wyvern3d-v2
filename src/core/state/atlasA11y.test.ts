import { describe, expect, it } from 'vitest'
import { createInitialState } from './game'
import { STARTING_REGION } from '../data/regions'
import {
  ATLAS_NARROW_BREAKPOINT,
  MIN_TOUCH_TARGET_PX,
  atlasLayoutMode,
  atlasSelectionSummary,
  isTouchAdequate,
  legendShapeCue,
  stepAtlasListIndex,
} from './atlasA11y'

describe('legendShapeCue', () => {
  it('is index-stable and wraps without collision inside one legend', () => {
    expect(legendShapeCue(0)).toBe('●')
    expect(legendShapeCue(0)).toBe(legendShapeCue(8)) // wraps
    // Distinct for the longest legend (5 items) — the real usage.
    const cues = [0, 1, 2, 3, 4].map(legendShapeCue)
    expect(new Set(cues).size).toBe(5)
  })

  it('never returns an empty cue', () => {
    expect(legendShapeCue(-3).length).toBeGreaterThan(0)
    expect(legendShapeCue(100).length).toBeGreaterThan(0)
  })
})

describe('atlasSelectionSummary', () => {
  it('summarizes a mapped, visited region with layer value and landmarks', () => {
    const state = createInitialState(42)
    const summary = atlasSelectionSummary(state, STARTING_REGION, 'political')
    expect(summary).toContain('Hearthvale')
    expect(summary).toContain('Tier 0')
    expect(summary).toContain('Visited')
  })

  it('includes the layer display value when known', () => {
    const state = createInitialState(42)
    const summary = atlasSelectionSummary(state, STARTING_REGION, 'yields')
    expect(summary).toContain('Yields')
  })

  it('reports unmapped regions honestly', () => {
    const state = createInitialState(42)
    const summary = atlasSelectionSummary(state, 'duskspire', 'political')
    expect(summary).toContain('Unmapped')
  })

  it('returns null for unknown region ids', () => {
    const state = createInitialState(42)
    expect(atlasSelectionSummary(state, 'fake_region', 'political')).toBeNull()
  })

  it('differs between layers for the same region', () => {
    const state = createInitialState(42)
    const political = atlasSelectionSummary(state, STARTING_REGION, 'political')
    const garrison = atlasSelectionSummary(state, STARTING_REGION, 'garrison')
    expect(political).not.toBe(garrison)
  })
})

describe('stepAtlasListIndex', () => {
  it('moves with arrows and jumps with Home/End', () => {
    expect(stepAtlasListIndex(10, 0, 'ArrowDown')).toBe(1)
    expect(stepAtlasListIndex(10, 1, 'ArrowUp')).toBe(0)
    expect(stepAtlasListIndex(10, 4, 'Home')).toBe(0)
    expect(stepAtlasListIndex(10, 4, 'End')).toBe(9)
  })

  it('clamps at the ends and to the list bounds', () => {
    expect(stepAtlasListIndex(10, 9, 'ArrowDown')).toBe(9)
    expect(stepAtlasListIndex(10, 0, 'ArrowUp')).toBe(0)
    expect(stepAtlasListIndex(3, 99, 'ArrowDown')).toBe(2)
  })

  it('ignores non-navigation keys', () => {
    expect(stepAtlasListIndex(10, 4, 'Enter')).toBeNull()
    expect(stepAtlasListIndex(10, 4, 'a')).toBeNull()
  })

  it('returns null for an empty list', () => {
    expect(stepAtlasListIndex(0, 0, 'ArrowDown')).toBeNull()
  })
})

describe('atlasLayoutMode', () => {
  it('matches the CSS narrow breakpoint exactly', () => {
    expect(atlasLayoutMode(ATLAS_NARROW_BREAKPOINT)).toBe('narrow')
    expect(atlasLayoutMode(ATLAS_NARROW_BREAKPOINT + 1)).toBe('standard')
    expect(atlasLayoutMode(390)).toBe('narrow')
    expect(atlasLayoutMode(1440)).toBe('standard')
  })
})

describe('isTouchAdequate', () => {
  it('accepts 44px and above, rejects smaller', () => {
    expect(isTouchAdequate(MIN_TOUCH_TARGET_PX)).toBe(true)
    expect(isTouchAdequate(MIN_TOUCH_TARGET_PX - 1)).toBe(false)
  })
})
