'use client'

import type { CSSProperties } from 'react'
import { useGame, useGameState } from '@/state/store'
import { useUi } from '@/state/uiStore'
import { BUILDINGS } from '@/core/data/buildings'
import { netIncome } from '@/core/systems/economy'
import type { BuildingId } from '@/core/types'

/** `.gp-grid` reads its column count from a custom property. */
const cols = (n: number) => ({ '--cols': n }) as CSSProperties

const RESOURCE_ICONS: Record<string, string> = {
  food: '🌾',
  gold: '💰',
  ore: '⛏',
  timber: '🪵',
  arcane: '✨',
  water: '💧',
  hide: '📜',
  iron: '⚙️',
}

const MANAGED_BUILDINGS: {
  id: BuildingId
  name: string
  icon: string
  workerBonus: string
}[] = [
  {
    id: 'farm',
    name: 'Sanctuary Farm',
    icon: '🌾',
    workerBonus: '+1.5 Food / worker',
  },
  {
    id: 'aqueduct',
    name: 'Well & Aqueduct',
    icon: '💧',
    workerBonus: '+4 Water / aqueduct lvl',
  },
  {
    id: 'pasture',
    name: 'Wildlife Pasture',
    icon: '🦌',
    workerBonus: 'Livestock breeding & Hides',
  },
  {
    id: 'foundry',
    name: 'Iron Foundry',
    icon: '⚙️',
    workerBonus: 'Smelts Ore -> Iron & Gold',
  },
  {
    id: 'sawmill',
    name: 'Lumber Sawmill',
    icon: '🪵',
    workerBonus: '+1.2 Timber / worker',
  },
]

export function EconomyManagementPanel() {
  const state = useGameState()
  const dispatch = useGame((s) => s.dispatch)
  const closePanel = useUi((s) => s.close)

  const income = netIncome(state)
  const totalPop = state.economy?.population?.total ?? 0
  const assignedMap = state.economy?.population?.assigned ?? {}
  const totalAssigned = Object.values(assignedMap).reduce((a, b) => (a ?? 0) + (b ?? 0), 0)
  const idlePop = Math.max(0, totalPop - totalAssigned)

  const handleAssignWorker = (bId: BuildingId, delta: number) => {
    const current = assignedMap[bId] ?? 0
    const nextVal = Math.max(0, current + delta)
    if (delta > 0 && idlePop <= 0) return

    dispatch({
      type: 'SET_ASSIGNED_WORKERS',
      buildingId: bId,
      count: nextVal,
    })
  }

  return (
    <>
      <div className="panel-head">
        <div>
          <h2>Sanctuary Production &amp; Economy</h2>
          <p className="subtitle">
            Assign villager workers to production facilities and manage sanctuary resource flow.
          </p>
        </div>
        <button onClick={() => closePanel()} style={{ borderRadius: '9999px', padding: '5px 14px' }}>
          ✕ Close
        </button>
      </div>

      <div className="gp-body">
        {/* Resource rates */}
        <div className="gp-grid" style={cols(4)}>
          {Object.entries(income).map(([res, rate]) => (
            <div key={res} className="gp-stat">
              <span className="k">
                {RESOURCE_ICONS[res] ?? ''} {res}
              </span>
              <span className={`v ${rate >= 0 ? 'good' : 'bad'}`}>
                {rate >= 0 ? `+${rate.toFixed(1)}` : rate.toFixed(1)}/hr
              </span>
            </div>
          ))}
        </div>

        {/* Worker population overview */}
        <div className="gp-card active gp-row">
          <span>
            Sanctuary Villagers: <span className="gp-value gold">{totalPop}</span> workers total
          </span>
          <span className="gp-row tight">
            <span className="gp-value good">Assigned: {totalAssigned}</span>
            <span className="gp-value info">Idle: {idlePop}</span>
          </span>
        </div>

        {/* Production facilities */}
        <div className="gp-list scroll">
          {MANAGED_BUILDINGS.map((b) => {
            const level = state.buildings[b.id] ?? 0
            const assigned = assignedMap[b.id] ?? 0
            const bDef = BUILDINGS[b.id]

            return (
              <div key={b.id} className="gp-card gp-row">
                <div className="gp-row tight">
                  <div className="gp-tile-icon">{b.icon}</div>
                  <div>
                    <div className="gp-row tight">
                      <h4 className="gp-h4">{b.name}</h4>
                      <span className="gp-badge">
                        Lvl {level} / {bDef?.maxLevel ?? 4}
                      </span>
                    </div>
                    <p className="gp-note">{b.workerBonus}</p>
                  </div>
                </div>

                <div className="gp-row tight">
                  <button
                    onClick={() => handleAssignWorker(b.id, -1)}
                    disabled={assigned <= 0}
                    className="gp-btn step"
                    aria-label={`Unassign a worker from ${b.name}`}
                  >
                    −
                  </button>
                  <span className="gp-value gold">{assigned}</span>
                  <button
                    onClick={() => handleAssignWorker(b.id, 1)}
                    disabled={idlePop <= 0 || level <= 0}
                    className="gp-btn step gold"
                    aria-label={`Assign a worker to ${b.name}`}
                  >
                    +
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Livestock */}
        <div>
          <h3 className="gp-h3">Sanctuary Livestock Pens</h3>
          <div className="gp-grid" style={cols(4)}>
            {Object.entries(state.economy?.livestock ?? {}).map(([animal, count]) => (
              <div key={animal} className="gp-stat">
                <span className="k">{animal}</span>
                <span className="v gold">{count} Head</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
