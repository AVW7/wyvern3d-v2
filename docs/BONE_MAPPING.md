# Bone Mapping: Vendor → New Rig

**Date:** August 3, 2026
**Purpose:** Map 292 vendor bones to 49 new bones for weight transfer

---

## Summary

| Category | Vendor Count | New Count | Reduction |
|----------|--------------|-----------|------------|
| **Load-bearing** | 152 | 49 | 68% |
| Dummy/helpers | 112 | 0 | 100% |
| Other/mesh nodes | 35 | 0 | 100% |
| **Total** | 300 | 49 | 84% |

---

## Vendor Rig Analysis

### Load-Bearing Bones (152)

| Chain | Vendor Count | Key Bones |
|-------|--------------|-----------|
| Spine | 7 | `Bip002-Spine*`, `Bip001-Spine` |
| Neck | 4 | `Bip002-Neck`, `Bip002-Neck1`, `Bip002-Neck2`, `Bip001-Neck` |
| Head | 4 | `Bip002-Head`, `Bip001-Head`, `B_Face_Jaw` |
| Tail | 11 | `Bip002-Tail*`, `Bip002-Ponytail1` |
| Clavicle | 4 | `Bip002-{L,R}-Clavicle`, `Bip001-{L,R}-Clavicle` |
| Arm (wing) | 8 | UpperArm, Forearm (both sides, both `Bip001`/`Bip002` variants) |
| Finger (wing) | 66 | 3 fingers × 3 bones × 2 sides + membrane bones |
| Leg | 8 | Thigh, Calf (both sides, both variants) |
| Foot | 4 | `Bip001-{L,R}-Foot`, `Bip002-{L,R}-Foot` |
| Toe | 36 | 4 toes × 2 bones × 2 sides + end caps |

### Non-Load-Bearing (160)

| Type | Count | Reason |
|------|-------|--------|
| Dummy helpers | 112 | Animation targets, IK, constraints — no weights |
| Mesh nodes | 35 | Scene graph, transform containers — no skinning |
| End caps | 13 | `_end` suffix bones — chain terminators |

---

## Bone Mapping Table

### Body Core (4 bones)

| New Bone | Vendor Bones | Notes |
|----------|--------------|-------|
| `Root` | `RootNode` | Scene origin |
| `RootMotion` | — | **NEW** — for root motion animation |
| `Body` | `Bip002-Spine_08` | Torso base |
| `Spine1` | `Bip002-Spine1_09` | Lower spine |

### Spine & Neck (6 bones)

| New Bone | Vendor Bones | Notes |
|----------|--------------|-------|
| `Spine2` | `Bip002-Spine2_010` | Mid spine |
| `Spine3` | `Bip002-Spine3_011` | Upper spine |
| `Neck1` | `Bip002-Neck_012` | Neck base |
| `Neck2` | `Bip002-Neck1_013` | Mid neck |
| `Head` | `Bip002-Head_015` | Skull |
| `Jaw` | `B_Face_Jaw_00_0160` | Mandible |

### Left Wing (10 bones)

| New Bone | Vendor Bones | Notes |
|----------|--------------|-------|
| `L_WingRoot` | `Bip002-Spine3_011` (offset) | **NEW** — wing anchor on spine |
| `L_WingShoulder` | `Bip002-L-Clavicle_049` | Wing arm |
| `L_WingElbow` | `Bip002-L-UpperArm_050` | Wing forearm |
| `L_WingWrist` | `Bip002-L-Forearm_051` | Wing hand |
| `L_WingFinger1` | `Bip002-L-Finger0_*` | Primary flight feather |
| `L_WingFinger2` | `Bip002-L-Finger1_*` | Secondary flight feather |
| `L_WingFinger3` | `Bip002-L-Finger2_*` | Tertiary flight feather |
| `L_WingMembrane1` | `Bip002-L-Finger3_*` | Membrane bone |
| `L_WingMembrane2` | Dummy bones | Membrane support |
| `L_WingTip` | `Bip002-L-Finger3*_end` | Wing tip |

### Right Wing (10 bones) — Mirrored

| New Bone | Vendor Bones | Notes |
|----------|--------------|-------|
| `R_WingRoot` | `Bip002-Spine3_011` (offset) | Mirrored from left |
| `R_WingShoulder` | `Bip002-R-Clavicle_086` | Wing arm |
| `R_WingElbow` | `Bip002-R-UpperArm_087` | Wing forearm |
| `R_WingWrist` | `Bip002-R-Forearm_088` | Wing hand |
| (same pattern) | — | Mirrored structure |

### Tail (6 bones)

| New Bone | Vendor Bones | Notes |
|----------|--------------|-------|
| `Tail1` | `Bip002-Ponytail1_016` | Tail base |
| `Tail2` | `Bip002-Tail_0214` | Tail segment |
| `Tail3` | `Bip002-Tail1_0215` | Tail segment |
| `Tail4` | `Bip002-Tail2_0216` | Tail segment |
| `Tail5` | `Bip002-Tail3_0217` | Tail segment |
| `Tail6` | `Bip002-Tail4_0218` | Tail tip |

### Left Leg (6 bones)

| New Bone | Vendor Bones | Notes |
|----------|--------------|-------|
| `L_LegRoot` | `Bip002-Spine1_09` (offset) | **NEW** — pelvis anchor |
| `L_Thigh` | `Bip002-L-Thigh_0186` | Upper leg |
| `L_Calf` | `Bip002-L-Calf` | Lower leg |
| `L_Foot` | `Bip002-L-Foot_0188` | Ankle |
| `L_Toes` | `Bip002-L-Toe0_*` | Main claw |
| `L_ToeClaws` | `Bip002-L-Toe1/2/3_*` | Secondary claws |

### Right Leg (6 bones) — Mirrored

| New Bone | Vendor Bones | Notes |
|----------|--------------|-------|
| (mirrored) | `Bip002-R-*` | Same structure as left |

---

## Weight Transfer Strategy

### Direct Mapping (1:1)

Most bones map directly — use Blender's Data Transfer:
1. Select new armature
2. Add Data Transfer modifier
3. Source: vendor armature
4. Map by: Nearest Surface
5. Vertex Groups: All

### Multi-Source Mapping (N:1)

Some new bones merge multiple vendor bones:

| New Bone | Vendor Sources | Weight Formula |
|----------|----------------|----------------|
| `L_WingFinger1` | `L-Finger0` × 3 bones | Sum weights, normalize |
| `L_Toes` | `L-Toe0` × 2 bones | Sum, normalize |
| `Tail1` | `Ponytail1` + nearest Tail | Distance-weighted blend |

### New Bones (No Vendor Equivalent)

These need weight painting from scratch:
- `RootMotion` — use `RootNode` weights or paint manually (center of mass)
- `L_WingRoot` — paint blend zone between `Spine3` and `L-Clavicle`
- `R_WingRoot` — mirrored from left
- `L_LegRoot` — paint blend between `Spine1` and `L-Thigh`
- `R_LegRoot` — mirrored from left

---

## Verification Checklist

After weight transfer:

- [ ] No unweighted vertices (all vertices assigned to ≥1 bone)
- [ ] No double weighting artifacts (smooth gradients)
- [ ] Wing membrane moves with fingers
- [ ] Neck-spine junction bends smoothly
- [ ] Tail follows body motion
- [ ] Legs tuck/fold correctly
- [ ] T-pose matches original mesh position
- [ ] Test render matches original pose

---

## Bone Name Reference

### Vendor Naming Patterns

| Pattern | Meaning |
|---------|---------|
| `Bip002-*` | Main armature (body axis) |
| `Bip001-*` | Secondary armature (limbs) |
| `Dummy*` | Helper bones (no weights) |
| `*_end` | Chain terminator (no weights) |
| `*_L` / `*_R` | Left / Right side |
| `L-FingerN(M)` | Wing finger N, bone M (proximal→distal) |
| `L-ToeN` | Hind toe N |

### New Naming Convention

| Pattern | Meaning |
|---------|---------|
| `Root` | Scene origin |
| `RootMotion` | Root motion translation |
| `L_*` / `R_*` | Left / Right side |
| `*_Root` | Chain anchor |
| `*_Shoulder/Elbow/Wrist` | Wing limb chain |
| `TailN` | Tail segment (1=base, 6=tip) |

---

## Blender Implementation Steps

1. **Import vendor GLB/FBX**
   ```
   File → Import → FBX → Dragon.fbx
   ```

2. **Create new armature**
   - Add → Armature → Single Bone
   - Build hierarchy per mapping table

3. **Transfer weights**
   - Select mesh → Add Modifier → Data Transfer
   - Source: vendor armature
   - Vertex Groups: All
   - Mapping: Nearest Surface

4. **Manual cleanup**
   - Paint `RootMotion` weights (center of mass)
   - Blend `WingRoot` zones
   - Blend `LegRoot` zones
   - Check membrane-finger connections

5. **Test animation**
   - Pose new armature
   - Verify mesh follows correctly
   - Check for clipping/penetration

---

## Export Requirements

After building new rig:

```bash
# Export as GLB
File → Export → glTF 2.0 (.glb)
- Apply Modifiers: ✓
- Include: Mesh + Armature + Animations
- Format: GLB
- Compression: MeshOPT
```

Verify:
- Bone count ≈ 49
- Mesh identical to original
- Animations play correctly
