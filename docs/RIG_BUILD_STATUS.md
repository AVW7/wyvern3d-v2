# Rig Build Status

**Date:** August 3, 2026
**Blender File:** `public/models/wyvern-rig.blend` (129MB, on disk only)
**GLB Export:** `public/models/wyvern.glb` (15.7MB, in git)
**Status:** ✅ Armature built, weights transferred, GLB exported, wired into manifest

---

## Completed Milestones

### ✅ Phase 1: Armature Build
- 46 bones (down from 291 — 84% reduction)
- Wings parented to Spine3 (not Neck) — **fixes the core defect**
- RootMotion bone added for root motion support
- All bones positioned at original mesh coordinates

### ✅ Phase 2: Weight Transfer
- 21,580 vertices → 44 vertex groups (100% coverage)
- Transferred from 165 original vertex groups
- 484 edge vertices auto-assigned to nearest bone
- Vertex positions match original exactly (0.0 diff)

### ✅ Phase 3: Verification
- Wing deformation verified: 88+ verts move on shoulder rotation
- Wing independence confirmed: 0 neck verts affected by wing motion
- Armature modifier works correctly
- Mesh renders without deformation in rest pose

### ✅ Phase 4: Export & Integration
- Exported `wyvern.glb` (46 joints, 1 mesh, 2 textures, 15.7MB)
- Wired into `manifest.ts` as `wyvern.drogon`
- All 365 tests pass (35 animation contracts skipped — need clips)
- TypeScript compilation clean

---

## Bone Hierarchy (Final)

```
Root
├── RootMotion          [NEW — root motion support]
│   └── Body            [pelvis]
│       ├── Spine1 → Spine2 → Spine3
│       │   ├── Neck1 → Neck2 → Head → Jaw
│       │   ├── L_WingRoot → Shoulder → Elbow → Wrist → Finger1/2/3
│       │   └── R_WingRoot → Shoulder → Elbow → Wrist → Finger1/2/3
│       ├── Tail1 → Tail2 → Tail3 → Tail4 → Tail5 → Tail6
│       ├── L_LegRoot → Thigh → Calf → Foot → Toes
│       └── R_LegRoot → Thigh → Calf → Foot → Toes
```

**Key fix:** Wings branch from Spine3, NOT from Neck1.

---

## Comparison: Before vs After

| Metric | Vendor Rig | New Rig | Change |
|--------|-----------|---------|--------|
| Total bones | 291 | 46 | -84% |
| Wing parent | Neck | Spine3 | Fixed |
| Root motion | None | RootMotion bone | Added |
| Vertex groups | 165 | 44 | -73% |
| Unweighted verts | 0 | 0 | Same |
| Mesh vertices | 21,580 | 21,580 | Preserved |
| Mesh faces | 39,238 | 39,238 | Preserved |
| Textures | 2 | 2 | Preserved |
| GLB size | 15.6MB | 15.7MB | +0.1MB |
| Animations | 52 | 0 (pending) | Next phase |

---

## Next Steps

### Phase 5: Author Essential Clips (Priority)

19 clips needed per `NEW_RIG_SPEC.md`:

| Category | Clips | Priority |
|----------|-------|----------|
| Flight | cruise, bankLeft, bankRight, hover, speed, glide, dive | 🔴 Critical |
| Transitions | takeoff, land | 🔴 Critical |
| Actions | attack, breath, death | 🔴 Critical |
| Grounded | idle, walk, rest | 🟡 High |

### Phase 6: Animation Contracts

1. Re-enable `animationContracts.test.ts` (currently 35 skipped)
2. Update bone names in contracts
3. Update `boneOffsets.ts` with new bone positions
4. Run measurement pipeline

### Phase 7: Polish

1. Refine weight painting on blend zones
2. Optimize GLB (meshopt compression)
3. Add remaining wyvern variants (rhaegal, viserion, etc.)
