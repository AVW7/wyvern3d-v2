import { beforeEach, describe, expect, it } from 'vitest'
import { getGameState } from './store'
import { useSanctuaryCommands } from './sanctuaryCommands'

describe('transient sanctuary commands', () => {
  beforeEach(() => {
    useSanctuaryCommands.setState({
      selectedWyvernId: null,
      request: null,
      targetMode: false,
      targetValid: false,
      targetPoint: null,
      status: null,
      pendingCommand: null,
      agent: null,
      wheelAnchor: { x: 0, y: 0, visible: false },
      playerMove: null,
      playerMoveResult: null,
      playerGesture: 'none',
      playerPosition: [0, 6],
      nextToken: 1,
    })
  })

  it('scopes acknowledged commands to the selected wyvern and retriggers with a new token', () => {
    const commands = useSanctuaryCommands.getState()
    commands.select('wyvern-a')
    commands.issue('pet')
    const first = useSanctuaryCommands.getState().request

    commands.acknowledgeCommand(first!.token)
    useSanctuaryCommands.getState().issue('pet')
    const second = useSanctuaryCommands.getState().request

    expect(first).toMatchObject({ wyvernId: 'wyvern-a', kind: 'pet' })
    expect(second).toMatchObject({ wyvernId: 'wyvern-a', kind: 'pet' })
    expect(second!.token).toBeGreaterThan(first!.token)
  })

  it('routes attack through targeting before creating its command', () => {
    const commands = useSanctuaryCommands.getState()
    commands.select('wyvern-a')
    commands.beginAttack()
    commands.previewTarget([12, -4], true)

    expect(useSanctuaryCommands.getState()).toMatchObject({
      targetMode: true,
      targetPoint: [12, -4],
      targetValid: true,
      request: null,
    })

    useSanctuaryCommands.getState().confirmAttack([12, -4])
    expect(useSanctuaryCommands.getState().request).toMatchObject({
      wyvernId: 'wyvern-a',
      kind: 'attack',
      target: [12, -4],
    })
    expect(useSanctuaryCommands.getState().targetMode).toBe(false)
  })

  it('acknowledges one command at a time and ignores duplicate orders until accepted', () => {
    const commands = useSanctuaryCommands.getState()
    commands.select('wyvern-a')
    commands.issue('pet')
    const pending = useSanctuaryCommands.getState().pendingCommand
    commands.issue('calm')

    expect(pending).toMatchObject({ kind: 'pet' })
    expect(useSanctuaryCommands.getState().request).toMatchObject({ kind: 'pet' })

    commands.acknowledgeCommand(pending!.token)
    expect(useSanctuaryCommands.getState().pendingCommand).toBeNull()

    useSanctuaryCommands.getState().issue('calm')
    expect(useSanctuaryCommands.getState().pendingCommand).toMatchObject({ kind: 'calm' })
  })

  it('keeps targeting active when a target is rejected and reports cancellations', () => {
    const commands = useSanctuaryCommands.getState()
    commands.select('wyvern-a')
    commands.beginAttack()
    commands.rejectTarget()

    expect(useSanctuaryCommands.getState()).toMatchObject({
      targetMode: true,
      status: 'That ground is blocked. Choose a clear point.',
    })

    commands.cancelTarget()
    expect(useSanctuaryCommands.getState()).toMatchObject({
      targetMode: false,
      status: 'Attack targeting cancelled.',
    })
  })

  it('never mutates the deterministic game state or intent log', () => {
    const before = JSON.stringify(getGameState())
    const commands = useSanctuaryCommands.getState()
    commands.select('wyvern-a')
    for (const command of [
      'offerFood',
      'pet',
      'calm',
      'findFood',
      'takeOff',
      'circle',
      'follow',
      'soar',
      'hover',
      'land',
      'return',
    ] as const) {
      useSanctuaryCommands.getState().issue(command)
    }
    useSanctuaryCommands.getState().beginAttack()
    useSanctuaryCommands.getState().confirmAttack([4, 5])

    expect(JSON.stringify(getGameState())).toBe(before)
  })

  it('reports player move arrival only once for the active token', () => {
    const token = useSanctuaryCommands
      .getState()
      .movePlayer([3, 4], 'pet', [5, 6])
    expect(useSanctuaryCommands.getState().playerMove).toEqual({
      token,
      position: [3, 4],
      face: [5, 6],
    })
    useSanctuaryCommands.getState().finishPlayerMove(token + 1, 'arrived')
    expect(useSanctuaryCommands.getState().playerMoveResult).toBeNull()

    useSanctuaryCommands.getState().finishPlayerMove(token, 'arrived')
    expect(useSanctuaryCommands.getState().playerMove).toBeNull()
    expect(useSanctuaryCommands.getState().playerMoveResult).toEqual({
      token,
      result: 'arrived',
    })
  })

  it('clears player interaction and cancels target mode cleanly', () => {
    const commands = useSanctuaryCommands.getState()
    commands.movePlayer([3, 4], 'pet')
    expect(useSanctuaryCommands.getState().playerMove).not.toBeNull()

    commands.clearPlayerInteraction()
    expect(useSanctuaryCommands.getState().playerMove).toBeNull()
    expect(useSanctuaryCommands.getState().playerGesture).toBe('none')

    commands.beginAttack()
    expect(useSanctuaryCommands.getState().targetMode).toBe(true)

    commands.cancelTarget()
    expect(useSanctuaryCommands.getState().targetMode).toBe(false)
  })
})
