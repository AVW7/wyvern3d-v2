'use client'

import { useGame, useGameState } from '@/state/store'
import { useMapUiStore } from '@/state/mapUiStore'
import { devStore } from '@/state/devStore'
import { useSyncExternalStore } from 'react'
import { ATLAS_LAYERS } from '@/core/state/atlasLayers'
import { getRegionKnowledge } from '@/core/state/atlasKnowledge'

/**
 * Dev-only atlas diagnostic (Atlas Stage 5). Mounted on the world map when
 * ?debug=atlas is present; shows selected id, active layer, the selected
 * region's knowledge fields and the layout mode, so reviewers can verify the
 * atlas state without opening devtools. Never renders otherwise.
 */
export function AtlasDiagnostic() {
  const state = useGameState()
  const selectedRegion = useGame((s) => s.selectedRegion)
  const activeLayer = useMapUiStore((s) => s.activeLayer)
  const atlasOpen = useMapUiStore((s) => s.atlasOpen)
  const dossierRegionId = useMapUiStore((s) => s.dossierRegionId)
  const revealAll = useSyncExternalStore(devStore.subscribe, () => devStore.revealAll)

  const knowledge = selectedRegion ? getRegionKnowledge(state, selectedRegion) : null
  const layerDef = ATLAS_LAYERS[activeLayer]

  return (
    <div className="atlas-diagnostic black-glass" role="status" aria-label="Atlas diagnostic">
      <div className="atlas-diag-row"><span>selected</span><code>{selectedRegion ?? '—'}</code></div>
      <div className="atlas-diag-row"><span>layer</span><code>{layerDef.shortLabel}</code></div>
      <div className="atlas-diag-row"><span>drawer</span><code>{String(atlasOpen)}</code></div>
      <div className="atlas-diag-row"><span>dossier</span><code>{dossierRegionId ?? '—'}</code></div>
      <div className="atlas-diag-row"><span>revealAll</span><code>{String(revealAll)}</code></div>
      {knowledge ? (
        <div className="atlas-diag-row"><span>knowledge</span><code>m:{String(knowledge.mapped)} v:{String(knowledge.visited)} lm:{knowledge.discoveredLandmarkIds.length}</code></div>
      ) : (
        <div className="atlas-diag-row"><span>knowledge</span><code>none</code></div>
      )}
    </div>
  )
}
