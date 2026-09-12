import { describe, expect, it } from 'vitest'
import { fbmField, hashNoise, noiseBasisAt, ridgeField, valueNoise2D } from './terrainNoise'

/**
 * The noise primitives sit under every height sample, so their contract is
 * narrow and load-bearing: bounded to 0..1, continuous, and identical for the
 * same (x, z, seed) forever — the biome scene rebuilds relief on every entry
 * and must land on the same ground the player left.
 */
describe('terrain noise primitives', () => {
  it('keeps every field inside 0..1 across the playfield', () => {
    for (let x = -110; x <= 110; x += 7) {
      for (let z = -110; z <= 110; z += 7) {
        for (const value of [
          hashNoise(x, z, 17),
          valueNoise2D(x * 0.035, z * 0.035, 17),
          fbmField(x * 0.035, z * 0.035, 17, 4),
          ridgeField(x * 0.035, z * 0.035, 17),
        ]) {
          expect(value, `at ${x},${z}`).toBeGreaterThanOrEqual(0)
          expect(value, `at ${x},${z}`).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('is deterministic for the same coordinates and seed', () => {
    expect(fbmField(1.23, -4.56, 99, 4)).toBe(fbmField(1.23, -4.56, 99, 4))
    expect(ridgeField(1.23, -4.56, 99)).toBe(ridgeField(1.23, -4.56, 99))
    expect(noiseBasisAt(7, 30, -40)).toEqual(noiseBasisAt(7, 30, -40))
  })

  it('decorrelates on seed, so two regions are not a rotated copy', () => {
    const a = noiseBasisAt(1, 25, -60)
    const b = noiseBasisAt(2, 25, -60)
    expect(a.macro).not.toBeCloseTo(b.macro, 3)
    expect(a.ridge).not.toBeCloseTo(b.ridge, 3)
  })

  it('is continuous — a 10 cm step never jumps the field', () => {
    // Discontinuity here would show up as a visible crack in the ground mesh
    // and as the player snapping vertically while walking.
    let worst = 0
    for (let x = -100; x <= 100; x += 3.7) {
      const a = fbmField(x * 0.035, 12 * 0.035, 5, 4)
      const b = fbmField((x + 0.1) * 0.035, 12 * 0.035, 5, 4)
      worst = Math.max(worst, Math.abs(a - b))
    }
    expect(worst).toBeLessThan(0.05)
  })

  it('gives the ridge field sharper features than the rounded macro body', () => {
    // fbm concentrates near 0.5, so `(1 - |2f - 1|)^2` reads as a lifted massif
    // creased by sharp ravines where f crosses the midpoint — not as crests on
    // low ground. Its value is the crease: ~3.4x the gradient of macro, with
    // real mass at the bounds where macro has almost none.
    let macroGrad = 0
    let ridgeGrad = 0
    let ridgeExtremes = 0
    let macroExtremes = 0
    let n = 0
    for (let x = -110; x <= 110; x += 4) {
      for (let z = -110; z <= 110; z += 4) {
        const m = fbmField(x * 0.035, z * 0.035, 3, 4)
        const r = ridgeField(x * 0.035, z * 0.035, 3)
        macroGrad += Math.abs(fbmField((x + 1) * 0.035, z * 0.035, 3, 4) - m)
        ridgeGrad += Math.abs(ridgeField((x + 1) * 0.035, z * 0.035, 3) - r)
        if (m < 0.15 || m > 0.85) macroExtremes += 1
        if (r < 0.15 || r > 0.85) ridgeExtremes += 1
        n += 1
      }
    }
    expect(ridgeGrad / macroGrad).toBeGreaterThan(2)
    expect(ridgeExtremes).toBeGreaterThan(macroExtremes * 10)
    expect(macroGrad / n).toBeGreaterThan(0)
  })
})
