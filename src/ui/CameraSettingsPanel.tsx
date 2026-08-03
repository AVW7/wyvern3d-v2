'use client'

import { useCameraStore, type CameraPreset } from '@/state/cameraStore'
import { useUi } from '@/state/uiStore'

export function CameraSettingsPanel() {
  const close = useUi((s) => s.close)
  const sensitivity = useCameraStore((s) => s.sensitivity)
  const zoomSpeed = useCameraStore((s) => s.zoomSpeed)
  const invertX = useCameraStore((s) => s.invertX)
  const invertY = useCameraStore((s) => s.invertY)
  const fov = useCameraStore((s) => s.fov)
  const smoothing = useCameraStore((s) => s.smoothing)
  const activePreset = useCameraStore((s) => s.preset)

  const followTarget = useCameraStore((s) => s.followTarget)
  const setFollowTarget = useCameraStore((s) => s.setFollowTarget)

  const setSensitivity = useCameraStore((s) => s.setSensitivity)
  const setZoomSpeed = useCameraStore((s) => s.setZoomSpeed)
  const setInvertX = useCameraStore((s) => s.setInvertX)
  const setInvertY = useCameraStore((s) => s.setInvertY)
  const setFov = useCameraStore((s) => s.setFov)
  const setSmoothing = useCameraStore((s) => s.setSmoothing)
  const applyPreset = useCameraStore((s) => s.applyPreset)
  const resetDefaults = useCameraStore((s) => s.resetDefaults)

  const presets: { id: CameraPreset; label: string; desc: string; icon: string }[] = [
    { id: 'default', label: 'Default', desc: 'Balanced 3rd-person follow angle', icon: '⌖' },
    { id: 'followWyvern', label: 'Follow Wyvern', desc: 'Track active wyvern in the sky & on ground', icon: '🐉' },
    { id: 'topDown', label: 'Tactical Overhead', desc: 'High top-down view for sanctuary management', icon: '⬅' },
    { id: 'isometric', label: 'Classic Isometric', desc: 'Angled 45° perspective for strategic view', icon: '◇' },
    { id: 'chase', label: 'Action Chase', desc: 'Close action view behind the character', icon: '►' },
    { id: 'cinematic', label: 'Cinematic Wide', desc: 'Deep perspective with low FOV framing', icon: '◈' },
  ]

  return (
    <div className="camera-settings-panel">
      <div className="panel-head">
        <h2>Camera Settings & Presets</h2>
        <button className="close-btn" onClick={close} title="Close">
          ✕
        </button>
      </div>

      <div className="panel-body">
        {/* Focus Target */}
        <section className="setting-section">
          <h3>Camera Target Focus</h3>
          <div className="preset-grid">
            <button
              className={`preset-card ${followTarget === 'character' ? 'active' : ''}`}
              onClick={() => setFollowTarget('character')}
            >
              <div className="preset-icon">👤</div>
              <div className="preset-info">
                <div className="preset-name">Character Focus</div>
                <div className="preset-desc">Camera tracks player character</div>
              </div>
            </button>
            <button
              className={`preset-card ${followTarget === 'wyvern' ? 'active' : ''}`}
              onClick={() => setFollowTarget('wyvern')}
            >
              <div className="preset-icon">🐉</div>
              <div className="preset-info">
                <div className="preset-name">Wyvern Focus</div>
                <div className="preset-desc">Camera tracks wyvern in the sky & on ground</div>
              </div>
            </button>
          </div>
        </section>

        {/* Preset Cards */}
        <section className="setting-section">
          <h3>Camera Angle Presets</h3>
          <div className="preset-grid">
            {presets.map((p) => (
              <button
                key={p.id}
                className={`preset-card ${activePreset === p.id ? 'active' : ''}`}
                onClick={() => applyPreset(p.id)}
              >
                <div className="preset-icon">{p.icon}</div>
                <div className="preset-info">
                  <div className="preset-name">{p.label}</div>
                  <div className="preset-desc">{p.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Sliders */}
        <section className="setting-section">
          <h3>Controls & Sensitivity</h3>
          <div className="control-group">
            <div className="control-label-row">
              <label htmlFor="cam-sens">Orbit Sensitivity</label>
              <span className="control-value tabular">{sensitivity.toFixed(1)}x</span>
            </div>
            <input
              id="cam-sens"
              type="range"
              min="0.2"
              max="2.5"
              step="0.1"
              value={sensitivity}
              onChange={(e) => setSensitivity(parseFloat(e.target.value))}
            />
          </div>

          <div className="control-group">
            <div className="control-label-row">
              <label htmlFor="cam-zoom">Zoom Speed</label>
              <span className="control-value tabular">{zoomSpeed.toFixed(1)}x</span>
            </div>
            <input
              id="cam-zoom"
              type="range"
              min="0.2"
              max="2.5"
              step="0.1"
              value={zoomSpeed}
              onChange={(e) => setZoomSpeed(parseFloat(e.target.value))}
            />
          </div>

          <div className="control-group">
            <div className="control-label-row">
              <label htmlFor="cam-fov">Field of View (FOV)</label>
              <span className="control-value tabular">{fov}°</span>
            </div>
            <input
              id="cam-fov"
              type="range"
              min="35"
              max="90"
              step="1"
              value={fov}
              onChange={(e) => setFov(parseInt(e.target.value, 10))}
            />
          </div>

          <div className="control-group">
            <div className="control-label-row">
              <label htmlFor="cam-smooth">Follow Responsiveness</label>
              <span className="control-value tabular">{smoothing >= 15 ? 'Snappy' : smoothing <= 5 ? 'Cinematic' : 'Smooth'} ({smoothing})</span>
            </div>
            <input
              id="cam-smooth"
              type="range"
              min="1"
              max="20"
              step="1"
              value={smoothing}
              onChange={(e) => setSmoothing(parseInt(e.target.value, 10))}
            />
          </div>
        </section>

        {/* Toggles */}
        <section className="setting-section">
          <h3>Axis Inversion</h3>
          <div className="toggle-row">
            <label className="toggle-label" htmlFor="invert-y">
              <span>Invert Pitch (Vertical Axis)</span>
              <span className="toggle-sub font-muted">Drag up moves camera down</span>
            </label>
            <input
              id="invert-y"
              type="checkbox"
              checked={invertY}
              onChange={(e) => setInvertY(e.target.checked)}
            />
          </div>

          <div className="toggle-row">
            <label className="toggle-label" htmlFor="invert-x">
              <span>Invert Yaw (Horizontal Axis)</span>
              <span className="toggle-sub font-muted">Drag left moves camera right</span>
            </label>
            <input
              id="invert-x"
              type="checkbox"
              checked={invertX}
              onChange={(e) => setInvertX(e.target.checked)}
            />
          </div>
        </section>
      </div>

      <div className="panel-foot">
        <button className="secondary-btn" onClick={resetDefaults}>
          Reset Defaults
        </button>
        <button className="primary-btn" onClick={close}>
          Done
        </button>
      </div>
    </div>
  )
}
