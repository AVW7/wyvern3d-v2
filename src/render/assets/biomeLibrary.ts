import { BIOME_PROP_ATLAS, PROP_ATLAS } from './manifest'

/**
 * What each biome scatters.
 *
 * This is the data half of biome dressing: which props, how many, and in which
 * radius band. The placement maths lives in
 * scenes/BiomeWorld/dressing/biomeScatter.ts, and the component that reads both
 * is BiomeDressing.
 *
 * Prop ids come from the biome atlas (scripts/biome-library.json, built by
 * scripts/build-biome-atlas.mjs). A layer may name the sanctuary atlas instead
 * when a sanctuary prop is the right dressing — that is what `atlas` is for.
 *
 * Counts are a density budget, not art direction: large silhouettes stay well
 * under 30 per biome and ground scatter under 60, which is what keeps a biome
 * affordable at BIOME_WORLD_RADIUS = 110 m.
 */
export interface BiomeLayer {
  /** Logical prop id, e.g. `prop.biome.tree.canopy`. */
  prop: string
  /** Atlas the prop lives in. Defaults to the biome atlas. */
  atlas?: string
  count: number
  /** Placement band from the world centre, in metres. */
  radius: [number, number]
  /** Per-instance scale range. */
  scale: [number, number]
  /** Sway amplitude per metre of height. Omit for rigid props. */
  wind?: number
  castShadow?: boolean
  /** Cosmetic tint, applied to a cloned material. */
  color?: string
}

const R = 110

/** Ground scatter shared by every green biome, at biome-specific density. */
function undergrowth(count: number, prop = 'prop.biome.grass.tuftA'): BiomeLayer {
  return { prop, count, radius: [8, R - 18], scale: [0.8, 1.6], wind: 0.06, castShadow: false }
}

export const BIOME_DRESSING: Record<string, BiomeLayer[]> = {
  valley: [
    { prop: 'prop.biome.tree.broadleaf', count: 16, radius: [22, R - 18], scale: [0.85, 1.2], wind: 0.012 },
    { prop: 'prop.biome.tree.crown', count: 12, radius: [18, R - 24], scale: [0.85, 1.25], wind: 0.016 },
    { prop: 'prop.biome.tree.apple', count: 10, radius: [16, R - 30], scale: [0.9, 1.3], wind: 0.02 },
    { prop: 'prop.biome.landmark.well', count: 2, radius: [18, 34], scale: [1, 1.1] },
    { prop: 'prop.biome.rock.pebble', count: 16, radius: [10, R - 25], scale: [0.7, 1.4] },
    undergrowth(48),
  ],
  forest: [
    // A handful of emergent trees over the canopy, so the treeline has a top edge.
    { prop: 'prop.biome.tree.hero', count: 6, radius: [30, R - 16], scale: [0.9, 1.15], wind: 0.008 },
    { prop: 'prop.biome.tree.canopy', count: 20, radius: [24, R - 14], scale: [0.85, 1.25], wind: 0.01 },
    { prop: 'prop.biome.tree.broadleaf', count: 24, radius: [18, R - 12], scale: [0.8, 1.3], wind: 0.012 },
    { prop: 'prop.biome.tree.sapling', count: 22, radius: [12, R - 20], scale: [0.8, 1.4], wind: 0.02 },
    { prop: 'prop.biome.rock.pebble', count: 18, radius: [10, R - 25], scale: [0.7, 1.3] },
    undergrowth(52),
    undergrowth(28, 'prop.biome.grass.tuftB'),
  ],
  coast: [
    { prop: 'prop.biome.rock.smallB', count: 22, radius: [14, R - 16], scale: [0.8, 1.6] },
    { prop: 'prop.biome.rock.cluster', count: 10, radius: [26, R - 22], scale: [0.9, 1.5] },
    { prop: 'prop.biome.rock.pebble', count: 26, radius: [8, R - 20], scale: [0.6, 1.3] },
    { prop: 'prop.biome.prop.amphora', count: 6, radius: [16, 46], scale: [0.9, 1.2] },
    undergrowth(22),
  ],
  marsh: [
    { prop: 'prop.biome.tree.gnarlA', count: 14, radius: [20, R - 20], scale: [0.85, 1.3], wind: 0.014, color: '#5c6b52' },
    { prop: 'prop.biome.rock.smallA', count: 14, radius: [12, R - 25], scale: [0.8, 1.5] },
    undergrowth(42, 'prop.biome.grass.tuftB'),
  ],
  moor: [
    { prop: 'prop.biome.rock.smallB', count: 24, radius: [14, R - 16], scale: [0.8, 1.7] },
    { prop: 'prop.biome.rock.cluster', count: 12, radius: [24, R - 22], scale: [0.9, 1.4] },
    { prop: 'prop.biome.landmark.obelisk', count: 3, radius: [30, 62], scale: [0.9, 1.15] },
    undergrowth(30, 'prop.biome.grass.tuftB'),
  ],
  swamp: [
    { prop: 'prop.biome.tree.gnarlA', count: 16, radius: [18, R - 18], scale: [0.85, 1.25], wind: 0.014, color: '#4d5a44' },
    { prop: 'prop.biome.tree.gnarlB', count: 8, radius: [26, R - 24], scale: [0.9, 1.2], wind: 0.012, color: '#43503c' },
    { prop: 'prop.biome.rock.smallA', count: 12, radius: [12, R - 30], scale: [0.8, 1.4] },
    undergrowth(38, 'prop.biome.grass.tuftB'),
  ],
  mountain: [
    { prop: 'prop.biome.rock.cliff', count: 8, radius: [34, R - 14], scale: [0.85, 1.35] },
    { prop: 'prop.biome.rock.cluster', count: 16, radius: [20, R - 18], scale: [0.9, 1.6] },
    { prop: 'prop.biome.rock.smallB', count: 24, radius: [12, R - 22], scale: [0.7, 1.5] },
    { prop: 'prop.biome.tree.conifer', count: 12, radius: [24, R - 26], scale: [0.8, 1.2], wind: 0.012 },
  ],
  highland: [
    { prop: 'prop.biome.tree.conifer', count: 18, radius: [20, R - 16], scale: [0.85, 1.3], wind: 0.012 },
    { prop: 'prop.biome.rock.cluster', count: 14, radius: [22, R - 20], scale: [0.85, 1.4] },
    { prop: 'prop.biome.rock.smallA', count: 20, radius: [12, R - 24], scale: [0.7, 1.4] },
    { prop: 'prop.biome.landmark.obelisk', count: 2, radius: [28, 54], scale: [0.9, 1.1] },
    undergrowth(32),
  ],
  cavern: [
    { prop: 'prop.biome.cave.pillar', count: 10, radius: [26, R - 20], scale: [0.8, 1.3] },
    { prop: 'prop.biome.cave.stump', count: 14, radius: [16, R - 24], scale: [0.8, 1.5] },
    { prop: 'prop.biome.cave.rubble', count: 26, radius: [8, R - 20], scale: [0.7, 1.6] },
    { prop: 'prop.biome.crystal.cluster', count: 12, radius: [14, R - 30], scale: [0.8, 1.5] },
    { prop: 'prop.biome.crystal.shard', count: 16, radius: [10, R - 26], scale: [0.7, 1.4] },
  ],
  jungle: [
    { prop: 'prop.biome.tree.hero', count: 5, radius: [26, R - 16], scale: [0.95, 1.2], wind: 0.008 },
    { prop: 'prop.biome.tree.canopy', count: 24, radius: [20, R - 12], scale: [0.9, 1.3], wind: 0.01 },
    { prop: 'prop.biome.tree.crown', count: 14, radius: [12, R - 26], scale: [0.8, 1.3], wind: 0.016 },
    { prop: 'prop.biome.tree.broadleaf', count: 26, radius: [14, R - 14], scale: [0.85, 1.35], wind: 0.012 },
    { prop: 'prop.biome.tree.sapling', count: 24, radius: [10, R - 20], scale: [0.85, 1.5], wind: 0.02 },
    undergrowth(56, 'prop.biome.grass.tuftB'),
  ],
  grove: [
    // The world tree and its stone ring own everything inside 32 m.
    { prop: 'prop.biome.tree.canopy', count: 18, radius: [36, R - 14], scale: [0.9, 1.25], wind: 0.01 },
    { prop: 'prop.biome.tree.broadleaf', count: 16, radius: [34, R - 18], scale: [0.85, 1.25], wind: 0.012 },
    { prop: 'prop.biome.landmark.shrine', count: 1, radius: [40, 40], scale: [1, 1] },
    { prop: 'prop.biome.crystal.shard', count: 8, radius: [34, R - 30], scale: [0.7, 1.2] },
    undergrowth(44),
  ],
  ashland: [
    { prop: 'prop.biome.tree.gnarlB', count: 12, radius: [20, R - 20], scale: [0.8, 1.15], color: '#3b3330' },
    { prop: 'prop.biome.rock.cliff', count: 6, radius: [36, R - 16], scale: [0.85, 1.2], color: '#4a423d' },
    { prop: 'prop.biome.rock.cluster', count: 14, radius: [18, R - 22], scale: [0.85, 1.5], color: '#4a423d' },
    { prop: 'prop.biome.cave.rubble', count: 20, radius: [10, R - 24], scale: [0.7, 1.4], color: '#443c38' },
  ],
  tundra: [
    { prop: 'prop.biome.tree.conifer', count: 14, radius: [22, R - 18], scale: [0.75, 1.15], wind: 0.012 },
    { prop: 'prop.biome.rock.smallB', count: 20, radius: [12, R - 20], scale: [0.7, 1.5] },
    { prop: 'prop.biome.crystal.cluster', count: 8, radius: [24, R - 28], scale: [0.8, 1.3] },
    { prop: 'prop.biome.rock.pebble', count: 22, radius: [8, R - 24], scale: [0.6, 1.2] },
  ],
  barrens: [
    { prop: 'prop.biome.rock.smallA', count: 24, radius: [12, R - 18], scale: [0.7, 1.6] },
    { prop: 'prop.biome.rock.cluster', count: 10, radius: [26, R - 24], scale: [0.85, 1.4] },
    { prop: 'prop.biome.landmark.hut', count: 2, radius: [22, 44], scale: [0.95, 1.15] },
    { prop: 'prop.biome.landmark.obelisk', count: 3, radius: [30, 66], scale: [0.85, 1.1] },
    { prop: 'prop.biome.prop.amphora', count: 5, radius: [18, 40], scale: [0.9, 1.15] },
  ],
  spire: [
    { prop: 'prop.biome.landmark.obelisk', count: 5, radius: [24, 70], scale: [0.9, 1.25] },
    { prop: 'prop.biome.landmark.shrine', count: 1, radius: [34, 34], scale: [1, 1] },
    { prop: 'prop.biome.crystal.cluster', count: 14, radius: [16, R - 24], scale: [0.85, 1.6] },
    { prop: 'prop.biome.crystal.shard', count: 18, radius: [12, R - 26], scale: [0.7, 1.4] },
    { prop: 'prop.biome.rock.cliff', count: 5, radius: [40, R - 16], scale: [0.85, 1.2] },
  ],
}

/** Atlas a layer draws from. */
export function layerAtlas(layer: BiomeLayer): string {
  return layer.atlas ?? BIOME_PROP_ATLAS
}

/** True when the layer comes from the sanctuary atlas rather than the biome one. */
export function isSanctuaryLayer(layer: BiomeLayer): boolean {
  return layerAtlas(layer) === PROP_ATLAS
}
