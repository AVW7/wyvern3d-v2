import { describe, expect, it } from 'vitest'
import type { AssetEntry } from '@/render/assets/manifest'
import { ASSETS } from '@/render/assets/manifest'
import {
  MODEL_LIBRARY_ENTRIES,
  animationDetails,
  categoryFor,
  filterModels,
  formatBytes,
  modelCounts,
  payloadUrls,
  resolveLinkedState,
  resolveModelState,
  resolveModelId,
  statesFor,
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

  it('derives preview states from the manifest and falls back predictably', () => {
    const thornwing = ASSETS['wyvern.thornwing']!
    expect(statesFor(thornwing)[0]).toBe('idle')
    expect(resolveModelState(thornwing, 'cruise')).toBe('cruise')
    // A state this model does not map resolves to its first mapped state.
    expect(resolveModelState(thornwing, 'idle' as never)).toBe('idle')
    expect(resolveModelState(thornwing, undefined)).toBe('idle')
    // No animation map at all: GameModel's own default state applies.
    expect(resolveModelState({ url: null, scale: 1, animations: {} }, undefined)).toBe('idle')
    const guineafowl = ASSETS['wildlife.guineafowl']!
    expect(resolveModelState(guineafowl, 'fly')).toBe('fly')
    expect(resolveModelState(guineafowl, 'sleep' as never)).toBe('idle')
  })

  it('keeps ?state= links honest: kept when mapped, dropped when not', () => {
    const soldier = ASSETS['unit.soldier']!
    expect(resolveLinkedState(soldier, 'walk')).toBe('walk')
    expect(resolveLinkedState(soldier, ['walk', 'idle'])).toBe('walk')
    // A stale link to a state this model does not map is dropped, not
    // substituted — the model still loads, at its own default state.
    expect(resolveLinkedState(soldier, 'groom' as never)).toBeUndefined()
    expect(resolveLinkedState(soldier, undefined)).toBeUndefined()
  })

  it('lists every file GameModel will fetch for a payload HEAD', () => {
    expect(payloadUrls({ url: null, scale: 1, animations: {} })).toEqual([])
    expect(payloadUrls({ url: '/models/a.glb', scale: 1, animations: {} })).toEqual(['/models/a.glb'])
    expect(payloadUrls({
      url: '/models/a.glb',
      animationUrl: '/models/a-anims.glb',
      scale: 1,
      animations: {},
    })).toEqual(['/models/a.glb', '/models/a-anims.glb'])
    expect(payloadUrls(ASSETS['character.player']!)).toEqual([
      '/models/arcane-handler.glb',
      '/models/arcane-handler-animations/idle.glb',
      '/models/arcane-handler-animations/walk.glb',
      '/models/arcane-handler-animations/run.glb',
      '/models/arcane-handler-animations/offer.glb',
      '/models/arcane-handler-animations/pet.glb',
      '/models/arcane-handler-animations/calm.glb',
      '/models/arcane-handler-animations/inspect.glb',
    ])
  })

  it('formats payload sizes across unit boundaries', () => {
    expect(formatBytes(0)).toBe('—')
    expect(formatBytes(Number.NaN)).toBe('—')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB')
    expect(formatBytes(23_685_740)).toBe('22.6 MB')
    expect(formatBytes(1024 ** 3)).toBe('1.0 GB')
  })
})
