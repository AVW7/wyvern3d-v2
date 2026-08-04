/**
 * Bone names for the clean wyvern rig (`public/models/wyvern.glb`).
 *
 * These used to be spelled out at four call sites as the vendor rig's CAT
 * names (`Bip002-Head_015`, `Bip002-Tail1_0215`, …). Those bones do not exist
 * in this rig, so every lookup silently returned `null` and the gaze, tail and
 * leg-tuck code ran against empty chains — no error, just nothing moving. One
 * list, here, is what stops that recurring the next time the rig is rebuilt.
 *
 * Names are the authored ones, verified against the 46 joints the GLB's skin
 * declares. Chains are ordered **root → tip**, which is what `boneOffsets`
 * weights assume.
 */

import type { Object3D } from 'three'

export const HEAD_BONE = 'Head'
export const JAW_BONE = 'Jaw'
export const BODY_BONE = 'Body'
export const ROOT_MOTION_BONE = 'RootMotion'

/**
 * Root → tip. Two bones, where the vendor rig had three — the weights in
 * `boneOffsets` are sized to this chain, not that one.
 */
export const NECK_CHAIN = ['Neck1', 'Neck2'] as const

export const SPINE_CHAIN = ['Spine1', 'Spine2', 'Spine3'] as const

/**
 * Root → tip, parented `Body → Tail1 → … → Tail10`.
 *
 * `Tail1` used to sit at the snout rather than the hips, and its vertex group
 * held 3692 head vertices — the bone and the jaw had been swapped during the
 * rig build, so rotating it swung the tail about the wrong end of the animal
 * and the real jaw bone deformed nothing. Both are repaired: `Tail1` now runs
 * from the pelvis to `Tail2`'s head as a weightless pivot (the same pattern as
 * `Root`/`RootMotion`), and its snout weights were folded into `Head`.
 *
 * `Tail7`–`Tail10` were added because the mesh ran 1205 units past `Tail6`'s
 * tip — roughly the last third of the tail was rigid, and it read as a straight
 * spike from above. Probed tip displacement now falls off cleanly root to tip
 * (450 / 352 / 269 / 181 / 91 for Tail6…Tail10 at +0.30 rad).
 */
export const TAIL_CHAIN = [
  'Tail1',
  'Tail2',
  'Tail3',
  'Tail4',
  'Tail5',
  'Tail6',
  'Tail7',
  'Tail8',
  'Tail9',
  'Tail10',
] as const

/** Hip → knee → ankle, the three segments `LEG_TUCK_WEIGHTS` folds. */
export const LEFT_LEG_CHAIN = ['L_Thigh', 'L_Calf', 'L_Foot'] as const
export const RIGHT_LEG_CHAIN = ['R_Thigh', 'R_Calf', 'R_Foot'] as const

export const HIND_LEG_CHAINS = [LEFT_LEG_CHAIN, RIGHT_LEG_CHAIN] as const

/**
 * Shoulder → wing-tip, following the leading spar. Unlike the vendor rig these
 * hang off `Spine3`, not the neck, so a neck yaw no longer drags the wings.
 *
 * The spars were rebuilt against the membrane: each `Finger*` bone used to point
 * almost straight down, 84–88° away from the geometry it deforms, so rotating
 * one swung the membrane sideways instead of folding it along its length. They
 * now run knuckle → mid → tip along the three ridges measured off the mesh, and
 * the wing folds (25.6% span reduction) instead of tearing.
 *
 * `WingMembrane1/2` support the trailing lobe behind the arm, which had no bone
 * within 500 units and so stretched into a needle in every clip; `WingClaw` is
 * the hooked thumb, which was previously weighted to `L_Toes`/`R_Toes` — the
 * wing claw was bound to the foot, and dragged toward the floor.
 */
export const LEFT_WING_CHAIN = [
  'L_WingShoulder',
  'L_WingElbow',
  'L_WingWrist',
  'L_WingFinger1',
  'L_WingFinger2',
  'L_WingFinger3',
  'L_WingFinger3_end',
] as const
export const RIGHT_WING_CHAIN = [
  'R_WingShoulder',
  'R_WingElbow',
  'R_WingWrist',
  'R_WingFinger1',
  'R_WingFinger2',
  'R_WingFinger3',
  'R_WingFinger3_end',
] as const

/** Trailing-edge membrane support, root → tip. Not part of the spar chain. */
export const LEFT_WING_MEMBRANE = ['L_WingMembrane1', 'L_WingMembrane2'] as const
export const RIGHT_WING_MEMBRANE = ['R_WingMembrane1', 'R_WingMembrane2'] as const

/** The hooked thumb at the wrist. */
export const LEFT_WING_CLAW = 'L_WingClaw'
export const RIGHT_WING_CLAW = 'R_WingClaw'

/** One bone by name, or null when the model has no such bone. */
export function findBone(root: Object3D, name: string): Object3D | null {
  return root.getObjectByName(name) ?? null
}

/**
 * Resolve a chain, dropping anything the model lacks.
 *
 * Missing bones are skipped rather than throwing, which keeps a placeholder or
 * a partially-rebuilt rig renderable — but it is also why the old vendor names
 * went unnoticed for so long, so keep the chains above in step with the GLB.
 */
export function findChain(root: Object3D, names: readonly string[]): Object3D[] {
  return names
    .map((name) => root.getObjectByName(name))
    .filter((bone): bone is Object3D => bone !== null && bone !== undefined)
}
