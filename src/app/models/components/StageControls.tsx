'use client'

import type { ModelState } from '@/render/assets/manifest'
import styles from '../models.module.css'

/** Playback-rate presets, from a slow readable pose study to a fast cycle check. */
export const PLAYBACK_RATES = [0.25, 0.5, 1, 2] as const
export type PlaybackRate = (typeof PLAYBACK_RATES)[number]

export function isPlaybackRate(value: number): value is PlaybackRate {
  return (PLAYBACK_RATES as readonly number[]).includes(value)
}

export interface StageControlsProps {
  /** Mapped states for the current model; empty for models with no animations. */
  states: ModelState[]
  state: ModelState
  hasModel: boolean
  paused: boolean
  rate: PlaybackRate
  turntable: boolean
  wireframe: boolean
  onState: (state: ModelState) => void
  onPaused: (paused: boolean) => void
  onRate: (rate: PlaybackRate) => void
  onTurntable: (on: boolean) => void
  onWireframe: (on: boolean) => void
}

/**
 * Preview-stage toolbar: animation picker plus playback and view controls.
 *
 * Every control is disabled when the manifest has no GLB for the model, since
 * the procedural placeholder neither animates nor carries materials.
 */
export function StageControls({
  states,
  state,
  hasModel,
  paused,
  rate,
  turntable,
  wireframe,
  onState,
  onPaused,
  onRate,
  onTurntable,
  onWireframe,
}: StageControlsProps) {
  return (
    <div className={styles.stageControls} role="toolbar" aria-label="Preview controls">
      <label className={styles.stageSelect}>
        <span>Animation</span>
        <select
          value={state}
          disabled={!hasModel || states.length === 0}
          onChange={(event) => onState(event.target.value as ModelState)}
        >
          {!hasModel || states.length === 0 ? <option value={state}>{state}</option> : null}
          {states.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </label>

      <div className={styles.stageToggles}>
        <button
          type="button"
          className={styles.stageButton}
          data-active={paused}
          aria-pressed={paused}
          disabled={!hasModel || states.length === 0}
          onClick={() => onPaused(!paused)}
          title={paused ? 'Resume playback' : 'Pause playback'}
        >
          {paused ? '▶' : '❙❙'}
        </button>

        <div className={styles.rateGroup} role="group" aria-label="Playback rate">
          {PLAYBACK_RATES.map((preset) => (
            <button
              key={preset}
              type="button"
              className={styles.stageButton}
              data-active={rate === preset && !paused}
              aria-pressed={rate === preset && !paused}
              disabled={!hasModel || states.length === 0}
              onClick={() => {
                onRate(preset)
                if (paused) onPaused(false)
              }}
            >
              {preset}×
            </button>
          ))}
        </div>

        <button
          type="button"
          className={styles.stageButton}
          data-active={turntable}
          aria-pressed={turntable}
          disabled={!hasModel}
          onClick={() => onTurntable(!turntable)}
          title="Turntable"
        >
          ⟳
        </button>

        <button
          type="button"
          className={styles.stageButton}
          data-active={wireframe}
          aria-pressed={wireframe}
          disabled={!hasModel}
          onClick={() => onWireframe(!wireframe)}
          title="Wireframe"
        >
          ◇
        </button>
      </div>
    </div>
  )
}
