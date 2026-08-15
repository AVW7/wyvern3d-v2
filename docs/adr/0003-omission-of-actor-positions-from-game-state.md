# Omission of real-time actor positions from GameState

Real-time 3D coordinates, yaw rotations, and flight animation state machines are computed per-frame outside `GameState` by client-side directors (`src/scenes/Sanctuary/director/wyvernDirector.ts`) and never persisted in the simulation store.

## Status

Accepted

## Context & Decision

Persisting per-frame actor positions in `GameState` would cause excessive save-file bloat, create desyncs between discrete 1 Hz ticks and 60 FPS animation loops, and trigger unnecessary React UI re-renders. We decided that `GameState` only retains discrete logical properties (`assignment`, `preferredPerchIndex`), while spatial motion is derived visually using seeded local RNG.

## Consequences

- Save files remain compact and replay logs only record discrete intent dispatches.
- Visual positioning logic in `useFrame` directly mutates Three.js `Object3D` transforms without calling Zustand `setState`.
- Cosmetic variations (e.g. ambient idle selections) use derived seed streams (`deriveSeed`) to avoid advancing simulation RNG.
