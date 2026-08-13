'use client'

import React from 'react'
import { useGame, useGameState } from '../state/store'
import { useMapUiStore } from '../state/mapUiStore'
import { REGIONS } from '../core/data/regions'
import { SPECIES } from '../core/data/species'
import { UNITS } from '../core/data/units'
import { yieldMultiplier } from '../core/systems/economy'
import { calculateGarrisonStrength } from '../scenes/WorldMap/mapGraph'
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

  return (
    <div
      className="fixed bottom-6 left-6 z-50 w-80 rounded-xl border border-amber-900/40 bg-slate-950/90 p-4 text-slate-100 shadow-2xl backdrop-blur-md transition-all duration-200"
      style={{ pointerEvents: 'auto' }}
    >
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div>
          <h3 className="text-lg font-bold tracking-wide text-amber-200">{def.name}</h3>
          <p className="text-xs uppercase tracking-wider text-slate-400">
            Tier {def.tier} • {def.biome}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${
              isPlayer
                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/50'
                : isAttackable
                ? 'bg-amber-950/80 text-amber-400 border border-amber-700/50'
                : revealAll
                ? 'bg-blue-950/80 text-blue-400 border border-blue-700/50'
                : 'bg-slate-900 text-slate-500 border border-slate-800'
            }`}
          >
            {isPlayer ? 'Held' : isAttackable ? 'Reachable' : revealAll ? 'Revealed' : 'Locked'}
          </span>
          <button
            onClick={() => {
              setInspected(null)
              useGame.getState().selectRegion(null)
            }}
            className="text-slate-500 hover:text-slate-200"
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-2 text-xs">
        {/* Yields */}
        <div className="rounded-lg bg-slate-900/60 p-2 border border-slate-800/80">
          <span className="font-semibold text-slate-400">Base Yields:</span>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {Object.entries(def.yields).map(([res, amount]) => {
              const adjusted = Math.round((amount ?? 0) * mult * 10) / 10
              return (
                <span key={res} className="text-amber-100 font-medium">
                  {RESOURCE_ICONS[res] ?? ''} {adjusted}{' '}
                  <span className="text-slate-400 text-[10px]">({amount})</span>
                </span>
              )
            })}
          </div>
          {isPlayer && unrest > 0 && (
            <p className="mt-1 text-[10px] text-amber-400/90">
              Unrest ({unrest}%): Yields reduced to {Math.round(mult * 100)}%
            </p>
          )}
        </div>

        {/* Garrison */}
        <div className="rounded-lg bg-slate-900/60 p-2 border border-slate-800/80">
          <div className="flex justify-between text-slate-300">
            <span>Live Garrison:</span>
            <span className="font-semibold text-amber-300">{garrisonStrength} Str</span>
          </div>
          <p className="mt-0.5 text-slate-400">
            Dominant unit: <span className="text-slate-200">{dominantUnitName}</span>
          </p>
        </div>

        {/* Native Species & Eggs */}
        <div className="rounded-lg bg-slate-900/60 p-2 border border-slate-800/80">
          <div className="flex justify-between text-slate-300">
            <span>Native Species:</span>
            <span className="font-medium text-emerald-300">{species?.name ?? def.nativeSpecies}</span>
          </div>
          <p className="mt-0.5 text-slate-400">
            Traits: <span className="text-slate-300">{species?.traitPool.join(', ') ?? 'None'}</span>
          </p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-slate-400">
              Eggs available: <span className="text-amber-300 font-medium">{regionState?.eggsAvailable ?? 0}</span>
            </span>
            {isPlayer && (regionState?.eggsAvailable ?? 0) > 0 && (
              <button
                onClick={() => useGame.getState().dispatch({ type: 'COLLECT_REGION_EGGS', regionId: targetId })}
                className="rounded bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-amber-950 hover:bg-amber-500"
              >
                Collect Egg
              </button>
            )}
          </div>
        </div>

        {/* Strategic Actions */}
        {isPlayer && (
          <div className="rounded-lg bg-slate-900/60 p-2 border border-slate-800/80 space-y-2">
            <span className="font-semibold text-slate-300">Station Garrison:</span>
            
            {/* Squads */}
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 uppercase">Army Squads:</span>
              {Object.values(state.squads).length === 0 ? (
                <p className="text-[10px] text-slate-500 italic">No army squads recruited.</p>
              ) : (
                Object.values(state.squads).map((squad) => {
                  const isStationedHere = squad.stationedAt === targetId
                  const unitName = UNITS[squad.unitId]?.name ?? squad.unitId
                  return (
                    <div key={squad.id} className="flex items-center justify-between text-[11px] bg-slate-950/40 p-1 rounded">
                      <span>{unitName} ({squad.strength})</span>
                      <button
                        onClick={() =>
                          useGame.getState().dispatch({
                            type: 'STATION_SQUAD',
                            squadId: squad.id,
                            regionId: isStationedHere ? null : targetId,
                          })
                        }
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          isStationedHere
                            ? 'bg-red-950/80 text-red-300 border border-red-800'
                            : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                        }`}
                      >
                        {isStationedHere ? 'Recall' : 'Station'}
                      </button>
                    </div>
                  )
                })
              )}
            </div>

            {/* Wyverns */}
            <div className="space-y-1 pt-1 border-t border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase">Wyvern Nests:</span>
              {Object.values(state.wyverns).filter((w) => w.stage === 'adult').length === 0 ? (
                <p className="text-[10px] text-slate-500 italic">No adult wyverns available.</p>
              ) : (
                Object.values(state.wyverns)
                  .filter((w) => w.stage === 'adult')
                  .map((w) => {
                    const isGarrisonedHere = w.assignment.kind === 'garrison' && w.assignment.regionId === targetId
                    return (
                      <div key={w.id} className="flex items-center justify-between text-[11px] bg-slate-950/40 p-1 rounded">
                        <span>{w.name} ({SPECIES[w.speciesId]?.name ?? w.speciesId})</span>
                        <button
                          onClick={() =>
                            useGame.getState().dispatch({
                              type: 'GARRISON_WYVERN',
                              wyvernId: w.id,
                              regionId: isGarrisonedHere ? null : targetId,
                            })
                          }
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            isGarrisonedHere
                              ? 'bg-red-950/80 text-red-300 border border-red-800'
                              : 'bg-amber-950/80 text-amber-300 border border-amber-800'
                          }`}
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
            className="w-full mt-2 rounded-lg bg-amber-600 hover:bg-amber-500 py-2 text-xs font-bold text-amber-950 uppercase tracking-wider shadow-lg transition-colors"
          >
            Assault Territory
          </button>
        )}
      </div>
    </div>
  )
}
