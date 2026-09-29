import type { ModelState } from '@/render/assets/manifest'
import { AIRBORNE_STATES } from './labPresets'

export type ContractStatus = 'pass' | 'warn' | 'fail'

export interface LabTelemetry {
  timestamp: number
  airspeed: number
  pitchAngle: number
  bankAngle: number
  headOrientation: { pitch: number; yaw: number; roll: number }
  neckCurve: number
  tailExtent: number
  tailFlexAngles: number[]
  footDropL: number
  footDropR: number
  bodyAxisDeg: number
  wingSpan: number
  seamRotationRad?: number
  clipName: string
  clipTime: number
  clipDuration: number
  requestedState: string
  resolvedClip: string | undefined
  loopState: string
  activeControllers: string[]
  contractStatus: ContractStatus
  contractNotes: string[]
  poseComposer: boolean
  markers: {
    head: boolean
    tail: boolean
    pelvis: boolean
    wingL: boolean
    wingR: boolean
  }
}

export const EMPTY_TELEMETRY: LabTelemetry = {
  timestamp: 0,
  airspeed: 0,
  pitchAngle: 0,
  bankAngle: 0,
  headOrientation: { pitch: 0, yaw: 0, roll: 0 },
  neckCurve: 0,
  tailExtent: Number.NaN,
  tailFlexAngles: [],
  footDropL: Number.NaN,
  footDropR: Number.NaN,
  bodyAxisDeg: Number.NaN,
  wingSpan: Number.NaN,
  seamRotationRad: 0,
  clipName: '—',
  clipTime: 0,
  clipDuration: 0,
  requestedState: 'idle',
  resolvedClip: undefined,
  loopState: 'idle',
  activeControllers: [],
  contractStatus: 'warn',
  contractNotes: ['No live sample yet.'],
  poseComposer: false,
  markers: { head: false, tail: false, pelvis: false, wingL: false, wingR: false },
}

/**
 * Calculates the maximum loop-seam discrepancy (in radians / rig units)
 * across all tracks in an AnimationClip between the first key and last key.
 */
export function calculateClipLoopSeam(clip: {
  tracks: { name: string; times: ArrayLike<number>; values: ArrayLike<number> }[]
}): number {
  let maxSeam = 0
  for (const track of clip.tracks) {
    if (track.name.endsWith('.quaternion') && track.values.length >= 8) {
      const q0x = track.values[0]!
      const q0y = track.values[1]!
      const q0z = track.values[2]!
      const q0w = track.values[3]!
      const len = track.values.length
      const q1x = track.values[len - 4]!
      const q1y = track.values[len - 3]!
      const q1z = track.values[len - 2]!
      const q1w = track.values[len - 1]!
      const dot = Math.min(1, Math.abs(q0x * q1x + q0y * q1y + q0z * q1z + q0w * q1w))
      const angle = 2 * Math.acos(dot)
      if (angle > maxSeam) maxSeam = angle
    } else if (track.name.endsWith('.position') && track.values.length >= 6) {
      const p0x = track.values[0]!
      const p0y = track.values[1]!
      const p0z = track.values[2]!
      const len = track.values.length
      const p1x = track.values[len - 3]!
      const p1y = track.values[len - 2]!
      const p1z = track.values[len - 1]!
      const dist = Math.hypot(p1x - p0x, p1y - p0y, p1z - p0z)
      if (dist > maxSeam) maxSeam = dist
    }
  }
  return maxSeam
}

export interface ContractInput {
  requestedState: ModelState
  resolvedClip: string | undefined
  clipName: string
  markers: LabTelemetry['markers']
  bodyAxisDeg: number
  footDropL: number
  wingSpan: number
  poseComposer: boolean
  seamRotationRad?: number
}

export function evaluateLabContract(input: ContractInput): { status: ContractStatus; notes: string[] } {
  const notes: string[] = []
  const airborne = AIRBORNE_STATES.has(input.requestedState)

  if (!input.markers.head || !input.markers.pelvis) {
    notes.push('Head or pelvis marker is missing — bone aliases did not resolve.')
  }
  if (!input.markers.tail) notes.push('Tail marker is missing.')
  if (!input.markers.wingL || !input.markers.wingR) notes.push('A wing-tip marker is missing.')

  if (input.clipName !== '—' && input.resolvedClip && input.clipName !== input.resolvedClip) {
    notes.push(`Mixer is playing '${input.clipName}', not mapped clip '${input.resolvedClip}'.`)
  }

  if (!Number.isNaN(input.bodyAxisDeg) && Math.abs(input.bodyAxisDeg) > 55) {
    notes.push(`Body axis ${input.bodyAxisDeg.toFixed(1)}° is outside the review envelope (±55°).`)
  }

  if (airborne && !Number.isNaN(input.footDropL) && input.footDropL < 0.4) {
    notes.push(`Airborne foot drop ${input.footDropL.toFixed(2)} is planted — legs may still be grounded.`)
  }

  if (!airborne && !Number.isNaN(input.wingSpan) && input.wingSpan > 18) {
    notes.push(`Grounded wing span ${input.wingSpan.toFixed(1)} is cruise-open — membrane may still be a sheet.`)
  }

  if (input.seamRotationRad !== undefined && input.seamRotationRad > 0.05) {
    notes.push(`Loop seam delta ${input.seamRotationRad.toFixed(4)} rad exceeds review envelope (0.050 rad).`)
  }

  if (input.poseComposer) {
    notes.push('Pose composer is on — this is an edit, not an authored-clip review.')
  }

  const missingCore = !input.markers.head || !input.markers.pelvis
  if (missingCore) return { status: 'fail', notes }
  if (notes.length > 0) return { status: 'warn', notes }
  return { status: 'pass', notes: ['Live markers resolved; clip and silhouette are inside review bounds.'] }
}

export function telemetryChanged(prev: LabTelemetry, next: LabTelemetry): boolean {
  return (
    prev.airspeed !== next.airspeed ||
    prev.pitchAngle !== next.pitchAngle ||
    prev.bankAngle !== next.bankAngle ||
    prev.clipName !== next.clipName ||
    prev.requestedState !== next.requestedState ||
    prev.loopState !== next.loopState ||
    prev.contractStatus !== next.contractStatus ||
    prev.poseComposer !== next.poseComposer ||
    prev.clipTime.toFixed(2) !== next.clipTime.toFixed(2) ||
    prev.bodyAxisDeg.toFixed(1) !== next.bodyAxisDeg.toFixed(1) ||
    prev.footDropL.toFixed(2) !== next.footDropL.toFixed(2) ||
    prev.wingSpan.toFixed(1) !== next.wingSpan.toFixed(1) ||
    prev.seamRotationRad !== next.seamRotationRad ||
    prev.activeControllers.join() !== next.activeControllers.join()
  )
}

export function formatPoseExport(telemetry: LabTelemetry): string {
  const pitchRad = (telemetry.pitchAngle * Math.PI) / 180
  const bankRad = (telemetry.bankAngle * Math.PI) / 180
  return `import type { FlightPose, HeadNeckPose } from '@/render/flightPose'

// Sampled Flight Lab Pose — measured directly from live rig
export const SAMPLED_FLIGHT_POSE: FlightPose = {
  pitch: ${pitchRad.toFixed(4)},
  bank: ${bankRad.toFixed(4)},
}

export const SAMPLED_HEAD_NECK_POSE: HeadNeckPose = {
  neckPitch: ${telemetry.neckCurve.toFixed(4)},
  neckYaw: 0,
  headPitch: ${telemetry.headOrientation.pitch.toFixed(4)},
  headYaw: ${telemetry.headOrientation.yaw.toFixed(4)},
  headRoll: ${telemetry.headOrientation.roll.toFixed(4)},
}

export const SAMPLED_TELEMETRY_SNAPSHOT = {
  requestedState: '${telemetry.requestedState}',
  clipName: '${telemetry.clipName}',
  loopState: '${telemetry.loopState}',
  airspeed: ${telemetry.airspeed.toFixed(1)},
  pitchAngle: ${telemetry.pitchAngle.toFixed(2)},
  bankAngle: ${telemetry.bankAngle.toFixed(2)},
  bodyAxisDeg: ${Number.isNaN(telemetry.bodyAxisDeg) ? 'null' : telemetry.bodyAxisDeg.toFixed(2)},
  wingSpan: ${Number.isNaN(telemetry.wingSpan) ? 'null' : telemetry.wingSpan.toFixed(2)},
  footDropL: ${Number.isNaN(telemetry.footDropL) ? 'null' : telemetry.footDropL.toFixed(3)},
  footDropR: ${Number.isNaN(telemetry.footDropR) ? 'null' : telemetry.footDropR.toFixed(3)},
  tailExtent: ${Number.isNaN(telemetry.tailExtent) ? 'null' : telemetry.tailExtent.toFixed(3)},
  seamRotationRad: ${(telemetry.seamRotationRad ?? 0).toFixed(4)},
  contractStatus: '${telemetry.contractStatus}',
  contractNotes: ${JSON.stringify(telemetry.contractNotes)},
} as const
`
}

export function formatReadout(telemetry: LabTelemetry): string {
  const ratioNote = telemetry.airspeed.toFixed(1)
  const axis = Number.isNaN(telemetry.bodyAxisDeg)
    ? '—'
    : `${telemetry.bodyAxisDeg.toFixed(1)}° (${Math.abs(telemetry.bodyAxisDeg) <= 55 ? 'envelope OK' : 'OUTSIDE ±55°'})`
  const footL = Number.isNaN(telemetry.footDropL) ? '—' : `${telemetry.footDropL.toFixed(2)} m`
  const footR = Number.isNaN(telemetry.footDropR) ? '—' : `${telemetry.footDropR.toFixed(2)} m`
  const span = Number.isNaN(telemetry.wingSpan) ? '—' : `${telemetry.wingSpan.toFixed(2)} m`
  const seam = telemetry.seamRotationRad !== undefined ? `${telemetry.seamRotationRad.toFixed(4)} rad` : '—'
  const phase =
    telemetry.clipDuration > 0
      ? ((telemetry.clipTime % telemetry.clipDuration) / telemetry.clipDuration).toFixed(3)
      : '—'
  return [
    `requested   ${telemetry.requestedState}`,
    `clip        ${telemetry.clipName}${telemetry.resolvedClip && telemetry.resolvedClip !== telemetry.clipName ? `  (mapped ${telemetry.resolvedClip})` : ''}`,
    `time        ${telemetry.clipTime.toFixed(2)}s / ${telemetry.clipDuration.toFixed(2)}s  (phase ${phase})`,
    `speed       ${ratioNote} u/s`,
    `pitch/bank  ${telemetry.pitchAngle.toFixed(1)}° / ${telemetry.bankAngle.toFixed(1)}°`,
    `neck/head   neck ${telemetry.neckCurve.toFixed(3)}  head ${telemetry.headOrientation.pitch.toFixed(3)}/${telemetry.headOrientation.yaw.toFixed(3)}`,
    `body axis   ${axis}`,
    `foot drop   L ${footL}  R ${footR}`,
    `wing span   ${span}`,
    `seam delta  ${seam}`,
    `controllers ${telemetry.activeControllers.join(', ') || 'none'}`,
    `contract    ${telemetry.contractStatus.toUpperCase()}${telemetry.contractNotes[0] ? ` — ${telemetry.contractNotes[0]}` : ''}`,
    `pose lab    ${telemetry.poseComposer ? 'ON' : 'off (authored clip plus selected runtime layers only)'}`,
  ].join('\n')
}
