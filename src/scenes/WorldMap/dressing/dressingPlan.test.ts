import { describe, expect, it } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { REGION_LIST } from '../../../core/data/regions'
import { BIOME_DRESSING, planDressing } from './dressingPlan'
import { mapHeightAt, plateauRadius } from '../terrain/mapTerrain'

describe('dressingPlan', () => {
  it('covers all 15 biomes', () => {
    const biomes = Array.from(new Set(REGION_LIST.map((r) => r.biome)))
    expect(biomes.length).toBe(15)
    for (const b of biomes) {
      expect(BIOME_DRESSING[b], `Missing dressing for biome: ${b}`).toBeDefined()
    }
  })

  it('all propIds exist in scripts/asset-sources.json', () => {
    const jsonPath = path.resolve(__dirname, '../../../../scripts/asset-sources.json')
    const raw = fs.readFileSync(jsonPath, 'utf-8')
    const data = JSON.parse(raw)
    const validPropIds = new Set<string>()

    for (const target of data.targets) {
      for (const prop of target.props) {
        validPropIds.add(prop.id)
      }
    }

    for (const [biome, configs] of Object.entries(BIOME_DRESSING)) {
      for (const cfg of configs) {
        expect(validPropIds.has(cfg.propId), `Unknown propId ${cfg.propId} in biome ${biome}`).toBe(true)
      }
    }
  })

  it('no placement lands inside plateauRadius of any region center', () => {
    const plan = planDressing(42)
    for (const [key, group] of Object.entries(plan)) {
      for (const p of group.items) {
        const [px, , pz] = p.position
        for (const def of REGION_LIST) {
          const dist = Math.hypot(px - def.position.x, pz - def.position.z)
          const minAllowed = plateauRadius(def)
          expect(dist, `Placement for ${key} encroached on ${def.id} plateau`).toBeGreaterThanOrEqual(minAllowed - 0.01)
        }
      }
    }
  })

  it('every y sits on the terrain, less the config sink', () => {
    const plan = planDressing(42)
    const sinkFor = new Map<string, number>()
    for (const configs of Object.values(BIOME_DRESSING)) {
      for (const cfg of configs) sinkFor.set(cfg.propId, cfg.sink ?? 0)
    }

    for (const group of Object.values(plan)) {
      for (const p of group.items) {
        const [px, py, pz] = p.position
        const expectedY = mapHeightAt(px, pz) - (sinkFor.get(group.propId) ?? 0)
        expect(py).toBeCloseTo(expectedY, 5)
      }
    }
  })

  it('tints every group with a biome colour', () => {
    for (const group of Object.values(planDressing(42))) {
      expect(group.color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('same seed produces byte-identical output', () => {
    const plan1 = planDressing(100)
    const plan2 = planDressing(100)
    expect(plan1).toEqual(plan2)
  })
})
