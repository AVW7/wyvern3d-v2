import { ARCANE_PROP_ATLAS, BIOME_PROP_ATLAS, BONE_PROP_ATLAS, CORRUPT_PROP_ATLAS, FUNGAL_PROP_ATLAS, REED_PROP_ATLAS, RUIN_PROP_ATLAS, TERRAIN_PROP_ATLAS, WATER_PROP_ATLAS } from './manifest'

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

/**
 * Bone scatter from the generated bone atlas.
 *
 * Sparse on purpose: a ribcage is a story, and a field of them is wallpaper.
 * Large pieces stay in single digits; only the loose bones go above ten.
 */
function bones(prop: 'ribcage' | 'skull' | 'scatter', count: number, band: [number, number]): BiomeLayer {
  return {
    prop: `prop.bone.${prop}`,
    atlas: BONE_PROP_ATLAS,
    count,
    radius: band,
    scale: prop === 'scatter' ? [0.8, 1.4] : [0.85, 1.25],
    castShadow: prop !== 'scatter',
  }
}

/**
 * Freshwater from the generated water atlas.
 *
 * Only for biomes with no water body of their own — adding a pool to a fen that
 * biomeWater.ts already floods buys nothing and can place a disc under the bog
 * surface, where it is never seen.
 */
function water(
  prop: 'pool' | 'creek' | 'puddle',
  count: number,
  band: [number, number],
  color: string,
): BiomeLayer {
  return {
    prop: `prop.water.${prop}`,
    atlas: WATER_PROP_ATLAS,
    count,
    radius: band,
    scale: prop === 'puddle' ? [0.7, 1.3] : [0.85, 1.35],
    castShadow: false,
    color,
  }
}

/**
 * Fungus from the generated fungal atlas.
 *
 * Only the giant cap casts a shadow — cluster and bracket sit close enough to
 * the ground that a shadow map costs more than it shows.
 */
function fungal(
  prop: 'cluster' | 'shelf' | 'giant',
  count: number,
  band: [number, number],
  color: string,
): BiomeLayer {
  return {
    prop: `prop.fungal.${prop}`,
    atlas: FUNGAL_PROP_ATLAS,
    count,
    radius: band,
    scale: prop === 'giant' ? [0.8, 1.3] : [0.75, 1.45],
    castShadow: prop === 'giant',
    color,
  }
}

/** Ruined masonry from the generated ruin atlas. */
function ruin(
  prop: 'column' | 'wall' | 'rubble',
  count: number,
  band: [number, number],
  color: string,
): BiomeLayer {
  return {
    prop: `prop.ruin.${prop}`,
    atlas: RUIN_PROP_ATLAS,
    count,
    radius: band,
    scale: prop === 'rubble' ? [0.75, 1.4] : [0.85, 1.3],
    castShadow: prop !== 'rubble',
    color,
  }
}

/**
 * Worked arcane stone from the generated arcane atlas.
 *
 * The tint reaches the stone but not the glow: BiomeLayer `color` multiplies
 * base colour only, and the glyph material's light is emissive. That is the
 * right way round — an arcane light is its own thing, not a property of rock.
 */
function arcane(
  prop: 'runestone' | 'circle' | 'focus',
  count: number,
  band: [number, number],
  color: string,
): BiomeLayer {
  return {
    prop: `prop.arcane.${prop}`,
    atlas: ARCANE_PROP_ATLAS,
    count,
    radius: band,
    scale: prop === 'circle' ? [0.85, 1.25] : [0.85, 1.35],
    castShadow: prop !== 'circle',
    color,
  }
}

/** Corruption from the generated corrupt atlas. */
function corrupt(
  prop: 'growth' | 'scar' | 'bloom',
  count: number,
  band: [number, number],
  color: string,
): BiomeLayer {
  return {
    prop: `prop.corrupt.${prop}`,
    atlas: CORRUPT_PROP_ATLAS,
    count,
    radius: band,
    scale: prop === 'scar' ? [0.8, 1.5] : [0.8, 1.4],
    castShadow: prop !== 'scar',
    color,
  }
}

/**
 * Reeds from the generated reed atlas.
 *
 * The only generated props that carry `wind`. Everything else in the set is
 * bone, stone, water or fungus and is rigid; a still reed bed reads as plastic.
 * No shadow — thin stalks make a noisy shadow map for very little on screen.
 */
function reed(
  prop: 'bed' | 'cattail' | 'tussock',
  count: number,
  band: [number, number],
  color: string,
): BiomeLayer {
  return {
    prop: `prop.reed.${prop}`,
    atlas: REED_PROP_ATLAS,
    count,
    radius: band,
    scale: [0.75, 1.4],
    wind: prop === 'tussock' ? 0.05 : 0.07,
    castShadow: false,
    color,
  }
}

/** Deadwood, drifts and geysers from the generated terrain atlas. */
type TerrainProp = 'snag' | 'deadfall' | 'dune' | 'drift' | 'vent' | 'fumarole'

/** Which of them stand tall enough to be worth a shadow. */
const TERRAIN_SHADOWS: TerrainProp[] = ['snag', 'deadfall', 'vent']

function terrain(prop: TerrainProp, count: number, band: [number, number], color: string): BiomeLayer {
  return {
    prop: `prop.terrain.${prop}`,
    atlas: TERRAIN_PROP_ATLAS,
    count,
    radius: band,
    scale: prop === 'dune' || prop === 'drift' ? [0.8, 1.6] : [0.8, 1.3],
    castShadow: TERRAIN_SHADOWS.includes(prop),
    color,
  }
}

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
    water('pool', 3, [26, R - 30], '#3a6b60'),
    water('creek', 2, [30, R - 34], '#3a6b60'),
    water('puddle', 5, [18, R - 26], '#3a6b60'),
    terrain('snag', 4, [22, R - 26], '#8a7f6c'),
    terrain('deadfall', 4, [18, R - 24], '#8a7f6c'),
  ],
  coast: [
    { prop: 'prop.biome.rock.smallB', count: 22, radius: [14, R - 16], scale: [0.8, 1.6] },
    { prop: 'prop.biome.rock.cluster', count: 10, radius: [26, R - 22], scale: [0.9, 1.5] },
    { prop: 'prop.biome.rock.pebble', count: 26, radius: [8, R - 20], scale: [0.6, 1.3] },
    { prop: 'prop.biome.prop.amphora', count: 6, radius: [16, 46], scale: [0.9, 1.2] },
    undergrowth(22),
    ruin('column', 2, [30, R - 32], '#8f9694'),
    ruin('wall', 3, [26, R - 30], '#8f9694'),
    ruin('rubble', 6, [18, R - 24], '#8f9694'),
  ],
  marsh: [
    { prop: 'prop.biome.tree.gnarlA', count: 14, radius: [20, R - 20], scale: [0.85, 1.3], wind: 0.014, color: '#5c6b52' },
    { prop: 'prop.biome.rock.smallA', count: 14, radius: [12, R - 25], scale: [0.8, 1.5] },
    undergrowth(42, 'prop.biome.grass.tuftB'),
    reed('bed', 12, [12, R - 20], '#7d8a5e'),
    reed('cattail', 8, [14, R - 24], '#7d8a5e'),
    reed('tussock', 14, [10, R - 18], '#7d8a5e'),
  ],
  moor: [
    { prop: 'prop.biome.rock.smallB', count: 24, radius: [14, R - 16], scale: [0.8, 1.7] },
    { prop: 'prop.biome.rock.cluster', count: 12, radius: [24, R - 22], scale: [0.9, 1.4] },
    { prop: 'prop.biome.landmark.obelisk', count: 3, radius: [30, 62], scale: [0.9, 1.15] },
    undergrowth(30, 'prop.biome.grass.tuftB'),
    ruin('column', 1, [34, 70], '#8d8a80'),
    ruin('wall', 4, [24, R - 28], '#8d8a80'),
    ruin('rubble', 7, [16, R - 22], '#8d8a80'),
  ],
  swamp: [
    { prop: 'prop.biome.tree.gnarlA', count: 16, radius: [18, R - 18], scale: [0.85, 1.25], wind: 0.014, color: '#4d5a44' },
    { prop: 'prop.biome.tree.gnarlB', count: 8, radius: [26, R - 24], scale: [0.9, 1.2], wind: 0.012, color: '#43503c' },
    { prop: 'prop.biome.rock.smallA', count: 12, radius: [12, R - 30], scale: [0.8, 1.4] },
    undergrowth(38, 'prop.biome.grass.tuftB'),
    fungal('cluster', 8, [14, R - 22], '#7d8a72'),
    fungal('shelf', 5, [18, R - 26], '#7d8a72'),
    fungal('giant', 2, [30, R - 34], '#7d8a72'),
    reed('bed', 10, [12, R - 22], '#5f6b45'),
    reed('cattail', 5, [16, R - 26], '#5f6b45'),
    reed('tussock', 12, [10, R - 18], '#5f6b45'),
  ],
  mountain: [
    { prop: 'prop.biome.rock.cliff', count: 8, radius: [34, R - 14], scale: [0.85, 1.35] },
    { prop: 'prop.biome.rock.cluster', count: 16, radius: [20, R - 18], scale: [0.9, 1.6] },
    { prop: 'prop.biome.rock.smallB', count: 24, radius: [12, R - 22], scale: [0.7, 1.5] },
    { prop: 'prop.biome.tree.conifer', count: 12, radius: [24, R - 26], scale: [0.8, 1.2], wind: 0.012 },
    bones('skull', 2, [28, 70]),
    bones('scatter', 5, [20, R - 26]),
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
    fungal('cluster', 10, [12, R - 20], '#8fb0c4'),
    fungal('shelf', 3, [20, R - 28], '#8fb0c4'),
    fungal('giant', 3, [26, R - 32], '#8fb0c4'),
    arcane('runestone', 4, [18, R - 26], '#9fc6d8'),
    arcane('circle', 2, [24, 64], '#9fc6d8'),
    arcane('focus', 3, [22, R - 30], '#9fc6d8'),
  ],
  jungle: [
    { prop: 'prop.biome.tree.hero', count: 5, radius: [26, R - 16], scale: [0.95, 1.2], wind: 0.008 },
    { prop: 'prop.biome.tree.canopy', count: 24, radius: [20, R - 12], scale: [0.9, 1.3], wind: 0.01 },
    { prop: 'prop.biome.tree.crown', count: 14, radius: [12, R - 26], scale: [0.8, 1.3], wind: 0.016 },
    { prop: 'prop.biome.tree.broadleaf', count: 26, radius: [14, R - 14], scale: [0.85, 1.35], wind: 0.012 },
    { prop: 'prop.biome.tree.sapling', count: 24, radius: [10, R - 20], scale: [0.85, 1.5], wind: 0.02 },
    undergrowth(56, 'prop.biome.grass.tuftB'),
    water('pool', 2, [28, R - 32], '#2b5340'),
    water('creek', 2, [24, R - 30], '#2b5340'),
    water('puddle', 4, [16, R - 24], '#2b5340'),
    fungal('cluster', 7, [14, R - 22], '#b09a6a'),
    fungal('shelf', 5, [16, R - 26], '#b09a6a'),
    fungal('giant', 2, [32, R - 34], '#b09a6a'),
    ruin('column', 3, [26, R - 30], '#7d8a6e'),
    ruin('wall', 2, [30, R - 32], '#7d8a6e'),
    ruin('rubble', 4, [20, R - 26], '#7d8a6e'),
    corrupt('growth', 5, [18, R - 24], '#6b7a4a'),
    corrupt('bloom', 4, [16, R - 26], '#6b7a4a'),
    corrupt('scar', 3, [24, R - 30], '#6b7a4a'),
  ],
  grove: [
    // The world tree and its stone ring own everything inside 32 m.
    { prop: 'prop.biome.tree.canopy', count: 18, radius: [36, R - 14], scale: [0.9, 1.25], wind: 0.01 },
    { prop: 'prop.biome.tree.broadleaf', count: 16, radius: [34, R - 18], scale: [0.85, 1.25], wind: 0.012 },
    { prop: 'prop.biome.landmark.shrine', count: 1, radius: [40, 40], scale: [1, 1] },
    { prop: 'prop.biome.crystal.shard', count: 8, radius: [34, R - 30], scale: [0.7, 1.2] },
    undergrowth(44),
    arcane('runestone', 4, [24, R - 30], '#b8d49a'),
    arcane('circle', 3, [26, 68], '#b8d49a'),
    arcane('focus', 1, [34, 58], '#b8d49a'),
  ],
  ashland: [
    { prop: 'prop.biome.tree.gnarlB', count: 12, radius: [20, R - 20], scale: [0.8, 1.15], color: '#3b3330' },
    { prop: 'prop.biome.rock.cliff', count: 6, radius: [36, R - 16], scale: [0.85, 1.2], color: '#4a423d' },
    { prop: 'prop.biome.rock.cluster', count: 14, radius: [18, R - 22], scale: [0.85, 1.5], color: '#4a423d' },
    { prop: 'prop.biome.cave.rubble', count: 20, radius: [10, R - 24], scale: [0.7, 1.4], color: '#443c38' },
    bones('ribcage', 2, [26, R - 30]),
    bones('skull', 1, [30, 58]),
    bones('scatter', 6, [18, R - 24]),
    terrain('vent', 7, [16, R - 24], '#8f7a5e'),
    terrain('fumarole', 5, [18, R - 26], '#8f7a5e'),
  ],
  tundra: [
    { prop: 'prop.biome.tree.conifer', count: 14, radius: [22, R - 18], scale: [0.75, 1.15], wind: 0.012 },
    { prop: 'prop.biome.rock.smallB', count: 20, radius: [12, R - 20], scale: [0.7, 1.5] },
    { prop: 'prop.biome.crystal.cluster', count: 8, radius: [24, R - 28], scale: [0.8, 1.3] },
    { prop: 'prop.biome.rock.pebble', count: 22, radius: [8, R - 24], scale: [0.6, 1.2] },
    bones('ribcage', 2, [24, R - 28]),
    bones('scatter', 7, [16, R - 22]),
    terrain('dune', 6, [22, R - 20], '#e2ebf2'),
    terrain('drift', 10, [12, R - 18], '#e2ebf2'),
  ],
  barrens: [
    { prop: 'prop.biome.rock.smallA', count: 24, radius: [12, R - 18], scale: [0.7, 1.6] },
    { prop: 'prop.biome.rock.cluster', count: 10, radius: [26, R - 24], scale: [0.85, 1.4] },
    { prop: 'prop.biome.landmark.hut', count: 2, radius: [22, 44], scale: [0.95, 1.15] },
    { prop: 'prop.biome.landmark.obelisk', count: 3, radius: [30, 66], scale: [0.85, 1.1] },
    { prop: 'prop.biome.prop.amphora', count: 5, radius: [18, 40], scale: [0.9, 1.15] },
    bones('ribcage', 3, [20, R - 26]),
    bones('skull', 2, [24, 62]),
    bones('scatter', 9, [14, R - 22]),
    corrupt('growth', 5, [16, R - 24], '#9a8a4a'),
    corrupt('scar', 6, [14, R - 22], '#9a8a4a'),
    corrupt('bloom', 3, [20, R - 28], '#9a8a4a'),
    terrain('snag', 4, [20, R - 26], '#9a8f70'),
    terrain('deadfall', 3, [22, R - 28], '#9a8f70'),
    terrain('dune', 5, [24, R - 20], '#b8a882'),
    terrain('drift', 8, [14, R - 18], '#b8a882'),
    terrain('vent', 6, [16, R - 24], '#b0a05e'),
    terrain('fumarole', 4, [18, R - 26], '#b0a05e'),
  ],
  spire: [
    { prop: 'prop.biome.landmark.obelisk', count: 5, radius: [24, 70], scale: [0.9, 1.25] },
    { prop: 'prop.biome.landmark.shrine', count: 1, radius: [34, 34], scale: [1, 1] },
    { prop: 'prop.biome.crystal.cluster', count: 14, radius: [16, R - 24], scale: [0.85, 1.6] },
    { prop: 'prop.biome.crystal.shard', count: 18, radius: [12, R - 26], scale: [0.7, 1.4] },
    { prop: 'prop.biome.rock.cliff', count: 5, radius: [40, R - 16], scale: [0.85, 1.2] },
    arcane('runestone', 5, [20, R - 26], '#a98fd6'),
    arcane('circle', 2, [28, 66], '#a98fd6'),
    arcane('focus', 4, [18, R - 30], '#a98fd6'),
    corrupt('growth', 4, [16, R - 24], '#8a6fa8'),
    corrupt('scar', 5, [14, R - 22], '#8a6fa8'),
    corrupt('bloom', 2, [22, R - 30], '#8a6fa8'),
  ],
}

/** Atlas a layer draws from. */
export function layerAtlas(layer: BiomeLayer): string {
  return layer.atlas ?? BIOME_PROP_ATLAS
}
