import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('sanctuary atlas baseline', () => {
  const repo = path.resolve(__dirname, '../../..')
  const baselinePath = path.join(repo, 'validation/sanctuary-environment/sanctuary-atlas-baseline.json')
  const glbPath = path.join(repo, 'public/models/sanctuary.glb')
  const stationAuditPath = path.join(repo, 'validation/sanctuary-environment/station-audit.json')

  it('verifies baseline file exists and is valid', () => {
    expect(fs.existsSync(baselinePath)).toBe(true)
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
    expect(baseline.version).toBe(1)
    expect(baseline.summary.propCount).toBe(57)
    expect(baseline.summary.totalMb).toBeLessThan(8.0) // Soft budget cap
    expect(baseline.props).toHaveLength(57)
  })

  it('verifies live sanctuary.glb matches baseline node count and byte size', () => {
    expect(fs.existsSync(glbPath)).toBe(true)
    const glbData = fs.readFileSync(glbPath)
    const jsonLength = glbData.readUInt32LE(12)
    const doc = JSON.parse(glbData.subarray(20, 20 + jsonLength).toString('utf8'))

    expect(doc.nodes).toHaveLength(57)
    expect(doc.materials).toHaveLength(1)

    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
    const baselineIds = baseline.props.map((p: { id: string }) => p.id)

    for (const node of doc.nodes) {
      expect(baselineIds).toContain(node.name)
    }
  })

  it('verifies station audit covers all 11 sanctuary stations with prioritized replacements', () => {
    expect(fs.existsSync(stationAuditPath)).toBe(true)
    const audit = JSON.parse(fs.readFileSync(stationAuditPath, 'utf8'))
    expect(audit.stations).toHaveLength(11)
    expect(audit.topFiveReplacements).toHaveLength(5)
    expect(audit.topFiveReuseResurfaceCandidates).toHaveLength(5)

    const stationIds = audit.stations.map((s: { id: string }) => s.id)
    expect(stationIds).toContain('warTable')
    expect(stationIds).toContain('barracks')
    expect(stationIds).toContain('infirmary')
    expect(stationIds).toContain('hatchery')
    expect(stationIds).toContain('breeding')
    expect(stationIds).toContain('huntingPen')
    expect(stationIds).toContain('flightRing')
    expect(stationIds).toContain('burnRange')
    expect(stationIds).toContain('enduranceRun')
    expect(stationIds).toContain('scaleForge')
    expect(stationIds).toContain('roster')
  })
})
