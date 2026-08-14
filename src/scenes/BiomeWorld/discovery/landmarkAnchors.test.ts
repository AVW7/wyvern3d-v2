import { describe, expect, it } from 'vitest'
import { REGION_LIST } from '@/core/data/regions'
import { getAllAuthoredLandmarks } from '@/core/data/atlas'
import {
  getRegionLandmarkAnchors,
  nearestSurveyableLandmark,
} from './landmarkAnchors'

const SEED = 42

describe('getRegionLandmarkAnchors', () => {
  it('produces an anchor for every authored landmark in every region', () => {
    for (const def of REGION_LIST) {
      const anchors = getRegionLandmarkAnchors(def.id, SEED)
      expect(anchors, def.id).toHaveLength(def.atlas?.landmarks.length ?? 0)
    }
    const total = REGION_LIST.reduce(
      (sum, def) => sum + getRegionLandmarkAnchors(def.id, SEED).length,
      0,
    )
    expect(total).toBe(getAllAuthoredLandmarks().length)
  })

  it('is deterministic for the same region and seed', () => {
    for (const def of REGION_LIST.slice(0, 6)) {
      expect(getRegionLandmarkAnchors(def.id, SEED)).toEqual(
        getRegionLandmarkAnchors(def.id, SEED),
      )
    }
  })

  it('is distinct across regions with the same biome', () => {
    const forestRegions = REGION_LIST.filter((r) => r.biome === 'forest')
    if (forestRegions.length >= 2) {
      const positions = forestRegions.map((r) =>
        getRegionLandmarkAnchors(r.id, SEED).map((a) => [a.x, a.z]),
      )
      expect(positions[0]).not.toEqual(positions[1])
    }
  })

  it('seats anchors within the explorable radius and outside the arrival clearing', () => {
    for (const def of REGION_LIST) {
      for (const anchor of getRegionLandmarkAnchors(def.id, SEED)) {
        expect(Math.hypot(anchor.x, anchor.z), `${def.id}:${anchor.landmarkId}`).toBeLessThanOrEqual(72)
        // Grove override anchors live on the real landmark composition.
        if (def.biome !== 'grove') {
          expect(
            Math.hypot(anchor.x - 0, anchor.z - -18),
            `${def.id}:${anchor.landmarkId} spawn clearance`,
          ).toBeGreaterThanOrEqual(14)
        }
      }
    }
  })

  it('pins grove landmarks onto the real world-tree composition', () => {
    const anchors = getRegionLandmarkAnchors('elderrootgrove', SEED)
    const tree = anchors.find((a) => a.landmarkId === 'elderrootgrove_world_tree')!
    expect([tree.x, tree.z]).toEqual([0, 0])
    const ring = anchors.find((a) => a.landmarkId === 'elderrootgrove_druid_circle')!
    expect(Math.hypot(ring.x, ring.z)).toBeCloseTo(26, 5)
  })

  it('returns finite values for every anchor', () => {
    for (const def of REGION_LIST) {
      for (const anchor of getRegionLandmarkAnchors(def.id, SEED)) {
        expect(Number.isFinite(anchor.x)).toBe(true)
        expect(Number.isFinite(anchor.z)).toBe(true)
        expect(anchor.approachRadius).toBeGreaterThan(0)
      }
    }
  })
})

describe('nearestSurveyableLandmark', () => {
  const anchors = getRegionLandmarkAnchors('hearthvale', SEED)

  it('returns null when far from every anchor', () => {
    expect(nearestSurveyableLandmark(anchors, [], [500, 500])).toBeNull()
  })

  it('returns the anchor when inside its approach radius', () => {
    const first = anchors[0]!
    const found = nearestSurveyableLandmark(anchors, [], [first.x, first.z])
    expect(found?.landmarkId).toBe(first.landmarkId)
  })

  it('prefers the nearest of two anchors in range', () => {
    const pair = [
      { landmarkId: 'a', name: 'A', category: 'vista', x: 0, z: 0, approachRadius: 10 },
      { landmarkId: 'b', name: 'B', category: 'vista', x: 6, z: 0, approachRadius: 10 },
    ]
    const foundA = nearestSurveyableLandmark(pair, [], [2, 0])
    expect(foundA?.landmarkId).toBe('a')
    const foundB = nearestSurveyableLandmark(pair, [], [4, 0])
    expect(foundB?.landmarkId).toBe('b')
  })

  it('ignores already-discovered landmarks', () => {
    const first = anchors[0]!
    const found = nearestSurveyableLandmark(anchors, [first.landmarkId], [first.x, first.z])
    expect(found?.landmarkId).not.toBe(first.landmarkId)
  })


})
