# Sanctuary Battle Trials — deferred

**Status:** Deferred on 2026-07-30 in favour of direct sanctuary wyvern
commands. This document preserves the accepted design for later implementation.

## Summary

Add a consequence-free `Begin Battle Trial` command for adult wyverns. Players
can launch it from either a roster card or the Flight Ring, practise the real
battle controls, measure attacks, and test order obedience before deployment.

The world clock pauses during the trial. No resources, training time, hunger,
injury, XP, bond, assignments, regions, saves, or replay intents are changed.

## Player experience

- Add `Test abilities` to every adult roster card. Hatchlings and juveniles
  show `Adults only`.
- Add a `Battle Trial` section to the Flight Ring panel with the same adult
  selector.
- Adults may be tested while training, breeding, hungry, injured, or otherwise
  undeployable; warnings explain their current readiness, and their assignment
  resumes unchanged afterward.
- Run three skippable phases:
  1. **Flight:** use mouse/A–D steering, W/S throttle, R/F climb/descend, and
     Shift dive through three ordered flight gates.
  2. **Combat:** attack an invulnerable practice target. Space fires breath;
     bite occurs automatically within its real nine-unit range.
  3. **Orders:** issue `Order attack` while the wyvern is AI-controlled. Roll
     obedience exactly as a real battle does and show `Obeyed` or `Defied`,
     alongside the expected obedience percentage.
- Show live stamina, gate progress, elapsed time, bite damage, breath
  damage/hits, range, and order status.
- Finish with a factual report—not a fabricated grade—containing flight time,
  observed attacks, effective battle stats, obedience chance, trial outcome,
  and any deployment warnings.
- `Retry`, `Return to Sanctuary`, and Escape are always available. Skipped
  sections are marked `Not tested`.

## Implementation changes

- Add transient `trial` scene mode and an ephemeral trial store containing the
  selected wyvern, phase, objectives, action tokens, and measurements. Never put
  trial data in `GameState`, `pendingBattle`, saves, or the intent log.
- Pause `GameClock` while `mode === 'trial'`; continue updating its wall-clock
  reference and clear its accumulator so leaving the trial cannot cause
  catch-up ticks.
- Add a focused trial arena styled as the sanctuary Flight Ring/Burn Range:
  - Arena radius: 80.
  - Spawn: `[0, 18, 55]`, facing north.
  - Flight gates: `[0,18,28]`, `[-22,28,0]`, `[18,12,-26]`, each with a
    seven-unit pass radius.
  - Passive practice target: `[0,0,-50]`.
  - Order phase resets the wyvern to `[0,18,25]` and target to `[0,0,-20]`;
    timeout after 12 seconds.
- Extract battle constants and pure mechanics from the encounter implementation
  so battle and trial share actor construction, fixed-step flight, stamina
  regeneration, melee, breath cone, damage jitter, and obedience rolls.
  Existing battle balance values remain unchanged.
- Give the trial an in-memory passive target actor with no attack, movement,
  death, or persistence. Combat completes after at least one real breath hit and
  one real bite hit.
- Add discrete melee/breath combat events so both the battle and trial render the
  same visual action:
  - Bite plays `attack` for the real 1.1-second attack cycle.
  - Breath plays `breathe` for the real 2.2-second cooldown and emits an
    immediate cone matching the 0.62-radian half-angle and 26-unit range.
- Extend `GameModel` with:
  - `action?: { state: 'attack' | 'breathe'; token: number; duration: number }`.
  - The action interrupts the locomotion loop, plays once scaled to `duration`,
    then crossfades back; changing `token` retriggers it.
  - `onReady?: (root: Group) => void` for locating the breath socket. Use the
    dragon skull `Bip002-Head_015` and the final neck link to derive its outgoing
    direction; use a group-origin fallback and development warning only if the
    dragon skeleton cannot be resolved. `B_Face_Jaw_00_0160` belongs to the rider.
- Wire the same bite/breath action events and breath cone into normal battles so
  the trial accurately previews what the player will see in combat.
- Keep ambient commands—sleep, sit, eat, drink, groom, perch—and unused vendor
  attacks outside this feature. Explicitly state that dive increases speed and
  descent but currently causes no collision damage.

## Interface changes

- `SceneMode`: add `'trial'`.
- Add `TrialPhase`, `TrialMetrics`, and `TrialStore` as UI-only types.
- Add shared `CombatEvent` types for melee and breath activation.
- Add reusable combat-mechanics exports for actor stats, piloted movement,
  breath/melee resolution, stamina, and obedience.
- Add `GameModel.action` and `GameModel.onReady`.
- No save-version, intent, replay, or persistent core-state migration.

## Test plan

- Verify trial-derived HP, defense, speed, stamina, bite, breath, and obedience
  values match real encounter construction for healthy, hungry, injured, and
  trait-modified wyverns.
- Verify the passive target cannot attack, move, die, or produce a battle
  result.
- Verify flight gates must be crossed in order and each trial phase completes
  or skips correctly.
- Verify breath consumes stamina only on a valid hit and uses the production
  range, cone, cooldown, and damage formula.
- Verify bite activates only within production melee range and uses production
  damage/cooldown.
- Verify 100 bond always obeys and deterministic lower-bond trials use the
  production disobedience formula.
- Verify entering, retrying, and exiting a trial leaves serialized `GameState`,
  assignments, resources, intent log, and pending battle unchanged.
- Verify the world clock does not tick during a trial or burst ticks afterward.
- Manually verify both entry points, camera/input feel, repeated action
  triggering, skull-mounted breath alignment, flight-gate readability, Escape
  handling, and assignment restoration.
- Run typecheck, lint, unit tests, build, sidecar validation, and the existing
  battle simulation to confirm no balance drift.

## Assumptions

- Only adults can begin a Battle Trial because only adults are battle-legal.
- Every species currently has the same abilities; traits and condition affect
  numbers, not move availability.
- Trial results are session-only and carry no rewards, costs, injuries, or
  history.
- This remains separate from the direct sanctuary command palette.
