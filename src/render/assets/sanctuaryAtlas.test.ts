import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('sanctuary atlas manifest and validation', () => {
  const repo = path.resolve(__dirname, '../../..')
  const manifestPath = path.join(repo, 'scripts/sanctuary-library.json')
  const glbPath = path.join(repo, 'public/models/sanctuary.glb')

  it('verifies sanctuary-library.json manifest exists and is valid', () => {
    expect(fs.existsSync(manifestPath)).toBe(true)
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

    expect(manifest.out).toBe('sanctuary')
    expect(manifest.softBudgetMb).toBe(8.0)
    expect(manifest.hardCapMb).toBe(15.0)
    expect(manifest.props).toHaveLength(57)

    for (const prop of manifest.props) {
      expect(prop.id).toMatch(/^prop\./)
      expect(prop.targetHeight).toBeGreaterThan(0)
      expect(prop.footprint.halfW).toBeGreaterThan(0)
      expect(prop.footprint.halfD).toBeGreaterThan(0)
      expect(prop.maxTriangles).toBeGreaterThan(0)
      expect(prop.license.status).toBe('approved')
      expect(prop.license.evidence).toBeTruthy()

      if (prop.sockets) {
        for (const [, pos] of Object.entries(prop.sockets)) {
          expect(Array.isArray(pos)).toBe(true)
          expect(pos).toHaveLength(3)
        }
      }
    }
  })

  it('verifies sanctuary.glb matches manifest node set and size cap', () => {
    expect(fs.existsSync(glbPath)).toBe(true)
    const glbData = fs.readFileSync(glbPath)
    const jsonLength = glbData.readUInt32LE(12)
    const doc = JSON.parse(glbData.subarray(20, 20 + jsonLength).toString('utf8'))

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    const manifestIds = manifest.props.map((p: { id: string }) => p.id)
    const glbNodeNames = (doc.nodes ?? []).map((n: { name: string }) => n.name)

    expect(glbNodeNames).toHaveLength(57)
    expect(new Set(glbNodeNames).size).toBe(57)

    for (const id of manifestIds) {
      expect(glbNodeNames).toContain(id)
    }

    expect(glbData.length).toBeLessThan(manifest.hardCapMb * 1024 * 1024)
    expect(doc.skins ?? []).toHaveLength(0)
    expect(doc.animations ?? []).toHaveLength(0)
  })
})
