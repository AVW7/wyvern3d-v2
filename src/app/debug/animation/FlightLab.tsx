'use client'

import type { RefObject } from 'react'
import type { AssetId, ModelState } from '@/render/assets/manifest'
import { FlightLabCanvas } from './components/FlightLabCanvas'
import { FlightLabRigContainer } from './components/FlightLabRigContainer'
import { CAMERAS } from './constants'

export type LabCamera = 'side' | 'front' | 'top' | 'threeQuarter' | 'sanctuary' | 'battle'
export type LabTheme = 'dark' | 'light' | 'monochrome'

export interface FlightLabPoseEdits {
  bodyX: number
  bodyY: number
  bodyZ: number
  bodyPitch: number
  neckPitch: number
  neckYaw: number
  neckAlignment: number
  tailPitch: number
  tailYaw: number
  tailAlignment: number
  legTuck: number
  footTuck: number
}

export interface FlightLabProps {
  speciesId: AssetId
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
