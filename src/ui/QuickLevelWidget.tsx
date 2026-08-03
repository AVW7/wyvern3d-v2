import { useState } from 'react'
import { useGameState } from '@/state/store'
import { useUi } from '@/state/uiStore'
import { SPECIES } from '@/core/data/species'
import { STATIONS } from '@/core/data/stations'
import { CONFIG } from '@/core/data/config'
import { getWyvernLevelProgress, getWyvernStatPercentages, powerRating } from '@/core/entities/wyvern'

// Monochrome SVG Icons
function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" className="mono-icon">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.78-8.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function FoodIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" className="mono-icon">
      <path d="M12 2a5 5 0 0 0-5 5v3a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5zM12 15v7M9 22h6" />
    </svg>
  )
}

function BondIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" className="mono-icon">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

function PowerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" className="mono-icon">
      <path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 13l2 2" />
    </svg>
  )
}

interface QuickLevelWidgetProps {
  eventLogCollapsed?: boolean
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
}

export function QuickLevelWidget({
  eventLogCollapsed = false,
  collapsed: externalCollapsed,
  onCollapsedChange,
}: QuickLevelWidgetProps) {
  const state = useGameState()
  const focusedWyvern = useUi((s) => s.focusedWyvern)
  const openWyvern = useUi((s) => s.openWyvern)

  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const isCollapsed = externalCollapsed ?? internalCollapsed
  const [dockPosition, setDockPosition] = useState<'left' | 'right'>('left')

  const handleToggleCollapse = (val: boolean, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setInternalCollapsed(val)
    onCollapsedChange?.(val)
  }

  const list = Object.values(state.wyverns)
  if (list.length === 0) return null

  const active = (focusedWyvern && state.wyverns[focusedWyvern]) || list[0]
  if (!active) return null

  const species = SPECIES[active.speciesId]
  const levelInfo = getWyvernLevelProgress(active)
  const statPercents = getWyvernStatPercentages(active)
  const power = Math.round(powerRating(active))

  let stationProgress: { label: string; percent: number } | null = null
  if (active.assignment.kind === 'training') {
    const stationDef = STATIONS[active.assignment.stationId]
    const total = stationDef?.duration ?? 30
    const pct = Math.min(100, Math.max(0, Math.round(((total - active.assignment.ticksLeft) / total) * 100)))
    stationProgress = { label: `Training (${stationDef?.name ?? active.assignment.stationId})`, percent: pct }
  } else if (active.assignment.kind === 'breeding') {
    const total = CONFIG.wyvern.breedDuration ?? 40
    const pct = Math.min(100, Math.max(0, Math.round(((total - active.assignment.ticksLeft) / total) * 100)))
    stationProgress = { label: 'Breeding', percent: pct }
  }

  const activeIndex = list.findIndex((w) => w.id === active.id)
  const cycleWyvern = (dir: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const nextIdx = (activeIndex + dir + list.length) % list.length
    const target = list[nextIdx]
    if (target) {
      useUi.setState({ focusedWyvern: target.id })
    }
  }

  // Collapsed Minimal Bar Mode
  if (isCollapsed) {
    return (
      <div
        className={`quick-level-widget collapsed liquid-glass position-${dockPosition} ${eventLogCollapsed ? 'event-log-collapsed' : ''}`}
        onClick={() => openWyvern(active.id)}
      >
        <div className="collapsed-content">
          <span className="wyvern-name">{active.name}</span>
          <span className="wyvern-species">{species?.name ?? 'Wyvern'}</span>
          <span className="stage-pill">{active.stage}</span>
          <span className="level-label">LVL {active.level}</span>
          <span className="xp-percent tabular">{levelInfo.isMaxLevel ? 'MAX' : `${levelInfo.xpPercent.toFixed(0)}% XP`}</span>
        </div>
        <div className="widget-header-actions" onClick={(e) => e.stopPropagation()}>
          {list.length > 1 && (
            <>
              <button
                className="widget-icon-btn"
                onClick={(e) => cycleWyvern(-1, e)}
                title="Previous Wyvern"
              >
                ‹
              </button>
              <button
                className="widget-icon-btn"
                onClick={(e) => cycleWyvern(1, e)}
                title="Next Wyvern"
              >
                ›
              </button>
            </>
          )}
          <button
            className="widget-icon-btn"
            onClick={(e) => {
              e.stopPropagation()
              setDockPosition(dockPosition === 'left' ? 'right' : 'left')
            }}
            title={`Dock to ${dockPosition === 'left' ? 'Right' : 'Left'}`}
          >
            ⇄
          </button>
          <button
            className="widget-icon-btn"
            onClick={(e) => handleToggleCollapse(false, e)}
            title="Expand Wyvern Details Card"
          >
            +
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`quick-level-widget liquid-glass position-${dockPosition} ${eventLogCollapsed ? 'event-log-collapsed' : ''}`}
      onClick={() => openWyvern(active.id)}
    >
      <div className="quick-level-header">
        <div className="wyvern-identity">
          <span className="wyvern-name">{active.name}</span>
          <span className="wyvern-species">{species?.name ?? 'Wyvern'}</span>
          <span className="stage-pill">{active.stage}</span>
        </div>

        <div className="header-right">
          <div className="level-badge">
            <span className="level-label">LVL</span>
            <span className="level-num tabular">{active.level}</span>
          </div>

          <div className="widget-header-actions" onClick={(e) => e.stopPropagation()}>
            {list.length > 1 && (
              <>
                <button
                  className="widget-icon-btn"
                  onClick={(e) => cycleWyvern(-1, e)}
                  title="Previous Wyvern"
                >
                  ‹
                </button>
                <button
                  className="widget-icon-btn"
                  onClick={(e) => cycleWyvern(1, e)}
                  title="Next Wyvern"
                >
                  ›
                </button>
              </>
            )}
            <button
              className="widget-icon-btn"
              onClick={(e) => {
                e.stopPropagation()
                setDockPosition(dockPosition === 'left' ? 'right' : 'left')
              }}
              title={`Dock to ${dockPosition === 'left' ? 'Right' : 'Left'}`}
            >
              ⇄
            </button>
            <button
              className="widget-icon-btn"
              onClick={(e) => handleToggleCollapse(true, e)}
              title="Collapse Wyvern Details Card"
            >
              −
            </button>
          </div>
        </div>
      </div>

      {/* XP % Progress Bar */}
      <div className="xp-container">
        <div className="xp-labels">
          <span className="xp-title">XP Progress</span>
          <span className="xp-percent tabular">
            {levelInfo.isMaxLevel ? 'MAX' : `${levelInfo.xpPercent.toFixed(1)}%`}
          </span>
        </div>
        <div className="progress-bar-track">
          <div
            className={`progress-bar-fill xp-fill ${levelInfo.canLevelUp ? 'ready' : ''}`}
            style={{ width: `${levelInfo.xpPercent}%` }}
          />
        </div>
        <div className="xp-detail tabular">
          {levelInfo.isMaxLevel
            ? 'Max Level Reached'
            : `${Math.round(levelInfo.currentXp)} / ${levelInfo.requiredXp} XP`}
        </div>
      </div>

      {/* Quick Stat % Meters with Monochrome Icons */}
      <div className="quick-stats-grid">
        <div className="stat-meter" title="Health Level">
          <span className="stat-meter-icon"><HeartIcon /></span>
          <div className="stat-meter-track">
            <div
              className="stat-meter-fill health-color"
              style={{ width: `${statPercents.healthPercent}%` }}
            />
          </div>
          <span className="stat-meter-value tabular">{statPercents.healthPercent}%</span>
        </div>

        <div className="stat-meter" title="Nourishment">
          <span className="stat-meter-icon"><FoodIcon /></span>
          <div className="stat-meter-track">
            <div
              className="stat-meter-fill fed-color"
              style={{ width: `${statPercents.fedPercent}%` }}
            />
          </div>
          <span className="stat-meter-value tabular">{statPercents.fedPercent}%</span>
        </div>

        <div className="stat-meter" title="Trainer Bond">
          <span className="stat-meter-icon"><BondIcon /></span>
          <div className="stat-meter-track">
            <div
              className="stat-meter-fill bond-color"
              style={{ width: `${statPercents.bondPercent}%` }}
            />
          </div>
          <span className="stat-meter-value tabular">{statPercents.bondPercent}%</span>
        </div>

        <div className="stat-meter" title="Combat Power">
          <span className="stat-meter-icon"><PowerIcon /></span>
          <span className="power-value tabular">{power}</span>
        </div>
      </div>

      {/* Station Activity % Meter */}
      {stationProgress && (
        <div className="station-activity">
          <div className="station-labels">
            <span>{stationProgress.label}</span>
            <span className="tabular">{stationProgress.percent}%</span>
          </div>
          <div className="progress-bar-track small">
            <div
              className="progress-bar-fill station-fill"
              style={{ width: `${stationProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      {levelInfo.canLevelUp && (
        <div className="level-up-banner">
          ✦ READY TO LEVEL UP! Click to open Roster
        </div>
      )}
    </div>
  )
}
