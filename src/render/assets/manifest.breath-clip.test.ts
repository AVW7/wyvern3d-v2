import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  BREATH_VFX_LEAD_SECONDS,
  BREATH_VFX_TOTAL_SECONDS,
} from '@/render/vfx/breathVfxMath'
import { ASSETS } from './manifest'
import type { ClipSpec } from './manifest'

/**
 * The `breath` clip, measured in the GLB gameplay actually plays.
 *
 * Review here is numeric rather than visual, for the reason
 * `docs/FLIGHT_ANIMATION_DEVELOPMENT.md` gives: a near-black dragon hides pose
 * in a render, and every defect this locks shipped past a looked-at model.
 * Each expectation below is one of them, and the numbers are the ones
 * `scripts/author-wyvern-breath-blender.py` authors:
 *
 * 1. **No dead air.** The shipped clip held its frame-0 pose on every channel
 *    for 12 frames — a quarter of a clip whose whole job is being a legible
 *    tell.
 * 2. **A gape wide enough to breathe through, open while the fire is.**
 *    The shipped gape travelled 31.8 degrees and peaked at t = 1.63 s, against
 *    the `attack` bite's 48.1, while `BreathVFX` ignited on the frame the action
 *    starts — so fire left a shut mouth for the first 1.15 s. The re-authored
 *    clip travels 51.0 and is past 45 from t = 0.458 to t = 1.458.
 * 3. **A jet that points where the damage lands.** `tryBreath` in
 *    `core/combat/encounter.ts` tests a strictly horizontal cone, and
 *    `BreathVFX` draws the jet along the last-neck-to-skull tangent. The
 *    shipped clip swept that tangent down through 68 degrees and held the
 *    widest gape 47.7 degrees below horizontal.
 * 4. **Neutral at both ends**, which the one-shot action channel requires: it
 *    crossfades in, and the base locomotion state is blended out of the last
 *    frame.
 */

/** Probed on WyvernRig: the skull tangent's pitch with every bone at bind. */
const BIND_AIM_DEG = -14.32

/**
 * Every bone from `Body` through `Neck2` moves that tangent by exactly -1.0
 * degree per +1 degree of local X; `Head` moves it by 0.0, because it rotates
 * the skull below the point the tangent is measured from. So the aim is
 * `BIND_AIM_DEG` minus the sum of this chain's authored local X.
 */
const AIM_CHAIN = ['Body', 'Spine1', 'Spine2', 'Spine3', 'Neck1', 'Neck2']

/**
 * When flame is on screen, in seconds from the action's first frame.
 *
 * `BREATH_VFX_LEAD_SECONDS` delays ignition to the gape, and one burst runs
 * `BREATH_VFX_DURATION_SECONDS` after that. The mouth has to be open across all
 * of it — that relationship is the whole point of both numbers, so it is
 * derived here rather than restated.
 */
const FLAME_WINDOW = [BREATH_VFX_LEAD_SECONDS, BREATH_VFX_TOTAL_SECONDS] as const

interface Track {
  times: number[]
  /** Local X in degrees, per key, relative to the clip's first frame. */
  degrees: number[]
}

function clipTracks(url: string, clipName: string, bones: string[]): Map<string, Track> {
  const data = readFileSync(new URL(`../../../public${url}`, import.meta.url))
  const jsonLength = data.readUInt32LE(12)
  const json = JSON.parse(data.subarray(20, 20 + jsonLength).toString('utf8'))
  const binOffset = 20 + jsonLength
  const bin = data.subarray(binOffset + 8, binOffset + 8 + data.readUInt32LE(binOffset))
  const view = new DataView(bin.buffer, bin.byteOffset, bin.byteLength)

  const components = { SCALAR: 1, VEC3: 3, VEC4: 4 } as Record<string, number>
  const read = (index: number): number[][] => {
    const accessor = json.accessors[index]
    const bufferView = json.bufferViews[accessor.bufferView]
    const width = components[accessor.type]!
    const stride = bufferView.byteStride || width * 4
    const base = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
    const rows: number[][] = []
    for (let i = 0; i < accessor.count; i += 1) {
      const row: number[] = []
      for (let c = 0; c < width; c += 1) row.push(view.getFloat32(base + i * stride + c * 4, true))
      rows.push(row)
    }
    return rows
  }

  // Only the sagittal channel is authored, so the X of an XYZ decomposition is
  // the authored angle. Every other component holds its rest value and cancels
  // in the frame-0-relative difference below.
  const localXDegrees = ([x, y, z, w]: number[]): number => {
    const m13 = 2 * (x! * z! + y! * w!)
    const m23 = 2 * (y! * z! - x! * w!)
    const m33 = 1 - 2 * (x! * x! + y! * y!)
    const angle = Math.abs(m13) < 0.9999999
      ? Math.atan2(-m23, m33)
      : Math.atan2(2 * (y! * z! + x! * w!), 1 - 2 * (x! * x! + z! * z!))
    return (angle * 180) / Math.PI
  }

  const animation = json.animations.find((one: { name: string }) => one.name === clipName)
  if (!animation) throw new Error(`${url} has no clip "${clipName}"`)
  const names: string[] = json.nodes.map((node: { name: string }) => node.name)

  const tracks = new Map<string, Track>()
  for (const channel of animation.channels) {
    const bone = names[channel.target.node]!
    if (channel.target.path !== 'rotation' || !bones.includes(bone)) continue
    const sampler = animation.samplers[channel.sampler]
    const times = read(sampler.input).map((row) => row[0]!)
    const values = read(sampler.output).map(localXDegrees)
    const first = values[0]!
    tracks.set(bone, { times, degrees: values.map((value) => value - first) })
  }
  return tracks
}

const WYVERN = ASSETS['wyvern.mirefang']!
const SPEC = WYVERN.animations!.breathe as ClipSpec
const TRACKED = [...AIM_CHAIN, 'Head', 'Jaw', 'Tail3', 'L_Toes', 'R_Toes']
const tracks = clipTracks(WYVERN.url!, SPEC.clip, TRACKED)
const times = tracks.get('Jaw')!.times
const at = (seconds: number): number => {
  let best = 0
  for (let i = 0; i < times.length; i += 1) {
    if (Math.abs(times[i]! - seconds) < Math.abs(times[best]! - seconds)) best = i
  }
  return best
}
/** Negative local X opens the lower muzzle, so gape is the negated angle. */
const gapeAt = (index: number): number => -tracks.get('Jaw')!.degrees[index]!
const aimAt = (index: number): number =>
  BIND_AIM_DEG - AIM_CHAIN.reduce((sum, bone) => sum + (tracks.get(bone)?.degrees[index] ?? 0), 0)

describe('breath clip', () => {
  it('runs inside the breath cooldown so a tell cannot outlast its own attack', () => {
    // BREATH_INTERVAL in core/combat/encounter.ts.
    expect(times.at(-1)).toBeLessThanOrEqual(2.2)
  })

  it('starts and ends on the neutral pose the action channel blends through', () => {
    for (const [bone, track] of tracks) {
      expect(track.degrees[0], `${bone} at frame 0`).toBeCloseTo(0, 1)
      expect(track.degrees.at(-1), `${bone} at the last frame`).toBeCloseTo(0, 1)
    }
  })

  it('is moving within the first two frames, with no held opening pose', () => {
    const moved = [...tracks.values()].some(
      (track) => Math.abs(track.degrees[2]!) > 0.5,
    )
    expect(moved, 'nothing has left the frame-0 pose by t = 0.083 s').toBe(true)
  })

  it('opens wider than the bite, and holds it open across the flame window', () => {
    const peak = Math.max(...tracks.get('Jaw')!.degrees.map((_, i) => gapeAt(i)))
    expect(peak).toBeGreaterThan(48)

    for (let i = at(FLAME_WINDOW[0]); i <= at(FLAME_WINDOW[1]); i += 1) {
      expect(gapeAt(i), `gape at t = ${times[i]!.toFixed(3)} s`).toBeGreaterThan(30)
    }
  })

  it('holds the jet on the aim line while the mouth is open', () => {
    // The band a grounded wyvern needs: its head sits 5.71 m up, so -14 degrees
    // reaches a ground target's torso at 16.5 m, the middle of the 14-18 m
    // `breathRange`. Recoil is allowed to walk it up; nothing may put it back
    // into the ground, which is what the 68-degree sweep this replaced did.
    for (let i = at(FLAME_WINDOW[0]); i <= at(FLAME_WINDOW[1]); i += 1) {
      const aim = aimAt(i)
      expect(aim, `aim at t = ${times[i]!.toFixed(3)} s`).toBeGreaterThan(-20)
      expect(aim, `aim at t = ${times[i]!.toFixed(3)} s`).toBeLessThan(0)
    }
  })

  it('braces: the tail counterweights and the feet splay', () => {
    const span = (bone: string): number => {
      const values = tracks.get(bone)!.degrees
      return Math.max(...values) - Math.min(...values)
    }
    expect(span('Tail3'), 'the tail held one value for all 49 frames').toBeGreaterThan(1)
    expect(span('L_Toes')).toBeGreaterThan(10)
    expect(span('L_Toes')).toBeCloseTo(span('R_Toes'), 1)
  })
})
