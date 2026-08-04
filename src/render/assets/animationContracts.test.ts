/**
 * The animation quality gate.
 *
 * `docs/FLIGHT_ANIMATION_DEVELOPMENT.md` states each locomotion mode's pose
 * contract in prose — "cruise keeps a long, nearly horizontal body line", "hover
 * puts the centre of mass under the wing roots with the legs hanging". Prose
 * cannot fail a build, which is why a cruise loop with a 27-degree stroke, a
 * 22-degree body axis and its two wings 38 units apart shipped and had to be
 * found by eye.
 *
 * `validation/wyvern-animations/wyvern-clip-contracts.json` restates those
 * contracts as thresholds against measured channels, every one naming the defect
 * it exists to catch. This file asserts them.
 *
 * This suite was `describe.skip` for the whole of the rig rebuild, with a comment
 * saying placeholders were in use — but `manifest.ts` had been wired to the real
 * `wyvern.glb` in the meantime, and the signature file it read still described
 * the 78 vendor clips of the model that was replaced. So the gate was dark while
 * seven of sixteen clips shipped a dislocated wing. Do not skip it again: if a
 * clip is not ready, leave it out of `clips` in the contract with a reason.
 *
 * Blender is needed only to regenerate the signatures
 * (`pnpm assets:wyvern-clips --measure`). The gate itself is pure data and runs
 * in `pnpm test` on every change.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ASSETS, type ClipSpec, type ModelState } from './manifest'

/** Union type for clip spec arrays or single specs */
type StateClips = ClipSpec | ClipSpec[]

interface Signature {
  action: string
  frames: number
  duration_s: number
  fps: number
  channels: Record<string, { min: number; max: number; range: number }>
  cycle: { beats: number; cadence_hz: number; stroke_deg: number }
  gait_mirror: {
    error: number
    foot: { error: number; shift: number }
    knuckle: { error: number; shift: number }
  }
  head_path: number
  tail_tip_path: number
  loop_seam_max: number
  lowest_vertex_up: number | null
  plant_offset_units: number | null
  moving_bones: Record<string, number>
  moving_bone_count: number
  distal_wing_bones: string[]
  distal_wing_bone_count: number
}

interface Rule {
  channel: string
  min?: number
  max?: number
  because: string
}

interface Mode {
  summary: string
  clips: string[]
  rules: Rule[]
}

const load = <T>(relative: string): T =>
  JSON.parse(readFileSync(new URL(relative, import.meta.url), 'utf8')) as T

const signatures = load<{
  schema: string
  chain_seams: Record<string, number>
  clips: Record<string, Signature>
}>('../../../validation/wyvern-animations/wyvern-clip-signatures.json')

const contracts = load<{
  schema: string
  modes: Record<string, Mode>
  cadence_order: { faster_than: [string, string][] }
  chain_seams: { max: number; because: string }
  gait_couplets: {
    clip: string
    foot_shift: number
    knuckle_shift: number
    tolerance: number
  }
}>('../../../validation/wyvern-animations/wyvern-clip-contracts.json')

/** Resolve a dotted channel path such as `channels.wing_symmetry_error.max`. */
function channel(signature: Signature, path: string): number | null {
  let node: unknown = signature
  for (const key of path.split('.')) {
    if (node === null || typeof node !== 'object') return null
    node = (node as Record<string, unknown>)[key]
  }
  return typeof node === 'number' ? node : null
}

/**
 * `clip · channel · actual · required` — the whole point of the numeric gate is
 * that a failure says which number moved and how far, so the fix is obvious
 * without opening Blender.
 */
function violations(clip: string, signature: Signature, rules: Rule[]): string[] {
  return rules.flatMap((rule) => {
    const actual = channel(signature, rule.channel)
    if (actual === null) {
      return [`${clip} · ${rule.channel} · missing from the signature`]
    }
    const bounds: string[] = []
    if (rule.min !== undefined && actual < rule.min) bounds.push(`>= ${rule.min}`)
    if (rule.max !== undefined && actual > rule.max) bounds.push(`<= ${rule.max}`)
    if (bounds.length === 0) return []
    return [`${clip} · ${rule.channel} · ${actual} · needs ${bounds.join(' and ')} — ${rule.because}`]
  })
}

const asSpecs = (clips: StateClips): ClipSpec[] => (Array.isArray(clips) ? clips : [clips])

/**
 * Every wyvern clip the manifest can ask a mixer to play, with where it came
 * from. The asset's own clip map is carried along rather than looked up again
 * by id, because resolving a `next` means reading a sibling state off the same
 * asset.
 */
const wired = Object.entries(ASSETS)
  .filter(([assetId]) => assetId.startsWith('wyvern.'))
  .flatMap(([assetId, asset]) =>
    Object.entries(asset.animations ?? {}).flatMap(([state, clips]) =>
      asSpecs(clips as StateClips).map((spec) => ({
        assetId,
        state: state as ModelState,
        spec,
        siblings: (asset.animations ?? {}) as Partial<Record<ModelState, StateClips>>,
      })),
    ),
  )

describe('measured clip signatures', () => {
  it('is the schema the gate was written against', () => {
    expect(signatures.schema).toBe('wyvern_clip_signature.v2')
    expect(contracts.schema).toBe('wyvern_clip_contract.v2')
  })

  it('describes the clean rig, not the vendor model it replaced', () => {
    // The stale signature file was the reason the old gate could not have
    // caught anything even had it run: it listed `SKM_DaenerysDragon|…` clips
    // that no longer exist in the GLB the manifest loads.
    const names = Object.keys(signatures.clips)
    expect(names).toContain('cruise')
    expect(names.filter((name) => name.includes('DaenerysDragon'))).toEqual([])
  })
})

describe('mode contracts', () => {
  for (const [mode, contract] of Object.entries(contracts.modes)) {
    describe(`${mode} — ${contract.summary}`, () => {
      for (const clip of contract.clips) {
        it(clip, () => {
          const signature = signatures.clips[clip]
          if (!signature) throw new Error(`${clip} · absent from wyvern-clip-signatures.json`)
          expect(violations(clip, signature, contract.rules)).toEqual([])
        })
      }
    })
  }
})

describe('flight modes are distinguishable', () => {
  /**
   * Absolute cadence numbers are a tuning choice; the *ordering* is the design.
   * A speed loop slower than cruise is not a slightly mistuned clip, it is the
   * wrong clip — and that is what shipped, with cruise at 0.49 Hz and speed at
   * 3.33 Hz against specs asking for very nearly the reverse.
   */
  for (const [faster, slower] of contracts.cadence_order.faster_than) {
    it(`${faster} beats faster than ${slower}`, () => {
      const a = signatures.clips[faster]?.cycle.cadence_hz
      const b = signatures.clips[slower]?.cycle.cadence_hz
      expect(a, `${faster} missing from the signatures`).toBeDefined()
      expect(b, `${slower} missing from the signatures`).toBeDefined()
      expect(
        `${faster} ${a}Hz vs ${slower} ${b}Hz`,
        'cadence ordering',
      ).toBe(`${faster} ${a}Hz vs ${slower} ${b}Hz`)
      expect(a!).toBeGreaterThan(b!)
    })
  }
})

describe('the wyvern walks on its wings', () => {
  /**
   * This creature is a quadruped: the wings are forelimbs and carry the
   * forequarters on the ground. v1 plants the wing knuckles in `Battle_Walk`
   * *and* in `Battle_Stand`, and an earlier pass here authored the grounded
   * clips as a biped with the wings folded over the back — which reads as a
   * bird and is the most visible thing about the model at ground level.
   *
   * The couplet offset is the design, not an accident of tuning: each hind foot
   * plants with the OPPOSITE wing knuckle, and because the couplets are 0.36 of
   * a cycle apart rather than 0.5, the feet and the knuckles mirror at opposite
   * shifts. Asserting both is what distinguishes a real gait from four limbs
   * oscillating in step.
   */
  const { clip, foot_shift, knuckle_shift, tolerance } = contracts.gait_couplets

  it(`${clip} plants its hind feet with the opposite wing knuckle`, () => {
    const gait = signatures.clips[clip]?.gait_mirror
    if (!gait) throw new Error(`${clip} · absent from wyvern-clip-signatures.json`)
    expect(
      `foot ${gait.foot.shift} knuckle ${gait.knuckle.shift}`,
      'diagonal couplets mirror at opposite shifts',
    ).toBeTruthy()
    expect(Math.abs(gait.foot.shift - foot_shift)).toBeLessThanOrEqual(tolerance)
    expect(Math.abs(gait.knuckle.shift - knuckle_shift)).toBeLessThanOrEqual(tolerance)
  })

  it('the fore and hind pairs are genuinely out of phase with each other', () => {
    const gait = signatures.clips[clip]!.gait_mirror
    // If both pairs mirrored at the same shift the animal would be hopping, not
    // walking. Opposite shifts about 0.5 is what a diagonal couplet looks like.
    expect(Math.abs(gait.foot.shift - gait.knuckle.shift)).toBeGreaterThan(0.15)
  })
})

describe('manifest and signatures agree', () => {
  /**
   * A clip name that exists in neither GLB binds no tracks and plays nothing.
   * three.js does not throw for it, so without this the failure mode is a
   * wyvern frozen in its rest pose in one state and nowhere else.
   */
  it('every wyvern clip the manifest can play was measured', () => {
    const unmeasured = wired
      .filter(({ spec }) => !(spec.clip in signatures.clips))
      .map(({ assetId, state, spec }) => `${assetId} · ${state} · ${spec.clip}`)
    expect(unmeasured).toEqual([])
  })

  it('plays aerial attacks once without chaining them into a flight loop', () => {
    const clips = ASSETS['wyvern.emberback']!.animations!
    const attackAir = clips.attackAir as ClipSpec
    expect(attackAir.loop).toBe(false)
    expect(attackAir.next).toBeUndefined()
    expect(attackAir.yOffset).toBe(0)
  })

  /**
   * `GameModel` preserves *normalized* playback time across a crossfade inside a
   * phase group, so two loops only stay in step if a normalized phase means the
   * same thing in both — equal duration and equal wingbeat count. Cadence is
   * exactly what separates hover from cruise, so this rule is also the reason
   * hover is not in the flight group.
   */
  it('clips sharing a phaseGroup share duration and cadence', () => {
    const groups = new Map<string, Map<string, ClipSpec>>()
    for (const { spec } of wired) {
      if (!spec.phaseGroup) continue
      const group = groups.get(spec.phaseGroup) ?? new Map()
      group.set(spec.clip, spec)
      groups.set(spec.phaseGroup, group)
    }

    const mismatched: string[] = []
    for (const [name, group] of groups) {
      const members = [...group.keys()].map((clip) => ({
        clip,
        signature: signatures.clips[clip],
      }))
      const durations = new Set(members.map((m) => m.signature?.duration_s))
      const beats = new Set(members.map((m) => m.signature?.cycle?.beats))
      if (durations.size > 1 || beats.size > 1) {
        mismatched.push(
          `phaseGroup ${name} · ${members
            .map(
              (m) =>
                `${m.clip} ${m.signature?.duration_s}s/${m.signature?.cycle?.beats ?? '?'} beats`,
            )
            .join(' vs ')}`,
        )
      }
    }
    expect(mismatched).toEqual([])
  })

  /**
   * A looping `ClipSpec` on a clip that does not return to its opening pose
   * snaps once per cycle. `loop` defaults to true, so this catches the omission
   * rather than an explicit choice.
   */
  it('every looping state maps to a clip that actually loops', () => {
    const snapping = wired
      .filter(({ spec }) => spec.loop !== false)
      .flatMap(({ assetId, state, spec }) => {
        const seam = signatures.clips[spec.clip]?.loop_seam_max
        if (seam === undefined || seam <= 0.05) return []
        return [`${assetId} · ${state} · ${spec.clip} · loop seam ${seam}`]
      })
    expect(snapping).toEqual([])
  })

  /**
   * A one-shot with `next` hands straight over to another clip. If it does not
   * end where that clip begins, the handoff pops — every launch, every landing.
   */
  it('chained one-shots end on the pose they hand off to', () => {
    const chained = wired.filter(({ spec }) => spec.next)
    expect(chained.length).toBeGreaterThan(0)

    const popping = chained.flatMap(({ assetId, state, spec, siblings }) => {
      const next = siblings[spec.next as ModelState]
      if (!next) return [`${assetId} · ${state} · ${spec.next} · no such state`]
      const key = `${spec.clip}->${asSpecs(next)[0]!.clip}`
      const seam = signatures.chain_seams[key]
      if (seam === undefined) return [`${assetId} · ${state} · ${key} · not measured`]
      if (seam <= contracts.chain_seams.max) return []
      return [`${assetId} · ${state} · ${key} · seam ${seam} > ${contracts.chain_seams.max}`]
    })
    expect(popping).toEqual([])
  })

  /**
   * `yOffset` plants a ground clip on its lowest skinned vertex. It is measured,
   * so it goes stale the moment a clip is re-authored — and the manifest's own
   * note warns these are "live lifts of 2.26 m and 7.95 m, so a bad measurement
   * is visible rather than harmless".
   */
  it('ground-loop yOffsets match the measured plant depth', () => {
    const drifted = (['idle', 'walk', 'rest'] as const).flatMap((state) => {
      const spec = asSpecs(ASSETS['wyvern.emberback']!.animations![state] as StateClips)[0]!
      const measured = signatures.clips[spec.clip]?.plant_offset_units
      if (measured === null || measured === undefined) return []
      // Below the origin the clip must be lifted; above it, 0 is correct — the
      // model simply stands a few centimetres clear rather than being sunk.
      const expected = Math.max(0, measured)
      if (Math.abs((spec.yOffset ?? 0) - expected) <= 8) return []
      return [`${state} · ${spec.clip} · yOffset ${spec.yOffset} · measured ${expected}`]
    })
    expect(drifted).toEqual([])
  })
})
