# Wyvern3D

A 3D browser game: raise and train wyverns at a sanctuary, then use them and your
armies to conquer regions on a world map. Built with Next.js and
react-three-fiber.

The mechanics work end to end — walkable sanctuary with station interactions, a
world map with the region graph, playable and auto-resolved battles,
egg/breeding/taming acquisition, training, economy, unrest, and saves with
offline catch-up and migrations. The sanctuary and the explorable biomes are
dressed from curated scenery atlases and wyverns render from a real skinned
model; units and battle terrain are still procedural placeholders.

## Running it

```bash
pnpm install
```

```bash
pnpm dev
```

Use `pnpm` for everything. The lockfile and the strict dependency layout are
pnpm-managed, and `three-stdlib` in particular is not importable under it.

## Checks

Run all three before claiming a change works:

```bash
pnpm typecheck && pnpm lint && pnpm test
```

`pnpm lint` includes the core-purity and determinism gates. For anything
touching combat or the economy, also run the balance harness and confirm the
curve is still monotonic:

```bash
pnpm sim:battle
```

`pnpm sim:replay <replay.json>` replays a recorded session and asserts it
reproduces exactly. The asset pipelines each have their own `pnpm assets:*`
script — `pnpm run` lists them.

## How it fits together

| Path | Owns |
|---|---|
| `src/core/**` | Game rules, state, data, combat — pure logic, no `three`/`react`/`zustand` |
| `src/render/**` | Model loading, animation, camera, VFX, materials |
| `src/scenes/**` | Scene composition, per-frame directors, world layout |
| `src/state/**` | Zustand stores, input queues, the game clock |
| `src/ui/**` | The DOM overlay — HUD, panels, wheels, editors |

Data flows one way: **UI emits an intent → core executes it → the store revises
state → render and scene read it → UI displays it.** Nothing outside an
Execution writes to `GameState`.

`src/core/**` is pure, and that is the load-bearing constraint: it is what makes
an auto-resolved battle the same code as a playable one, lets thousands of
fights run headless in Node in under a second, makes `(seed, intentLog)`
reproduce a session exactly, and keeps loaded assets purely cosmetic. A lint
rule enforces it.

Scenes swap on a store field rather than on Next routes — routing would tear
down the WebGL context and stall the world clock on every transition. There is
one persistent `<Canvas>`, and the clock is a plain rAF loop at the app root.

Besides the game itself, the app serves inspection routes: `/models` and
`/biomes` preview library assets at true scale, `/sanctuary-props` reviews the
sanctuary atlas, `/debug/animation` is the Flight Lab, and `/webgl-probe` is a
kept diagnostic for bisecting context-loss failures.

## Where to read next

- **`CLAUDE.md`** — the authoritative project brief: the start-here table, the
  purity invariant in full, and the non-obvious traps that have already bitten.
  Read it before changing anything.
- **`AGENTS.md`** — entry point for coding agents, which points back at
  `CLAUDE.md`.
- **`CONTEXT.md`** — the domain vocabulary. Use these words in code and commits.
- **`docs/`** — system maps and staged work orders: `BIOME_SYSTEM.md`,
  `MODEL_LIBRARY.md`, `BIOME_LIBRARY.md`, `WYVERN_ANIMATION_BASELINE.md`,
  `FLIGHT_ANIMATION_DEVELOPMENT.md`, and the per-area gameplay plans.
- **`CREDITS.md`** — third-party asset attribution.

## Contributors

Co-developed by human maintainers and AI coding agents: **Antigravity** (Google
DeepMind), **Claude** (Anthropic), and **Codex** (OpenAI).
