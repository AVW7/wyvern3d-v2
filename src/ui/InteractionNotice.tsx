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
/**
 * Shared acknowledgement surface for quick sanctuary actions.
 * Supports stacked notices so rapid actions do not overwrite undo tokens.
 */
export function InteractionNotice() {
  const toasts = useUi((state) => state.toasts)
  const singleToast = useUi((state) => state.toast)
  const activeToasts = toasts.length > 0 ? toasts : singleToast ? [singleToast] : []

  if (activeToasts.length === 0) return null

  return (
    <div className="interaction-notice-stack" role="status" aria-live="polite">
      {activeToasts.map((notice) => (
        <InteractionNoticeItem key={notice.id} notice={notice} />
      ))}
    </div>
  )
}

function InteractionNoticeItem({ notice }: { notice: ReturnType<typeof useUi.getState>['toast'] & {} }) {
  const durationMs = Math.max(1000, notice ? notice.expiresAt - Date.now() : 5000)

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
    <div className={`interaction-notice ${notice.tone}`} aria-atomic="true">
      <ToneIcon tone={notice.tone} />
      <span className="notice-message">{notice.message}</span>
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
      <div
        className="interaction-notice-bar"
        style={{ animationDuration: `${durationMs}ms` }}
      />
    </div>
  )
}

function ToneIcon({ tone }: { tone: string }) {
  switch (tone) {
    case 'success':
      return (
        <svg className="notice-icon success" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )
    case 'warning':
      return (
        <svg className="notice-icon warning" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      )
    case 'error':
      return (
        <svg className="notice-icon error" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      )
    default:
      return (
        <svg className="notice-icon status" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      )
  }
}

