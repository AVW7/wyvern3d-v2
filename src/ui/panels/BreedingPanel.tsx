'use client'

import { useState } from 'react'
import { useGame, useGameState } from '@/state/store'
import { CONFIG } from '@/core/data/config'
import { Head, WyvernCard } from './common'

export function BreedingPanel() {
  const state = useGameState()
  const dispatch = useGame((s) => s.dispatch)
  const [picked, setPicked] = useState<string[]>([])

  const eligible = Object.values(state.wyverns).filter(
    (w) => w.stage === 'adult' && w.assignment.kind === 'idle' && w.breedCooldown <= 0,
  )

  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id].slice(-2)))

  const ready = picked.length === 2 && picked.every((id) => (state.wyverns[id]?.bond ?? 0) >= CONFIG.wyvern.breedBond)

  return (
    <>
      <Head
        title="Breeding Roosts"
        subtitle={`Pair two adults with bond ${CONFIG.wyvern.breedBond}+. The egg averages both parents and each trait has a chance to carry.`}
      />

      <div className="row" style={{ marginBottom: 12 }}>
        <button className="primary" disabled={!ready} onClick={() => {
          const [a, b] = picked
          if (a && b) dispatch({ type: 'START_BREEDING', aId: a, bId: b })
          setPicked([])
        }}>
          Pair selected ({picked.length}/2)
        </button>
        {picked.length === 2 && !ready && <span className="tag bad">bond too low</span>}
      </div>

      <div className="grid">
        {eligible.map((w) => (
          <WyvernCard key={w.id} wyvern={w} selected={picked.includes(w.id)} onClick={() => toggle(w.id)} />
        ))}
      </div>
      {eligible.length === 0 && (
        <p className="subtitle">No eligible pairs — adults must be idle and off cooldown.</p>
      )}
    </>
  )
}
