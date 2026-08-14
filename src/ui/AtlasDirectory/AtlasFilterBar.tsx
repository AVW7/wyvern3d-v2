'use client'

import React from 'react'
import type { AtlasDirectoryQuery, AtlasFacets, AtlasStatusFilter } from '@/core/state/atlasDirectory'

export interface AtlasFilterBarProps {
  query: AtlasDirectoryQuery
  onChange: (query: AtlasDirectoryQuery) => void
  facets: AtlasFacets
  onClear: () => void
  active: boolean
}

const STATUS_OPTIONS: { value: AtlasStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'held', label: 'Held' },
  { value: 'reachable', label: 'Reachable' },
  { value: 'locked', label: 'Locked' },
  { value: 'visited', label: 'Visited' },
  { value: 'unvisited', label: 'Unvisited' },
]

const RESOURCE_ICONS: Record<string, string> = {
  food: '🌾',
  gold: '💰',
  ore: '⛏',
  timber: '🪵',
  arcane: '✨',
  water: '💧',
  iron: '🧱',
}

/** Search + compound filters for the atlas drawer. Pure props, no store reads. */
export function AtlasFilterBar({ query, onChange, facets, onClear, active }: AtlasFilterBarProps) {
  const set = <K extends keyof AtlasDirectoryQuery>(key: K, value: AtlasDirectoryQuery[K]) =>
    onChange({ ...query, [key]: value })

  return (
    <div className="atlas-filters">
      <div className="atlas-search-row">
        <input
          className="atlas-search"
          type="search"
          value={query.search}
          onChange={(e) => set('search', e.target.value)}
          placeholder="Search regions…"
          aria-label="Search regions"
        />
        {active && (
          <button className="region-btn confirm atlas-clear-btn" onClick={onClear} title="Clear all filters">
            Clear
          </button>
        )}
      </div>

      <div className="atlas-filter-row" role="group" aria-label="Status filter">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`atlas-chip ${query.status === opt.value ? 'active' : ''}`}
            onClick={() => set('status', opt.value)}
            aria-pressed={query.status === opt.value}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="atlas-filter-row">
        <select
          className="atlas-select"
          value={query.biome}
          onChange={(e) => set('biome', e.target.value)}
          aria-label="Filter by biome"
        >
          <option value="all">All biomes</option>
          {facets.biomes.map((f) => (
            <option key={f.value} value={f.value}>
              {f.value} ({f.count})
            </option>
          ))}
        </select>

        <select
          className="atlas-select"
          value={query.tier}
          onChange={(e) => set('tier', e.target.value === 'all' ? 'all' : Number(e.target.value))}
          aria-label="Filter by tier"
        >
          <option value="all">All tiers</option>
          {facets.tiers.map((f) => (
            <option key={f.value} value={f.value}>
              Tier {f.value} ({f.count})
            </option>
          ))}
        </select>

        <select
          className="atlas-select"
          value={query.resource}
          onChange={(e) => set('resource', e.target.value)}
          aria-label="Filter by resource"
        >
          <option value="all">All resources</option>
          {facets.resources.map((f) => (
            <option key={f.value} value={f.value}>
              {RESOURCE_ICONS[f.value] ?? ''} {f.value} ({f.count})
            </option>
          ))}
        </select>

        <select
          className="atlas-select"
          value={query.species}
          onChange={(e) => set('species', e.target.value)}
          aria-label="Filter by native species"
        >
          <option value="all">All species</option>
          {facets.species.map((f) => (
            <option key={f.value} value={f.value}>
              {f.value} ({f.count})
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
