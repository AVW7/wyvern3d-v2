'use client'

import { useState } from 'react'
import { dispatch, useGameState } from '@/state/store'
import { useSanctuaryEditor } from '@/state/sanctuaryEditorStore'
import { useSanctuarySnapshots, MAX_LAYOUT_SNAPSHOTS, type LayoutSnapshot } from '@/state/sanctuarySnapshotStore'
import { validateSnapshotLayout } from '@/scenes/Sanctuary/editor/snapshotValidation'
import { useUi } from '@/state/uiStore'

export function SnapshotManager({ onClose }: { onClose: () => void }) {
  const state = useGameState()
  const snapshots = useSanctuarySnapshots((s) => s.snapshots)
  const saveSnapshot = useSanctuarySnapshots((s) => s.saveSnapshot)
  const deleteSnapshot = useSanctuarySnapshots((s) => s.deleteSnapshot)
  const renameSnapshot = useSanctuarySnapshots((s) => s.renameSnapshot)
  const stageUndo = useSanctuaryEditor((s) => s.stageUndo)

  const [newSnapshotName, setNewSnapshotName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [warningSnapshot, setWarningSnapshot] = useState<{
    snapshot: LayoutSnapshot
    validation: ReturnType<typeof validateSnapshotLayout>
  } | null>(null)

  const currentLayout = state.sanctuaryLayout
  const completedDuties = state.duties?.completed ?? 0

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentLayout) return
    const name = newSnapshotName.trim() || `Layout ${snapshots.length + 1}`
    const result = saveSnapshot(name, currentLayout)

    if (result.success) {
      setNewSnapshotName('')
      useUi.getState().notify({ tone: 'success', message: `Snapshot "${name}" saved.` })
    } else if (result.error) {
      useUi.getState().notify({ tone: 'warning', message: result.error })
    }
  }

  const handleLoadAttempt = (snapshot: LayoutSnapshot) => {
    const validation = validateSnapshotLayout(snapshot.layout, completedDuties, currentLayout?.storage ?? {})

    if (!validation.valid) {
      setWarningSnapshot({ snapshot, validation })
    } else {
      executeRestore(snapshot, validation.filteredLayout)
    }
  }

  const executeRestore = (snapshot: LayoutSnapshot, layoutToRestore: typeof snapshot.layout) => {
    if (!currentLayout) return
    const undoToken = stageUndo(currentLayout, `Restoring "${snapshot.name}" snapshot`)
    dispatch({ type: 'RESTORE_SANCTUARY_LAYOUT', layout: layoutToRestore })
    useSanctuaryEditor.getState().selectObject(null)
    useSanctuaryEditor.getState().cancelPlacing()
    setWarningSnapshot(null)
    onClose()
    useUi.getState().notify({
      tone: 'success',
      message: `Restored snapshot "${snapshot.name}".`,
      undoToken,
    })
  }

  return (
    <div className="editor-confirm-backdrop">
      <div className="editor-inspector-panel liquid-glass snapshot-manager-modal" role="dialog" aria-modal="true">
        <div className="panel-header">
          <div className="snapshot-title-group">
            <CameraIcon />
            <h4>Sanctuary Layout Snapshots</h4>
          </div>
          <button className="action-btn close" onClick={onClose} aria-label="Close snapshots">
            <CloseIcon />
          </button>
        </div>

        <div className="snapshot-stats-banner">
          <span>{snapshots.length} / {MAX_LAYOUT_SNAPSHOTS} Snapshots Saved</span>
          <span className="snapshot-hint">Snapshots save your placed arrangements without altering quest progress.</span>
        </div>

        {/* Save Current Layout Form */}
        <form className="snapshot-save-form" onSubmit={handleSave}>
          <input
            type="text"
            className="drawer-search-input"
            placeholder={`Name snapshot (e.g. "Sacred Grove", "Training Camp")`}
            value={newSnapshotName}
            maxLength={32}
            onChange={(e) => setNewSnapshotName(e.target.value)}
            disabled={snapshots.length >= MAX_LAYOUT_SNAPSHOTS}
          />
          <button
            type="submit"
            className="editor-btn primary"
            disabled={snapshots.length >= MAX_LAYOUT_SNAPSHOTS}
          >
            <PlusIcon />
            <span>Save Current</span>
          </button>
        </form>

        {/* Snapshots List */}
        <div className="snapshot-list">
          {snapshots.length === 0 ? (
            <div className="catalog-empty-state">
              <CameraIcon />
              <p>No layout snapshots saved yet.</p>
              <span className="hint-text">Save your current arrangement to quickly switch themes and styles later.</span>
            </div>
          ) : (
            snapshots.map((snap) => {
              const isConfirmingDelete = deleteConfirmId === snap.id
              const isEditingThis = editingId === snap.id

              return (
                <div key={snap.id} className="snapshot-card">
                  <div className="snapshot-card-main">
                    {isEditingThis ? (
                      <div className="snapshot-rename-group">
                        <input
                          type="text"
                          className="drawer-search-input"
                          value={editName}
                          maxLength={32}
                          onChange={(e) => setEditName(e.target.value)}
                          autoFocus
                        />
                        <button
                          className="action-btn"
                          onClick={() => {
                            renameSnapshot(snap.id, editName)
                            setEditingId(null)
                          }}
                        >
                          Save
                        </button>
                        <button className="action-btn close" onClick={() => setEditingId(null)}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="snapshot-info">
                        <div className="snapshot-header-row">
                          <span className="snapshot-name">{snap.name}</span>
                          <button
                            className="snapshot-edit-btn"
                            title="Rename"
                            onClick={() => {
                              setEditingId(snap.id)
                              setEditName(snap.name)
                            }}
                          >
                            <EditIcon />
                          </button>
                        </div>
                        <span className="snapshot-meta">
                          {snap.objectCount} Objects · {new Date(snap.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="snapshot-card-actions">
                    {isConfirmingDelete ? (
                      <div className="snapshot-delete-confirm">
                        <span>Delete?</span>
                        <button className="editor-btn danger" onClick={() => deleteSnapshot(snap.id)}>
                          Yes
                        </button>
                        <button className="action-btn close" onClick={() => setDeleteConfirmId(null)}>
                          No
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          className="editor-btn primary"
                          onClick={() => handleLoadAttempt(snap)}
                        >
                          <RestoreIcon />
                          <span>Load</span>
                        </button>
                        <button
                          className="action-btn warn"
                          onClick={() => setDeleteConfirmId(snap.id)}
                          title="Delete snapshot"
                        >
                          <TrashIcon />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Warning Modal for Omitted / Locked Props */}
        {warningSnapshot && (
          <div className="editor-confirm-backdrop">
            <div className="editor-confirm-dialog black-glass">
              <span className="editor-confirm-eyebrow">Snapshot Notice</span>
              <h3>Restore Layout with Omissions?</h3>
              <p>
                This snapshot contains {warningSnapshot.validation.omittedObjectCount} item(s) that are
                locked or unavailable in current gameplay:
              </p>
              <ul className="snapshot-warning-list">
                {warningSnapshot.validation.warnings.map((w, idx) => (
                  <li key={idx}>
                    <strong>{w.label}</strong>: {w.details}
                  </li>
                ))}
              </ul>
              <p>The remaining {warningSnapshot.validation.retainedObjectCount} valid object(s) will be restored.</p>
              <div className="editor-confirm-actions">
                <button
                  type="button"
                  className="action-btn close"
                  onClick={() => setWarningSnapshot(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="editor-btn primary"
                  onClick={() => executeRestore(warningSnapshot.snapshot, warningSnapshot.validation.filteredLayout)}
                >
                  Proceed & Restore
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CameraIcon() {
  return (
    <svg className="icon-monotone" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  )
}

function RestoreIcon() {
  return (
    <svg className="icon-monotone" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg className="icon-monotone" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg className="icon-monotone" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg className="icon-monotone" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg className="icon-monotone" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
