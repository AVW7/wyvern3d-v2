import { describe, expect, it } from 'vitest'
import { Bone, Group, Quaternion } from 'three'
import { applyWingFold, approachFold, foldWeightForState } from './wingFold'
import { GOTHIC_WING_POSE } from './wingFoldPose'

function rig(names: string[]): Group {
  const root = new Group()
  for (const name of names) {
    const bone = new Bone()
    bone.name = name
    root.add(bone)
  }
  return root
}

const WING_BONES = Object.keys(GOTHIC_WING_POSE)

describe('foldWeightForState', () => {
  it('folds fully on grounded states', () => {
    for (const s of ['idle', 'walk', 'rest', 'sleep', 'sit', 'eat', 'perch'] as const) {
      expect(foldWeightForState(s)).toBe(1)
    }
  })

  it('leaves flight states open, so a flying wyvern is untouched', () => {
    for (const s of ['cruise', 'airborne', 'hover', 'glide', 'dive', 'speed'] as const) {
      expect(foldWeightForState(s)).toBe(0)
    }
  })

  it('holds the ground transitions part-way rather than snapping shut', () => {
    expect(foldWeightForState('land')).toBeGreaterThan(0)
    expect(foldWeightForState('land')).toBeLessThan(1)
    expect(foldWeightForState('rise')).toBeGreaterThan(0)
    expect(foldWeightForState('rise')).toBeLessThan(1)
  })

  it('treats a missing state as open', () => {
    expect(foldWeightForState(undefined)).toBe(0)
  })
})

describe('approachFold', () => {
  it('eases toward the target without overshooting', () => {
    let v = 0
    for (let i = 0; i < 200; i++) v = approachFold(v, 1, 1 / 60)
    expect(v).toBeGreaterThan(0.99)
    expect(v).toBeLessThanOrEqual(1)
  })

  it('is a no-op on a zero timestep, so a paused frame cannot drift', () => {
    expect(approachFold(0.3, 1, 0)).toBe(0.3)
  })
})

describe('applyWingFold', () => {
  it('does nothing at zero weight — the authored clip is left alone', () => {
    const root = rig(WING_BONES)
    const before = root.children.map((b) => b.quaternion.clone())
    expect(applyWingFold(root, 0)).toBe(0)
    root.children.forEach((b, i) => {
      const prev = before[i]
      expect(prev).toBeDefined()
      expect(b.quaternion.equals(prev!)).toBe(true)
    })
  })

  it('reaches the baked pose at full weight', () => {
    const root = rig(WING_BONES)
    expect(applyWingFold(root, 1)).toBe(WING_BONES.length)
    const first = Object.entries(GOTHIC_WING_POSE)[0]
    expect(first).toBeDefined()
    const [name, q] = first!
    const bone = root.getObjectByName(name)!
    const want = new Quaternion(q[0], q[1], q[2], q[3]).normalize()
    expect(bone.quaternion.angleTo(want)).toBeLessThan(1e-6)
  })

  it('lands part-way at partial weight', () => {
    const entry = Object.entries(GOTHIC_WING_POSE).find(
      ([, q]) => new Quaternion(q[0], q[1], q[2], q[3]).angleTo(new Quaternion()) > 0.2,
    )
    expect(entry).toBeDefined()
    const [name, q] = entry!
    const want = new Quaternion(q[0], q[1], q[2], q[3]).normalize()
    const full = new Quaternion().angleTo(want)

    const root = rig(WING_BONES)
    applyWingFold(root, 0.5)
    const bone = root.getObjectByName(name)!
    expect(bone.quaternion.angleTo(want)).toBeGreaterThan(1e-6)
    expect(bone.quaternion.angleTo(want)).toBeLessThan(full)
  })

  it('is a no-op on a rig without the grafted digits, rather than throwing', () => {
    // Pre-graft wing bone names only. `L_WingShoulder` survives the graft and
    // does appear in the pose, so it cannot stand in for an absent bone here.
    const root = rig(['Spine1', 'Neck1', 'L_WingFinger1', 'L_WingMembrane1'])
    expect(applyWingFold(root, 1)).toBe(0)
  })

  it('is idempotent at full weight', () => {
    const root = rig(WING_BONES)
    applyWingFold(root, 1)
    const once = root.children.map((b) => b.quaternion.clone())
    applyWingFold(root, 1)
    root.children.forEach((b, i) => {
      const prev = once[i]
      expect(prev).toBeDefined()
      expect(b.quaternion.angleTo(prev!)).toBeLessThan(1e-6)
    })
  })

  it('covers both wings', () => {
    expect(WING_BONES.some((n) => n.startsWith('L_'))).toBe(true)
    expect(WING_BONES.some((n) => n.startsWith('R_'))).toBe(true)
  })
})
