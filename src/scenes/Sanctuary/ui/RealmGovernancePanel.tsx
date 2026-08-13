'use client'

import { useState } from 'react'
import { useGame, useGameState } from '@/state/store'
import { useUi } from '@/state/uiStore'
import { PHILOSOPHIES, PHILOSOPHY_LIST } from '@/core/data/philosophies'
import type { ElixirType, EquipmentType, ElementalAffinity, RulerEdict, RulerTitle } from '@/core/types'

type TabType = 'throne' | 'philosophy' | 'apothecary' | 'blacksmith' | 'bending' | 'history'

const EDICT_DESCRIPTIONS: Record<RulerEdict, { title: string; desc: string; icon: string }> = {
  conquest_harvest: { title: 'Conquest Harvest', desc: '+25% regional resource income across all biomes.', icon: '🌾' },
  royal_garrison: { title: 'Royal Garrison', desc: '-50% unrest accumulation & +20% garrison defense.', icon: '🛡️' },
  dragon_harmony: { title: 'Dragon Harmony', desc: '+20% wyvern bond growth & -30% hunger rate.', icon: '🐉' },
  grand_taxation: { title: 'Grand Taxation', desc: '+50% Gold output, but +10% unrest in conquered regions.', icon: '💰' },
}

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="relative w-full max-w-4xl rounded-2xl bg-slate-900/95 border border-amber-500/30 p-6 text-slate-100 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Panel Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20 text-2xl border border-amber-500/40">
              👑
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-amber-400 capitalize">
                Realm Governance & High Sovereign Throne
              </h2>
              <p className="text-xs text-slate-400">
                Sovereign: <span className="text-amber-200 font-semibold">{realm.ruler.title.toUpperCase()}</span> · Exploration: {exploredPct}% Explored · Realm Prestige: {realm.ruler.prestige}
              </p>
            </div>
          </div>
          <button
            onClick={() => closePanel()}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
          >
            Close ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="mt-4 flex gap-1 border-b border-slate-800 pb-2 text-xs font-semibold overflow-x-auto pr-1">
          {[
            { id: 'throne', label: '👑 Throne & Edicts', badge: null },
            { id: 'philosophy', label: '📜 Philosophy Lyceum', badge: realm.philosophies.unlocked.length },
            { id: 'apothecary', label: '🌿 Healing Apothecary', badge: null },
            { id: 'blacksmith', label: '⚒️ Blacksmith Forge', badge: null },
            { id: 'bending', label: '🔥 Grand Master Bending', badge: null },
            { id: 'history', label: '📖 History Codex', badge: realm.history.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 transition ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800/60 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge !== null && (
                <span className="rounded bg-slate-900/60 px-1.5 py-0.5 text-[10px] text-amber-300">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content Body */}
        <div className="mt-4 overflow-y-auto pr-2 flex-1 space-y-4">
          {/* TAB 1: THRONE & EDICTS */}
          {activeTab === 'throne' && (
            <div className="space-y-4">
              {/* Title & Edict Selector */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-slate-800/60 p-4 border border-slate-700/50">
                  <h3 className="text-sm font-bold text-amber-300 mb-2">Royal Sovereign Title</h3>
                  <div className="flex gap-2">
                    {(['king', 'queen'] as RulerTitle[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => dispatch({ type: 'SET_RULER_TITLE', title: t })}
                        className={`flex-1 rounded-lg py-2 text-xs font-semibold capitalize transition ${
                          realm.ruler.title === t
                            ? 'bg-amber-500 text-slate-950 font-bold'
                            : 'bg-slate-900 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {t === 'king' ? '👑 King' : '👑 Queen'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-800/60 p-4 border border-slate-700/50">
                  <h3 className="text-sm font-bold text-amber-300 mb-2">Realm Summary</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                      <span className="text-slate-400 block">Explored Realm</span>
                      <span className="font-mono text-emerald-400 font-bold">{heldRegions} / {totalRegions} ({exploredPct}%)</span>
                    </div>
                    <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                      <span className="text-slate-400 block">Standing Army</span>
                      <span className="font-mono text-sky-400 font-bold">{totalSquadStrength} Troops</span>
                    </div>
                    <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                      <span className="text-slate-400 block">Wyvern Roster</span>
                      <span className="font-mono text-amber-400 font-bold">{totalWyverns} Adult Beasts</span>
                    </div>
                    <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                      <span className="text-slate-400 block">Revolt Risk</span>
                      <span className={`font-mono font-bold ${revoltingRegions > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {revoltingRegions > 0 ? `${revoltingRegions} High Unrest` : 'Stable'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Royal Edicts */}
              <div>
                <h3 className="text-sm font-bold text-amber-300 mb-3">Enact Royal Edict</h3>
                <div className="grid grid-cols-2 gap-3">
                  {(Object.keys(EDICT_DESCRIPTIONS) as RulerEdict[]).map((eKey) => {
                    const info = EDICT_DESCRIPTIONS[eKey]
                    const isActive = realm.ruler.edict === eKey
                    return (
                      <div
                        key={eKey}
                        className={`rounded-xl p-3 border transition ${
                          isActive
                            ? 'bg-amber-950/40 border-amber-500/70'
                            : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/80'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                            <span>{info.icon}</span>
                            <span>{info.title}</span>
                          </span>
                          <button
                            onClick={() => dispatch({ type: 'SET_RULER_EDICT', edict: eKey })}
                            className={`rounded px-2.5 py-1 text-xs font-semibold ${
                              isActive ? 'bg-amber-500 text-slate-950' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                            }`}
                          >
                            {isActive ? 'Active' : 'Enact'}
                          </button>
                        </div>
                        <p className="mt-2 text-xs text-slate-400">{info.desc}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PHILOSOPHY ACADEMY */}
          {activeTab === 'philosophy' && (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-800/60 p-4 border border-slate-700/50">
                <h3 className="text-sm font-bold text-amber-300">Sanctuary Lyceum & Philosophy Research</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Assign scholars at the Philosophy Academy to research ancient treatises that grant permanent realm-wide bonuses.
                </p>
                {realm.philosophies.activeResearch && (
                  <div className="mt-3 rounded-lg bg-amber-950/50 border border-amber-800/50 p-3 text-xs">
                    <span className="font-semibold text-amber-300">
                      Currently Researching: {PHILOSOPHIES[realm.philosophies.activeResearch]?.name}
                    </span>
                    <div className="mt-1 flex items-center justify-between text-slate-300">
                      <span>Progress: {realm.philosophies.researchProgress} / {PHILOSOPHIES[realm.philosophies.activeResearch]?.researchDurationTicks} ticks</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {PHILOSOPHY_LIST.map((p) => {
                  const isUnlocked = realm.philosophies.unlocked.includes(p.id)
                  const isCurrent = realm.philosophies.activeResearch === p.id

                  return (
                    <div
                      key={p.id}
                      className={`rounded-xl p-4 border ${
                        isUnlocked
                          ? 'bg-emerald-950/30 border-emerald-700/50'
                          : isCurrent
                          ? 'bg-amber-950/30 border-amber-700/50'
                          : 'bg-slate-800/40 border-slate-700/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{p.icon}</span>
                          <div>
                            <h4 className="font-bold text-sm text-slate-100">{p.name}</h4>
                            <span className="text-[10px] text-slate-400 block">{p.subtitle}</span>
                          </div>
                        </div>
                        {isUnlocked ? (
                          <span className="rounded bg-emerald-800/40 px-2 py-0.5 text-xs text-emerald-300 font-semibold border border-emerald-700">
                            Unlocked
                          </span>
                        ) : isCurrent ? (
                          <span className="rounded bg-amber-800/40 px-2 py-0.5 text-xs text-amber-300 font-semibold border border-amber-700">
                            Researching
                          </span>
                        ) : (
                          <button
                            onClick={() => dispatch({ type: 'RESEARCH_PHILOSOPHY', philosophyId: p.id })}
                            className="rounded bg-amber-600 px-2.5 py-1 text-xs font-semibold text-amber-100 hover:bg-amber-500"
                          >
                            Research
                          </button>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-slate-300">{p.description}</p>
                      <div className="mt-2 rounded bg-slate-900/60 p-2 text-xs text-emerald-400 font-mono">
                        {p.effectDescription}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* TAB 3: HEALING APOTHECARY */}
          {activeTab === 'apothecary' && (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-800/60 p-4 border border-slate-700/50">
                <h3 className="text-sm font-bold text-amber-300">Apothecary Potions & Herbal Elixirs</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Brew elixirs at the Herbal Garden to instantly heal wounded wyverns, relieve hunger, or accelerate growth.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'vitality_salve', name: 'Vitality Salve', desc: 'Instantly heals -40 injury on target wyvern.', icon: '🧪' },
                  { id: 'dragon_tonic', name: 'Dragon Tonic', desc: 'Relieves -50 hunger & increases bond +15.', icon: '🍷' },
                  { id: 'growth_elixir', name: 'Growth Elixir', desc: 'Accelerates hatchling/juvenile age to adult.', icon: '✨' },
                ].map((el) => {
                  const count = realm.elixirs[el.id as ElixirType] ?? 0
                  return (
                    <div key={el.id} className="rounded-xl bg-slate-800/40 p-4 border border-slate-700/50 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-2xl">{el.icon}</span>
                          <span className="font-mono text-sm font-bold text-amber-400">{count} In Stock</span>
                        </div>
                        <h4 className="font-bold text-sm text-slate-100">{el.name}</h4>
                        <p className="text-xs text-slate-400 mt-1">{el.desc}</p>
                      </div>
                      <button
                        onClick={() => dispatch({ type: 'BREW_ELIXIR', elixirType: el.id as ElixirType })}
                        className="mt-3 w-full rounded bg-emerald-600 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500"
                      >
                        Brew Elixir
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* TAB 4: BLACKSMITH FORGE */}
          {activeTab === 'blacksmith' && (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-800/60 p-4 border border-slate-700/50">
                <h3 className="text-sm font-bold text-amber-300">Dragon-Scale Armory Forge</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Craft equipment at the Blacksmith Forge using iron, hides, and timber to equip your military units and wyverns.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'wyvern_armor', name: 'Wyvern Scale Armor', desc: '+15 Armor plating for wyverns.', icon: '🛡️' },
                  { id: 'flame_spears', name: 'Flame-Hardened Spears', desc: '+10 Squad attack strength vs beasts.', icon: '🗡️' },
                  { id: 'iron_shields', name: 'Heavy Vanguard Shields', desc: '+10 Squad defense against archers.', icon: '⚙️' },
                ].map((eq) => {
                  const count = realm.equipment[eq.id as EquipmentType] ?? 0
                  return (
                    <div key={eq.id} className="rounded-xl bg-slate-800/40 p-4 border border-slate-700/50 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-2xl">{eq.icon}</span>
                          <span className="font-mono text-sm font-bold text-amber-400">{count} Crafted</span>
                        </div>
                        <h4 className="font-bold text-sm text-slate-100">{eq.name}</h4>
                        <p className="text-xs text-slate-400 mt-1">{eq.desc}</p>
                      </div>
                      <button
                        onClick={() => dispatch({ type: 'CRAFT_EQUIPMENT', equipmentType: eq.id as EquipmentType })}
                        className="mt-3 w-full rounded bg-amber-600 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500"
                      >
                        Craft Equipment
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* TAB 5: GRAND MASTER ELEMENTAL BENDING */}
          {activeTab === 'bending' && (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-800/60 p-4 border border-slate-700/50">
                <h3 className="text-sm font-bold text-amber-300">Grand Master Elemental Mastery (Last Airbender style)</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Train in the four elemental affinities (Fire, Water, Earth, Air) at the Grand Master Elemental Spire to unlock dragon bending powers.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'fire', name: 'Fire Bending Mastery', desc: '+8% Breath firepower scaling & flame radius per level.', icon: '🔥', color: 'text-rose-400' },
                  { id: 'water', name: 'Water Bending Mastery', desc: '+10% Infirmary healing speed & aqueduct water yield per level.', icon: '💧', color: 'text-sky-400' },
                  { id: 'earth', name: 'Earth Bending Mastery', desc: '+8% Squad defense & iron smelting yield per level.', icon: '⛰️', color: 'text-emerald-400' },
                  { id: 'air', name: 'Air Bending Mastery', desc: '+8% Wyvern flight speed & stamina recovery per level.', icon: '💨', color: 'text-amber-300' },
                ].map((m) => {
                  const lvl = realm.grandMaster.masteryLevels[m.id as ElementalAffinity] ?? 0
                  return (
                    <div key={m.id} className="rounded-xl bg-slate-800/40 p-4 border border-slate-700/50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{m.icon}</span>
                          <h4 className={`font-bold text-sm ${m.color}`}>{m.name}</h4>
                        </div>
                        <span className="font-mono text-xs font-bold bg-slate-900 px-2 py-0.5 rounded text-amber-300">
                          Tier {lvl} / 5
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">{m.desc}</p>
                      <button
                        onClick={() => dispatch({ type: 'UPGRADE_ELEMENTAL_MASTERY', element: m.id as ElementalAffinity })}
                        disabled={lvl >= 5}
                        className="mt-3 w-full rounded bg-amber-600 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500 disabled:opacity-40"
                      >
                        {lvl >= 5 ? 'Max Tier Reached' : `Advance ${m.name}`}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* TAB 6: HISTORY CODEX */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="rounded-xl bg-slate-800/60 p-4 border border-slate-700/50">
                <h3 className="text-sm font-bold text-amber-300">Chronicle of the Realm</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Historical archive recording your reign's conquests, revolts, philosophy discoveries, and elemental masteries.
                </p>
              </div>

              <div className="space-y-2">
                {realm.history.map((h, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg bg-slate-950/60 p-3 border border-slate-800 text-xs">
                    <span className="font-mono text-amber-400 font-bold shrink-0">Tick {h.tick}</span>
                    <div>
                      <h5 className="font-bold text-slate-100">{h.title}</h5>
                      <p className="text-slate-400">{h.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
