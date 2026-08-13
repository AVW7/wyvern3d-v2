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

/** Alias loops are reusable only when neither side is a command override. */
export function canReuseLoopAction(
  currentWasOverride: boolean,
  nextIsOverride: boolean,
  currentGroup: string | undefined,
  nextGroup: string | undefined,
): boolean {
  return !currentWasOverride && !nextIsOverride && currentGroup === nextGroup
}
