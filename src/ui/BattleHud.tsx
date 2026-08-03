'use client'

import { useBattle } from '@/scenes/Battle/battleStore'
import { useGame, useGameState } from '@/state/store'
import { REGIONS } from '@/core/data/regions'

export function BattleHud() {
  const state = useGameState()
  const battle = useBattle()
  const dispatch = useGame((s) => s.dispatch)
  const setMode = useGame((s) => s.setMode)

  const region = state.pendingBattle ? REGIONS[state.pendingBattle.regionId] : null

  return (
    <>
      <div className="crosshair" />

      <div className="battle-hud liquid-glass">
        <div style={{ fontSize: 15, marginBottom: 8 }}>{region?.name ?? 'Battle'}</div>

        <div className="label">health</div>
        <div className="bar bad">
          <i style={{ width: `${battle.hp * 100}%` }} />
        </div>

        <div className="label">stamina</div>
        <div className="bar">
          <i style={{ width: `${battle.stamina * 100}%` }} />
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <span className="tag good">{battle.alliesLeft} allied</span>
          <span className="tag bad">{battle.enemiesLeft} hostile</span>
          <span className="tag">{battle.time.toFixed(0)}s</span>
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <button onClick={() => useBattle.getState().issueBroadcast('regroup')}>Regroup</button>
          <button onClick={() => useBattle.getState().issueBroadcast('hold')}>Hold</button>
          <button onClick={() => useBattle.getState().issueBroadcast('clear')}>Free</button>
        </div>

        <button
          className="danger"
          style={{ marginTop: 10, width: '100%' }}
          onClick={() => {
            // Withdrawing forfeits the assault but costs nothing else — the
            // committed force simply comes home.
            dispatch({ type: 'ABORT_BATTLE' })
            setMode('worldmap')
          }}
        >
          Withdraw
        </button>
      </div>

      {battle.canTame && (
        <div className="banner" style={{ top: '22%' }}>
          A wild wyvern is faltering — press <kbd>T</kbd> to tame it
        </div>
      )}

      {battle.message && (
        <div className="prompt" style={{ bottom: 130 }}>
          {battle.message}
        </div>
      )}

      <div className="hint">
        <div>mouse steers · <kbd>W</kbd>/<kbd>S</kbd> throttle</div>
        <div><kbd>Space</kbd> breathe fire · <kbd>Shift</kbd> dive</div>
        <div>click an ally, then an enemy, to order an attack</div>
        <div><kbd>T</kbd> tame a weakened wild wyvern</div>
      </div>
    </>
  )
}
