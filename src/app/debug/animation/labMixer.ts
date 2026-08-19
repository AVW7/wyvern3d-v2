import type { AnimationMixer } from 'three'

/**
 * Scrub every weighted action on a mixer to a shared cycle fraction.
 *
 * Used by both the rig under review and its A/B comparison so a frozen lab
 * can inspect both models at the same point in their own cycles. Each action
 * keeps its own duration — fraction 0.25 puts a 6 s cruise and a 4.67 s one a
 * quarter into their respective beats, which compares like with like without
 * claiming the two clips share a cadence.
 *
 * Zero-weight actions (faded-out predecessors) are left alone so a crossfade
 * in flight is not resurrected by a scrub.
 *
 * Reaching into `_actions` is deliberate: the public API offers no way to
 * enumerate a mixer's actions, and the lab already walks it for telemetry.
 * Same trade-off as `FlightLabRigContainer`'s best-clip search.
 */
export function scrubMixerActions(mixer: AnimationMixer, fraction: number): void {
  const actions = (mixer as unknown as { _actions?: unknown[] })._actions ?? []
  for (const entry of actions) {
    const action = entry as {
      getEffectiveWeight(): number
      time: number
      getClip(): { duration: number }
    }
    if (action.getEffectiveWeight() > 0) {
      action.time = fraction * action.getClip().duration
    }
  }
}
