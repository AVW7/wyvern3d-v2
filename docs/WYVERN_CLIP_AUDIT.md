# Wyvern clip audit — mirroring, loop seams, frame-0 starts

Measured facts about the 16 authored clips in `public/models/wyvern.glb`, and the
four defects that were repaired across them — three in the clips (wing mirroring,
loop seams, frame-1 starts) and one in the manifest that plays them (looping
clips in the one-shot action channel). Read this before authoring or editing a
clip on `WyvernRig`, or before adding a state to the action channel.

Re-run any time:

```bash
pnpm assets:wyvern-audit && pnpm assets:validate-wyvern
```

The first checks the authored F-curves in `public/models/wyvern-rig.blend`; the
second checks the exported GLB the way three.js actually plays it. Both exit
non-zero on a defect, so either is usable as a gate. Repair with
`pnpm assets:wyvern-audit --fix`, which also saves the `.blend` and re-exports.

---

## The axis convention, which is the whole reason the bug existed

Probed on the live armature, not reasoned about. Two of these contradict the
obvious guess:

| Bones | Local +X | Local +Z |
|---|---|---|
| `Spine*` / `Neck*` / `Head` | pitches the head **down** | yaws toward −X |
| `Tail1..Tail10` | lifts the tail **up** (opposite sense to the spine) | — |
| Wing shoulder / elbow / wrist | raises **both** wings — **symmetric** | sweeps them in **opposite** directions — **antisymmetric** |
| `Body.location` | — | +Z is world **down** |

So a mirrored wing pose **shares `X`** across the two sides and **must negate
`Z`**. Seven clips gave both wings the same `Z`, which folds one wing forward
across the chest and the other back.

`+Y` is toward the tail, so a positive sweep angle means a wing swept **back**.
Two measured reference poses anchor everything below:

| | body-local sweep | meaning |
|---|---|---|
| `idle` | +37.3 … +38.5° | a folded wing, swept back |
| `cruise` | −11.6 … −11.1° | an extended wing at the neutral `Z` of zero |

---

## What was wrong, and what it measures now

`mirror` is the worst left-vs-right wingtip mismatch over the clip, in displayed
metres, measured in the **Body bone's own frame**. `seam` is the worst per-bone
difference between the first and last frame, over rotation *and* position.

| clip | mirror before | mirror after | seam before | seam after | loops |
|---|---|---|---|---|---|
| `attack` | 15.673 | **0.0009** | 0.785 | 0.785 ¹ | no ⁴ |
| `breath` | 5.443 | **0.0009** | 0.001 | 0.001 | no ⁴ |
| `death` | 27.146 | **0.0009** | 300.0 | 300.0 ¹ | no |
| `land` | 23.885 | **0.0009** | 300.0 | 300.0 ¹ | no |
| `rest` | 26.016 | **0.0006** | 0.419 | **0.001** | yes |
| `takeoff` | 24.012 | **0.0009** | 300.0 | 300.0 ¹ | no |
| `walk` | 15.673 | **0.4488** ² | 0.928 | **0.001** | yes |
| `speed` | 0.001 | 0.001 | 5.500 | **0.001** | yes |
| `bankLeft` | 9.054 | 9.054 ² | 0.001 | 0.001 | yes |
| `bankRight` | 9.055 | 9.055 ² | 0.001 | 0.001 | yes |
| `idle` | 0.101 | 0.101 ³ | 0.001 | 0.001 | yes |
| `cruise` `dive` `glide` `hover` `scout` | 0.001 | 0.001 | 0.001 | 0.001 | yes |

¹ A one-shot, so its ends are not required to match. `death`, `land` and
`takeoff` carry a 300-unit `RootMotion` drop by design; `attack` opens on a
wound-up pose and resolves to neutral.
² Asymmetric on purpose — see below.
³ `idle` runs its two wings on the same carrier at slightly different amplitudes
so they drift independently, which is deliberate.
⁴ Both used to loop and no longer do — see the action-channel section below.
`breath` closes cleanly and *could* loop; it is a one-shot because of how it is
dispatched, not because of anything in the clip.

**0.0009 m is the floor, not a residual defect.** The rig's own bind pose is
asymmetric by 0.00089 m, so every repaired clip is now as symmetric as this
skeleton can be.

Every clip except `idle` also started at frame 1, putting its first glTF key at
t = 1/24 s; three.js clamps to the first pose for that opening frame, a 42 ms
hitch on every loop. All 15 non-idle clips were shifted to start at frame 0. Relative timing
inside each clip is unchanged — the shift is one number per action — so each
clip is now 1/24 s shorter and starts at t = 0.

---

## Which side survived each repair

Negating either side zeroes the asymmetry, but the two choices keep opposite
poses, so the choice is not arbitrary. Each was made by building both variants
and measuring the resulting sweep against the two references above. The losing
variant in every case put both wings 40–70° **forward across the chest**.

| clip | kept | measured sweep after | the variant that lost |
|---|---|---|---|
| `attack` | R | settles +19.1 back into `idle` | settled −41.3, a 79° pop |
| `breath` | L | holds −1.2, just back of neutral | held −21.3, forward of neutral |
| `death` | L | opens +49.7, near `idle`'s +38 | opened −71.1 |
| `land` | R | brakes forward, ends +19.1 back | ended −41.3 |
| `rest` | R | +47.7, a tight fold | −69.2, both wings across the chest |
| `takeoff` | L | opens and closes +29.3 | opened −51.3 |
| `walk` | R | +19.1 back, matching `rest`'s fold | −41.3, forward |

There is no single convention to apply mechanically: the clips were authored
independently and `rest`/`walk`/`land`/`attack` used the opposite sign to
`breath`/`death`/`takeoff`. The table above records the resolution per clip.

---

## The manifest side: action-channel clips must be one-shots

Auditing "clips the manifest loops" turned up two entries that loop but must not.
This is a manifest defect, not a clip defect — both clips are fine.

`GameModel` emits `onActionFinished` for `loop: false` specs **only**, and that
callback is the single mechanism that clears a tell: every caller drops its
action when the token comes back. A looping spec in the action channel therefore
never ends. The sanctuary director already states the invariant in a comment —
*"Active one-shot, retained until GameModel says its mixer action ended"* — but
nothing enforced it.

| state | was | now | what the bug looked like |
|---|---|---|---|
| `attack` | looping | `loop: false` | Ground attacker stuck in the attack tell, snapping 45° back to the wind-up on every wrap. Its seam is 0.785 for exactly that reason: the clip opens on a wound-up pose and resolves to neutral, so its ends were never meant to meet. `attackAir` was already correct. |
| `breathe` | looping | `loop: false` | Worse, because it latches something else: `BreathVFX` sets `active` from `actor.breathing \|\| action?.state === 'breathe'` and **restarts** its 0.85 s burst while `active` holds. With the action never clearing, one breath attack left the fire looping permanently. `actor.breathing` itself is a clean single-tick flag, reset at the top of every tick, so clearing the action is all that was needed. |

`src/render/assets/manifest.action-channel.test.ts` locks both, and cross-checks
the state list against the `setAction` call sites so a new tell cannot be added
without being a one-shot. It scopes itself to assets that actually load a model:
the `unit.*` entries are `url: null` placeholders, and their looping `attack` is
fine because `attack` is legitimate as a *base* state — it only has to be a
one-shot when the action channel dispatches it.

## What is asymmetric on purpose

`bankLeft` and `bankRight` hold ~9 m of wingtip asymmetry and are **correct**.
A bank beats the outboard wing deeper than the inboard one. They carry no `Z` at
all — the asymmetry is entirely on `X`, the symmetric lift axis, at different
per-side amplitudes (shoulder 25° vs 50°, elbow 5/−10° vs ±15°). The two clips
are exact left/right swaps of each other, key for key, and the validator checks
that they stay within 0.5% of each other rather than requiring symmetry.

`walk` holds 0.4488 m of asymmetry and is also **correct**. The vendor walk is
quadrupedal: its wing knuckles approach the ground on alternating steps, rather
than both wings acting as a locked decorative carrier. The rebuilt clip follows
that cadence with a restrained 0.9° shoulder settle and keeps the Z sweep
mirrored, so it reads as relaxed weight transfer rather than a flap. The runtime
validator requires at least 0.1 m of walk asymmetry; that catches a regression
back to rigid, synchronized wings without confusing it with a bank.

---

## Traps worth keeping

- **Most clips key only 2–8 of the 56 bones.** In Blender an unkeyed bone silently
  carries the previously evaluated action's pose into the next measurement, which
  is enough to make an exactly-symmetric clip report a residual. Both tools reset
  to the rest pose before every action. The exported GLB is fully baked
  (168 tracks, every bone every frame) so this is an authoring-side hazard only.
- **A world-space symmetry check is invalid on a clip that tumbles the body.**
  `death` rolls `RootMotion` 90°/45°/30°, and a world or armature-space
  comparison reports ~36 m of mismatch on a pose that is exactly symmetric. The
  measurement has to happen in the Body bone's own frame; there the same clip
  reads 0.0013 m.
- **Seeking a three.js `AnimationAction` is easy to get silently wrong.**
  `mixer.setTime()` resets every action's own time to zero, and `action.paused`
  makes the mixer skip the action entirely — either one pins every sample to
  frame 0, which scores a known-broken model a clean pass. Assign `action.time`
  and step the mixer by a zero delta. `LoopRepeat` also wraps a request for
  exactly `duration` back to 0, so a seam check needs `LoopOnce`.
- **A rotation-only seam check misses the body bob.** All three loop seams
  repaired here — `speed` 5.500, `walk` 0.928, `rest` 0.419 — were on
  `Body.location`, and score a clean zero if only quaternions are compared.
