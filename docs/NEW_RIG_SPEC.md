# New Wyvern Rig Specification

**Status:** DRAFT — For implementation in Blender
**Date:** August 3, 2026
**Target:** Replace vendor `drogon.glb` with clean, controllable rig

---

## Executive Summary

The vendor rig (`drogon.glb`) has documented structural defects that block advanced animation and cause per-clip bugs. This spec defines a replacement rig that:

1. **Preserves the mesh** — Same geometry, same visual identity
2. **Replaces the armature** — Clean hierarchy, correct axes
3. **Enables new animation** — Barrel rolls, loops, root motion
4. **Reduces complexity** — ~50 bones vs 292

---

## Why Rebuild

### Documented Failures (from WYVERN_ANIMATION_BASELINE.md)

| Defect | Impact | Evidence |
|--------|--------|----------|
| Wings parented to neck | Lateral neck sway swings wings (23.5° symmetry error) | Probed, measured |
| No root motion | All clips in-place, requires workarounds | Documented limitation |
| Wrong axis conventions | Every assumption required measurement to correct | "Every entry contradicted a plausible guess" |
| Asymmetric base pose | 37.7° symmetry error shipped in cruise | measured |
| `root_roll_delta_deg` measures pitch | Contract guarded wrong channel | Measured |
| Neck `down` argument drove inert axis | Four grounded recipes swapped layers | Probed |
| Bank recipe drove wrong sign | Banks shipped flat (0.04° bias vs -8° contract) | Measured |
| 292 bones | Excessive complexity, performance cost | GLB inspection |

### What We Gain

| Capability | Before | After |
|------------|--------|-------|
| Barrel roll | ❌ Impossible | ✅ Continuous root rotation |
| Root motion | ❌ In-place only | ✅ Per-clip translation |
| Wing independence | ❌ Neck-bound | ✅ Free hierarchy |
| Axis clarity | ❌ Requires probing | ✅ Documented conventions |
| Bone count | 292 | ~50 |
| Lateral head lean | ❌ 0.6 symmetry error | ✅ Zero error |

---

## Rig Architecture

### Hierarchy Design

```
Root (Origin)
├── RootMotion (translation/rotation for gameplay)
│   └── Body
│       ├── Spine1
│       │   ├── Spine2
│       │   │   ├── Spine3
│       │   │   │   ├── Neck1
│       │   │   │   │   ├── Neck2
│       │   │   │   │   │   └── Head
│       │   │   │   │   │       └── Jaw
│       │   │   │   │   └── (wing roots move here, NOT under neck)
│       │   │   │   ├── L_WingRoot
│       │   │   │   │   ├── L_WingShoulder
│       │   │   │   │   │   ├── L_WingElbow
│       │   │   │   │   │   │   └── L_WingWrist
│       │   │   │   │   │   │       └── L_WingFingers (×3)
│       │   │   │   │   └── L_WingMembrane (×2)
│       │   │   │   └── R_WingRoot (mirrored)
│       │   │   └── Tail1
│       │   │       └── Tail2-6 (chain)
│       │   └── L_LegRoot
│       │       └── L_Thigh
│       │           └── L_Calf
│       │               └── L_Foot
│       │                   └── L_Toes (×4)
│       └── R_LegRoot (mirrored)
```

### Bone Count Breakdown

| Chain | Count | Purpose |
|-------|-------|---------|
| Root + Body | 4 | Root motion, torso hierarchy |
| Spine | 3 | Torso flexibility |
| Neck + Head | 3 | Head articulation |
| Jaw | 1 | Breath attack |
| Wings × 2 | 20 (10 each) | Shoulder, elbow, wrist, 3 fingers, 2 membrane |
| Tail | 6 | Counterbalance |
| Legs × 2 | 12 (6 each) | Thigh, calf, foot, 4 toes |
| **Total** | **~49** | — |

---

## Axis Conventions

### Global Axes
- **+Y** = Forward (nose direction)
- **+Z** = Up (world up)
- **+X** = Right wing

### Local Rotation Axes (T-Pose)

| Chain | Primary Axis | Effect | Sign Convention |
|-------|--------------|--------|-----------------|
| RootMotion.Y | Pitch | Nose down = positive | + = dive |
| RootMotion.X | Roll | Left wing down = positive | + = left bank |
| RootMotion.Z | Yaw | Nose right = positive | + = right turn |
| Wing Shoulder.Z | Elevation | Up = positive | + = upstroke |
| Wing Shoulder.Y | Stroke plane | Forward = positive | + = forward sweep |
| Neck.Z | Down bend | Down = positive | + = head down |
| Neck.Y | Lateral bend | Right = positive | + = head right |
| Tail.Z | Up bend | Up = positive | + = tail up |
| Tail.Y | Lateral bend | Right = positive | + = tail right |
| Hind Leg.Z | Flexion | Forward = positive | + = leg forward |
| Toe Fan.Z | Spread | Open = negative | − = spread, + = gather |

### Mirroring Rule

Bones are mirrored across **X = 0**:
- Left wing at `x = +span`
- Right wing at `x = −span`
- Same local rotation on both sides → symmetric motion
- Same local sign → **bank** (tips diverge)
- Opposite signs → **common mode** (tips move together)

---

## Bone Naming Convention

| Pattern | Example | Meaning |
|---------|---------|---------|
| `Root` | `Root` | Scene origin |
| `RootMotion` | `RootMotion` | Root motion translation |
| `Body` | `Body` | Torso root |
| `SpineN` | `Spine1`, `Spine2` | Spine bones (proximal→distal) |
| `NeckN` | `Neck1`, `Neck2` | Neck bones |
| `Head` | `Head` | Skull |
| `Jaw` | `Jaw` | Mandible |
| `L_*/R_*` | `L_WingShoulder` | Left/Right side |
| `TailN` | `Tail1`–`Tail6` | Tail bones (proximal→distal) |
| `*Thigh/*Calf/*Foot` | `L_Thigh` | Limb segments |
| `ToeN` | `L_Toe1` | Wing/foot digits |

---

## Key Design Decisions

### 1. Wings Independent of Neck

**Problem:** Original rig has `Bip002-L-Clavicle` as child of `Bip002-Neck1`, so lateral neck motion drags wings.

**Solution:** Parent wing roots to `Spine3`, below the neck chain.

**Verification:** Lateral head lean must move 0.0 wingtips.

### 2. Root Motion Bone

**Problem:** All vendor clips are in-place; gameplay fakes translation.

**Solution:** Add `RootMotion` bone that:
- Translates in Y for forward flight
- Rotates in X/Y/Z for rolls, loops, turns
- Is separate from `Body` (which holds pose)

**Usage:**
- Clips can bake motion into `RootMotion.Y`
- Runtime can blend clip motion with player input
- No more sliding feet

### 3. Symmetric Base Pose

**Problem:** Vendor rig has 0.63–1.05 left/right foot asymmetry by default.

**Solution:** Bind pose is exact mirror:
- All left/right bones have identical local transforms (sign-flipped X position)
- No baked asymmetry in rest pose

### 4. Reduced Bone Count

**Problem:** 292 bones is overkill; most are dummy helpers.

**Solution:** 49 load-bearing bones, plus:
- No dummies
- No redundant helpers
- Clean weight painting (transfer from original)

---

## Essential Clips (19 Total)

### Flight (7)
| Clip | Duration | Key Features |
|------|----------|--------------|
| `cruise` | 2.0s loop | 3 symmetric wingbeats, level body |
| `bankLeft` | 2.0s loop | +20° roll bias, asymmetric stroke |
| `bankRight` | 2.0s loop | −20° roll bias, mirrored |
| `hover` | 2.5s loop | +30° body pitch, hanging legs |
| `speed` | 1.5s loop | 0.8 Hz fast beat, nose-down |
| `glide` | 4.0s loop | Held wings, minimal motion |
| `dive` | 2.0s loop | −30° pitch, tucked wings/legs |

### Transitions (3)
| Clip | Duration | Key Features |
|------|----------|--------------|
| `takeoff` | 2.5s one-shot | Ground→air, ends in `cruise` |
| `land` | 3.0s one-shot | Air→ground, ends in `idle` |
| `settle` | 1.5s one-shot | Landing→rest |

### Actions (5)
| Clip | Duration | Key Features |
|------|----------|--------------|
| `attack` | 1.0s one-shot | Ground bite |
| `attackAir` | 3.5s one-shot | Aerial dive-strike |
| `breath` | 2.0s loop | Mouth open, fire VFX |
| `breathStart` | 0.5s one-shot | Inhale |
| `death` | 4.0s one-shot | Fall, collapse |

### Grounded (4)
| Clip | Duration | Key Features |
|------|----------|--------------|
| `idle` | 4.0s loop | Alert, breathing |
| `rest` | 5.0s loop | Lying down, slow breath |
| `walk` | 1.5s loop | 4-beat gait |
| `eat` | 3.0s one-shot | Head to ground |

---

## Measurement Channels

Replace current `analyze-clips.py` channels with new rig:

| Channel | Definition | Purpose |
|---------|-----------|---------|
| `wing_elev_L/R` | Shoulder local Z rotation | Stroke amplitude |
| `wing_elev_bias` | `L − R` | Bank attitude |
| `wing_stroke_asymmetry` | `L.range − R.range` | Differential stroke |
| `body_axis_deg` | Root pitch | Flight mode |
| `root_roll_deg` | Root local X | Bank/roll |
| `root_translation` | RootMotion.Y translation | Root motion |
| `foot_drop` | Foot.z − Body.z | Leg carriage |
| `toe_curl_deg` | Toe local Z | Claw state |
| `head_reach.horizontal` | Head forward offset | Neck intent |
| `head_reach.lateral` | Head lateral offset | Turn lead |
| `tail_reach.lateral` | Tail lateral offset | Counterbalance |
| `jaw_deg` | Jaw rotation | Mouth open |
| `symmetry_error` | Wingtip reflection distance | Quality gate |

---

## Weight Painting Transfer

### Method

1. Export `drogon.glb` mesh from Blender
2. Build new armature in same file
3. Use Blender's **Data Transfer** modifier:
   - Source: old armature
   - Target: new armature
   - Transfer vertex groups by nearest surface
4. Manual cleanup on problem areas:
   - Wing membrane → wing finger bones
   - Neck-spine junction → correct chain
   - Tail base → verify continuity

### Verification

- Same mesh must render identically in T-pose
- No vertices left unweighted
- No double-weighting artifacts

---

## Export Requirements

### GLB Format

- **Format:** GLTF 2.0 binary (`.glb`)
- **Mesh:** Same triangle count, same UVs
- **Skeleton:** 49 bones
- **Animations:** 19 clips (optional separate GLB)

### Naming

- **File:** `wyvern.glb` (new canonical name)
- **Max bone name:** 40 chars (safe under 63)
- **Max clip name:** 15 chars

### Coordinate System

- **Export as:** +Y forward, +Z up (Blender default)
- **No axis conversion needed**

---

## Integration Plan

### Phase 1: Build Rig (Week 1)
1. Create new `.blend` file
2. Import `drogon.glb` mesh
3. Build new armature to spec
4. Transfer weight painting
5. Verify T-pose renders correctly

### Phase 2: Author Clips (Week 2-3)
1. Animate 19 essential clips
2. Run measurement pipeline
3. Define contracts for each mode
4. Validate all gates pass

### Phase 3: Integration (Week 4)
1. Export `wyvern.glb`
2. Update `manifest.ts` bone names
3. Update `boneOffsets.ts` with new channels
4. Update animation contracts
5. Full test suite passes

---

## Success Criteria

| Check | Pass Condition |
|-------|----------------|
| Visual identity | Mesh renders identically to original |
| Wing independence | Lateral head lean moves 0.0 wingtips |
| Symmetry | Base pose has <0.1° symmetry error |
| Bank clips | `wing_elev_bias` matches contract (±20°) |
| Root motion | Translation present in `RootMotion.Y` |
| Performance | <2ms skewing on mobile |
| Gates | `pnpm test` passes all contracts |

---

## Open Questions

1. **Retarget vs re-author?** 
   - Retarget: Faster (30-40h), quality ceiling limited
   - Re-author: Slower (80-120h), full control
   - **Recommendation:** Re-author essential 19, retarget remainder

2. **Root motion in all clips?**
   - Flight clips: Yes (forward motion)
   - Grounded clips: No (in-place, gameplay moves)
   - **Decision:** Author decides per clip

3. **Auxiliary bones for loops/rolls?**
   - Standard rig: ~50 bones
   - With acrobatics: +3 spine bones for continuous rotation
   - **Decision:** Optional "acrobat" variant

---

## Appendix: Vendor Rig Reference

| Property | Value |
|----------|-------|
| Filename | `drogon.glb` |
| Joints | 292 |
| Skins | 2 |
| Triangles | 39,234 |
| Clips | 52 |
| FPS | 24 |
| Max bone name | 36 chars |
| Max clip name | 66 chars (breaks Blender) |

---

## Appendix: Measurement Baseline (Vendor)

| Capability | Maximum | Source Clip |
|------------|---------|--------------|
| Wing elevation range | 162.2° | `Battle_SkyMoveL` |
| Stroke arc | 179.4° | `Battle_SkyMoveL` |
| Nose-up body axis | 58.4° | `Battle_Skill08` |
| Nose-down body axis | −18.1° | `Damage_Staggering_Right_Body` |
| Bank attitude | 52.8° | `Battle_SkyMoveL` |
| Wing extension (semispan) | 20.3 | `Battle_Skill07` |
| Foot drop | 5.6 | `Battle_Down02` |
| Wingbeat cadence | 0.11–1.08 Hz | Across 46 clips |

These are the **maximum** demonstrated capabilities. New rig should match or exceed them.
