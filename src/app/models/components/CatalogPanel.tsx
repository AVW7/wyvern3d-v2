'use client'

import { useEffect, useMemo, useRef } from 'react'
import type { AssetId } from '@/render/assets/manifest'
import {
  MODEL_LIBRARY_CATEGORIES,
  statusFor,
  stepSelection,
  type CategoryFilter,
  type ModelLibraryEntry,
  type StatusFilter,
} from '../catalog'
import styles from '../models.module.css'

interface CatalogPanelProps {
  counts: { total: number; ready: number; pending: number; categories: Record<string, number> }
  visible: ModelLibraryEntry[]
  disabled: Partial<Record<AssetId, boolean>>
  selectedId: AssetId
  query: string
  show: StatusFilter
  category: CategoryFilter
  onQuery: (value: string) => void
  onShow: (value: StatusFilter) => void
  onCategory: (value: CategoryFilter) => void
  onSelect: (id: AssetId) => void
  onClearFilters: () => void
}

export function CatalogPanel({
  counts,
  visible,
  disabled,
  selectedId,
  query,
  show,
  category,
  onQuery,
  onShow,
  onCategory,
  onSelect,
  onClearFilters,
}: CatalogPanelProps) {
  const selectedRow = useRef<HTMLButtonElement>(null)
  const navFromKeyboard = useRef(false)

  const groups = useMemo(() => {
    const map = new Map<string, ModelLibraryEntry[]>()
    for (const entry of visible) map.set(entry.category, [...(map.get(entry.category) ?? []), entry])
    return map
  }, [visible])

  useEffect(() => {
    selectedRow.current?.scrollIntoView({ block: 'nearest' })
    if (navFromKeyboard.current) {
      navFromKeyboard.current = false
      selectedRow.current?.focus({ preventScroll: true })
    }
  }, [selectedId])

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const delta =
      event.key === 'ArrowDown' ? 1
      : event.key === 'ArrowUp' ? -1
      : event.key === 'Home' ? -visible.length
      : event.key === 'End' ? visible.length
      : 0
    if (delta === 0) return
    event.preventDefault()
    const next = stepSelection(visible, selectedId, delta)
    if (next === selectedId) return
    navFromKeyboard.current = true
    onSelect(next)
  }

  return (
    <aside className={styles.catalog} aria-label="Model catalog">
      <div className={styles.tools}>
        <input
          aria-label="Search models"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search name, id, or category…"
        />
        <div className={styles.toolRow}>
          <label className={styles.categoryPicker}>
            <span>Category</span>
            <select value={category} onChange={(event) => onCategory(event.target.value as CategoryFilter)}>
              <option value="all">All categories ({counts.total})</option>
              {MODEL_LIBRARY_CATEGORIES.map((name) => (
                <option key={name} value={name}>{name} ({counts.categories[name]})</option>
              ))}
            </select>
          </label>
          <div className={styles.filters} role="group" aria-label="Model readiness">
            {(['all', 'ready', 'pending'] as const).map((filter) => (
              <button key={filter} data-active={show === filter} aria-pressed={show === filter} onClick={() => onShow(filter)}>
                {filter}<span>{filter === 'all' ? counts.total : counts[filter]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.list} aria-live="polite" onKeyDown={handleKeyDown}>
        {visible.length === 0 && (
          <div className={styles.emptyState}>
            <strong>No matching models</strong>
            <span>Try another search or reset the catalog filters.</span>
            <button onClick={onClearFilters}>Clear filters</button>
          </div>
        )}
        {[...groups.entries()].map(([group, entries]) => (
          <section className={styles.modelGroup} key={group} aria-labelledby={`group-${group}`}>
            <h2 id={`group-${group}`}>{group}<span>{entries.length}</span></h2>
            {entries.map(({ id, asset, label }) => {
              const itemStatus = statusFor(asset, disabled[id] === true)
              const isSelected = selectedId === id
              return (
                <button
                  ref={isSelected ? selectedRow : undefined}
                  className={styles.modelRow}
                  data-selected={isSelected}
                  aria-pressed={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  key={id}
                  onClick={() => onSelect(id)}
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
  )
}
