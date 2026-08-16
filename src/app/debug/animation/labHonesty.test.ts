import { describe, expect, it } from 'vitest'
import { getAsset } from '@/render/assets/manifest'
import {
  extraPitchFromSlider,
  gazeBlendFromWeight,
  scaleLegTuck,
  scaleNeckStream,
  tailAggressionFromWave,
  tailSpeedForStiffness,
  verticalSpeedFromPitch,
  wingTurbulenceFromSlider,
  applySpeedPreset,
  DEFAULT_SPEED_DYNAMICS,
} from './labDynamics'
import {
  annotatePresets,
  flightLabAltitude,
  parseLabSearch,
  resolveClipName,
  resolveRequestedState,
  serializeLabSearch,
  speciesIndexFor,
} from './labPresets'
import { composerWingPitch } from './labComposer'
import {
  evaluateLabContract,
  formatPoseExport,
  telemetryChanged,
  EMPTY_TELEMETRY,
} from './labTelemetry'

describe('labPresets', () => {
  it('resolves aliases instead of inventing missing states', () => {
    expect(resolveRequestedState('landing')).toBe('land')
    expect(resolveRequestedState('perched')).toBe('perch')
    expect(resolveRequestedState('not-a-clip')).toBeUndefined()
  })

  it('reads clips from the selected asset, not a hard-coded species', () => {
    expect(resolveClipName('wyvern.gothic', 'sleep')).toBe('rest')
    expect(resolveClipName('wyvern.gothic', 'cruise')).toBe('cruise')
    expect(resolveClipName('wyvern.gothic', 'attack')).toBe('attack')
    const gothic = getAsset('wyvern.gothic')
    expect(gothic).toBeDefined()
    const annotated = annotatePresets('wyvern.gothic')
    const sleep = annotated.find((preset) => preset.id === 'sleep')
    expect(sleep?.clip).toBe('rest')
    expect(sleep?.shared).toBeGreaterThan(1)
  })

  it('drops stale deep-link values instead of remapping them', () => {
    const parsed = parseLabSearch({
      species: 'wyvern.notreal',
      state: 'tpose',
      camera: 'iso',
      theme: 'neon',
      speed: 'nope',
      procedural: 'maybe',
    })
    expect(parsed).toEqual({})
  })

  it('parses and serializes a shareable lab view', () => {
    const parsed = parseLabSearch({
      species: 'wyvern.gothic',
      state: 'cruise',
      procedural: '1',
      auto: 'true',
      speed: '22',
      camera: 'front',
      theme: 'light',
    })
    expect(parsed).toEqual({
      speciesIndex: speciesIndexFor('wyvern.gothic'),
      state: 'cruise',
      procedural: true,
      auto: true,
      speed: 22,
      camera: 'front',
      theme: 'light',
    })
    expect(
      serializeLabSearch({
        speciesIndex: speciesIndexFor('wyvern.gothic'),
        state: 'cruise',
        procedural: true,
        auto: true,
        speed: 22,
        camera: 'front',
        theme: 'light',
      }),
    ).toBe('?species=wyvern.gothic&state=cruise&procedural=1&auto=1&speed=22&camera=front&theme=light')
  })

  it('lifts only airborne states off the floor', () => {
    expect(flightLabAltitude('cruise')).toBe(4)
    expect(flightLabAltitude('idle')).toBe(0)
    expect(flightLabAltitude('walk')).toBe(0)
  })
})

describe('labDynamics', () => {
  it('turns the pitch slider into a climb/sink the director can read', () => {
    expect(verticalSpeedFromPitch(18, 0)).toBeCloseTo(0)
    expect(verticalSpeedFromPitch(18, -25)).toBeLessThan(0)
    expect(verticalSpeedFromPitch(18, 20)).toBeGreaterThan(0)
    expect(extraPitchFromSlider(45)).toBeCloseTo(Math.PI / 4)
  })

  it('scales isolation-adjacent sliders instead of ignoring them', () => {
    expect(gazeBlendFromWeight(0, 10)).toBe(0)
    expect(gazeBlendFromWeight(1, 10)).toBeCloseTo(0.4)
    expect(scaleNeckStream(-0.2, 0)).toBeCloseTo(-0.07)
    expect(scaleNeckStream(-0.2, 1)).toBeCloseTo(-0.2)
    expect(tailSpeedForStiffness(18, 2)).toBe(36)
    expect(tailAggressionFromWave(0.3)).toBe(2)
    expect(scaleLegTuck(0.4, 0)).toBe(0)
    expect(wingTurbulenceFromSlider(0.3, 6)).toBeCloseTo(0.6)
  })

  it('applies named speed presets onto the live dynamics object', () => {
    const next = applySpeedPreset(DEFAULT_SPEED_DYNAMICS, 'dive')
    expect(next.airspeed).toBe(50)
    expect(next.pitchAngle).toBe(-25)
    expect(next.legTuckWeight).toBe(1.2)
  })
})

describe('labTelemetry', () => {
  it('fails when core markers are missing', () => {
    const result = evaluateLabContract({
      requestedState: 'cruise',
      resolvedClip: 'cruise',
      clipName: 'cruise',
      markers: { head: false, tail: true, pelvis: false, wingL: true, wingR: true },
      bodyAxisDeg: 0,
      footDropL: 2,
      wingSpan: 10,
      poseComposer: false,
    })
    expect(result.status).toBe('fail')
  })

  it('warns on a grounded wing that is still cruise-open', () => {
    const result = evaluateLabContract({
      requestedState: 'walk',
      resolvedClip: 'walk',
      clipName: 'walk',
      markers: { head: true, tail: true, pelvis: true, wingL: true, wingR: true },
      bodyAxisDeg: 8,
      footDropL: 2.2,
      wingSpan: 22,
      poseComposer: false,
    })
    expect(result.status).toBe('warn')
    expect(result.notes.some((note) => note.includes('Grounded wing span'))).toBe(true)
  })

  it('never reports a green contract from slider fiction', () => {
    const result = evaluateLabContract({
      requestedState: 'cruise',
      resolvedClip: 'cruise',
      clipName: 'cruise',
      markers: { head: true, tail: true, pelvis: true, wingL: true, wingR: true },
      bodyAxisDeg: 4,
      footDropL: 2.4,
      wingSpan: 12,
      poseComposer: false,
    })
    expect(result.status).toBe('pass')
    expect(formatPoseExport({ ...EMPTY_TELEMETRY, airspeed: 18, clipName: 'cruise' })).toContain(
      "clip: 'cruise'",
    )
    expect(
      telemetryChanged(EMPTY_TELEMETRY, { ...EMPTY_TELEMETRY, airspeed: 22 }),
    ).toBe(true)
  })
})

describe('labComposer', () => {
  it('folds on shoulder pitch (X), not a Z sweep', () => {
    expect(composerWingPitch(1, 0, 0)).toBeCloseTo(-0.9)
    expect(composerWingPitch(0, 0.2, 0.1)).toBeCloseTo(0.3)
  })
})
