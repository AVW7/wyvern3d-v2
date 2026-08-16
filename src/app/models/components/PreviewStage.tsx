'use client'

import dynamic from 'next/dynamic'
import type { AssetEntry, AssetId, ModelState } from '@/render/assets/manifest'
import styles from '../models.module.css'
import { StageControls, type PlaybackRate } from './StageControls'

const ModelPreview = dynamic(() => import('../ModelPreview').then((module) => module.ModelPreview), {
  ssr: false,
  loading: () => <div className={styles.previewLoading}>Preparing 3D preview…</div>,
})

export type { ModelStats } from '../ModelPreview'

export interface StageControlsState {
  paused: boolean
  rate: PlaybackRate
  turntable: boolean
  wireframe: boolean
}

export function PreviewStage({
  id,
  label,
  asset,
  states,
  state,
  controls,
  onControls,
  onState,
  onLoadStats,
}: {
  id: AssetId
  label: string
  asset: AssetEntry
  states: ModelState[]
  state: ModelState
  controls: StageControlsState
  onControls: (patch: Partial<StageControlsState>) => void
  onState: (state: ModelState) => void
  onLoadStats: (stats: import('../ModelPreview').ModelStats) => void
}) {
  return (
    <section className={styles.stage} aria-label={`${label} preview`}>
      <ModelPreview
        id={id}
        state={state}
        paused={controls.paused}
        rate={controls.rate}
        turntable={controls.turntable}
        wireframe={controls.wireframe}
        onLoadStats={onLoadStats}
      />
      <div className={styles.stageLabel}>
        <span>{asset.url ? 'Live production preview' : 'Gameplay-safe placeholder'}</span>
        <strong>{label}</strong>
      </div>
      {!asset.url && <div className={styles.placeholderNotice}>No GLB assigned — showing the procedural fallback</div>}
      {asset.url && (
        <StageControls
          states={states}
          state={state}
          hasModel
          paused={controls.paused}
          rate={controls.rate}
          turntable={controls.turntable}
          wireframe={controls.wireframe}
          onState={onState}
          onPaused={(paused) => onControls({ paused })}
          onRate={(rate) => onControls({ rate })}
          onTurntable={(turntable) => onControls({ turntable })}
          onWireframe={(wireframe) => onControls({ wireframe })}
        />
      )}
      <div className={styles.orbitHint}>Drag to orbit · scroll to zoom</div>
    </section>
  )
}
