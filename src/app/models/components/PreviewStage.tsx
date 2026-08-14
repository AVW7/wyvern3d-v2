'use client'

import dynamic from 'next/dynamic'
import type { AssetEntry, AssetId, ModelState } from '@/render/assets/manifest'
import styles from '../models.module.css'

const ModelPreview = dynamic(() => import('../ModelPreview').then((module) => module.ModelPreview), {
  ssr: false,
  loading: () => <div className={styles.previewLoading}>Preparing 3D preview…</div>,
})

export interface ModelStats {
  triangles: number
  bones: number
  materials: number
  boneNames: string[]
}

export function PreviewStage({
  id,
  label,
  asset,
  state,
  onLoadStats,
}: {
  id: AssetId
  label: string
  asset: AssetEntry
  state: ModelState
  onLoadStats: (stats: ModelStats) => void
}) {
  return (
    <section className={styles.stage} aria-label={`${label} preview`}>
      <ModelPreview id={id} state={state} onLoadStats={onLoadStats} />
      <div className={styles.stageLabel}>
        <span>{asset.url ? 'Live production preview' : 'Gameplay-safe placeholder'}</span>
        <strong>{label}</strong>
      </div>
      {!asset.url && <div className={styles.placeholderNotice}>No GLB assigned — showing the procedural fallback</div>}
      <div className={styles.orbitHint}>Drag to orbit · scroll to zoom</div>
    </section>
  )
}
