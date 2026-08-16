'use client'

import { useState } from 'react'
import type { AssetEntry, AssetId, ModelState } from '@/render/assets/manifest'
import { animationDetails, formatBytes, statusFor, type ModelLibraryEntry } from '../catalog'
import type { ModelStats } from './PreviewStage'
import styles from '../models.module.css'

const TABS = ['info', 'animation', 'rig'] as const
type Tab = (typeof TABS)[number]

const TAB_LABELS: Record<Tab, string> = { info: 'Info', animation: 'Animation', rig: 'Rig' }

interface InspectorPanelProps {
  entry: ModelLibraryEntry
  asset: AssetEntry
  selectedId: AssetId
  states: ModelState[]
  previewState: ModelState
  modelStats: ModelStats | null
  /** Sum of the base GLB plus any animation sidecars, fetched via HEAD. */
  payloadBytes: number
  isDisabled: boolean
  onRequestState: (state: ModelState) => void
  onEnabled: (id: AssetId, enabled: boolean) => void
  onReset: () => void
}

export function InspectorPanel({
  entry,
  asset,
  selectedId,
  states,
  previewState,
  modelStats,
  payloadBytes,
  isDisabled,
  onRequestState,
  onEnabled,
  onReset,
}: InspectorPanelProps) {
  const [tab, setTab] = useState<Tab>('info')
  const status = statusFor(asset, isDisabled)
  const mappedAnimations = states.map((state) => animationDetails(state, asset.animations[state]!))

  return (
    <aside className={styles.inspector} aria-label="Selected model settings">
      <div className={styles.inspectorHead}>
        <div className={styles.inspectorHeading}>
          <p className={styles.eyebrow}>{entry.category}</p>
          <h2>{entry.label}</h2>
          <code>{selectedId}</code>
        </div>

        <div className={styles.statusCard} data-status={status}>
          <span>{status === 'pending' ? 'Procedural placeholder' : 'Production model'}</span>
          <strong>{status === 'ready' ? 'Active' : status === 'disabled' ? 'Disabled' : 'Awaiting art'}</strong>
        </div>

        <label className={styles.toggle} data-disabled={!asset.url}>
          <span><strong>Use in world</strong><small>Switches to the procedural fallback when off.</small></span>
          <input
            type="checkbox"
            checked={asset.url ? !isDisabled : false}
            disabled={!asset.url}
            onChange={(event) => onEnabled(selectedId, event.target.checked)}
          />
        </label>

        <div className={styles.tabs} role="tablist" aria-label="Inspector sections">
          {TABS.map((name) => (
            <button
              key={name}
              role="tab"
              id={`inspector-tab-${name}`}
              aria-selected={tab === name}
              aria-controls={`inspector-panel-${name}`}
              data-active={tab === name}
              onClick={() => setTab(name)}
            >
              {TAB_LABELS[name]}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.tabPanel} role="tabpanel" id={`inspector-panel-${tab}`} aria-labelledby={`inspector-tab-${tab}`}>
        {tab === 'info' && (
          <dl className={styles.details}>
            <div><dt>Source</dt><dd>{asset.url ?? 'No GLB assigned'}</dd></div>
            <div><dt>Payload</dt><dd>{formatBytes(payloadBytes)}</dd></div>
            <div><dt>World scale</dt><dd>{asset.scale.toFixed(4)}</dd></div>
            <div><dt>Root offset</dt><dd>{asset.yOffset ?? 0}</dd></div>
            <div><dt>Model states</dt><dd>{states.length}</dd></div>
            <div><dt>Fallback</dt><dd>Gameplay-safe</dd></div>
          </dl>
        )}

        {tab === 'animation' && (
          <>
            <div className={styles.animationPicker}>
              <label htmlFor="model-animation">Preview animation</label>
              <select
                id="model-animation"
                value={previewState}
                disabled={states.length === 0}
                onChange={(event) => onRequestState(event.target.value as ModelState)}
              >
                {states.length === 0 && <option value="idle">No mapped animation</option>}
                {states.map((state) => <option key={state} value={state}>{state}</option>)}
              </select>
            </div>

            <section className={styles.animationMap} aria-labelledby="animation-map-title">
              <div className={styles.sectionHeading}>
                <h3 id="animation-map-title">Animation map</h3>
                <span>{states.length}</span>
              </div>
              {mappedAnimations.length === 0 ? (
                <p className={styles.emptyNote}>This model has no mapped animation states.</p>
              ) : mappedAnimations.map(({ state, clips }) => (
                <details key={state} open={state === previewState}>
                  <summary>{state}<span>{clips.length > 1 ? `${clips.length} clips` : '1 clip'}</span></summary>
                  {clips.map((clip, index) => <code key={`${clip}-${index}`}>{clip}</code>)}
                </details>
              ))}
            </section>
          </>
        )}

        {tab === 'rig' && (
          modelStats === null ? (
            <p className={styles.emptyNote}>Load a model with a GLB to read its rig.</p>
          ) : (
            <>
              <dl className={styles.details}>
                <div><dt>Polygons (tris)</dt><dd>{modelStats.triangles.toLocaleString()}</dd></div>
                <div><dt>Bones (rig)</dt><dd>{modelStats.bones}</dd></div>
                <div><dt>Materials</dt><dd>{modelStats.materials}</dd></div>
              </dl>
              <section className={styles.boneList} aria-labelledby="bone-list-title">
                <div className={styles.sectionHeading}>
                  <h3 id="bone-list-title">Rig bones</h3>
                  <span>{modelStats.boneNames.length}</span>
                </div>
                {modelStats.boneNames.length === 0 ? (
                  <p className={styles.emptyNote}>This model has no skeleton.</p>
                ) : (
                  <div className={styles.boneNames}>
                    {modelStats.boneNames.map((name) => <code key={name}>{name}</code>)}
                  </div>
                )}
              </section>
            </>
          )
        )}
      </div>

      <div className={styles.inspectorFoot}>
        <button className={styles.resetButton} onClick={onReset}>Enable all finished models</button>
        <p className={styles.safety}>Visual selection only. Combat values, collision, economy, and saves are unchanged.</p>
      </div>
    </aside>
  )
}
