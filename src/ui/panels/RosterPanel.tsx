'use client'

import { useGame, useGameState } from '@/state/store'
import { useUi } from '@/state/uiStore'
import { CONFIG } from '@/core/data/config'
import { powerRating } from '@/core/entities/wyvern'
import { Head, WyvernCard } from './common'

export function RosterPanel() {
  const state = useGameState()
  const dispatch = useGame((s) => s.dispatch)
  const focused = useUi((s) => s.focusedWyvern)
  // Clicking a wyvern in the sanctuary opens this panel; lead with that one so
  // the player doesn't have to hunt for it in a long roster.
  const wyverns = Object.values(state.wyverns).sort(
    (a, b) =>
      Number(b.id === focused) - Number(a.id === focused) || powerRating(b) - powerRating(a),
  )

  const activeDuties = state.duties?.active ?? []
  const carriedDutyId = state.duties?.carriedDutyId
  const completedCount = state.duties?.completed ?? 0

  return (
    <>
      <Head
        title="Roster & Care Duties"
        subtitle={`${wyverns.length} wyverns. Lifetime care routines completed: ${completedCount}.`}
      />

      {/* Sanctuary Care Duties Section */}
      <div className="card" style={{ marginBottom: 14, background: 'rgba(255, 255, 255, 0.04)', borderColor: 'rgba(255, 255, 255, 0.12)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ fontSize: 13, margin: 0, color: 'var(--accent)' }}>Active Care Duties ({activeDuties.length}/3)</h3>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Completed: {completedCount}</span>
        </div>
        {activeDuties.length === 0 ? (
          <p className="subtitle" style={{ margin: 0, fontSize: 11, color: 'var(--muted)' }}>
            All wyverns are well-tended. Duties appear when wyverns grow hungry (hunger ≥ 30).
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
            {activeDuties.map((d) => {
              const target = state.wyverns[d.subjectId]
              const isCarried = carriedDutyId === d.id
              return (
                <div
                  key={d.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 10px',
                    borderRadius: 6,
                    background: 'rgba(0, 0, 0, 0.25)',
                    border: isCarried ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <div style={{ fontSize: 12 }}>
                    <span style={{ fontWeight: 600 }}>Feed {target?.name ?? d.subjectId}</span>
                    <span style={{ color: 'var(--muted)', marginLeft: 6 }}>
                      (hunger: {Math.round(target?.hunger ?? 0)})
                    </span>
                    {isCarried && (
                      <span className="tag" style={{ marginLeft: 8, background: '#1d4ed8', color: '#fff' }}>
                        Carrying Ration
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {!isCarried ? (
                      <button
                        style={{ padding: '3px 8px', fontSize: 11 }}
                        onClick={() => dispatch({ type: 'TAKE_DUTY_ITEM', dutyId: d.id })}
                      >
                        Collect Ration
                      </button>
                    ) : (
                      <button
                        style={{ padding: '3px 8px', fontSize: 11 }}
                        onClick={() => dispatch({ type: 'ABANDON_DUTY_ITEM', dutyId: d.id })}
                      >
                        Put Down
                      </button>
                    )}
                    <button
                      className="primary"
                      style={{ padding: '3px 8px', fontSize: 11 }}
                      disabled={state.resources.food < CONFIG.wyvern.feedCost}
                      onClick={() => dispatch({ type: 'COMPLETE_DUTY', dutyId: d.id })}
                    >
                      Deliver & Feed
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {wyverns.length === 0 && <p className="subtitle">No wyverns. Hatch an egg to begin.</p>}
      <div className="grid">
        {wyverns.map((w) => (
          <WyvernCard key={w.id} wyvern={w} selected={w.id === focused}>
            <div style={{ width: '100%', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--muted)' }}>Idle Perch:</span>
              <select
                value={w.preferredPerchIndex ?? 0}
                onChange={(e) => dispatch({ type: 'SET_WYVERN_PERCH', wyvernId: w.id, perchIndex: Number(e.target.value) })}
                style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.08)', color: 'inherit', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }}
              >
                {Array.from({ length: 8 }, (_, i) => (
                  <option key={i} value={i} style={{ background: '#1e293b', color: '#fff' }}>Spot {i + 1}</option>
                ))}
              </select>
            </div>
            <button onClick={() => dispatch({ type: 'FEED_WYVERN', wyvernId: w.id })} disabled={w.hunger < 5}>
              Feed ({CONFIG.wyvern.feedCost} food)
            </button>
            {w.assignment.kind !== 'idle' && (
              <button onClick={() => dispatch({ type: 'CANCEL_ASSIGNMENT', wyvernId: w.id })}>Recall</button>
            )}
            <button className="danger" onClick={() => dispatch({ type: 'RELEASE_WYVERN', wyvernId: w.id })}>
              Release
            </button>
          </WyvernCard>
        ))}
      </div>
    </>
  )
}
