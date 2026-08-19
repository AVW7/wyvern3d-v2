'use client'

import type { RefObject } from 'react'
import type { AssetId, ModelState } from '@/render/assets/manifest'
import { FlightLabCanvas } from './components/FlightLabCanvas'
import { FlightLabRigContainer } from './components/FlightLabRigContainer'
import { CAMERAS } from './constants'
import type { ControllerIsolationState, SpeedDynamicsState } from './components/AnimationControls'
import type { LabTelemetry } from './labTelemetry'
import type { PropBase } from './props/PropBase'
import type { PropManager } from './systems/PropManager'

export type LabCamera = 'side' | 'front' | 'top' | 'threeQuarter' | 'sanctuary' | 'battle'
export type LabTheme = 'dark' | 'light' | 'monochrome'

export interface FlightLabPoseEdits {
  bodyX: number
  bodyY: number
  bodyZ: number
  bodyPitch: number
  bodyYaw: number
  bodyRoll: number
  neckPitch: number
  neckYaw: number
  neckAlignment: number
  tailPitch: number
  tailYaw: number
  tailAlignment: number
  legTuck: number
  footTuck: number
  leftWingPitch: number
  leftWingYaw: number
  leftWingRoll: number
  rightWingPitch: number
  rightWingYaw: number
  rightWingRoll: number
  wingFold: number
  wingHeight: number
  membraneBillow: number
  leftLegPitch: number
  leftLegYaw: number
  rightLegPitch: number
  rightLegYaw: number
}

export interface FlightLabProps {
  speciesId: AssetId
  /** Second asset drawn beside the rig for A/B against v1; null for one model. */
  compareId?: AssetId | null
  requestedState: ModelState
  auto: boolean
  scale: number
  horizontalSpeed: number
  verticalSpeed: number
  yawRate: number
  referenceSpeed: number
  powered: boolean
  boosting: boolean
  searching: boolean
  procedural: boolean
  frozen: boolean
  scrub: number | null
  overlays: boolean
  camera: LabCamera
  theme?: LabTheme
  poseComposer: boolean
  poseEdits: FlightLabPoseEdits
  fireBreath?: boolean
  readout: RefObject<HTMLPreElement | null>
  onActiveState: (state: ModelState) => void
  onTelemetry?: (sample: LabTelemetry) => void
  controllerIsolation: ControllerIsolationState
  speedDynamics: SpeedDynamicsState
  transitionDuration: number
  propManager: PropManager
  propsList: PropBase[]
  centerTrigger?: number
  zoomFitTrigger?: number
  zoomInTrigger?: number
  zoomOutTrigger?: number
  resetCamTrigger?: number
}

export { CAMERAS }

export function FlightLab(props: FlightLabProps) {
  return (
    <FlightLabCanvas camera={props.camera} theme={props.theme}>
      <FlightLabRigContainer {...props} />
    </FlightLabCanvas>
  )
}
