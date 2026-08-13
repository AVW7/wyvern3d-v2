'use client'

import { create } from 'zustand'

export type CameraPreset = 'default' | 'topDown' | 'isometric' | 'chase' | 'cinematic' | 'followWyvern'
export type CameraFollowTarget = 'character' | 'wyvern'

export interface CameraPresetConfig {
  pitch: number
  distance: number
  fov: number
  yaw?: number
}

export const CAMERA_PRESETS: Record<CameraPreset, CameraPresetConfig> = {
  default: { pitch: 0.36, distance: 14, fov: 60, yaw: 0 },
  topDown: { pitch: 1.35, distance: 22, fov: 55, yaw: 0 },
  isometric: { pitch: 0.70, distance: 18, fov: 50, yaw: Math.PI / 4 },
  chase: { pitch: 0.20, distance: 8, fov: 65, yaw: 0 },
  cinematic: { pitch: 0.45, distance: 28, fov: 45, yaw: -Math.PI / 6 },
  followWyvern: { pitch: 0.22, distance: 26, fov: 65, yaw: 0 },
}

export interface CameraState {
  sensitivity: number // 0.2 to 2.5, default 1.0
  zoomSpeed: number // 0.2 to 2.5, default 1.0
  invertX: boolean
  invertY: boolean
  fov: number // 35 to 90, default 60
  smoothing: number // 1 to 20, default 10
  preset: CameraPreset
  followTarget: CameraFollowTarget
  wyvernTargetPosition: [number, number, number] | null
  /** Timestamp / token incremented when a preset is selected to signal controllers to snap/lerp. */
  presetToken: number
  targetPitch: number
  targetDistance: number
  targetYaw: number | null

  setSensitivity: (val: number) => void
  setZoomSpeed: (val: number) => void
  setInvertX: (val: boolean) => void
  setInvertY: (val: boolean) => void
  setFov: (val: number) => void
  setSmoothing: (val: number) => void
  setFollowTarget: (target: CameraFollowTarget) => void
  setWyvernTargetPosition: (pos: [number, number, number] | null) => void
  applyPreset: (preset: CameraPreset) => void
  resetDefaults: () => void
}

const DEFAULT_CAMERA_STATE = {
  sensitivity: 1.0,
  zoomSpeed: 1.0,
  invertX: false,
  invertY: false,
  fov: 60,
  smoothing: 10,
  preset: 'default' as CameraPreset,
  followTarget: 'character' as CameraFollowTarget,
  wyvernTargetPosition: null as [number, number, number] | null,
  presetToken: 0,
  targetPitch: CAMERA_PRESETS.default.pitch,
  targetDistance: CAMERA_PRESETS.default.distance,
  targetYaw: CAMERA_PRESETS.default.yaw ?? null,
}

export const useCameraStore = create<CameraState>()((set) => ({
  ...DEFAULT_CAMERA_STATE,

  setSensitivity: (val) => set({ sensitivity: Math.max(0.2, Math.min(2.5, val)) }),
  setZoomSpeed: (val) => set({ zoomSpeed: Math.max(0.2, Math.min(2.5, val)) }),
  setInvertX: (val) => set({ invertX: val }),
  setInvertY: (val) => set({ invertY: val }),
  setFov: (val) => set({ fov: Math.max(35, Math.min(90, Math.round(val))) }),
  setSmoothing: (val) => set({ smoothing: Math.max(1, Math.min(20, Math.round(val))) }),
  setFollowTarget: (target) =>
    set((state) => ({
      followTarget: target,
      presetToken: state.presetToken + 1,
    })),
  setWyvernTargetPosition: (pos) => set({ wyvernTargetPosition: pos }),

  applyPreset: (preset) =>
    set((state) => {
      const cfg = CAMERA_PRESETS[preset]
      if (!cfg) return state
      return {
        preset,
        fov: cfg.fov,
        targetPitch: cfg.pitch,
        targetDistance: cfg.distance,
        targetYaw: cfg.yaw ?? null,
        followTarget: preset === 'followWyvern' ? 'wyvern' : 'character',
        presetToken: state.presetToken + 1,
      }
    }),

  resetDefaults: () => set({ ...DEFAULT_CAMERA_STATE, presetToken: Date.now() }),
}))
