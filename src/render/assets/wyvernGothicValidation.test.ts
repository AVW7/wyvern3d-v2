import { execSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()

describe('Wyvern Gothic V2 Asset Validation Gate', () => {
  it('passes three.js runtime validation (mirroring, seams, cadences, t=0 starts)', () => {
    const output = execSync('node scripts/validate-wyvern-clips.mjs', {
      cwd: ROOT,
      encoding: 'utf8',
    })
    expect(output).toContain('wyvern.glb clean: wings mirrored, loops closed')
    expect(output).not.toContain('problem(s):')
  })

  it('matches the pinned glTF JSON rig contract (92 joints, 18 clips, hierarchy)', () => {
    const output = execSync(
      'python3 scripts/blender/audit_glb.py public/models/wyvern-gothic.glb',
      {
        cwd: ROOT,
        encoding: 'utf8',
      },
    )
    const report = JSON.parse(output)
    expect(report.passed).toBe(true)
    expect(report.errors).toEqual([])
    expect(report.joint_count).toBe(92)
    expect(report.clip_count).toBe(18)
    expect(report.scene_roots).toContain('WyvernRig')
  })
})
