# Sanctuary Environment Baseline — Capture Checklist & Fixed Views

This checklist defines the fixed camera positions, field-of-view lenses, lighting time-of-day states, and inspection routes for visual and performance comparison across environment art stages.

---

## 1. Fixed Review Cameras (Developer Inspection Route)

| Camera ID | Focal Length (35mm Equiv) | Position `[x, y, z]` | Target `[x, y, z]` | Purpose & Subject Framing |
|---|---|---|---|---|
| `cam.keepArrival` | 28 mm (FOV 65°) | `[0, 3.5, -45]` | `[0, 1.5, -30]` | North Keep Arrival: War Table, Ledger, Barracks, Gate |
| `cam.mainSpine` | 35 mm (FOV 54°) | `[0, 8.0, -25]` | `[0, 0, 15]` | North-to-South Processional Spine towards Flight Ring |
| `cam.centralCommons` | 24 mm (FOV 74°) | `[0, 14.0, 0]` | `[0, 0, 0]` | Wide overview of central flight corridor and wyvern clearances |
| `cam.careCourt` | 35 mm (FOV 54°) | `[5, 4.0, -15]` | `[18, 1.5, 0]` | Sheltered Care: Hatchery cave mouth, egg roosts, infirmary |
| `cam.craftFireYard` | 35 mm (FOV 54°) | `[20, 5.0, -5]` | `[33, 2.0, 10]` | Eastern Industrial Yard: Scale Forge, quench trough, burn range |
| `cam.trainingEdge` | 35 mm (FOV 54°) | `[-15, 6.0, 10]` | `[-35, 1.5, 20]` | Western Rough Edge: Hunting Pen, Endurance Trailhead |
| `cam.perimeterOverview` | 24 mm (FOV 74°) | `[0, 40.0, -65]` | `[0, 0, 0]` | Aerial Master Overview: Boundary concealment and terrain skirt |
| `cam.interactionForge` | 50 mm (FOV 40°) | `[29, 1.8, -14]` | `[32, 1.2, -11]` | Interaction Close-up: Anvil, hammer, quench trough |
| `cam.interactionHatchery` | 50 mm (FOV 40°) | `[11, 1.8, -6]` | `[14, 1.2, -3]` | Interaction Close-up: Incubating egg bowl & rune glow |

---

## 2. Lighting & Atmosphere States

Compare every viewpoint across the 3 core time-of-day phases in `src/scenes/Sanctuary/atmosphere/palette.ts`:

1. **Day (`timeOfDay = 0.35` / 11:00 AM)**
   - Sun Altitude: ~55° south-east
   - Sky: Cool azure dome (`#4a7c9f`), bright warm directional light (`#fff8e7`, intensity 1.4)
   - Ambient Fill: Soft sky blue (`#7ca0b8`, intensity 0.45)
   - Focus: Value hierarchy, shadow sharpness under structures, stone vs. timber contrast.

2. **Dusk / Golden Hour (`timeOfDay = 0.75` / 18:30 PM)**
   - Sun Altitude: ~12° west
   - Sky: Deep amber-crimson gradient (`#bf5535` to `#3b2542`)
   - Directional Light: Low warm raking light (`#ff8533`, intensity 0.9)
   - Practical Lights: Torches and forge embers begin to claim local illumination pools.
   - Focus: Long cast shadows, rim light on wyvern silhouettes, warm vs. cool separation.

3. **Night (`timeOfDay = 0.05` / 01:00 AM)**
   - Sky: Deep navy/indigo dome (`#0b1120`)
   - Moon Fill: Desaturated cool blue (`#1e293b`, intensity 0.18)
   - Point Lights: Standing torches (`#ff9933`, radius 6m), Forge fire (`#ff5500`, radius 9m), Hatchery runes (`#38bdf8`, radius 5m)
   - Focus: Local pool readability, dark contrast without black crushing, emissive ground contact.

---

## 3. Metrics Checklist (Hardware Profiling Reference)

For every stage gate, verify the following metrics from `cam.centralCommons` and `cam.perimeterOverview`:

- [ ] **GLB Budget**: `sanctuary.glb` $\le 8.0\text{ MB}$ (soft budget), $\le 15.0\text{ MB}$ (hard cap). Current: $3.66\text{ MB}$.
- [ ] **Total Scene Triangles**: $\le 120,000$ triangles at camera overview (props + terrain + keep + wyverns).
- [ ] **Draw Calls**: $\le 45$ draw calls via batched `InstancedMesh` atlas rendering.
- [ ] **Texture Memory**: Single shared palette texture ($256 \times 256$ or $1024 \times 1024$ atlas) $\le 4\text{ MB}$ VRAM.
- [ ] **Target Frame Rate**: Sustained 60 FPS (frame budget $< 16.6\text{ ms}$) on standard M-series Mac / WebGL2 desktop.
- [ ] **Station Reachability**: Zero blocked colliders between keep arrival, commons, care court, forge, and training gates.
- [ ] **Wyvern Flight Sweeps**: Central commons ($[-15, +15]$ in X, $[-10, +25]$ in Z) completely free of tall trees or suspended banners.
