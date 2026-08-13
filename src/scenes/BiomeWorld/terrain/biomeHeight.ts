export const BIOME_WORLD_RADIUS = 110

/** Height of the grove's central mound; the world tree is planted on top of it. */
export const GROVE_MOUND_HEIGHT = 2.2

/**
 * Terrain relief per biome, in the ground plane's *local* coordinates.
 *
 * `BiomeTerrain` displaces a `PlaneGeometry` that is later rotated -90° about
 * X, so the plane's local Y is the world's -Z. Everything outside the geometry
 * build wants world coordinates — use `biomeHeightAt` for those.
 */
export function surfaceHeight(biome: string, x: number, y: number): number {
  const dist = Math.hypot(x, y)
  const edge = Math.min(1, dist / BIOME_WORLD_RADIUS)

  switch (biome) {
    case 'mountain': {
      const ridge = Math.sin(x * 0.06) * Math.cos(y * 0.06) * 4.5
      const peaks = Math.abs(Math.sin(x * 0.12 + y * 0.08)) * 3.2
      return ridge + peaks + edge * edge * 8.0
    }
    case 'coast': {
      const island = Math.max(0, 1 - dist / 65)
      const waves = Math.sin(x * 0.08) * 0.4 + Math.cos(y * 0.08) * 0.4
      return (island * 3.5 - 1.2) + waves
    }
    case 'ashland': {
      const crater = Math.sin(dist * 0.07) * 2.5
      const jagged = Math.sin(x * 0.15) * Math.cos(y * 0.15) * 1.8
      return crater + jagged + edge * edge * 5.0
    }
    case 'cavern': {
      const basin = -Math.cos(dist * 0.04) * 3.0
      const bumps = Math.sin(x * 0.1) * Math.sin(y * 0.1) * 1.5
      return basin + bumps + edge * edge * 7.0
    }
    case 'spire': {
      const pillar = dist < 45 ? 4.0 : -2.0
      const rim = Math.sin(x * 0.08 + y * 0.08) * 1.2
      return pillar + rim + edge * edge * 6.0
    }
    case 'tundra': {
      const drifts = Math.sin(x * 0.04 + y * 0.05) * 1.8 + Math.cos(x * 0.09) * 0.9
      return drifts + edge * edge * 3.0
    }
    case 'marsh':
    case 'swamp': {
      const bog = Math.sin(x * 0.09) * 0.8 + Math.cos(y * 0.09) * 0.8
      return bog - 0.4 + edge * edge * 2.5
    }
    case 'grove': {
      // A meadow that lifts into a low mound under the world tree, so the
      // landmark reads as standing on a rise rather than on flat ground.
      const mound = Math.max(0, 1 - dist / 40) * GROVE_MOUND_HEIGHT
      const meadow = Math.sin(x * 0.05) * 0.9 + Math.cos(y * 0.06 + x * 0.02) * 0.7
      return mound + meadow + edge * edge * 3.5
    }
    case 'jungle':
    case 'forest': {
      const rolls = Math.sin(x * 0.07) * 1.2 + Math.cos(y * 0.06 + x * 0.02) * 1.0
      return rolls + edge * edge * 4.0
    }
    default:
      return (
        Math.sin(x * 0.08) * 0.72 +
        Math.cos(y * 0.07 + x * 0.025) * 0.55 +
        edge * edge * 2.8
      )
  }
}

/**
 * Ground height at a world XZ position. Everything that stands on the terrain —
 * the player, scatter props, the grove landmark — must go through this, or it
 * floats or sinks wherever the relief is not zero.
 */
export function biomeHeightAt(biome: string, x: number, z: number): number {
  return surfaceHeight(biome, x, -z)
}
