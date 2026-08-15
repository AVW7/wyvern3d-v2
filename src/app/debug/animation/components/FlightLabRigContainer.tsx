'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box3, Box3Helper, Color, PerspectiveCamera, Sphere, Vector3 } from 'three'
import type { AnimationMixer, Group, Object3D } from 'three'
import { GameModel } from '@/render/assets/GameModel'
import type { ModelState } from '@/render/assets/manifest'
import { BreathVFX } from '@/render/vfx/BreathVFX'
import {
  alignChainToBody,
  alignTailToBody,
  applyBoneOffset,
  applyLegTuck,
  applyNeckOffset,
} from '@/render/boneOffsets'
import { captureClosedJawPose, sealFlightJaw, shouldSealFlightJaw, type ClosedJawPose } from '@/render/flightMouth'
import {
  dampFlightPose,
  dampHeadNeckPose,
  dampLegTuck,
  flightAnimationState,
  flightPoseTargets,
  headNeckTargets,
  legTuckTarget,
  speedPitchTrim,
  type FlightLoopState,
  type FlightPose,
  type HeadNeckPose,
} from '@/render/flightPose'
import { propagateFullBodyWave, calculatePhase } from '@/render/spineWave'
import {
  createHeadNeckState,
  intelligentHeadNeckController,
  type HeadNeckState,
  type GazeTarget,
  type FlightContext,
} from '@/render/gazeController'
import {
  createTailState,
  dynamicTailController,
  type TailState,
} from '@/render/tailController'
import {
  createLegsState,
  dynamicLegController,
  type LegsState,
} from '@/render/legPhysics'
import {
  createPoseTransitionState,
  updatePoseTransition,
  triggerModeTransition,
  getLoopPhase,
  oscillate,
  isTransitioning,
  type PoseTransitionState,
} from '@/render/poseTransition'
import {
  createWingsState,
  dynamicWingController,
  getLeftWingBoneNames,
  getRightWingBoneNames,
  type WingsState,
} from '@/render/wingRefinement'
import type { FlightLabProps } from '../FlightLab'
import { LEG_CHAIN, TAIL_CHAIN, TAIL_WEIGHTS, MARKERS, CAMERAS } from '../constants'

// The clean flight rig's swept wing membrane reaches ~2.94 world units below
// its origin at the downstroke. Keep only airborne states clear of the floor;
// grounded clips must use their manifest yOffset directly so the Lab can review
// their actual contacts. The Pose Composer's bodyY remains a relative offset.
const FLIGHT_LAB_ALTITUDE = 4
const AIRBORNE_STATES = new Set<ModelState>([
  'fly', 'airborne', 'attackAir', 'breatheAir', 'huntCarry', 'cruise', 'scout',
  'speed', 'glide', 'dive', 'bankLeft', 'bankRight', 'hover', 'land',
])

function flightLabAltitude(state: ModelState): number {
  return AIRBORNE_STATES.has(state) ? FLIGHT_LAB_ALTITUDE : 0
}

const MARKER_ALIASES: Record<string, string[]> = {
  head: ['Head', 'Bip002-Head_015'],
  pelvis: ['Body', 'Bip002_06', 'Bip002-Pelvis_07', 'Bip002-Spine_08'],
  tail: ['Tail6', 'Tail10', 'Bip002-Tail6_01', 'Bip002-Tail8_03'],
  footL: ['L_Foot', 'Bip002-L-Foot_0188', 'Bip001-L-Foot_0178', 'Bip002-L-Foot_0226'],
  footR: ['R_Foot', 'Bip002-R-Foot_0202', 'Bip001-R-Foot_0182', 'Bip002-R-Foot_0234'],
  wingL: ['L_WingFinger3_end', 'L_WingD3P2', 'L_WingFinger3', 'Bip002-L-Hand_052', 'Bip002-L-Finger3_055'],
  wingR: ['R_WingFinger3_end', 'R_WingD3P2', 'R_WingFinger3', 'Bip002-R-Hand_089', 'Bip002-R-Finger3_090'],
}

function resolveFirstBone(root: Object3D, names: string[]): Object3D | null {
  for (const name of names) {
    const obj = root.getObjectByName(name)
    if (obj) return obj
  }
  return null
}

function resolveBoneChain(root: Object3D, candidates: (readonly string[])[]): Object3D[] {
  for (const chain of candidates) {
    const chainBones = chain
      .map((name) => root.getObjectByName(name))
      .filter((b): b is Object3D => b !== null && b !== undefined)
    if (chainBones.length > 0) return chainBones
  }
  return []
}

export function FlightLabRigContainer({
  speciesId,
  requestedState,
  auto,
  scale,
  horizontalSpeed,
  verticalSpeed,
  yawRate,
  referenceSpeed,
  powered,
  boosting,
  searching,
  procedural,
  frozen,
  scrub,
  overlays,
  poseComposer,
  poseEdits,
  fireBreath = false,
  readout,
  onActiveState,
  centerTrigger = 0,
  zoomFitTrigger = 0,
  zoomInTrigger = 0,
  zoomOutTrigger = 0,
  resetCamTrigger = 0,
  camera: cameraPreset,
}: FlightLabProps) {
  const attitude = useRef<Group>(null)
  const pose = useRef<FlightPose>({ pitch: 0, bank: 0 })
  const headNeck = useRef<HeadNeckPose>({
    neckPitch: 0,
    neckYaw: 0,
    headPitch: 0,
    headYaw: 0,
    headRoll: 0,
  })
  const intelligentHeadNeck = useRef<HeadNeckState>(createHeadNeckState())
  const tailState = useRef<TailState>(createTailState())
  const legsState = useRef<LegsState>(createLegsState())
  const poseTransition = useRef<PoseTransitionState>(createPoseTransitionState())
  const wingsState = useRef<WingsState>(createWingsState())
  const wingBonesL = useRef<Object3D[]>([])
  const wingBonesR = useRef<Object3D[]>([])
  const legTuck = useRef(0)
  const modelRoot = useRef<Group | null>(null)
  const mixerRef = useRef<AnimationMixer | null>(null)
  const bones = useRef<Map<string, Object3D>>(new Map())
  const neckBones = useRef<Object3D[]>([])
  const headBone = useRef<Object3D | null>(null)
  const spineBones = useRef<Object3D[]>([])
  const jawBone = useRef<Object3D | null>(null)
  const closedJaw = useRef<ClosedJawPose | null>(null)
  const neckHeadChain = useRef<Object3D[]>([])
  const legBones = useRef<Object3D[][]>([])
  const footBones = useRef<Object3D[]>([])
  const tailBones = useRef<Object3D[]>([])
  const markerRefs = useRef<Map<string, Object3D>>(new Map())
  // ── Anti-flicker: stash frequently-changing pose props in refs so that
  //    slider drags don't re-render the R3F subtree (which would flash the
  //    raw clip pose for one frame before useFrame re-applies the edits).
  const poseEditsRef = useRef(poseEdits)
  poseEditsRef.current = poseEdits
  const poseComposerRef = useRef(poseComposer)
  poseComposerRef.current = poseComposer
  const scene = useThree((s) => s.scene)
  const threeCamera = useThree((s) => s.camera)
  const threeControls = useThree((s) => s.controls)

  const [loopState, setLoopState] = useState<FlightLoopState>('cruise')
  const loopStateRef = useRef<FlightLoopState>('cruise')
  const state: ModelState = auto ? loopState : requestedState

  const lastCenter = useRef(centerTrigger)
  const lastZoomFit = useRef(zoomFitTrigger)
  const lastZoomIn = useRef(zoomInTrigger)
  const lastZoomOut = useRef(zoomOutTrigger)
  const lastResetCam = useRef(resetCamTrigger)

  const handleReady = useCallback((root: Group, mixer: AnimationMixer) => {
    modelRoot.current = root
    mixerRef.current = mixer
    const found = new Map<string, Object3D>()
    for (const marker of MARKERS) {
      const candidates = MARKER_ALIASES[marker.key] ?? [marker.bone]
      const bone = resolveFirstBone(root, candidates)
      if (bone) found.set(marker.key, bone)
    }
    bones.current = found

    neckBones.current = resolveBoneChain(root, [
      ['Neck1', 'Neck2'],
      ['Bip002-Neck_012', 'Bip002-Neck1_013', 'Bip002-Neck2_014'],
    ])
    headBone.current = resolveFirstBone(root, ['Head', 'Bip002-Head_015'])
    spineBones.current = resolveBoneChain(root, [
      ['Spine1', 'Spine2', 'Spine3', 'Body'],
      ['Bip002-Spine_08', 'Bip002-Spine1_09', 'Bip002-Spine2_010', 'Bip002-Spine3_011', 'Bip002_06'],
    ])
    jawBone.current = resolveFirstBone(root, ['Jaw', 'Bip002-Ponytail1_016'])
    closedJaw.current = captureClosedJawPose(jawBone.current, closedJaw.current)
    neckHeadChain.current = [
      ...neckBones.current,
      headBone.current,
    ].filter((bone): bone is Object3D => bone !== null && bone !== undefined)

    const leftLegChain = resolveBoneChain(root, [
      LEG_CHAIN.L,
      ['Bip002-L-Thigh_0186', 'Bip002-L-Calf_0187', 'Bip002-L-Foot_0188'],
      ['Bip001-L-Thigh_0176', 'Bip001-L-Calf_0177', 'Bip001-L-Foot_0178'],
    ])
    const rightLegChain = resolveBoneChain(root, [
      LEG_CHAIN.R,
      ['Bip002-R-Thigh_0201', 'Bip002-R-Calf_00', 'Bip002-R-Foot_0202'],
      ['Bip001-R-Thigh_0180', 'Bip001-R-Calf_0181', 'Bip001-R-Foot_0182'],
    ])
    legBones.current = [leftLegChain, rightLegChain].filter((c) => c.length > 0)
    footBones.current = [
      leftLegChain[leftLegChain.length - 1],
      rightLegChain[rightLegChain.length - 1],
    ].filter((b): b is Object3D => b !== null && b !== undefined)

    tailBones.current = resolveBoneChain(root, [
      TAIL_CHAIN,
      ['Bip002-Tail1_0215', 'Bip002-Tail2_0216', 'Bip002-Tail3_0217', 'Bip002-Tail4_0218', 'Bip002-Tail5_0219', 'Bip002-Tail6_01', 'Bip002-Tail7_02', 'Bip002-Tail8_03'],
    ])

    wingBonesL.current = resolveBoneChain(root, [
      getLeftWingBoneNames(),
      ['L_WingShoulder', 'L_WingElbow', 'L_WingWrist', 'L_WingHand', 'L_WingD0P0', 'L_WingD1P0', 'L_WingD2P0', 'L_WingD3P0'],
      ['Bip002-L-Clavicle_049', 'Bip002-L-UpperArm_050', 'Bip002-L-Forearm_051', 'Bip002-L-Hand_052', 'Bip002-L-Finger0_073', 'Bip002-L-Finger1_067', 'Bip002-L-Finger2_061', 'Bip002-L-Finger3_055'],
    ])
    wingBonesR.current = resolveBoneChain(root, [
      getRightWingBoneNames(),
      ['R_WingShoulder', 'R_WingElbow', 'R_WingWrist', 'R_WingHand', 'R_WingD0P0', 'R_WingD1P0', 'R_WingD2P0', 'R_WingD3P0'],
      ['Bip002-R-Clavicle_086', 'Bip002-R-UpperArm_087', 'Bip002-R-Forearm_088', 'Bip002-R-Hand_089', 'Bip002-R-Finger0_0108', 'Bip002-R-Finger1_0102', 'Bip002-R-Finger2_096', 'Bip002-R-Finger3_090'],
    ])

    // Store all rig bone names directly in bones map
    root.traverse((obj) => {
      if (obj.name) {
        found.set(obj.name, obj)
      }
    })
  }, [])

  const bounds = useRef(0)
  const box = useMemo(() => new Box3(), [])

  const getModelCenter = useCallback((): Vector3 => {
    const center = new Vector3()
    if (modelRoot.current) {
      modelRoot.current.updateWorldMatrix(true, true)
      const liveBox = new Box3().setFromObject(modelRoot.current, true)
      if (!liveBox.isEmpty()) {
        liveBox.getCenter(center)
        return center
      }
    }
    if (!box.isEmpty()) {
      box.getCenter(center)
      return center
    }
    return new Vector3(0, 25, 0)
  }, [box])

  useEffect(() => {
    const controls = threeControls as {
      target: Vector3
      update: () => void
      minDistance?: number
      maxDistance?: number
    } | null
    if (!controls) return

    let updated = false

    if (centerTrigger > lastCenter.current) {
      lastCenter.current = centerTrigger
      const center = getModelCenter()
      const delta = new Vector3().subVectors(center, controls.target)
      controls.target.copy(center)
      threeCamera.position.add(delta)
      updated = true
    }

    if (zoomFitTrigger > lastZoomFit.current) {
      lastZoomFit.current = zoomFitTrigger
      const center = getModelCenter()
      let radius = 35
      if (modelRoot.current) {
        modelRoot.current.updateWorldMatrix(true, true)
        const liveBox = new Box3().setFromObject(modelRoot.current, true)
        if (!liveBox.isEmpty()) {
          const sphere = new Sphere()
          liveBox.getBoundingSphere(sphere)
          radius = Math.max(sphere.radius, 12)
        }
      }
      const perspCamera = threeCamera as PerspectiveCamera
      const fovRad = ((perspCamera.fov ?? 35) * Math.PI) / 180
      const fitDistance = (radius / Math.sin(fovRad / 2)) * 1.15
      const dir = new Vector3().subVectors(perspCamera.position, controls.target)
      if (dir.lengthSq() < 0.0001) dir.set(0, 0.5, 1)
      dir.normalize()
      controls.target.copy(center)
      perspCamera.position.copy(center).addScaledVector(dir, fitDistance)
      updated = true
    }

    if (zoomInTrigger > lastZoomIn.current) {
      lastZoomIn.current = zoomInTrigger
      const center = getModelCenter()
      controls.target.copy(center)
      const dir = new Vector3().subVectors(threeCamera.position, center)
      const currentDist = dir.length()
      const minD = controls.minDistance ?? 20
      const newDist = Math.max(currentDist * 0.75, minD)
      dir.normalize().multiplyScalar(newDist)
      threeCamera.position.copy(center).add(dir)
      updated = true
    }

    if (zoomOutTrigger > lastZoomOut.current) {
      lastZoomOut.current = zoomOutTrigger
      const center = getModelCenter()
      controls.target.copy(center)
      const dir = new Vector3().subVectors(threeCamera.position, center)
      const currentDist = dir.length()
      const maxD = controls.maxDistance ?? 600
      const newDist = Math.min(currentDist * 1.35, maxD)
      dir.normalize().multiplyScalar(newDist)
      threeCamera.position.copy(center).add(dir)
      updated = true
    }

    if (resetCamTrigger > lastResetCam.current) {
      lastResetCam.current = resetCamTrigger
      const preset = CAMERAS[cameraPreset] ?? CAMERAS.side
      if (preset) {
        controls.target.set(preset.target[0], preset.target[1], preset.target[2])
        threeCamera.position.set(preset.position[0], preset.position[1], preset.position[2])
        updated = true
      }
    }

    if (updated) {
      controls.update()
    }
  }, [
    centerTrigger,
    zoomFitTrigger,
    zoomInTrigger,
    zoomOutTrigger,
    resetCamTrigger,
    cameraPreset,
    threeCamera,
    threeControls,
    box,
    getModelCenter,
  ])

  const helper = useMemo(() => new Box3Helper(box, new Color('#5b6b7d')), [box])
  useEffect(() => {
    if (overlays) scene.add(helper)
    return () => {
      scene.remove(helper)
    }
  }, [scene, helper, overlays])

  const world = useMemo(() => new Vector3(), [])
  const labTime = useRef(0)

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    labTime.current += dt
    const group = attitude.current
    if (!group) return

    // Read from refs to avoid closure over stale props / re-render triggers
    const pe = poseEditsRef.current
    const pc = poseComposerRef.current

    // ── Phase 1: Advance Animation Mixer FIRST ──────────────────────────────
    // Base clip keyframes must be evaluated into bone transforms before any
    // procedural layers or Pose Composer offsets are applied. If the mixer
    // updates after bone offsets are set, it overwrites them causing flicker.
    const mixer = mixerRef.current
    const root = modelRoot.current
    let clipName = '—'
    let clipTime = 0
    let duration = 0
    if (mixer) {
      let best: { name: string; time: number; duration: number; weight: number } | null = null
      const actions = (mixer as unknown as { _actions?: unknown[] })._actions ?? []
      for (const entry of actions) {
        const action = entry as {
          getEffectiveWeight(): number
          time: number
          getClip(): { name: string; duration: number }
        }
        const weight = action.getEffectiveWeight()
        if (!best || weight > best.weight) {
          const clip = action.getClip()
          best = { name: clip.name, time: action.time, duration: clip.duration, weight }
        }
        if (frozen && scrub !== null && weight > 0) {
          action.time = scrub * action.getClip().duration
        }
      }
      if (best) {
        clipName = best.name
        clipTime = best.time
        duration = best.duration
      }
      if (frozen) {
        mixer.update(0)
      } else {
        mixer.update(dt)
      }
    }

    // ── Phase 2: Compute Target Pose Dynamics ──────────────────────────────
    const target = flightPoseTargets(
      verticalSpeed,
      horizontalSpeed,
      yawRate,
      labTime.current,
      referenceSpeed,
    )
    pose.current = dampFlightPose(pose.current, target, dt)

    const targetHeadNeck = headNeckTargets(
      horizontalSpeed,
      verticalSpeed,
      yawRate,
      pose.current.pitch,
      pose.current.bank,
      referenceSpeed,
    )
    headNeck.current = dampHeadNeckPose(headNeck.current, targetHeadNeck, dt)
    legTuck.current = dampLegTuck(
      legTuck.current,
      legTuckTarget(horizontalSpeed, referenceSpeed),
      dt,
    )

    group.rotation.order = 'YXZ'
    group.rotation.set(
      (procedural ? pose.current.pitch : 0) + (pc ? pe.bodyPitch : 0),
      pc ? pe.bodyYaw : 0,
      (procedural ? pose.current.bank : 0) + (pc ? pe.bodyRoll : 0),
    )
    group.position.set(
      pc ? pe.bodyX : 0,
      flightLabAltitude(state) + (pc ? pe.bodyY : 0),
      pc ? pe.bodyZ : 0,
    )

    if (auto) {
      const next = flightAnimationState(loopStateRef.current, pose.current.bank, {
        horizontalSpeed,
        verticalSpeed,
        referenceSpeed,
        powered,
        boosting,
        searching,
      })
      if (next !== loopStateRef.current) {
        loopStateRef.current = next
        setLoopState(next)
        onActiveState(next)
        
        poseTransition.current = triggerModeTransition(poseTransition.current, next, {
          pitch: pose.current.pitch,
          bank: pose.current.bank,
          neckPitch: headNeck.current.neckPitch,
          neckYaw: headNeck.current.neckYaw,
          headPitch: headNeck.current.headPitch,
          headYaw: headNeck.current.headYaw,
          headRoll: headNeck.current.headRoll,
          legTuck: legTuck.current,
          tailSwing: tailState.current.smoothedTurnRate,
          tailLift: tailState.current.lift,
        })
      }
    }

    if (procedural && AIRBORNE_STATES.has(state) && !pc) {
      const phase = calculatePhase(labTime.current)
      propagateFullBodyWave(
        { spine: spineBones.current, neck: neckBones.current },
        phase,
        horizontalSpeed,
        yawRate
      )
      
      const gazeTarget: GazeTarget | null = null
      const bodyPose = {
        position: new Vector3(0, 0, 0),
        velocity: new Vector3(horizontalSpeed, verticalSpeed, 0),
        yaw: 0,
        pitch: pose.current.pitch,
        bank: pose.current.bank,
      }
      const flightContext: FlightContext = {
        horizontalSpeed,
        verticalSpeed,
        turnRate: yawRate,
        turbulence: Math.abs(verticalSpeed) > 5 ? 0.3 : Math.abs(yawRate) > 0.5 ? 0.2 : 0,
        flightMode: loopStateRef.current,
        time: labTime.current,
      }
      intelligentHeadNeck.current = intelligentHeadNeckController(
        bodyPose,
        gazeTarget,
        flightContext,
        intelligentHeadNeck.current,
        dt
      )
      
      const blendFactor = Math.min(intelligentHeadNeck.current.trackingVelocity * 0.1, 0.4)
      const blendedNeckPitch = headNeck.current.neckPitch + intelligentHeadNeck.current.neckPitch * blendFactor
      const blendedNeckYaw = headNeck.current.neckYaw + intelligentHeadNeck.current.neckYaw * blendFactor
      const blendedHeadPitch = headNeck.current.headPitch + intelligentHeadNeck.current.headPitch * blendFactor
      const blendedHeadYaw = headNeck.current.headYaw + intelligentHeadNeck.current.headYaw * blendFactor
      const blendedHeadRoll = headNeck.current.headRoll + intelligentHeadNeck.current.headRoll * blendFactor
      
      applyNeckOffset(neckBones.current, blendedNeckPitch, blendedNeckYaw)
      applyBoneOffset(
        headBone.current,
        blendedHeadPitch,
        blendedHeadYaw,
        blendedHeadRoll,
      )
      
      tailState.current = dynamicTailController(
        tailBones.current,
        yawRate,
        pose.current.bank,
        horizontalSpeed,
        loopStateRef.current,
        0.5,
        labTime.current,
        tailState.current,
        dt
      )
      
      const leftLeg = legBones.current[0]
      const rightLeg = legBones.current[1]
      if (leftLeg && rightLeg) {
        legsState.current = dynamicLegController(
          leftLeg,
          rightLeg,
          yawRate,
          horizontalSpeed,
          verticalSpeed,
          10,
          loopStateRef.current,
          legTuck.current,
          labTime.current,
          legsState.current,
          dt
        )
      }
      
      poseTransition.current = updatePoseTransition(poseTransition.current, dt)
      
      const breathePhase = getLoopPhase(poseTransition.current, 3.0)
      const breatheOscillation = Math.sin(breathePhase * Math.PI * 2) * 0.02
      const swayOscillation = oscillate(poseTransition.current, 0.15, 0.03)
      
      if (spineBones.current[0]) {
        applyBoneOffset(spineBones.current[0], breatheOscillation * 0.5, swayOscillation)
      }
      
      const baseTuck = legTuck.current
      const modeTuckMult = loopState === 'dive' || loopState === 'speed' ? 1.2
        : loopState === 'hover' ? 0.6
        : 1.0
      
      const transitionProgress = poseTransition.current.pitch.progress
      const effectiveTuck = baseTuck * modeTuckMult * (isTransitioning(poseTransition.current) ? transitionProgress : 1)
      const finalTuck = Math.max(0, Math.min(1, effectiveTuck + legsState.current.left.extension * 0.3))
      
      for (const chain of legBones.current) {
        applyLegTuck(chain, finalTuck)
      }
      
      const turbulence = Math.abs(verticalSpeed) > 5 ? 0.35
        : Math.abs(yawRate) > 0.5 ? 0.25
        : Math.abs(verticalSpeed) > 2 ? 0.15
        : 0

      wingsState.current = dynamicWingController(
        wingBonesL.current,
        wingBonesR.current,
        turbulence,
        pose.current.pitch,
        yawRate,
        horizontalSpeed,
        loopStateRef.current,
        labTime.current,
        wingsState.current,
        dt
      )
    }

    if (pc) {
      for (const bone of neckBones.current) {
        applyBoneOffset(bone, pe.neckPitch, pe.neckYaw)
      }
      alignChainToBody(neckHeadChain.current, bones.current.get('pelvis'), pe.neckAlignment)
      if (pe.tailPitch !== 0 || pe.tailYaw !== 0) {
        for (let index = 0; index < tailBones.current.length; index += 1) {
          const weight = TAIL_WEIGHTS[index] ?? 0
          applyBoneOffset(
            tailBones.current[index],
            pe.tailPitch * weight,
            pe.tailYaw * weight,
          )
        }
      }
      if (pe.tailAlignment !== 1) {
        alignTailToBody(tailBones.current, bones.current.get('pelvis'), pe.tailAlignment)
      }
      for (const chain of legBones.current) {
        applyLegTuck(chain, pe.legTuck)
      }
      for (const foot of footBones.current) {
        applyBoneOffset(foot, pe.footTuck)
      }

      // Wing Height & Wing Fold Master Adjustments
      const wingShoulderL = bones.current.get('L_WingShoulder') ?? bones.current.get('Bip002-L-Clavicle_049') ?? bones.current.get('Bip002-L-UpperArm_050') ?? bones.current.get('wingL1')
      const wingElbowL = bones.current.get('L_WingElbow') ?? bones.current.get('Bip002-L-Forearm_051') ?? bones.current.get('wingL2')
      const wingWristL = bones.current.get('L_WingWrist') ?? bones.current.get('Bip002-L-Hand_052')

      const wingShoulderR = bones.current.get('R_WingShoulder') ?? bones.current.get('Bip002-R-Clavicle_086') ?? bones.current.get('Bip002-R-UpperArm_087') ?? bones.current.get('wingR1')
      const wingElbowR = bones.current.get('R_WingElbow') ?? bones.current.get('Bip002-R-Forearm_088') ?? bones.current.get('wingR2')
      const wingWristR = bones.current.get('R_WingWrist') ?? bones.current.get('Bip002-R-Hand_089')

      // 1. Wing Height (Up / Down) -> Local X pitch
      applyBoneOffset(wingShoulderL, pe.wingHeight + pe.leftWingPitch, pe.leftWingYaw, pe.leftWingRoll)
      applyBoneOffset(wingShoulderR, pe.wingHeight + pe.rightWingPitch, pe.rightWingYaw, pe.rightWingRoll)

      // 2. Wing Fold / Unfold -> Local Z yaw sweeps
      applyBoneOffset(wingShoulderL, 0, pe.wingFold * 0.8, 0)
      applyBoneOffset(wingElbowL, 0, -pe.wingFold * 1.2, 0)
      applyBoneOffset(wingWristL, 0, pe.wingFold * 0.6, 0)

      applyBoneOffset(wingShoulderR, 0, -pe.wingFold * 0.8, 0)
      applyBoneOffset(wingElbowR, 0, pe.wingFold * 1.2, 0)
      applyBoneOffset(wingWristR, 0, -pe.wingFold * 0.6, 0)

      // 3. Membrane Billow & Finger Fan Spread -> Local Y/Z rotation on wing fingers
      const fingerNames = ['L_WingFinger1', 'L_WingFinger2', 'L_WingFinger3', 'R_WingFinger1', 'R_WingFinger2', 'R_WingFinger3']
      fingerNames.forEach((fname) => {
        const fingerBone = bones.current.get(fname)
        if (fingerBone) {
          applyBoneOffset(
            fingerBone,
            0,
            pe.membraneBillow * (fname.startsWith('R_') ? -0.5 : 0.5),
            pe.membraneBillow * 0.3
          )
        }
      })

      // Left & Right Leg Rotations
      const legL = bones.current.get('L_Thigh') ?? bones.current.get('Bip002-L-Thigh_0186') ?? bones.current.get('Bip001-L-Thigh_0176') ?? bones.current.get('legL')
      if (legL) {
        applyBoneOffset(legL, 0, pe.leftLegYaw, pe.leftLegPitch)
      }

      const legR = bones.current.get('R_Thigh') ?? bones.current.get('Bip002-R-Thigh_0201') ?? bones.current.get('Bip001-R-Thigh_0180') ?? bones.current.get('legR')
      if (legR) {
        applyBoneOffset(legR, 0, pe.rightLegYaw, pe.rightLegPitch)
      }
    }

    if (shouldSealFlightJaw(state)) {
      sealFlightJaw(jawBone.current, closedJaw.current)
    }

    if (root) {
      root.updateWorldMatrix(true, true)
      bounds.current = (bounds.current + 1) % 10
      if (bounds.current === 0 || box.isEmpty()) box.setFromObject(root, true)
      for (const marker of MARKERS) {
        const bone = bones.current.get(marker.key)
        const dot = markerRefs.current.get(marker.key)
        if (bone && dot) {
          bone.getWorldPosition(world)
          dot.position.copy(world)
          dot.visible = overlays
        } else if (dot) {
          dot.visible = false
        }
      }
    }

    const node = readout.current
    if (!node) return
    const head = bones.current.get('head')
    const tail = bones.current.get('tail')
    const pelvis = bones.current.get('pelvis')
    const foot = bones.current.get('footL')
    const footR = bones.current.get('footR')
    let axisAngle = Number.NaN
    let footDrop = Number.NaN
    let footDropR = Number.NaN
    if (head && tail) {
      const h = head.getWorldPosition(new Vector3())
      const t = tail.getWorldPosition(new Vector3())
      axisAngle = (Math.atan2(h.y - t.y, Math.hypot(h.x - t.x, h.z - t.z)) * 180) / Math.PI
    }
    if (pelvis) {
      const p = pelvis.getWorldPosition(new Vector3()).y
      if (foot) footDrop = p - foot.getWorldPosition(new Vector3()).y
      if (footR) footDropR = p - footR.getWorldPosition(new Vector3()).y
    }
    const size = box.getSize(new Vector3())
    const trimRad = speedPitchTrim(horizontalSpeed, referenceSpeed)
    const trimDeg = (trimRad * 180) / Math.PI
    const ratio = referenceSpeed > 0 ? horizontalSpeed / referenceSpeed : 0
    let speedCategory = 'MEDIUM (CRUISE)'
    if (horizontalSpeed < 0.5) speedCategory = 'HOVER / STILL'
    else if (ratio < 0.65) speedCategory = 'SLOW / LOITER'
    else if (ratio > 1.25 || boosting) speedCategory = 'FAST / SPRINT'

    const neckPitchDeg = ((headNeck.current.neckPitch * 3) * 180) / Math.PI
    const headPitchDeg = (headNeck.current.headPitch * 180) / Math.PI
    const headYawDeg = (headNeck.current.headYaw * 180) / Math.PI

    node.textContent = [
      `requested   ${auto ? `auto -> ${loopStateRef.current}` : requestedState}`,
      `speed level ${speedCategory} (${horizontalSpeed.toFixed(1)} u/s, ${ratio.toFixed(2)}x ref)`,
      `speed trim  ${trimDeg > 0 ? '+' : ''}${trimDeg.toFixed(1)}deg (${trimDeg > 0 ? 'nose-up lift' : trimDeg < 0 ? 'nose-down fast' : 'neutral'})`,
      `neck/head   neck ${neckPitchDeg > 0 ? '+' : ''}${neckPitchDeg.toFixed(1)}deg (${ratio > 0.7 ? 'straightened' : 'curved'})  head pitch ${headPitchDeg.toFixed(1)}deg  turn lead ${headYawDeg.toFixed(1)}deg`,
      `clip        ${clipName}`,
      `time        ${clipTime.toFixed(2)}s / ${duration.toFixed(2)}s  (phase ${
        duration > 0 ? ((clipTime % duration) / duration).toFixed(3) : '—'
      })`,
      `pitch/bank  ${pose.current.pitch.toFixed(3)} / ${pose.current.bank.toFixed(3)} rad`,
      `body axis   ${Number.isNaN(axisAngle) ? '—' : `${axisAngle.toFixed(1)}deg nose-up`}`,
      `foot drop   L ${Number.isNaN(footDrop) ? '—' : footDrop.toFixed(2)}  R ${
        Number.isNaN(footDropR) ? '—' : footDropR.toFixed(2)
      } below pelvis (${legTuck.current < -0.02 ? 'letting down' : legTuck.current > 0.02 ? 'tucking' : 'at mode base'})`,
      `leg tuck    ${legTuck.current > 0 ? '+' : ''}${legTuck.current.toFixed(3)} rad of airspeed offset`,
      `pose lab    ${
        pc
          ? `ON  body ${pe.bodyX.toFixed(1)}, ${pe.bodyY.toFixed(1)}, ${pe.bodyZ.toFixed(1)}  climb ${pe.bodyPitch.toFixed(2)}  neck ${pe.neckPitch.toFixed(2)}/${pe.neckYaw.toFixed(2)} align ${pe.neckAlignment.toFixed(2)}  tail ${pe.tailPitch.toFixed(2)}/${pe.tailYaw.toFixed(2)} align ${pe.tailAlignment.toFixed(2)}  legs ${pe.legTuck.toFixed(2)}  feet ${pe.footTuck.toFixed(2)}`
          : 'off (authored clip plus selected runtime layers only)'
      }`,
      `bounds      w ${size.x.toFixed(1)}  h ${size.y.toFixed(1)}  d ${size.z.toFixed(1)}`,
      `  x ${box.min.x.toFixed(1)}..${box.max.x.toFixed(1)}`,
      `  y ${box.min.y.toFixed(1)}..${box.max.y.toFixed(1)}`,
      `  z ${box.min.z.toFixed(1)}..${box.max.z.toFixed(1)}`,
    ].join('\n')
  })

  return (
    <>
      <group ref={attitude}>
        <GameModel
          id={speciesId}
          state={state}
          scale={scale}
          frozen={frozen}
          manualMixer={true}
          onReady={handleReady}
          fallback={null}
        >
          <BreathVFX
            range={26}
            active={fireBreath}
            socketRef={headBone}
            neckRef={neckBones}
          />
        </GameModel>
        {overlays && <axesHelper args={[30]} />}
      </group>
      {overlays &&
        MARKERS.map((marker: { key: string; bone: string; color: string }) => (
          <mesh
            key={marker.key}
            ref={(node) => {
              if (node) markerRefs.current.set(marker.key, node)
              else markerRefs.current.delete(marker.key)
            }}
          >
            <sphereGeometry args={[1.1, 8, 8]} />
            <meshBasicMaterial color={marker.color} depthTest={false} />
          </mesh>
        ))}
    </>
  )
}
