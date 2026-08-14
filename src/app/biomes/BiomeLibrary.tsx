'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import shell from '../models/models.module.css'
import styles from './biomes.module.css'
import {
  biomeSummaries,
  buildCatalog,
  catalogCounts,
  filterProps,
  type AtlasMeasurement,
  type FamilyFilter,
  type LibraryEntry,
  type UsageFilter,
} from './catalog'
import { BiomeOverview } from './components/BiomeOverview'
import { PropCatalogPanel } from './components/PropCatalogPanel'
import { PropInspector } from './components/PropInspector'

const BiomePropPreview = dynamic(() => import('./BiomePropPreview').then((module) => module.BiomePropPreview), {
  ssr: false,
  loading: () => <div className={shell.previewLoading}>Preparing 3D preview…</div>,
})

type View = 'props' | 'biomes'

export function BiomeLibrary({
  entries,
  measurements,
  atlasBytes,
  initialId,
}: {
  entries: LibraryEntry[]
  measurements: AtlasMeasurement[]
  /** Size of the built atlas, or 0 when it has not been built. */
  atlasBytes: number
  initialId?: string
}) {
  const props = useMemo(() => buildCatalog(entries, measurements), [entries, measurements])
  const counts = useMemo(() => catalogCounts(props), [props])
  const summaries = useMemo(() => biomeSummaries(props), [props])
  const families = useMemo(() => [...new Set(props.map((prop) => prop.family))], [props])

  const [view, setView] = useState<View>('props')
  const [query, setQuery] = useState('')
  const [family, setFamily] = useState<FamilyFilter>('all')
  const [usage, setUsage] = useState<UsageFilter>('all')
  const [selectedId, setSelectedId] = useState<string>(initialId ?? props[0]?.id ?? '')

  const visible = useMemo(() => filterProps(props, query, family, usage), [props, query, family, usage])
  const selected = props.find((prop) => prop.id === selectedId) ?? props[0]

  function selectProp(id: string) {
    setSelectedId(id)
    setView('props')
    const url = new URL(window.location.href)
    url.searchParams.set('prop', id)
    window.history.replaceState(null, '', url)
  }

  function clearFilters() {
    setQuery('')
    setFamily('all')
    setUsage('all')
  }

  return (
    <main className={shell.shell}>
      <header className={shell.topbar}>
        <div className={shell.brand}>
          <p className={shell.eyebrow}>Biome scenery atlas</p>
          <h1>Biome Library</h1>
        </div>
        <div className={shell.topbarActions}>
          <span className={shell.summary}>
            {counts.built}/{counts.total} built · {counts.triangles.toLocaleString()} tris ·{' '}
            {atlasBytes ? `${(atlasBytes / 1e6).toFixed(2)} MB` : 'atlas not built'}
          </span>
          <div className={styles.viewTabs} role="group" aria-label="View">
            {(['props', 'biomes'] as const).map((option) => (
              <button key={option} data-active={view === option} aria-pressed={view === option} onClick={() => setView(option)}>
                {option === 'props' ? 'Props' : 'Biomes'}
              </button>
            ))}
          </div>
          <Link href="/models" className={shell.secondaryLink}>Models</Link>
          <Link href="/" className={shell.secondaryLink}>Menu</Link>
        </div>
      </header>

      <div className={shell.workspace}>
        <PropCatalogPanel
          counts={counts}
          families={families}
          visible={visible}
          selectedId={selected?.id ?? ''}
          query={query}
          family={family}
          usage={usage}
          onQuery={setQuery}
          onFamily={setFamily}
          onUsage={setUsage}
          onSelect={selectProp}
          onClearFilters={clearFilters}
        />

        {view === 'biomes' ? (
          <BiomeOverview summaries={summaries} onSelectProp={selectProp} />
        ) : (
          <section className={shell.stage} aria-label={`${selected?.label ?? 'Prop'} preview`}>
            {selected?.measured ? (
              <BiomePropPreview id={selected.id} height={selected.measured.height} />
            ) : (
              <div className={shell.previewLoading}>
                This prop is not in the built atlas — run <code>pnpm assets:biome-atlas</code>
              </div>
            )}
            <div className={shell.stageLabel}>
              <span>Biome atlas preview</span>
              <strong>{selected?.label ?? '—'}</strong>
            </div>
            {selected?.measured ? (
              <div className={styles.scaleBar}>
                <span>
                  height <strong>{selected.measured.height.toFixed(2)} m</strong>
                </span>
                <span>
                  footprint{' '}
                  <strong>
                    {selected.measured.footprint[0].toFixed(2)} × {selected.measured.footprint[1].toFixed(2)} m
                  </strong>
                </span>
                <span>
                  figure <strong>1.6 m</strong>
                </span>
              </div>
            ) : null}
            <div className={shell.orbitHint}>Drag to orbit · scroll to zoom</div>
          </section>
        )}

        {selected ? <PropInspector prop={selected} /> : null}
      </div>
    </main>
  )
}
