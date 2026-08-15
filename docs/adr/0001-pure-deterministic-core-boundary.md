# Pure deterministic core simulation boundary

All game simulation rules, economy, combat calculations, and state mutations are strictly isolated in `src/core/**` with zero external dependencies on React, Three.js, Zustand, `Math.random()`, or `Date.now()`. All pseudo-randomness is derived deterministically from the game seed via `withRng` / `createRng`, and entity IDs use monotonic counters.

## Status

Accepted

## Context & Decision

Wyvern3D requires headless balance simulation across thousands of battles in Node.js, deterministic replay reproduction from `(seed, intentLog)`, and save file portability. We decided that `src/core/**` must remain completely pure and enforced by ESLint rules without exception.

## Consequences

- Game rules can be verified in Node unit tests in under a second without browser/canvas bootstrapping.
- Replays reproduce identical outcomes across different platforms and framerates.
- Combat and economy logic cannot directly invoke UI rendering or wall-clock timestamps.
