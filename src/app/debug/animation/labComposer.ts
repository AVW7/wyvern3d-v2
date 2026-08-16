import { applyBoneOffset } from '@/render/boneOffsets'
import type { Object3D } from 'three'
import type { FlightLabPoseEdits } from './FlightLab'

/**
 * Apply pose-composer wing offsets using the measured clean-rig axes.
 *
 * Shoulder local **X-negative** drops the wing against the torso.
 * Shoulder local **Z** is the fore/aft sweep — do not use it as the fold axis.
 * Distal fingers/membrane still need an explicit pitch close or the membrane
 * stays a taut sheet ("tucked but open").
 */
export function applyComposerWings(
  bones: Map<string, Object3D>,
  pe: FlightLabPoseEdits,
): void {
  const shoulderL =
    bones.get('L_WingShoulder') ?? bones.get('Bip002-L-Clavicle_049') ?? bones.get('Bip002-L-UpperArm_050')
  const elbowL = bones.get('L_WingElbow') ?? bones.get('Bip002-L-Forearm_051')
  const wristL = bones.get('L_WingWrist') ?? bones.get('Bip002-L-Hand_052')
  const shoulderR =
    bones.get('R_WingShoulder') ?? bones.get('Bip002-R-Clavicle_086') ?? bones.get('Bip002-R-UpperArm_087')
  const elbowR = bones.get('R_WingElbow') ?? bones.get('Bip002-R-Forearm_088')
  const wristR = bones.get('R_WingWrist') ?? bones.get('Bip002-R-Hand_089')

  const fold = pe.wingFold
  applyBoneOffset(shoulderL, pe.wingHeight + pe.leftWingPitch - fold * 0.9, pe.leftWingYaw, pe.leftWingRoll)
  applyBoneOffset(shoulderR, pe.wingHeight + pe.rightWingPitch - fold * 0.9, pe.rightWingYaw, pe.rightWingRoll)
  applyBoneOffset(elbowL, fold * 0.7, 0, 0)
  applyBoneOffset(elbowR, fold * 0.7, 0, 0)
  applyBoneOffset(wristL, fold * 0.35, 0, 0)
  applyBoneOffset(wristR, fold * 0.35, 0, 0)

  const fingers = ['L_WingFinger1', 'L_WingFinger2', 'L_WingFinger3', 'R_WingFinger1', 'R_WingFinger2', 'R_WingFinger3']
  for (const name of fingers) {
    const bone = bones.get(name)
    if (!bone) continue
    const side = name.startsWith('R_') ? -1 : 1
    applyBoneOffset(bone, fold * 0.25 + pe.membraneBillow * 0.2, pe.membraneBillow * 0.35 * side, 0)
  }

  for (const name of ['L_WingMembrane1', 'L_WingMembrane2', 'R_WingMembrane1', 'R_WingMembrane2']) {
    applyBoneOffset(bones.get(name), fold * 0.2, 0, 0)
  }
}

export function composerWingPitch(fold: number, height: number, sidePitch: number): number {
  return height + sidePitch - fold * 0.9
}
