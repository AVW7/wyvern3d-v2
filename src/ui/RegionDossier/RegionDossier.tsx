'use client'

import React, { useEffect, useState } from 'react'
import { useGame, useGameState } from '@/state/store'
import { useMapUiStore } from '@/state/mapUiStore'
import { useUi } from '@/state/uiStore'
import { getRegionDossier, type RegionDossierData } from '@/core/state/atlasDossier'
import type { SettlementCondition, SettlementTrend } from '@/core/types'

/** Prose for each derived settlement condition. Presentation only. */
const SETTLEMENT_BLURB: Record<SettlementCondition, string> = {
  prospering: 'Its people are settled and the hearths are lit.',
  strained: 'Grumbling in the market, but the work still gets done.',
  resentful: 'Doors close as your riders pass. Little is volunteered.',
  revolting: 'Open defiance. The banner is being cut down.',
  hostile: 'Not yours. Its people answer to someone else.',
}

const TREND_BLURB: Record<SettlementTrend, string> = {
  improving: 'Your garrison is winning the ground back.',
  holding: 'The garrison is holding the line exactly.',
  worsening: 'Nothing stationed here is slowing it.',
}


export type DossierTab = 'overview' | 'ecology' | 'strategy' | 'history'

const RESOURCE_ICONS: Record<string, string> = {
  food: '🌾',
  gold: '💰',
  ore: '⛏',
  timber: '🪵',
  arcane: '✨',
  water: '💧',
  iron: '🧱',
}

/**
 * Full Interactive Region Dossier (World Atlas Stage 4).
 * Modular 4-tab knowledge record providing in-depth overview, ecology, strategy, and event history.
 */
export function RegionDossier() {
  const mode = useGame((s) => s.mode)
  const state = useGameState()
  const selectRegion = useGame((s) => s.selectRegion)
  const openPanel = useUi((s) => s.open)

  const dossierRegionId = useMapUiStore((s) => s.dossierRegionId)
  const setDossierRegionId = useMapUiStore((s) => s.setDossierRegionId)

  const [activeTab, setActiveTab] = useState<DossierTab>('overview')

  // Keyboard Escape listener
  useEffect(() => {
    if (!dossierRegionId) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setDossierRegionId(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dossierRegionId, setDossierRegionId])

  if (mode !== 'worldmap' || !dossierRegionId) return null

  const dossier = getRegionDossier(state, dossierRegionId)
  if (!dossier) return null

  return (
    <div className="region-dossier-overlay">
      <div className="region-dossier liquid-glass" role="dialog" aria-modal="true" aria-label={`${dossier.name} Dossier`}>
        {/* Header */}
        <div className="dossier-header">
          <div className="dossier-header-info">
            <div className="dossier-title-row">
              <h2>{dossier.name}</h2>
              <span className={`region-status ${dossier.isOwned ? 'owned' : dossier.isAttackable ? 'attackable' : 'locked'}`}>
                {dossier.isOwned ? 'Held Territory' : dossier.isAttackable ? 'Frontier' : 'Locked'}
              </span>
            </div>
            <p className="dossier-subtitle">
              Tier {dossier.tier} · {dossier.biome.charAt(0).toUpperCase() + dossier.biome.slice(1)} Realm
              {dossier.isVisited ? ' · Explored' : dossier.isMapped ? ' · Chartered' : ' · Uncharted'}
            </p>
          </div>
          <button
            className="region-inspector-close"
            onClick={() => setDossierRegionId(null)}
            title="Close Dossier (Escape)"
            aria-label="Close dossier"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="dossier-tabs" role="tablist">
          <button
            className={`dossier-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
            role="tab"
            aria-selected={activeTab === 'overview'}
          >
            Overview
          </button>
          <button
            className={`dossier-tab ${activeTab === 'ecology' ? 'active' : ''}`}
            onClick={() => setActiveTab('ecology')}
            role="tab"
            aria-selected={activeTab === 'ecology'}
          >
            Ecology & Landmarks
          </button>
          <button
            className={`dossier-tab ${activeTab === 'strategy' ? 'active' : ''}`}
            onClick={() => setActiveTab('strategy')}
            role="tab"
            aria-selected={activeTab === 'strategy'}
          >
            Strategy & Garrison
          </button>
          <button
            className={`dossier-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
            role="tab"
            aria-selected={activeTab === 'history'}
          >
            Campaign History
          </button>
        </div>

        {/* Tab Content */}
        <div className="dossier-body">
          {activeTab === 'overview' && <OverviewTab dossier={dossier} />}
          {activeTab === 'ecology' && <EcologyTab dossier={dossier} />}
          {activeTab === 'strategy' && (
            <StrategyTab
              dossier={dossier}
              onAssault={() => {
                selectRegion(dossier.id)
                setDossierRegionId(null)
                openPanel('warTable')
              }}
            />
          )}
          {activeTab === 'history' && <HistoryTab dossier={dossier} />}
        </div>
      </div>
    </div>
  )
}

function OverviewTab({ dossier }: { dossier: RegionDossierData }) {
  return (
    <div className="dossier-section">
      {/* Summary */}
      <div className="dossier-card">
        <h4>Regional Summary</h4>
        <p className="dossier-prose">
          {dossier.summary ?? 'Detailed geographical records remain unmapped. Discover neighboring territories to chart this realm.'}
        </p>
      </div>

      {/* Tags */}
      {(dossier.climateTags.length > 0 || dossier.terrainTags.length > 0) && (
        <div className="dossier-card">
          <h4>Terrain & Climate Classifications</h4>
          <div className="dossier-tags">
            {dossier.climateTags.map((tag) => (
              <span key={tag} className="dossier-tag climate">
                ☁ {tag}
              </span>
            ))}
            {dossier.terrainTags.map((tag) => (
              <span key={tag} className="dossier-tag terrain">
                ⛰ {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Route & Access */}
      <div className="dossier-card">
        <h4>Strategic Approach & Route</h4>
        <p className="dossier-route-summary">{dossier.route.summary}</p>
        {dossier.route.path.length > 1 && (
          <div className="dossier-route-path">
            {dossier.route.path.map((regionId, idx) => (
              <React.Fragment key={regionId}>
                <span className={`route-node ${idx === dossier.route.path.length - 1 ? 'target' : idx === 0 ? 'origin' : 'hop'}`}>
                  {regionId}
                </span>
                {idx < dossier.route.path.length - 1 && <span className="route-arrow">→</span>}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Exploration Score */}
      <div className="dossier-card">
        <h4>Exploration Progress</h4>
        <div className="dossier-progress-row">
          <span>Landmarks Discovered:</span>
          <strong>
            {dossier.landmarks.discoveredCount} / {dossier.landmarks.totalCount}
          </strong>
        </div>
        {dossier.threatNotes && (
          <div className="dossier-threat-note">
            <strong>Threat Intelligence:</strong> {dossier.threatNotes}
          </div>
        )}
      </div>
    </div>
  )
}

function EcologyTab({ dossier }: { dossier: RegionDossierData }) {
  return (
    <div className="dossier-section">
      {/* Native Dragon Species */}
      {dossier.nativeSpecies ? (
        <div className="dossier-card species-card">
          <div className="species-card-head">
            <span className="species-swatch" style={{ backgroundColor: dossier.nativeSpecies.color }} />
            <div>
              <h4>Native Species: {dossier.nativeSpecies.name}</h4>
              <span className="species-element">Tier {dossier.nativeSpecies.tier} Wyvern</span>
            </div>
          </div>
          <div className="species-stats-grid">
            <div className="stat-box">
              <span>Power</span>
              <strong>{dossier.nativeSpecies.baseStats.power}</strong>
            </div>
            <div className="stat-box">
              <span>Speed</span>
              <strong>{dossier.nativeSpecies.baseStats.speed}</strong>
            </div>
            <div className="stat-box">
              <span>Stamina</span>
              <strong>{dossier.nativeSpecies.baseStats.stamina}</strong>
            </div>
            <div className="stat-box">
              <span>Armor</span>
              <strong>{dossier.nativeSpecies.baseStats.armor}</strong>
            </div>
          </div>
        </div>
      ) : (
        <div className="dossier-card">
          <h4>Native Species</h4>
          <p className="dossier-prose">Unknown habitat. Chart this region on the atlas to identify resident dragon breeds.</p>
        </div>
      )}

      {/* Discovered Landmarks */}
      <div className="dossier-card">
        <h4>Landmarks & Geographical Features ({dossier.landmarks.discoveredCount}/{dossier.landmarks.totalCount})</h4>
        {dossier.landmarks.discovered.length === 0 ? (
          <p className="dossier-prose">No landmarks discovered in this region yet. Explore the biome in flight to locate discovery anchors.</p>
        ) : (
          <div className="landmarks-list">
            {dossier.landmarks.discovered.map((lm) => (
              <div key={lm.id} className="landmark-item">
                <div className="landmark-item-header">
                  <span className="landmark-kind-badge">{lm.category}</span>
                  <strong>{lm.name}</strong>
                </div>
                <p className="landmark-lore">{lm.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Observed Phenomena */}
      {dossier.observedPhenomena.length > 0 && (
        <div className="dossier-card">
          <h4>Observed Environmental Phenomena</h4>
          <div className="phenomena-list">
            {dossier.observedPhenomena.map((p) => (
              <div key={p.id} className="phenomenon-item">
                <strong>{p.name} ({p.kind})</strong>
                <p>{p.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Expedition Activities & Mysteries */}
      {dossier.completedActivities.length > 0 && (
        <div className="dossier-card">
          <h4>Solved Ecological Mysteries & Hazards</h4>
          <div className="phenomena-list">
            {dossier.completedActivities.map((act) => (
              <div key={act.id} className="phenomenon-item" style={{ borderLeftColor: act.themeColor }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{act.name} ({act.kind})</strong>
                  <span className="landmark-kind-badge" style={{ backgroundColor: act.themeColor, color: '#0f172a' }}>
                    {act.knowledgeTag}
                  </span>
                </div>
                <p>{act.description}</p>
                <small style={{ color: '#94a3b8', marginTop: 4, display: 'block' }}>Objective: {act.objective}</small>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StrategyTab({
  dossier,
  onAssault,
}: {
  dossier: RegionDossierData
  onAssault: () => void
}) {
  return (
    <div className="dossier-section">
      {/* Resource Yields */}
      <div className="dossier-card">
        <h4>Economic Yield Capacity</h4>
        <div className="dossier-yields-grid">
          {Object.entries(dossier.yields.base).map(([res, base]) => {
            const effective = dossier.yields.effective[res] ?? base
            return (
              <div key={res} className="yield-tile">
                <span className="yield-icon">{RESOURCE_ICONS[res] ?? '📦'}</span>
                <div className="yield-numbers">
                  <span className="yield-name">{res}</span>
                  <strong>+{effective}/t</strong>
                  {dossier.isOwned && dossier.unrest.value > 0 && (
                    <span className="yield-penalty">({Math.round(dossier.yields.unrestMultiplier * 100)}% output)</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Garrison & Defenses */}
      <div className="dossier-card">
        <div className="card-head-flex">
          <h4>Garrison & Defense Force</h4>
          <span className="garrison-total-badge">Total Power: {dossier.garrison.totalStrength}</span>
        </div>
        {dossier.garrison.units.length === 0 ? (
          <p className="dossier-prose">No garrison troops stationed in this province.</p>
        ) : (
          <div className="garrison-units-list">
            {dossier.garrison.units.map((unit, idx) => (
              <div key={`${unit.unitId}-${idx}`} className="garrison-unit-row">
                <span className="unit-name">{unit.name}</span>
                <span className="unit-count">×{unit.count}</span>
                <span className="unit-power">({unit.power} Power)</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Unrest Risk */}
      {dossier.isOwned && (
        <div className="dossier-card">
          <h4>Civic Stability & Unrest</h4>
          <div className="unrest-meter-row">
            <span className={`unrest-badge ${dossier.unrest.level}`}>{dossier.unrest.value}% Unrest</span>
            <span className="unrest-desc">
              {dossier.unrest.level === 'stable' ? 'Territory is stable and loyal.' : dossier.unrest.level === 'moderate' ? 'Moderate dissent reduces economic yield.' : 'High unrest! Garrison recommended.'}
            </span>
          </div>
          {dossier.settlement && (
            <div className="settlement-row">
              <span className={`settlement-badge ${dossier.settlement.condition}`}>
                {dossier.settlement.name}
              </span>
              <span className="settlement-desc">
                {SETTLEMENT_BLURB[dossier.settlement.condition]}{' '}
                <em className={`settlement-trend ${dossier.settlement.trend}`}>
                  {TREND_BLURB[dossier.settlement.trend]}
                </em>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Action Button */}
      {dossier.isAttackable && (
        <div className="dossier-actions">
          <button className="region-btn confirm launch-assault-btn" onClick={onAssault}>
            ⚔ Launch Campaign Assault
          </button>
        </div>
      )}
    </div>
  )
}

function HistoryTab({ dossier }: { dossier: RegionDossierData }) {
  return (
    <div className="dossier-section">
      <div className="dossier-card">
        <h4>Campaign Record in {dossier.name}</h4>
        {dossier.history.length === 0 ? (
          <p className="dossier-prose">No historical campaign events recorded for this region yet.</p>
        ) : (
          <div className="dossier-history-feed">
            {dossier.history.map((e, idx) => (
              <div key={`${e.tick}-${idx}`} className={`history-entry ${e.kind}`}>
                <span className="history-tick">Tick {e.tick}</span>
                <span className="history-msg">{e.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
