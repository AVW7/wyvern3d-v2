'use client'

import React from 'react'
import { useGame, useGameState } from '../state/store'
import { useMapUiStore } from '../state/mapUiStore'
import { REGIONS } from '../core/data/regions'
import { SPECIES } from '../core/data/species'
import { UNITS } from '../core/data/units'
import { yieldMultiplier } from '../core/systems/economy'
import { calculateGarrisonStrength } from '../scenes/WorldMap/mapGraph'
import { regionStatus } from '../scenes/WorldMap/nodeVisuals'
import { useUi } from '@/state/uiStore'
import { useDevStore } from '../state/devStore'

const RESOURCE_ICONS: Record<string, string> = {
  food: '🌾',
  gold: '💰',
  ore: '⛏',
  timber: '🪵',
  arcane: '✨',
  water: '💧',
  iron: '🧱',
}

export function RegionInspector() {
  const mode = useGame((s) => s.mode)
  const state = useGameState()
  const hovered = useMapUiStore((s) => s.hovered)
  const inspected = useMapUiStore((s) => s.inspected)
  const setInspected = useMapUiStore((s) => s.setInspected)
  const revealAll = useDevStore((s) => s.revealAll)

  const selectedRegion = useGame((s) => s.selectedRegion)

  if (mode !== 'worldmap') return null

  const targetId = hovered ?? inspected ?? selectedRegion
  if (!targetId) return null

  const def = REGIONS[targetId]
  if (!def) return null

  const regionState = state.regions[targetId]
  const owner = regionState?.owner ?? (def.starting ? 'player' : 'enemy')
  const isPlayer = owner === 'player'
  const isAttackable = !isPlayer && def.neighbors.some((n) => state.regions[n]?.owner === 'player')

  const unrest = regionState?.unrest ?? 0
  const mult = yieldMultiplier(unrest)
  const garrison = regionState?.garrison ?? def.garrison
  const garrisonStrength = calculateGarrisonStrength(garrison)

  let dominantUnitName = 'None'
  if (garrison.length > 0) {
    const sorted = [...garrison].sort((a, b) => {
      const aHp = UNITS[a.unitId]?.attack ?? 0
      const bHp = UNITS[b.unitId]?.attack ?? 0
      return bHp * a.strength - aHp * a.strength
    })
    if (sorted[0]) {
      dominantUnitName = UNITS[sorted[0].unitId]?.name ?? sorted[0].unitId
    }
  }

  const species = SPECIES[def.nativeSpecies]
  // Same three states the 3D node badge shows, plus a dev-only reveal override.
  const baseStatus = regionStatus(owner, isAttackable)
  const status = baseStatus === 'locked' && revealAll ? 'revealed' : baseStatus

  return (
    <div className="region-inspector black-glass">
      <div className="region-inspector-head">
        <div className="region-inspector-title">
          <h3>{def.name}</h3>
          <p>
            Tier {def.tier} • {def.biome}
          </p>
        </div>
        <div className="region-inspector-head-actions">
          <span className={`region-status ${status}`}>{status}</span>
          <button
            onClick={() => {
              setInspected(null)
              useGame.getState().selectRegion(null)
            }}
            className="region-inspector-close"
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="region-inspector-body">
        {/* Yields */}
        <div className="region-block">
          <span className="region-block-label">Base Yields</span>
          <div className="region-yields">
            {Object.entries(def.yields).map(([res, amount]) => {
              const adjusted = Math.round((amount ?? 0) * mult * 10) / 10
              return (
                <span key={res} className="region-yield">
                  {RESOURCE_ICONS[res] ?? ''} {adjusted} <span className="region-yield-base">({amount})</span>
                </span>
              )
            })}
          </div>
          {isPlayer && unrest > 0 && (
            <p className="region-note warn">
              Unrest ({unrest}%): yields reduced to {Math.round(mult * 100)}%
            </p>
          )}
        </div>

        {/* Garrison */}
        <div className="region-block">
          <div className="region-line">
            <span>Live Garrison</span>
            <span className="region-value gold">{garrisonStrength} Str</span>
          </div>
          <p className="region-note">
            Dominant unit: <span className="region-note-value">{dominantUnitName}</span>
          </p>
        </div>

        {/* Native Species & Eggs */}
        <div className="region-block">
          <div className="region-line">
            <span>Native Species</span>
            <span className="region-value good">{species?.name ?? def.nativeSpecies}</span>
          </div>
          <p className="region-note">
            Traits: <span className="region-note-value">{species?.traitPool.join(', ') ?? 'None'}</span>
          </p>
          <div className="region-line region-line-tight">
            <span>
              Eggs available: <span className="region-value gold">{regionState?.eggsAvailable ?? 0}</span>
            </span>
            {isPlayer && (regionState?.eggsAvailable ?? 0) > 0 && (
              <button
                onClick={() => useGame.getState().dispatch({ type: 'COLLECT_REGION_EGGS', regionId: targetId })}
                className="region-btn primary"
              >
                Collect Egg
              </button>
            )}
          </div>
        </div>

        {/* Strategic Actions */}
        {isPlayer && (
          <div className="region-block">
            <span className="region-block-label">Station Garrison</span>

            {/* Squads */}
            <div className="region-list">
              <span className="region-list-label">Army Squads</span>
              {Object.values(state.squads).length === 0 ? (
                <p className="region-empty">No army squads recruited.</p>
              ) : (
                Object.values(state.squads).map((squad) => {
                  const isStationedHere = squad.stationedAt === targetId
                  const unitName = UNITS[squad.unitId]?.name ?? squad.unitId
                  return (
                    <div key={squad.id} className="region-row">
                      <span className="region-row-name">
                        {unitName} ({squad.strength})
                      </span>
                      <button
                        onClick={() =>
                          useGame.getState().dispatch({
                            type: 'STATION_SQUAD',
                            squadId: squad.id,
                            regionId: isStationedHere ? null : targetId,
                          })
                        }
                        className={`region-btn ${isStationedHere ? 'danger' : 'confirm'}`}
                      >
                        {isStationedHere ? 'Recall' : 'Station'}
                      </button>
                    </div>
                  )
                })
              )}
            </div>

            {/* Wyverns */}
            <div className="region-list region-list-divided">
              <span className="region-list-label">Wyvern Nests</span>
              {Object.values(state.wyverns).filter((w) => w.stage === 'adult').length === 0 ? (
                <p className="region-empty">No adult wyverns available.</p>
              ) : (
                Object.values(state.wyverns)
                  .filter((w) => w.stage === 'adult')
                  .map((w) => {
                    const isGarrisonedHere = w.assignment.kind === 'garrison' && w.assignment.regionId === targetId
                    return (
                      <div key={w.id} className="region-row">
                        <span className="region-row-name">
                          {w.name} ({SPECIES[w.speciesId]?.name ?? w.speciesId})
                        </span>
                        <button
                          onClick={() =>
                            useGame.getState().dispatch({
                              type: 'GARRISON_WYVERN',
                              wyvernId: w.id,
                              regionId: isGarrisonedHere ? null : targetId,
                            })
                          }
                          className={`region-btn ${isGarrisonedHere ? 'danger' : 'gold'}`}
                        >
                          {isGarrisonedHere ? 'Recall' : 'Garrison'}
                        </button>
                      </div>
                    )
                  })
              )}
            </div>
          </div>
        )}

        {/* Assault Action for Reachable enemy regions */}
        {isAttackable && (
          <button
            onClick={() => {
              useGame.getState().selectRegion(targetId)
              useUi.getState().open('warTable')
            }}
            className="region-assault-btn"
          >
            Assault Territory
          </button>
        )}
      </div>
    </div>
  )
}
