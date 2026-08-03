/**
 * Seeded RNG (mulberry32).
 *
 * The whole core depends on this: replays, headless balance runs and the
 * auto-resolve/live-battle equivalence all require that the same seed produces
 * the same sequence. `state` is exposed so the cursor can be serialized into a
 * save and resumed exactly where it left off.
 */
export interface Rng {
  /** Float in [0, 1). */
  next(): number
  /** Float in [min, max). */
  range(min: number, max: number): number
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number
  /** True with probability p. */
  chance(p: number): boolean
  /** Uniform pick. Returns undefined only for an empty array. */
  pick<T>(items: readonly T[]): T | undefined
  /** Normal-ish variation around 0 via averaged uniforms — cheap, bounded, no tails. */
  spread(magnitude: number): number
  /** Current cursor, for serialization. */
  state(): number
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0

  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (items) => (items.length === 0 ? undefined : items[Math.floor(next() * items.length)]),
    // Average of three uniforms centred on 0 — bell-shaped and hard-bounded,
    // so a stat roll can never produce an absurd outlier.
    spread: (magnitude) => ((next() + next() + next()) / 3 - 0.5) * 2 * magnitude,
    state: () => s,
  }
}

/** Derive a stable child seed from a parent seed and a label. */
export function deriveSeed(seed: number, label: string): number {
  let h = seed >>> 0
  for (let i = 0; i < label.length; i++) {
    h = Math.imul(h ^ label.charCodeAt(i), 0x01000193) >>> 0
  }
  return h >>> 0
}
