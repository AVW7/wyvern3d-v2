import { describe, expect, it } from 'vitest'
import type { AssetEntry } from '@/render/assets/manifest'
import {
  MODEL_LIBRARY_ENTRIES,
  animationDetails,
  categoryFor,
  filterModels,
  modelCounts,
  resolveModelId,
  statusFor,
  stepSelection,
} from './catalog'

describe('Model Library catalog helpers', () => {
  it('derives contributor-facing categories', () => {
    expect(categoryFor('character.player')).toBe('Player')
    expect(categoryFor('library.throneOfBooks')).toBe('Imported')
    expect(categoryFor('wyvern.emberback')).toBe('Wyvern')
  })

  it('filters by query, status, and category while keeping every manifest entry discoverable', () => {
    expect(filterModels(MODEL_LIBRARY_ENTRIES, '', 'all', 'all')).toHaveLength(MODEL_LIBRARY_ENTRIES.length)
    expect(filterModels(MODEL_LIBRARY_ENTRIES, 'frost', 'all', 'all').map((entry) => entry.id)).toEqual(['wyvern.frostmaw'])
    expect(filterModels(MODEL_LIBRARY_ENTRIES, '', 'pending', 'Unit')).toHaveLength(4)
    expect(filterModels(MODEL_LIBRARY_ENTRIES, 'does-not-exist', 'all', 'all')).toEqual([])
  })

  it('counts readiness and categories', () => {
    const counts = modelCounts(MODEL_LIBRARY_ENTRIES)
    expect(counts.total).toBe(MODEL_LIBRARY_ENTRIES.length)
    expect(counts.ready + counts.pending).toBe(counts.total)
    // Five playable species, Thornwing, Drogon V1, and the gothic-wing rebuild candidate
    // that Flight Lab renders. The candidate is a real library entry, not a
    // fixture: it has a shipped GLB and its own manifest id.
    expect(counts.categories.Wyvern).toBe(8)
    expect(MODEL_LIBRARY_ENTRIES.find((entry) => entry.id === 'wyvern.thornwing')?.label).toBe('Thornwing')
  })

  it('validates deep-linked ids and falls back safely', () => {
    expect(resolveModelId('wyvern.emberback')).toBe('wyvern.emberback')
    expect(resolveModelId(['library.throneOfBooks', 'unit.archer'])).toBe('library.throneOfBooks')
    expect(resolveModelId('not.real')).toBe('character.player')
    expect(resolveModelId(undefined)).toBe('character.player')
  })

  it('formats single and pooled clip metadata', () => {
    expect(animationDetails('fly', { clip: 'takeoff', loop: false, next: 'airborne', fadeIn: 0.2, yOffset: 0 }).clips)
      .toEqual(['takeoff · one-shot · next: airborne · fade: 0.2s · offset: 0'])
    expect(animationDetails('idle', [
      { clip: 'idle-a', phaseGroup: 'rest' },
      { clip: 'idle-b', timeScale: 0.8 },
    ]).clips).toEqual([
      'idle-a · loop · phase: rest',
      'idle-b · loop · speed: 0.8×',
    ])
  })

  it('steps the selection through the visible list and clamps at both ends', () => {
    const visible = MODEL_LIBRARY_ENTRIES.slice(0, 3)
    expect(stepSelection(visible, visible[0]!.id, 1)).toBe(visible[1]!.id)
    expect(stepSelection(visible, visible[2]!.id, -1)).toBe(visible[1]!.id)
    expect(stepSelection(visible, visible[0]!.id, -1)).toBe(visible[0]!.id)
    expect(stepSelection(visible, visible[2]!.id, 1)).toBe(visible[2]!.id)
    expect(stepSelection(visible, visible[0]!.id, 99)).toBe(visible[2]!.id)
  })

  it('falls back to an end of the list when the selection is filtered out', () => {
    const visible = MODEL_LIBRARY_ENTRIES.slice(0, 3)
    expect(stepSelection(visible, 'not.real' as never, 1)).toBe(visible[0]!.id)
    expect(stepSelection(visible, 'not.real' as never, -1)).toBe(visible[2]!.id)
    expect(stepSelection([], 'wyvern.emberback', 1)).toBe('wyvern.emberback')
  })

  it('distinguishes production, disabled, and placeholder entries', () => {
    const ready = { url: '/model.glb', scale: 1, animations: {} } satisfies AssetEntry
    const pending = { url: null, scale: 1, animations: {} } satisfies AssetEntry
    expect(statusFor(ready, false)).toBe('ready')
    expect(statusFor(ready, true)).toBe('disabled')
    expect(statusFor(pending, false)).toBe('pending')
  })
})
