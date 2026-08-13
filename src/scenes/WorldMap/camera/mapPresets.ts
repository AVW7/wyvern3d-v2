export interface MapCameraPreset {
  pitch: number
  distance: number
  yawOffset?: number
}

export const MAP_CAMERA_PRESETS: Record<string, MapCameraPreset> = {
  default: { pitch: 0.85, distance: 200 },
  topDown: { pitch: 1.25, distance: 260 },
  isometric: { pitch: 0.7, distance: 170, yawOffset: Math.PI / 4 },
  chase: { pitch: 0.45, distance: 100 },
  cinematic: { pitch: 0.5, distance: 260, yawOffset: -Math.PI / 6 },
  followWyvern: { pitch: 0.85, distance: 200 },
}
