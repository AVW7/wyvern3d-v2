# Rig Build Status

**Date:** August 3, 2026
**Blender File:** `public/models/wyvern-rig.blend`
**Status:** Armature built, pending weight transfer

---

## Completed: New Armature

| Metric | Before (Vendor) | After (New) | Reduction |
|--------|-----------------|-------------|-----------|
| **Total bones** | 291 | 44 | 85% |
| **Wing hierarchy** | Neck → Clavicle ❌ | Spine3 → WingRoot ✅ | Fixed |
| **Root motion** | None ❌ | RootMotion bone ✅ | Added |
| **Symmetry** | 0.63–1.05° error | Designed symmetric ✅ | Fixed |

---

## Bone Inventory

### Core (16 bones)
```
Root
├── RootMotion         [NEW] — root motion translation
│   └── Body
│       ├── Spine1 → Spine2 → Spine3
│       │   ├── Neck1 → Neck2 → Head → Jaw
│       │   ├── L_WingRoot → ...
│       │   └── R_WingRoot → ...
│       ├── Tail1 → Tail2 → Tail3 → Tail4 → Tail5 → Tail6
│       ├── L_LegRoot → ...
│       └── R_LegRoot → ...
```

### Wings (18 bones — 9 each side)
| Left Wing | Right Wing | Purpose |
|-----------|------------|---------|
| L_WingRoot | R_WingRoot | Wing anchor on Spine3 |
| L_WingShoulder | R_WingShoulder | Wing arm |
| L_WingElbow | R_WingElbow | Wing forearm |
| L_WingWrist | R_WingWrist | Wing hand |
| L_WingFinger1 | R_WingFinger1 | Primary flight feather |
| L_WingFinger2 | R_WingFinger2 | Secondary flight feather |
| L_WingFinger3 | R_WingFinger3 | Tertiary flight feather |
| L_WingMembrane1 | R_WingMembrane1 | Membrane support |
| L_WingMembrane2 | R_WingMembrane2 | Membrane support |

### Legs (10 bones — 5 each side)
| Left Leg | Right Leg | Purpose |
|----------|-----------|---------|
| L_LegRoot | R_LegRoot | Pelvis anchor |
| L_Thigh | R_Thigh | Upper leg |
| L_Calf | R_Calf | Lower leg |
| L_Foot | R_Foot | Ankle |
| L_Toes | R_Toes | Claw |

---

## Critical Fixes Applied

### 1. Wing Independence ✅
```
Before: Neck → ... → Clavicle (wings swing with head)
After:  Spine3 → WingRoot (wings independent)
```

### 2. Root Motion Bone ✅
```
Added: RootMotion bone
       - Translates in Y for forward flight
       - Rotates in X/Y/Z for rolls, loops
       - Separate from Body pose
```

### 3. Symmetric Base Pose ✅
```
- All L/R bones at mirror positions
- Same local transforms (sign-flipped X)
- No baked asymmetry
```

---

## Next Steps

### Phase 2: Weight Transfer

1. **Import original mesh** from `Dragon.fbx`
2. **Transfer weights** using Blender Data Transfer
3. **Manual cleanup** on:
   - WingRoot blend zones
   - LegRoot blend zones
   - RootMotion (center of mass)
   - Wing membrane-finger connections

### Phase 3: Test Animations

1. Pose rig in Blender
2. Verify mesh follows correctly
3. Check for clipping/penetration
4. Export test GLB

### Phase 4: Animate Essential Clips

Author 19 clips per `NEW_RIG_SPEC.md`:
- Flight (7): cruise, bankLeft, bankRight, hover, speed, glide, dive
- Transitions (3): takeoff, land, settle
- Actions (5): attack, attackAir, breath, breathStart, death
- Grounded (4): idle, rest, walk, eat

---

## Verification Checklist

- [x] Armature created in Blender
- [x] Wings parented to Spine3 (not Neck)
- [x] RootMotion bone added
- [x] Symmetric L/R bone placement
- [x] Saved to `wyvern-rig.blend`
- [ ] Weight transfer from original mesh
- [ ] Test poses verified
- [ ] GLB export successful
- [ ] Animation contracts pass

---

## Files

| File | Purpose |
|------|---------|
| `public/models/wyvern-rig.blend` | Blender source (armature only) |
| `public/models/source/drogon-game-of-thrones-dragon/` | Original FBX + textures |
| `docs/NEW_RIG_SPEC.md` | Full specification |
| `docs/BONE_MAPPING.md` | Vendor → New bone mapping |
