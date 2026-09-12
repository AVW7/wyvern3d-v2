import { describe, expect, it } from 'vitest'
import type { GeomorphicOperator } from './landformOperators'
import {
  applyOperator,
  basinAt,
  craterAt,
  duneAt,
  plateauWeightAt,
  rimAt,
  ridgeSpineAt,
} from './landformOperators'
import { noiseBasisAt } from './terrainNoise'

const BASIS = noiseBasisAt(11, 20, -30)

describe('landform operators', () => {
  it('digs a crater floor, raises a rim, and vanishes beyond the band', () => {
    expect(craterAt(0, 34, 2.2, 0.9)).toBeCloseTo(-2.2)
    expect(craterAt(34, 34, 2.2, 0.9)).toBeCloseTo(0)
    expect(craterAt(34 + 34 * 0.2, 34, 2.2, 0.9)).toBeCloseTo(0.9)
    expect(craterAt(80, 34, 2.2, 0.9)).toBe(0)
  })

  it('bounds the crater rim flank under the landing slope limit', () => {
    // `biomeWater.test.ts` requires atan(gradient) < 0.35 at every protected
    // site, and ashland is a water (lava) biome whose sites can land on the
    // rim band. The flank gradient closes at rimHeight * PI / (0.4 * radius);
    // this pins the ashland row's headroom so a future retune cannot quietly
    // steepen it past the contract.
    const radius = 34
    const rimHeight = 0.9
    let worst = 0
    for (let d = radius; d <= radius * 1.4; d += 0.05) {
      const g = Math.abs(craterAt(d + 0.5, radius, 2.2, rimHeight) - craterAt(d - 0.5, radius, 2.2, rimHeight))
      worst = Math.max(worst, g)
    }
    expect(Math.atan(worst)).toBeLessThan(0.35)
  })

  it('makes a basin deepest at its centre and flat outside its radius', () => {
    expect(basinAt(0, 60)).toBe(60)
    expect(basinAt(30, 60)).toBe(30)
    expect(basinAt(60, 60)).toBe(0)
    expect(basinAt(90, 60)).toBe(0)
  })

  it('peaks the rim ring at its authored radius', () => {
    expect(rimAt(58, 58, 260)).toBeCloseTo(1)
    expect(rimAt(58 - 20, 58, 260)).toBeLessThan(0.3)
    expect(rimAt(58 + 20, 58, 260)).toBeLessThan(0.3)
  })

  it('holds a plateau flat inside its radius and fades across the blend', () => {
    expect(plateauWeightAt(0, 20, 22)).toBe(1)
    expect(plateauWeightAt(20, 20, 22)).toBe(1)
    expect(plateauWeightAt(31, 20, 22)).toBeCloseTo(0.5, 1)
    expect(plateauWeightAt(42, 20, 22)).toBe(0)
    expect(plateauWeightAt(80, 20, 22)).toBe(0)
    // Monotone decreasing across the blend — a non-monotone edge would read as
    // a terrace the author never asked for.
    let previous = 1
    for (let d = 20; d <= 42; d += 0.5) {
      const w = plateauWeightAt(d, 20, 22)
      expect(w).toBeLessThanOrEqual(previous + 1e-9)
      previous = w
    }
  })

  it('crests a ridge spine on its segment and drops to zero past its width', () => {
    const from: [number, number] = [-70, -40]
    const to: [number, number] = [65, 55]
    expect(ridgeSpineAt(-70, -40, from, to, 34)).toBeCloseTo(1)
    expect(ridgeSpineAt(0, 0, from, to, 34)).toBeGreaterThan(0.5)
    expect(ridgeSpineAt(-70, 60, from, to, 34)).toBe(0)
    // Degenerate inputs must not produce NaN in the height field.
    expect(ridgeSpineAt(0, 0, from, from, 34)).toBe(0)
    expect(ridgeSpineAt(0, 0, from, to, 0)).toBe(0)
  })

  it('cuts terrace benches at the authored metre spacing', () => {
    // Regression guard for the unit mismatch this operator arrived with: the
    // studio's `steps` meant benches per unit height, which on a 17 m mountain
    // produced 14 cm treads and no visible terracing at all. Assert that a
    // 1.6 m bench actually moves the surface.
    const at = (h: number) =>
      applyOperator({ kind: 'terrace', amount: 1, stepHeight: 1.6, smoothness: 1 }, h, 0, 0, BASIS)
    let moved = 0
    for (let h = 0; h <= 17; h += 0.1) if (Math.abs(at(h) - h) > 0.05) moved += 1
    expect(moved).toBeGreaterThan(80)
    // Treads land on multiples of the step, and the surface never runs backwards.
    expect(at(3.2)).toBeCloseTo(3.2, 1)
    let previous = -Infinity
    for (let h = 0; h <= 17; h += 0.05) {
      const v = at(h)
      expect(v).toBeGreaterThanOrEqual(previous - 1e-9)
      previous = v
    }
  })

  it('terraces into benches without changing the overall elevation band', () => {
    for (let h = -6; h <= 12; h += 0.25) {
      const t = applyOperator({ kind: 'terrace', amount: 1, stepHeight: 1.6, smoothness: 0.6 }, h, 0, 0, BASIS)
      expect(Number.isFinite(t)).toBe(true)
      expect(Math.abs(t - h)).toBeLessThan(1.6)
    }
  })

  it('keeps dune waves bounded to +/-1 before their amount is applied', () => {
    for (let x = -110; x <= 110; x += 3) {
      const d = duneAt(x, -x * 0.5, BASIS.macro, 0.028, 0.7, 3)
      expect(d).toBeGreaterThanOrEqual(-1)
      expect(d).toBeLessThanOrEqual(1)
    }
  })

  it('dispatches every operator kind to a finite height', () => {
    const kinds: GeomorphicOperator[] = [
      { kind: 'noiseBoost', field: 'ridge', amount: 2 },
      { kind: 'dune', amount: 0.5, frequency: 0.03, skew: 0.4, warp: 2 },
      { kind: 'basin', amount: 0.05, radius: 60 },
      { kind: 'rim', amount: 1.1, radius: 58, falloff: 260 },
      { kind: 'crater', amount: 1, radius: 34, depth: 2.2, rimHeight: 0.9 },
      { kind: 'ridgeSpine', amount: 5, from: [-70, -40], to: [65, 55], width: 34 },
      { kind: 'terrace', amount: 0.4, stepHeight: 1.6 },
      { kind: 'plateau', amount: 1, radius: 20, height: 3.2, blend: 22 },
    ]

    for (const operator of kinds) {
      const h = applyOperator(operator, 1.5, 12, -34, BASIS)
      expect(Number.isFinite(h), operator.kind).toBe(true)
    }
  })
})
