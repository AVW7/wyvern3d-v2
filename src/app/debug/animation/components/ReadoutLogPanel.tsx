'use client'

import { useCallback, useState } from 'react'
import type { ThemeStyle } from '../constants'
import { AppleCard, LabButton } from './AppleControls'
import { IconCheck, IconCopy, IconFilter } from './Icons'
import { formatPoseExport, type LabTelemetry } from '../labTelemetry'

export type TelemetrySnapshot = LabTelemetry

export interface LogEntry {
  id: string
  timestamp: string
  category: 'SPEED' | 'POSE' | 'CONTRACT' | 'ATTACK' | 'PREY' | 'SYSTEM'
  level: 'info' | 'warn' | 'error'
  message: string
  details?: Record<string, unknown>
}

interface ReadoutLogPanelProps {
  t: ThemeStyle
  telemetry: TelemetrySnapshot
  logs: LogEntry[]
  onClearLogs?: () => void
  onPauseToggle?: (paused: boolean) => void
  isLogPaused?: boolean
}

export function ReadoutLogPanel({
  t,
  telemetry,
  logs,
  onClearLogs,
}: ReadoutLogPanelProps) {
  const [activeTab, setActiveTab] = useState<'readout' | 'logs'>('readout')
  const [copiedType, setCopiedType] = useState<'code' | 'json' | 'logs' | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL')

  const copyToClipboard = useCallback(async (text: string, type: 'code' | 'json' | 'logs') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedType(type)
      setTimeout(() => setCopiedType(null), 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
    }
  }, [])

  const handleCopyPoseCode = useCallback(() => {
    copyToClipboard(formatPoseExport(telemetry), 'code')
  }, [telemetry, copyToClipboard])

  const handleCopyTelemetryJSON = useCallback(() => {
    const jsonStr = JSON.stringify(telemetry, null, 2)
    copyToClipboard(jsonStr, 'json')
  }, [telemetry, copyToClipboard])

  const handleCopyLogs = useCallback(() => {
    const logText = logs
      .map(l => `[${l.timestamp}] [${l.category}] [${l.level.toUpperCase()}] ${l.message}`)
      .join('\n')
    copyToClipboard(logText, 'logs')
  }, [logs, copyToClipboard])

  const filteredLogs = logs.filter(
    l => categoryFilter === 'ALL' || l.category === categoryFilter
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <AppleCard title="Rig Telemetry & Event Log" themeStyle={t}>
        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          <LabButton
            themeStyle={t}
            active={activeTab === 'readout'}
            onClick={() => setActiveTab('readout')}
          >
            Telemetry Readout
          </LabButton>
          <LabButton
            themeStyle={t}
            active={activeTab === 'logs'}
            onClick={() => setActiveTab('logs')}
          >
            Log Stream ({logs.length})
          </LabButton>
        </div>

        {/* Copy Buttons */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          <LabButton
            themeStyle={t}
            onClick={handleCopyPoseCode}
            style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            {copiedType === 'code' ? <IconCheck /> : <IconCopy />}
            <span>{copiedType === 'code' ? 'Copied TS' : 'Copy Pose TS'}</span>
          </LabButton>

          <LabButton
            themeStyle={t}
            onClick={handleCopyTelemetryJSON}
            style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            {copiedType === 'json' ? <IconCheck /> : <IconCopy />}
            <span>{copiedType === 'json' ? 'Copied JSON' : 'Copy JSON'}</span>
          </LabButton>
        </div>

        {activeTab === 'readout' ? (
          <div
            style={{
              background: t.readoutBg,
              border: `1px solid ${t.border}`,
              borderRadius: 8,
              padding: 8,
              fontSize: 10.5,
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              color: t.readoutText,
              maxHeight: 220,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              <div>
                <span style={{ color: t.muted }}>Speed: </span>
                <span style={{ fontWeight: 600, color: t.text }}>{telemetry.airspeed.toFixed(1)} u/s</span>
              </div>
              <div>
                <span style={{ color: t.muted }}>Pitch: </span>
                <span style={{ fontWeight: 600, color: t.text }}>{telemetry.pitchAngle.toFixed(1)}°</span>
              </div>
              <div>
                <span style={{ color: t.muted }}>Gate: </span>
                <span style={{ fontWeight: 700, color: telemetry.contractStatus === 'pass' ? '#4ade80' : '#f87171' }}>
                  {telemetry.contractStatus.toUpperCase()}
                </span>
              </div>
            </div>

            <div>
              <span style={{ color: t.muted }}>Active Controllers: </span>
              <span style={{ color: t.text }}>{telemetry.activeControllers.join(', ')}</span>
            </div>

            <div>
              <span style={{ color: t.muted }}>Tail Extent: </span>
              <span style={{ color: t.text }}>{Number.isNaN(telemetry.tailExtent) ? '—' : `${telemetry.tailExtent.toFixed(2)} u`}</span>
            </div>
            <div>
              <span style={{ color: t.muted }}>Wing span: </span>
              <span style={{ color: t.text }}>{Number.isNaN(telemetry.wingSpan) ? '—' : `${telemetry.wingSpan.toFixed(1)} u`}</span>
            </div>
            <div>
              <span style={{ color: t.muted }}>Clip: </span>
              <span style={{ color: t.text }}>{telemetry.clipName}</span>
            </div>
            {telemetry.contractNotes.map((note) => (
              <div key={note} style={{ color: t.muted }}>{note}</div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Filter bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <IconFilter />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{
                    background: t.cardBg,
                    border: `1px solid ${t.border}`,
                    color: t.text,
                    borderRadius: 4,
                    fontSize: 10,
                    padding: '2px 4px',
                  }}
                >
                  <option value="ALL">All Categories</option>
                  <option value="SPEED">Speed & Pitch</option>
                  <option value="POSE">Pose Transitions</option>
                  <option value="CONTRACT">Contract Gates</option>
                  <option value="ATTACK">Combat Attacks</option>
                  <option value="PREY">Prey & Food</option>
                  <option value="SYSTEM">System Logs</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 4 }}>
                {onClearLogs && (
                  <LabButton themeStyle={t} onClick={onClearLogs} title="Clear logs" style={{ fontSize: 10 }}>
                    Clear
                  </LabButton>
                )}
                <LabButton themeStyle={t} onClick={handleCopyLogs} style={{ fontSize: 10 }}>
                  Copy Logs
                </LabButton>
              </div>
            </div>

            {/* Log Stream */}
            <div
              style={{
                background: t.readoutBg,
                border: `1px solid ${t.border}`,
                borderRadius: 8,
                padding: 8,
                fontSize: 10,
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                maxHeight: 180,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              {filteredLogs.length === 0 ? (
                <div style={{ color: t.muted, textAlign: 'center', padding: '8px 0' }}>
                  No log entries recorded
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      padding: '4px 6px',
                      borderRadius: 4,
                      background: log.level === 'warn' ? 'rgba(245, 200, 107, 0.1)' : t.cardBg,
                      border: `1px solid ${log.level === 'warn' ? '#f5c86b' : t.border}`,
                      color: t.text,
                    }}
                  >
                    <span style={{ color: t.muted }}>[{log.timestamp}] </span>
                    <span style={{ fontWeight: 600, color: t.accentColor }}>[{log.category}] </span>
                    <span>{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </AppleCard>
    </div>
  )
}
