'use client'

import { useGame, useGameState } from '@/state/store'
import { CONFIG } from '@/core/data/config'
import { SPECIES } from '@/core/data/species'
import { TRAITS } from '@/core/data/traits'
import { capacityOf } from '@/core/state/game'
import { Head, BuildingUpgrade } from './common'

export function HatcheryPanel() {
  const state = useGameState()
  const dispatch = useGame((s) => s.dispatch)
  const eggs = Object.values(state.eggs)
  const capacity = capacityOf(state, 'hatchery')
  const warming = eggs.filter((e) => e.incubatingTicksLeft !== null)

  return (
    <>
      <Head
        title="Hatchery"
        subtitle={`${warming.length} of ${capacity} roosts warming. Incubation takes ${CONFIG.wyvern.incubationTicks}h, then the hatchling needs ${CONFIG.wyvern.hatchlingTicks + CONFIG.wyvern.juvenileTicks}h more to reach adulthood.`}
      />
      <BuildingUpgrade id="hatchery" />

      {eggs.length === 0 && <p className="subtitle">No eggs. Conquer a region or breed a pair to get some.</p>}

      <div className="grid">
        {eggs.map((egg) => {
          const species = SPECIES[egg.speciesId]
          return (
            <div className="card" key={egg.id}>
              <h3 style={{ color: species?.color }}>{species?.name} egg</h3>
              <div className="meta">
                {egg.parents ? 'bred' : 'recovered from a conquest'}
                {egg.incubatingTicksLeft !== null && ` · ${egg.incubatingTicksLeft}h to hatch`}
              </div>
              <div className="stats">
                {(['power', 'speed', 'stamina', 'firepower', 'armor'] as const).map((s) => (
                  <div className="stat" key={s}>
                    <span className="k">{s.slice(0, 3)}</span>
                    {Math.round(egg.rolledStats[s])}
                  </div>
                ))}
              </div>
              <div className="row">
                {egg.rolledTraits.map((t) => (
                  <span className="tag gold" key={t}>
                    {TRAITS[t]?.name ?? t}
                  </span>
                ))}
              </div>
              {egg.incubatingTicksLeft === null && (
                <button
                  className="primary"
                  style={{ marginTop: 8 }}
                  disabled={warming.length >= capacity}
                  onClick={() => dispatch({ type: 'INCUBATE_EGG', eggId: egg.id })}
                >
                  Set to warm
                </button>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
