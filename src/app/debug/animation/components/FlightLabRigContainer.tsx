'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box3, Box3Helper, Color, Vector3 } from 'three'
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
  holdStreamlinedHeadPose,
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
  type FlightLoopState,
  type FlightPose,
  type HeadNeckPose,
} from '@/render/flightPose'
import { propagateSpineWave, propagateFullBodyWave, calculatePhase } from '@/render/spineWave'
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
  applyMembranePanelFlutter,
  createWingsState,
  dynamicWingController,
  getLeftWingBoneNames,
  getRightWingBoneNames,
  GOTHIC_LEFT_WING_PANEL_NAMES,
  GOTHIC_RIGHT_WING_PANEL_NAMES,
  type WingsState,
} from '@/render/wingRefinement'
import type { FlightLabProps } from '../FlightLab'
import { LEG_CHAIN, TAIL_CHAIN, TAIL_WEIGHTS, MARKERS } from '../constants'
import { MARKER_ALIASES, resolveBoneChain, resolveFirstBone } from '../labBones'
import { applyComposerWings } from '../labComposer'
import {
  extraPitchFromSlider,
  gazeBlendFromWeight,
  scaleLegTuck,
  scaleNeckStream,
  tailAggressionFromWave,
  tailSpeedForStiffness,
  verticalSpeedFromPitch,
  wingTurbulenceFromSlider,
  activeControllerNames,
} from '../labDynamics'
import { AIRBORNE_STATES, flightLabAltitude, resolveClipName } from '../labPresets'
import { calculateClipLoopSeam, evaluateLabContract, formatReadout, type LabTelemetry } from '../labTelemetry'
import { useLabCamera } from '../hooks/useLabCamera'
import { ComparisonModel } from './ComparisonModel'
import { PreyField } from './PreyField'

/**
 * Gap between the rig under review and its comparison, in world units. Sized to
 * clear the widest measured silhouette -- the gothic wing spans about 46 at the
 * lab's fit -- while staying inside the `side` camera's frame at default zoom.
 */
const COMPARISON_OFFSET = 55

export function FlightLabRigContainer({
  speciesId,
  compareId,
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
  onTelemetry,
  controllerIsolation,
  speedDynamics,
  transitionDuration,
  propManager,
  propsList,
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
  const wingPanelsL = useRef<Object3D[]>([])
  const wingPanelsR = useRef<Object3D[]>([])
  const legTuck = useRef(0)
  const modelRoot = useRef<Group | null>(null)
  const mixerRef = useRef<AnimationMixer | null>(null)
  const clipSeamCache = useRef<Map<string, number>>(new Map())
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
  const isolationRef = useRef(controllerIsolation)
  isolationRef.current = controllerIsolation
  const dynamicsRef = useRef(speedDynamics)
  dynamicsRef.current = speedDynamics
  const durationRef = useRef(transitionDuration)
  durationRef.current = transitionDuration
  const telemetryCbRef = useRef(onTelemetry)
  telemetryCbRef.current = onTelemetry
  const sampleClock = useRef(0)
  const lastSampleKey = useRef('')
  const wyvernWorld = useRef(new Vector3())
  const gazeLook = useRef(new Vector3(8, 2, 18))
  const bodyPos = useRef(new Vector3())
  const bodyVel = useRef(new Vector3())
  const sampleScratch = useRef({
    head: new Vector3(),
    tail: new Vector3(),
    pelvis: new Vector3(),
    footL: new Vector3(),
    footR: new Vector3(),
    wingL: new Vector3(),
    wingR: new Vector3(),
  })
  const scene = useThree((s) => s.scene)
  const threeCamera = useThree((s) => s.camera)
  const threeControls = useThree((s) => s.controls)

  const [loopState, setLoopState] = useState<FlightLoopState>('cruise')
  const loopStateRef = useRef<FlightLoopState>('cruise')
  const state: ModelState = auto ? loopState : requestedState

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
      ['Spine1', 'Spine2', 'Spine3'],
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
      ['L_WingShoulder', 'L_WingElbow', 'L_WingWrist', 'L_WingHand', 'L_WingD0P0', 'L_WingD0P1', 'L_WingD0P2'],
      ['L_WingShoulder', 'L_WingElbow', 'L_WingWrist', 'L_WingHand', 'L_WingD3P0', 'L_WingD3P1', 'L_WingD3P2'],
      getLeftWingBoneNames(),
      ['Bip002-L-Clavicle_049', 'Bip002-L-UpperArm_050', 'Bip002-L-Forearm_051', 'Bip002-L-Hand_052', 'Bip002-L-Finger0_073', 'Bip002-L-Finger1_067', 'Bip002-L-Finger2_061', 'Bip002-L-Finger3_055'],
    ])
    wingBonesR.current = resolveBoneChain(root, [
      ['R_WingShoulder', 'R_WingElbow', 'R_WingWrist', 'R_WingHand', 'R_WingD0P0', 'R_WingD0P1', 'R_WingD0P2'],
      ['R_WingShoulder', 'R_WingElbow', 'R_WingWrist', 'R_WingHand', 'R_WingD3P0', 'R_WingD3P1', 'R_WingD3P2'],
      getRightWingBoneNames(),
      ['Bip002-R-Clavicle_086', 'Bip002-R-UpperArm_087', 'Bip002-R-Forearm_088', 'Bip002-R-Hand_089', 'Bip002-R-Finger0_0108', 'Bip002-R-Finger1_0102', 'Bip002-R-Finger2_096', 'Bip002-R-Finger3_090'],
    ])

    const panelsL: Object3D[] = []
    for (const name of GOTHIC_LEFT_WING_PANEL_NAMES) {
      const b = root.getObjectByName(name)
      if (b) panelsL.push(b)
    }
    wingPanelsL.current = panelsL

    const panelsR: Object3D[] = []
    for (const name of GOTHIC_RIGHT_WING_PANEL_NAMES) {
      const b = root.getObjectByName(name)
      if (b) panelsR.push(b)
    }
    wingPanelsR.current = panelsR

    // Store all rig bone names directly in bones map
    root.traverse((obj) => {
      if (obj.name) {
        found.set(obj.name, obj)
      }
    })
  }, [])

  const bounds = useRef(0)
  const box = useMemo(() => new Box3(), [])

  useLabCamera({
    modelRoot,
    box,
    cameraPreset,
    threeCamera,
    threeControls,
    centerTrigger,
    zoomFitTrigger,
    zoomInTrigger,
    zoomOutTrigger,
    resetCamTrigger,
  })

  const helper = useMemo(() => new Box3Helper(box, new Color('#5b6b7d')), [box])
  useEffect(() => {
    if (overlays) scene.add(helper)
    return () => {
      scene.remove(helper)
    }
  }, [scene, helper, overlays])

  const world = useMemo(() => new Vector3(), [])
  const mouthWorldPos = useMemo(() => new Vector3(), [])
  const neckWorldPos = useMemo(() => new Vector3(), [])
  const mouthForward = useMemo(() => new Vector3(), [])
  const lFootWorldPos = useMemo(() => new Vector3(), [])
  const rFootWorldPos = useMemo(() => new Vector3(), [])
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
    let seamRotationRad = 0
    if (mixer) {
      let best: {
        name: string
        time: number
        duration: number
        weight: number
        clip: { name: string; duration: number; tracks: { name: string; times: ArrayLike<number>; values: ArrayLike<number> }[] }
      } | null = null
      const actions = (mixer as unknown as { _actions?: unknown[] })._actions ?? []
      for (const entry of actions) {
        const action = entry as {
          getEffectiveWeight(): number
          time: number
          getClip(): { name: string; duration: number; tracks: { name: string; times: ArrayLike<number>; values: ArrayLike<number> }[] }
        }
        const weight = action.getEffectiveWeight()
        if (!best || weight > best.weight) {
          const clip = action.getClip()
          best = { name: clip.name, time: action.time, duration: clip.duration, weight, clip }
        }
        if (frozen && scrub !== null && weight > 0) {
          action.time = scrub * action.getClip().duration
        }
      }
      if (best) {
        clipName = best.name
        clipTime = best.time
        duration = best.duration
        if (clipSeamCache.current.has(best.name)) {
          seamRotationRad = clipSeamCache.current.get(best.name)!
        } else {
          seamRotationRad = calculateClipLoopSeam(best.clip)
          clipSeamCache.current.set(best.name, seamRotationRad)
        }
      }
      if (frozen) {
        mixer.update(0)
      } else {
        mixer.update(dt)
      }
    }

    // ── Phase 2: Compute Target Pose Dynamics ──────────────────────────────
    const dyn = dynamicsRef.current
    const iso = isolationRef.current
    const liveVertical = verticalSpeed + verticalSpeedFromPitch(horizontalSpeed, dyn.pitchAngle)
    const extraPitch = extraPitchFromSlider(dyn.pitchAngle)

    const target = flightPoseTargets(
      liveVertical,
      horizontalSpeed,
      yawRate,
      labTime.current,
      referenceSpeed,
    )
    pose.current = dampFlightPose(pose.current, { ...target, pitch: target.pitch + extraPitch }, dt)

    const targetHeadNeck = headNeckTargets(
      horizontalSpeed,
      liveVertical,
      yawRate,
      pose.current.pitch,
      pose.current.bank,
      referenceSpeed,
    )
    headNeck.current = dampHeadNeckPose(headNeck.current, {
      ...targetHeadNeck,
      neckPitch: scaleNeckStream(targetHeadNeck.neckPitch, dyn.neckStreamFactor),
    }, dt)
    legTuck.current = dampLegTuck(
      legTuck.current,
      scaleLegTuck(legTuckTarget(horizontalSpeed, referenceSpeed), dyn.legTuckWeight),
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
    wyvernWorld.current.set(group.position.x, group.position.y, group.position.z)

    if (auto) {
      const next = flightAnimationState(loopStateRef.current, pose.current.bank, {
        horizontalSpeed,
        verticalSpeed: liveVertical,
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
        }, durationRef.current)
      }
    }

    if (procedural && AIRBORNE_STATES.has(state) && !pc) {
      if (iso.spineWave) {
        const phase = calculatePhase(labTime.current)
        propagateFullBodyWave(
          { spine: spineBones.current, neck: neckBones.current },
          phase,
          horizontalSpeed,
          yawRate,
        )
      }

      const gazeTarget: GazeTarget | null = searching
        ? { position: gazeLook.current, type: 'waypoint', urgency: dyn.headGazeWeight }
        : null
      bodyPos.current.set(0, 0, 0)
      bodyVel.current.set(horizontalSpeed, liveVertical, 0)
      const bodyPose = {
        position: bodyPos.current,
        velocity: bodyVel.current,
        yaw: 0,
        pitch: pose.current.pitch,
        bank: pose.current.bank,
      }
      const flightContext: FlightContext = {
        horizontalSpeed,
        verticalSpeed: liveVertical,
        turnRate: yawRate,
        turbulence: Math.abs(liveVertical) > 5 ? 0.3 : Math.abs(yawRate) > 0.5 ? 0.2 : 0,
        flightMode: loopStateRef.current,
        time: labTime.current,
      }

      if (iso.gazeController) {
        intelligentHeadNeck.current = intelligentHeadNeckController(
          bodyPose,
          gazeTarget,
          flightContext,
          intelligentHeadNeck.current,
          dt,
        )
      }

      const blendFactor = gazeBlendFromWeight(dyn.headGazeWeight, intelligentHeadNeck.current.trackingVelocity)
      const blendedNeckPitch = headNeck.current.neckPitch + (iso.gazeController ? intelligentHeadNeck.current.neckPitch * blendFactor : 0)
      const blendedNeckYaw = headNeck.current.neckYaw + (iso.gazeController ? intelligentHeadNeck.current.neckYaw * blendFactor : 0)
      const blendedHeadPitch = headNeck.current.headPitch + (iso.gazeController ? intelligentHeadNeck.current.headPitch * blendFactor : 0)
      const blendedHeadYaw = headNeck.current.headYaw + (iso.gazeController ? intelligentHeadNeck.current.headYaw * blendFactor : 0)
      const blendedHeadRoll = headNeck.current.headRoll + (iso.gazeController ? intelligentHeadNeck.current.headRoll * blendFactor : 0)

      applyNeckOffset(neckBones.current, blendedNeckPitch, blendedNeckYaw)
      applyBoneOffset(headBone.current, blendedHeadPitch, blendedHeadYaw, blendedHeadRoll)

      const speedStream = horizontalSpeed > 18 ? Math.min(1, (horizontalSpeed - 18) / 24) : 0
      const effectiveStream = Math.max(dyn.neckStreamFactor, speedStream, loopStateRef.current === 'speed' ? 1.0 : 0)

      if (effectiveStream > 0.1) {
        const anchor = bones.current.get('pelvis') ?? bones.current.get('Body') ?? spineBones.current[0]
        if (anchor) {
          if (neckHeadChain.current.length > 0 && effectiveStream > 0.3) {
            const neckStraightAmount = (effectiveStream - 0.3) / 0.7
            alignChainToBody(neckHeadChain.current, anchor, neckStraightAmount)
            holdStreamlinedHeadPose(headBone.current, neckStraightAmount)
          }
          if (tailBones.current.length > 0) {
            alignTailToBody(tailBones.current, anchor, effectiveStream)
          }
        }
      }

      if (iso.dynamicTail) {
        tailState.current = dynamicTailController(
          tailBones.current,
          yawRate,
          pose.current.bank,
          tailSpeedForStiffness(horizontalSpeed, dyn.tailStiffness),
          loopStateRef.current,
          tailAggressionFromWave(dyn.tailWaveAmp),
          labTime.current,
          tailState.current,
          dt,
        )
      }

      const leftLeg = legBones.current[0]
      const rightLeg = legBones.current[1]
      if (iso.dynamicLegs && leftLeg && rightLeg) {
        legsState.current = dynamicLegController(
          leftLeg,
          rightLeg,
          yawRate,
          horizontalSpeed,
          liveVertical,
          10,
          loopStateRef.current,
          legTuck.current,
          labTime.current,
          legsState.current,
          dt,
        )
      }

      poseTransition.current = updatePoseTransition(poseTransition.current, dt)

      if (iso.spineWave && spineBones.current.length > 0) {
        const spinePhase = calculatePhase(labTime.current, 2.5)
        propagateSpineWave(
          spineBones.current,
          spinePhase,
          horizontalSpeed,
          yawRate,
        )
        const breathePhase = getLoopPhase(poseTransition.current, 3.0)
        const breatheOscillation = Math.sin(breathePhase * Math.PI * 2) * 0.02
        const swayOscillation = oscillate(poseTransition.current, 0.15, 0.03)
        // Maintain chest stability: Spine1 anchors leg roots; Spine2/Spine3 articulate breathing/flex
        const flexBone = spineBones.current[1] ?? spineBones.current[0]
        if (flexBone) {
          applyBoneOffset(flexBone, breatheOscillation * 0.5, swayOscillation)
        }
      }

      if (iso.dynamicLegs) {
        const baseTuck = legTuck.current
        const modeTuckMult = loopState === 'dive' || loopState === 'speed' ? 1.2
          : loopState === 'hover' ? 0.6
          : 1.0
        const transitionProgress = poseTransition.current.pitch.progress
        const effectiveTuck = baseTuck * modeTuckMult * (isTransitioning(poseTransition.current) ? transitionProgress : 1)
        const finalTuck = Math.max(-0.6, Math.min(1.2, effectiveTuck + legsState.current.left.extension * 0.3))
        for (const chain of legBones.current) {
          applyLegTuck(chain, finalTuck)
        }
      }

      if (iso.wingRefinement) {
        const turbulence = wingTurbulenceFromSlider(
          Math.abs(liveVertical) > 5 ? 0.35
            : Math.abs(yawRate) > 0.5 ? 0.25
            : Math.abs(liveVertical) > 2 ? 0.15
            : 0,
          dyn.wingFlutterFreq,
        )
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
          dt,
        )
        if (wingPanelsL.current.length > 0 || wingPanelsR.current.length > 0) {
          applyMembranePanelFlutter(
            wingPanelsL.current,
            wingPanelsR.current,
            horizontalSpeed,
            turbulence,
            yawRate,
            labTime.current,
            dyn.wingFlutterFreq,
          )
        }
      }
    }

    if (pc) {
      for (const bone of neckBones.current) {
        applyBoneOffset(bone, pe.neckPitch, pe.neckYaw)
      }
      alignChainToBody(neckHeadChain.current, bones.current.get('pelvis'), pe.neckAlignment)
      if (pe.tailPitch !== 0 || pe.tailYaw !== 0) {
        for (let index = 0; index < tailBones.current.length; index += 1) {
          const weight = TAIL_WEIGHTS[index] ?? 0
          applyBoneOffset(tailBones.current[index], pe.tailPitch * weight, pe.tailYaw * weight)
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
      applyComposerWings(bones.current, pe)
      const legL = bones.current.get('L_Thigh') ?? bones.current.get('Bip002-L-Thigh_0186') ?? bones.current.get('Bip001-L-Thigh_0176')
      if (legL) applyBoneOffset(legL, 0, pe.leftLegYaw, pe.leftLegPitch)
      const legR = bones.current.get('R_Thigh') ?? bones.current.get('Bip002-R-Thigh_0201') ?? bones.current.get('Bip001-R-Thigh_0180')
      if (legR) applyBoneOffset(legR, 0, pe.rightLegYaw, pe.rightLegPitch)
    }

    if (iso.jawSeal && shouldSealFlightJaw(state)) {
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

    const pts = sampleScratch.current
    const head = bones.current.get('head')
    const tail = bones.current.get('tail')
    const pelvis = bones.current.get('pelvis')
    const foot = bones.current.get('footL')
    const footR = bones.current.get('footR')
    const wingL = bones.current.get('wingL')
    const wingR = bones.current.get('wingR')
    let axisAngle = Number.NaN
    let footDrop = Number.NaN
    let footDropR = Number.NaN
    let wingSpan = Number.NaN
    let tailExtent = Number.NaN
    if (head) head.getWorldPosition(pts.head)
    if (tail) tail.getWorldPosition(pts.tail)
    if (pelvis) pelvis.getWorldPosition(pts.pelvis)
    if (foot) foot.getWorldPosition(pts.footL)
    if (footR) footR.getWorldPosition(pts.footR)
    if (wingL) wingL.getWorldPosition(pts.wingL)
    if (wingR) wingR.getWorldPosition(pts.wingR)
    if (head && tail) {
      axisAngle = (Math.atan2(pts.head.y - pts.tail.y, Math.hypot(pts.head.x - pts.tail.x, pts.head.z - pts.tail.z)) * 180) / Math.PI
    }
    if (pelvis) {
      if (foot) footDrop = pts.pelvis.y - pts.footL.y
      if (footR) footDropR = pts.pelvis.y - pts.footR.y
      if (tail) tailExtent = pts.pelvis.distanceTo(pts.tail)
    }
    if (wingL && wingR) wingSpan = pts.wingL.distanceTo(pts.wingR)

    const requestedLabel = auto ? `auto -> ${loopStateRef.current}` : requestedState
    const resolvedClip = resolveClipName(speciesId, state)
    const markers = {
      head: Boolean(head),
      tail: Boolean(tail),
      pelvis: Boolean(pelvis),
      wingL: Boolean(wingL),
      wingR: Boolean(wingR),
    }
    const contract = evaluateLabContract({
      requestedState: state,
      resolvedClip,
      clipName,
      markers,
      bodyAxisDeg: axisAngle,
      footDropL: footDrop,
      wingSpan,
      poseComposer: pc,
      seamRotationRad,
    })
    const sample: LabTelemetry = {
      timestamp: labTime.current,
      airspeed: horizontalSpeed,
      pitchAngle: (pose.current.pitch * 180) / Math.PI,
      bankAngle: (pose.current.bank * 180) / Math.PI,
      headOrientation: {
        pitch: headNeck.current.headPitch,
        yaw: headNeck.current.headYaw,
        roll: headNeck.current.headRoll,
      },
      neckCurve: headNeck.current.neckPitch,
      tailExtent,
      tailFlexAngles: [tailState.current.swing, tailState.current.lift],
      footDropL: footDrop,
      footDropR,
      bodyAxisDeg: axisAngle,
      wingSpan,
      seamRotationRad,
      clipName,
      clipTime,
      clipDuration: duration,
      requestedState: requestedLabel,
      resolvedClip,
      loopState: auto ? loopStateRef.current : state,
      activeControllers: activeControllerNames(iso),
      contractStatus: contract.status,
      contractNotes: contract.notes,
      poseComposer: pc,
      markers,
    }

    const node = readout.current
    if (node) node.textContent = formatReadout(sample)

    sampleClock.current += dt
    if (sampleClock.current >= 0.12) {
      sampleClock.current = 0
      const key = `${sample.clipName}|${sample.contractStatus}|${sample.airspeed.toFixed(1)}|${sample.bodyAxisDeg.toFixed(1)}|${sample.wingSpan.toFixed(1)}`
      if (key !== lastSampleKey.current) {
        lastSampleKey.current = key
        telemetryCbRef.current?.(sample)
      }
    }

    // ── Phase 5: Combat Simulation (Fire Breath Cone & Talon Swoop) ──────────
    if (propManager) {
      if (fireBreath || state === 'breathe' || state === 'breatheAir') {
        const head = headBone.current
        if (head) {
          head.getWorldPosition(mouthWorldPos)
          const lastNeck = neckBones.current.at(-1)
          if (lastNeck) {
            lastNeck.getWorldPosition(neckWorldPos)
            mouthForward.copy(mouthWorldPos).sub(neckWorldPos)
          } else {
            head.getWorldDirection(mouthForward)
          }
          if (mouthForward.lengthSq() < 1e-6) mouthForward.set(0, 0, 1)
          mouthForward.normalize()
          mouthWorldPos.addScaledVector(mouthForward, 1.35)

          propManager.applyFireCone(mouthWorldPos, mouthForward, 50 * dt, 0.4 * dt, 26)
        }
      }

      if (state === 'attack' || state === 'attackAir' || state === 'huntGrip' || state === 'dive') {
        const [lFoot, rFoot] = footBones.current
        if (lFoot && rFoot) {
          lFoot.getWorldPosition(lFootWorldPos)
          rFoot.getWorldPosition(rFootWorldPos)
          propManager.applyTalonSwoop(lFootWorldPos, rFootWorldPos, 60 * dt, 2.5)
        }
      }
    }
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
        {/* Inside `attitude`, not beside it. That group carries the rig's
            altitude from `flightLabAltitude(state)` and its procedural pitch and
            bank, so a comparison mounted outside it sits at ground level in
            world axes while the rig climbs and rolls away from it -- the two
            stop being comparable the moment the clip is airborne or procedural
            attitude is on. Inheriting the group puts the comparison in the rig's
            own frame, which is the only frame the A/B means anything in. */}
        {compareId && (
          <ComparisonModel
            id={compareId}
            state={state}
            scale={scale}
            frozen={frozen}
            scrub={scrub}
            offset={COMPARISON_OFFSET}
          />
        )}
      </group>
      <PreyField propManager={propManager} propsList={propsList} wyvernPosition={wyvernWorld.current} />
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
