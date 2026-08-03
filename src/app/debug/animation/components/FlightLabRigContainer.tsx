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
      const bone = root.getObjectByName(marker.bone)
      if (bone) found.set(marker.key, bone)
    }
    bones.current = found
    neckBones.current = [
      root.getObjectByName('Neck1'),
      root.getObjectByName('Neck2'),
    ].filter((b): b is Object3D => b !== null && b !== undefined)
    headBone.current = root.getObjectByName('Head') ?? null
    spineBones.current = [
      root.getObjectByName('Spine1'),
      root.getObjectByName('Spine2'),
      root.getObjectByName('Spine3'),
      root.getObjectByName('Body'),
    ].filter((b): b is Object3D => b !== null && b !== undefined)
    jawBone.current = root.getObjectByName('Jaw') ?? null
    closedJaw.current = captureClosedJawPose(jawBone.current, closedJaw.current)
    neckHeadChain.current = [
      ...neckBones.current,
      headBone.current,
    ].filter((bone): bone is Object3D => bone !== null && bone !== undefined)
    legBones.current = [LEG_CHAIN.L, LEG_CHAIN.R].map((chain: readonly string[]) =>
      chain
        .map((name: string) => root.getObjectByName(name))
        .filter((b: Object3D | null | undefined): b is Object3D => b !== null && b !== undefined),
    )
    footBones.current = [LEG_CHAIN.L[2], LEG_CHAIN.R[2]]
      .map((name: string) => root.getObjectByName(name))
      .filter((b: Object3D | null | undefined): b is Object3D => b !== null && b !== undefined)
    tailBones.current = TAIL_CHAIN.map((name: string) => root.getObjectByName(name)).filter(
      (b: Object3D | null | undefined): b is Object3D => b !== null && b !== undefined,
    )
    wingBonesL.current = getLeftWingBoneNames()
      .map((name: string) => root.getObjectByName(name))
      .filter((b: Object3D | null | undefined): b is Object3D => b !== null && b !== undefined)
    wingBonesR.current = getRightWingBoneNames()
      .map((name: string) => root.getObjectByName(name))
      .filter((b: Object3D | null | undefined): b is Object3D => b !== null && b !== undefined)
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
      (procedural ? pose.current.pitch : 0) + (poseComposer ? poseEdits.bodyPitch : 0),
      0,
      procedural ? pose.current.bank : 0,
    )
    group.position.set(
      poseComposer ? poseEdits.bodyX : 0,
      poseComposer ? poseEdits.bodyY : 0,
      poseComposer ? poseEdits.bodyZ : 0,
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

    const mixer = mixerRef.current
    const root = modelRoot.current
    let clipName = '—'
    let clipTime = 0
    let duration = 0
    if (mixer && root) {
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
      if (frozen) mixer.update(0)
    }

    if (procedural) {
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

    if (poseComposer) {
      for (const bone of neckBones.current) {
        applyBoneOffset(bone, poseEdits.neckPitch, poseEdits.neckYaw)
      }
      alignChainToBody(neckHeadChain.current, bones.current.get('pelvis'), poseEdits.neckAlignment)
      holdStreamlinedHeadPose(headBone.current, poseEdits.neckAlignment)
      for (let index = 0; index < tailBones.current.length; index += 1) {
        const weight = TAIL_WEIGHTS[index] ?? 0
        applyBoneOffset(
          tailBones.current[index],
          poseEdits.tailPitch * weight,
          poseEdits.tailYaw * weight,
        )
      }
      alignTailToBody(tailBones.current, bones.current.get('pelvis'), poseEdits.tailAlignment)
      for (const chain of legBones.current) {
        applyLegTuck(chain, poseEdits.legTuck)
      }
      for (const foot of footBones.current) {
        applyBoneOffset(foot, poseEdits.footTuck)
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
        poseComposer
          ? `ON  body ${poseEdits.bodyX.toFixed(1)}, ${poseEdits.bodyY.toFixed(1)}, ${poseEdits.bodyZ.toFixed(1)}  climb ${poseEdits.bodyPitch.toFixed(2)}  neck ${poseEdits.neckPitch.toFixed(2)}/${poseEdits.neckYaw.toFixed(2)} align ${poseEdits.neckAlignment.toFixed(2)}  tail ${poseEdits.tailPitch.toFixed(2)}/${poseEdits.tailYaw.toFixed(2)} align ${poseEdits.tailAlignment.toFixed(2)}  legs ${poseEdits.legTuck.toFixed(2)}  feet ${poseEdits.footTuck.toFixed(2)}`
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
