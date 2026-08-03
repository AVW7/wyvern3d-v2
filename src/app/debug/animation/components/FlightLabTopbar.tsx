'use client'

import Link from 'next/link'
import type { LabCamera, LabTheme } from '../FlightLab'
import { CAMERA_KEYS, type ThemeStyle } from '../constants'
import { LabButton } from './AppleControls'
import {
  IconContrast,
  IconFrameFit,
  IconMoon,
  IconPanel,
  IconPause,
  IconPlay,
  IconReset,
  IconSun,
  IconTarget,
  IconZoomIn,
  IconZoomOut,
} from './Icons'

interface FlightLabTopbarProps {
  t: ThemeStyle
  camera: LabCamera
  setCamera: (camera: LabCamera) => void
  theme: LabTheme
  setTheme: (theme: LabTheme) => void
  frozen: boolean
  setFrozen: React.Dispatch<React.SetStateAction<boolean>>
  panelOpen: boolean
  setPanelOpen: React.Dispatch<React.SetStateAction<boolean>>
  setCenterTrigger: React.Dispatch<React.SetStateAction<number>>
  setZoomFitTrigger: React.Dispatch<React.SetStateAction<number>>
  setZoomInTrigger: React.Dispatch<React.SetStateAction<number>>
  setZoomOutTrigger: React.Dispatch<React.SetStateAction<number>>
  setResetCamTrigger: React.Dispatch<React.SetStateAction<number>>
}

export function FlightLabTopbar({
  t,
  camera,
  setCamera,
  theme,
  setTheme,
  frozen,
  setFrozen,
  panelOpen,
  setPanelOpen,
  setCenterTrigger,
  setZoomFitTrigger,
  setZoomInTrigger,
  setZoomOutTrigger,
  setResetCamTrigger,
}: FlightLabTopbarProps) {
  return (
    <div className="topbar flight-lab-topbar liquid-glass">
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: t.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginRight: 2,
          }}
        >
          Camera
        </span>
        <div
          style={{
            display: 'inline-flex',
            background: t.segmentedBg,
            padding: 2,
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            gap: 2,
          }}
        >
          {CAMERA_KEYS.map((preset) => (
            <LabButton
              key={preset}
              active={preset === camera}
              themeStyle={t}
              onClick={() => setCamera(preset)}
            >
              {preset}
            </LabButton>
          ))}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          flexWrap: 'wrap',
          borderLeft: `1px solid ${t.border}`,
          paddingLeft: 10,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: t.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginRight: 2,
          }}
        >
          Actions
        </span>
        <LabButton
          onClick={() => setCenterTrigger((trig) => trig + 1)}
          themeStyle={t}
          title="Center camera on wyvern model (HotKey: C)"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
        >
          <IconTarget />
          <span>Center</span>
          <kbd className="apple-kbd">C</kbd>
        </LabButton>
        <LabButton
          onClick={() => setZoomFitTrigger((trig) => trig + 1)}
          themeStyle={t}
          title="Zoom to fit wyvern silhouette (HotKey: F)"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
        >
          <IconFrameFit />
          <span>Fit</span>
          <kbd className="apple-kbd">F</kbd>
        </LabButton>
        <LabButton
          onClick={() => setZoomInTrigger((trig) => trig + 1)}
          themeStyle={t}
          title="Zoom camera in (HotKey: +)"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <IconZoomIn />
          <span>In</span>
          <kbd className="apple-kbd">+</kbd>
        </LabButton>
        <LabButton
          onClick={() => setZoomOutTrigger((trig) => trig + 1)}
          themeStyle={t}
          title="Zoom camera out (HotKey: -)"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <IconZoomOut />
          <span>Out</span>
          <kbd className="apple-kbd">-</kbd>
        </LabButton>
        <LabButton
          onClick={() => setResetCamTrigger((trig) => trig + 1)}
          themeStyle={t}
          title="Reset camera preset framing"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <IconReset />
          <span>Reset</span>
        </LabButton>
        <LabButton
          active={frozen}
          themeStyle={t}
          onClick={() => setFrozen((f) => !f)}
          title="Pause or resume rig animation (HotKey: Space)"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
        >
          {frozen ? <IconPlay /> : <IconPause />}
          <span>{frozen ? 'Resume' : 'Pause'}</span>
          <kbd className="apple-kbd">Space</kbd>
        </LabButton>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          borderLeft: `1px solid ${t.border}`,
          paddingLeft: 10,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: t.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginRight: 2,
          }}
        >
          Theme
        </span>
        <div
          style={{
            display: 'flex',
            background: t.segmentedBg,
            padding: 2,
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            gap: 2,
          }}
        >
          <LabButton
            active={theme === 'dark'}
            themeStyle={t}
            onClick={() => setTheme('dark')}
            title="Dark Theme"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <IconMoon />
            <span>Dark</span>
          </LabButton>
          <LabButton
            active={theme === 'light'}
            themeStyle={t}
            onClick={() => setTheme('light')}
            title="Light Theme"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <IconSun />
            <span>Light</span>
          </LabButton>
          <LabButton
            active={theme === 'monochrome'}
            themeStyle={t}
            onClick={() => setTheme('monochrome')}
            title="Monochrome Theme"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <IconContrast />
            <span>Mono</span>
          </LabButton>
        </div>
        <LabButton
          active={panelOpen}
          themeStyle={t}
          onClick={() => setPanelOpen((open) => !open)}
          title="Toggle Control Panel (HotKey: P)"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 4 }}
        >
          <IconPanel />
          <span>{panelOpen ? 'Panel On' : 'Panel Off'}</span>
        </LabButton>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            background: t.badgeBg,
            color: t.badgeText,
            border: `1px solid ${t.badgeBorder}`,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.04em',
            padding: '3px 9px',
            borderRadius: 12,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)',
          }}
        >
          dev lab
        </span>
        <Link
          href="/"
          style={{
            fontSize: 12,
            fontWeight: 500,
            opacity: 0.8,
            textDecoration: 'none',
            color: t.text,
            transition: 'opacity 0.15s ease',
          }}
        >
          ← menu
        </Link>
      </div>
    </div>
  )
}
