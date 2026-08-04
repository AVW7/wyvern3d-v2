import { Quaternion, Vector3 } from 'three'
import type { Object3D } from 'three'

/**
 * Per-frame procedural bone offsets, composed onto the mixer's output.
 *
 * Two things this fixes, both of which shipped.
 *
 * **It composes instead of replacing.** The call sites used to do
 * `bone.rotation.set(pitch, yaw, 0, 'YXZ')` right after the mixer had written
 * the authored pose, which discarded it — measured, the neck's authored base
 * curve is 21.4 degrees at `Neck_012`, and an absolute write threw all of it
 * away every airborne frame. Post-multiplying a small offset is the same
 * operation the authoring script performs when it layers an edit onto a sampled
 * pose (`apply_rotations`: `rotation_quaternion @ Quaternion(axis, angle)`), so
 * runtime and authoring now bend these bones the same way.
 *
 * **It uses the axes the rig actually has.** An Euler triple written straight
 * onto the bone puts pitch and roll on whichever axes the euler order happens
 * to name, which on a real rig is rarely the pair you want. The axes below are
 * measured off the bind pose instead; see the note on `LOCAL_PITCH`.
 */

/*
 * Axes for the clean rig, measured off the bind pose rather than inferred.
 *
 * The vendor rig was a 3ds Max CAT skeleton whose bones ran along local **X**,
 * which put pitch on Z and roll on X. This rig is Blender-authored, so every
 * bone runs along local **Y** — checked on the neck, spine, tail, both hind
 * limbs and both wings, and it is +Y on all of them. Carrying the old triple
 * over would have driven pitch on the roll axis: the exact scrambling the note
 * above describes, reintroduced by the rig swap.
 *
 * Mapping each bone's local axes into world space on the neck chain: local X
 * lands on world ±X (lateral), so it is the sagittal/pitch axis; local Y runs
 * along the bone, so it is roll; local Z lands on world ∓Y (vertical), so it
 * is yaw.
 */

/** Sagittal bend: nose/foot down for positive, on local X. */
export const LOCAL_PITCH = new Vector3(1, 0, 0)
/**
 * Turn, on local Z.
 *
 * Positive is a left turn, derived from the bind pose — the sign has not been
 * confirmed against a moving model, so check it on the first live turn.
 */
export const LOCAL_YAW = new Vector3(0, 0, 1)
/** Roll about the bone's own forward direction, on local Y. */
export const LOCAL_ROLL = new Vector3(0, 1, 0)

/**
 * `Sanct_Cruise` frame 0, sampled from the live rig's authored head track.
 * This is the neutral forward skull pose relative to the final neck bone;
 * keeping it local makes it follow climb, dive, and bank through its parent.
 */
const STREAMLINED_HEAD_ROTATION = new Quaternion(-0.0007635, 0.0000137, 0.0411221, 0.9991539)

// Reused across every call: this runs once per bone per frame, and allocating a
// quaternion in `useFrame` is the kind of garbage that shows up as jitter.
const offset = new Quaternion()
const scratch = new Quaternion()
const chainRootWorld = new Vector3()
const chainAnchorWorld = new Vector3()
const chainBaseWorld = new Vector3()
const chainNextWorld = new Vector3()
const chainSegmentLocal = new Vector3()
const chainTargetWorld = new Vector3()
const chainTargetLocal = new Vector3()
const chainBoneWorld = new Quaternion()
const chainBoneWorldInverse = new Quaternion()

/**
 * Compose a pitch/yaw/roll offset onto whatever `bone.quaternion` already holds.
 *
 * Angles are radians about the bone's own local axes. Order is pitch, then yaw,
 * then roll; at the magnitudes involved the order is not observable, but fixing
 * one keeps the result reproducible.
 */
export function applyBoneOffset(
  bone: Object3D | null | undefined,
  pitch: number,
  yaw = 0,
  roll = 0,
): void {
  if (!bone) return
  offset.setFromAxisAngle(LOCAL_PITCH, pitch)
  if (yaw !== 0) offset.multiply(scratch.setFromAxisAngle(LOCAL_YAW, yaw))
  if (roll !== 0) offset.multiply(scratch.setFromAxisAngle(LOCAL_ROLL, roll))
  bone.quaternion.multiply(offset)
}

/**
 * Per-bone shares of a runtime neck yaw, root → tip, over `NECK_CHAIN`.
 *
 * These used to be `[0, 0, 1]`: on the vendor rig the wing clavicles hung off
 * the *proximal neck*, so any lateral sway swung both wings with it and read as
 * wingtip asymmetry. Pushing the whole yaw to the far end was the way around it.
 *
 * The clean rig parents the wings to `Spine3`, so that constraint is gone and
 * the neck is free to bend along its length. It is also two bones now, not
 * three — `[0, 0, 1]` against a two-bone chain would have indexed only the two
 * leading zeroes and produced no yaw at all.
 *
 * The split is a plain root-to-tip falloff, not a measured one; it wants a live
 * look alongside the first re-authored turn clips.
 *
 * Sagittal pitch is not split this way and does not need to be — it swings the
 * two shoulders together rather than apart.
 */
export const NECK_YAW_WEIGHTS = [0.35, 0.65] as const

/**
 * Apply a flight neck offset: pitch spread down the chain, yaw only below the
 * bones that carry the wings.
 *
 * `chain` is the neck in root → tip order (`Neck`, `Neck1`, `Neck2`); the head
 * is posed separately by its caller because it also takes a roll.
 */
export function applyNeckOffset(
  chain: (Object3D | null | undefined)[],
  pitch: number,
  yaw = 0,
): void {
  for (let i = 0; i < chain.length; i += 1) {
    const share = i < NECK_YAW_WEIGHTS.length ? NECK_YAW_WEIGHTS[i]! : 1
    applyBoneOffset(chain[i], pitch, yaw * share)
  }
}

/**
 * Hip, knee and ankle shares of a leg tuck, over `LEFT_LEG_CHAIN`.
 *
 * The opposed hip/knee signs are what make it a fold rather than a swing: the
 * hip alone carries the foot forward as well as up, and the knee's counter-flex
 * buys the lift back without the drift. These were tuned against the vendor
 * rig's leg carriage; the shape of the gesture carries over, but the magnitudes
 * want a live look once the clean rig's ground clips are authored.
 */
export const LEG_TUCK_WEIGHTS = [0.45, -0.6, 0.2] as const

/**
 * Fold one hind limb by `amount` radians, distributed thigh → calf → foot.
 *
 * Both sides take the *same* sign: their local Z axes both point at world -x, so
 * one sign moves both feet the same way. Mirroring it cancels the fold, which is
 * how the authored version measured 0.04 units of travel before it was fixed.
 */
export function applyLegTuck(chain: (Object3D | null | undefined)[], amount: number): void {
  if (amount === 0) return
  for (let i = 0; i < chain.length && i < LEG_TUCK_WEIGHTS.length; i += 1) {
    applyBoneOffset(chain[i], amount * LEG_TUCK_WEIGHTS[i]!)
  }
}

/**
 * Straighten a chain toward the anchor → chain-root body line.
 *
 * The authored clip is intentionally left intact at `amount = 0`. Above zero,
 * every link turns only around its sagittal axis (`LOCAL_PITCH`), one link at a
 * time, so a raised S curve resolves into the wyvern's current body line rather
 * than into a world-horizontal stick. It applies to the tail and the neck/head
 * chain, which share that axis. Running from root to tip matters: each
 * correction moves the next joint, and the next correction then measures the
 * result it actually inherited.
 */
export function alignChainToBody(
  chain: (Object3D | null | undefined)[],
  anchor: Object3D | null | undefined,
  amount: number,
): void {
  const first = chain[0]
  if (!anchor || !first || amount <= 0) return

  first.getWorldPosition(chainRootWorld)
  anchor.getWorldPosition(chainAnchorWorld)
  chainTargetWorld.copy(chainRootWorld).sub(chainAnchorWorld)
  if (chainTargetWorld.lengthSq() < 1e-8) return
  chainTargetWorld.normalize()

  for (let index = 0; index < chain.length - 1; index += 1) {
    const bone = chain[index]
    const next = chain[index + 1]
    if (!bone || !next) continue

    bone.getWorldPosition(chainBaseWorld)
    next.getWorldPosition(chainNextWorld)
    chainSegmentLocal.copy(chainNextWorld).sub(chainBaseWorld)
    if (chainSegmentLocal.lengthSq() < 1e-8) continue

    bone.getWorldQuaternion(chainBoneWorld)
    chainBoneWorldInverse.copy(chainBoneWorld).invert()
    chainSegmentLocal.applyQuaternion(chainBoneWorldInverse)
    chainTargetLocal.copy(chainTargetWorld).applyQuaternion(chainBoneWorldInverse)

    // Local X is the sagittal bend axis. A component along that axis cannot move
    // under an X rotation, so drop it and solve the observable angle in the YZ
    // plane — the winding is Y → Z, matching a right-handed turn about +X.
    chainSegmentLocal.x = 0
    chainTargetLocal.x = 0
    if (chainSegmentLocal.lengthSq() < 1e-8 || chainTargetLocal.lengthSq() < 1e-8) continue
    chainSegmentLocal.normalize()
    chainTargetLocal.normalize()
    const signedAngle = Math.atan2(
      chainSegmentLocal.y * chainTargetLocal.z - chainSegmentLocal.z * chainTargetLocal.y,
      chainSegmentLocal.dot(chainTargetLocal),
    )
    applyBoneOffset(bone, signedAngle * amount)
    bone.updateWorldMatrix(true, true)
  }
}

/**
 * Blend the skull toward the measured forward-flight local pose.
 *
 * Unlike an aim target, this has no child-bone feedback path and therefore
 * remains stable when the jaw is closed or a frozen clip is scrubbed. The
 * mixer pose is re-bound before this layer in Flight Lab, so the blend is
 * always relative to the current authored frame instead of accumulating.
 */
export function holdStreamlinedHeadPose(
  head: Object3D | null | undefined,
  amount: number,
): void {
  if (!head || amount <= 0) return
  head.quaternion.slerp(STREAMLINED_HEAD_ROTATION, Math.min(amount, 1))
}

/** Semantic entry point for the tail chain, whatever its current length. */
export function alignTailToBody(
  tail: (Object3D | null | undefined)[],
  pelvis: Object3D | null | undefined,
  amount: number,
): void {
  alignChainToBody(tail, pelvis, amount)
}
