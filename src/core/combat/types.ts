import type { Vec3 } from '../math/vec'

export type Side = 'attacker' | 'defender'
export type ActorKind = 'wyvern' | 'troop'
export type AiState = 'idle' | 'approach' | 'engage' | 'retreat'

export type Order =
  | { kind: 'attack'; targetId: string }
  | { kind: 'moveTo'; position: Vec3 }
  | { kind: 'regroup' }
  | { kind: 'hold' }

/**
 * One combat participant.
 *
 * A troop actor represents an entire squad, not one soldier — `strength` is the
 * troop count. The render layer draws a handful of figures around it. That
 * keeps actor counts around 20 per battle, which is why this sim needs neither
 * an ECS nor spatial partitioning.
 */
export interface Actor {
  id: string
  kind: ActorKind
  side: Side
  /** GameState id this actor came from; null for spawned defenders. */
  sourceId: string | null
  speciesId: string | null
  unitId: string | null

  position: Vec3
  velocity: Vec3
  /** Facing, radians. Presentation reads this; the sim uses it for breath cones. */
  yaw: number
  flying: boolean

  hp: number
  maxHp: number
  strength: number
  initialStrength: number

  attack: number
  defense: number
  range: number
  speed: number
  attackInterval: number
  cooldown: number

  /** Wyverns only. */
  breathDamage: number
  breathRange: number
  breathCooldown: number
  stamina: number
  maxStamina: number

  bond: number
  /** Rolled once at setup: this wyvern will ignore your orders this battle. */
  disobedient: boolean
  /** Low-bond disobedience: attacks whatever is nearest, friend or foe. */
  feral: boolean
  /** A wild defender that can be tamed once weakened. */
  tameable: boolean

  ai: AiState
  targetId: string | null
  order: Order | null

  alive: boolean
  kills: number

  /**
   * True for exactly the tick this actor took damage. Reset every step; the
   * render layer reads and clears its own copy of this to drive a hit-flash.
   * Presentation-only — never read by the sim itself.
   */
  hitThisTick: boolean
  /**
   * Event flag set on ticks where this actor attempted a breath attack.
   * Reset every step; presentation reads this to drive the flame VFX cone.
   */
  breathing: boolean
}

export interface PilotInput {
  /** -1 (brake) .. 1 (boost). */
  throttle: number
  /** -1 (nose down) .. 1 (nose up). */
  pitch: number
  /** -1 (left) .. 1 (right). */
  yaw: number
  breathing: boolean
  diving: boolean
}

export const NEUTRAL_INPUT: PilotInput = {
  throttle: 0,
  pitch: 0,
  yaw: 0,
  breathing: false,
  diving: false,
}

export type Outcome = 'ongoing' | 'victory' | 'defeat'

export interface EncounterConfig {
  regionId: string
  seed: number
  /** Player wyverns, already resolved to effective stats. */
  attackers: {
    wyverns: {
      sourceId: string
      speciesId: string
      name: string
      bond: number
      stats: { power: number; speed: number; stamina: number; firepower: number; armor: number }
    }[]
    squads: { sourceId: string; unitId: string; strength: number }[]
  }
  defenders: {
    wyverns: { speciesId: string; tier: number }[]
    squads: { unitId: string; strength: number }[]
  }
  pilotedSourceId: string | null
}
