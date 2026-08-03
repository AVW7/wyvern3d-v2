# Source Assets Inventory

**Date:** August 3, 2026
**Location:** `public/models/source/drogon-game-of-thrones-dragon/`

---

## Source Files

### FBX Source (Primary)
```
source/Dragon.fbx
Size: 87.9 MB
Format: Autodesk FBX
```

**This is the original authoring file from the artist.**

Advantages over GLB:
- Contains full rig with proper bone hierarchy
- Preserves original skin weights
- No name truncation (FBX supports 64+ char bone names)
- Better Blender import compatibility
- Can be modified directly in Blender/3ds Max

### GLB Exports (Secondary)

| File | Size | Notes |
|------|------|-------|
| `drogon__game_of_thrones_dragon.glb` | 127 MB | Full model with animations |
| `drogon__game_of_thrones_dragon (1).glb` | 118 MB | Variant/alternate export |

These are the compressed runtime-ready versions. The larger size difference suggests:
- The 127MB version may have more animations embedded
- The 118MB version may be optimized/simplified

### Textures

| File | Size | Purpose |
|------|------|---------|
| `T_DaenerysDragon_Body_D.png` | 6.5 MB | Body diffuse/albedo |
| `T_DaenerysDragon_Head_D.png` | 6.2 MB | Head diffuse/albedo |

These are high-resolution source textures. For runtime:
- Compress to WebP
- Resize to 1024px or 2048px depending on platform
- Generate mipmaps in engine

---

## Workflow Recommendation

### Option A: Work from FBX (Recommended)

1. **Import `Dragon.fbx` into Blender**
   - File → Import → FBX
   - Check "Import Animations"
   - Inspect bone hierarchy

2. **Build new armature** (per `NEW_RIG_SPEC.md`)
   - Create new bones
   - Transfer weights from FBX mesh
   - Re-author animations

3. **Export as GLB**
   - Use `scripts/build-sidecar.py` pattern
   - Validate with `scripts/analyze-clips.py`

### Option B: Work from GLB

1. Import GLB into Blender
2. Inspect existing rig
3. Modify hierarchy (may break animations)
4. Re-export

**Not recommended** — GLB import may lose data due to:
- Name truncation (63 char limit)
- Loss of helper bones
- Compressed tracks

---

## Asset Attribution

**Source:** [Sketchfab / CGTrader — specify actual source]
**Original Model:** Game of Thrones Drogon Dragon
**License:** [Verify license before redistribution]

For `CREDITS.md` update:
```
## Wyvern Model
- Original: Drogon (Game of Thrones dragon fan art)
- Source: [URL]
- License: [CC-BY-4.0 /Royalty-Free / etc.]
- Modifications: New armature, re-animated for gameplay
```

---

## Next Steps

1. **Import FBX into Blender** and inspect rig
2. **Document current bone hierarchy** (what 292 bones are)
3. **Map source bones → new rig** (which bones to keep/remap)
4. **Begin armature rebuild** per `NEW_RIG_SPEC.md`

---

## File Checksums

```bash
# Verify files copied correctly
cd public/models/source/drogon-game-of-thrones-dragon
shasum -a 256 source/Dragon.fbx
shasum -a 256 textures/T_DaenerysDragon_Body_D.png
shasum -a 256 textures/T_DaenerysDragon_Head_D.png
```
