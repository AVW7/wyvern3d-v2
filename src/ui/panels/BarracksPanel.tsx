'use client'

import { useState } from 'react'
import { useGame, useGameState } from '@/state/store'
import { REGIONS } from '@/core/data/regions'
import { UNIT_LIST, UNITS } from '@/core/data/units'
import { capacityOf } from '@/core/state/game'
import { Head, Cost, BuildingUpgrade } from './common'

export function BarracksPanel() {
  const state = useGameState()
  const dispatch = useGame((s) => s.dispatch)
  const [strength, setStrength] = useState(30)
  const squads = Object.values(state.squads)
  const capacity = capacityOf(state, 'barracks')
  const owned = Object.values(state.regions).filter((r) => r.owner === 'player')

  return (
    <>
      <Head
        title="Barracks"
        subtitle={`${squads.length} of ${capacity} squads. Armies hold ground — wyverns cannot suppress unrest.`}
      />

      <BuildingUpgrade id="barracks" />
      <BuildingUpgrade id="trainingGrounds" />

      <h3 style={{ fontSize: 14, margin: '16px 0 8px' }}>Recruit</h3>
      <div className="row" style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 12, color: 'var(--muted)' }}>troops</label>
        <input
          type="range"
          min={10}
          max={120}
          step={10}
          value={strength}
          onChange={(e) => setStrength(Number(e.target.value))}
        />
        <span className="tag">{strength}</span>
      </div>

      <div className="grid">
        {UNIT_LIST.map((unit) => {
          const cost = Object.fromEntries(
            Object.entries(unit.cost).map(([k, v]) => [k, Math.round((v ?? 0) * (strength / 10))]),
          )
          return (
            <div className="card" key={unit.id}>
              <h3 style={{ color: unit.color }}>{unit.name}</h3>
              <div className="meta">
                atk {unit.attack} · def {unit.defense} · range {unit.range}
                {unit.strongAgainst.length > 0 &&
                  ` · strong vs ${unit.strongAgainst.map((u) => UNITS[u]?.name).join(', ')}`}
              </div>
              {unit.range < 20 && <span className="tag bad">cannot hit flying wyverns</span>}
              {unit.range >= 20 && <span className="tag good">can hit flying wyverns</span>}
              <div className="row" style={{ marginTop: 8 }}>
                <button
                  className="primary"
                  disabled={squads.length >= capacity}
                  onClick={() => dispatch({ type: 'RECRUIT_SQUAD', unitId: unit.id, strength })}
                >
                  Recruit {strength}
                </button>
                <Cost cost={cost} />
              </div>
            </div>
          )
        })}
      </div>

      <h3 style={{ fontSize: 14, margin: '18px 0 8px' }}>Standing squads</h3>
      <table className="compact">
        <thead>
          <tr>
            <th>Unit</th>
            <th>Troops</th>
            <th>Stationed</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {squads.map((s) => (
            <tr key={s.id}>
              <td>{UNITS[s.unitId]?.name}</td>
              <td>{Math.round(s.strength)}</td>
              <td>
                <select
                  value={s.stationedAt ?? ''}
                  onChange={(e) =>
                    dispatch({
                      type: 'STATION_SQUAD',
                      squadId: s.id,
                      regionId: e.target.value === '' ? null : e.target.value,
                    })
                  }
                >
                  <option value="">Sanctuary (available to attack)</option>
                  {owned.map((r) => (
                    <option key={r.id} value={r.id}>
                      {REGIONS[r.id]?.name} (garrison)
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <button className="danger" onClick={() => dispatch({ type: 'DISBAND_SQUAD', squadId: s.id })}>
                  Disband
                </button>
              </td>
            </tr>
          ))}
          {squads.length === 0 && (
            <tr>
              <td colSpan={4} style={{ color: 'var(--muted)' }}>
                No squads.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  )
}
