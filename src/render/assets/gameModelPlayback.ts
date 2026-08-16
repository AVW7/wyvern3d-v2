import type { ClipSpec, ModelState } from './manifest'

/** Resolve a deterministic member of a manifest clip pool. */
export function resolveClipSpec(
  entry: ClipSpec | ClipSpec[] | undefined,
  seed: number,
): ClipSpec | undefined {
  if (!entry || !Array.isArray(entry)) return entry
  if (entry.length === 0) return undefined
  const stableSeed = Number.isFinite(seed) ? Math.abs(Math.trunc(seed)) : 0
  return entry[stableSeed % entry.length]
}

/** Normalize an action time into [0, 1), including a wrapped negative time. */
export function normalizedPlaybackPhase(time: number, duration: number): number | null {
  if (!Number.isFinite(time) || !Number.isFinite(duration) || duration <= 0) return null
  return (((time % duration) + duration) % duration) / duration
}

/** A completed cosmetic chain must not overwrite a newer controlled state. */
export function shouldApplyNext(requested: ModelState, active: ModelState): boolean {
  return requested === active
}

/**
 * Which spec's `yOffset` plants the model — the base state's, even mid-tell.
 *
 * An action-channel clip is a transient overlay on whatever locomotion state is
 * underneath, not a new stance, so it must not re-plant the animal. It used to:
 * the offset came from the playing spec, and `attack`/`breathe` carry
 * `yOffset: 0` against `idle`'s 152.89, so a grounded wyvern sank 1.10 m the
 * instant it bit or breathed and popped back when the tell cleared.
 *
 * Giving the tells their own measured number cannot fix this, because the same
 * clip plays over several bases: `idle` plants at 152.89, `walk` at 85.57,
 * `rest` at 368.8, and every airborne state at 0. Inheriting is the only answer
 * right for all of them at once, and it costs the tells nothing — a one-shot
 * holds the pose the locomotion under it already established.
 *
 * `attack` and `breathe` keep their own offsets for when they are requested as
 * ordinary base states, which `pickUp`, `huntGrip`, `drop` and `huntFinish` all
 * do: with no override there is nothing to inherit from and the playing spec is
 * the base spec.
 */
export function resolvePlantSpec(
  playingSpec: ClipSpec | undefined,
  baseSpec: ClipSpec | undefined,
  isOverride: boolean,
): ClipSpec | undefined {
  if (!isOverride) return playingSpec
  return baseSpec ?? playingSpec
}

/** Alias loops are reusable only when neither side is a command override. */
export function canReuseLoopAction(
  currentWasOverride: boolean,
  nextIsOverride: boolean,
  currentGroup: string | undefined,
  nextGroup: string | undefined,
): boolean {
  return !currentWasOverride && !nextIsOverride && currentGroup === nextGroup
}
