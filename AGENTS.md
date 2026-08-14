# AGENTS.md

Entry point for coding agents (**Antigravity**, **Codex**, **Claude**, and any automated agent that reads
this file rather than `CLAUDE.md`).

**`CLAUDE.md` is the authoritative project brief. Read it first — all of it.**
This file only exists so tools that do not look for `CLAUDE.md` still find their
way there. Nothing here is a substitute for it, and nothing here should be
duplicated from it, because two copies drift.

## Picking up work

Finish the first incomplete work order in `docs/WYVERN_ANIMATION_PLAN.md` using
its **HANDOFF PROTOCOL**. The remaining work there is **Stage 6 (world event
stream and flourishes)**. Product-area plans then live in
`docs/SANCTUARY_GAMEPLAY_PLAN.md`, `docs/HIGHLANDS_GAMEPLAY_PLAN.md`,
`docs/WORLD_ATLAS_PLAN.md`, `docs/BIOME_ENHANCEMENT_PLAN.md`, and
`docs/SANCTUARY_ENVIRONMENT_ART_PLAN.md`. Use the plan named by the
user/maintainer; do not infer priority between them. Within that plan, take only
its first eligible ledger row not marked DONE.

## Non-negotiables

These are stated in full in `CLAUDE.md`; they are repeated here only because
each one fails silently rather than loudly.

- **`src/core/**` is pure.** No `three`, `react`, `zustand`, `Math.random()`,
  `Date.now()`. A lint rule enforces it and genuinely fires — never add an
  eslint-disable to get around it.
- **Never `setState` in `useFrame`.** Per-frame values mutate `object3D`
  transforms directly.
- **Never reorder the phases in `executeNextTick`.** It invalidates every
  existing replay and save.
- **Use `pnpm`.** Not npm, not yarn, not bun.
- **Do not run `pnpm dev` in a raw shell** — use your tool's browser/preview
  integration. A dev-only `__wyvern.actors` handle is exposed during battles.

## Before changing an animation

Read `docs/WYVERN_ANIMATION_BASELINE.md` — in particular **§Measured rig axes**.

Review in this project is **numeric, not visual**. `pnpm assets:analyze-clips`
measures all 78 clips in Blender, headless, into a committed signature file, and
`pnpm test` asserts it against per-mode contracts. A near-black dragon hides pose
in a render and two contact sheets cannot be diffed, which is how a cruise loop
with no detectable wingbeat once shipped past a reviewed sheet.

Every rig axis and sign in that document was measured by posing the live rig and
reading the channel back, and every one of them contradicted a confident guess
that had already shipped. Probe before trusting; it is one call and it is cheap.

## Gates

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Plus `pnpm assets:validate-sidecar` for animation changes, and `pnpm sim:battle`
for anything touching combat or economy.
