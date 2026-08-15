import { Quaternion } from 'three'
import type { Object3D } from 'three'
import type { ModelState } from './assets/manifest'
import { GOTHIC_WING_POSE } from './wingFoldPose'

/**
 * Procedural grounded wing fold — the "gothic" stance.
 *
 * Why this is procedural rather than authored into the clips
 * ----------------------------------------------------------
 * The authored ground clips do not fold the wing at all. Measured across the
 * shipped rig: `idle` folds 0%, `rest` 0%, `walk` 1% — the animal walks with
 * its wings held out at roughly 43 m the whole cycle.
 *
 * That is not an authoring oversight on the old rig, it is a rig limit. On the
 * pre-graft wing the membrane is skinned to two `WingMembrane*` bones hanging
 * off the elbow, so folding the spars slides them through a sheet that does not
 * follow: a 70 degree digit fold moves digit-driven vertices 586 units and
 * membrane-driven vertices 70. The wing cannot close.
 *
 * The grafted rig can: with v1's six three-phalanx digits carrying the
 * membrane, this pose folds the span from 6272 to 3942 units.
 *
 * Why the pose is baked data instead of computed from axes
 * --------------------------------------------------------
 * Every attempt to derive the fold from named local axes was wrong, because
 * the shoulder runs along world X and rotating about its own local X twists the
 * wing along its length rather than lifting it. The pose in `wingFoldPose.ts`
 * is instead measured from v1's own grounded stance, by
 * `pnpm assets:gothic-fold`.
 *
 * The right side is the left mirrored by a plain (x, -y, -z, w) component flip.
 * That flip was tried on the previous rig and abandoned -- it left a tip
 * asymmetry of 2138 units, against 417 for a world-space mirror re-solved by
 * FK -- but it failed there because the *rig* was not mirrored, not because the
 * maths was wrong. The rebuilt wing's left and right rests mirror to exactly
 * 0.0, so the sagittal reflection is a pure sign change and the flip now lands
 * the folded tips 0.0157 units from mirrored.
 *
 * How it composes
 * ---------------
 * Unlike `boneOffsets`, which post-multiplies a small delta onto the mixer's
 * output, this **slerps toward an absolute local rotation**, because a fold is
 * a destination pose rather than a nudge. Weight 0 leaves the authored clip
 * exactly as the mixer wrote it, so a flying wyvern is untouched.
 *
 * Call it per frame after `mixer.update`, the same place the scenes call
 * `applyBoneOffset`.
 */

/** States that read as grounded, and so fold the wing. */
const GROUNDED: ReadonlySet<ModelState> = new Set<ModelState>([
  'idle',
  'walk',
  'run',
  'rest',
  'sleep',
  'sit',
  'seated',
  'eat',
  'drink',
  'groom',
  'perch',
  'hop',
  'nuzzle',
  'calm',
  'offer',
  'pet',
  'inspect',
])

/**
 * How folded the wing should be for a state, 0 (open) to 1 (gothic).
 *
 * `land` and `rise` sit part-way: they are the transitions either side of the
 * ground, and snapping the wing shut on the first frame of a landing reads
 * worse than closing into it.
 *
 * `fly` returns 0, not the 0.25 it used to. A quarter-weight slerp
 * toward this pose is not a quarter of a fold -- the table holds a 179-degree
 * rotation on `WingD4P0` and 121 degrees on `WingHand` -- so it dragged a
 * flying wyvern's wings forward across its chest for the whole of cruise. It also contradicted this
 * module's own stated contract, that weight 0 leaves a flying wyvern untouched.
 */
export function foldWeightForState(state: ModelState | undefined): number {
  if (!state) return 0
  if (GROUNDED.has(state)) return 1
  if (state === 'land' || state === 'rise') return 0.5
  return 0
}

/** Per-frame smoothing, so a state change eases the wing rather than popping it. */
export function approachFold(current: number, target: number, dt: number, rate = 3.5): number {
  if (dt <= 0) return current
  const t = 1 - Math.exp(-rate * dt)
  return current + (target - current) * t
}

/**
 * The pose as unit quaternions, built once.
 *
 * Normalising here matters beyond tidiness: the table is written to nine
 * decimals, which leaves each entry a hair off unit length, and slerping onto a
 * non-unit target leaves the bone fractionally short of the pose every frame
 * rather than settling on it.
 */
const POSE: ReadonlyArray<readonly [string, Quaternion]> = Object.entries(
  GOTHIC_WING_POSE,
).map(([name, q]) => [name, new Quaternion(q[0], q[1], q[2], q[3]).normalize()] as const)

const scratch = new Quaternion()

/**
 * Blend the wing toward the gothic pose in place.
 *
 * Returns how many bones it actually moved — 0 on a rig without the grafted
 * digits, which is how a caller can tell the model predates the graft.
 */
export function applyWingFold(root: Object3D, weight: number): number {
  if (weight <= 0.0005) return 0
  const w = weight > 1 ? 1 : weight
  let moved = 0
  for (const [name, target] of POSE) {
    const bone = root.getObjectByName(name)
    if (!bone) continue
    // A bone whose opposite number is absent from the rig would fold one wing
    // and leave the other open. That is not hypothetical: the table this
    // replaced was baked on the superseded batten rig and held a 161-degree
    // rotation on the left D0 knuckle against 63 on the right, which collapsed
    // the wings into each other the moment both sides resolved.
    const opposite = name.startsWith('L_')
      ? `R_${name.slice(2)}`
      : `L_${name.slice(2)}`
    if (!root.getObjectByName(opposite)) continue
    scratch.copy(bone.quaternion)
    scratch.slerp(target, w)
    bone.quaternion.copy(scratch)
    moved++
  }
  return moved
}
