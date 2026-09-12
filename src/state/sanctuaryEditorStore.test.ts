import { beforeEach, describe, expect, it } from 'vitest'
import { createDefaultSanctuaryLayout } from '@/core/state/sanctuaryLayout'
import { useSanctuaryEditor } from './sanctuaryEditorStore'

describe('Sanctuary Architect undo/redo state', () => {
  beforeEach(() => {
    useSanctuaryEditor.setState({
      pendingUndo: null,
      undoStack: [],
      redoStack: [],
      nextUndoToken: 1,
    })
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

  it('supports multi-step bounded undo and redo stacks', () => {
    const layout1 = createDefaultSanctuaryLayout()
    useSanctuaryEditor.getState().pushUndo(layout1, 'Step 1')

    const layout2 = createDefaultSanctuaryLayout()
    layout2.objects[0]!.position[0] = 10
    useSanctuaryEditor.getState().pushUndo(layout2, 'Step 2')

    const layout3 = createDefaultSanctuaryLayout()
    layout3.objects[0]!.position[0] = 20

    expect(useSanctuaryEditor.getState().undoStack).toHaveLength(2)

    // Undo step 2 -> gets layout2
    const undoRes1 = useSanctuaryEditor.getState().undo(layout3)
    expect(undoRes1?.action).toBe('Step 2')
    expect(undoRes1?.layout.objects[0]!.position[0]).toBe(10)
    expect(useSanctuaryEditor.getState().redoStack).toHaveLength(1)

    // Redo -> gets layout3 back
    const redoRes = useSanctuaryEditor.getState().redo(undoRes1!.layout)
    expect(redoRes?.action).toBe('Step 2')
    expect(redoRes?.layout.objects[0]!.position[0]).toBe(20)
  })

  it('caps undo history at 20 entries', () => {
    const baseLayout = createDefaultSanctuaryLayout()
    for (let i = 1; i <= 25; i++) {
      useSanctuaryEditor.getState().pushUndo(baseLayout, `Edit ${i}`)
    }

    const { undoStack } = useSanctuaryEditor.getState()
    expect(undoStack).toHaveLength(20)
    expect(undoStack[0]?.action).toBe('Edit 6')
    expect(undoStack[19]?.action).toBe('Edit 25')
  })

  it('clears redo stack when a new edit is pushed', () => {
    const layout1 = createDefaultSanctuaryLayout()
    useSanctuaryEditor.getState().pushUndo(layout1, 'Edit 1')
    const layout2 = createDefaultSanctuaryLayout()
    layout2.objects[0]!.position[0] = 5

    useSanctuaryEditor.getState().undo(layout2)
    expect(useSanctuaryEditor.getState().redoStack).toHaveLength(1)

    // Push a new edit
    useSanctuaryEditor.getState().pushUndo(layout1, 'Edit 2 (divergent)')
    expect(useSanctuaryEditor.getState().redoStack).toHaveLength(0)
  })
})
