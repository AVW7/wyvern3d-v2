'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'
import { ASSETS, type AssetId, type ModelState } from '@/render/assets/manifest'
import { useModelLibraryStore } from '@/state/modelLibraryStore'
import styles from './models.module.css'

const ModelPreview = dynamic(() => import('./ModelPreview').then((module) => module.ModelPreview), {
  ssr: false,
  loading: () => <div className={styles.previewLoading}>Preparing preview…</div>,
})

const LABELS: Partial<Record<AssetId, string>> = {
  'character.player': 'Arcane Handler',
  'wyvern.emberback': 'Emberback',
  'wyvern.cragwing': 'Cragwing',
  'wyvern.mirefang': 'Mirefang',
  'wyvern.frostmaw': 'Frostmaw',
  'wyvern.duskwyrm': 'Duskwyrm',
  'unit.soldier': 'Human Soldier',
  'unit.archer': 'Archer',
  'unit.cavalry': 'Cavalry',
  'unit.pikeman': 'Pikeman',
  'building.hatchery': 'Hatchery',
  'building.barracks': 'Barracks',
  'building.infirmary': 'Infirmary',
  'building.trainingGrounds': 'Training Grounds',
  'prop.tree': 'Tree',
  'prop.rock': 'Rock',
  'wildlife.deer': 'Deer',
  'library.alchemistWorkstation': 'Arcane Alchemist Workstation',
  'library.forestWyvernDisplay': 'Forest Wyvern Display',
  'library.arcaneAcademyCrest': 'Arcane Academy Crest',
  'library.throneOfBooks': 'Throne of Books',
}

function labelFor(id: AssetId): string {
  return LABELS[id] ?? id.split('.').at(-1) ?? id
}

function categoryFor(id: AssetId): string {
  const category = id.split('.')[0]
  if (category === 'character') return 'Player'
  if (category === 'library') return 'Imported'
  return `${category![0]!.toUpperCase()}${category!.slice(1)}`
}

export function ModelLibrary() {
  const disabled = useModelLibraryStore((store) => store.disabled)
  const setEnabled = useModelLibraryStore((store) => store.setEnabled)
  const reset = useModelLibraryStore((store) => store.reset)
  const [query, setQuery] = useState('')
  const [show, setShow] = useState<'all' | 'ready' | 'pending'>('all')
  const [selectedId, setSelectedId] = useState<AssetId>('character.player')

  const entries = useMemo(() => Object.entries(ASSETS) as [AssetId, (typeof ASSETS)[AssetId]][], [])
  const visible = entries.filter(([id, asset]) => {
    const matchesQuery = `${id} ${labelFor(id)}`.toLowerCase().includes(query.toLowerCase())
    const matchesStatus = show === 'all' || (show === 'ready' ? Boolean(asset.url) : !asset.url)
    return matchesQuery && matchesStatus
  })
  const selected = ASSETS[selectedId]!
  const states = Object.keys(selected.animations) as ModelState[]
  const [requestedState, setRequestedState] = useState<ModelState>('idle')
  const previewState = states.includes(requestedState) ? requestedState : (states[0] ?? 'idle')
  const readyCount = entries.filter(([, asset]) => asset.url).length

  function selectModel(id: AssetId) {
    setSelectedId(id)
    const nextStates = Object.keys(ASSETS[id]!.animations) as ModelState[]
    setRequestedState(nextStates.includes('idle') ? 'idle' : (nextStates[0] ?? 'idle'))
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>World asset registry</p>
          <h1>Model Library</h1>
          <p className={styles.lede}>Preview every logical model slot and choose which finished assets the world uses.</p>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.summary}>{readyCount} ready · {entries.length - readyCount} awaiting art</span>
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
              placeholder="Search models…"
            />
            <div className={styles.filters}>
              {(['all', 'ready', 'pending'] as const).map((filter) => (
                <button key={filter} data-active={show === filter} onClick={() => setShow(filter)}>{filter}</button>
              ))}
            </div>
          </div>
          <div className={styles.list}>
            {visible.map(([id, asset]) => {
              const enabled = disabled[id] !== true
              return (
                <button
                  className={styles.modelRow}
                  data-selected={selectedId === id}
                  key={id}
                  onClick={() => selectModel(id)}
                >
                  <span className={styles.modelGlyph} data-ready={Boolean(asset.url)}>{asset.url ? '◆' : '◇'}</span>
                  <span className={styles.modelIdentity}>
                    <strong>{labelFor(id)}</strong>
                    <small>{categoryFor(id)} · {asset.url ? (enabled ? 'active' : 'disabled') : 'placeholder'}</small>
                  </span>
                  <span className={styles.rowState} data-enabled={asset.url && enabled} />
                </button>
              )
            })}
          </div>
        </aside>

        <section className={styles.stage} aria-label={`${labelFor(selectedId)} preview`}>
          <ModelPreview id={selectedId} state={previewState} />
          <div className={styles.stageLabel}>
            <span>Live preview</span>
            <strong>{labelFor(selectedId)}</strong>
          </div>
          <div className={styles.orbitHint}>Drag to orbit · scroll to zoom</div>
        </section>

        <aside className={styles.inspector} aria-label="Selected model settings">
          <p className={styles.eyebrow}>{categoryFor(selectedId)}</p>
          <h2>{labelFor(selectedId)}</h2>
          <code>{selectedId}</code>

          <div className={styles.statusCard} data-ready={Boolean(selected.url)}>
            <span>{selected.url ? 'Production model' : 'Procedural placeholder'}</span>
            <strong>{selected.url ? 'Ready' : 'Awaiting art'}</strong>
          </div>

          <dl className={styles.details}>
            <div><dt>Source</dt><dd>{selected.url ?? 'No GLB assigned'}</dd></div>
            <div><dt>World scale</dt><dd>{selected.scale.toFixed(4)}</dd></div>
            <div><dt>Animations</dt><dd>{states.length}</dd></div>
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
              {states.length === 0 && <option value="idle">No animation</option>}
              {states.map((state) => <option key={state} value={state}>{state}</option>)}
            </select>
          </div>

          <button className={styles.resetButton} onClick={reset}>Enable all finished models</button>
          <p className={styles.safety}>Visual selection only. Combat values, collision, economy, and saves are unchanged.</p>
        </aside>
      </section>
    </main>
  )
}
