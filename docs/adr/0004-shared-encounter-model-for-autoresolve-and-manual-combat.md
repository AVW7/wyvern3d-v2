# Unified combat encounter model for auto-resolve and manual battles

Auto-resolved combat and playable battles evaluate identical simulation steps using the shared `createEncounter` engine in `src/core/combat/encounter.ts`, differing only in whether human input overrides squad directives.

## Status

Accepted

## Context & Decision

Games with separate combat simulators for quick auto-resolve vs real-time 3D battles frequently suffer from severe balance drift, where auto-resolve yields radically different win rates or casualty distributions. We decided to use a single headless encounter model stepped at fixed delta time (`dt`) for both modes.

## Consequences

- Automated headless combat tests (`pnpm sim:battle`) guarantee balance parity with interactive in-game fights.
- Any balance tuning or combat mechanic adjustment immediately applies to both auto-resolve and manual play.
- 3D battle scenes serve purely as visual renderers/interpolators for the underlying deterministic combat step.
