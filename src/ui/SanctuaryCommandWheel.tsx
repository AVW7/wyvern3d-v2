'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import { useGame, useGameState } from '@/state/store'
import { useSanctuaryCommands, type SanctuaryCommand } from '@/state/sanctuaryCommands'
import { useUi } from '@/state/uiStore'
import { usePlayerControlStore } from '@/state/playerControlStore'

/** Drives the per-group accent colour; see [data-group] in globals.css. */
type CommandGroup = 'flight' | 'combat' | 'care' | 'info'

/**
 * Single-path icon glyphs, drawn as 24x24 strokes. The heart, food and power
 * marks are the same paths QuickLevelWidget uses for the matching stats, so a
 * wyvern's bond/nourishment/power read identically wherever they appear.
 */
const ICONS: Record<string, string[]> = {
  circle: ['M20.5 12a8.5 8.5 0 1 1-2.9-6.4', 'M20.8 4v4.6h-4.6'],
  follow: ['M4 17.5l5.5-5.5L4 6.5', 'M13 17.5L18.5 12 13 6.5'],
  soar: ['M6 16.5l6-6 6 6', 'M6 10.5l6-6 6 6'],
  hover: ['M4 12h16', 'M9 7.5l3-3 3 3', 'M9 16.5l3 3 3-3'],
  land: ['M12 3.5v10', 'M8 9.5l4 4 4-4', 'M5 20h14'],
  return: ['M3 11l9-7 9 7', 'M6 9.5V20h12V9.5'],
  attack: ['M14.5 17.5L3 6V3h3l11.5 11.5', 'M13 19l6-6', 'M16 16l4 4', 'M19 13l2 2'],
  findFood: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.3-4.3'],
  offerFood: ['M12 2a5 5 0 0 0-5 5v3a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5z', 'M12 15v7', 'M9 22h6'],
  pet: [
    'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.78-8.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
  ],
  calm: ['M3 10c3-4 6 4 9 0s6-4 9 0', 'M3 17c3-4 6 4 9 0s6-4 9 0'],
  details: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 11.5V16', 'M12 8h.01'],
}

/**
 * Ordered so each group occupies one contiguous arc of the ring, starting at
 * the top and running clockwise — flight fills the top and right, combat sits
 * at the bottom, care runs up the left, info closes the circle. Reordering
 * this array rotates the wheel, so keep group members adjacent or the colour
 * banding stops reading as groups.
 */
const ITEMS: {
  command: SanctuaryCommand | 'details'
  label: string
  short: string
  group: CommandGroup
}[] = [
  { command: 'circle', label: 'Circle Sanctuary Sky', short: 'Circle', group: 'flight' },
  { command: 'follow', label: 'Follow & Escort Player', short: 'Follow', group: 'flight' },
  { command: 'soar', label: 'Soar High Clouds', short: 'Soar', group: 'flight' },
  { command: 'hover', label: 'Hover Mid-Air', short: 'Hover', group: 'flight' },
  { command: 'land', label: 'Land Ground', short: 'Land', group: 'flight' },
  { command: 'return', label: 'Return to Home Perch', short: 'Return', group: 'flight' },
  { command: 'attack', label: 'Attack Target Point', short: 'Attack', group: 'combat' },
  { command: 'findFood', label: 'Find Food', short: 'Forage', group: 'care' },
  { command: 'offerFood', label: 'Offer Food', short: 'Feed', group: 'care' },
  { command: 'pet', label: 'Pet Wyvern', short: 'Pet', group: 'care' },
  { command: 'calm', label: 'Calm Wyvern', short: 'Calm', group: 'care' },
  { command: 'details', label: 'Open Roster Details', short: 'Details', group: 'info' },
]

/** Commands that need the wyvern to be capable of flight. */
const AIRBORNE_COMMANDS = new Set(['circle', 'follow', 'soar', 'hover'])

/**
 * Why a command is unavailable, or null when it is available.
 *
 * Returning the reason rather than a bare boolean lets a greyed-out button say
 * what it is waiting for instead of just looking broken.
 */
function unavailableReason(
  command: SanctuaryCommand | 'details',
  agent: { airborne: boolean; hatchling: boolean; adult: boolean; phase: string } | null,
): string | null {
  if (agent?.hatchling && AIRBORNE_COMMANDS.has(command)) return 'Hatchlings cannot fly yet'
  if (command === 'findFood' && agent && !agent.adult) return 'Only adult wyverns can hunt in the Highlands'
  if (command === 'land' && !agent?.airborne && agent?.phase !== 'takeoff') {
    return 'Already on the ground'
  }
  return null
}

/**
 * Buttons are placed by handing CSS a unit direction vector per item and
 * letting it scale that by the wheel's own --wheel length. Doing the trig here
 * and the sizing there means there is no pixel radius to keep in sync with the
 * stylesheet, and no resize plumbing — the ring simply tracks whatever size the
 * CSS clamp resolves to.
 *
 * Spacing constraint, worst case: the pair straddling the top of the circle
 * sits `orbit * 0.5` apart horizontally, so orbit must stay comfortably above
 * twice the button width or those two collide. globals.css uses orbit 0.4 and
 * width 0.17 of --wheel, leaving ~18% headroom.
 */
function itemDirection(index: number, count: number): { dx: number; dy: number } {
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2
  return { dx: Math.cos(angle), dy: Math.sin(angle) }
}

export function SanctuaryCommandWheel() {
  const wheelRef = useRef<HTMLDivElement>(null)
  const state = useGameState()
  const selected = useSanctuaryCommands((s) => s.selectedWyvernId)
  const agent = useSanctuaryCommands((s) => s.agent)
  const anchor = useSanctuaryCommands((s) => s.wheelAnchor)
  const targetMode = useSanctuaryCommands((s) => s.targetMode)
  const targetValid = useSanctuaryCommands((s) => s.targetValid)
  const status = useSanctuaryCommands((s) => s.status)
  const pendingCommand = useSanctuaryCommands((s) => s.pendingCommand)

  const wyvern = selected ? state.wyverns[selected] : null

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const commands = useSanctuaryCommands.getState()
      if (event.code === 'Escape') {
        if (commands.targetMode) commands.cancelTarget()
        else {
          if (commands.playerMove) commands.finishPlayerMove(commands.playerMove.token, 'cancelled')
          commands.close()
        }
        return
      }

      // Ignore hotkeys if typing into inputs or selects
      if (
        document.activeElement &&
        ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)
      ) {
        return
      }

      // Map number keys 1-9 and 0 to action wheel items
      if (/^[0-9]$/.test(event.key) && commands.selectedWyvernId && !commands.targetMode) {
        const num = event.key === '0' ? 10 : parseInt(event.key, 10)
        const itemIndex = num - 1
        if (itemIndex >= 0 && itemIndex < ITEMS.length) {
          const item = ITEMS[itemIndex]
          if (item) {
            const unavailable = unavailableReason(item.command, commands.agent)
            if (!unavailable && !commands.pendingCommand) {
              event.preventDefault()
              issue(item.command)
            }
          }
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [agent])

  useEffect(() => {
    if (!selected || targetMode) return
    const frame = window.requestAnimationFrame(() => {
      wheelRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [selected, targetMode])

  if (!selected || !wyvern) return null

  const issue = (command: SanctuaryCommand | 'details') => {
    if (command === 'details') {
      useUi.getState().openWyvern(selected)
      useSanctuaryCommands.getState().close()
      return
    }
    if (command === 'attack') {
      useSanctuaryCommands.getState().beginAttack()
      return
    }
    useSanctuaryCommands.getState().issue(command)
  }

  const pendingLabel = pendingCommand
    ? ITEMS.find((item) => item.command === pendingCommand.kind)?.short ?? pendingCommand.kind
    : null

  return (
    <>
      {anchor.visible && !targetMode && (
        <>
          <div
            className="wyvern-command-backdrop"
            onClick={() => useSanctuaryCommands.getState().close()}
            aria-hidden="true"
          />
          <div
            ref={wheelRef}
            className="wyvern-command-wheel"
            role="group"
            aria-label={`Commands for ${wyvern.name}`}
            style={{ left: anchor.x, top: anchor.y }}
          >
            <div className="wyvern-command-name">
              <strong>{wyvern.name}</strong>
              <span className="wyvern-command-state">
                <i className="wyvern-command-pulse" aria-hidden="true" />
                {pendingLabel ? `ordering ${pendingLabel.toLowerCase()}…` : agent?.label ?? 'listening'}
              </span>
              <label className="wyvern-command-perch">
                <span>Perch</span>
                <select
                  value={wyvern.preferredPerchIndex ?? 0}
                  onChange={(e) => useGame.getState().dispatch({ type: 'SET_WYVERN_PERCH', wyvernId: wyvern.id, perchIndex: Number(e.target.value) })}
                  onClick={(e) => e.stopPropagation()}
                >
                  {Array.from({ length: 8 }, (_, i) => (
                    <option key={i} value={i}>Spot {i + 1}</option>
                  ))}
                </select>
              </label>
              <button
                className="wyvern-command-shift-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  usePlayerControlStore.getState().shiftToWyvern(wyvern.id)
                  useSanctuaryCommands.getState().close()
                }}
                title="Take direct 3D flight control of this wyvern"
              >
                <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2" fill="none" className="mono-svg" style={{ marginRight: 4 }}>
                  <path d="M4 17.5l5.5-5.5L4 6.5M13 17.5L18.5 12 13 6.5" />
                </svg>
                Direct Control
              </button>
            </div>
            <div className="wyvern-command-items">
              {ITEMS.map((item, index) => {
                const unavailable = unavailableReason(item.command, agent)
                const reason = unavailable ?? (pendingCommand ? 'Awaiting the current order' : null)
                const isPending = pendingCommand?.kind === item.command
                const { dx, dy } = itemDirection(index, ITEMS.length)
                const hotkey = index < 9 ? `${index + 1}` : index === 9 ? '0' : null

                return (
                  <button
                    key={item.command}
                    type="button"
                    className={`wyvern-command ${isPending ? 'is-pending' : ''}`}
                    data-group={item.group}
                    style={{ '--dx': dx.toFixed(4), '--dy': dy.toFixed(4) } as CSSProperties}
                    aria-label={reason ? `${item.label} (${hotkey ? `key ${hotkey}` : ''}) — ${reason}` : `${item.label} (${hotkey ? `key ${hotkey}` : ''})`}
                    title={reason ? `${item.label} [${hotkey}] — ${reason}` : `${item.label} [${hotkey}]`}
                    disabled={reason !== null}
                    onClick={() => issue(item.command)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      {ICONS[item.command]?.map((d) => <path key={d} d={d} />)}
                    </svg>
                    <span>{item.short} {hotkey && <small style={{ opacity: 0.6, fontSize: '0.85em' }}>[{hotkey}]</small>}</span>
                  </button>
                )
              })}
            </div>
            <button
              className="wyvern-command-close"
              type="button"
              aria-label="Close wyvern commands"
              onClick={() => useSanctuaryCommands.getState().close()}
            >
              ×
            </button>
          </div>
        </>
      )}

      {targetMode && (
        <div
          className={`attack-target-prompt ${targetValid ? 'valid' : 'invalid'}`}
          role="status"
          aria-live="polite"
        >
          <strong>Choose attack point</strong>
          <span>{targetValid ? 'Click to confirm' : status ?? 'Find clear ground'} · Esc cancels</span>
        </div>
      )}

      {status && !targetMode && (
        <div className="wyvern-command-status" role="status" aria-live="polite">
          {status}
        </div>
      )}
    </>
  )
}
