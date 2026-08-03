import type { Object3D, Quaternion } from 'three'
import type { ModelState } from '@/render/assets/manifest'

/**
 * All normal airborne locomotion is sealed at the lower muzzle. Attack and
 * breath stay out of this list deliberately: their authored mouth motion is a
 * gameplay tell, not an idle-flight detail.
 */
const PASSIVE_FLIGHT_STATES = new Set<ModelState>([
  'fly',
  'airborne',
  'cruise',
  'scout',
  'speed',
  'glide',
  'dive',
  'bankLeft',
  'bankRight',
  'hover',
  'land',
])

const MOUTH_ACTIONS = new Set<ModelState>(['attackAir', 'breathe', 'breatheAir'])

/**
 * The model's unanimated lower-muzzle rotation. Holding this exact local pose
 * is deliberately stronger than an additive trim: a third-party loop can key
 * the jaw wide open, and that key must not leak into passive flight.
 */
export interface ClosedJawPose {
  jaw: Object3D
  quaternion: Quaternion
}

/** Whether an action intentionally owns the mouth as an attack/breath tell. */
export function isMouthAction(action: ModelState | null): boolean {
  return action !== null && MOUTH_ACTIONS.has(action)
}

/** True only while a normal flight loop is visible and no mouth tell is active. */
export function shouldSealFlightJaw(state: ModelState, action: ModelState | null = null): boolean {
  return PASSIVE_FLIGHT_STATES.has(state) && !isMouthAction(action)
}

/**
 * Capture the bind-pose jaw once for an individual cloned model. `onReady`
 * can run again when a React callback changes, so retain an existing capture
 * while it belongs to the same jaw rather than sampling an animated frame.
 */
export function captureClosedJawPose(
  jaw: Object3D | null | undefined,
  previous: ClosedJawPose | null = null,
): ClosedJawPose | null {
  if (!jaw) return null
  if (previous?.jaw === jaw) return previous
  return { jaw, quaternion: jaw.quaternion.clone() }
}

/**
 * Hold the lower muzzle at its captured closed pose after the mixer updates.
 * Attack and breath callers bypass this function so their authored mouth tell
 * remains visible.
 */
export function sealFlightJaw(
  jaw: Object3D | null | undefined,
  closedPose: ClosedJawPose | null | undefined,
): void {
  if (!jaw || closedPose?.jaw !== jaw) return
  jaw.quaternion.copy(closedPose.quaternion)
}
