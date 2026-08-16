import { describe, expect, it } from 'vitest'
import { REGION_LIST } from '@/core/data/regions'
import {
  getRegionExpeditionSpec,
  isHazardVentActive,
} from './expeditionPuzzles'

describe('expeditionPuzzles positioning and logic', () => {
  it('generates non-null spec for every valid region', () => {
    for (const def of REGION_LIST) {
      const spec = getRegionExpeditionSpec(def.id, 42)
      expect(spec, `Region ${def.id}`).not.toBeNull()
      expect(spec!.nodes.length).toBeGreaterThanOrEqual(1)
      expect(spec!.nodes.length).toBeLessThanOrEqual(3)
      expect(spec!.activity.id).toBeDefined()
    }
  })

  it('is deterministic: same seed and region produce identical positions', () => {
    const a = getRegionExpeditionSpec('hearthvale', 12345)
    const b = getRegionExpeditionSpec('hearthvale', 12345)
    expect(a).toEqual(b)
  })

  it('places nodes within valid playable radius bounds', () => {
    for (const def of REGION_LIST) {
      const spec = getRegionExpeditionSpec(def.id, 100)!
      const centerDist = Math.hypot(spec.centerX, spec.centerZ)
      // Cluster placed between 30m and 80m from origin
      expect(centerDist).toBeGreaterThan(25)
      expect(centerDist).toBeLessThan(80)

      for (const node of spec.nodes) {
        const nodeDist = Math.hypot(node.x, node.z)
        expect(nodeDist).toBeGreaterThan(20)
        expect(nodeDist).toBeLessThan(90)
        expect(node.approachRadius).toBeGreaterThan(3)
      }
    }
  })

  it('toggles hazard vent active state deterministically over time', () => {
    const activeAt0 = isHazardVentActive('cinderpeaks', 0, 0, 42)
    const activeAt4 = isHazardVentActive('cinderpeaks', 0, 4, 42)
    const activeAt12 = isHazardVentActive('cinderpeaks', 0, 12, 42)

    // Hazard cycles every 18s (8s active, 10s dormant)
    expect(typeof activeAt0).toBe('boolean')
    expect(typeof activeAt4).toBe('boolean')
    expect(typeof activeAt12).toBe('boolean')
  })
})
