'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AssetId, ModelState } from '@/render/assets/manifest'
import { useModelLibraryStore } from '@/state/modelLibraryStore'
import {
  MODEL_LIBRARY_CATEGORIES,
  MODEL_LIBRARY_ENTRIES,
  animationDetails,
  filterModels,
  modelCounts,
  statusFor,
  type CategoryFilter,
  type StatusFilter,
} from './catalog'
import styles from './models.module.css'

const ModelPreview = dynamic(() => import('./ModelPreview').then((module) => module.ModelPreview), {
  ssr: false,
  loading: () => <div className={styles.previewLoading}>Preparing 3D preview…</div>,
})

const COUNTS = modelCounts(MODEL_LIBRARY_ENTRIES)

export function ModelLibrary({ initialId = 'character.player' }: { initialId?: AssetId }) {
  const disabled = useModelLibraryStore((store) => store.disabled)
  const setEnabled = useModelLibraryStore((store) => store.setEnabled)
  const reset = useModelLibraryStore((store) => store.reset)
  const [query, setQuery] = useState('')
  const [show, setShow] = useState<StatusFilter>('all')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [selectedId, setSelectedId] = useState<AssetId>(initialId)
  const [requestedState, setRequestedState] = useState<ModelState>('idle')
  const selectedRow = useRef<HTMLButtonElement>(null)

  const visible = useMemo(
    () => filterModels(MODEL_LIBRARY_ENTRIES, query, show, category),
    [query, show, category],
  )
  const grouped = useMemo(() => {
    const groups = new Map<string, typeof visible>()
    for (const entry of visible) groups.set(entry.category, [...(groups.get(entry.category) ?? []), entry])
    return groups
  }, [visible])
  const selectedEntry = MODEL_LIBRARY_ENTRIES.find((entry) => entry.id === selectedId)!
  const selected = selectedEntry.asset
  const states = Object.keys(selected.animations) as ModelState[]
  const previewState = states.includes(requestedState) ? requestedState : (states[0] ?? 'idle')
  const currentStatus = statusFor(selected, disabled[selectedId] === true)
  const mappedAnimations = states.map((state) => animationDetails(state, selected.animations[state]!))

  const [modelStats, setModelStats] = useState<{
    triangles: number
    bones: number
    materials: number
    boneNames: string[]
  } | null>(null)

  useEffect(() => {
    selectedRow.current?.scrollIntoView({ block: 'nearest' })
    setModelStats(null)
  }, [selectedId])

  function selectModel(id: AssetId) {
    setSelectedId(id)
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
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>World asset registry</p>
          <h1>Model Library</h1>
          <p className={styles.lede}>Browse every logical model slot, inspect animation mappings, and choose which finished assets the world uses.</p>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.summary}>{COUNTS.ready} ready · {COUNTS.pending} awaiting art</span>
          <Link href="/play" className={styles.primaryLink}>Enter world</Link>
          <Link href="/" className={styles.secondaryLink}>Menu</Link>
        </div>
      </header>

      <section className={styles.workspace}>
        <aside className={styles.catalog} aria-label="Model catalog">
          <div className={styles.tools}>
            <input
              aria-label="Search models"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, id, or category…"
            />
            <label className={styles.categoryPicker}>
              <span>Category</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="all">All categories ({COUNTS.total})</option>
                {MODEL_LIBRARY_CATEGORIES.map((name) => (
                  <option key={name} value={name}>{name} ({COUNTS.categories[name]})</option>
                ))}
              </select>
            </label>
            <div className={styles.filters} aria-label="Model readiness">
              {(['all', 'ready', 'pending'] as const).map((filter) => (
                <button key={filter} data-active={show === filter} onClick={() => setShow(filter)}>
                  {filter}<span>{filter === 'all' ? COUNTS.total : COUNTS[filter]}</span>
                </button>
              ))}
            </div>
          </div>
          <div className={styles.list} aria-live="polite">
            {visible.length === 0 && (
              <div className={styles.emptyState}>
                <strong>No matching models</strong>
                <span>Try another search or reset the catalog filters.</span>
                <button onClick={clearFilters}>Clear filters</button>
              </div>
            )}
            {[...grouped.entries()].map(([group, entries]) => (
              <section className={styles.modelGroup} key={group} aria-labelledby={`group-${group}`}>
                <h2 id={`group-${group}`}>{group}<span>{entries.length}</span></h2>
                {entries.map(({ id, asset, label }) => {
                  const itemStatus = statusFor(asset, disabled[id] === true)
                  return (
                    <button
                      ref={selectedId === id ? selectedRow : undefined}
                      className={styles.modelRow}
                      data-selected={selectedId === id}
                      aria-pressed={selectedId === id}
                      key={id}
                      onClick={() => selectModel(id)}
                    >
                      <span className={styles.modelGlyph} data-ready={Boolean(asset.url)}>{asset.url ? '◆' : '◇'}</span>
                      <span className={styles.modelIdentity}>
                        <strong>{label}</strong>
                        <small>{id}</small>
                      </span>
                      <span className={styles.rowState} data-status={itemStatus} title={itemStatus} />
                    </button>
                  )
                })}
              </section>
            ))}
          </div>
        </aside>

        <section className={styles.stage} aria-label={`${selectedEntry.label} preview`}>
          <ModelPreview id={selectedId} state={previewState} onLoadStats={setModelStats} />
          <div className={styles.stageLabel}>
            <span>{selected.url ? 'Live production preview' : 'Gameplay-safe placeholder'}</span>
            <strong>{selectedEntry.label}</strong>
          </div>
          {!selected.url && <div className={styles.placeholderNotice}>No GLB assigned — showing the procedural fallback</div>}
          <div className={styles.orbitHint}>Drag to orbit · scroll to zoom</div>
        </section>

        <aside className={styles.inspector} aria-label="Selected model settings">
          <div className={styles.inspectorHeading}>
            <p className={styles.eyebrow}>{selectedEntry.category}</p>
            <h2>{selectedEntry.label}</h2>
            <code>{selectedId}</code>
          </div>

          <div className={styles.statusCard} data-status={currentStatus}>
            <span>{currentStatus === 'pending' ? 'Procedural placeholder' : 'Production model'}</span>
            <strong>{currentStatus === 'ready' ? 'Active' : currentStatus === 'disabled' ? 'Disabled' : 'Awaiting art'}</strong>
          </div>

          <dl className={styles.details}>
            <div><dt>Source</dt><dd>{selected.url ?? 'No GLB assigned'}</dd></div>
            <div><dt>World scale</dt><dd>{selected.scale.toFixed(4)}</dd></div>
            <div><dt>Root offset</dt><dd>{selected.yOffset ?? 0}</dd></div>
            {modelStats && (
              <>
                <div><dt>Polygons (tris)</dt><dd>{modelStats.triangles.toLocaleString()}</dd></div>
                <div><dt>Bones (rig)</dt><dd>{modelStats.bones}</dd></div>
                <div><dt>Materials</dt><dd>{modelStats.materials}</dd></div>
              </>
            )}
            <div><dt>Model states</dt><dd>{states.length}</dd></div>
            <div><dt>Fallback</dt><dd>Gameplay-safe</dd></div>
          </dl>

          <label className={styles.toggle} data-disabled={!selected.url}>
            <span><strong>Use in world</strong><small>Switches to the procedural fallback when off.</small></span>
            <input
              type="checkbox"
              checked={selected.url ? disabled[selectedId] !== true : false}
              disabled={!selected.url}
              onChange={(event) => setEnabled(selectedId, event.target.checked)}
            />
          </label>

          <div className={styles.animationPicker}>
            <label htmlFor="model-animation">Preview animation</label>
            <select
              id="model-animation"
              value={previewState}
              disabled={states.length === 0}
              onChange={(event) => setRequestedState(event.target.value as ModelState)}
            >
              {states.length === 0 && <option value="idle">No mapped animation</option>}
              {states.map((state) => <option key={state} value={state}>{state}</option>)}
            </select>
          </div>

          <section className={styles.animationMap} aria-labelledby="animation-map-title">
            <div className={styles.sectionHeading}>
              <h3 id="animation-map-title">Animation map</h3>
              <span>{states.length}</span>
            </div>
            {mappedAnimations.length === 0 ? (
              <p className={styles.noAnimations}>This model has no mapped animation states.</p>
            ) : mappedAnimations.map(({ state, clips }) => (
              <details key={state} open={state === previewState}>
                <summary>{state}<span>{clips.length > 1 ? `${clips.length} clips` : '1 clip'}</span></summary>
                {clips.map((clip, index) => <code key={`${clip}-${index}`}>{clip}</code>)}
              </details>
            ))}
          </section>

          {modelStats && modelStats.boneNames.length > 0 && (
            <section className={styles.boneList} aria-labelledby="bone-list-title">
              <details>
                <summary id="bone-list-title">Rig bones <span>{modelStats.boneNames.length} bones</span></summary>
                <div className={styles.boneNamesContainer}>
                  {modelStats.boneNames.map((name) => (
                    <code key={name} className={styles.boneName}>{name}</code>
                  ))}
                </div>
              </details>
            </section>
          )}

          <button className={styles.resetButton} onClick={reset}>Enable all finished models</button>
          <p className={styles.safety}>Visual selection only. Combat values, collision, economy, and saves are unchanged.</p>
        </aside>
      </section>
    </main>
  )
}
