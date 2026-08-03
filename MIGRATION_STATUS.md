# Migration Status

**Date:** August 3, 2026
**Phase:** Foundation Complete ✅

## What Was Done

### Phase 1: Clean Scaffolding ✅

1. **Created new project:** `~/wyvern3d-v2`
2. **Copied proven architecture:**
   - `src/core/` - All game logic, combat, economy, state (400 tests passing)
   - `src/state/` - All Zustand stores, game clock, state machines
   - `src/ui/` - All HUD components, panels, controls
   - `src/scenes/` - Scene logic (will adapt rendering later)
   - `src/render/` - Animation systems (will rebuild foundation)
   - `docs/` - Animation baselines, development docs
   - `validation/` - Animation contracts, clip signatures
   - `scripts/` - Measurement pipeline, Blender tools
   - `public/` - Assets, models (symlinked for now)

3. **Verified quality gates:**
   - ✅ **400 tests passing** (100% of original tests)
   - ✅ **TypeScript compilation** (no errors)
   - ✅ **Production build** (successful)
   - ⚠️ **Lint:** 5 minor warnings in files we'll rebuild

## Current State

### What Works
- **All core game logic** (combat, economy, sanctuary, state management)
- **Replay system** (seed → exact reproduction)
- **Auto-resolve** (same code as playable battle)
- **Test infrastructure** (vitest, measurement pipeline)
- **Build tooling** (Next.js, TypeScript, ESLint)

### What Needs Rebuilding
- `public/models/drogon.glb` → New rig with clean hierarchy
- `render/assets/manifest.ts` → Point to new model
- `render/boneOffsets.ts` → Re-measure new bone channels
- Animation validation → Rebuild for 19 essential clips

## File Inventory

### Copied As-Is (No Changes Needed)
```
src/core/ (100% - all game logic)
src/state/ (100% - all state management)  
src/ui/ (100% - all UI components)
docs/ (100% - knowledge preserved)
validation/ (100% - contracts preserved)
scripts/ (100% - measurement pipeline)
```

### Copied (Will Adapt Later)
```
src/render/ (animation systems - update bone names)
src/scenes/ (scene logic - swap rendering layer)
src/app/ (pages - mostly unaffected)
```

### Will Replace
```
public/models/drogon*.glb → New rig/animation
```

## Next Steps (Phase 2-3)

### Phase 2: Placeholder Wyvern (Day 2-3)
1. Create procedural wyvern visual (no GLB dependency)
2. Verify scenes render with placeholder
3. Confirm game is playable without vendor rig

### Phase 3: New Rig Decision (Week 1-2)
**Options:**
- **A:** Extract Drogon mesh + build new armature (30-120 hours)
- **B:** Commission new rig (cost varies)  
- **C:** Hybrid - retarget animations (40-80 hours, lower quality ceiling)

**Recommendation:** Start with (A) - extract mesh, build clean armature with:
- Root motion bone
- Wings reparented from neck
- Clean axis conventions (+Y forward, +Z up)
- Reduced bone count (292 → ~50)
- Symmetric base pose

### Phase 4: Essential Animation (Week 2-4)
Author 19 clips:
- Core flight: cruise, bank L/R, hover, speed, glide, dive (7)
- Transitions: takeoff, land, settle (3)
- Actions: attack, bite, breath start/loop, death (5)
- Grounded: idle, rest, walk, eat (4)

### Phase 5: Integration (Week 4)
1. Update render layer for new rig
2. Wire new animation system  
3. Full playtest + benchmark
4. Final verification

## Metrics

| Metric | Original | New Project | Status |
|--------|----------|-------------|--------|
| Tests | 400 | 400 passing | ✅ |
| TypeScript | Clean | Clean | ✅ |
| Build | Working | Working | ✅ |
| File count | 110+ TS/TSX | 110+ TS/TSX | ✅ |

## Key Insight

**The architecture is sound.** The pain was localized to:
- Wrong rig hierarchy (wings parented to neck)
- Broken axis conventions (measured, documented, but wrong)
- No root motion (all clips in-place)
- Excessive complexity (292 bones, 52 clips)

We've preserved the **competitive advantages**:
- Auto-resolve = playable battle (rare)
- Deterministic replays (rare)
- 400 passing tests (tests are value)
- Pure core layer (testable in Node)

And now have a **clean foundation** to rebuild what was genuinely broken.

---

**Status:** Ready for Phase 2 (placeholder wyvern)  
**Blocker:** None  
**Time to playable:** 2-3 days (placeholder)  
**Time to production:** 4-6 weeks (full rebuild)
