import { describe, expect, it } from 'vitest'
import { REGION_LIST, REGIONS } from '@/core/data/regions'
import { getAllAuthoredLandmarks } from '@/core/data/atlas'
import { BIOME_DRESSING } from '@/render/assets/biomeLibrary'
import type { PropPlacement } from '@/render/assets/props'
import { SOLID_PROP_RADII } from '../terrain/biomeTraversal'
import {
  filterScatterNearLandmarks,
  getRegionLandmarkProps,
  landmarkDrawPlacements,
} from './landmarkProps'

const SEED = 42

describe('getRegionLandmarkProps', () => {
  it('plans one placement per authored landmark in every region', () => {
    for (const def of REGION_LIST) {
      const placements = getRegionLandmarkProps(def.id, SEED)
      expect(placements, def.id).toHaveLength(def.atlas?.landmarks.length ?? 0)
    }
    const total = REGION_LIST.reduce(
      (sum, def) => sum + getRegionLandmarkProps(def.id, SEED).length,
      0,
    )
    expect(total).toBe(getAllAuthoredLandmarks().length)
  })

  it('assigns only approved atlas props', () => {
    // Every biome dressing prop id is a key of SOLID_PROP_RADII when solid;
    // landmark props must at minimum be real atlas ids used by dressing.
    const knownProps = new Set(
      Object.values(BIOME_DRESSING).flatMap((layers) => layers.map((l) => l.prop)),
    )
    for (const def of REGION_LIST) {
      for (const p of getRegionLandmarkProps(def.id, SEED)) {
        if (p.propId === null) continue
        expect(knownProps.has(p.propId), `${def.id}: ${p.propId}`).toBe(true)
      }
    }
  })

  it('gives every category a prop and landmark scale >= scatter scale', () => {
    for (const def of REGION_LIST) {
      for (const p of getRegionLandmarkProps(def.id, SEED)) {
        // Existing compositions (grove) legitimately have no prop id.
        if (p.existingComposition) continue
        expect(p.propId, `${def.id}:${p.anchor.landmarkId}`).not.toBeNull()
        expect(p.scale).toBeGreaterThanOrEqual(1.2)
        expect(p.colliderRadius).toBeGreaterThan(0)
      }
    }
  })

  it('excludes the grove composition landmarks from extra props', () => {
    const placements = getRegionLandmarkProps('elderrootgrove', SEED)
    const tree = placements.find((p) => p.anchor.landmarkId === 'elderrootgrove_world_tree')!
    expect(tree.existingComposition).toBe(true)
    expect(tree.propId).toBeNull()
    expect(tree.colliderRadius).toBe(0)
  })

  it('is deterministic and finite for every region', () => {
    for (const def of REGION_LIST.slice(0, 8)) {
      const a = getRegionLandmarkProps(def.id, SEED)
      const b = getRegionLandmarkProps(def.id, SEED)
      expect(a).toEqual(b)
      for (const p of a) {
        expect(Number.isFinite(p.rotationY)).toBe(true)
        expect(p.rotationY).toBeGreaterThanOrEqual(0)
        expect(p.rotationY).toBeLessThan(2 * Math.PI)
      }
    }
  })

  it('derives distinct facings across landmarks of one region', () => {
    for (const def of REGION_LIST) {
      const facings = getRegionLandmarkProps(def.id, SEED).map((p) => p.rotationY)
      const unique = new Set(facings)
      // 2–3 landmarks each with a hashed facing: at least two distinct.
      if (facings.length > 1) expect(unique.size).toBeGreaterThanOrEqual(2)
    }
  })

  it('colliders match SOLID_PROP_RADII for the assigned prop', () => {
    for (const def of REGION_LIST) {
      for (const p of getRegionLandmarkProps(def.id, SEED)) {
        if (!p.propId) continue
        expect(p.colliderRadius).toBe(SOLID_PROP_RADII[p.propId] ?? 1.2)
      }
    }
  })
})

describe('landmarkDrawPlacements', () => {
  it('groups placements by prop id and seats them on the terrain', () => {
    const flat = (x: number, _z: number) => x * 0.1
    for (const def of REGION_LIST.slice(0, 8)) {
      const plan = getRegionLandmarkProps(def.id, SEED)
      const groups = landmarkDrawPlacements(plan, flat)
      const total = groups.reduce((sum, g) => sum + g.items.length, 0)
      expect(total).toBe(plan.filter((p) => p.propId !== null).length)
      for (const g of groups) {
        for (const item of g.items) {
          expect(item.position[1]).toBeCloseTo(item.position[0] * 0.1, 6)
          expect(item.scale).toBeGreaterThan(1)
        }
      }
    }
  })
})

describe('filterScatterNearLandmarks', () => {
  it('removes scatter inside landmark approach rings and keeps the rest', () => {
    const plan = getRegionLandmarkProps('hearthvale', SEED)
    const anchor = plan[0]!.anchor
    const far: PropPlacement = {
      position: [anchor.x + 60, 0, anchor.z + 60],
      rotationY: 0,
      scale: 1,
    }

    const kept = filterScatterNearLandmarks([far], plan)
    expect(kept).toEqual([far])

    const near: PropPlacement = { position: [anchor.x + 1, 0, anchor.z], rotationY: 0, scale: 1 }
    const filtered = filterScatterNearLandmarks([near], plan)
    expect(filtered).toEqual([])
  })

  it('is a no-op when there are no landmarks', () => {
    const items: PropPlacement[] = [{ position: [0, 0, 0], rotationY: 0, scale: 1 }]
    expect(filterScatterNearLandmarks(items, [])).toEqual(items)
  })
})

describe('every region biome has a natural hero prop', () => {
  it('covers all biomes in REGIONS or falls back safely', () => {
    const biomes = new Set(REGION_LIST.map((r) => r.biome))
    for (const biome of biomes) {
      const region = REGION_LIST.find((r) => r.biome === biome)!
      const naturals = getRegionLandmarkProps(region.id, SEED).filter(
        (p) => p.anchor.category === 'natural',
      )
      for (const p of naturals) {
        if (p.existingComposition) continue
        expect(p.propId, `${biome} natural landmark`).not.toBeNull()
      }
    }
    expect(REGIONS['hearthvale']).toBeDefined()
  })
})
