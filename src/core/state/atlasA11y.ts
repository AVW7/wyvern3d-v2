import type { GameState } from '../types'
import { REGIONS } from '../data/regions'
import { getRegionKnowledge } from './atlasKnowledge'
import { ATLAS_LAYERS, getRegionLayerValue, type AtlasLayerId } from './atlasLayers'

/**
 * Accessibility helpers for the World Atlas (Atlas Stage 5).
 *
 * Pure, testable building blocks the atlas UI uses to stay operable without
 * a pointer or color perception: screen-reader selection summaries, a
 * color-independent shape vocabulary for legends, keyboard list traversal,
 * and viewport layout mode. No React, no three, no DOM.
 */

/**
 * Shape cue vocabulary for legend items and value badges. Index-stable so
 * the same legend row always carries the same glyph, whatever its color.
 */
const SHAPE_CUES = ['●', '▲', '■', '◆', '★', '✕', '▬', '◉'] as const

/** The color-independent cue for legend/swatch index n (wraps). */
export function legendShapeCue(index: number): string {
  if (index < 0) return SHAPE_CUES[0]!
  return SHAPE_CUES[index % SHAPE_CUES.length]!
}

/**
 * One-line screen-reader summary of the currently selected region under the
 * active layer. Speaks name, strategic status, the layer's display value and
 * the knowledge state — everything a sighted player gets from the row plus
 * the node, in one polite announcement.
 */
export function atlasSelectionSummary(
  state: GameState,
  regionId: string,
  layer: AtlasLayerId,
): string | null {
  const def = REGIONS[regionId]
  if (!def) return null

  const knowledge = getRegionKnowledge(state, regionId)
  if (!knowledge) return null

  const value = getRegionLayerValue(state, regionId, layer)
  const layerLabel = ATLAS_LAYERS[layer].shortLabel
  const status = value.isUnknown
    ? 'unknown status'
    : value.displayValue

  const parts = [
    `${def.name}. Tier ${def.tier} ${def.biome}.`,
    `${layerLabel}: ${status}${value.detail && !value.isUnknown ? `. ${value.detail}` : ''}`,
    knowledge.visited
      ? `Visited. ${knowledge.discoveredLandmarkIds.length} landmarks discovered.`
      : knowledge.mapped
        ? 'Mapped, not yet visited.'
        : 'Unmapped region.',
  ]
  return parts.join(' ')
}

/**
 * Index stepping for keyboard list traversal. Mirrors the Model Library /
 * Biome Library behaviour: Arrow/Home/End move, anything else is ignored.
 * Returns null when the key is not a list-navigation key.
 */
export function stepAtlasListIndex(visibleCount: number, index: number, key: string): number | null {
  if (visibleCount <= 0) return null
  const current = Math.max(0, Math.min(visibleCount - 1, index))
  if (key === 'Home') return 0
  if (key === 'End') return visibleCount - 1
  if (key === 'ArrowDown') return Math.min(visibleCount - 1, current + 1)
  if (key === 'ArrowUp') return Math.max(0, current - 1)
  return null
}

/**
 * Layout mode for the atlas drawer, driving a data attribute so CSS can
 * avoid HUD overlap on narrow viewports without duplicating the breakpoint.
 * Must stay in sync with the `@media (max-width: 860px)` block in
 * globals.css — asserted in tests via ATLAS_NARROW_BREAKPOINT.
 */
export const ATLAS_NARROW_BREAKPOINT = 860

export type AtlasLayoutMode = 'narrow' | 'standard'

export function atlasLayoutMode(viewportWidth: number): AtlasLayoutMode {
  return viewportWidth <= ATLAS_NARROW_BREAKPOINT ? 'narrow' : 'standard'
}

/**
 * Touch-readiness verdict for the diagnostic: control size guidance from the
 * stage contract. 44 px is the minimum comfortable touch target.
 */
export const MIN_TOUCH_TARGET_PX = 44

export function isTouchAdequate(sizePx: number): boolean {
  return sizePx >= MIN_TOUCH_TARGET_PX
}
