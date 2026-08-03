import type { Egg, Stats, StatId, WyvernInstance } from '../types'
import { SPECIES } from '../data/species'
import { TRAITS } from '../data/traits'
import { CONFIG } from '../data/config'
import type { Rng } from '../math/rng'
import { clamp } from '../math/vec'

export const STAT_IDS: StatId[] = ['power', 'speed', 'stamina', 'firepower', 'armor']

export const zeroStats = (): Stats => ({ power: 0, speed: 0, stamina: 0, firepower: 0, armor: 0 })

export function addStats(a: Stats, b: Partial<Stats>): Stats {
  const out = { ...a }
  for (const id of STAT_IDS) out[id] += b[id] ?? 0
  return out
}

/** Sum of a trait list's flat modifiers. */
export function traitModifiers(traits: readonly string[]): Partial<Stats> {
  const out = zeroStats()
  for (const t of traits) {
    const def = TRAITS[t]
    if (def) for (const id of STAT_IDS) out[id] += def.modifiers[id] ?? 0
  }
  return out
}

/** Multiplier on bond gained from training, from traits. Compounding. */
export function bondRate(traits: readonly string[]): number {
  let rate = 1
  for (const t of traits) rate *= TRAITS[t]?.bondRate ?? 1
  return rate
}

/**
 * Battle-effective stats: the stored sheet degraded by hunger, injury and
 * immaturity. Kept separate from `stats` so the roster UI can show the true
 * sheet while combat uses the honest number.
 */
export function effectiveStats(w: WyvernInstance): Stats {
  const hungerPenalty = w.hunger > CONFIG.wyvern.starvingAt ? 1 - (w.hunger - CONFIG.wyvern.starvingAt) / 100 : 1
  const injuryPenalty = 1 - w.injury / 200
  const stagePenalty = w.stage === 'adult' ? 1 : w.stage === 'juvenile' ? 0.6 : 0.3
  const mult = clamp(hungerPenalty * injuryPenalty * stagePenalty, 0.1, 1)

  const out = zeroStats()
  for (const id of STAT_IDS) out[id] = w.stats[id] * mult
  return out
}

/** A single scalar for roster sorting and auto-resolve estimates. */
export function powerRating(w: WyvernInstance): number {
  const s = effectiveStats(w)
  return s.power * 1.2 + s.firepower * 1.3 + s.armor * 1.0 + s.stamina * 0.6 + s.speed * 0.5
}

/** Rolled stat sheet for a fresh member of a species, with variation. */
export function rollSpeciesStats(speciesId: string, rng: Rng): Stats {
  const species = SPECIES[speciesId]
  if (!species) throw new Error(`Unknown species: ${speciesId}`)
  const out = zeroStats()
  for (const id of STAT_IDS) {
    out[id] = Math.round(species.baseStats[id] + rng.spread(species.baseStats[id] * 0.15))
  }
  return out
}

export function rollSpeciesTraits(speciesId: string, rng: Rng): string[] {
  const species = SPECIES[speciesId]
  if (!species) return []
  const traits: string[] = []
  // Most wyverns carry one trait; a minority carry two.
  const first = rng.pick(species.traitPool)
  if (first) traits.push(first)
  if (rng.chance(0.25)) {
    const second = rng.pick(species.traitPool.filter((t) => t !== first))
    if (second) traits.push(second)
  }
  return traits
}

/**
 * Genetics. A bred egg averages its parents and rolls variance around that, so
 * a deliberate pairing of two strong adults reliably beats a wild-caught one —
 * but never by a guaranteed margin.
 */
export function breedStats(a: Stats, b: Stats, rng: Rng): Stats {
  const out = zeroStats()
  for (const id of STAT_IDS) {
    const mean = (a[id] + b[id]) / 2
    out[id] = Math.max(1, Math.round(mean + rng.spread(mean * 0.18)))
  }
  return out
}

/** Each parent trait has an independent chance to carry; rare mutations add one. */
export function breedTraits(a: readonly string[], b: readonly string[], speciesId: string, rng: Rng): string[] {
  const inherited = new Set<string>()
  for (const t of [...a, ...b]) {
    if (rng.chance(0.5)) inherited.add(t)
  }
  if (inherited.size === 0) {
    const fallback = rng.pick([...a, ...b])
    if (fallback) inherited.add(fallback)
  }
  if (rng.chance(0.08)) {
    const mutation = rng.pick(SPECIES[speciesId]?.traitPool ?? [])
    if (mutation) inherited.add(mutation)
  }
  return [...inherited].slice(0, 3)
}

export function createWyvern(params: {
  id: string
  speciesId: string
  name: string
  stats: Stats
  traits: string[]
  stage: WyvernInstance['stage']
  origin: WyvernInstance['origin']
  bond: number
}): WyvernInstance {
  return {
    id: params.id,
    speciesId: params.speciesId,
    name: params.name,
    stage: params.stage,
    ageTicks: params.stage === 'adult' ? CONFIG.wyvern.hatchlingTicks + CONFIG.wyvern.juvenileTicks : 0,
    stats: addStats(params.stats, traitModifiers(params.traits)),
    level: 1,
    xp: 0,
    bond: params.bond,
    hunger: 0,
    injury: 0,
    traits: params.traits,
    assignment: { kind: 'idle' },
    breedCooldown: 0,
    lastHuntTick: -CONFIG.wyvern.huntCooldownTicks,
    origin: params.origin,
  }
}

export function createEgg(params: {
  id: string
  speciesId: string
  stats: Stats
  traits: string[]
  parents: [string, string] | null
}): Egg {
  return {
    id: params.id,
    speciesId: params.speciesId,
    parents: params.parents,
    rolledStats: params.stats,
    rolledTraits: params.traits,
    incubatingTicksLeft: null,
  }
}

/** Applies pending level-ups. Returns how many levels were gained. */
export function applyXp(w: WyvernInstance, xp: number): number {
  if (xp <= 0) return 0
  const species = SPECIES[w.speciesId]
  if (!species) return 0

  w.xp += xp
  let gained = 0
  while (w.level < CONFIG.wyvern.maxLevel && w.xp >= CONFIG.wyvern.xpPerLevel * w.level) {
    w.xp -= CONFIG.wyvern.xpPerLevel * w.level
    w.level += 1
    gained += 1
    for (const id of STAT_IDS) {
      w.stats[id] = Math.round((w.stats[id] + species.growth[id]) * 10) / 10
    }
  }
  return gained
}

export const isDeployable = (w: WyvernInstance): boolean =>
  w.stage === 'adult' && w.injury < CONFIG.wyvern.maxDeployInjury && w.assignment.kind !== 'breeding'

/** Returns precise level progress, required XP, and percentage. */
export function getWyvernLevelProgress(w: WyvernInstance): {
  currentXp: number
  requiredXp: number
  xpPercent: number
  isMaxLevel: boolean
  canLevelUp: boolean
} {
  const isMaxLevel = w.level >= CONFIG.wyvern.maxLevel
  if (isMaxLevel) {
    return {
      currentXp: w.xp,
      requiredXp: CONFIG.wyvern.xpPerLevel * w.level,
      xpPercent: 100,
      isMaxLevel: true,
      canLevelUp: false,
    }
  }
  const requiredXp = CONFIG.wyvern.xpPerLevel * w.level
  const xpPercent = requiredXp > 0 ? Math.min(100, Math.max(0, (w.xp / requiredXp) * 100)) : 0
  const canLevelUp = w.xp >= requiredXp
  return {
    currentXp: w.xp,
    requiredXp,
    xpPercent,
    isMaxLevel: false,
    canLevelUp,
  }
}

/** Calculates quick stat percentages (Health, Fed %, Bond %, Growth %). */
export function getWyvernStatPercentages(w: WyvernInstance): {
  healthPercent: number
  fedPercent: number
  bondPercent: number
  growthPercent: number
} {
  const healthPercent = Math.max(0, Math.round(100 - (w.injury / 200) * 100))
  const fedPercent = Math.max(0, Math.round(100 - w.hunger))
  const bondPercent = Math.min(100, Math.max(0, Math.round(w.bond)))

  let growthPercent = 100
  if (w.stage === 'hatchling') {
    growthPercent = Math.min(49, Math.round((w.ageTicks / Math.max(1, CONFIG.wyvern.hatchlingTicks)) * 50))
  } else if (w.stage === 'juvenile') {
    growthPercent = Math.min(99, 50 + Math.round(((w.ageTicks - CONFIG.wyvern.hatchlingTicks) / Math.max(1, CONFIG.wyvern.juvenileTicks)) * 50))
  }

  return {
    healthPercent,
    fedPercent,
    bondPercent,
    growthPercent,
  }
}

/** Deterministic naming — no random word lists, so replays stay stable. */
export function nameFor(speciesId: string, n: number): string {
  const species = SPECIES[speciesId]
  return `${species?.name ?? 'Wyvern'} ${n}`
}
