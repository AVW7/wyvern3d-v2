'use client'

import React, { useState } from 'react'
import { useGame, useGameState } from '@/state/store'
import { useMapUiStore } from '@/state/mapUiStore'
import { REGIONS } from '@/core/data/regions'
import {
  ATLAS_LAYERS,
  getAtlasLayerLegend,
  getRegionLayerValue,
} from '@/core/state/atlasLayers'
import { legendShapeCue } from '@/core/state/atlasA11y'

/**
 * World Atlas Strategic Map Legend (Atlas Stage 3).
 * Explains the active layer's color scale, classifications, and currently inspected region metrics.
 */
export function AtlasLegend() {
  const mode = useGame((s) => s.mode)
  const state = useGameState()
  const activeLayer = useMapUiStore((s) => s.activeLayer)
  const hovered = useMapUiStore((s) => s.hovered)
  const inspected = useMapUiStore((s) => s.inspected)
  const selectedRegion = useGame((s) => s.selectedRegion)

  const [collapsed, setCollapsed] = useState(false)

  if (mode !== 'worldmap') return null

  const layerDef = ATLAS_LAYERS[activeLayer]
  const legendItems = getAtlasLayerLegend(activeLayer)
  const activeRegionId = hovered ?? inspected ?? selectedRegion
  const activeRegionDef = activeRegionId ? REGIONS[activeRegionId] : null
  const activeRegionValue = activeRegionId
    ? getRegionLayerValue(state, activeRegionId, activeLayer)
    : null

  if (collapsed) {
    return (
      <div className="atlas-legend-collapsed liquid-glass">
        <button
          className="atlas-legend-expand-btn"
          onClick={() => setCollapsed(false)}
          title={`Expand ${layerDef.shortLabel} Legend`}
        >
          <span className="legend-dot" style={{ background: legendItems[0]?.color ?? '#38bdf8' }} />
          <span>{layerDef.shortLabel} Legend</span>
          <span className="toggle-icon">+</span>
        </button>
      </div>
    )
  }

  return (
    <div className="atlas-legend liquid-glass" role="region" aria-label="Atlas Map Legend">
      <div className="atlas-legend-header">
        <div className="atlas-legend-title">
          <h4>{layerDef.name}</h4>
          <span className="atlas-legend-subtitle">{layerDef.description}</span>
        </div>
        <button
          className="widget-icon-btn"
          onClick={() => setCollapsed(true)}
          title="Collapse Legend"
          aria-label="Collapse legend"
        >
          −
        </button>
      </div>

      <div className="atlas-legend-scale">
        {legendItems.map((item, index) => (
          <div key={item.label} className="atlas-legend-row">
            <span className="legend-swatch" style={{ backgroundColor: item.color }}>
              {/* Color-independent cue: same index, same glyph, whatever the color. */}
              <span aria-hidden="true">{legendShapeCue(index)}</span>
            </span>
            <span className="legend-label">{item.label}</span>
            {item.description && <span className="legend-desc">{item.description}</span>}
          </div>
        ))}
      </div>

      {activeRegionDef && activeRegionValue && (
        <div className="atlas-legend-focus">
          <div className="focus-header">
            <span className="focus-name">{activeRegionDef.name}</span>
            <span className="focus-badge" style={{ backgroundColor: activeRegionValue.color }}>
              {activeRegionValue.displayValue}
            </span>
          </div>
          {activeRegionValue.detail && (
            <span className="focus-detail">{activeRegionValue.detail}</span>
          )}
        </div>
      )}
    </div>
  )
}
