'use client'

import { create } from 'zustand'
import type { CharacterGesture } from '@/render/placeholders/PlaceholderProps'
import type { CharacterMoveCommand } from '@/render/controllers/CharacterController'
import type { PlayerLocomotion } from '@/render/player/PlayerCharacter'

export type SanctuaryCommand =
  | 'offerFood'
  | 'pet'
  | 'calm'
  | 'findFood'
  | 'takeOff'
  | 'land'
  | 'attack'
  | 'return'
  | 'circle'
  | 'follow'
  | 'soar'
  | 'hover'

export type SanctuaryCommandPhase =
  | 'settled'
  | 'walking'
  | 'approachingPlayer'
  | 'takeoff'
  | 'transit'
  | 'landing'
  | 'acting'
  | 'patrol'
  | 'returning'
  | 'circle'
  | 'following'
  | 'soaring'
  | 'hovering'

export interface SanctuaryCommandRequest {
  wyvernId: string
  kind: SanctuaryCommand
  token: number
  target?: [number, number]
}

export interface SelectedAgentStatus {
  phase: SanctuaryCommandPhase
  airborne: boolean
  hatchling: boolean
  adult: boolean
  label: string
}

export interface PendingSanctuaryCommand {
  kind: SanctuaryCommand
  token: number
}

interface WheelAnchor {
  x: number
  y: number
  visible: boolean
}

interface SanctuaryCommandStore {
  selectedWyvernId: string | null
  request: SanctuaryCommandRequest | null
  targetMode: boolean
  targetValid: boolean
  targetPoint: [number, number] | null
  status: string | null
  pendingCommand: PendingSanctuaryCommand | null
  agent: SelectedAgentStatus | null
  wheelAnchor: WheelAnchor
  playerMove: CharacterMoveCommand | null
  playerMoveResult: { token: number; result: 'arrived' | 'cancelled' } | null
  playerGesture: CharacterGesture
  playerLocomotion: PlayerLocomotion
  playerPosition: [number, number]
  nextToken: number

  select(wyvernId: string): void
  issue(kind: Exclude<SanctuaryCommand, 'attack'>): void
  beginAttack(): void
  previewTarget(point: [number, number] | null, valid: boolean): void
  confirmAttack(point: [number, number]): void
  cancelTarget(): void
  rejectTarget(): void
  acknowledgeCommand(token: number): void
  close(): void
  setStatus(status: string | null): void
  setAgent(agent: SelectedAgentStatus | null): void
  setWheelAnchor(anchor: WheelAnchor): void
  movePlayer(
    position: [number, number],
    gesture: CharacterGesture,
    face?: [number, number],
  ): number
  setPlayerPosition(position: [number, number]): void
  setPlayerLocomotion(locomotion: PlayerLocomotion): void
  finishPlayerMove(token: number, result: 'arrived' | 'cancelled'): void
  acknowledgePlayerMove(): void
  clearPlayerInteraction(): void
}

const HIDDEN_ANCHOR: WheelAnchor = { x: 0, y: 0, visible: false }

/**
 * Ephemeral presentation state for direct sanctuary commands.
 *
 * This intentionally lives outside GameState: commands never enter saves,
 * replays, the deterministic tick, or battle resolution.
 */
export const useSanctuaryCommands = create<SanctuaryCommandStore>()((set, get) => ({
  selectedWyvernId: null,
  request: null,
  targetMode: false,
  targetValid: false,
  targetPoint: null,
  status: null,
  pendingCommand: null,
  agent: null,
  wheelAnchor: HIDDEN_ANCHOR,
  playerMove: null,
  playerMoveResult: null,
  playerGesture: 'none',
  playerLocomotion: 'idle',
  playerPosition: [0, 6],
  nextToken: 1,

  select(wyvernId) {
    set((state) => ({
      selectedWyvernId: wyvernId,
      targetMode: false,
      targetValid: false,
      targetPoint: null,
      status: state.selectedWyvernId === wyvernId ? state.status : null,
      pendingCommand: state.selectedWyvernId === wyvernId ? state.pendingCommand : null,
      agent: state.selectedWyvernId === wyvernId ? state.agent : null,
    }))
  },

  issue(kind) {
    const wyvernId = get().selectedWyvernId
    if (!wyvernId || get().pendingCommand) return
    const token = get().nextToken
    set({
      request: { wyvernId, kind, token },
      pendingCommand: { kind, token },
      nextToken: token + 1,
      targetMode: false,
      targetValid: false,
      targetPoint: null,
      status: null,
    })
  },

  beginAttack() {
    if (get().pendingCommand) return
    set({
      request: null,
      targetMode: true,
      targetValid: false,
      targetPoint: null,
      status: 'Choose a clear point on the sanctuary ground.',
    })
  },

  previewTarget(point, valid) {
    set((state) => {
      const unchanged =
        state.targetValid === valid &&
        state.targetPoint?.[0] === point?.[0] &&
        state.targetPoint?.[1] === point?.[1]
      return unchanged ? state : { targetPoint: point, targetValid: valid }
    })
  },

  confirmAttack(point) {
    const wyvernId = get().selectedWyvernId
    if (!wyvernId || get().pendingCommand) return
    const token = get().nextToken
    set({
      request: { wyvernId, kind: 'attack', token, target: point },
      pendingCommand: { kind: 'attack', token },
      nextToken: token + 1,
      targetMode: false,
      targetValid: false,
      targetPoint: null,
      status: null,
    })
  },

  cancelTarget() {
    set({
      targetMode: false,
      targetValid: false,
      targetPoint: null,
      status: 'Attack targeting cancelled.',
    })
  },

  rejectTarget() {
    set({ status: 'That ground is blocked. Choose a clear point.' })
  },

  acknowledgeCommand(token) {
    set((state) =>
      state.pendingCommand?.token === token ? { pendingCommand: null } : state,
    )
  },

  close() {
    set({
      selectedWyvernId: null,
      targetMode: false,
      targetValid: false,
      targetPoint: null,
      status: null,
      pendingCommand: null,
      agent: null,
      wheelAnchor: HIDDEN_ANCHOR,
    })
  },

  setStatus(status) {
    set((state) => (state.status === status ? state : { status }))
  },

  setAgent(agent) {
    set((state) => {
      const old = state.agent
      if (
        old?.phase === agent?.phase &&
        old?.airborne === agent?.airborne &&
        old?.hatchling === agent?.hatchling &&
        old?.adult === agent?.adult &&
        old?.label === agent?.label
      ) {
        return state
      }
      return { agent }
    })
  },

  setWheelAnchor(anchor) {
    set((state) => {
      const old = state.wheelAnchor
      if (
        old.visible === anchor.visible &&
        old.x === anchor.x &&
        old.y === anchor.y
      ) {
        return state
      }
      return { wheelAnchor: anchor }
    })
  },

  movePlayer(position, gesture, face) {
    const token = get().nextToken
    set({
      playerMove: { token, position, face },
      playerMoveResult: null,
      playerGesture: gesture,
      nextToken: token + 1,
    })
    return token
  },

  setPlayerPosition(position) {
    set((state) =>
      Math.hypot(
        state.playerPosition[0] - position[0],
        state.playerPosition[1] - position[1],
      ) < 0.04
        ? state
        : { playerPosition: position },
    )
  },

  setPlayerLocomotion(locomotion) {
    set((state) => state.playerLocomotion === locomotion ? state : { playerLocomotion: locomotion })
  },

  finishPlayerMove(token, result) {
    if (get().playerMove?.token !== token) return
    set({
      playerMove: null,
      playerMoveResult: { token, result },
      playerGesture: result === 'cancelled' ? 'none' : get().playerGesture,
    })
  },

  acknowledgePlayerMove() {
    set({ playerMoveResult: null })
  },

  clearPlayerInteraction() {
    set({ playerMove: null, playerMoveResult: null, playerGesture: 'none' })
  },
}))
