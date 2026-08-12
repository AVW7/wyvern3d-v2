import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

import { ASSETS } from './manifest'

describe('Arcane Handler asset', () => {
  const player = ASSETS['character.player']

  it('loads the base model and every animation sidecar', () => {
    expect(player.url).toBe('/models/arcane-handler.glb')
    expect(player.animationUrls).toEqual([
      '/models/arcane-handler-animations/idle.glb',
      '/models/arcane-handler-animations/walk.glb',
      '/models/arcane-handler-animations/run.glb',
      '/models/arcane-handler-animations/offer.glb',
      '/models/arcane-handler-animations/pet.glb',
      '/models/arcane-handler-animations/calm.glb',
      '/models/arcane-handler-animations/inspect.glb',
    ])
  })

  it.each(['offer', 'pet', 'calm', 'inspect'] as const)('%s is a one-shot gesture', (state) => {
    const spec = player.animations?.[state]
    expect(Array.isArray(spec) ? spec[0]?.loop : spec?.loop).toBe(false)
  })

  it('ships the generated 30k-triangle LOD', () => {
    const data = readFileSync(new URL('../../../public/models/arcane-handler.glb', import.meta.url))
    const jsonLength = data.readUInt32LE(12)
    const gltf = JSON.parse(data.subarray(20, 20 + jsonLength).toString('utf8'))
    expect(gltf.asset.extras.wyvern3dLod).toEqual({
      sourceTriangles: 55_928,
      targetTriangles: 29_997,
    })
  })
})
