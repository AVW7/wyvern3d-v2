import { beforeEach, describe, expect, it } from 'vitest'
import { createDefaultSanctuaryLayout } from '@/core/state/sanctuaryLayout'
import { useSanctuaryEditor } from './sanctuaryEditorStore'

describe('Sanctuary Architect undo state', () => {
  beforeEach(() => {
    useSanctuaryEditor.setState({ pendingUndo: null, nextUndoToken: 1 })
  })

  it('captures an isolated one-step layout snapshot and consumes it once', () => {
    const layout = createDefaultSanctuaryLayout()
    const token = useSanctuaryEditor.getState().stageUndo(layout, 'Moving War Table')
    layout.objects[0]!.position[0] = 999

    const snapshot = useSanctuaryEditor.getState().consumeUndo(token)

    expect(snapshot?.action).toBe('Moving War Table')
    expect(snapshot?.layout.objects[0]?.position[0]).not.toBe(999)
    expect(useSanctuaryEditor.getState().consumeUndo(token)).toBeNull()
  })

  it('replaces a previous undo opportunity with the latest edit', () => {
    const layout = createDefaultSanctuaryLayout()
    const first = useSanctuaryEditor.getState().stageUndo(layout, 'First edit')
    const second = useSanctuaryEditor.getState().stageUndo(layout, 'Second edit')

    expect(useSanctuaryEditor.getState().consumeUndo(first)).toBeNull()
    expect(useSanctuaryEditor.getState().consumeUndo(second)?.action).toBe('Second edit')
  })
})
