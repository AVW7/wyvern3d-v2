import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./ModelPreview.tsx', import.meta.url), 'utf8')
const stageSource = readFileSync(new URL('./components/PreviewStage.tsx', import.meta.url), 'utf8')

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

describe('Model Library playback controls', () => {
  it('pauses through GameModel\'s frozen seam, not by stopping the mixer', () => {
    expect(source).toContain('frozen={paused}')
    expect(source).not.toContain('mixer.stopAllAction()')
  })

  it('applies the preview rate at the mixer so ClipSpec cadences still apply', () => {
    expect(source).toContain('mixer.timeScale = rate')
    expect(source).not.toContain('action.timeScale = rate')
  })

  it('drives the turntable through OrbitControls autoRotate', () => {
    expect(source).toContain('autoRotate={turntable}')
  })

  it('toggles wireframe only on materials the preview instance owns', () => {
    // The clone shares materials with the cached GLTF scene, so flipping
    // `wireframe` in place would flip it in every other scene mounting the
    // same file. The stats pass must clone first.
    expect(source).toContain("const own = (slot: Material): Material => slot.clone()")
    expect(source).toContain('(slot as MeshStandardMaterial).wireframe = wireframe')
  })

  it('renders the stage toolbar only for models with a GLB', () => {
    expect(stageSource).toContain('{asset.url && (')
    expect(stageSource).toContain('<StageControls')
  })
})

const librarySource = readFileSync(new URL('./ModelLibrary.tsx', import.meta.url), 'utf8')

describe('Model Library payload inspection', () => {
  it('heads every file GameModel will fetch, never the GLB body', () => {
    expect(librarySource).toContain('payloadUrls(selected)')
    expect(librarySource).toContain("fetch(url, { method: 'HEAD' })")
    expect(librarySource).not.toContain("method: 'GET'")
  })
})
