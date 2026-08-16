import { describe, expect, it } from 'vitest'
import { createInitialState } from '@/core/state/game'
import { resolveContextAction } from './context/actionResolver'
import type { Interactable } from './layout'

describe('Stage 6: Interaction-Ready Prop Vertical Slices', () => {
  const dummyInteractables: Interactable[] = [
    { id: 'warTable', label: 'War Table', panel: 'warTable', position: [0, -26], radius: 3.5 },
  ]

  it('resolves interactive quenching trough affordance when near forge trough', () => {
    const state = createInitialState(42)
    // Trough placed at [30.3, 0, -11.3] in default layout
    const action = resolveContextAction({
      playerPosition: [30.3, -11.3],
      state,
      interactables: dummyInteractables,
      wyvernPositions: {},
    })

    expect(action).not.toBeNull()
    expect(action?.priority).toBe('interactiveProp')
    expect(action?.label).toBe('Inspect Quenching Basin')
    expect(action?.panel).toBe('training')
    expect(action?.station).toBe('scaleForge')
  })

  it('resolves interactive anvil affordance when near forge anvil', () => {
    const state = createInitialState(42)
    // Anvil placed at [32, 0, -10.9] in default layout
    const action = resolveContextAction({
      playerPosition: [32, -10.9],
      state,
      interactables: dummyInteractables,
      wyvernPositions: {},
    })

    expect(action).not.toBeNull()
    expect(action?.priority).toBe('interactiveProp')
    expect(action?.label).toBe('Use Smithing Anvil')
    expect(action?.panel).toBe('training')
    expect(action?.station).toBe('scaleForge')
  })

  it('resolves interactive infirmary hearth affordance when near infirmary campfire', () => {
    const state = createInitialState(42)
    // Campfire placed in default layout
    const campfireObj = state.sanctuaryLayout.objects.find((o) => o.propId === 'prop.campfire')!
    expect(campfireObj).toBeDefined()

    const action = resolveContextAction({
      playerPosition: [campfireObj.position[0], campfireObj.position[2]],
      state,
      interactables: dummyInteractables,
      wyvernPositions: {},
    })

    expect(action).not.toBeNull()
    expect(action?.priority).toBe('interactiveProp')
    expect(action?.label).toBe('Rest at Infirmary Hearth')
    expect(action?.panel).toBe('infirmary')
  })

  it('resolves interactive hatchery nest affordance when near hatchery brood cave', () => {
    const state = createInitialState(42)
    const caveObj = state.sanctuaryLayout.objects.find((o) => o.propId === 'prop.hatchery.cave')!
    expect(caveObj).toBeDefined()

    const action = resolveContextAction({
      playerPosition: [caveObj.position[0], caveObj.position[2]],
      state,
      interactables: dummyInteractables,
      wyvernPositions: {},
    })

    expect(action).not.toBeNull()
    expect(action?.priority).toBe('interactiveProp')
    expect(action?.label).toBe('Tend Hatchery Nest')
    expect(action?.panel).toBe('hatchery')
  })

  it('preserves higher priority for active duty delivery over interactive prop affordance', () => {
    const state = createInitialState(42)
    const wyvern = Object.values(state.wyverns)[0]!
    state.duties.active = [
      {
        id: 99,
        kind: 'feed',
        subjectId: wyvern.id,
        status: 'carrying',
        createdTick: 1,
      },
    ]
    state.duties.carriedDutyId = 99

    // Position player next to both an anvil and the wyvern
    const action = resolveContextAction({
      playerPosition: [32, -10.9],
      state,
      interactables: dummyInteractables,
      wyvernPositions: { [wyvern.id]: [32, -10.9] },
    })

    expect(action).not.toBeNull()
    expect(action?.priority).toBe('delivery')
    expect(action?.label).toBe(`Feed ${wyvern.name}`)
  })
})
