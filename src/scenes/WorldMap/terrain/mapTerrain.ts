import { Color } from 'three'
import { REGION_LIST } from '../../../core/data/regions'
import { RegionDef } from '../../../core/types'
import { BIOME_PALETTES } from '../../BiomeWorld/atmosphere/biomePalettes'
import { nodeRadius, nodePedestalHeight } from '../nodeVisuals'
import { smoothNoise } from '../../../render/math/valueNoise'

export const SEA_RADIUS = 300
export const SEA_LEVEL = 0

/** Width of the band over which land height eases down to sea level. */
export const COAST_FALLOFF = 20

export function plateauRadius(def: RegionDef): number {
  return nodeRadius(def.tier) + 2.0
}

/**
 * How far a region's dressing scatter can reach from its centre. Mirrors the
 * radius `planDressing` samples, so the coastline is always outside the props.
 */
const DRESSING_REACH = 16

/**
 * Derived from the region graph rather than hand-tuned: the outermost region
 * plus its dressing must sit inboard of where the coastal falloff begins, or
 * that region's crest is crushed into the surf. Duskspire (z = -125, tier 4)
 * did exactly that under the old hard-coded 130 — the map's capital rendered
 * 1.6 units tall instead of 10.3.
 */
export const LAND_RADIUS = (() => {
  let outermost = 0
  for (const def of REGION_LIST) {
    const reach =
      Math.hypot(def.position.x, def.position.z) + plateauRadius(def) + DRESSING_REACH
    if (reach > outermost) outermost = reach
  }
  return Math.ceil(outermost + COAST_FALLOFF)
})()

function smoothstep(min: number, max: number, value: number): number {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)))
  return x * x * (3 - 2 * x)
}

export function landmassAt(x: number, z: number): number {
  let maxBump = 0
  const distFromCenter = Math.hypot(x, z)
  if (distFromCenter > SEA_RADIUS) return SEA_LEVEL

  for (const def of REGION_LIST) {
    const d = Math.hypot(x - def.position.x, z - def.position.z)
    const radius = 22 + def.tier * 3
    const crest = 1.5 + def.tier * 2.2

    if (d < radius) {
      const t = 1 - d / radius
      const bump = crest * Math.pow(t, 1.5)
      if (bump > maxBump) maxBump = bump
    }
  }

  // Check plateau mask
  let insidePlateau = false
  for (const def of REGION_LIST) {
    const d = Math.hypot(x - def.position.x, z - def.position.z)
    if (d <= plateauRadius(def)) {
      insidePlateau = true
      break
    }
  }

  let height = maxBump
  if (!insidePlateau && distFromCenter < LAND_RADIUS + COAST_FALLOFF) {
    const ridge = smoothNoise(x * 0.04, z * 0.04) * 3.5
    height += ridge
  }

  // Coastal falloff
  if (distFromCenter > LAND_RADIUS - COAST_FALLOFF) {
    const falloff = 1 - smoothstep(LAND_RADIUS - COAST_FALLOFF, LAND_RADIUS, distFromCenter)
    height *= falloff
  }

  return Math.max(SEA_LEVEL, height)
}

export function mapHeightAt(x: number, z: number): number {
  return landmassAt(x, z)
}

const crestCache: Record<string, number> = {}

export function regionCrestHeight(def: RegionDef): number {
  if (crestCache[def.id] !== undefined) {
    return crestCache[def.id]!
  }
  const h = mapHeightAt(def.position.x, def.position.z)
  crestCache[def.id] = h
  return h
}

/** Thickness of the biome cap sitting on top of a region's pedestal. */
const CAP_THICKNESS = 0.6

/**
 * The single anchor height for everything that belongs to a region node: the
 * top of its biome cap, in world space. Region nodes stand on the terrain
 * crest, so supply lines, the camera target and beacons must read this rather
 * than re-deriving a pedestal height from the tier and assuming y = 0.
 */
export function regionDeckY(def: RegionDef): number {
  return regionCrestHeight(def) + nodePedestalHeight(def.tier) + CAP_THICKNESS
}

const parsedColorsCache: Record<string, Color> = {}

function getParsedColor(hex: string): Color {
  if (!parsedColorsCache[hex]) {
    parsedColorsCache[hex] = new Color(hex)
  }
  return parsedColorsCache[hex]!
}

export function mapColorAt(x: number, z: number): Color {
  let closestDef: RegionDef = REGION_LIST[0]!
  let minDist = Infinity

  for (const def of REGION_LIST) {
    const d = Math.hypot(x - def.position.x, z - def.position.z)
    if (d < minDist) {
      minDist = d
      closestDef = def
    }
  }

  const palette = BIOME_PALETTES[closestDef.biome]
  const baseHex = palette?.groundColor ?? '#4a6042'
  const c = getParsedColor(baseHex).clone()

  const h = mapHeightAt(x, z)
  const heightFactor = Math.min(1.2, 0.8 + h * 0.04)
  c.multiplyScalar(heightFactor)

  const distFromCenter = Math.hypot(x, z)
  if (distFromCenter > LAND_RADIUS - 15) {
    const coastBlend = smoothstep(LAND_RADIUS - 15, LAND_RADIUS, distFromCenter)
    c.lerp(new Color('#1b4332'), coastBlend * 0.7)
  }

  return c
}
