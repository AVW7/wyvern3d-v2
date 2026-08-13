import { Vector3, MathUtils } from 'three'

export function clampPitch(pitch: number): number {
  return MathUtils.clamp(pitch, 0.35, 1.25)
}

export function clampDistance(dist: number): number {
  return MathUtils.clamp(dist, 80, 300)
}

export function calculateOrbitPosition(
  target: { x: number; y: number; z: number },
  yaw: number,
  pitch: number,
  distance: number
): Vector3 {
  const cosPitch = Math.cos(pitch)
  return new Vector3(
    target.x + Math.sin(yaw) * distance * cosPitch,
    target.y + distance * Math.sin(pitch),
    target.z + Math.cos(yaw) * distance * cosPitch
  )
}
