'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { AssetId, ModelState } from '@/render/assets/manifest'
import { useModelLibraryHydration, useModelLibraryStore } from '@/state/modelLibraryStore'
import {
  MODEL_LIBRARY_ENTRIES,
  filterModels,
  modelCounts,
  type CategoryFilter,
  type StatusFilter,
} from './catalog'
import { CatalogPanel } from './components/CatalogPanel'
import { InspectorPanel } from './components/InspectorPanel'
import { PreviewStage, type ModelStats } from './components/PreviewStage'
import styles from './models.module.css'

const COUNTS = modelCounts(MODEL_LIBRARY_ENTRIES)

export function ModelLibrary({ initialId = 'character.player' }: { initialId?: AssetId }) {
  useModelLibraryHydration()
  const disabled = useModelLibraryStore((store) => store.disabled)
  const setEnabled = useModelLibraryStore((store) => store.setEnabled)
  const reset = useModelLibraryStore((store) => store.reset)
  const [query, setQuery] = useState('')
  const [show, setShow] = useState<StatusFilter>('all')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [selectedId, setSelectedId] = useState<AssetId>(initialId)
  const [requestedState, setRequestedState] = useState<ModelState>('idle')
  const [modelStats, setModelStats] = useState<ModelStats | null>(null)

  const visible = useMemo(
    () => filterModels(MODEL_LIBRARY_ENTRIES, query, show, category),
    [query, show, category],
  )
  const selectedEntry = MODEL_LIBRARY_ENTRIES.find((entry) => entry.id === selectedId)!
  const selected = selectedEntry.asset
  const states = Object.keys(selected.animations) as ModelState[]
  const previewState = states.includes(requestedState) ? requestedState : (states[0] ?? 'idle')

  function selectModel(id: AssetId) {
    setSelectedId(id)
    setModelStats(null)
    const nextStates = Object.keys(MODEL_LIBRARY_ENTRIES.find((entry) => entry.id === id)!.asset.animations) as ModelState[]
    setRequestedState(nextStates.includes('idle') ? 'idle' : (nextStates[0] ?? 'idle'))
    const url = new URL(window.location.href)
    url.searchParams.set('model', id)
    window.history.replaceState(null, '', url)
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
          <Link href="/play" className={styles.primaryLink}>Enter world</Link>
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
          state={previewState}
          onLoadStats={setModelStats}
        />

        <InspectorPanel
          entry={selectedEntry}
          asset={selected}
          selectedId={selectedId}
          states={states}
          previewState={previewState}
          modelStats={modelStats}
          isDisabled={disabled[selectedId] === true}
          onRequestState={setRequestedState}
          onEnabled={setEnabled}
          onReset={reset}
        />
      </div>
    </main>
  )
}
