import type { BattleResult, BuildingId, SanctuaryLayoutState } from '../types'

/**
 * The complete player action surface.
 *
 * UI and input never touch state directly — they emit one of these, and the
 * tick converts it into an Execution. That indirection is what makes the whole
 * session replayable from `(seed, intentLog)` and what a server would slot into
 * if this ever goes multiplayer.
 */
export type Intent =
  | { type: 'ASSIGN_TRAINING'; wyvernId: string; stationId: string }
  | { type: 'CANCEL_ASSIGNMENT'; wyvernId: string }
  | { type: 'GARRISON_WYVERN'; wyvernId: string; regionId: string | null }
  | { type: 'COLLECT_REGION_EGGS'; regionId: string }
  | { type: 'START_BREEDING'; aId: string; bId: string }
  | { type: 'INCUBATE_EGG'; eggId: string }
  | { type: 'FEED_WYVERN'; wyvernId: string }
  | { type: 'HUNT_WILDLIFE'; wyvernId: string; prey: 'deer' | 'bird' }
  | { type: 'SET_WYVERN_PERCH'; wyvernId: string; perchIndex: number }
  | { type: 'RENAME_WYVERN'; wyvernId: string; name: string }
  | { type: 'RELEASE_WYVERN'; wyvernId: string }
  | { type: 'RECRUIT_SQUAD'; unitId: string; strength: number }
  | { type: 'DISBAND_SQUAD'; squadId: string }
  | { type: 'STATION_SQUAD'; squadId: string; regionId: string | null }
  | { type: 'UPGRADE_BUILDING'; buildingId: BuildingId }
  | { type: 'SET_ASSIGNED_WORKERS'; buildingId: BuildingId; count: number }
  | { type: 'SET_RULER_TITLE'; title: 'king' | 'queen' }
  | { type: 'SET_RULER_EDICT'; edict: 'conquest_harvest' | 'royal_garrison' | 'dragon_harmony' | 'grand_taxation' }
  | { type: 'UPGRADE_ELEMENTAL_MASTERY'; element: 'fire' | 'water' | 'earth' | 'air' }
  | { type: 'RESEARCH_PHILOSOPHY'; philosophyId: 'balance' | 'dominion' | 'stoicism' | 'hermetics' }
  | { type: 'CRAFT_EQUIPMENT'; equipmentType: 'wyvern_armor' | 'flame_spears' | 'iron_shields' }
  | { type: 'BREW_ELIXIR'; elixirType: 'vitality_salve' | 'dragon_tonic' | 'growth_elixir' }
  | { type: 'USE_ELIXIR'; elixirType: 'vitality_salve' | 'dragon_tonic' | 'growth_elixir'; wyvernId: string }
  | { type: 'RECORD_REGION_VISIT'; regionId: string }
  | { type: 'DISCOVER_LANDMARK'; regionId: string; landmarkId: string }
  | { type: 'OBSERVE_PHENOMENON'; regionId: string; phenomenonId: string }
  | { type: 'TAKE_DUTY_ITEM'; dutyId: number }
  | { type: 'ABANDON_DUTY_ITEM'; dutyId: number }
  | { type: 'COMPLETE_DUTY'; dutyId: number }
  | {
      type: 'LAUNCH_ATTACK'
      regionId: string
      wyvernIds: string[]
      squadIds: string[]
      pilotedWyvernId: string | null
      mode: 'play' | 'auto'
    }
  | { type: 'RESOLVE_BATTLE'; result: BattleResult }
  | { type: 'ABORT_BATTLE' }
  | {
      type: 'ADD_SANCTUARY_OBJECT'
      propId: string
      position: [number, number, number]
      rotationY: number
      scale?: number
      category: 'structure' | 'scenery' | 'furniture' | 'utility'
      label: string
      interactableId?: string
      station?: string
      panel?: string
      radius?: number
    }
  | {
      type: 'MOVE_SANCTUARY_OBJECT'
      id: string
      position: [number, number, number]
      rotationY?: number
    }
  | {
      type: 'ROTATE_SANCTUARY_OBJECT'
      id: string
      rotationY: number
    }
  | {
      type: 'STORE_SANCTUARY_OBJECT'
      id: string
    }
  | {
      type: 'RESET_SANCTUARY_LAYOUT'
    }
  | {
      /** Restores a captured editor snapshot. Kept serializable for replay. */
      type: 'RESTORE_SANCTUARY_LAYOUT'
      layout: SanctuaryLayoutState
    }

/** A recorded session: replaying these against `seed` reproduces it exactly. */
export interface IntentLog {
  seed: number
  entries: { tick: number; intent: Intent }[]
}
