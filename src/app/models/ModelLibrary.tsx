'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AssetId, ModelState } from '@/render/assets/manifest'
import { useModelLibraryHydration, useModelLibraryStore } from '@/state/modelLibraryStore'
import {
  MODEL_LIBRARY_ENTRIES,
  filterModels,
  modelCounts,
  payloadUrls,
  resolveModelState,
  statesFor,
  type CategoryFilter,
  type StatusFilter,
} from './catalog'
import { CatalogPanel } from './components/CatalogPanel'
import { InspectorPanel } from './components/InspectorPanel'
import { PreviewStage, type StageControlsState } from './components/PreviewStage'
import type { ModelStats } from './ModelPreview'
import styles from './models.module.css'

const COUNTS = modelCounts(MODEL_LIBRARY_ENTRIES)

const DEFAULT_CONTROLS: StageControlsState = { paused: false, rate: 1, turntable: false, wireframe: false }

export function ModelLibrary({
  initialId = 'character.player',
  initialState,
}: {
  initialId?: AssetId
  initialState?: ModelState
}) {
  useModelLibraryHydration()
  const disabled = useModelLibraryStore((store) => store.disabled)
  const setEnabled = useModelLibraryStore((store) => store.setEnabled)
  const reset = useModelLibraryStore((store) => store.reset)
  const [query, setQuery] = useState('')
  const [show, setShow] = useState<StatusFilter>('all')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [selectedId, setSelectedId] = useState<AssetId>(initialId)
  const [requestedState, setRequestedState] = useState<ModelState>(() => {
    const entry = MODEL_LIBRARY_ENTRIES.find((candidate) => candidate.id === initialId)
    return resolveModelState(entry?.asset ?? { url: null, scale: 1, animations: {} }, initialState)
  })
  const [controls, setControls] = useState<StageControlsState>(DEFAULT_CONTROLS)
  const [modelStats, setModelStats] = useState<ModelStats | null>(null)
  const [payloadBytes, setPayloadBytes] = useState(0)

  const visible = useMemo(
    () => filterModels(MODEL_LIBRARY_ENTRIES, query, show, category),
    [query, show, category],
  )
  const selectedEntry = MODEL_LIBRARY_ENTRIES.find((entry) => entry.id === selectedId)!
  const selected = selectedEntry.asset
  const states = useMemo(() => statesFor(selected), [selected])
  const previewState = resolveModelState(selected, requestedState)

  // One HEAD per selected model for the payload row — numeric review needs the
  // number, and a GET would download 22 MB of GLB just to read a header.
  useEffect(() => {
    let cancelled = false
    setPayloadBytes(0)
    const urls = payloadUrls(selected)
    if (urls.length === 0) return
    Promise.all(
      urls.map(async (url) => {
        const response = await fetch(url, { method: 'HEAD' })
        if (!response.ok) throw new Error(`HEAD ${url} -> ${response.status}`)
        return Number(response.headers.get('content-length') ?? 0)
      }),
    )
      .then((sizes) => {
        if (!cancelled) setPayloadBytes(sizes.reduce((total, size) => total + size, 0))
      })
      .catch(() => {
        if (!cancelled) setPayloadBytes(0)
      })
    return () => {
      cancelled = true
    }
  }, [selected])

  /** Keep the URL shareable: `?model=` and `?state=` always name the view. */
  const syncLocation = useCallback((id: AssetId, state: ModelState | undefined) => {
    const url = new URL(window.location.href)
    url.searchParams.set('model', id)
    if (state) url.searchParams.set('state', state)
    else url.searchParams.delete('state')
    window.history.replaceState(null, '', url)
  }, [])

  function selectModel(id: AssetId) {
    const entry = MODEL_LIBRARY_ENTRIES.find((candidate) => candidate.id === id)!
    setSelectedId(id)
    setModelStats(null)
    const nextState = resolveModelState(entry.asset, 'idle')
    setRequestedState(nextState)
    syncLocation(id, nextState)
  }

  function requestState(state: ModelState) {
    setRequestedState(state)
    syncLocation(selectedId, state)
  }

  function patchControls(patch: Partial<StageControlsState>) {
    setControls((current) => ({ ...current, ...patch }))
  }

  function clearFilters() {
    setQuery('')
    setShow('all')
    setCategory('all')
  }

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <p className={styles.eyebrow}>World asset registry</p>
          <h1>Model Library</h1>
        </div>
        <div className={styles.topbarActions}>
          <span className={styles.summary}>{COUNTS.ready} ready · {COUNTS.pending} awaiting art</span>
          <Link href="/biomes" className={styles.secondaryLink}>Biomes</Link>
          <Link href="/play" className={styles.primaryLink}>Enter world</Link>
          <Link href="/debug/animation" className={styles.secondaryLink}>Animation lab</Link>
          <Link href="/" className={styles.secondaryLink}>Menu</Link>
        </div>
      </header>

      <div className={styles.workspace}>
        <CatalogPanel
          counts={COUNTS}
          visible={visible}
          disabled={disabled}
          selectedId={selectedId}
          query={query}
          show={show}
          category={category}
          onQuery={setQuery}
          onShow={setShow}
          onCategory={setCategory}
          onSelect={selectModel}
          onClearFilters={clearFilters}
        />

        <PreviewStage
          id={selectedId}
          label={selectedEntry.label}
          asset={selected}
          states={states}
          state={previewState}
          controls={controls}
          onControls={patchControls}
          onState={requestState}
          onLoadStats={setModelStats}
        />

        <InspectorPanel
          entry={selectedEntry}
          asset={selected}
          selectedId={selectedId}
          states={states}
          previewState={previewState}
          modelStats={modelStats}
          payloadBytes={payloadBytes}
          isDisabled={disabled[selectedId] === true}
          onRequestState={requestState}
          onEnabled={setEnabled}
          onReset={reset}
        />
      </div>
    </main>
  )
}
