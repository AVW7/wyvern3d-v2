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
})
