'use client'

import { useState } from 'react'
import { useGameState } from '@/state/store'
import { CONFIG } from '@/core/data/config'
import { SPECIES } from '@/core/data/species'
import { capacityOf } from '@/core/state/game'
import { Head, WyvernCard, BuildingUpgrade } from './common'

export function InfirmaryPanel() {
  const state = useGameState()
  const allWyverns = Object.values(state.wyverns)
  const wounded = allWyverns.filter((w) => w.injury > 1)
  const healthy = allWyverns.filter((w) => w.injury <= 1)
  const rate = CONFIG.wyvern.healPerTick * (capacityOf(state, 'infirmary') + 1)
  const [priorityWyvernId, setPriorityWyvernId] = useState<string | null>(null)
  const [showHealthy, setShowHealthy] = useState(false)

  return (
    <>
      <Head title="Infirmary" subtitle={`Healing ${rate.toFixed(2)} injury per hour across the roster.`} />
      <BuildingUpgrade id="infirmary" />

      {wounded.length > 0 && (
        <div className="infirmary-status-banner">
          <div className="pulse-ring-indicator" />
          <span>Active Healing Station — {wounded.length} wyvern{wounded.length > 1 ? 's' : ''} receiving care</span>
        </div>
      )}

      <div className="infirmary-section">
        <h3>Wounded Wyverns ({wounded.length})</h3>
        {wounded.length === 0 ? (
          <p className="subtitle" style={{ color: 'var(--good)' }}>All wyverns are in top shape! No injuries recorded.</p>
        ) : (
          <div className="grid">
            {wounded.map((w) => {
              const healthPct = Math.max(0, Math.round(100 - (w.injury / 200) * 100))
              const hoursLeft = Math.ceil(w.injury / Math.max(0.01, rate))
              const isPriority = priorityWyvernId === w.id
              const severity = w.injury >= 100 ? 'critical' : w.injury >= 40 ? 'injured' : 'recovering'
              const species = SPECIES[w.speciesId]

              return (
                <div key={w.id} className={`card infirmary-card ${severity} ${isPriority ? 'priority' : ''}`}>
                  <div className="infirmary-card-header">
                    <h3 style={{ color: species?.color, margin: 0 }}>{w.name}</h3>
                    <span className={`severity-badge ${severity}`}>
                      {severity.toUpperCase()}
                    </span>
                  </div>

                  <div className="meta">
                    {species?.name} · lvl {w.level}
                  </div>

                  <div className="wound-meter-group">
                    <div className="wound-labels">
                      <span>Health ({healthPct}%)</span>
                      <span className="eta-tag">~{hoursLeft}h remaining</span>
                    </div>
                    <div className={`bar ${severity === 'critical' ? 'bad' : severity === 'injured' ? '' : 'good'}`}>
                      <i style={{ width: `${healthPct}%` }} />
                    </div>
                  </div>

                  <div className="infirmary-card-actions">
                    <button
                      type="button"
                      className={`priority-btn ${isPriority ? 'active' : ''}`}
                      onClick={() => setPriorityWyvernId(isPriority ? null : w.id)}
                    >
                      {isPriority ? '★ Priority Bed' : '☆ Mark Priority'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {healthy.length > 0 && (
        <div className="infirmary-section" style={{ marginTop: 24 }}>
          <button
            type="button"
            className="accordion-toggle-btn"
            onClick={() => setShowHealthy(!showHealthy)}
          >
            <span>Healthy Wyverns ({healthy.length})</span>
            <span className="caret">{showHealthy ? '▲' : '▼'}</span>
          </button>

          {showHealthy && (
            <div className="grid" style={{ marginTop: 12 }}>
              {healthy.map((w) => (
                <WyvernCard key={w.id} wyvern={w} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
