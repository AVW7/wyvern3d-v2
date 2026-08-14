import { describe, expect, it } from 'vitest'
import { isInsideFlightCorridor } from '@/core/data/sanctuaryMasterplan'
import { BIOME_SCATTER, SCATTER } from './dressing'
import { groundFactorsAt, outerHeightAt } from './atmosphere/terrain'
import { GROUND_RADIUS } from './layout'

describe('sanctuary ecology and terrain', () => {
  it('guarantees zero scatter instances inside the flight corridor', () => {
    for (const [id, placements] of Object.entries(SCATTER)) {
      for (const p of placements) {
        expect(
          isInsideFlightCorridor(p.position[0], p.position[2]),
          `SCATTER prop ${id} at [${p.position[0]}, ${p.position[2]}] intrudes on flight corridor`,
        ).toBe(false)
      }
    }

    for (const [id, placements] of Object.entries(BIOME_SCATTER)) {
      for (const p of placements) {
        expect(
          isInsideFlightCorridor(p.position[0], p.position[2]),
          `BIOME_SCATTER prop ${id} at [${p.position[0]}, ${p.position[2]}] intrudes on flight corridor`,
        ).toBe(false)
      }
    }
  })

  it('preserves the flat ground invariant within the walkable radius', () => {
    // Check points inside the walkable disk
    for (let r = 0; r <= GROUND_RADIUS; r += 5) {
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
        const x = Math.cos(angle) * r
        const z = Math.sin(angle) * r
        expect(outerHeightAt(x, z)).toBe(0)
      }
    }

    // Check that outer terrain rises smoothly outside the disk
    expect(outerHeightAt(GROUND_RADIUS + 10, 0)).toBeGreaterThan(0)
    expect(outerHeightAt(0, GROUND_RADIUS + 30)).toBeGreaterThan(0)
  })

  it('correctly calculates ground factors for specialized soils', () => {
    // Soot at scaleForge (32, -12) and burnRange (34, 32)
    const forgeGround = groundFactorsAt(32, -12)
    expect(forgeGround.soot).toBeGreaterThan(0.7)

    const burnGround = groundFactorsAt(34, 32)
    expect(burnGround.soot).toBeGreaterThan(0.8)

    // Moisture at hatchery (14, -3)
    const hatcheryGround = groundFactorsAt(14, -3)
    expect(hatcheryGround.moisture).toBeGreaterThan(0.5)

    // Center of flight commons has zero soot and low moisture
    const commonsGround = groundFactorsAt(0, 0)
    expect(commonsGround.soot).toBe(0)
    expect(commonsGround.moisture).toBe(0)
  })

  it('verifies non-empty deterministic biomes scatter sets', () => {
    expect(Object.keys(BIOME_SCATTER).length).toBeGreaterThan(0)
    for (const [id, placements] of Object.entries(BIOME_SCATTER)) {
      expect(placements.length, `${id} should have placed instances`).toBeGreaterThan(0)
      for (const p of placements) {
        const r = Math.hypot(p.position[0], p.position[2])
        expect(r).toBeLessThanOrEqual(GROUND_RADIUS)
      }
    }
  })
})
