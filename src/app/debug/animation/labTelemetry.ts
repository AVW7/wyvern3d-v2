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

export interface ContractInput {
  requestedState: ModelState
  resolvedClip: string | undefined
  clipName: string
  markers: LabTelemetry['markers']
  bodyAxisDeg: number
  footDropL: number
  wingSpan: number
  poseComposer: boolean
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
    prev.activeControllers.join() !== next.activeControllers.join()
  )
}

export function formatPoseExport(telemetry: LabTelemetry): string {
  return `// Flight Lab sample — measured, not slider fiction
export const LAB_SAMPLED_POSE = {
  requestedState: '${telemetry.requestedState}',
  clip: '${telemetry.clipName}',
  loopState: '${telemetry.loopState}',
  speed: ${telemetry.airspeed.toFixed(1)},
  pitchRad: ${((telemetry.pitchAngle * Math.PI) / 180).toFixed(4)},
  bankRad: ${((telemetry.bankAngle * Math.PI) / 180).toFixed(4)},
  headNeck: {
    pitch: ${telemetry.headOrientation.pitch.toFixed(4)},
    yaw: ${telemetry.headOrientation.yaw.toFixed(4)},
    roll: ${telemetry.headOrientation.roll.toFixed(4)},
    neckPitch: ${telemetry.neckCurve.toFixed(4)},
  },
  tailExtent: ${Number.isNaN(telemetry.tailExtent) ? 'null' : telemetry.tailExtent.toFixed(3)},
  footDrop: {
    L: ${Number.isNaN(telemetry.footDropL) ? 'null' : telemetry.footDropL.toFixed(3)},
    R: ${Number.isNaN(telemetry.footDropR) ? 'null' : telemetry.footDropR.toFixed(3)},
  },
  bodyAxisDeg: ${Number.isNaN(telemetry.bodyAxisDeg) ? 'null' : telemetry.bodyAxisDeg.toFixed(2)},
  wingSpan: ${Number.isNaN(telemetry.wingSpan) ? 'null' : telemetry.wingSpan.toFixed(2)},
  contract: '${telemetry.contractStatus}',
  notes: ${JSON.stringify(telemetry.contractNotes)},
}
`
}

export function formatReadout(telemetry: LabTelemetry): string {
  const ratioNote = telemetry.airspeed.toFixed(1)
  const axis = Number.isNaN(telemetry.bodyAxisDeg) ? '—' : `${telemetry.bodyAxisDeg.toFixed(1)}deg nose-up`
  const footL = Number.isNaN(telemetry.footDropL) ? '—' : telemetry.footDropL.toFixed(2)
  const footR = Number.isNaN(telemetry.footDropR) ? '—' : telemetry.footDropR.toFixed(2)
  const span = Number.isNaN(telemetry.wingSpan) ? '—' : telemetry.wingSpan.toFixed(1)
  const phase =
    telemetry.clipDuration > 0
      ? ((telemetry.clipTime % telemetry.clipDuration) / telemetry.clipDuration).toFixed(3)
      : '—'
  return [
    `requested   ${telemetry.requestedState}`,
    `clip        ${telemetry.clipName}${telemetry.resolvedClip && telemetry.resolvedClip !== telemetry.clipName ? `  (mapped ${telemetry.resolvedClip})` : ''}`,
    `time        ${telemetry.clipTime.toFixed(2)}s / ${telemetry.clipDuration.toFixed(2)}s  (phase ${phase})`,
    `speed       ${ratioNote} u/s`,
    `pitch/bank  ${telemetry.pitchAngle.toFixed(1)} / ${telemetry.bankAngle.toFixed(1)} deg`,
    `neck/head   neck ${telemetry.neckCurve.toFixed(3)}  head ${telemetry.headOrientation.pitch.toFixed(3)}/${telemetry.headOrientation.yaw.toFixed(3)}`,
    `body axis   ${axis}`,
    `foot drop   L ${footL}  R ${footR}`,
    `wing span   ${span}`,
    `controllers ${telemetry.activeControllers.join(', ') || 'none'}`,
    `contract    ${telemetry.contractStatus}${telemetry.contractNotes[0] ? ` — ${telemetry.contractNotes[0]}` : ''}`,
    `pose lab    ${telemetry.poseComposer ? 'ON' : 'off (authored clip plus selected runtime layers only)'}`,
  ].join('\n')
}
