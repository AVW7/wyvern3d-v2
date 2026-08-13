'use client'

import { useState } from 'react'
import { useGame, useGameState } from '@/state/store'
import { useUi } from '@/state/uiStore'
import type { Resources, WyvernInstance } from '@/core/types'
import { BUILDINGS } from '@/core/data/buildings'
import { CONFIG } from '@/core/data/config'
import { REGIONS } from '@/core/data/regions'
import { SPECIES } from '@/core/data/species'
import { STATION_LIST, STATIONS } from '@/core/data/stations'
import { TRAITS } from '@/core/data/traits'
import { UNIT_LIST, UNITS } from '@/core/data/units'
import { capacityOf, isAttackable } from '@/core/state/game'
import { isDeployable, powerRating, getWyvernLevelProgress } from '@/core/entities/wyvern'
import { CameraSettingsPanel } from './CameraSettingsPanel'
import { EconomyManagementPanel } from '@/scenes/Sanctuary/ui/EconomyManagementPanel'
import { RealmGovernancePanel } from '@/scenes/Sanctuary/ui/RealmGovernancePanel'

export function Panels() {
  const panel = useUi((s) => s.openPanel)
  if (!panel) return null

  return (
    <div className="panel liquid-glass">
      {panel === 'roster' && <RosterPanel />}
      {panel === 'training' && <TrainingPanel />}
      {panel === 'hatchery' && <HatcheryPanel />}
      {panel === 'breeding' && <BreedingPanel />}
      {panel === 'barracks' && <BarracksPanel />}
      {panel === 'infirmary' && <InfirmaryPanel />}
      {panel === 'warTable' && <WarTablePanel />}
      {panel === 'help' && <HelpPanel />}
      {panel === 'camera' && <CameraSettingsPanel />}
      {panel === 'economy' && <EconomyManagementPanel />}
      {panel === 'realm' && <RealmGovernancePanel />}
    </div>
  )
}

function Head({ title, subtitle }: { title: string; subtitle: string }) {
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

function Cost({ cost }: { cost: Partial<Resources> }) {
  const entries = Object.entries(cost).filter(([, v]) => (v ?? 0) > 0)
  if (entries.length === 0) return <span className="cost">free</span>
  return (
    <span className="cost">
      {entries.map(([k, v]) => `${v} ${k}`).join(' · ')}
    </span>
  )
}

function Bar({ value, max, tone }: { value: number; max: number; tone?: 'good' | 'bad' }) {
  return (
    <div className={`bar ${tone ?? ''}`}>
      <i style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} />
    </div>
  )
}

function assignmentLabel(w: WyvernInstance): string {
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

function WyvernCard({
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

// ---------------------------------------------------------------------------

function RosterPanel() {
  const state = useGameState()
  const dispatch = useGame((s) => s.dispatch)
  const focused = useUi((s) => s.focusedWyvern)
  // Clicking a wyvern in the sanctuary opens this panel; lead with that one so
  // the player doesn't have to hunt for it in a long roster.
  const wyverns = Object.values(state.wyverns).sort(
    (a, b) =>
      Number(b.id === focused) - Number(a.id === focused) || powerRating(b) - powerRating(a),
  )

  return (
    <>
      <Head
        title="Roster"
        subtitle={`${wyverns.length} wyverns. Only adults can ride to war, and only if their injuries are below ${CONFIG.wyvern.maxDeployInjury}.`}
      />
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

function TrainingPanel() {
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

function HatcheryPanel() {
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

function BreedingPanel() {
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

function BuildingUpgrade({ id }: { id: keyof typeof BUILDINGS }) {
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

function BarracksPanel() {
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

function InfirmaryPanel() {
  const state = useGameState()
  const allWyverns = Object.values(state.wyverns)
  const wounded = allWyverns.filter((w) => w.injury > 1)
  const healthy = allWyverns.filter((w) => w.injury <= 1)
  const rate = CONFIG.wyvern.healPerTick * (capacityOf(state, 'infirmary') + 1)
  const [priorityWyvernId, setPriorityWyvernId] = useState<string | null>(null)
  const [showHealthy, setShowHealthy] = useState(false)

  return (
    <>
      <Head title="Infirmary" subtitle={`Healing ${rate.toFixed(2)} injury per hour across the roster.`} />
      <BuildingUpgrade id="infirmary" />

      {wounded.length > 0 && (
        <div className="infirmary-status-banner">
          <div className="pulse-ring-indicator" />
          <span>Active Healing Station — {wounded.length} wyvern{wounded.length > 1 ? 's' : ''} receiving care</span>
        </div>
      )}

      <div className="infirmary-section">
        <h3>Wounded Wyverns ({wounded.length})</h3>
        {wounded.length === 0 ? (
          <p className="subtitle" style={{ color: 'var(--good)' }}>All wyverns are in top shape! No injuries recorded.</p>
        ) : (
          <div className="grid">
            {wounded.map((w) => {
              const healthPct = Math.max(0, Math.round(100 - (w.injury / 200) * 100))
              const hoursLeft = Math.ceil(w.injury / Math.max(0.01, rate))
              const isPriority = priorityWyvernId === w.id
              const severity = w.injury >= 100 ? 'critical' : w.injury >= 40 ? 'injured' : 'recovering'
              const species = SPECIES[w.speciesId]

              return (
                <div key={w.id} className={`card infirmary-card ${severity} ${isPriority ? 'priority' : ''}`}>
                  <div className="infirmary-card-header">
                    <h3 style={{ color: species?.color, margin: 0 }}>{w.name}</h3>
                    <span className={`severity-badge ${severity}`}>
                      {severity.toUpperCase()}
                    </span>
                  </div>

                  <div className="meta">
                    {species?.name} · lvl {w.level}
                  </div>

                  <div className="wound-meter-group">
                    <div className="wound-labels">
                      <span>Health ({healthPct}%)</span>
                      <span className="eta-tag">~{hoursLeft}h remaining</span>
                    </div>
                    <div className={`bar ${severity === 'critical' ? 'bad' : severity === 'injured' ? '' : 'good'}`}>
                      <i style={{ width: `${healthPct}%` }} />
                    </div>
                  </div>

                  <div className="infirmary-card-actions">
                    <button
                      type="button"
                      className={`priority-btn ${isPriority ? 'active' : ''}`}
                      onClick={() => setPriorityWyvernId(isPriority ? null : w.id)}
                    >
                      {isPriority ? '★ Priority Bed' : '☆ Mark Priority'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {healthy.length > 0 && (
        <div className="infirmary-section" style={{ marginTop: 24 }}>
          <button
            type="button"
            className="accordion-toggle-btn"
            onClick={() => setShowHealthy(!showHealthy)}
          >
            <span>Healthy Wyverns ({healthy.length})</span>
            <span className="caret">{showHealthy ? '▲' : '▼'}</span>
          </button>

          {showHealthy && (
            <div className="grid" style={{ marginTop: 12 }}>
              {healthy.map((w) => (
                <WyvernCard key={w.id} wyvern={w} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}


function WarTablePanel() {
  const state = useGameState()
  const dispatch = useGame((s) => s.dispatch)
  const setMode = useGame((s) => s.setMode)
  const close = useUi((s) => s.close)
  const selectedRegion = useGame((s) => s.selectedRegion)

  const [wyvernIds, setWyvernIds] = useState<string[]>([])
  const [squadIds, setSquadIds] = useState<string[]>([])

  const target = selectedRegion ? REGIONS[selectedRegion] : null
  const attackable = selectedRegion ? isAttackable(state, selectedRegion) : false
  const deployable = Object.values(state.wyverns).filter(isDeployable)
  const available = Object.values(state.squads).filter((s) => s.stationedAt === null)

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

  const launch = (mode: 'play' | 'auto') => {
    if (!selectedRegion) return
    dispatch({
      type: 'LAUNCH_ATTACK',
      regionId: selectedRegion,
      wyvernIds,
      squadIds,
      pilotedWyvernId: wyvernIds[0] ?? null,
      mode,
    })
    close()
    // An auto battle is already resolved by the time the next tick runs, so
    // there is nothing to fly — stay on the map.
    setMode(mode === 'play' ? 'battle' : 'worldmap')
  }

  if (!target || !selectedRegion) {
    return (
      <>
        <Head title="War Table" subtitle="Select a region on the world map to plan an assault." />
        <button className="primary" onClick={() => { setMode('worldmap'); close() }}>
          Open the world map
        </button>
      </>
    )
  }

  const region = state.regions[selectedRegion]!
  const nothingCommitted = wyvernIds.length === 0 && squadIds.length === 0

  return (
    <>
      <Head
        title={`Assault on ${target.name}`}
        subtitle={`Tier ${target.tier} · ${target.biome} · drops ${SPECIES[target.nativeSpecies]?.name} eggs`}
      />

      {region.owner === 'player' ? (
        <p className="subtitle" style={{ color: 'var(--good)' }}>
          You already hold this region. Unrest {Math.round(region.unrest)}%.
        </p>
      ) : !attackable ? (
        <p className="subtitle" style={{ color: 'var(--bad)' }}>
          Not reachable — you must hold a neighbouring region first.
        </p>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 14 }}>
            <h3>Defenders</h3>
            <div className="meta">
              {region.garrison.map((g) => `${Math.round(g.strength)} ${UNITS[g.unitId]?.name}`).join(' · ') ||
                'no garrison'}
            </div>
            {target.defenders.length > 0 && (
              <div className="row">
                {target.defenders.map((d, i) => (
                  <span className="tag bad" key={i}>
                    {SPECIES[d]?.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>Commit wyverns</h3>
          <div className="grid">
            {deployable.map((w) => (
              <WyvernCard
                key={w.id}
                wyvern={w}
                selected={wyvernIds.includes(w.id)}
                onClick={() => toggle(wyvernIds, setWyvernIds, w.id)}
              />
            ))}
          </div>
          {deployable.length === 0 && (
            <p className="subtitle">No wyverns fit to fly — they must be adult and lightly injured.</p>
          )}

          <h3 style={{ fontSize: 14, margin: '16px 0 8px' }}>Commit squads</h3>
          <div className="row">
            {available.map((s) => (
              <button
                key={s.id}
                className={squadIds.includes(s.id) ? 'active' : ''}
                onClick={() => toggle(squadIds, setSquadIds, s.id)}
              >
                {Math.round(s.strength)} {UNITS[s.unitId]?.name}
              </button>
            ))}
            {available.length === 0 && <span className="subtitle">No squads at the sanctuary.</span>}
          </div>

          <div className="row" style={{ marginTop: 18 }}>
            <button className="primary" disabled={nothingCommitted} onClick={() => launch('play')}>
              Fly the assault
            </button>
            <button disabled={nothingCommitted} onClick={() => launch('auto')}>
              Auto-resolve
            </button>
            {wyvernIds[0] && (
              <span className="tag">you pilot {state.wyverns[wyvernIds[0]]?.name}</span>
            )}
          </div>
        </>
      )}
    </>
  )
}

function HelpPanel() {
  const reset = useGame((s) => s.reset)
  const exportReplay = useGame((s) => s.exportReplay)
  const close = useUi((s) => s.close)

  return (
    <>
      <Head title="How it works" subtitle="The loop: conquer, collect, raise, conquer harder." />
      <div className="grid">
        <div className="card">
          <h3>The sanctuary</h3>
          <div className="meta">
            Walk with WASD, drag to turn the camera, press E at a station. The keep to the north holds the war
            table; the grounds to the south hold the roosts and training stations.
          </div>
        </div>
        <div className="card">
          <h3>Raising wyverns</h3>
          <div className="meta">
            Eggs come from conquest or breeding. A hatchling needs {CONFIG.wyvern.hatchlingTicks +
              CONFIG.wyvern.juvenileTicks}h to reach adulthood, and only adults can fight.
          </div>
        </div>
        <div className="card">
          <h3>Bond decides battles</h3>
          <div className="meta">
            Training raises bond. A low-bond wyvern may ignore your orders outright, and below{' '}
            {CONFIG.battle.feralBond} it can turn feral and attack anything nearby.
          </div>
        </div>
        <div className="card">
          <h3>Flying an assault</h3>
          <div className="meta">
            Mouse steers, W/S throttle, Space breathes fire, Shift dives. Click one of your wyverns then click an
            enemy to order an attack. T tames a weakened wild wyvern.
          </div>
        </div>
        <div className="card">
          <h3>Armies hold ground</h3>
          <div className="meta">
            Spears and riders cannot reach a flying wyvern — only archers and siege can. Conquered regions build
            unrest and revolt unless you station troops there.
          </div>
        </div>
        <div className="card">
          <h3>Upkeep</h3>
          <div className="meta">
            Wyverns eat food, squads cost gold. Run short and wyverns starve, bond decays and troops desert.
          </div>
        </div>
      </div>

      <h3 style={{ fontSize: 14, margin: '18px 0 8px' }}>This run</h3>
      <div className="row">
        <button
          className="danger"
          onClick={() => {
            reset()
            close()
          }}
        >
          Abandon and start over
        </button>
        <button
          onClick={() => {
            // The intent log replays the whole session against the same seed —
            // the fastest way to hand over a reproducible bug.
            const blob = new Blob([exportReplay()], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'wyvern3d-replay.json'
            a.click()
            URL.revokeObjectURL(url)
          }}
        >
          Export replay
        </button>
        <span className="cost">a replay reproduces this session exactly from its seed</span>
      </div>
    </>
  )
}
