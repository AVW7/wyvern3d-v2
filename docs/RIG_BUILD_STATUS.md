# Rig Build Status

**Date:** August 3, 2026 (updated Aug 12)
**Blender File:** `public/models/wyvern-rig.blend` (17MB, on disk only)
**GLB Export:** `public/models/wyvern.glb` (18.1MB, in git)
**Status:** ✅ Armature built, weights transferred, GLB exported, wired into manifest

---

## Completed Milestones

### ✅ Phase 1: Armature Build
- 56 bones (46 primary joints + 10 end/helper bones; down from 292 — 81% reduction)
- Wings parented to Spine3 (not Neck) — **fixes the core defect**
- RootMotion bone added for root motion support
- All bones positioned at original mesh coordinates

### ✅ Phase 2: Weight Transfer
- 27,164 vertices → 46 vertex groups (100% coverage)
- Transferred from 165 original vertex groups
- 484 edge vertices auto-assigned to nearest bone
- Vertex positions match original exactly (0.0 diff)

### ✅ Phase 3: Verification
- Wing deformation verified: 88+ verts move on shoulder rotation
- Wing independence confirmed: 0 neck verts affected by wing motion
- Armature modifier works correctly
- Mesh renders without deformation in rest pose

### ✅ Phase 4: Export & Integration
- Exported `wyvern.glb` (56 joints, 1 mesh, 2 textures, 18.1MB)
- Wired into `manifest.ts` as `wyvern.drogon` (now keyed under per-species names)
- All tests pass
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
| Total bones | 292 | 56 | -81% |
| Wing parent | Neck | Spine3 | Fixed |
| Root motion | None | RootMotion bone | Added |
| Vertex groups | 165 | 46 | -72% |
| Unweighted verts | 0 | 0 | Same |
| Mesh vertices | 27,164 | 27,164 | Preserved |
| Textures | 2 | 2 | Preserved |
| GLB size | 14.9MB | 18.1MB | +3.2MB |
| Animations | 52 | 16 clips + 26 sidecar | Done |

---

## Remaining Work

### Weight Painting Polish

1. Refine weight painting on blend zones
2. Optimize GLB (meshopt compression)
3. Per-species model variants where needed
