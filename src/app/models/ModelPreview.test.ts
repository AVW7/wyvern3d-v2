import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./ModelPreview.tsx', import.meta.url), 'utf8')

describe('Model Library preview framing', () => {
  it('refits after the real GLB loads instead of framing the fallback', () => {
    expect(source).toContain('onReady={fitLoadedModel}')
    expect(source).toContain('bounds.refresh().clip().fit()')
  })

  it('resets the camera when selecting another model', () => {
    expect(source).toContain('<Canvas key={id}')
  })

  it('measures a posed skeleton rather than three\'s stale bind-pose cache', () => {
    // Box3.expandByObject fills SkinnedMesh.boundingBox the first time it is
    // asked and never invalidates it. Bounds asks on mount, before the skeleton
    // is posed, so the fit has to drop that cache and wait for a rendered frame.
    expect(source).toContain('cache.boundingBox = null')
    expect(source).toContain('cache.boundingSphere = null')
    expect(source).toContain('framesUntilFit.current = 2')
    expect(source).toContain('useFrame')
  })

  it('calculates and passes model stats on load', () => {
    expect(source).toContain('onLoadStats')
    expect(source).toContain('child instanceof Mesh')
    expect(source).toContain('child instanceof Bone')
  })
})
