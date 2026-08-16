'use client'

import { useEffect, useRef, useState } from 'react'
import { useGameState, dispatch } from '@/state/store'
import { useSanctuaryEditor } from '@/state/sanctuaryEditorStore'
import { useSanctuaryColors } from '@/state/sanctuaryColorsStore'
import { PROP_CATALOG, isPropUnlocked } from '@/core/state/sanctuaryLayout'
import { useUi } from '@/state/uiStore'

export function SanctuaryEditorHud() {
  const state = useGameState()
  const isEditing = useSanctuaryEditor((s) => s.isEditing)
  const [colorsOpen, setColorsOpen] = useState(false)
  const [resetConfirmationOpen, setResetConfirmationOpen] = useState(false)
  const selectedObjectId = useSanctuaryEditor((s) => s.selectedObjectId)
  const placingItem = useSanctuaryEditor((s) => s.placingItem)
  const gridSnap = useSanctuaryEditor((s) => s.gridSnap)
  const snapSize = useSanctuaryEditor((s) => s.snapSize)
  const activeCategoryTab = useSanctuaryEditor((s) => s.activeCategoryTab)

  const exitEditMode = useSanctuaryEditor((s) => s.exitEditMode)
  const toggleGridSnap = useSanctuaryEditor((s) => s.toggleGridSnap)
  const setSnapSize = useSanctuaryEditor((s) => s.setSnapSize)
  const setCategoryTab = useSanctuaryEditor((s) => s.setCategoryTab)
  const startPlacing = useSanctuaryEditor((s) => s.startPlacing)
  const cancelPlacing = useSanctuaryEditor((s) => s.cancelPlacing)
  const selectObject = useSanctuaryEditor((s) => s.selectObject)
  const stageUndo = useSanctuaryEditor((s) => s.stageUndo)

  const [searchQuery, setSearchQuery] = useState('')

  if (!isEditing) return null

  const objects = state.sanctuaryLayout?.objects ?? []
  const storage = state.sanctuaryLayout?.storage ?? {}
  const selectedObject = objects.find((o) => o.id === selectedObjectId)

  const query = searchQuery.trim().toLowerCase()
  const catalogList = Object.values(PROP_CATALOG).filter((entry) => {
    const matchesCategory = activeCategoryTab === 'all' || entry.category === activeCategoryTab
    if (!matchesCategory) return false
    if (!query) return true
    return (
      entry.label.toLowerCase().includes(query) ||
      entry.description.toLowerCase().includes(query) ||
      entry.category.toLowerCase().includes(query) ||
      entry.propId.toLowerCase().includes(query)
    )
  })

  return (
    <div className="sanctuary-editor-overlay">
      {/* Top Header Control Bar */}
      <div className="editor-topbar liquid-glass">
        <div className="editor-badge">
          <span className="dot pulse" />
          <span className="title">SANCTUARY ARCHITECT</span>
        </div>

        <div className="editor-controls-group">
          <button className={`editor-btn ${colorsOpen ? 'active' : ''}`} onClick={() => setColorsOpen((v) => !v)}>
            <PaletteIcon />
            <span>Terrain Colors</span>
          </button>

          <button className={`editor-btn ${gridSnap ? 'active' : ''}`} onClick={toggleGridSnap}>
            <GridIcon />
            <span>Grid Snap {gridSnap ? `(${snapSize}m)` : 'OFF'}</span>
          </button>

          {gridSnap && (
            <button
              className="editor-btn-sub"
              onClick={() => setSnapSize(snapSize === 1.0 ? 0.5 : 1.0)}
            >
              {snapSize === 1.0 ? '1.0m' : '0.5m'}
            </button>
          )}

          <button className="editor-btn danger" onClick={() => setResetConfirmationOpen(true)}>
            <ResetIcon />
            <span>Reset Layout</span>
          </button>

          <button className="editor-btn primary" onClick={exitEditMode}>
            <CheckIcon />
            <span>Done Editing</span>
          </button>
        </div>
      </div>

      {/* Terrain color picker floating panel */}
      {colorsOpen && <TerrainColorsPanel onClose={() => setColorsOpen(false)} />}

      {/* Selected Object Inspector floating panel */}
      {selectedObject && !placingItem && (
        <div className="editor-inspector-panel liquid-glass">
          <div className="panel-header">
            <h4>{selectedObject.label}</h4>
            <span className="category-tag">{selectedObject.category}</span>
          </div>

          <p className="object-details">
            Position: [{selectedObject.position[0].toFixed(1)}, {selectedObject.position[2].toFixed(1)}]
          </p>

          <div className="inspector-actions">
            <button
              className="action-btn"
              onClick={() => {
                const undoToken = stageUndo(state.sanctuaryLayout, `Rotating ${selectedObject.label}`)
                const newAngle = (selectedObject.rotationY - Math.PI / 4) % (Math.PI * 2)
                dispatch({ type: 'ROTATE_SANCTUARY_OBJECT', id: selectedObject.id, rotationY: newAngle })
                useUi.getState().notify({ tone: 'success', message: `${selectedObject.label} rotated.`, undoToken })
              }}
            >
              <RotateLeftIcon />
              <span>Rotate 45° (Q)</span>
            </button>
            <button
              className="action-btn"
              onClick={() => {
                const undoToken = stageUndo(state.sanctuaryLayout, `Rotating ${selectedObject.label}`)
                const newAngle = (selectedObject.rotationY + Math.PI / 4) % (Math.PI * 2)
                dispatch({ type: 'ROTATE_SANCTUARY_OBJECT', id: selectedObject.id, rotationY: newAngle })
                useUi.getState().notify({ tone: 'success', message: `${selectedObject.label} rotated.`, undoToken })
              }}
            >
              <RotateRightIcon />
              <span>Rotate 45° (E)</span>
            </button>
            <button
              className="action-btn warn"
              onClick={() => {
                const undoToken = stageUndo(state.sanctuaryLayout, `Storing ${selectedObject.label}`)
                dispatch({ type: 'STORE_SANCTUARY_OBJECT', id: selectedObject.id })
                selectObject(null)
                useUi.getState().notify({ tone: 'success', message: `${selectedObject.label} moved to storage.`, undoToken })
              }}
            >
              <BoxIcon />
              <span>Store to Inventory</span>
            </button>
            <button className="action-btn close" onClick={() => selectObject(null)}>
              Deselect
            </button>
          </div>
        </div>
      )}

      {/* Active Placing Banner */}
      {placingItem && (
        <div className="editor-placing-banner liquid-glass editor-interaction-active">
          <span>
            Placing: <strong>{placingItem.label}</strong>
          </span>
          <span className="hint-text">
            Click ground to place · Press <kbd>Q</kbd> / <kbd>E</kbd> to rotate · <kbd>Esc</kbd> to cancel
          </span>
          <button
            className="banner-cancel-btn"
            onClick={() => {
              cancelPlacing()
              useUi.getState().notify({ tone: 'warning', message: 'Placement cancelled.' })
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Storage Catalog Drawer at bottom */}
      <div className="editor-storage-drawer liquid-glass">
        <div className="drawer-header">
          <div className="drawer-title-group">
            <BoxIcon />
            <span className="drawer-title">Storage & Building Catalog</span>
          </div>

          <div className="drawer-search-box">
            <SearchIcon />
            <input
              type="text"
              className="drawer-search-input"
              placeholder="Search catalog…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="drawer-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <div className="category-tabs">
            {(['all', 'structure', 'utility', 'furniture', 'scenery'] as const).map((tab) => (
              <button
                key={tab}
                className={`tab-btn ${activeCategoryTab === tab ? 'active' : ''}`}
                onClick={() => setCategoryTab(tab)}
              >
                <CategoryTabIcon category={tab} />
                <span>{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
              </button>
            ))}
          </div>
        </div>

        {catalogList.length === 0 ? (
          <div className="catalog-empty-state">
            <SearchIcon />
            <p>No items match &quot;{searchQuery}&quot;</p>
            <button type="button" className="editor-btn-sub" onClick={() => setSearchQuery('')}>
              Clear Search
            </button>
          </div>
        ) : (
          <div className="catalog-grid">
            {catalogList.map((item) => {
              const completedDuties = state.duties?.completed ?? 0
              const unlocked = isPropUnlocked(item.propId, completedDuties, storage, objects)
              const stockNum = storage[item.propId] ?? 0
              const count = item.isStructure ? 'Placed' : !unlocked ? 'Locked' : stockNum
              const available = unlocked && (item.isStructure || stockNum > 0)
              const isLowStock = unlocked && !item.isStructure && stockNum > 0 && stockNum <= 2

              return (
                <div
                  key={item.propId}
                  className={`catalog-card ${!available ? 'disabled' : ''} ${!unlocked ? 'locked' : ''} ${isLowStock ? 'low-stock' : ''}`}
                  onClick={() => available && startPlacing(item)}
                >
                  <div className="card-top">
                    <span className="card-label">
                      <CategoryTabIcon category={item.category} />
                      {item.label}
                    </span>
                    <span className={`card-badge ${!unlocked ? 'locked-badge' : isLowStock ? 'warning' : ''}`}>
                      {!unlocked ? (
                        <>
                          <LockIcon />
                          <span>{item.requiredDuties} Duties</span>
                        </>
                      ) : (
                        count
                      )}
                    </span>
                  </div>
                  <p className="card-desc">
                    {!unlocked && item.milestoneName
                      ? `Unlocked at milestone: ${item.milestoneName} (${item.requiredDuties} duties). ${item.description}`
                      : item.description}
                  </p>
                  <button className="card-add-btn" disabled={!available}>
                    {!unlocked ? (
                      <>
                        <LockIcon />
                        <span>Requires {item.requiredDuties} Duties</span>
                      </>
                    ) : item.isStructure ? (
                      'Place Structure'
                    ) : available ? (
                      <>
                        <PlusIcon />
                        <span>Add to Scene</span>
                      </>
                    ) : (
                      'Out of Stock'
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <div className="drawer-shortcut-bar">
          <span><kbd>Q</kbd> / <kbd>E</kbd> Rotate</span>
          <span><kbd>Click</kbd> Select / Place</span>
          <span><kbd>Esc</kbd> Cancel / Deselect</span>
        </div>
      </div>

      {resetConfirmationOpen && (
        <ResetLayoutDialog
          onCancel={() => setResetConfirmationOpen(false)}
          onConfirm={() => {
            const undoToken = stageUndo(state.sanctuaryLayout, 'Resetting the sanctuary layout')
            dispatch({ type: 'RESET_SANCTUARY_LAYOUT' })
            selectObject(null)
            cancelPlacing()
            setResetConfirmationOpen(false)
            useUi.getState().notify({
              tone: 'warning',
              message: 'Sanctuary layout reset to default.',
              undoToken,
            })
          }}
        />
      )}
    </div>
  )
}

function ResetLayoutDialog({ onCancel, onConfirm }: { onCancel(): void; onConfirm(): void }) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    const cancel = dialog?.querySelector<HTMLButtonElement>('[data-cancel]')
    cancel?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled)'))
      if (focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div className="editor-confirm-backdrop">
      <div
        ref={dialogRef}
        className="editor-confirm-dialog black-glass"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="reset-layout-title"
        aria-describedby="reset-layout-description"
      >
        <span className="editor-confirm-eyebrow">Destructive change</span>
        <h3 id="reset-layout-title">Reset Sanctuary Layout?</h3>
        <p id="reset-layout-description">
          All placed structures and decorations will return to the default layout. You can undo this once for five seconds.
        </p>
        <div className="editor-confirm-actions">
          <button type="button" className="action-btn close" data-cancel onClick={onCancel}>Cancel</button>
          <button type="button" className="editor-btn danger" onClick={onConfirm}>Reset Layout</button>
        </div>
      </div>
    </div>
  )
}

function TerrainColorsPanel({ onClose }: { onClose: () => void }) {
  const grass = useSanctuaryColors((s) => s.grass)
  const soil = useSanctuaryColors((s) => s.soil)
  const roost = useSanctuaryColors((s) => s.roost)
  const setGrass = useSanctuaryColors((s) => s.setGrass)
  const setSoil = useSanctuaryColors((s) => s.setSoil)
  const setRoost = useSanctuaryColors((s) => s.setRoost)
  const reset = useSanctuaryColors((s) => s.reset)

  return (
    <div className="editor-inspector-panel liquid-glass editor-colors-panel">
      <div className="panel-header">
        <h4>Terrain Colors</h4>
        <button className="action-btn close" style={{ gridColumn: 'auto', width: 'auto', padding: '4px 8px' }} onClick={onClose}>
          <CloseIcon />
        </button>
      </div>

      <div className="color-field-row">
        <label htmlFor="color-grass">Grass</label>
        <input id="color-grass" type="color" value={grass} onChange={(e) => setGrass(e.target.value)} />
      </div>
      <div className="color-field-row">
        <label htmlFor="color-soil">Soil (hills)</label>
        <input id="color-soil" type="color" value={soil} onChange={(e) => setSoil(e.target.value)} />
      </div>
      <div className="color-field-row">
        <label htmlFor="color-roost">Breeding roost</label>
        <input id="color-roost" type="color" value={roost} onChange={(e) => setRoost(e.target.value)} />
      </div>

      <button className="action-btn warn" onClick={reset}>
        Reset to Default
      </button>
    </div>
  )
}

function PaletteIcon() {
  return (
    <svg className="icon-monotone" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.92 0 1.7-.72 1.7-1.61 0-.43-.17-.83-.44-1.13-.27-.3-.44-.7-.44-1.13 0-.89.78-1.61 1.7-1.61h2.98C19.8 16.52 22 14.32 22 11.5 22 6.25 17.52 2 12 2z"/>
      <circle cx="7.5" cy="11.5" r=".75" fill="currentColor"/>
      <circle cx="12" cy="7.5" r=".75" fill="currentColor"/>
      <circle cx="16.5" cy="11.5" r=".75" fill="currentColor"/>
    </svg>
  )
}

function GridIcon() {
  return (
    <svg className="icon-monotone" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>
    </svg>
  )
}

function ResetIcon() {
  return (
    <svg className="icon-monotone" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="icon-monotone" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

function RotateLeftIcon() {
  return (
    <svg className="icon-monotone" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
    </svg>
  )
}

function RotateRightIcon() {
  return (
    <svg className="icon-monotone" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
      <path d="M21 3v5h-5"/>
    </svg>
  )
}

function BoxIcon() {
  return (
    <svg className="icon-monotone" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
      <path d="m3.3 7 8.7 5 8.7-5"/>
      <path d="M12 22V12"/>
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg className="icon-monotone" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg className="icon-monotone" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg className="icon-monotone" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function CategoryTabIcon({ category }: { category: string }) {
  switch (category) {
    case 'structure':
      return (
        <svg className="icon-monotone" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
        </svg>
      )
    case 'utility':
      return (
        <svg className="icon-monotone" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      )
    case 'furniture':
      return (
        <svg className="icon-monotone" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3M3 13v6M21 13v6M4 13h16a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1z" />
        </svg>
      )
    case 'scenery':
      return (
        <svg className="icon-monotone" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z" />
          <circle cx="12" cy="9" r="2.5" />
        </svg>
      )
    default:
      return (
        <svg className="icon-monotone" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
      )
  }
}

function LockIcon() {
  return (
    <svg className="icon-monotone" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

