'use client'

import { useState } from 'react'
import { useGame, useGameState } from '@/state/store'
import { useUi } from '@/state/uiStore'
import { STATION_LIST, STATIONS } from '@/core/data/stations'
import { capacityOf } from '@/core/state/game'
import { Head, Cost, WyvernCard } from './common'

export function TrainingPanel() {
  const state = useGameState()
  const dispatch = useGame((s) => s.dispatch)
  const focused = useUi((s) => s.focusedStation)
  const [stationId, setStationId] = useState(focused ?? STATION_LIST[0]!.id)

  const station = STATIONS[stationId]!
  const capacity = capacityOf(state, 'trainingGrounds')
  const inUse = Object.values(state.wyverns).filter((w) => w.assignment.kind === 'training').length
  const idle = Object.values(state.wyverns).filter((w) => w.assignment.kind === 'idle')

  return (
    <>
      <Head
        title="Training"
        subtitle={`${inUse} of ${capacity} slots in use. Bond gained here decides whether a wyvern obeys you in battle.`}
      />

      <div className="row" style={{ marginBottom: 14 }}>
        {STATION_LIST.map((s) => (
          <button key={s.id} className={s.id === stationId ? 'active' : ''} onClick={() => setStationId(s.id)}>
            {s.name}
          </button>
        ))}
      </div>

      <p className="subtitle">
        +{station.gain} {station.stat} and +{station.bond} bond over {station.duration}h · <Cost cost={station.cost} />
      </p>

      {inUse >= capacity && (
        <p className="subtitle" style={{ color: 'var(--bad)' }}>
          Every slot is occupied — extend the Training Grounds in the Barracks panel.
        </p>
      )}

      <div className="grid">
        {idle.map((w) => (
          <WyvernCard key={w.id} wyvern={w}>
            <button
              className="primary"
              disabled={inUse >= capacity}
              onClick={() => dispatch({ type: 'ASSIGN_TRAINING', wyvernId: w.id, stationId })}
            >
              Train at {station.name}
            </button>
          </WyvernCard>
        ))}
      </div>
      {idle.length === 0 && <p className="subtitle">No idle wyverns.</p>}
    </>
  )
}
