# External asset ideas — game-experience enhancement backlog

**Status: OPEN (ideas backlog — not a staged work order).**

This document has four parts: **Part A — Sanctuary**, **Part B — Highlands
expedition & hunt**, **Part C — World atlas & biomes**, and **Part D — Wyvern
animation & battle**. Nothing here is committed work. When an idea is picked up,
it should be folded into an existing staged plan
(`docs/SANCTUARY_GAMEPLAY_PLAN.md`, `docs/HIGHLANDS_GAMEPLAY_PLAN.md`,
`docs/SANCTUARY_ENVIRONMENT_ART_PLAN.md`, `docs/BIOME_ENHANCEMENT_PLAN.md`,
`docs/BATTLE_TRIALS_PLAN.md`) or promoted into its own work order with a
progress ledger.

Ideas are sourced from the two Desktop asset folders (`~/Desktop/world build`,
`~/Desktop/3d models animals`), using them as **guidance and inspiration rather
than copy-paste**: the primary value of most entries is the *vocabulary* they
prove out (clip ethograms, prop taxonomies, silhouette language), with direct
asset import as a secondary option where the numbers justify it. Factual
basis for every asset claim: `docs/EXTERNAL_MODEL_INDEX.md` and its
machine-readable companion `docs/EXTERNAL_MODEL_INDEX.json`.

**Provenance rule (inherited from the Mint ideas doc).** Code ideas may be
reimplemented; assets may not. No externally-downloaded GLB, texture, audio, or
font enters this repository without licence evidence recorded in `CREDITS.md`
per asset — several of these carry vendor-marketing names (`ga_free_`,
`demo_free`, `free_-_`) that usually imply attribution or
non-redistribution terms. Nothing in `src/core/**` may gain `three`, `react`,
`zustand`, `Math.random()`, or `Date.now()` imports as a result of these ideas.

---

## How to read this document

Each idea lists: **Source** (the asset and the index entry worth reading
first), **Idea**, **Fit** (where it lands in this codebase), and **Weight** —

- 🥇 high value now, fits existing seams
- 🥈 valuable, needs groundwork or another stage first
- 🥉 speculative / polish

---

# Part A — Sanctuary

## Tier 1 — fits existing seams now

### A1. Real egg meshes in the hatchery 🥇

**Source.** `dragon_egg` (0.18 MB, 1,920 tris) and `dragon_egg_lowpoly`
(960 tris) in the animals folder; `docs/EXTERNAL_MODEL_INDEX.md` §Dragon-specific.

**Idea.** The hatchery station (`prop.hatchery.cave`, `panel: 'hatchery'`) is
the only station whose subject matter — `state.eggs` — has no mesh of its own.
A staged egg model (rock egg → hairline crack → hatch glow) is the single most
on-theme prop upgrade available, and at <2 K triangles it is nearly free.

**Fit.** `PROP_CATALOG` in `src/core/state/sanctuaryLayout.ts:28` already
carries `panel`/`radius` metadata; the render side is a dressing-prop entry in
the sanctuary atlas (`scripts/asset-sources.json` → `extract-assets.py`) plus a
per-egg stage pick driven by core egg state. No new render code class needed.

### A2. Sanctuary livestock — chicken and rabbit ambient life 🥇 (blocked on licence evidence)

**Source.** `chicken_rig` (1,541 tris, 50 joints, `Idle`) and `rabbit_rigged`
(2,578 tris, 48 joints, 1 clip) — the two cheapest properly-skinned animals in
either folder.

⚠️ **2026-08-19:** the obvious licence lead was checked and *failed*: Sketchfab's
"GA Free_151 Village Hen" (CC-BY, Galaxy Abundant) is a **different asset** from
the disk file `ga_free_101_village_hen__speckled_farm_chicken.glb`. No licence
evidence exists for `chicken_rig.glb` or `rabbit_rigged.glb` yet — resolve their
upstream pages before import. Implementation shape is unchanged and stays ready.

**Idea.** The sanctuary already renders ambient wildlife through
`SanctuaryWildlife.tsx` (`GameModel id="wildlife.deer"` at line 99,
`wildlife.guineafowl` at 111). A pecking hen near the quenching trough
(`trough_forge`, `sanctuaryLayout.ts:106`) and a rabbit at the meadow edge are
one manifest entry each: the `wildlife.${string}` key type, numeric height fit,
and clip map already exist (see the `wildlife.deer` entry at
`src/render/assets/manifest.ts:613` for the exact shape).

**Fit.** Pure intake (Path 1 in the index). Single-clip rigs only need idle;
position/behaviour comes from the existing wildlife component pattern.

### A3. Re-import the two live wildlife models from their masters ✅ DONE 2026-08-19

Implemented by `scripts/reimport-wildlife-masters.mjs` (spec/gloss → metalrough
per the biome-atlas recipe, texture re-encode to 2048px WebP, binary-chunk
compaction, geometry/skins/clips untouched). Result: `doe.glb` 11.8 → 11.3 MB
with the 4096px master's texture detail at 2048px, `guineafowl.glb` 4.4 →
3.5 MB at native 2048px. `wildlifeModels.test.ts` passes unchanged — the
numeric fits held exactly, as predicted. CREDITS.md updated.

**Source.** Index §"Already wired — and both on the wrong variant":
`doe__realistic_animated_3d_model (1).glb` (4096px master) vs the shipped
1024px import; `guineafowl-…-temprit.glb` (2048px master) vs the shipped 1024px.

**Idea.** Same geometry, same clip names, same fitted scale — only the textures
improve. This is the cheapest realism gain in the entire library and does not
touch `manifest.ts` at all.

## Tier 2 — needs groundwork

### A4. Station-grade prop upgrades: forge and alchemy 🥈

**Source.** `stove_forge_blacksmith` (99 K tris, 14 materials) for the Scale
Forge; `alchemy_table_free` (7,603 tris) and `alchemist_shelf_with_potion_bottles`
(1.87 M tris — decimation mandatory) for a new alchemy station.

**Idea.** `PROP_CATALOG` entries can carry `station`/`panel`/`radius`, so a
better mesh can become a better *interactable*, not just set dressing. The
blacksmith stove is the strongest single upgrade to an existing station; the
alchemy pair would add a station the catalogue does not have.

**Fit.** Sanctuary environment art Stage 7 (storytelling polish and release
gate) is the next eligible stage of `docs/SANCTUARY_ENVIRONMENT_ART_PLAN.md` —
these belong there. The 1.9 M-tri scans must not enter before the decimation
lane exists (see C3).

### A5. Dragon heraldry at the gate 🥉

**Source.** `stylized_dragon_flag` (1.28 MB, 2,336 tris), `dread_dragon_armor`
(7.7 MB) as display armour.

**Idea.** Approach-read dressing that says "wyvern sanctuary" from the first
camera frame. Polish-tier; nice silhouette, no systems attached.

**Fit.** Sanctuary atlas dressing entries; consider after Stage 7 lands.

---

# Part B — Highlands expedition & hunt

`docs/HIGHLANDS_GAMEPLAY_PLAN.md` is PLANNED with all stages NOT STARTED and
its gate (animation Stage 6) CLOSED — it is now the eligible frontier. Ideas
below are phrased to slot into its stage boundaries.

### B1. A rival predator: the wolf 🥇

**Source.** `wolf_with_animations` (2,760 tris, 49 joints, 5 clips:
`01_Run`, `02_walk`, `03_creep`, `04_Idle`, `05_site`) — verified clip list in
the JSON index.

**Idea.** The hunt has prey but no rival. A wolf that competes for the same
deer (creeps when the player is spotted, runs when charged) turns Stage 2's
"prey awareness" from a one-way relationship into an ecology. The clip set is
suspiciously perfect for it: *creep* is a stalking locomotion the deer rig
does not even have.

**Fit.** Highlands Stage 2 (tracking, wind, prey awareness) or Stage 3 (prey
variety). Intake via `wildlife.wolf` in `manifest.ts`; behaviour is core-side
deterministic state on the existing prey-awareness model — no new authority.

### B2. The doe ethogram as a design checklist — not just five clips 🥇

**Source.** `doe__realistic_animated_3d_model` — 46 clips, full list in
`EXTERNAL_MODEL_INDEX.json`: three gaits × {straight, L, R}, `Loco_Sneak`,
`Loco_Sprint`, four death variants with held `DeathPose`, three hit-react
variants, lying/sitting/stand breathing, and explicit `Trans_*` pose-to-pose
clips.

**Idea.** This is guidance, not an import: the ethogram is a professionally
structured *prey behaviour state machine* — gait ladders with direction blends,
separate hit-vs-death reactions, idle *qualities* (alert vs breathing vs
eating), and authored transitions between them. When Highlands Stage 2 defines
awareness states (calm → alert → flee) and Stage 4 defines death/hit outcomes,
this list is the vocabulary to check completeness against. Directional L/R
locomotion variants are exactly what the current single `Loco_Run` map cannot
express on turns.

**Fit.** Costs nothing; shapes Stage 2/3/4 core state design. If more clips are
later wanted, they are already on disk — the manifest clip map is the only
change.

### B3. Big game: the elephant 🥈

**Source.** `elephant (1).glb` (1,958 tris, 54 joints, **28 clips**: attack,
run attack, four hit directions, death, eating, sleep, wakeup, trumpet…).

**Idea.** The richest animation set per triangle in either folder. A
highlands-neutral megafauna that is dangerous when approached wrongly
(`fight idle` → `run attack`) gives Stage 3's "prey variety" a third category:
not prey, not enemy — a hazard you route around. The hit-direction variants
also author honest hit feedback from different wyvern approach angles.

**Fit.** Highlands Stage 3, after the Stage 2 awareness model exists (the
elephant needs the same awareness states plus a threat response).

---

# Part C — World atlas & biomes

### C1. Three Draco props, zero processing 🥇

**Source.** `tomb-entrance` (2,110 tris), `camel` (1,224), `basket-set` — all
Draco-compressed, <15 KB, in `world build`.

**Idea.** These are the only assets in either folder already in shipping form.
`tomb-entrance` is a ready-made `landmark.ruin`-category silhouette for the
existing landmark-prop vocabulary (`src/scenes/BiomeWorld/discovery/landmarkProps.ts`);
the camel and baskets suit a settlement-category region's dressing.

**Fit.** One `biome-library.json` entry each (`pending` until licence evidence
lands in `CREDITS.md`), then the existing `pnpm assets:biome-atlas` pipeline.

### C2. A non-European region identity: the Mauryan set 🥈

**Source.** `early_buddhist_shrine_3rd_century_bc`, `obelisk`,
`terracotta_worn_tiled_floor`, `mudbrick-house`, `amphora`,
`ancient_historical_weapons_pack_mauryan_style` — a coherent ancient-Indian
set with no counterpart in the animals folder.

**Idea.** If any atlas region wants a distinct visual identity beyond the
European-medieval default, this is the only complete material for it — shrine
landmark, floor finish, habitation, props, and relic weapons from one culture.
Guidance value even unimported: it demonstrates that a region reads as
"somewhere" through a *consistent set* of everyday objects, not one hero prop.

**Fit.** Biome enhancement pass or atlas follow-up once a region's theme is
chosen; most members are heavy enough to need the atlas pipeline, and the
shrine (11 MB) should be decimated first.

### C3. The decimation lane — infrastructure that unlocks eight hero props 🥈

**Source.** Index §"The headline problem": eight 1.87–2.0 M-triangle
photogrammetry props (crystal cluster, watchtower, courtyard ruin, floating
rune monolith, petrified egg, anvil set, alchemist shelf, executioner), each
one material + three 4K textures.

**Idea.** All realism baked into geometry a decimated mesh plus the same
textures would carry. A `gltf-transform` chain (`metalrough → weld → simplify
→ resize 2048 → webp → draco`) targeting 3–5 K triangles converts the
library's biggest liability into hero landmarks. This is the recommended-order
item the index already argues for; repeated here because Parts A and D both
wait on it.

**Fit.** Extend `scripts/build-biome-atlas.mjs` or a sibling script; the
existing `assets:validate-biome-atlas` triangle-budget gate enforces the
result. Feed it the 4K master, not the 1K downscale.

### C4. Tree-kit variety for scatter 🥉

**Source.** `oak_trees` (14,475 tris, ~198 primitives — a whole kit),
`ancient_tree`, `arborvitae-conifer`.

**Idea.** The scatter currently draws from a narrow tree vocabulary; a kit file
mines into many distinct silhouettes for the price of one atlas slot.

**Fit.** Biome dressing pass; kits need node-splitting in the atlas builder,
which is the groundwork that makes this Tier 2-adjacent rather than instant.

---

# Part D — Wyvern animation & battle

The animation plan is CLOSED; these ideas route through the sidecar retarget
path (`scripts/build-sidecar.py`) into the manifest animation map, or into
battle presentation via existing seams.

### D1. Mine a real `Landing` clip from the prowler rig 🥇

**Source.** `prowler_dragon_variant_rig` (19,766 tris, 126 joints, 3 clips:
`Walk`, `PoseLib`, **`Landing`**).

**Idea.** `Landing` is the one named motion the current Drogon-derived set does
not have — the animation ledger has repeatedly circled landing (flare-drag
workarounds in Stage 4.7, the `actor.flying` unlock in Stage 5). Only the
curves are wanted, not the mesh: retarget onto `WyvernRig` through the sidecar
pipeline, then measure against the grounded-surface contract like every other
clip (`pnpm assets:validate-sidecar`).

**Fit.** Manifest animation map + a `landing` mode entry; the hard part is
retarget QA, which the baseline/signature pipeline already mechanises.

### D2. The mega_wyvern attack verb list as a battle-combat checklist 🥈

**Source.** `mega_wyvern.glb` (16,222 tris, 70 joints, 11 clips: `Flame
Blast`, `Talon Smash`, `Strike Swoop`, `Wing Slap`, `Roar`, `Fire Balls`,
`Combo Hit`, `Beam|Roar`, `Wind Blast|Wing Slap`, `Death`, `Appearance`).

**Idea.** Guidance first: this is a checklist of dragon-combat *verbs* the
battle currently expresses only as `attack`/`attackAir`/`breathe`. Swoop
(diving pass), wing slap (melee area), and fire balls (ranged spread) are three
distinct readable silhouettes the encounter sim could expose as trick-type
variants — the battle plan's readability work established that silhouette
diversity is what makes outcomes legible. Import second: whichever verbs get
adopted, the curves retarget the same way as D1.

**Fit.** Battle presentation consumes `EncounterSim` outcomes; a verb-rich
animation map needs no new authority, only new clip modes keyed off existing
attack kinds. Anything touching combat outcome (not presentation) requires
`pnpm sim:battle`.

### D3. Humanoid squads stay non-goal — with one exception path 🥉

**Source.** Index §"What we cannot use yet": `paladin`, `strong_knight`,
`skeleton_lord`, `warrior`, `samurai_warrior`, `executioner_warrior` — rigs
with at most one idle clip; `SquadActorView` (`BattleScene.tsx:500`) is
instanced and non-skinned *on purpose* (WebGL instanced-skinning limit).

**Idea.** The exception path worth remembering: a **hero/squad split** — a
handful of skinned commanders above instanced rank-and-file — would let one
rigged humanoid (e.g. `skeleton_lord`, 89 joints) carry personality without
re-architecting squad rendering. Requires an external locomotion set (Mixamo
or similar) before it beats the current placeholders in motion.

**Fit.** Battle trials plan, deferred since 2026-07-30; nothing here changes
that priority — recorded so the option is not re-derived from scratch later.

---

## Explicit non-goals

- **No asset enters `public/models` without `CREDITS.md` evidence.** The
  `biome-library.json` `pending` → `approved` gate already enforces this for
  Path 2; hold every other path to the same bar.
- **No blind variant deletion.** The `(1)` suffix is not a quality signal in
  either direction (12 of 63 groups reverse it). Always resolve via
  `preferredFile` in the JSON index.
- **No 1.9 M-triangle imports** before the decimation lane (C3) exists.
- **No skinned-mesh squads** in place of the instanced placeholders (D3).
- Ideas are a **menu, not a schedule**: promotion happens through the repo's
  real plan process, never by editing a plan's ledger from here.

## Promotion protocol

When an idea is picked up: add it to the named plan's next eligible stage (or
open a new work order), cite the source asset and the index entry in the work
order body, record licence evidence in `CREDITS.md` before any file copy, and
mark the idea here with a pointer to the stage that absorbed it.
