'use client'

import { useEffect, useMemo, useRef } from 'react'
import shell from '../../models/models.module.css'
import {
  familyLabel,
  stepSelection,
  type BiomePropEntry,
  type FamilyFilter,
  type UsageFilter,
} from '../catalog'

interface PropCatalogPanelProps {
  counts: { total: number; built: number; unused: number; families: Record<string, number> }
  families: string[]
  visible: BiomePropEntry[]
  selectedId: string
  query: string
  family: FamilyFilter
  usage: UsageFilter
  onQuery: (value: string) => void
  onFamily: (value: FamilyFilter) => void
  onUsage: (value: UsageFilter) => void
  onSelect: (id: string) => void
  onClearFilters: () => void
}

export function PropCatalogPanel({
  counts,
  families,
  visible,
  selectedId,
  query,
  family,
  usage,
  onQuery,
  onFamily,
  onUsage,
  onSelect,
  onClearFilters,
}: PropCatalogPanelProps) {
  const selectedRow = useRef<HTMLButtonElement>(null)
  const navFromKeyboard = useRef(false)

  const groups = useMemo(() => {
    const map = new Map<string, BiomePropEntry[]>()
    for (const prop of visible) map.set(prop.family, [...(map.get(prop.family) ?? []), prop])
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
    const next = stepSelection(visible, selectedId, event.key)
    if (!next) return
    event.preventDefault()
    if (next === selectedId) return
    navFromKeyboard.current = true
    onSelect(next)
  }

  return (
    <aside className={shell.catalog} aria-label="Biome prop catalog">
      <div className={shell.tools}>
        <input
          aria-label="Search biome props"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search name, id, source file, or biome…"
        />
        <div className={shell.toolRow}>
          <label className={shell.categoryPicker}>
            <span>Family</span>
            <select value={family} onChange={(event) => onFamily(event.target.value as FamilyFilter)}>
              <option value="all">All families ({counts.total})</option>
              {families.map((name) => (
                <option key={name} value={name}>
                  {familyLabel(name)} ({counts.families[name] ?? 0})
                </option>
              ))}
            </select>
          </label>
          <div className={shell.filters} role="group" aria-label="Dressing usage">
            {(['all', 'used', 'unused'] as const).map((filter) => (
              <button
                key={filter}
                data-active={usage === filter}
                aria-pressed={usage === filter}
                onClick={() => onUsage(filter)}
              >
                {filter}
                <span>{filter === 'all' ? counts.total : filter === 'unused' ? counts.unused : counts.total - counts.unused}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={shell.list} aria-live="polite" onKeyDown={handleKeyDown}>
        {visible.length === 0 && (
          <div className={shell.emptyState}>
            <strong>No matching props</strong>
            <span>Try another search, or clear the family and usage filters.</span>
            <button onClick={onClearFilters}>Clear filters</button>
          </div>
        )}
        {[...groups.entries()].map(([group, props]) => (
          <section className={shell.modelGroup} key={group} aria-labelledby={`family-${group}`}>
            <h2 id={`family-${group}`}>
              {familyLabel(group)}
              <span>{props.length}</span>
            </h2>
            {props.map((prop) => {
              const isSelected = selectedId === prop.id
              const status = !prop.measured ? 'disabled' : prop.usedBy.length ? 'ready' : 'pending'
              return (
                <button
                  ref={isSelected ? selectedRow : undefined}
                  className={shell.modelRow}
                  data-selected={isSelected}
                  aria-pressed={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  key={prop.id}
                  onClick={() => onSelect(prop.id)}
                >
                  <span className={shell.modelGlyph} data-ready={Boolean(prop.measured)}>
                    {prop.measured ? '◆' : '◇'}
                  </span>
                  <span className={shell.modelIdentity}>
                    <strong>{prop.label}</strong>
                    <small>
                      {prop.measured ? `${prop.measured.height.toFixed(1)} m · ${prop.measured.triangles} tris` : 'not built'}
                    </small>
                  </span>
                  <span
                    className={shell.rowState}
                    data-status={status}
                    title={status === 'ready' ? 'in use' : status === 'pending' ? 'built, unused' : 'not in the atlas'}
                  />
                </button>
              )
            })}
          </section>
        ))}
      </div>
    </aside>
  )
}
