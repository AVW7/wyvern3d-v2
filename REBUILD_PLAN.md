# Wyvern3D Rebuild Plan

**Goal:** Clean-slate the animation/rig layer while preserving the proven architecture.

## What to Keep (Good Architecture)

### Core Game Logic (`src/core/`) ✅
- **Pure, testable, deterministic** - no Three.js, no React, no wall-clock
- Combat system (`combat/`) - auto-resolve = playable battle, same code path
- Game state management (`state/`) - tick-based, replayable
- Entity system (`entities/wyvern.ts`) - stat calculations, effective combat values
- Data definitions (`data/`) - all balance/content in one place
- Math utilities (`math/rng.ts`, `math/vec.ts`) - seeded RNG, vector ops

**Why keep:** This is the game's competitive advantage. Auto-resolve = playable battle
is rare. 185 tests passing. Replays work. Don't rewrite this.

### Game Systems (`src/core/systems/`) ✅
- Economy system
- Region management  
- Sanctuary behavior

### State Management (`src/state/`) ✅
- Zustand stores (editor, commands, UI, camera)
- Game clock
- Battle/sanctuary state machines

**Why keep:** These are decoupled from rendering and work.

### Scenes (`src/scenes/`) ✅ (mostly)
- `Battle/BattleScene.tsx` - uses combat models correctly
- `Sanctuary/` - director, spatial awareness, layout algorithms
- `WorldMap/` - region mechanics

**Keep the logic, but:** wyvern rendering components need ports to new rig.

### UI (`src/ui/`) ✅
- HUD components, panels, editor controls
- All DOM (not Three.js), so unaffected by rig change

## What Needs Rebuilding 🔄

### 1. Rig & Animation Foundation
**Current problems:**
- Wings parented to neck (hierarchy constraint)
- Wrong axis conventions (local Z is down, actually)
- Two broken action names that can't round-trip
- No root motion (all clips in-place)
- Asymmetric base poses (37.7° symmetry error)
- Neck axis bugs
- 292 bones (excessive for the game's needs)

**New approach:**
```
public/models/wyvern-v2.glb
├── Armature
│   ├── root_motion (new) - for travel clips
│   ├── hips
│   │   ├── spine_01 → spine_02 → spine_03 → chest
│   │   │   ├── wing_L_root (reparented from neck)
│   │   │   │   ├── wing_L_01 → wing_L_02 → wing_L_tip
│   │   │   │   └── wing_L_thumb
│   │   │   └── wing_R_root (symmetric)
│   │   └── tail_01 → tail_02 → ... → tail_tip
│   ├── neck_01 → neck_02 → neck_03 → head
│   │   └── jaw
│   └── legs (if needed for ground poses)
└── Mesh (same Drogon geometry, re-rigged)
```

**Axis conventions:**
- Forward: +Y (Blender standard)
- Up: +Z  
- Right: +X
- All rotations: Euler XYZ (no gimbal in principal axes)

### 2. Animation Clips (Essential Set)
**Phase 1 - Core Flight (7 clips):**
1. `cruise_loop` - symmetric wingbeat, horizontal body
2. `bank_left`, `bank_right` - true banking via wing differential
3. `hover_idle` - body under wing roots, legs hanging
4. `speed_loop` - stretched, fast forward flight
5. `glide` - wings extended, no power
6. `dive_stoop` - steep descent

**Phase 2 - Transitions (3 clips):**
7. `takeoff` - grounded → flight
8. `land_approach` - flight → grounded
9. `landing_settle` - touchdown → idle

**Phase 3 - Actions (5 clips):**
10. `attack_dive` - aerial attack
11. `bite` - close-range attack
12. `breath_start` - fire breath windup
13. `breath_loop` - sustained fire
14. `death` - crash/collapse

**Phase 4 - Grounded (4 clips):**
15. `grounded_idle` - standing/loitering
16. `grounded_rest` - sitting/sleeping pose
17. `walk_forward` - ground locomotion
18. `eat` - feeding animation

**Total: ~19 clips** (vs 52 in vendor corpus)
**Estimated time:** 15 clips × 4-8 hours = 60-120 hours for clean authoring
Or: retarget + cleanup = 40-80 hours (lower quality ceiling)

### 3. Rendering Layer (`src/render/`) 🔄
**Keep the architecture, adapt to new rig:**
- `flightAnimationCoordinator.ts` - needs bone name updates
- `spineWave.ts` - spine bone names change
- `gazeController.ts` - neck bone names change
- `tailController.ts` - tail bone names change
- `wingRefinement.ts` - wing hierarchy changes (now independent of neck)
- `legPhysics.ts` - if adding legs
- `poseTransition.ts` - keep (independent of rig structure)
- `flightPose.ts` - keep (mode detection is abstract)

**Replace entirely:**
- `assets/manifest.ts` - point to new GLB
- `assets/GameModel.tsx` - simpler, fewer clips
- `boneOffsets.ts` - re-measure new bone positions

### 4. Test Infrastructure (`scripts/`, `validation/`) 🔄
**Keep the approach, rebuild for new rig:**
- `scripts/analyze-clips.py` - adapt to new bone channels
- `validation/wyvern-animations/clip-signatures.json` - regenerate
- `validation/wyvern-animations/clip-contracts.json` - simplify, fewer clips

**Why keep:** The measurement approach is proven. Don't lose the lesson.

## Migration Strategy

### Phase 1: Clean Scaffolding (Day 1-2)
1. Create new project: `wyvern3d-v2`
2. Copy `src/core/` entirely (no changes)
3. Copy `src/state/` entirely
4. Copy `src/ui/` entirely
5. Set up build/test infrastructure
6. Confirm: gates pass with no rendering

### Phase 2: Placeholder Rig (Day 2-3)
1. Build procedural wyvern placeholder (no GLB yet)
2. Copy scene logic, swap in placeholder
3. Get `Battle`, `Sanctuary`, `WorldMap` rendering with placeholder
4. Confirm: game is playable with placeholder

### Phase 3: Real Rig (Week 1-2)
Option A: Extract mesh, build new armature
Option B: Commission/author new rig
Option C: Hybrid - keep mesh, retarget animations

### Phase 4: Animation Authoring (Week 2-4)
1. Author 19 essential clips
2. Set up measurement pipeline
3. Validate against contracts

### Phase 5: Integration (Week 4)
1. Port rendering layer to new rig
2. Wire up new animation system
3. Full playtest
4. Final gates pass

## File Inventory

### Copy As-Is (no changes)
```
src/core/ (all of it)
src/state/ (all stores, clock)
src/ui/ (all components)
src/app/layout.tsx
src/app/page.tsx
package.json (dependencies, remove from pnpm.* block)
tsconfig.json
eslint.config.js (keep core purity rule)
vitest.config.ts
```

### Copy With Adaptation
```
src/render/flightPose.ts
src/render/poseTransition.ts
src/render/*.test.ts (test logic, update bone names)
src/scenes/ (scene logic, swap wyvern rendering)
src/state/* (may need bone name consts update)
```

### Rebuild From Scratch
```
src/render/assets/manifest.ts
src/render/assets/GameModel.tsx
src/render/boneOffsets.ts
src/render/flight*.ts (bone name constants)
public/models/*.glb (new rig/animation)
validation/wyvern-animations/*.json
scripts/analyze-clips.py
```

## Success Criteria

1. **Core logic:** All 185 `src/core` tests pass unchanged
2. **Game state:** Replays from wyvern3d still work
3. **Rendering:** Wyvern renders with new rig
4. **Animation:** 19 clips measured, validated, in use
5. **Combat:** Auto-resolve = battle result (same code path)
6. **Performance:** No regression in frame rate

## Estimated Timeline

- **Scaffolding:** 2 days
- **Rig decision:** 1-2 weeks (depends on authoring approach)
- **Animation authoring:** 2-3 weeks
- **Integration/testing:** 1 week

**Total: 5-7 weeks** for clean rebuild

## Next Steps

1. Create `wyvern3d-v2` project directory
2. Copy proven code (phase 1)
3. Set up build tooling
4. Build procedural wyvern placeholder
5. Make key decision: author new rig vs retarget

---

**Key Insight:** The game's value is in the simulation, not the animation. The rig
pain is real but localized. A clean rebuild keeps what's working and fixes what
isn't, rather than trying to migrate through a broken foundation.
