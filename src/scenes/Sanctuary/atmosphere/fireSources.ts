import type { SanctuaryPlacedObject } from '@/core/types'

/**
 * Which sanctuary props are fires, and where their flame actually sits.
 *
 * Pure arithmetic over the placed layout, so the light budget can be unit
 * tested without a WebGL context. Flame heights are *measured* from
 * `public/models/sanctuary.glb`, not guessed — every prop in the atlas rests on
 * y=0, and the numbers below are each prop's own height:
 *
 *   torch 1.924   campfire 0.567   forge.furnace 5.356
 *   burn.volcano 8.576   burn.lavaStone 1.987
 */

export type FireKind = 'torch' | 'campfire' | 'furnace' | 'volcano' | 'lavaStone'

interface FireSpec {
  kind: FireKind
  /** Flame centre above the prop's base, before the object's own scale. */
  height: number
  /** Radius of the visible flame billboard. */
  size: number
  color: string
  /** Peak point-light intensity when this source is the nearest one lit. */
  intensity: number
  /** Point-light falloff distance. */
  distance: number
  /**
   * Emissive strength applied to the prop's own material.
   *
   * The atlas ships one `PP_Palette` material with a base-colour texture and no
   * emissive map, so this lights the *whole* prop uniformly rather than just
   * its flame. Values are therefore deliberately low, and scale down as the
   * prop gets bigger — a 10-metre volcano glowing at full strength reads as
   * plastic. The additive flame sprite carries the actual brightness; this is
   * only the warm cast on the body around it. Masking the glow properly would
   * mean adding an emissive texture to the atlas, which is an asset-pipeline
   * change in `scripts/extract-assets.py`, not a runtime one.
   */
  emissiveIntensity: number
}

export const FIRE_SPECS: Record<string, FireSpec> = {
  'prop.torch': {
    kind: 'torch',
    height: 1.92,
    size: 0.3,
    color: '#ff9a3c',
    intensity: 9,
    distance: 14,
    emissiveIntensity: 0.35,
  },
  'prop.campfire': {
    kind: 'campfire',
    height: 0.52,
    size: 0.62,
    color: '#ff8a2a',
    intensity: 11,
    distance: 16,
    emissiveIntensity: 0.5,
  },
  'prop.forge.furnace': {
    // The fire is the furnace mouth, low on a 5.36-tall body — not the roof.
    kind: 'furnace',
    height: 1.5,
    size: 0.7,
    color: '#ff6a18',
    intensity: 13,
    distance: 18,
    emissiveIntensity: 0.3,
  },
  'prop.burn.volcano': {
    kind: 'volcano',
    height: 8.2,
    size: 1.9,
    color: '#ff4a10',
    intensity: 14,
    distance: 26,
    emissiveIntensity: 0.22,
  },
  'prop.burn.lavaStone': {
    kind: 'lavaStone',
    height: 0.85,
    size: 0.45,
    color: '#ff5a1e',
    intensity: 5,
    distance: 9,
    emissiveIntensity: 0.85,
  },
}

export interface FireSource {
  id: string
  propId: string
  spec: FireSpec
  /** World position of the flame itself. */
  position: [number, number, number]
  scale: number
}

export function isFireProp(propId: string): boolean {
  return propId in FIRE_SPECS
}

/**
 * Emissive settings per fire prop, precomputed so callers pass a stable object
 * identity into the material cache rather than a fresh literal each render.
 */
const EMISSIVE: Record<string, { color: string; intensity: number }> = Object.fromEntries(
  Object.entries(FIRE_SPECS).map(([propId, spec]) => [
    propId,
    { color: spec.color, intensity: spec.emissiveIntensity },
  ]),
)

export function emissiveFor(propId: string): { color: string; intensity: number } | undefined {
  return EMISSIVE[propId]
}

/** Every fire in the current layout, flame position resolved. */
export function fireSourcesFor(objects: SanctuaryPlacedObject[] | undefined): FireSource[] {
  if (!objects) return []
  const sources: FireSource[] = []
  for (const object of objects) {
    const spec = FIRE_SPECS[object.propId]
    if (!spec) continue
    const scale = object.scale ?? 1
    sources.push({
      id: object.id,
      propId: object.propId,
      spec,
      scale,
      position: [object.position[0], object.position[1] + spec.height * scale, object.position[2]],
    })
  }
  return sources
}

/**
 * The lights actually worth spending.
 *
 * Every fire keeps its emissive material and its flame billboard, which is all
 * that reads at range. Real point lights are the expensive part — each one adds
 * an iteration to the fragment shader of every lit material in the scene — so
 * only the nearest few get one. The default layout already has six fires and
 * the editor lets the player place ten more, so this cull is not optional.
 *
 * Ties break on id so the selection is stable frame to frame and a light does
 * not flicker between two equidistant torches.
 */
export function selectLitSources(
  sources: FireSource[],
  origin: readonly [number, number],
  budget: number,
): FireSource[] {
  if (budget <= 0) return []
  return [...sources]
    .map((source) => ({
      source,
      distance: Math.hypot(source.position[0] - origin[0], source.position[2] - origin[1]),
    }))
    .sort((a, b) =>
      a.distance === b.distance
        ? a.source.id.localeCompare(b.source.id)
        : a.distance - b.distance,
    )
    .slice(0, budget)
    .map((entry) => entry.source)
}
