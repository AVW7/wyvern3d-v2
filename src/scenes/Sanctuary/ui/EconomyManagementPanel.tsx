'use client'

import { useGame, useGameState } from '@/state/store'
import { useUi } from '@/state/uiStore'
import { BUILDINGS } from '@/core/data/buildings'
import { netIncome } from '@/core/systems/economy'
import type { BuildingId } from '@/core/types'

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

const MANAGED_BUILDINGS: { id: BuildingId; name: string; icon: string; workerBonus: string }[] = [
  { id: 'farm', name: 'Sanctuary Farm', icon: '🌾', workerBonus: '+1.5 Food / worker' },
  { id: 'aqueduct', name: 'Well & Aqueduct', icon: '💧', workerBonus: '+4 Water / aqueduct lvl' },
  { id: 'pasture', name: 'Wildlife Pasture', icon: '🦌', workerBonus: 'Livestock breeding & Hides' },
  { id: 'foundry', name: 'Iron Foundry', icon: '⚙️', workerBonus: 'Smelts Ore -> Iron & Gold' },
  { id: 'sawmill', name: 'Lumber Sawmill', icon: '🪵', workerBonus: '+1.2 Timber / worker' },
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="relative w-full max-w-2xl rounded-2xl bg-slate-900/95 border border-slate-700/80 p-6 text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-amber-400">
              Sanctuary Production & Economy
            </h2>
            <p className="text-xs text-slate-400">
              Assign villager workers to production facilities and manage sanctuary resource flow.
            </p>
          </div>
          <button
            onClick={() => closePanel()}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
          >
            Close ✕
          </button>
        </div>

        {/* Resource Rates Bar */}
        <div className="my-4 grid grid-cols-4 gap-2 rounded-xl bg-slate-950/80 p-3 border border-slate-800 text-center text-xs">
          {Object.entries(income).map(([res, rate]) => (
            <div key={res} className="flex flex-col items-center">
              <span className="text-slate-400 flex items-center gap-1">
                <span>{RESOURCE_ICONS[res] ?? ''}</span>
                <span className="capitalize">{res}</span>
              </span>
              <span className={`font-mono font-bold ${rate >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {rate >= 0 ? `+${rate.toFixed(1)}` : rate.toFixed(1)}/hr
              </span>
            </div>
          ))}
        </div>

        {/* Worker Population Overview */}
        <div className="mb-4 flex items-center justify-between rounded-xl bg-amber-950/30 border border-amber-800/40 px-4 py-2 text-xs">
          <div>
            <span className="font-semibold text-amber-300">Sanctuary Villagers: </span>
            <span className="font-mono text-amber-100">{totalPop} Workers Total</span>
          </div>
          <div className="flex gap-4">
            <span className="text-emerald-300">Assigned: {totalAssigned}</span>
            <span className="text-sky-300">Idle: {idlePop}</span>
          </div>
        </div>

        {/* Production Facilities List */}
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {MANAGED_BUILDINGS.map((b) => {
            const level = state.buildings[b.id] ?? 0
            const assigned = assignedMap[b.id] ?? 0
            const bDef = BUILDINGS[b.id]

            return (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-xl bg-slate-800/60 p-3 border border-slate-700/50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-xl border border-slate-700">
                    {b.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-100">{b.name}</span>
                      <span className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[10px] text-slate-300 font-mono">
                        Lvl {level} / {bDef?.maxLevel ?? 4}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{b.workerBonus}</p>
                  </div>
                </div>

                {/* Worker Controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAssignWorker(b.id, -1)}
                    disabled={assigned <= 0}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-700 text-sm font-bold text-slate-200 hover:bg-slate-600 disabled:opacity-30"
                  >
                    -
                  </button>

                  <span className="w-8 text-center font-mono text-sm font-semibold text-amber-300">
                    {assigned}
                  </span>

                  <button
                    onClick={() => handleAssignWorker(b.id, 1)}
                    disabled={idlePop <= 0 || level <= 0}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-600 text-sm font-bold text-amber-100 hover:bg-amber-500 disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Wildlife Livestock Breakdown */}
        <div className="mt-4 border-t border-slate-800 pt-3">
          <h4 className="text-xs font-semibold text-slate-300 mb-2">Sanctuary Livestock Pens</h4>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            {Object.entries(state.economy?.livestock ?? {}).map(([animal, count]) => (
              <div key={animal} className="rounded-lg bg-slate-950/60 p-2 border border-slate-800">
                <span className="capitalize text-slate-400 block">{animal}</span>
                <span className="font-mono font-bold text-amber-300">{count} Head</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
