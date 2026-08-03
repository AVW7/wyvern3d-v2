'use client'

import { usePlayerControlStore } from '@/state/playerControlStore'
import { useGameState } from '@/state/store'
import { SPECIES } from '@/core/data/species'

function HumanIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" className="mono-svg">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function WyvernIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" className="mono-svg">
      <path d="M4 17.5l5.5-5.5L4 6.5M13 17.5L18.5 12 13 6.5" />
      <path d="M2 12h20" strokeDasharray="2 2" />
    </svg>
  )
}

export function ControlShiftWidget() {
  const state = useGameState()
  const controlMode = usePlayerControlStore((s) => s.controlMode)
  const activeWyvernId = usePlayerControlStore((s) => s.activeWyvernId)
  const toggleShift = usePlayerControlStore((s) => s.toggleShift)
  const shiftToWyvern = usePlayerControlStore((s) => s.shiftToWyvern)
  const shiftToHuman = usePlayerControlStore((s) => s.shiftToHuman)

  const wyverns = Object.values(state.wyverns)
  const activeWyvern = wyverns.find((w) => w.id === activeWyvernId) ?? wyverns[0]

  if (wyverns.length === 0) return null

  return (
    <div className="control-shift-container">
      <div className="control-shift-pill liquid-glass">
        <button
          className={`control-shift-btn ${controlMode === 'human' ? 'active' : ''}`}
          onClick={() => shiftToHuman()}
          title="Play as Human (WASD Ground Movement & Interactions)"
        >
          <span className="icon-wrapper"><HumanIcon /></span> Human
        </button>

        <button
          className={`control-shift-btn ${controlMode === 'wyvern' ? 'active' : ''}`}
          onClick={() => toggleShift(wyverns.map((w) => w.id))}
          title="Directly Control Wyvern (3D Flight & Combat Controls)"
        >
          <span className="icon-wrapper"><WyvernIcon /></span> {activeWyvern ? activeWyvern.name : 'Wyvern'}
        </button>

        <span className="hotkey-badge">TAB</span>

        {wyverns.length > 1 && controlMode === 'wyvern' && (
          <select
            className="wyvern-select-dropdown"
            value={activeWyvern?.id ?? ''}
            onChange={(e) => shiftToWyvern(e.target.value)}
          >
            {wyverns.map((w) => {
              const spec = SPECIES[w.speciesId]
              return (
                <option key={w.id} value={w.id}>
                  {w.name} ({spec?.name ?? 'Wyvern'})
                </option>
              )
            })}
          </select>
        )}
      </div>

      {controlMode === 'wyvern' && (
        <div className="wyvern-action-bar liquid-glass fade-in">
          <div className="action-hint">
            <kbd>WASD</kbd> Move / Steer
          </div>
          <div className="action-hint">
            <kbd>SPACE</kbd> Takeoff / Ascend
          </div>
          <div className="action-hint">
            <kbd>F</kbd> Descend / Land
          </div>
          <div className="action-hint">
            <kbd>F</kbd> Fire Breath
          </div>
          <div className="action-hint">
            <kbd>R</kbd> Attack
          </div>
          <div className="action-hint">
            <kbd>TAB</kbd> Exit
          </div>
        </div>
      )}
    </div>
  )
}
