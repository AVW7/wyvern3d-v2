'use client'

import { useState } from 'react'
import { useGame, useGameState } from '@/state/store'
import { useUi } from '@/state/uiStore'
import { REGIONS } from '@/core/data/regions'
import { SPECIES } from '@/core/data/species'
import { UNITS } from '@/core/data/units'
import { isAttackable } from '@/core/state/game'
import { isDeployable } from '@/core/entities/wyvern'
import { pathToRegion } from '@/scenes/WorldMap/mapGraph'
import { Head, WyvernCard } from './common'

export function WarTablePanel() {
  const state = useGameState()
  const dispatch = useGame((s) => s.dispatch)
  const setMode = useGame((s) => s.setMode)
  const close = useUi((s) => s.close)
  const selectedRegion = useGame((s) => s.selectedRegion)

  const [wyvernIds, setWyvernIds] = useState<string[]>([])
  const [squadIds, setSquadIds] = useState<string[]>([])

  const target = selectedRegion ? REGIONS[selectedRegion] : null
  const attackable = selectedRegion ? isAttackable(state, selectedRegion) : false
  const deployable = Object.values(state.wyverns).filter(isDeployable)
  const available = Object.values(state.squads).filter((s) => s.stationedAt === null)

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

  const launch = (mode: 'play' | 'auto') => {
    if (!selectedRegion) return
    dispatch({
      type: 'LAUNCH_ATTACK',
      regionId: selectedRegion,
      wyvernIds,
      squadIds,
      pilotedWyvernId: wyvernIds[0] ?? null,
      mode,
    })
    close()
    // An auto battle is already resolved by the time the next tick runs, so
    // there is nothing to fly — stay on the map.
    setMode(mode === 'play' ? 'battle' : 'worldmap')
  }

  if (!target || !selectedRegion) {
    return (
      <>
        <Head title="War Table" subtitle="Select a region on the world map to plan an assault." />
        <button className="primary" onClick={() => { setMode('worldmap'); close() }}>
          Open the world map
        </button>
      </>
    )
  }

  const region = state.regions[selectedRegion]!
  const nothingCommitted = wyvernIds.length === 0 && squadIds.length === 0

  return (
    <>
      <Head
        title={`Assault on ${target.name}`}
        subtitle={`Tier ${target.tier} · ${target.biome} · drops ${SPECIES[target.nativeSpecies]?.name} eggs`}
      />

      <div style={{ marginBottom: 12 }}>
        <button
          className="primary"
          style={{ width: '100%' }}
          onClick={() => {
            setMode('biome')
            close()
          }}
        >
          🌐 Explore Region (3D Biome World)
        </button>
      </div>

      {region.owner === 'player' ? (
        <p className="subtitle" style={{ color: 'var(--good)' }}>
          You already hold this region. Unrest {Math.round(region.unrest)}%.
        </p>
      ) : !attackable ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <p className="subtitle" style={{ color: 'var(--bad)', margin: 0 }}>
            Not reachable — you must hold a neighbouring region first.
          </p>
          {(() => {
            const path = pathToRegion(state, selectedRegion)
            if (!path || path.length <= 1) return null
            const pathNames = path.map((id) => REGIONS[id]?.name ?? id).join(' → ')
            return (
              <p className="subtitle" style={{ marginTop: 6, fontSize: 11 }}>
                Shortest Conquest Path: <span style={{ color: 'var(--text)' }}>{pathNames}</span>
              </p>
            )
          })()}
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 14 }}>
            <h3>Defenders</h3>
            <div className="meta">
              {region.garrison.map((g) => `${Math.round(g.strength)} ${UNITS[g.unitId]?.name}`).join(' · ') ||
                'no garrison'}
            </div>
            {target.defenders.length > 0 && (
              <div className="row">
                {target.defenders.map((d, i) => (
                  <span className="tag bad" key={i}>
                    {SPECIES[d]?.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>Commit wyverns</h3>
          <div className="grid">
            {deployable.map((w) => (
              <WyvernCard
                key={w.id}
                wyvern={w}
                selected={wyvernIds.includes(w.id)}
                onClick={() => toggle(wyvernIds, setWyvernIds, w.id)}
              />
            ))}
          </div>
          {deployable.length === 0 && (
            <p className="subtitle">No wyverns fit to fly — they must be adult and lightly injured.</p>
          )}

          <h3 style={{ fontSize: 14, margin: '16px 0 8px' }}>Commit squads</h3>
          <div className="row">
            {available.map((s) => (
              <button
                key={s.id}
                className={squadIds.includes(s.id) ? 'active' : ''}
                onClick={() => toggle(squadIds, setSquadIds, s.id)}
              >
                {Math.round(s.strength)} {UNITS[s.unitId]?.name}
              </button>
            ))}
            {available.length === 0 && <span className="subtitle">No squads at the sanctuary.</span>}
          </div>

          <div className="row" style={{ marginTop: 18 }}>
            <button className="primary" disabled={nothingCommitted} onClick={() => launch('play')}>
              Fly the assault
            </button>
            <button disabled={nothingCommitted} onClick={() => launch('auto')}>
              Auto-resolve
            </button>
            {wyvernIds[0] && (
              <span className="tag">you pilot {state.wyverns[wyvernIds[0]]?.name}</span>
            )}
          </div>
        </>
      )}
    </>
  )
}
