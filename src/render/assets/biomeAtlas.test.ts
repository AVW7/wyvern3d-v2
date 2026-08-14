import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BIOME_PROP_ATLAS } from './manifest'

interface LibraryEntry {
  id: string
  targetHeight: number
  sink?: number
  maxTriangles?: number
  license: { status: string; evidence: string | null }
}

const manifest: { props: LibraryEntry[] } = JSON.parse(
  readFileSync(new URL('../../../scripts/biome-library.json', import.meta.url), 'utf8'),
)
const approved = manifest.props.filter((entry) => entry.license.status === 'approved')
const atlas = new URL(`../../../public${BIOME_PROP_ATLAS}`, import.meta.url)

/**
 * The atlas is generated from sources outside the repository and only ships
 * props whose licence is recorded, so its absence is a legitimate state — but
 * only while nothing is approved. Anything else is a missing build.
 */
describe('biome prop atlas', () => {
  it('exists whenever the library approves a prop', () => {
    expect(
      approved.length === 0 || existsSync(atlas),
      `${approved.length} approved props but no built atlas — run pnpm assets:biome-atlas`,
    ).toBe(true)
  })

  it.skipIf(!existsSync(atlas))('ships every approved prop at its authored size', () => {
    const data = readFileSync(atlas)
    expect(data.length).toBeLessThan(15 * 1024 * 1024)

    const jsonLength = data.readUInt32LE(12)
    const gltf = JSON.parse(data.subarray(20, 20 + jsonLength).toString('utf8'))
    expect(gltf.skins).toBeUndefined()
    expect(gltf.animations).toBeUndefined()

    const measured: Record<string, { height: number; triangles: number }> = Object.fromEntries(
      gltf.asset.extras.wyvern3dBiomeAtlas.map((entry: { id: string; height: number; triangles: number }) => [
        entry.id,
        entry,
      ]),
    )

    for (const entry of approved) {
      const node = gltf.nodes.find((candidate: { name: string }) => candidate.name === entry.id)
      expect(node, `${entry.id} missing from the atlas`).toBeDefined()
      const stats = measured[entry.id]
      expect(stats, `${entry.id} has no recorded measurements`).toBeDefined()
      expect(stats?.height).toBeCloseTo(entry.targetHeight, 2)
      if (entry.maxTriangles) expect(stats?.triangles ?? 0).toBeLessThanOrEqual(entry.maxTriangles)

      // Ground contact: every prop rests on y=0 unless it is authored to sink.
      // The tolerance is 5 cm because the anchor is measured before
      // simplification, which can drop the single lowest vertex.
      const primitives = gltf.meshes[node.mesh].primitives
      const bottom = Math.min(
        ...primitives.map((primitive: { attributes: { POSITION: number } }) => gltf.accessors[primitive.attributes.POSITION].min[1]),
      )
      expect(Math.abs(bottom + (entry.sink ?? 0)), `${entry.id} rests at y=${bottom}`).toBeLessThanOrEqual(0.05)
    }
  })
})
