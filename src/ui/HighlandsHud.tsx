'use client'

import { useGame, useGameState } from '@/state/store'
import { usePlayerControlStore } from '@/state/playerControlStore'
import { highlandsPhaseLabel } from '@/scenes/Highlands/HighlandsScene'
import { isHighlandsHunter, useHighlandsHunt, type HighlandsMode } from '@/state/highlandsHuntStore'

const MODE_COPY: Record<HighlandsMode, { title: string; body: string }> = {
  guided: {
    title: 'Guided hunt',
    body: 'Watch the selected wyvern search, fire, strike, carry, feed, and recover.',
  },
  playable: {
    title: 'Playable hunt',
    body: 'Fly the selected wyvern. Land near a doe, then press R to test the hunt sequence.',
  },
  explore: {
    title: 'Explore',
    body: 'Inspect the Highland does and launch a guided or playable test whenever you are ready.',
  },
}

/** Dedicated overlay for the temporary Highlands hunt-animation testbed. */
export function HighlandsHud() {
  const state = useGameState()
  const session = useHighlandsHunt((hunt) => hunt)
  const adults = Object.values(state.wyverns).filter(isHighlandsHunter)
  const selected = adults.find((wyvern) => wyvern.id === session.selectedWyvernId) ?? null

  const leaveHighlands = () => {
    useHighlandsHunt.getState().reset()
    usePlayerControlStore.getState().shiftToHuman()
    useGame.getState().setMode('sanctuary')
  }

  const start = (mode: HighlandsMode) => {
    useHighlandsHunt.getState().start(mode)
  }

  if (!session.mode) {
    return (
      <section className="highlands-panel liquid-glass" aria-label="Highlands hunt test launcher">
        <div className="highlands-heading">
          <span className="highlands-kicker">Hunting animation testbed</span>
          <h2>Highlands</h2>
          <p>Choose an adult wyvern and a test. No food, hunger, cooldown, or save data changes here.</p>
        </div>

        {adults.length > 0 ? (
          <label className="highlands-field">
            <span>Hunter</span>
            <select
              value={selected?.id ?? ''}
              onChange={(event) => useHighlandsHunt.getState().selectWyvern(event.target.value)}
            >
              <option value="" disabled>Select an adult wyvern</option>
              {adults.map((wyvern) => <option key={wyvern.id} value={wyvern.id}>{wyvern.name}</option>)}
            </select>
          </label>
        ) : (
          <p className="highlands-warning">An adult wyvern is needed to run this hunt test.</p>
        )}

        <div className="highlands-mode-grid">
          {(Object.keys(MODE_COPY) as HighlandsMode[]).map((mode) => (
            <button
              key={mode}
              className="highlands-mode-button"
              disabled={!selected}
              onClick={() => start(mode)}
            >
              <strong>{MODE_COPY[mode].title}</strong>
              <span>{MODE_COPY[mode].body}</span>
            </button>
          ))}
        </div>

        <button className="highlands-return" onClick={leaveHighlands}>Return to Sanctuary</button>
      </section>
    )
  }

  const copy = MODE_COPY[session.mode]
  const completed = session.phase === 'complete'
  const exploring = session.mode === 'explore' && session.phase === 'ready'

  return (
    <section className="highlands-panel highlands-running liquid-glass" aria-label="Highlands hunt test status">
      <div className="highlands-heading">
        <span className="highlands-kicker">Highlands · animation test</span>
        <h2>{copy.title}</h2>
        <p>{selected ? `${selected.name} is ${highlandsPhaseLabel(session.phase)}.` : highlandsPhaseLabel(session.phase)}</p>
      </div>

      {session.mode === 'playable' && session.phase === 'ready' && (
        <div className="highlands-controls">
          <span><kbd>WASD</kbd> fly / steer</span>
          <span><kbd>Space</kbd> ascend</span>
          <span><kbd>F</kbd> descend</span>
          <span><kbd>R</kbd> hunt a nearby doe</span>
        </div>
      )}

      {exploring && (
        <div className="highlands-actions">
          <button onClick={() => start('guided')}>Start guided test</button>
          <button onClick={() => start('playable')}>Start playable test</button>
        </div>
      )}

      {completed && (
        <>
          <div className="highlands-complete">
            Search, strike, carry, feeding, and recovery complete. The doe will respawn locally for another test.
          </div>
          <div className="highlands-actions">
            <button onClick={() => useHighlandsHunt.getState().open(selected?.id ?? null)}>
              Choose another test
            </button>
          </div>
        </>
      )}

      <p className="highlands-note">This is presentation-only: the hunt has no economic or save-game effect.</p>
      <button className="highlands-return" onClick={leaveHighlands}>Return to Sanctuary</button>
    </section>
  )
}
