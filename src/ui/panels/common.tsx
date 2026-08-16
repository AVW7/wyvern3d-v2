'use client'

import type React from 'react'
import { useUi } from '@/state/uiStore'
import { useGame, useGameState } from '@/state/store'
import type { Resources, WyvernInstance } from '@/core/types'
import { BUILDINGS } from '@/core/data/buildings'
import { SPECIES } from '@/core/data/species'
import { STATIONS } from '@/core/data/stations'
import { TRAITS } from '@/core/data/traits'
import { powerRating, getWyvernLevelProgress } from '@/core/entities/wyvern'

export function Head({ title, subtitle }: { title: string; subtitle: string }) {
  const close = useUi((s) => s.close)
  return (
    <div className="panel-head">
      <div>
        <h2>{title}</h2>
        <p className="subtitle">{subtitle}</p>
      </div>
      <button onClick={close} style={{ borderRadius: '9999px', padding: '5px 14px' }}>✕ Close</button>
    </div>
  )
}

export function Cost({ cost }: { cost: Partial<Resources> }) {
  const entries = Object.entries(cost).filter(([, v]) => (v ?? 0) > 0)
  if (entries.length === 0) return <span className="cost">free</span>
  return (
    <span className="cost">
      {entries.map(([k, v]) => `${v} ${k}`).join(' · ')}
    </span>
  )
}

export function Bar({ value, max, tone }: { value: number; max: number; tone?: 'good' | 'bad' }) {
  return (
    <div className={`bar ${tone ?? ''}`}>
      <i style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} />
    </div>
  )
}

export function assignmentLabel(w: WyvernInstance): string {
  switch (w.assignment.kind) {
    case 'training':
      return `${STATIONS[w.assignment.stationId]?.name ?? 'training'} · ${w.assignment.ticksLeft}h left`
    case 'breeding':
      return `breeding · ${w.assignment.ticksLeft}h left`
    case 'garrison':
      return `garrisoned`
    default:
      return 'idle'
  }
}

export function WyvernCard({
  wyvern,
  selected,
  onClick,
  children,
}: {
  wyvern: WyvernInstance
  selected?: boolean
  onClick?: () => void
  children?: React.ReactNode
}) {
  const species = SPECIES[wyvern.speciesId]
  const levelInfo = getWyvernLevelProgress(wyvern)
  return (
    <div className={`card ${selected ? 'selected' : ''}`} onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <h3 style={{ color: species?.color }}>{wyvern.name}</h3>
      <div className="meta">
        {species?.name} · {wyvern.stage} · lvl {wyvern.level} · power {Math.round(powerRating(wyvern))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
        <span>Level XP Progress</span>
        <span className="tabular">{levelInfo.isMaxLevel ? 'MAX LEVEL' : `${levelInfo.xpPercent.toFixed(1)}% (${Math.round(levelInfo.currentXp)}/${levelInfo.requiredXp})`}</span>
      </div>
      <Bar value={levelInfo.xpPercent} max={100} tone={levelInfo.canLevelUp ? 'good' : 'good'} />

      <div className="stats">
        {(['power', 'speed', 'stamina', 'firepower', 'armor'] as const).map((s) => (
          <div className="stat" key={s}>
            <span className="k">{s.slice(0, 3)}</span>
            {Math.round(wyvern.stats[s])}
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, color: 'var(--muted)' }}>bond {Math.round(wyvern.bond)}</div>
      <Bar value={wyvern.bond} max={100} tone="good" />
      {wyvern.hunger > 5 && (
        <>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>hunger {Math.round(wyvern.hunger)}</div>
          <Bar value={wyvern.hunger} max={100} tone="bad" />
        </>
      )}
      {wyvern.injury > 1 && (
        <>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>injury {Math.round(wyvern.injury)}</div>
          <Bar value={wyvern.injury} max={100} tone="bad" />
        </>
      )}

      <div className="row" style={{ marginTop: 6 }}>
        <span className="tag">{assignmentLabel(wyvern)}</span>
        {wyvern.traits.map((t) => (
          <span className="tag gold" key={t} title={TRAITS[t]?.description}>
            {TRAITS[t]?.name ?? t}
          </span>
        ))}
      </div>

      {children && <div className="row" style={{ marginTop: 8 }}>{children}</div>}
    </div>
  )
}

export function BuildingUpgrade({ id }: { id: keyof typeof BUILDINGS }) {
  const state = useGameState()
  const dispatch = useGame((s) => s.dispatch)
  const def = BUILDINGS[id]!
  const level = state.buildings[def.id] ?? 0
  const maxed = level >= def.maxLevel
  const cost = def.costPerLevel[level] ?? {}

  const pct = Math.round((level / def.maxLevel) * 100)
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>
          {def.name} — level {level} / {def.maxLevel}
        </h3>
        <span className="tabular" style={{ fontSize: 12, fontWeight: 600, color: maxed ? '#4e8f5a' : 'var(--accent)' }}>
          {pct}% Cap
        </span>
      </div>
      <div className="meta">{def.description}</div>
      <Bar value={pct} max={100} tone={maxed ? 'good' : 'good'} />
      {maxed ? (
        <span className="tag good" style={{ marginTop: 8 }}>fully extended</span>
      ) : (
        <div className="row" style={{ marginTop: 8 }}>
          <button className="primary" onClick={() => dispatch({ type: 'UPGRADE_BUILDING', buildingId: def.id })}>
            Extend to level {level + 1}
          </button>
          <Cost cost={cost} />
        </div>
      )}
    </div>
  )
}
