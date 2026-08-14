'use client'

import React from 'react'
import type { AtlasDirectoryEntry } from '@/core/state/atlasDirectory'

export interface AtlasRowProps {
  entry: AtlasDirectoryEntry
  selected: boolean
  /** Knowledge-approved species display name, null when unknown. */
  speciesName: string | null
  onSelect: () => void
}

/**
 * One region row in the atlas directory. Locked fields state how they are
 * discovered instead of guessing content.
 */
export function AtlasRow({ entry, selected, speciesName, onSelect }: AtlasRowProps) {
  return (
    <button
      className={`atlas-row ${selected ? 'selected' : ''}`}
      onClick={onSelect}
      role="option"
      aria-selected={selected}
    >
      <span className="atlas-row-top">
        <span className="atlas-row-name">{entry.name}</span>
        <span className={`region-status ${entry.status}`}>{entry.status}</span>
      </span>
      <span className="atlas-row-meta">
        Tier {entry.tier} • {entry.biome}
        {entry.visited ? ' • visited' : ''}
        {/* Landmark counts stay hidden until the region is mapped. */}
        {entry.mapped &&
          entry.totalLandmarks > 0 &&
          ` • ✦ ${entry.discoveredLandmarks}/${entry.totalLandmarks}`}
        {/* Observed phenomena are their own knowledge — no mapped gate needed. */}
        {entry.observedPhenomenon && ` • ◉ ${entry.observedPhenomenon}`}
      </span>
      <span className="atlas-row-detail">
        {entry.mapped ? (
          <>
            <span className="atlas-row-species">{speciesName ?? 'Unknown species'}</span>
            {entry.climateTags && entry.climateTags.length > 0 && (
              <span className="atlas-row-tags">{entry.climateTags.join(', ')}</span>
            )}
          </>
        ) : entry.observedPhenomenon ? (
          <span className="atlas-row-locked">
            Unmapped — but its {entry.observedPhenomenon.toLowerCase()} has been observed and recorded.
          </span>
        ) : (
          <span className="atlas-row-locked">
            Unmapped — chart this region from an adjacent holding to reveal its details.
          </span>
        )}
      </span>
    </button>
  )
}
