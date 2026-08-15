import { Object3D, Vector3 } from 'three'
import type { ModelState } from './assets/manifest'
import { clamp } from '@/core/math/vec'
import {
  HEAD_BONE,
  JAW_BONE,
  LEFT_LEG_CHAIN,
  NECK_CHAIN,
  RIGHT_LEG_CHAIN,
  SPINE_CHAIN,
  TAIL_CHAIN,
  findBone,
  findChain,
  wingChains,
} from './rigBones'
import { applyBoneOffset, applyLegTuck } from './boneOffsets'
import {
  captureClosedJawPose,
  isMouthAction,
  sealFlightJaw,
  type ClosedJawPose,
} from './flightMouth'
import {
  angleDelta,
  dampFlightPose,
  dampHeadNeckPose,
  dampLegTuck,
  flightPoseTargets,
  headNeckTargets,
  legTuckTarget,
  type FlightLoopState,
  type FlightPose,
  type HeadNeckPose,
} from './flightPose'
import { calculatePhase, propagateFullBodyWave } from './spineWave'
import {
  createHeadNeckState,
  fromSpatialTarget,
  horizonTarget,
  intelligentHeadNeckController,
  type FlightContext,
  type GazeTarget,
  type HeadNeckState,
} from './gazeController'
import {
  createTailState,
  dynamicTailController,
  type TailState,
} from './tailController'
import {
  createLegsState,
  dynamicLegController,
  type LegsState,
} from './legPhysics'
import {
  createWingsState,
  dynamicWingController,
  type WingsState,
} from './wingRefinement'

export interface WyvernFlightKinematics {
  position: { x: number; y: number; z: number } | Vector3
  velocity?: { x: number; y: number; z: number } | Vector3
  horizontalSpeed?: number
  verticalSpeed?: number
  yaw: number
  yawRate?: number
  pitch?: number
  bank?: number
  flightMode?: FlightLoopState | ModelState
  powered?: boolean
  airborne?: boolean
  elapsedTime?: number
  phaseTime?: number
}

export interface WyvernGazeTarget {
  target: { x: number; y: number; z: number } | Vector3 | null
  kind?: 'player' | 'horizon' | 'prey' | 'threat' | 'waypoint' | 'neighbor'
  weight?: number
}

export interface WyvernFlightRigOptions {
  referenceSpeed?: number
  enableSpineWave?: boolean
  enableTailPhysics?: boolean
  enableLegPhysics?: boolean
  enableGaze?: boolean
  enableJawSeal?: boolean
  enableWings?: boolean
}

export interface SkeletonBones {
  head: Object3D | null
  jaw: Object3D | null
  neck: Object3D[]
  spine: Object3D[]
  tail: Object3D[]
  leftLeg: Object3D[]
  rightLeg: Object3D[]
  leftWing: Object3D[]
  rightWing: Object3D[]
}

export class WyvernFlightRig {
  public root: Object3D | null = null
  public bones: SkeletonBones = {
    head: null,
    jaw: null,
    neck: [],
    spine: [],
    tail: [],
    leftLeg: [],
    rightLeg: [],
    leftWing: [],
    rightWing: [],
  }

  public jawClosed: ClosedJawPose | null = null
  public flightPose: FlightPose = { pitch: 0, bank: 0 }
  public headNeckPose: HeadNeckPose = { neckPitch: 0, neckYaw: 0, headPitch: 0, headYaw: 0, headRoll: 0 }
  public intelligentHeadNeck: HeadNeckState = createHeadNeckState()
  public tailState: TailState = createTailState()
  public legsState: LegsState = createLegsState()
  public wingsState: WingsState = createWingsState()
  public flightLegTuck: number = 0

  private previousPosition = new Vector3()
  private previousYaw = 0
  private options: Required<WyvernFlightRigOptions>

  constructor(root?: Object3D | null, options?: WyvernFlightRigOptions) {
    this.options = {
      referenceSpeed: options?.referenceSpeed ?? 18,
      enableSpineWave: options?.enableSpineWave ?? true,
      enableTailPhysics: options?.enableTailPhysics ?? true,
      enableLegPhysics: options?.enableLegPhysics ?? true,
      enableGaze: options?.enableGaze ?? true,
      enableJawSeal: options?.enableJawSeal ?? true,
      enableWings: options?.enableWings ?? true,
    }

    if (root) {
      this.mount(root)
    }
  }

  public mount(root: Object3D): void {
    this.root = root
    const wings = wingChains(root)
    this.bones = {
      head: findBone(root, HEAD_BONE),
      jaw: findBone(root, JAW_BONE),
      neck: findChain(root, NECK_CHAIN),
      spine: findChain(root, SPINE_CHAIN),
      tail: findChain(root, TAIL_CHAIN),
      leftLeg: findChain(root, LEFT_LEG_CHAIN),
      rightLeg: findChain(root, RIGHT_LEG_CHAIN),
      // Whichever wing hand this model carries. Asking for one hand's names
      // directly would resolve three bones out of seven on the other and still
      // look like a chain, because `findChain` drops missing names silently.
      leftWing: wings.left,
      rightWing: wings.right,
    }

    if (this.bones.jaw) {
      this.jawClosed = captureClosedJawPose(this.bones.jaw)
    }
  }

  public step(
    dt: number,
    kinematics: WyvernFlightKinematics,
    gazeInput?: WyvernGazeTarget | null,
  ): void {
    const safeDt = Math.max(dt, 1e-4)
    const posX = kinematics.position.x
    const posY = kinematics.position.y
    const posZ = kinematics.position.z

    const horizontalSpeed =
      kinematics.horizontalSpeed ??
      Math.hypot(posX - this.previousPosition.x, posZ - this.previousPosition.z) / safeDt

    const verticalSpeed =
      kinematics.verticalSpeed ??
      (posY - this.previousPosition.y) / safeDt

    const yawRate =
      kinematics.yawRate ??
      angleDelta(kinematics.yaw, this.previousYaw) / safeDt

    this.previousPosition.set(posX, posY, posZ)
    this.previousYaw = kinematics.yaw

    const airborne = kinematics.airborne ?? true
    const phaseTime = kinematics.phaseTime ?? 0
    const elapsedTime = kinematics.elapsedTime ?? phaseTime
    const flightMode = (kinematics.flightMode ?? 'cruise') as FlightLoopState

    // 1. Aerodynamic body pitch & bank target
    if (airborne) {
      const targetPose = flightPoseTargets(
        verticalSpeed,
        horizontalSpeed,
        yawRate,
        phaseTime,
        this.options.referenceSpeed,
      )
      this.flightPose = dampFlightPose(this.flightPose, targetPose, safeDt)
    } else {
      this.flightPose = dampFlightPose(this.flightPose, { pitch: 0, bank: 0 }, safeDt)
    }

    // 2. Aerodynamic head & neck base target
    if (airborne) {
      const targetHeadNeck = headNeckTargets(
        horizontalSpeed,
        verticalSpeed,
        yawRate,
        this.flightPose.pitch,
        this.flightPose.bank,
        this.options.referenceSpeed,
      )
      this.headNeckPose = dampHeadNeckPose(this.headNeckPose, targetHeadNeck, safeDt)
    } else {
      this.headNeckPose = dampHeadNeckPose(
        this.headNeckPose,
        { neckPitch: 0, neckYaw: 0, headPitch: 0, headYaw: 0, headRoll: 0 },
        safeDt,
      )
    }

    // 3. Intelligent Gaze & Neck tracking
    if (airborne && this.options.enableGaze) {
      let gazeTarget: GazeTarget | null = null
      if (gazeInput && gazeInput.target) {
        gazeTarget = fromSpatialTarget(
          { x: gazeInput.target.x, y: gazeInput.target.y, z: gazeInput.target.z },
          gazeInput.kind ?? 'player',
          gazeInput.weight ?? 0.6,
        )
      } else {
        gazeTarget = horizonTarget()
      }

      const bodyPose = {
        position: new Vector3(posX, posY, posZ),
        velocity: new Vector3(
          kinematics.velocity?.x ?? (posX - this.previousPosition.x) / safeDt,
          kinematics.velocity?.y ?? verticalSpeed,
          kinematics.velocity?.z ?? (posZ - this.previousPosition.z) / safeDt,
        ),
        yaw: kinematics.yaw,
        pitch: this.flightPose.pitch,
        bank: this.flightPose.bank,
      }

      const flightContext: FlightContext = {
        horizontalSpeed,
        verticalSpeed,
        turnRate: yawRate,
        turbulence: Math.abs(verticalSpeed) > 5 ? 0.3 : 0,
        flightMode,
        time: phaseTime,
      }

      this.intelligentHeadNeck = intelligentHeadNeckController(
        bodyPose,
        gazeTarget,
        flightContext,
        this.intelligentHeadNeck,
        safeDt,
      )

      const blendFactor = clamp(this.intelligentHeadNeck.trackingVelocity * 0.1, 0, 0.4)
      this.headNeckPose.neckPitch += this.intelligentHeadNeck.neckPitch * blendFactor
      this.headNeckPose.neckYaw += this.intelligentHeadNeck.neckYaw * blendFactor
      this.headNeckPose.headPitch += this.intelligentHeadNeck.headPitch * blendFactor
      this.headNeckPose.headYaw += this.intelligentHeadNeck.headYaw * blendFactor
      this.headNeckPose.headRoll += this.intelligentHeadNeck.headRoll * blendFactor
    }

    // 4. Leg tuck calculation
    this.flightLegTuck = dampLegTuck(
      this.flightLegTuck,
      airborne ? legTuckTarget(horizontalSpeed, this.options.referenceSpeed) : 0,
      safeDt,
    )

    // If not airborne, return after damping state
    if (!airborne) {
      return
    }

    // 5. Spine wave propagation
    if (this.options.enableSpineWave) {
      const phase = calculatePhase(phaseTime)
      propagateFullBodyWave(
        { spine: this.bones.spine, neck: this.bones.neck },
        phase,
        horizontalSpeed,
        yawRate,
      )
    }

    // 6. Apply neck & head offsets
    for (const bone of this.bones.neck) {
      applyBoneOffset(bone, this.headNeckPose.neckPitch, this.headNeckPose.neckYaw)
    }
    if (this.bones.head) {
      applyBoneOffset(
        this.bones.head,
        this.headNeckPose.headPitch,
        this.headNeckPose.headYaw,
        this.headNeckPose.headRoll,
      )
    }

    // 7. Apply leg tuck
    for (const chain of [this.bones.leftLeg, this.bones.rightLeg]) {
      if (chain.length > 0) {
        applyLegTuck(chain, this.flightLegTuck)
      }
    }

    // 8. Dynamic tail controller
    if (this.options.enableTailPhysics && this.bones.tail.length > 0) {
      this.tailState = dynamicTailController(
        this.bones.tail,
        yawRate,
        this.flightPose.bank,
        horizontalSpeed,
        flightMode,
        0.5,
        elapsedTime,
        this.tailState,
        safeDt,
      )
    }

    // 9. Dynamic leg controller
    if (this.options.enableLegPhysics && (this.bones.leftLeg.length > 0 || this.bones.rightLeg.length > 0)) {
      this.legsState = dynamicLegController(
        this.bones.leftLeg,
        this.bones.rightLeg,
        yawRate,
        horizontalSpeed,
        verticalSpeed,
        posY,
        flightMode,
        0,
        elapsedTime,
        this.legsState,
        safeDt,
      )
    }

    // 10. Dynamic wing controller
    if (this.options.enableWings && (this.bones.leftWing.length > 0 || this.bones.rightWing.length > 0)) {
      this.wingsState = dynamicWingController(
        this.bones.leftWing,
        this.bones.rightWing,
        Math.abs(verticalSpeed) > 5 ? 0.3 : 0,
        this.flightPose.pitch,
        yawRate,
        horizontalSpeed,
        flightMode,
        elapsedTime,
        this.wingsState,
        safeDt,
      )
    }

    // 11. Seal jaw for passive flight
    if (this.options.enableJawSeal) {
      this.sealJaw()
    }
  }

  public sealJaw(activeActionState?: ModelState | string | null): void {
    if (this.bones.jaw && !isMouthAction((activeActionState ?? null) as ModelState | null)) {
      sealFlightJaw(this.bones.jaw, this.jawClosed)
    }
  }

  public reset(): void {
    this.flightPose = { pitch: 0, bank: 0 }
    this.headNeckPose = { neckPitch: 0, neckYaw: 0, headPitch: 0, headYaw: 0, headRoll: 0 }
    this.intelligentHeadNeck = createHeadNeckState()
    this.tailState = createTailState()
    this.legsState = createLegsState()
    this.wingsState = createWingsState()
    this.flightLegTuck = 0
    this.previousPosition.set(0, 0, 0)
    this.previousYaw = 0
  }
}

export function createWyvernFlightRig(
  root?: Object3D | null,
  options?: WyvernFlightRigOptions,
): WyvernFlightRig {
  return new WyvernFlightRig(root, options)
}
