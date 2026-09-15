import { describe, expect, it } from 'vitest'
import { createInitialState } from '@/core/state/game'
import { execute } from '@/core/executions'
import { PROP_CATALOG, createDefaultSanctuaryLayout, isPropUnlocked } from '@/core/state/sanctuaryLayout'
import {
  SANCTUARY_STATIONS,
  type SanctuaryStationId,
} from '@/core/data/sanctuaryStations'
import { stableIdHash } from './commandLogic'
import {
  GROUND_RADIUS,
  PERCHES,
  TRAINING_POSTS,
  buildColliders,
  getInteractables,
} from './layout'

describe('Sanctuary layout customization and editor state', () => {
  it('initializes with default sanctuary layout objects and storage', () => {
    const state = createInitialState(12345)
    expect(state.sanctuaryLayout).toBeDefined()
    expect(state.sanctuaryLayout.objects.length).toBeGreaterThan(10)
    expect(state.sanctuaryLayout.storage['prop.torch']).toBeGreaterThan(0)
  })

  it('allows adding an object from storage to the sanctuary', () => {
    const state = createInitialState(12345)
    const initialTorchCount = state.sanctuaryLayout.storage['prop.torch'] ?? 0
    const initialObjCount = state.sanctuaryLayout.objects.length

    execute(state, {
      type: 'ADD_SANCTUARY_OBJECT',
      propId: 'prop.torch',
      position: [10, 0, 10],
      rotationY: 0,
      category: 'utility',
      label: 'Test Torch',
    })

    expect(state.sanctuaryLayout.objects.length).toBe(initialObjCount + 1)
    expect(state.sanctuaryLayout.storage['prop.torch']).toBe(initialTorchCount - 1)

    const added = state.sanctuaryLayout.objects.find((o) => o.label === 'Test Torch')
    expect(added).toBeDefined()
    expect(added?.position).toEqual([10, 0, 10])
  })

  it('allows moving and rotating a placed object', () => {
    const state = createInitialState(12345)
    const targetObj = state.sanctuaryLayout.objects[0]!

    execute(state, {
      type: 'MOVE_SANCTUARY_OBJECT',
      id: targetObj.id,
      position: [15, 0, -15],
      rotationY: 1.5,
    })

    expect(targetObj.position).toEqual([15, 0, -15])
    expect(targetObj.rotationY).toBe(1.5)

    execute(state, {
      type: 'ROTATE_SANCTUARY_OBJECT',
      id: targetObj.id,
      rotationY: 3.14,
    })

    expect(targetObj.rotationY).toBe(3.14)
  })

  it('allows storing a placed object back to storage inventory', () => {
    const state = createInitialState(12345)
    const torchObj = state.sanctuaryLayout.objects.find((o) => o.propId === 'prop.torch')
    expect(torchObj).toBeDefined()

    const initialTorchStorage = state.sanctuaryLayout.storage['prop.torch'] ?? 0

    execute(state, {
      type: 'STORE_SANCTUARY_OBJECT',
      id: torchObj!.id,
    })

    const found = state.sanctuaryLayout.objects.find((o) => o.id === torchObj!.id)
    expect(found).toBeUndefined()
    expect(state.sanctuaryLayout.storage['prop.torch']).toBe(initialTorchStorage + 1)
  })

  it('allows resetting the sanctuary layout to default', () => {
    const state = createInitialState(12345)
    const initialObjCount = state.sanctuaryLayout.objects.length

    // Clear all objects
    state.sanctuaryLayout.objects = []

    execute(state, {
      type: 'RESET_SANCTUARY_LAYOUT',
    })

    expect(state.sanctuaryLayout.objects.length).toBe(initialObjCount)
  })

  it.each([
    ['placing', (state: ReturnType<typeof createInitialState>) => execute(state, {
      type: 'ADD_SANCTUARY_OBJECT', propId: 'prop.torch', position: [10, 0, 10], rotationY: 0, category: 'utility', label: 'Undo Torch',
    })],
    ['moving', (state: ReturnType<typeof createInitialState>) => execute(state, {
      type: 'MOVE_SANCTUARY_OBJECT', id: state.sanctuaryLayout.objects[0]!.id, position: [10, 0, 10], rotationY: 0,
    })],
    ['storing', (state: ReturnType<typeof createInitialState>) => execute(state, {
      type: 'STORE_SANCTUARY_OBJECT', id: state.sanctuaryLayout.objects.find((object) => object.propId === 'prop.torch')!.id,
    })],
    ['resetting', (state: ReturnType<typeof createInitialState>) => execute(state, { type: 'RESET_SANCTUARY_LAYOUT' })],
  ])('restores an exact layout snapshot after %s', (_action, edit) => {
    const state = createInitialState(12345)
    const snapshot = structuredClone(state.sanctuaryLayout)

    edit(state)
    execute(state, { type: 'RESTORE_SANCTUARY_LAYOUT', layout: snapshot })

    expect(state.sanctuaryLayout).toEqual(snapshot)
  })

  it('updates colliders and interactables dynamically when objects are modified', () => {
    const state = createInitialState(12345)
    const initialInteractables = getInteractables(state)
    const initialColliders = buildColliders(state)

    expect(initialInteractables.length).toBeGreaterThan(0)
    expect(initialColliders.length).toBeGreaterThan(0)

    // Add a custom structure
    execute(state, {
      type: 'ADD_SANCTUARY_OBJECT',
      propId: 'prop.forge.furnace',
      position: [40, 0, 40],
      rotationY: 0,
      category: 'structure',
      label: 'Custom Forge',
      interactableId: 'customForge',
      panel: 'training',
      station: 'scaleForge',
      radius: 4,
    })

    const updatedInteractables = getInteractables(state)
    const customInteractable = updatedInteractables.find((i) => i.id === 'customForge')
    expect(customInteractable).toBeDefined()
    expect(customInteractable?.position).toEqual([40, 40])

    const updatedColliders = buildColliders(state)
    const customCollider = updatedColliders.find((c) => c.x === 40 && c.z === 40)
    expect(customCollider).toBeDefined()
  })

  it('keeps the outdoor landmarks spacious and inside the sanctuary rim', () => {
    const outdoor: SanctuaryStationId[] = [
      'hatchery',
      'breeding',
      'huntingPen',
      'flightRing',
      'burnRange',
      'enduranceRun',
      'scaleForge',
    ]

    for (let i = 0; i < outdoor.length; i++) {
      const a = SANCTUARY_STATIONS[outdoor[i]!]
      const radialDistance = Math.hypot(...a.position)
      expect(radialDistance + a.clearance, outdoor[i]).toBeLessThanOrEqual(GROUND_RADIUS)

      for (let j = i + 1; j < outdoor.length; j++) {
        const b = SANCTUARY_STATIONS[outdoor[j]!]
        const distance = Math.hypot(
          a.position[0] - b.position[0],
          a.position[1] - b.position[1],
        )
        expect(distance, `${outdoor[i]} crowds ${outdoor[j]}`).toBeGreaterThanOrEqual(
          a.clearance + b.clearance,
        )
      }
    }
  })

  it('keeps assignment posts clear of their matching training landmarks', () => {
    for (const [id, post] of Object.entries(TRAINING_POSTS)) {
      const station = SANCTUARY_STATIONS[id as SanctuaryStationId]
      const distance = Math.hypot(
        post[0] - station.position[0],
        post[1] - station.position[1],
      )

      expect(distance, `${id} assignment post`).toBeGreaterThanOrEqual(10)
      expect(Math.hypot(...post), `${id} assignment post`).toBeLessThan(GROUND_RADIUS)
    }
  })

  it('places the starter wyvern in the open north-west clearing', () => {
    const starterPerch = PERCHES[stableIdHash('wy_1') % PERCHES.length]!

    expect(starterPerch).toEqual([-38, -22])
    expect(Math.hypot(...starterPerch)).toBeLessThan(GROUND_RADIUS)

    for (const [id, station] of Object.entries(SANCTUARY_STATIONS)) {
      if (id === 'warTable' || id === 'roster' || id === 'barracks' || id === 'infirmary') {
        continue
      }
      const distance = Math.hypot(
        starterPerch[0] - station.position[0],
        starterPerch[1] - station.position[1],
      )
      expect(distance - station.clearance, `starter perch crowds ${id}`).toBeGreaterThan(14)
    }
  })

  it('uses the shared station plan for default interactables', () => {
    const interactables = getInteractables()

    for (const item of interactables) {
      expect(item.position).toEqual(
        SANCTUARY_STATIONS[item.id as SanctuaryStationId].position,
      )
    }
  })
})

describe('Prop catalog completeness', () => {
  /**
   * The editor drawer is built from `Object.values(PROP_CATALOG)`, while
   * `STORE_SANCTUARY_OBJECT` returns any placed object to `layout.storage` by
   * its prop id. A placed prop with no catalog entry can therefore be stored
   * but never re-placed — the player loses it permanently, with no card to drag
   * back out. Three forge props shipped that way.
   */
  it('has a catalog entry for every prop placed by default', () => {
    const { objects } = createDefaultSanctuaryLayout()
    const missing = objects
      .map((object) => object.propId)
      .filter((propId) => !PROP_CATALOG[propId])
    expect(missing).toEqual([])
  })

  it('has a catalog entry for every prop stocked in storage', () => {
    const { storage } = createDefaultSanctuaryLayout()
    const missing = Object.keys(storage).filter((propId) => !PROP_CATALOG[propId])
    expect(missing).toEqual([])
  })

  it('evaluates isPropUnlocked correctly and preserves backward compatibility', () => {
    // Unlocked without requirement
    expect(isPropUnlocked('prop.torch', 0)).toBe(true)

    // Milestone prop locked when duties below threshold
    expect(isPropUnlocked('prop.perch.trunk', 0)).toBe(false)
    expect(isPropUnlocked('prop.perch.trunk', 2)).toBe(false)

    // Unlocked when duties meet threshold
    expect(isPropUnlocked('prop.perch.trunk', 3)).toBe(true)
    expect(isPropUnlocked('prop.perch.trunk', 5)).toBe(true)

    // Backward compatibility: unlocked if in storage
    expect(isPropUnlocked('prop.perch.trunk', 0, { 'prop.perch.trunk': 1 })).toBe(true)

    // Backward compatibility: unlocked if placed in scene
    expect(
      isPropUnlocked('prop.perch.trunk', 0, {}, [
        {
          id: 'test_obj',
          propId: 'prop.perch.trunk',
          position: [0, 0, 0],
          rotationY: 0,
          category: 'scenery',
          label: 'Test Trunk',
        },
      ]),
    ).toBe(true)
  })
})

describe('Stage 7: PropCatalog grouping and flight clearance contracts', () => {
  const KNOWN_GROUPS = new Set(['forge', 'perch', 'ring', 'burn', 'roost', 'fence', 'path'])

  it('all group values in PROP_CATALOG use known group IDs', () => {
    for (const [propId, entry] of Object.entries(PROP_CATALOG)) {
      if (entry.group !== undefined) {
        expect(
          KNOWN_GROUPS.has(entry.group),
          `"${propId}" has unknown group "${entry.group}"`,
        ).toBe(true)
      }
    }
  })

  it('forge props all belong to the forge group', () => {
    const forgeProps = ['prop.forge.anvil', 'prop.forge.trough', 'prop.forge.grindstone']
    for (const propId of forgeProps) {
      expect(PROP_CATALOG[propId]?.group).toBe('forge')
    }
  })

  it('perch variants all belong to the perch group', () => {
    const perchProps = ['prop.perch.stump', 'prop.perch.rockA', 'prop.perch.rockB', 'prop.perch.trunk']
    for (const propId of perchProps) {
      expect(PROP_CATALOG[propId]?.group).toBe('perch')
    }
  })

  it('props with flightClearanceRequired are not in the corridor in the default layout', () => {
    // isInsideFlightCorridor uses FLIGHT_CORRIDOR_BOX = [-16, -12, 16, 28]
    const flightClearanceProps = Object.values(PROP_CATALOG).filter((e) => e.flightClearanceRequired)
    expect(flightClearanceProps.length).toBeGreaterThan(0)

    const layout = createDefaultSanctuaryLayout()
    for (const entry of flightClearanceProps) {
      const placed = layout.objects.filter((o) => o.propId === entry.propId)
      for (const obj of placed) {
        const [x, , z] = obj.position
        // Flight corridor box: x in [-16, 16], z in [-12, 28]
        const insideCorridor = x >= -16 && x <= 16 && z >= -12 && z <= 28
        expect(
          insideCorridor,
          `"${entry.propId}" (id: ${obj.id}) at [${x}, ${z}] is inside the flight corridor`,
        ).toBe(false)
      }
    }
  })
})

