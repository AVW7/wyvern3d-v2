import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ASSETS } from './manifest'

interface Inspection {
  bounds: { min: number[]; size: number[] }
  counts: { triangles: number; skins: number; animations: number }
  clips: { name: string }[]
  fit: { targetHeightMetres: number; scale: number; yOffsetRigUnits: number; fittedSizeMetres: number[] }
}

function inspect(file: string, targetHeight: number): Inspection {
  const output = execFileSync(
    process.execPath,
    ['scripts/inspect-model-asset.mjs', file, String(targetHeight)],
    { encoding: 'utf8' },
  )
  return JSON.parse(output) as Inspection
}

function glbJson(file: string): { extensionsRequired?: string[] } {
  const bytes = readFileSync(file)
  const jsonLength = bytes.readUInt32LE(12)
  return JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'))
}

describe('wildlife prey models', () => {
  it.each([
    {
      id: 'wildlife.deer' as const,
      file: 'public/models/wildlife/doe.glb',
      height: 1.35,
      triangles: 19_950,
      animations: 46,
      clips: ['SK-Deer_Female|AA_Stand_Idle_01', 'SK-Deer_Female|Loco_Walk', 'SK-Deer_Female|Stand_Eating_01'],
    },
    {
      id: 'wildlife.guineafowl' as const,
      file: 'public/models/wildlife/guineafowl.glb',
      height: 0.55,
      triangles: 9_105,
      animations: 3,
      clips: ['Guineafowl|Guineafowl_A_Idle', 'Guineafowl|Guineafowl_A_WalkMedium', 'Guineafowl|Guineafowl_B_FlyFlapping'],
    },
    {
      id: 'wildlife.rabbit' as const,
      file: 'public/models/wildlife/rabbit.glb',
      height: 0.4,
      triangles: 2_578,
      animations: 1,
      clips: ['Take 001'],
    },
  ])('$id stays grounded, correctly sized, rigged, and within the web budget', ({ id, file, height, triangles, animations, clips }) => {
    const report = inspect(file, height)
    const entry = ASSETS[id]!

    expect(report.counts.triangles).toBe(triangles)
    expect(report.counts.triangles).toBeLessThanOrEqual(30_000)
    expect(report.counts.skins).toBe(1)
    expect(report.counts.animations).toBe(animations)
    expect(report.fit.fittedSizeMetres[1]).toBeCloseTo(height, 3)
    expect(entry.scale).toBeCloseTo(report.fit.scale, 4)
    expect(entry.yOffset).toBeCloseTo(report.fit.yOffsetRigUnits, 4)
    expect((report.bounds.min[1]! + report.fit.yOffsetRigUnits) * report.fit.scale).toBeCloseTo(0, 4)
    expect(report.clips.map((clip) => clip.name)).toEqual(expect.arrayContaining(clips))
  })

  it('ships no deprecated required specular/gloss material extension', () => {
    expect(glbJson('public/models/wildlife/doe.glb').extensionsRequired ?? [])
      .not.toContain('KHR_materials_pbrSpecularGlossiness')
    expect(glbJson('public/models/wildlife/guineafowl.glb').extensionsRequired ?? [])
      .not.toContain('KHR_materials_pbrSpecularGlossiness')
  })
})
