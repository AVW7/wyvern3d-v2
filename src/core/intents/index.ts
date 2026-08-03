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

export type IntentType = Intent['type']

/** A recorded session: replaying these against `seed` reproduces it exactly. */
export interface IntentLog {
  seed: number
  entries: { tick: number; intent: Intent }[]
}
