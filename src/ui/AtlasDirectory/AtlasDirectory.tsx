'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useGame, useGameState } from '@/state/store'
import { useMapUiStore } from '@/state/mapUiStore'
import { SPECIES } from '@/core/data/species'
import {
  EMPTY_ATLAS_QUERY,
  buildAtlasDirectory,
  filterAtlasDirectory,
  getAtlasFacets,
  isQueryActive,
  type AtlasDirectoryEntry,
  type AtlasDirectoryQuery,
} from '@/core/state/atlasDirectory'
import { getAtlasCompletionStats } from '@/core/state/atlasKnowledge'
import {
  atlasLayoutMode,
  atlasSelectionSummary,
  stepAtlasListIndex,
} from '@/core/state/atlasA11y'
import { AtlasFilterBar } from './AtlasFilterBar'
import { AtlasRow } from './AtlasRow'
import { AtlasDiagnostic } from './AtlasDiagnostic'

/**
 * World Atlas drawer (Atlas Stage 1 + Stage 5 a11y). Lists every region with
 * search and filters built from the pure core directory helpers, and drives
 * the one selection authority (`gameStore.selectedRegion`) so the drawer
 * row, the 3D node and the camera focus always agree.
 *
 * Stage 5 additions: focus returns to the toggle button on close, a polite
 * live region announces selections for screen readers, list traversal uses
 * the shared pure stepper, and the root carries a layout-mode data attribute
 * that the CSS narrow-viewport rules key off.
 */
export function AtlasDirectory() {
  const mode = useGame((s) => s.mode)
  const selectedRegion = useGame((s) => s.selectedRegion)
  const selectRegion = useGame((s) => s.selectRegion)
  const state = useGameState()
  // The core mutates GameState in place, so `state` is a stable reference;
  // revision is what changes and must key the directory memos.
  const revision = useGame((s) => s.revision)

  const activeLayer = useMapUiStore((s) => s.activeLayer)
  const atlasOpen = useMapUiStore((s) => s.atlasOpen)
  const setAtlasOpen = useMapUiStore((s) => s.setAtlasOpen)
  const toggleAtlas = useMapUiStore((s) => s.toggleAtlas)
  const setInspected = useMapUiStore((s) => s.setInspected)

  const [query, setQuery] = useState<AtlasDirectoryQuery>(EMPTY_ATLAS_QUERY)
  const listRef = useRef<HTMLDivElement>(null)

  /** The nav pill that opened the drawer — focus returns here on close. */
  const focusToggle = () => {
    document.querySelector<HTMLButtonElement>('button[data-atlas-toggle]')?.focus()
  }

  // Layout mode drives the CSS narrow-viewport rules; mirrors the
  // `@media (max-width: 860px)` breakpoint (asserted in atlasA11y tests).
  const [layout, setLayout] = useState(() =>
    typeof window === 'undefined' ? 'standard' : atlasLayoutMode(window.innerWidth),
  )
  useEffect(() => {
    const onResize = () => setLayout(atlasLayoutMode(window.innerWidth))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const entries = useMemo(() => buildAtlasDirectory(state), [state, revision])
  const facets = useMemo(() => getAtlasFacets(entries), [entries])
  const results = useMemo(() => filterAtlasDirectory(entries, query), [entries, query])
  const stats = useMemo(() => getAtlasCompletionStats(state), [state, revision])
  const active = isQueryActive(query)

  // Screen-reader selection summary under the active layer, announced once
  // per selection change (not per keystroke) via a polite live region.
  const selectionSummary = useMemo(
    () =>
      selectedRegion
        ? atlasSelectionSummary(state, selectedRegion, activeLayer)
        : null,
    [state, selectedRegion, activeLayer, revision],
  )

  // 'A' toggles the atlas on the world map; Escape closes it. Both are
  // ignored while typing in a field (except Escape inside our own search).
  useEffect(() => {
    if (mode !== 'worldmap') return
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      if (e.key === 'a' && !typing) {
        toggleAtlas()
      } else if (e.key === 'Escape') {
        if (useMapUiStore.getState().atlasOpen) {
          e.preventDefault()
          setAtlasOpen(false)
          // Focus return: the toggle that opened the drawer gets focus back.
          focusToggle()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mode, toggleAtlas, setAtlasOpen])

  // Opening the drawer moves focus into it so keyboard users land inside,
  // not behind, the panel.
  useEffect(() => {
    if (atlasOpen && mode === 'worldmap') {
      const search = listRef.current
        ?.closest('.atlas-drawer')
        ?.querySelector<HTMLInputElement>('input.atlas-search')
      search?.focus()
    }
  }, [atlasOpen, mode])

  // Dev-only atlas diagnostic (?reveal=1 on the world map).
  const [showDiagnostic, setShowDiagnostic] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      setShowDiagnostic(new URLSearchParams(window.location.search).get('reveal') === '1')
    } catch {
      /* ignore */
    }
  }, [])

  if (mode !== 'worldmap' || !atlasOpen) return null

  const selectEntry = (entry: AtlasDirectoryEntry) => {
    // One selection authority: the same store field the 3D node click and
    // the camera rig read. Inspected follows so the inspector shows details.
    selectRegion(entry.id)
    setInspected(entry.id)
  }

  // Keyboard navigation across result rows uses the shared pure stepper;
  // Enter/Space activate the focused row button natively.
  const onListKeyDown = (e: React.KeyboardEvent) => {
    const buttons = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('button.atlas-row') ?? [],
    )
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next = stepAtlasListIndex(buttons.length, index < 0 ? 0 : index, e.key)
    if (next !== null) {
      e.preventDefault()
      buttons[next]?.focus()
    }
  }

  return (
    <div
      className="atlas-drawer black-glass"
      role="complementary"
      aria-label="World Atlas directory"
      data-atlas-layout={layout}
    >
      <div className="atlas-sr-live" role="status" aria-live="polite">
        {selectionSummary}
      </div>
      <div className="atlas-drawer-head">
        <div className="atlas-drawer-title">
          <h3>World Atlas</h3>
          <p className="atlas-result-count" aria-live="polite">
            {results.length} of {entries.length} regions · {stats.visitedRegions}/{stats.totalRegions}{' '}
            visited · {stats.discoveredLandmarks}/{stats.totalLandmarks} landmarks
          </p>
        </div>
        <button
          className="region-inspector-close"
          onClick={() => {
            setAtlasOpen(false)
            focusToggle()
          }}
          title="Close Atlas (Escape)"
          aria-label="Close atlas"
        >
          ✕
        </button>
      </div>

      <AtlasFilterBar query={query} onChange={setQuery} facets={facets} onClear={() => setQuery(EMPTY_ATLAS_QUERY)} active={active} />

      {showDiagnostic && <AtlasDiagnostic />}

      <div className="atlas-list" ref={listRef} onKeyDown={onListKeyDown} role="listbox" aria-label="Regions">
        {results.length === 0 ? (
          <div className="atlas-empty">
            <p>No regions match these filters.</p>
            {active && (
              <button className="region-btn confirm" onClick={() => setQuery(EMPTY_ATLAS_QUERY)}>
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          results.map((entry) => (
            <AtlasRow
              key={entry.id}
              entry={entry}
              selected={selectedRegion === entry.id}
              speciesName={entry.nativeSpecies ? (SPECIES[entry.nativeSpecies]?.name ?? entry.nativeSpecies) : null}
              onSelect={() => selectEntry(entry)}
            />
          ))
        )}
      </div>
    </div>
  )
}
