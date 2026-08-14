'use client'

import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useGame, useGameState } from '@/state/store'
import { useUi } from '@/state/uiStore'
import { PHILOSOPHIES, PHILOSOPHY_LIST } from '@/core/data/philosophies'
import type { ElixirType, EquipmentType, ElementalAffinity, RulerEdict, RulerTitle } from '@/core/types'

type TabType = 'throne' | 'philosophy' | 'apothecary' | 'blacksmith' | 'bending' | 'history'

/** `.gp-grid` reads its column count from a custom property. */
const cols = (n: number) => ({ '--cols': n }) as CSSProperties

const TABS: {
  id: TabType
  label: string
  badge: 'philosophies' | 'history' | null
}[] = [
  { id: 'throne', label: '👑 Throne & Edicts', badge: null },
  { id: 'philosophy', label: '📜 Philosophy Lyceum', badge: 'philosophies' },
  { id: 'apothecary', label: '🌿 Healing Apothecary', badge: null },
  { id: 'blacksmith', label: '⚒️ Blacksmith Forge', badge: null },
  { id: 'bending', label: '🔥 Grand Master Bending', badge: null },
  { id: 'history', label: '📖 History Codex', badge: 'history' },
]

const EDICT_DESCRIPTIONS: Record<RulerEdict, { title: string; desc: string; icon: string }> = {
  conquest_harvest: {
    title: 'Conquest Harvest',
    desc: '+25% regional resource income across all biomes.',
    icon: '🌾',
  },
  royal_garrison: {
    title: 'Royal Garrison',
    desc: '-50% unrest accumulation & +20% garrison defense.',
    icon: '🛡️',
  },
  dragon_harmony: {
    title: 'Dragon Harmony',
    desc: '+20% wyvern bond growth & -30% hunger rate.',
    icon: '🐉',
  },
  grand_taxation: {
    title: 'Grand Taxation',
    desc: '+50% Gold output, but +10% unrest in conquered regions.',
    icon: '💰',
  },
}

const ELIXIRS: { id: ElixirType; name: string; desc: string; icon: string }[] = [
  {
    id: 'vitality_salve',
    name: 'Vitality Salve',
    desc: 'Instantly heals -40 injury on target wyvern.',
    icon: '🧪',
  },
  {
    id: 'dragon_tonic',
    name: 'Dragon Tonic',
    desc: 'Relieves -50 hunger & increases bond +15.',
    icon: '🍷',
  },
  {
    id: 'growth_elixir',
    name: 'Growth Elixir',
    desc: 'Accelerates hatchling/juvenile age to adult.',
    icon: '✨',
  },
]

const EQUIPMENT: {
  id: EquipmentType
  name: string
  desc: string
  icon: string
}[] = [
  {
    id: 'wyvern_armor',
    name: 'Wyvern Scale Armor',
    desc: '+15 Armor plating for wyverns.',
    icon: '🛡️',
  },
  {
    id: 'flame_spears',
    name: 'Flame-Hardened Spears',
    desc: '+10 Squad attack strength vs beasts.',
    icon: '🗡️',
  },
  {
    id: 'iron_shields',
    name: 'Heavy Vanguard Shields',
    desc: '+10 Squad defense against archers.',
    icon: '⚙️',
  },
]

const MASTERIES: {
  id: ElementalAffinity
  name: string
  desc: string
  icon: string
}[] = [
  {
    id: 'fire',
    name: 'Fire Bending Mastery',
    desc: '+8% Breath firepower scaling & flame radius per level.',
    icon: '🔥',
  },
  {
    id: 'water',
    name: 'Water Bending Mastery',
    desc: '+10% Infirmary healing speed & aqueduct water yield per level.',
    icon: '💧',
  },
  {
    id: 'earth',
    name: 'Earth Bending Mastery',
    desc: '+8% Squad defense & iron smelting yield per level.',
    icon: '⛰️',
  },
  {
    id: 'air',
    name: 'Air Bending Mastery',
    desc: '+8% Wyvern flight speed & stamina recovery per level.',
    icon: '💨',
  },
]

export function RealmGovernancePanel() {
  const state = useGameState()
  const dispatch = useGame((s) => s.dispatch)
  const closePanel = useUi((s) => s.close)
  const [activeTab, setActiveTab] = useState<TabType>('throne')

  const realm = state.realm
  const regions = Object.values(state.regions)
  const totalRegions = regions.length || 21
  const heldRegions = regions.filter((r) => r.owner === 'player').length
  const revoltingRegions = regions.filter((r) => r.owner === 'player' && r.unrest >= 70).length
  const exploredPct = Math.round((heldRegions / totalRegions) * 100)

  const totalSquadStrength = Object.values(state.squads).reduce((sum, s) => sum + s.strength, 0)
  const totalWyverns = Object.keys(state.wyverns).length

  const badgeCount = (badge: 'philosophies' | 'history') =>
    badge === 'philosophies' ? realm.philosophies.unlocked.length : realm.history.length

  return (
    <>
      <div className="panel-head">
        <div className="gp-head-left">
          <div className="gp-crest">👑</div>
          <div>
            <h2>Realm Governance &amp; High Sovereign Throne</h2>
            <p className="subtitle">
              Sovereign: <span className="gp-value gold">{realm.ruler.title.toUpperCase()}</span> · Exploration:{' '}
              {exploredPct}% Explored · Realm Prestige: {realm.ruler.prestige}
            </p>
          </div>
        </div>
        <button onClick={() => closePanel()} style={{ borderRadius: '9999px', padding: '5px 14px' }}>
          ✕ Close
        </button>
      </div>

      <div className="gp-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`gp-tab ${activeTab === tab.id ? 'active' : ''}`}
          >
            <span>{tab.label}</span>
            {tab.badge && <span className="gp-badge">{badgeCount(tab.badge)}</span>}
          </button>
        ))}
      </div>

      <div className="gp-body">
        {/* TAB 1: THRONE & EDICTS */}
        {activeTab === 'throne' && (
          <>
            <div className="gp-grid">
              <div className="gp-card">
                <h3 className="gp-h3">Royal Sovereign Title</h3>
                <div className="gp-row tight">
                  {(['king', 'queen'] as RulerTitle[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => dispatch({ type: 'SET_RULER_TITLE', title: t })}
                      className={`gp-btn ${realm.ruler.title === t ? 'gold' : ''}`}
                      style={{ flex: 1 }}
                    >
                      {t === 'king' ? '👑 King' : '👑 Queen'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="gp-card">
                <h3 className="gp-h3">Realm Summary</h3>
                <div className="gp-grid">
                  <div className="gp-stat">
                    <span className="k">Explored Realm</span>
                    <span className="v good">
                      {heldRegions} / {totalRegions} ({exploredPct}%)
                    </span>
                  </div>
                  <div className="gp-stat">
                    <span className="k">Standing Army</span>
                    <span className="v info">{totalSquadStrength} Troops</span>
                  </div>
                  <div className="gp-stat">
                    <span className="k">Wyvern Roster</span>
                    <span className="v gold">{totalWyverns} Adult Beasts</span>
                  </div>
                  <div className="gp-stat">
                    <span className="k">Revolt Risk</span>
                    <span className={`v ${revoltingRegions > 0 ? 'bad' : 'good'}`}>
                      {revoltingRegions > 0 ? `${revoltingRegions} High Unrest` : 'Stable'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="gp-h3">Enact Royal Edict</h3>
              <div className="gp-grid">
                {(Object.keys(EDICT_DESCRIPTIONS) as RulerEdict[]).map((eKey) => {
                  const info = EDICT_DESCRIPTIONS[eKey]
                  const isActive = realm.ruler.edict === eKey
                  return (
                    <div key={eKey} className={`gp-card ${isActive ? 'active' : ''}`}>
                      <div className="gp-row">
                        <h4 className="gp-h4">
                          {info.icon} {info.title}
                        </h4>
                        <button
                          onClick={() => dispatch({ type: 'SET_RULER_EDICT', edict: eKey })}
                          className={`gp-btn ${isActive ? 'gold' : ''}`}
                        >
                          {isActive ? 'Active' : 'Enact'}
                        </button>
                      </div>
                      <p className="gp-note">{info.desc}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* TAB 2: PHILOSOPHY ACADEMY */}
        {activeTab === 'philosophy' && (
          <>
            <div className="gp-card">
              <h3 className="gp-h3">Sanctuary Lyceum &amp; Philosophy Research</h3>
              <p className="gp-note">
                Assign scholars at the Philosophy Academy to research ancient treatises that grant permanent realm-wide
                bonuses.
              </p>
              {realm.philosophies.activeResearch && (
                <div className="gp-card active" style={{ marginTop: 12 }}>
                  <h4 className="gp-h4">
                    Currently Researching: {PHILOSOPHIES[realm.philosophies.activeResearch]?.name}
                  </h4>
                  <p className="gp-note">
                    Progress: {realm.philosophies.researchProgress} /{' '}
                    {PHILOSOPHIES[realm.philosophies.activeResearch]?.researchDurationTicks} ticks
                  </p>
                </div>
              )}
            </div>

            <div className="gp-grid">
              {PHILOSOPHY_LIST.map((p) => {
                const isUnlocked = realm.philosophies.unlocked.includes(p.id)
                const isCurrent = realm.philosophies.activeResearch === p.id

                return (
                  <div key={p.id} className={`gp-card ${isUnlocked ? 'done' : isCurrent ? 'active' : ''}`}>
                    <div className="gp-row">
                      <div className="gp-row tight">
                        <span className="gp-tile-icon">{p.icon}</span>
                        <div>
                          <h4 className="gp-h4">{p.name}</h4>
                          <span className="gp-note">{p.subtitle}</span>
                        </div>
                      </div>
                      {isUnlocked ? (
                        <span className="gp-badge good">Unlocked</span>
                      ) : isCurrent ? (
                        <span className="gp-badge gold">Researching</span>
                      ) : (
                        <button
                          onClick={() =>
                            dispatch({
                              type: 'RESEARCH_PHILOSOPHY',
                              philosophyId: p.id,
                            })
                          }
                          className="gp-btn gold"
                        >
                          Research
                        </button>
                      )}
                    </div>
                    <p className="gp-note bright">{p.description}</p>
                    <div className="gp-effect">{p.effectDescription}</div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* TAB 3: HEALING APOTHECARY */}
        {activeTab === 'apothecary' && (
          <>
            <div className="gp-card">
              <h3 className="gp-h3">Apothecary Potions &amp; Herbal Elixirs</h3>
              <p className="gp-note">
                Brew elixirs at the Herbal Garden to instantly heal wounded wyverns, relieve hunger, or accelerate
                growth.
              </p>
            </div>

            <div className="gp-grid" style={cols(3)}>
              {ELIXIRS.map((el) => (
                <div key={el.id} className="gp-card column">
                  <div>
                    <div className="gp-row">
                      <span className="gp-tile-icon">{el.icon}</span>
                      <span className="gp-value gold">{realm.elixirs[el.id] ?? 0} In Stock</span>
                    </div>
                    <h4 className="gp-h4" style={{ marginTop: 8 }}>
                      {el.name}
                    </h4>
                    <p className="gp-note">{el.desc}</p>
                  </div>
                  <button
                    onClick={() => dispatch({ type: 'BREW_ELIXIR', elixirType: el.id })}
                    className="gp-btn good block"
                  >
                    Brew Elixir
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* TAB 4: BLACKSMITH FORGE */}
        {activeTab === 'blacksmith' && (
          <>
            <div className="gp-card">
              <h3 className="gp-h3">Dragon-Scale Armory Forge</h3>
              <p className="gp-note">
                Craft equipment at the Blacksmith Forge using iron, hides, and timber to equip your military units and
                wyverns.
              </p>
            </div>

            <div className="gp-grid" style={cols(3)}>
              {EQUIPMENT.map((eq) => (
                <div key={eq.id} className="gp-card column">
                  <div>
                    <div className="gp-row">
                      <span className="gp-tile-icon">{eq.icon}</span>
                      <span className="gp-value gold">{realm.equipment[eq.id] ?? 0} Crafted</span>
                    </div>
                    <h4 className="gp-h4" style={{ marginTop: 8 }}>
                      {eq.name}
                    </h4>
                    <p className="gp-note">{eq.desc}</p>
                  </div>
                  <button
                    onClick={() =>
                      dispatch({
                        type: 'CRAFT_EQUIPMENT',
                        equipmentType: eq.id,
                      })
                    }
                    className="gp-btn gold block"
                  >
                    Craft Equipment
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* TAB 5: GRAND MASTER ELEMENTAL BENDING */}
        {activeTab === 'bending' && (
          <>
            <div className="gp-card">
              <h3 className="gp-h3">Grand Master Elemental Mastery</h3>
              <p className="gp-note">
                Train in the four elemental affinities (Fire, Water, Earth, Air) at the Grand Master Elemental Spire to
                unlock dragon bending powers.
              </p>
            </div>

            <div className="gp-grid">
              {MASTERIES.map((m) => {
                const lvl = realm.grandMaster.masteryLevels[m.id] ?? 0
                return (
                  <div key={m.id} className="gp-card">
                    <div className="gp-row">
                      <h4 className={`gp-h4 gp-affinity ${m.id}`}>
                        {m.icon} {m.name}
                      </h4>
                      <span className="gp-badge gold">Tier {lvl} / 5</span>
                    </div>
                    <p className="gp-note bright">{m.desc}</p>
                    <button
                      onClick={() =>
                        dispatch({
                          type: 'UPGRADE_ELEMENTAL_MASTERY',
                          element: m.id,
                        })
                      }
                      disabled={lvl >= 5}
                      className="gp-btn gold block"
                    >
                      {lvl >= 5 ? 'Max Tier Reached' : `Advance ${m.name}`}
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* TAB 6: HISTORY CODEX */}
        {activeTab === 'history' && (
          <>
            <div className="gp-card">
              <h3 className="gp-h3">Chronicle of the Realm</h3>
              <p className="gp-note">
                Historical archive recording your reign&apos;s conquests, revolts, philosophy discoveries, and elemental
                masteries.
              </p>
            </div>

            <div className="gp-list">
              {realm.history.map((h, i) => (
                <div key={i} className="gp-card inset gp-row">
                  <span className="gp-value gold">Tick {h.tick}</span>
                  <div style={{ flex: 1 }}>
                    <h4 className="gp-h4">{h.title}</h4>
                    <p className="gp-note">{h.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
