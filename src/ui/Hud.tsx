'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useGame, useGameState } from '@/state/store'
import { useUi } from '@/state/uiStore'
import { useMapUiStore } from '@/state/mapUiStore'
import { RESOURCE_IDS } from '@/core/state/game'
import { netIncome } from '@/core/systems/economy'
import { Panels } from './Panels'
import { BattleHud } from './BattleHud'
import { SanctuaryCommandWheel } from './SanctuaryCommandWheel'
import { SanctuaryEditorHud } from './SanctuaryEditorHud'
import { useSanctuaryEditor } from '@/state/sanctuaryEditorStore'
import { QuickLevelWidget } from './QuickLevelWidget'
import { ControlShiftWidget } from './ControlShiftWidget'
import { useCameraStore } from '@/state/cameraStore'
import { InteractionNotice } from './InteractionNotice'
import { RegionInspector } from './RegionInspector'
import { AtlasDirectory } from './AtlasDirectory/AtlasDirectory'
import { HighlandsHud } from './HighlandsHud'
import { useHighlandsHunt } from '@/state/highlandsHuntStore'
import { BiomeTransitionOverlay } from '@/scenes/BiomeWorld/transitions/BiomeTransitionOverlay'

/** DOM overlay HUD. Kept out of the canvas so it stays accessible and cheap. */
export function Hud() {
  const state = useGameState()
  const mode = useGame((s) => s.mode)
  const setMode = useGame((s) => s.setMode)
  const selectedRegion = useGame((s) => s.selectedRegion)
  const nearby = useUi((s) => s.nearby)
  const openPanel = useUi((s) => s.openPanel)
  const open = useUi((s) => s.open)
  const hudHidden = useUi((s) => s.hudHidden)
  const toggleHud = useUi((s) => s.toggleHud)

  const isEditing = useSanctuaryEditor((s) => s.isEditing)
  const toggleEditMode = useSanctuaryEditor((s) => s.toggleEditMode)
  const atlasOpen = useMapUiStore((s) => s.atlasOpen)
  const toggleAtlas = useMapUiStore((s) => s.toggleAtlas)
  const [isEventLogCollapsed, setIsEventLogCollapsed] = useState(false)
  const [isWyvernDetailsCollapsed, setIsWyvernDetailsCollapsed] = useState(false)

  const income = netIncome(state)
  const totalRegions = Object.keys(state.regions).length
  const held = Object.values(state.regions).filter((r) => r.owner === 'player').length
  const conquestPct = totalRegions > 0 ? ((held / totalRegions) * 100).toFixed(1) : '0'

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (document.querySelector('[role="alertdialog"]')) return

      if (e.key === 'h' || e.key === 'H') {
        toggleHud()
      } else if (e.key === 'Escape') {
        if (useUi.getState().openPanel) {
          useUi.getState().close()
        } else if (useSanctuaryEditor.getState().isEditing) {
          const editor = useSanctuaryEditor.getState()
          // Placement and selection have their own Escape rule in the canvas
          // controls. Leave the editor open so Escape follows the visible hint.
          if (!editor.placingItem && !editor.selectedObjectId) editor.exitEditMode()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleHud])

  return (
    <div className="overlay">
      <CameraTransitionFlash />
      <InteractionNotice />
      {mode === 'biome' && <BiomeTransitionOverlay regionId={selectedRegion ?? undefined} key={selectedRegion ?? 'biome-trans'} />}
      {/* Standalone button shown ONLY when HUD is hidden */}
      {hudHidden && (
        <button
          className="hud-toggle-btn"
          onClick={toggleHud}
          title="Show HUD (H)"
        >
          ◉
        </button>
      )}

      {!hudHidden && (
        <>
          <div className="topbar">
            {/* Telemetry Group - Floating Clear Glass Pills */}
            <div className="telemetry-group">
              <div className="resources">
                {RESOURCE_IDS.map((id) => {
                  const rate = income[id] ?? 0
                  return (
                    <div className="resource-pill clear-glass" key={id}>
                      <span className="resource-label">{id}</span>
                      <span className="resource-val tabular">{formatCompactNum(state.resources[id])}</span>
                      {Math.abs(rate) > 0.01 && (
                        <span className={`rate ${rate >= 0 ? 'pos' : 'neg'}`}>
                          {rate >= 0 ? '+' : ''}
                          {rate.toFixed(1)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="meta-pills">
                <span className="glass-meta-pill clear-glass">
                  <span className="dot gold" /> day {Math.floor(state.tick / 24) + 1}
                </span>
                <span className="glass-meta-pill clear-glass tabular">
                  <span className="dot good" /> {held}/{totalRegions} regions ({conquestPct}%)
                </span>
                <span className="glass-meta-pill clear-glass">
                  <span className="dot accent" /> {Object.keys(state.wyverns).length} wyverns
                </span>
              </div>
            </div>

            <div className="spacer" />

            {/* Floating Navigation Pill Island */}
            {mode !== 'battle' && (
              <nav className="nav-island liquid-glass">
                {/* Back to the title page. This is the one nav entry that is a
                    real Next route — every other one swaps the scene on the
                    store so the WebGL context survives. */}
                <Link className="nav-pill-btn icon-only" href="/" title="Back to the title menu">
                  <MenuIcon />
                </Link>
                <div className="nav-divider" />
                <button
                  className={`nav-pill-btn ${mode === 'sanctuary' ? 'active' : ''}`}
                  onClick={() => setMode('sanctuary')}
                >
                  <SanctuaryIcon /> Sanctuary
                </button>
                {mode === 'sanctuary' && (
                  <button className={`nav-pill-btn ${isEditing ? 'active' : ''}`} onClick={toggleEditMode}>
                    <LayoutIcon /> Layout
                  </button>
                )}
                <button
                  className={`nav-pill-btn ${mode === 'worldmap' ? 'active' : ''}`}
                  onClick={() => setMode('worldmap')}
                >
                  <MapIcon /> Map
                </button>
                {mode === 'worldmap' && (
                  <button
                    className={`nav-pill-btn ${atlasOpen ? 'active' : ''}`}
                    onClick={toggleAtlas}
                    title="World Atlas (A)"
                  >
                    <span style={{ fontSize: 13, marginRight: 2 }}>📖</span> Atlas
                  </button>
                )}
                {mode === 'biome' && (
                  <button
                    className="nav-pill-btn active"
                    onClick={() => setMode('biome')}
                  >
                    <span style={{ fontSize: 13, marginRight: 2 }}>🌐</span> Biome World
                  </button>
                )}
                <button
                  className={`nav-pill-btn ${mode === 'highlands' ? 'active' : ''}`}
                  onClick={() => {
                    useHighlandsHunt.getState().open()
                    setMode('highlands')
                  }}
                >
                  <HighlandsIcon /> Highlands
                </button>
                <button className="nav-pill-btn" onClick={() => open('roster')}>
                  <RosterIcon /> Roster
                </button>
                <button
                  className={`nav-pill-btn ${openPanel === 'economy' ? 'active' : ''}`}
                  onClick={() => open('economy')}
                >
                  <span style={{ fontSize: 13, marginRight: 2 }}>🌾</span> Economy
                </button>
                <button
                  className={`nav-pill-btn ${openPanel === 'realm' ? 'active' : ''}`}
                  onClick={() => open('realm')}
                >
                  <span style={{ fontSize: 13, marginRight: 2 }}>👑</span> Realm
                </button>
                <button
                  className={`nav-pill-btn ${openPanel === 'camera' ? 'active' : ''}`}
                  onClick={() => open('camera')}
                  title="Camera Settings & Presets"
                >
                  <CameraIcon /> Camera
                </button>
                <button className="nav-pill-btn icon-only" onClick={() => open('help')} title="Help & Shortcuts">
                  <HelpIcon />
                </button>
                <div className="nav-divider" />
                <button className="nav-pill-btn icon-only toggle-hud-btn" onClick={toggleHud} title="Hide HUD (H)">
                  <EyeOffIcon />
                </button>
              </nav>
            )}
          </div>

          {mode === 'battle' ? (
            <BattleHud />
          ) : (
            <>
              {mode !== 'highlands' && nearby && !openPanel && !isEditing && (
                <div className="prompt liquid-glass">
                  <kbd>E</kbd> <span>{nearby.label}</span>
                </div>
              )}

              {mode === 'worldmap' && <AtlasDirectory />}

              {/* Bottom-Left Stack — Wyvern Status Card & Event Log with matching widths */}
              {mode !== 'highlands' && !isEditing && !openPanel && (
                <div className="left-dock-stack">
                  <RegionInspector />
                  <QuickLevelWidget
                    eventLogCollapsed={isEventLogCollapsed}
                    collapsed={isWyvernDetailsCollapsed}
                    onCollapsedChange={setIsWyvernDetailsCollapsed}
                  />
                  <EventLog
                    collapsed={isEventLogCollapsed}
                    onCollapsedChange={setIsEventLogCollapsed}
                  />
                </div>
              )}

              {/* Bottom-Right Camera Presets & Controls Hint */}
              {mode !== 'highlands' && !isEditing && !openPanel && (
                <div className="right-dock-stack">
                  <Controls mode={mode} />
                  <QuickCameraToolbar />
                </div>
              )}

              {mode === 'sanctuary' && !isEditing && !openPanel && <ControlShiftWidget />}
              {mode === 'sanctuary' && !isEditing && !openPanel && <SanctuaryCommandWheel />}
              {mode === 'highlands' && !openPanel && <HighlandsHud />}
            </>
          )}

          {mode === 'sanctuary' && <SanctuaryEditorHud />}
        </>
      )}

      <Panels />
    </div>
  )
}

function formatCompactNum(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 10000) return (num / 1000).toFixed(1) + 'k'
  return Math.floor(num).toLocaleString()
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2" fill="none" className="mono-svg">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2" fill="none" className="mono-svg">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="14 17 9 12 14 7" />
      <line x1="19" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function SanctuaryIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2" fill="none" className="mono-svg">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function LayoutIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2" fill="none" className="mono-svg">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  )
}

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2" fill="none" className="mono-svg">
      <polygon points="1 6 1 22 8 18 15 22 22 18 22 2 15 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="15" y1="6" x2="15" y2="22" />
    </svg>
  )
}

function HighlandsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2" fill="none" className="mono-svg">
      <path d="M3 20l6-10 4 6 3-5 5 9" />
      <path d="M3 20h18" />
    </svg>
  )
}

function RosterIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2" fill="none" className="mono-svg">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2" fill="none" className="mono-svg">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2" fill="none" className="mono-svg">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2" fill="none" className="mono-svg">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function QuickCameraToolbar() {
  const activePreset = useCameraStore((s) => s.preset)
  const followTarget = useCameraStore((s) => s.followTarget)
  const applyPreset = useCameraStore((s) => s.applyPreset)
  const open = useUi((s) => s.open)

  return (
    <div className="quick-camera-toolbar liquid-glass">
      <span className="camera-toolbar-label"><CameraIcon /> View:</span>
      <button
        className={`camera-pill-btn ${activePreset === 'default' && followTarget === 'character' ? 'active' : ''}`}
        onClick={() => applyPreset('default')}
        title="Default 3rd Person View"
      >
        Free
      </button>
      <button
        className={`camera-pill-btn ${activePreset === 'followWyvern' || followTarget === 'wyvern' ? 'active' : ''}`}
        onClick={() => applyPreset('followWyvern')}
        title="Follow Wyvern in the Sky & Ground"
      >
        Wyvern
      </button>
      <button
        className={`camera-pill-btn ${activePreset === 'topDown' ? 'active' : ''}`}
        onClick={() => applyPreset('topDown')}
        title="Tactical Top-Down View"
      >
        Overhead
      </button>
      <button
        className={`camera-pill-btn ${activePreset === 'isometric' ? 'active' : ''}`}
        onClick={() => applyPreset('isometric')}
        title="Classic Isometric View"
      >
        Iso
      </button>
      <button
        className={`camera-pill-btn ${activePreset === 'chase' ? 'active' : ''}`}
        onClick={() => applyPreset('chase')}
        title="Action Chase View"
      >
        Chase
      </button>
      <button
        className="camera-pill-btn settings-gear"
        onClick={() => open('camera')}
        title="Open Full Camera Settings"
      >
        <SettingsIcon />
      </button>
    </div>
  )
}

function EventLog({
  collapsed,
  onCollapsedChange,
}: {
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
}) {
  const state = useGameState()
  const entries = state.log.slice(-8).reverse()

  if (collapsed) {
    return (
      <div
        className="log log-collapsed liquid-glass"
        onClick={() => onCollapsedChange(false)}
      >
        <div className="log-collapsed-bar">
          <span className="log-collapsed-label">Event Log</span>
          <span className="log-collapsed-count">{entries.length}</span>
          <button
            className="widget-icon-btn"
            onClick={(e) => {
              e.stopPropagation()
              onCollapsedChange(false)
            }}
            title="Expand Event Log"
          >
            +
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="log liquid-glass">
      <div className="log-header">
        <span className="log-header-label">Events</span>
        <button
          className="widget-icon-btn"
          onClick={() => onCollapsedChange(true)}
          title="Collapse Event Log"
        >
          −
        </button>
      </div>
      {entries.length === 0 && <div className="info">Nothing has happened yet.</div>}
      {entries.map((entry, i) => (
        <div key={`${entry.tick}-${i}`} className={`log-entry ${entry.kind}`}>
          <span className={`log-dot ${entry.kind}`} />
          <span className="log-text">{entry.message}</span>
        </div>
      ))}
    </div>
  )
}

function Controls({ mode }: { mode: string }) {
  return (
    <div className="hint clear-glass">
      {mode === 'sanctuary' ? (
        <>
          <div className="hint-row">
            <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> walk · <kbd>Shift</kbd> run
          </div>
          <div className="hint-row">click move · drag orbit · scroll zoom</div>
          <div className="hint-row">click wyvern to command</div>
          <div className="hint-row">
            <kbd>E</kbd> station
          </div>
        </>
      ) : mode === 'biome' ? (
        <>
          <div className="hint-row">
            <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> fly wyvern · <kbd>Shift</kbd> boost
          </div>
          <div className="hint-row">drag orbit · scroll zoom</div>
        </>
      ) : mode === 'highlands' ? (
        <>
          <div className="hint-row">Hunting test map · no save changes</div>
          <div className="hint-row">drag orbit · scroll zoom</div>
        </>
      ) : (
        <>
          <div className="hint-row">click region to inspect</div>
          <div className="hint-row">drag orbit · scroll / W S zoom</div>
        </>
      )}
    </div>
  )
}

function CameraTransitionFlash() {
  const presetToken = useCameraStore((s) => s.presetToken)
  const preset = useCameraStore((s) => s.preset)
  const [activeLabel, setActiveLabel] = useState<string | null>(null)

  useEffect(() => {
    if (presetToken === 0) return
    const labels: Record<string, string> = {
      default: 'Default View',
      topDown: 'Top-Down View',
      isometric: 'Isometric View',
      chase: 'Chase Cam',
      cinematic: 'Cinematic View',
      followWyvern: 'Wyvern Tracking View',
    }
    setActiveLabel(labels[preset] ?? preset)
    const timer = window.setTimeout(() => setActiveLabel(null), 1200)
    return () => window.clearTimeout(timer)
  }, [presetToken, preset])

  if (!activeLabel) return null

  return (
    <div className="camera-flash-overlay" role="status" aria-live="polite">
      <span>{activeLabel}</span>
    </div>
  )
}

