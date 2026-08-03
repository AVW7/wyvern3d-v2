'use client'

import { useEffect } from 'react'
import { dispatch } from '@/state/store'
import { useSanctuaryEditor } from '@/state/sanctuaryEditorStore'
import { useUi } from '@/state/uiStore'

/**
 * A single, shared acknowledgement surface for quick sanctuary actions.
 * The editor owns undo snapshots; this component only renders and consumes
 * their opaque tokens, keeping callbacks out of the transient UI store.
 */
export function InteractionNotice() {
  const notice = useUi((state) => state.toast)

  useEffect(() => {
    if (!notice) return
    const delay = Math.max(0, notice.expiresAt - Date.now())
    const timeout = window.setTimeout(() => {
      useUi.getState().clearNotice(notice.id)
      if (notice.undoToken !== undefined) useSanctuaryEditor.getState().clearUndo(notice.undoToken)
    }, delay)
    return () => window.clearTimeout(timeout)
  }, [notice])

  if (!notice) return null

  const undo = () => {
    if (notice.undoToken === undefined) return
    const snapshot = useSanctuaryEditor.getState().consumeUndo(notice.undoToken)
    if (!snapshot) return
    dispatch({ type: 'RESTORE_SANCTUARY_LAYOUT', layout: snapshot.layout })
    useUi.getState().notify({ tone: 'success', message: `${snapshot.action} undone.` })
  }

  const dismiss = () => {
    useUi.getState().clearNotice(notice.id)
    if (notice.undoToken !== undefined) useSanctuaryEditor.getState().clearUndo(notice.undoToken)
  }

  return (
    <div
      className={`interaction-notice ${notice.tone}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span>{notice.message}</span>
      {notice.undoToken !== undefined && (
        <button type="button" className="interaction-notice-action" onClick={undo}>
          Undo
        </button>
      )}
      <button
        type="button"
        className="interaction-notice-dismiss"
        aria-label="Dismiss notification"
        onClick={dismiss}
      >
        ×
      </button>
    </div>
  )
}
