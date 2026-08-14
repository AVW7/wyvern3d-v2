import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BIOME_PALETTES } from '@/scenes/BiomeWorld/atmosphere/biomePalettes'
import { BIOME_WORLD_RADIUS } from '@/scenes/BiomeWorld/terrain/biomeHeight'
import { BIOME_DRESSING, layerAtlas } from './biomeLibrary'
import { BIOME_PROP_ATLAS, PROP_ATLAS } from './manifest'

interface LibraryManifest {
  props: { id: string; license: { status: string } }[]
}

const manifest: LibraryManifest = JSON.parse(
  readFileSync(new URL('../../../scripts/biome-library.json', import.meta.url), 'utf8'),
)
const biomeProps = new Set(manifest.props.map((entry) => entry.id))

describe('biome dressing library', () => {
  it('dresses every biome the world can show', () => {
    for (const biome of Object.keys(BIOME_PALETTES)) {
      expect(BIOME_DRESSING[biome], `${biome} has no dressing`).toBeDefined()
      expect(BIOME_DRESSING[biome]?.length ?? 0).toBeGreaterThan(0)
    }
  })

  it('only references props that the atlas actually builds', () => {
    for (const [biome, layers] of Object.entries(BIOME_DRESSING)) {
      for (const layer of layers) {
        if (layerAtlas(layer) === PROP_ATLAS) continue
        expect(layerAtlas(layer)).toBe(BIOME_PROP_ATLAS)
        expect(biomeProps.has(layer.prop), `${biome}: unknown prop ${layer.prop}`).toBe(true)
      }
    }
  })

  it('keeps placements inside the world and within the density budget', () => {
    for (const [biome, layers] of Object.entries(BIOME_DRESSING)) {
      const total = layers.reduce((sum, layer) => sum + layer.count, 0)
      expect(total, `${biome} scatters ${total} props`).toBeLessThanOrEqual(200)
      for (const layer of layers) {
        expect(layer.radius[0]).toBeLessThanOrEqual(layer.radius[1])
        expect(layer.radius[1], `${biome}: ${layer.prop} reaches past the world edge`).toBeLessThanOrEqual(BIOME_WORLD_RADIUS)
        expect(layer.scale[0]).toBeGreaterThan(0)
        expect(layer.scale[0]).toBeLessThanOrEqual(layer.scale[1])
      }
    }
  })

  it('places nothing outside the world radius the terrain builds', () => {
    // biomeLibrary carries its own copy of the radius so that render/ does not
    // import from scenes/. This is the check that keeps the two in step.
    const reach = Math.max(...Object.values(BIOME_DRESSING).flatMap((layers) => layers.map((layer) => layer.radius[1])))
    expect(reach).toBe(BIOME_WORLD_RADIUS - 12)
  })
})
