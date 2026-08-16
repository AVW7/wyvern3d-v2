'use client'

import React from 'react'
import { useMapUiStore } from '@/state/mapUiStore'
import { ATLAS_LAYER_LIST } from '@/core/state/atlasLayers'

function LayerIcon({ icon }: { icon: string }) {
  switch (icon) {
    case 'flag':
      return (
        <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2" fill="none">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" />
        </svg>
      )
    case 'mountain':
      return (
        <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2" fill="none">
          <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
        </svg>
      )
    case 'coins':
      return (
        <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2" fill="none">
          <ellipse cx="12" cy="7" rx="8" ry="4" />
          <path d="M4 7v6c0 2.21 3.58 4 8 4s8-1.79 8-4V7" />
          <path d="M4 13v6c0 2.21 3.58 4 8 4s8-1.79 8-4v-6" />
        </svg>
      )
    case 'flame':
      return (
        <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2" fill="none">
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
        </svg>
      )
    case 'shield':
      return (
        <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2" fill="none">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      )
    case 'paw':
      return (
        <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2" fill="none">
          <circle cx="12" cy="14" r="4" />
          <circle cx="6.5" cy="8.5" r="2.5" />
          <circle cx="17.5" cy="8.5" r="2.5" />
          <circle cx="10" cy="4.5" r="2" />
          <circle cx="14" cy="4.5" r="2" />
        </svg>
      )
    case 'compass':
      return (
        <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2" fill="none">
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      )
    default:
      return null
  }
}

/**
 * World Atlas Strategic Layer Switcher (Atlas Stage 3).
 * Allows players to switch between the 7 mutually exclusive map data projections.
 */
export function AtlasLayerBar() {
  const activeLayer = useMapUiStore((s) => s.activeLayer)
  const setActiveLayer = useMapUiStore((s) => s.setActiveLayer)

  return (
    <div className="atlas-layer-bar liquid-glass" role="toolbar" aria-label="Strategic Map Layers">
      <span className="atlas-layer-bar-label">Layers</span>
      <div className="atlas-layer-pills">
        {ATLAS_LAYER_LIST.map((layer) => {
          const isActive = activeLayer === layer.id
          return (
            <button
              key={layer.id}
              className={`atlas-layer-pill ${isActive ? 'active' : ''}`}
              onClick={() => setActiveLayer(layer.id)}
              title={`${layer.name}: ${layer.description}`}
              aria-pressed={isActive}
            >
              <span className="atlas-layer-icon">
                <LayerIcon icon={layer.iconName} />
              </span>
              <span className="atlas-layer-text">{layer.shortLabel}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
