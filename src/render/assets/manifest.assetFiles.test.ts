import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ASSETS, type AssetId } from './manifest'

/**
 * Slots whose GLB has not been produced yet.
 *
 * A manifest entry with a non-null `url` goes straight into `useGLTF`, so a
 * missing file throws while rendering. `GameModel` now catches that and falls
 * back to the procedural placeholder, but the asset is still absent — this list
 * is the record of which ones, so a *new* broken path fails the suite instead of
 * silently degrading every model in the scene it appears in.
 */
const AWAITING_ART: AssetId[] = []

function publicPath(url: string): URL {
  return new URL(`../../../public${url}`, import.meta.url)
}

describe('manifest asset files', () => {
  const referenced = (Object.entries(ASSETS) as [AssetId, (typeof ASSETS)[AssetId]][])
    .filter(([, entry]) => entry?.url)
    .map(([id, entry]) => [id, entry!.url!] as const)

  it.each(referenced.filter(([id]) => !AWAITING_ART.includes(id)))(
    '%s resolves to a file on disk',
    (_id, url) => {
      expect(existsSync(publicPath(url))).toBe(true)
    },
  )

  it('keeps the awaiting-art list honest', () => {
    // A stale exclusion is worse than none: it silently stops gating an asset
    // that has since landed. Anything still listed must genuinely be missing.
    for (const id of AWAITING_ART) {
      const url = ASSETS[id]?.url
      expect(url, `${id} needs a url or it does not belong in AWAITING_ART`).toBeTruthy()
      expect(
        existsSync(publicPath(url!)),
        `${id} now exists on disk — remove it from AWAITING_ART so it is gated`,
      ).toBe(false)
    }
  })

  it('ensures all wyvern models have opaque skin materials (not alphaMode BLEND)', async () => {
    const wyvernAssets = (Object.entries(ASSETS) as [AssetId, (typeof ASSETS)[AssetId]][])
      .filter(([id, entry]) => id.startsWith('wyvern.') && entry?.url)
      .map(([id, entry]) => [id, entry!.url!] as const)

    const { readFileSync } = await import('node:fs')
    for (const [id, url] of wyvernAssets) {
      const filePath = publicPath(url)
      const data = readFileSync(filePath)
      const jsonLength = data.readUInt32LE(12)
      const gltf = JSON.parse(data.subarray(20, 20 + jsonLength).toString('utf8'))
      const materials = gltf.materials ?? []
      for (const mat of materials) {
        expect(
          mat.alphaMode,
          `${id} material "${mat.name}" in ${url} must not use alphaMode BLEND (causes transparent/see-through rendering)`,
        ).not.toBe('BLEND')
      }
    }
  })
})
