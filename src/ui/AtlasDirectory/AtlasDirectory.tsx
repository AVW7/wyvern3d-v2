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
import { AtlasFilterBar } from './AtlasFilterBar'
import { AtlasRow } from './AtlasRow'

/**
 * World Atlas drawer (Atlas Stage 1). Lists every region with search and
 * filters built from the pure core directory helpers, and drives the one
 * selection authority (`gameStore.selectedRegion`) so the drawer row, the 3D
 * node and the camera focus always agree.
 */
export function AtlasDirectory() {
  const mode = useGame((s) => s.mode)
  const selectedRegion = useGame((s) => s.selectedRegion)
  const selectRegion = useGame((s) => s.selectRegion)
  const state = useGameState()
  // The core mutates GameState in place, so `state` is a stable reference;
  // revision is what changes and must key the directory memos.
  const revision = useGame((s) => s.revision)

  const atlasOpen = useMapUiStore((s) => s.atlasOpen)
  const setAtlasOpen = useMapUiStore((s) => s.setAtlasOpen)
  const toggleAtlas = useMapUiStore((s) => s.toggleAtlas)
  const setInspected = useMapUiStore((s) => s.setInspected)

  const [query, setQuery] = useState<AtlasDirectoryQuery>(EMPTY_ATLAS_QUERY)
  const listRef = useRef<HTMLDivElement>(null)

  const entries = useMemo(() => buildAtlasDirectory(state), [state, revision])
  const facets = useMemo(() => getAtlasFacets(entries), [entries])
  const results = useMemo(() => filterAtlasDirectory(entries, query), [entries, query])
  const stats = useMemo(() => getAtlasCompletionStats(state), [state, revision])
  const active = isQueryActive(query)

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
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mode, toggleAtlas, setAtlasOpen])

  if (mode !== 'worldmap' || !atlasOpen) return null

  const selectEntry = (entry: AtlasDirectoryEntry) => {
    // One selection authority: the same store field the 3D node click and
    // the camera rig read. Inspected follows so the inspector shows details.
    selectRegion(entry.id)
    setInspected(entry.id)
  }

  // Keyboard navigation across result rows: Arrow/Home/End move DOM focus
  // between row buttons; Enter/Space activate the focused one natively.
  const onListKeyDown = (e: React.KeyboardEvent) => {
    const buttons = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('button.atlas-row') ?? [],
    )
    if (buttons.length === 0) return
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    let next = -1
    if (e.key === 'ArrowDown') next = Math.min(buttons.length - 1, index + 1)
    else if (e.key === 'ArrowUp') next = Math.max(0, index - 1)
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = buttons.length - 1
    if (next >= 0) {
      e.preventDefault()
      buttons[next]!.focus()
    }
  }

  return (
    <div className="atlas-drawer black-glass" role="complementary" aria-label="World Atlas directory">
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
          onClick={() => setAtlasOpen(false)}
          title="Close Atlas (Escape)"
          aria-label="Close atlas"
        >
          ✕
        </button>
      </div>

      <AtlasFilterBar query={query} onChange={setQuery} facets={facets} onClear={() => setQuery(EMPTY_ATLAS_QUERY)} active={active} />

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
