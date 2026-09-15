import { describe, expect, it } from 'vitest'
import { STORY_CLUSTERS, isPropInFlightCorridor } from './dressing'
import { GROUND_RADIUS } from './layout'
import fs from 'node:fs'
import path from 'node:path'

const repo = path.resolve(__dirname, '../../..')
const sanctuaryManifest = JSON.parse(
  fs.readFileSync(path.join(repo, 'scripts/sanctuary-library.json'), 'utf8'),
)
const ATLAS_PROP_IDS = new Set<string>(
  (sanctuaryManifest.props as { id: string }[]).map((p) => p.id),
)

describe('Stage 7: Story clusters — placement contracts', () => {
  it('all cluster prop IDs exist in the sanctuary atlas (57-prop cap must not break)', () => {
    for (const propId of Object.keys(STORY_CLUSTERS)) {
      expect(
        ATLAS_PROP_IDS.has(propId),
        `"${propId}" not found in sanctuary-library.json — story clusters must use only existing atlas props`,
      ).toBe(true)
    }
  })

  it('all cluster positions are outside the central flight corridor', () => {
    for (const [propId, placements] of Object.entries(STORY_CLUSTERS)) {
      for (const placement of placements) {
        const [x, , z] = placement.position
        expect(
          isPropInFlightCorridor(x, z),
          `"${propId}" cluster placement at [${x}, ${z}] is inside the flight corridor`,
        ).toBe(false)
      }
    }
  })

  it('all cluster positions are within GROUND_RADIUS', () => {
    for (const [propId, placements] of Object.entries(STORY_CLUSTERS)) {
      for (const placement of placements) {
        const [x, , z] = placement.position
        const dist = Math.hypot(x, z)
        expect(
          dist,
          `"${propId}" cluster placement at [${x}, ${z}] is outside GROUND_RADIUS (${GROUND_RADIUS})`,
        ).toBeLessThanOrEqual(GROUND_RADIUS)
      }
    }
  })

  it('each cluster has at most 4 placements (one focal + limited support)', () => {
    for (const [propId, placements] of Object.entries(STORY_CLUSTERS)) {
      expect(
        placements.length,
        `"${propId}" has ${placements.length} placements — story clusters must stay restrained`,
      ).toBeLessThanOrEqual(4)
    }
  })
})

describe('isPropInFlightCorridor validator', () => {
  it('identifies positions inside the corridor', () => {
    expect(isPropInFlightCorridor(0, 10)).toBe(true)
    expect(isPropInFlightCorridor(5, 5)).toBe(true)
  })

  it('identifies positions outside the corridor', () => {
    expect(isPropInFlightCorridor(30, 10)).toBe(false)
    expect(isPropInFlightCorridor(-30, 10)).toBe(false)
    expect(isPropInFlightCorridor(0, -20)).toBe(false)
  })
})
