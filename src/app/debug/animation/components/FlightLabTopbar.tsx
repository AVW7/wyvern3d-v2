'use client'

import Link from 'next/link'
import type { LabCamera, LabTheme } from '../FlightLab'
import { CAMERA_KEYS, type ThemeStyle } from '../constants'
import { LabButton } from './AppleControls'
import {
  IconContrast,
  IconEyeOff,
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
  auto: boolean
  setAuto: (auto: boolean) => void
  panelOpen: boolean
  setPanelOpen: React.Dispatch<React.SetStateAction<boolean>>
  hideUI?: boolean
  setHideUI?: React.Dispatch<React.SetStateAction<boolean>>
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
  auto,
  setAuto,
  panelOpen,
  setPanelOpen,
  setHideUI,
  setCenterTrigger,
  setZoomFitTrigger,
  setZoomInTrigger,
  setZoomOutTrigger,
  setResetCamTrigger,
}: FlightLabTopbarProps) {
  const btnStyle = { padding: '3px 8px', fontSize: 10 }

  return (
    <div className="flight-lab-topbar liquid-glass">
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: t.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginRight: 1,
          }}
        >
          Cam
        </span>
        <div
          style={{
            display: 'inline-flex',
            background: t.segmentedBg,
            padding: 1.5,
            borderRadius: 6,
            border: `1px solid ${t.border}`,
            gap: 2,
          }}
        >
          {CAMERA_KEYS.map((preset) => (
            <LabButton
              key={preset}
              active={preset === camera}
              themeStyle={t}
              style={btnStyle}
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
          gap: 3,
          flexWrap: 'wrap',
          borderLeft: `1px solid ${t.border}`,
          paddingLeft: 8,
        }}
      >
        <LabButton
          onClick={() => setCenterTrigger((trig) => trig + 1)}
          themeStyle={t}
          title="Center camera on wyvern model (HotKey: C)"
          style={{ ...btnStyle, display: 'inline-flex', alignItems: 'center', gap: 3 }}
        >
          <IconTarget />
          <span>Center</span>
          <kbd className="apple-kbd">C</kbd>
        </LabButton>
        <LabButton
          onClick={() => setZoomFitTrigger((trig) => trig + 1)}
          themeStyle={t}
          title="Zoom to fit wyvern silhouette (HotKey: F)"
          style={{ ...btnStyle, display: 'inline-flex', alignItems: 'center', gap: 3 }}
        >
          <IconFrameFit />
          <span>Fit</span>
          <kbd className="apple-kbd">F</kbd>
        </LabButton>
        <LabButton
          onClick={() => setZoomInTrigger((trig) => trig + 1)}
          themeStyle={t}
          title="Zoom camera in (HotKey: +)"
          style={{ ...btnStyle, display: 'inline-flex', alignItems: 'center', gap: 2 }}
        >
          <IconZoomIn />
          <span>In</span>
        </LabButton>
        <LabButton
          onClick={() => setZoomOutTrigger((trig) => trig + 1)}
          themeStyle={t}
          title="Zoom camera out (HotKey: -)"
          style={{ ...btnStyle, display: 'inline-flex', alignItems: 'center', gap: 2 }}
        >
          <IconZoomOut />
          <span>Out</span>
        </LabButton>
        <LabButton
          onClick={() => setResetCamTrigger((trig) => trig + 1)}
          themeStyle={t}
          title="Reset camera preset framing"
          style={{ ...btnStyle, display: 'inline-flex', alignItems: 'center', gap: 3 }}
        >
          <IconReset />
          <span>Reset</span>
        </LabButton>
        <LabButton
          active={auto}
          themeStyle={t}
          onClick={() => setAuto(!auto)}
          title="Auto flight director — picks cruise/scout/speed/glide/dive/bank/hover from airspeed"
          style={{ ...btnStyle, display: 'inline-flex', alignItems: 'center', gap: 3 }}
        >
          <span>{auto ? 'Auto On' : 'Auto'}</span>
        </LabButton>
        <LabButton
          active={frozen}
          themeStyle={t}
          onClick={() => setFrozen((f) => !f)}
          title="Pause or resume rig animation (HotKey: Space)"
          style={{ ...btnStyle, display: 'inline-flex', alignItems: 'center', gap: 3 }}
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
          gap: 3,
          borderLeft: `1px solid ${t.border}`,
          paddingLeft: 8,
        }}
      >
        <div
          style={{
            display: 'flex',
            background: t.segmentedBg,
            padding: 1.5,
            borderRadius: 6,
            border: `1px solid ${t.border}`,
            gap: 2,
          }}
        >
          <LabButton
            active={theme === 'dark'}
            themeStyle={t}
            onClick={() => setTheme('dark')}
            title="Dark Theme"
            style={{ ...btnStyle, display: 'inline-flex', alignItems: 'center', gap: 3 }}
          >
            <IconMoon />
            <span>Dark</span>
          </LabButton>
          <LabButton
            active={theme === 'light'}
            themeStyle={t}
            onClick={() => setTheme('light')}
            title="Light Theme"
            style={{ ...btnStyle, display: 'inline-flex', alignItems: 'center', gap: 3 }}
          >
            <IconSun />
            <span>Light</span>
          </LabButton>
          <LabButton
            active={theme === 'monochrome'}
            themeStyle={t}
            onClick={() => setTheme('monochrome')}
            title="Monochrome Theme"
            style={{ ...btnStyle, display: 'inline-flex', alignItems: 'center', gap: 3 }}
          >
            <IconContrast />
            <span>Mono</span>
          </LabButton>
        </div>
        <LabButton
          active={panelOpen}
          themeStyle={t}
          onClick={() => setPanelOpen((open) => !open)}
          title="Toggle Side Panels (HotKey: P)"
          style={{ ...btnStyle, display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 2 }}
        >
          <IconPanel />
          <span>{panelOpen ? 'Panels' : 'Panels Off'}</span>
          <kbd className="apple-kbd">P</kbd>
        </LabButton>
        {setHideUI && (
          <LabButton
            themeStyle={t}
            onClick={() => setHideUI(true)}
            title="Hide All UI (HotKey: H)"
            style={{ ...btnStyle, display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 2 }}
          >
            <IconEyeOff />
            <span>Hide UI</span>
            <kbd className="apple-kbd">H</kbd>
          </LabButton>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            background: t.badgeBg,
            color: t.badgeText,
            border: `1px solid ${t.badgeBorder}`,
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: '0.04em',
            padding: '2px 6px',
            borderRadius: 10,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)',
          }}
        >
          dev lab
        </span>
        <Link
          href="/"
          style={{
            fontSize: 11,
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
