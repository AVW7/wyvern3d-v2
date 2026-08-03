# Flight Lab Enhancement Plan

**Status: Completed**
**Created: 2026-08-03**
**Goal: Modularize the Flight Lab architecture, establish a comprehensive animation development and model debugging environment, author speed-dependent head/neck/tail dynamics, build a dedicated readout & debug log panel with copy-paste code export, and implement interactive food props (big-doe, small-bird) for fire attack and hunting simulation.**

---

## Executive Summary

The Flight Lab located at `/debug/animation` is the core workbench for Wyvern animation engineering and 3D gameplay iteration. To support rapid model improvement, animation authoring, and complex combat mechanics, this plan outlines:

1. **Modular Code Architecture** - Refactoring monolithic components into decoupled, single-responsibility UI panels, render containers, and headless controllers.
2. **Wyvern Model & Rig Development Suite** - Tools to inspect rig axes, joint angle limits, mesh deformations, and contract gates live in the browser.
3. **Speed-Dependent Dynamics & Dedicated Readout Panel** - Tuning head, neck, and tail responses across speed ranges (0 to 60 u/s) with a dedicated telemetry readout panel, historical log stream, and one-click copy-paste code exporting.
4. **Animation Debugging & Authoring Pipeline** - Scrubbing, isolating procedural controllers, and authoring new flight/attack animations (Scout Flight Mode, Aerial Attack Action, Fire Charge Pose, Swoop Hunt).
5. **Food Props & Prey Systems** - Introducing dynamic prey entities (`big-doe` ground prey, `small-bird` flying prey) with panic AI, flocking/herd behavior, and food value drops.
6. **Fire Attack & Hunting Simulation** - Testing fire breath, fireball, air cannon, and wing gust attacks against props with thermal roasting physics, talon grab mechanics, and prey consumption loops.

---

## Part 1: Modular Flight Lab Architecture

Currently, `FlightLab.tsx` (~936 lines) and `page.tsx` (~1100 lines) contain inline canvas setups, bone manipulation loops, UI widgets, and metrics. We will refactor this into a modular directory structure:

```
src/app/debug/animation/
├── page.tsx                      # Route entry & layout container
├── constants.ts                  # Lab presets, default configurations
├── FlightLab.tsx                 # Top-level coordinator
├── components/
│   ├── FlightLabCanvas.tsx       # R3F Canvas, lights, shadow mapping, grid
│   ├── FlightLabRigContainer.tsx # Model loader, skeleton handle, bone chain setup
│   ├── FlightLabUI.tsx          # Tabbed Apple-styled control panel dock
│   ├── AnimationControls.tsx    # Pose presets, phase controls, wave sliders
│   ├── RigBoneInspector.tsx     # 3D bone gizmos, joint angle limits, contract checks
│   ├── ReadoutLogPanel.tsx      # Dedicated telemetry readout, log stream & copy-paste panel
│   ├── CombatControls.tsx       # Attack selection, fire breath, fireball, air cannon
│   ├── PropPanel.tsx            # Prey spawner (big-doe, small-bird), herd AI controls
│   └── MetricsPanel.tsx         # FPS, frame budget, bone update timings, hit stats
├── systems/
│   ├── FlightLabController.ts   # Central tick orchestrator (direct Object3D mutation)
│   ├── AnimationSandbox.ts      # Dynamic pose blending & curve authoring engine
│   ├── CombatSimulator.ts       # Local attack & projectile physics simulator
│   ├── PropManager.ts          # Spawning, spatial partition & prop lifecycle
│   ├── HuntSimulator.ts         # Target lock, swoop trajectory, grab/kill mechanics
│   └── LabMetricsCollector.ts   # Real-time rig assertion & performance monitor
└── props/
    ├── PropBase.ts              # Base class for lab props & prey entities
    ├── PreyDoe.ts               # Big-doe: Large ground prey entity (deer)
    ├── PreyBird.ts              # Small-bird: Flying prey entity with 3D flocking
    ├── TargetDummy.ts          # Invulnerable static target dummy
    └── FoodCarcass.ts           # Edible roasted food drop created from hunted prey
```

---

## Part 2: Model Improvement, Animation Debugging & Authoring

### 2.1 Model & Rig Inspection Suite

- **Live Rig Axis & Joint Angle Inspector (`RigBoneInspector.tsx`)**:
  - Renders 3D joint gizmos over key skeletal landmarks (`Bip002-Head_015`, `Bip002-Pelvis_07`, `Bip002-Tail6_01`, `Bip002-L-Foot_0188`, `Bip002-R-Foot_0202`, wing tips).
  - Displays real-time Euler/Quaternion angles and validates against measured rig axes in `docs/WYVERN_ANIMATION_BASELINE.md`.
- **Mesh Deformation & Weight Painting Check**:
  - Enables wireframe toggle and vertex stretch heatmaps to catch mesh clipping during extreme wing folds or neck twists.
- **Numeric Contract Bounds Checker**:
  - Evaluates per-frame body pitch, foot clearance below pelvis, and tail extent behind origin against contract gates in real time.

### 2.2 Speed-Dependent Head, Neck, Tail Dynamics & Readout Log Panel

#### Speed-Dependent Dynamics Controls
To make speed-dependent behavior clear and intuitive when testing:
- **Airspeed Slider & Presets**: Live airspeed control from 0 u/s (Hover) to 20 u/s (Cruise) to 60 u/s (Dive).
- **Head & Neck Response**:
  - *Hover (0–10 u/s)*: High posture, wide gaze scanning angle, soft neck curve.
  - *Cruise (10–30 u/s)*: Streamlined neck alignment, pitch trim dampening.
  - *High Speed / Dive (30–60 u/s)*: Aerodynamic neck tuck, forward gaze lock on target trajectory.
- **Tail Flex & Drag Dynamics**:
  - *Hover / Slow Flight*: Wide serpentine wave propagation across all 6 tail bones (`Bip002-Tail1_0215` to `Bip002-Tail6_01`).
  - *High Speed*: Tail stiffness weighting increases with speed, aligning behind origin to simulate aerodynamic drag.

#### Dedicated Readout & Copy-Paste Debug Panel (`ReadoutLogPanel.tsx`)
A dedicated panel for telemetry analysis and developer workflow:
- **Live Telemetry Readout**:
  - Head pitch/yaw/roll angles.
  - Neck curvature index & Gaze target vector.
  - Tail extent behind pelvis & flex angle.
  - Current airspeed, vertical speed, and pitch trim angle.
- **One-Click Copy & Export Controls**:
  - `Copy Pose Code`: Copies ready-to-paste TypeScript pose config formatted for `src/render/flightPose.ts`.
  - `Copy Telemetry JSON`: Copies a clean JSON snapshot of active bone transforms and state variables.
  - `Copy Debug Logs`: Copies the entire frame log stream or filtered error entries to clipboard.
- **Historical Log Stream Window**:
  - Scrollable, searchable log window capturing frame-level events (`[SPEED_CHANGE]`, `[POSE_TRANSITION]`, `[CONTRACT_BOUND]`, `[GAZE_LOCK]`).
  - Log pause, clear, and filter controls to step through anomalies during motion debugging.

```typescript
// Readout & Log Panel Interface
export interface TelemetrySnapshot {
  timestamp: number
  airspeed: number
  pitchAngle: number
  headOrientation: { x: number; y: number; z: number }
  neckCurve: number
  tailExtent: number
  tailFlexAngles: number[]
  activeControllers: string[]
  contractStatus: 'pass' | 'warn' | 'fail'
}
```

### 2.3 Animation Debugging Pipeline

- **Controller Isolation Matrix**:
  - Toggles individual procedural systems independently to isolate bugs:
    - `Spine Wave Controller` (`spineWave.ts`)
    - `Dynamic Tail Controller` (`tailController.ts`)
    - `Intelligent Head/Neck Gaze Controller` (`gazeController.ts`)
    - `Dynamic Leg Physics` (`legPhysics.ts`)
    - `Dynamic Wing Refinement` (`wingRefinement.ts`)
    - `Flight Jaw Sealing` (`flightMouth.ts`)
- **Frame Scrubbing & Speed Control**:
  - Pause, step forward/backward frame by frame, and speed scaling (0.1x to 2.0x).
- **Preset Exporter**:
  - Export lab-tuned pose parameters directly as TypeScript code snippets for copy/pasting into `src/render/flightPose.ts`.

### 2.4 Authoring New Animations

The lab will serve as the authoring suite for upcoming flight and combat animation stages:

1. **Scout Flight Mode (Stage 4.9)**:
   - *Characteristics*: High-altitude glide, slow powerful flap cycles, broad wing span, subtle head scanning gaze.
   - *Lab Authoring*: Tune spine wave frequency down to 0.6 Hz, increase wing spread angle, apply wide-angle head sweep.
2. **Aerial Attack Action (Stage 4.95)**:
   - *Characteristics*: High-speed dive stance, wings swept back at 45°, legs thrust forward with talons flared, mouth agape for fire release.
   - *Lab Authoring*: Author posture blending from Cruise → Dive → Flare-Brake.
3. **Fire-Breath Charge Pose**:
   - *Characteristics*: Neck arches back, throat expands slightly, chest lifts, wings flare outward for stabilization.
   - *Lab Authoring*: Procedural neck arc + jaw unseal state synced with particle charge-up.
4. **Swoop-Hunt & Prey Grab Pose**:
   - *Characteristics*: Steep downward trajectory, gaze locked on ground prey, foot chain extending for snatch, immediate pull-up climb.

---

## Part 3: Fire Attack & Combat Systems

The lab provides a sandbox to test fire and air attack mechanics on dynamic targets without needing full battle scene initialization.

### 3.1 Attack Types & Specifications

```typescript
export type LabAttackType = 'fire_breath' | 'fireball' | 'air_cannon' | 'wing_gust'

export interface FireBreathConfig {
  range: number                  // Default: 26 units
  halfAngle: number              // Default: 35 degrees
  baseDamage: number             // Base dps
  tickRate: number               // 10 ticks/sec
  chargeTime: number             // 0.4s pre-stream buildup
  sustainTime: number            // 1.5s max stream duration
  cooldown: number               // 3.0s
  afterburnDuration: number      // 2.0s burn on target
  roastThermalEnergy: number     // Thermal value for cooking prey
}

export interface FireballConfig {
  range: number                  // 40 units
  projectileSpeed: number        // 45 units/s
  minDamage: number              // Quick release damage
  maxDamage: number              // Full charge (2.0s) damage
  maxChargeTime: number          // 2.0s
  aoeRadius: number              // 4.0 units explosion radius
  cooldown: number               // 4.0s
}

export interface AirCannonConfig {
  range: number                  // 35 units
  projectileSpeed: number        // 60 units/s
  impactDamage: number           // Direct hit damage
  knockbackForce: number         // Pushes prey back
  staggerDuration: number        // Stuns small prey
  cooldown: number               // 2.5s
}

export interface WingGustConfig {
  range: number                  // 15 units semicircle
  arcAngle: number               // 180 degrees
  damage: number                 // Light damage
  knockbackForce: number         // High force
  cooldown: number               // 5.0s
}
```

### 3.2 Attack Visual Effects (VFX)

- **Fire Breath Stream**: Ember particle emitter, wispy smoke trail, heat distortion mesh, mouth origin anchor (`Bip002-Head_015`).
- **Fireball Charge & Release**: Mouth orb growth during hold phase, trailing flame projectile, explosion shockwave on impact.
- **Air Cannon Burst**: Radial air distortion ring, ground dust kick-up trail.
- **Wing Gust Flare**: Wing blur mesh, particle debris arc in front of wyvern.

---

## Part 4: Test Props & Food Prey Systems (Big-Doe & Small-Bird)

To test fire attacks and hunt interactions, the lab includes an interactive prop system with dynamic prey entities that react to threats, take damage, burn, die, and become food.

### 4.1 Base Prop Class (`PropBase.ts`)

```typescript
export type PropType = 'prey_doe' | 'prey_bird' | 'target_dummy' | 'food_carcass'

export abstract class PropBase {
  id: string
  type: PropType
  position: Vector3
  rotation: Vector3
  velocity: Vector3
  hp: number
  maxHp: number
  isDead: boolean
  isRoasting: boolean
  roastProgress: number // 0 (raw) to 1 (cooked food)

  abstract update(dt: number, wyvernPosition: Vector3, attacks: LabAttackInstance[]): void
  abstract takeDamage(amount: number, attackType: LabAttackType, thermalEnergy?: number): void
  abstract getBoundingSphere(): Sphere
}
```

### 4.2 Big-Doe (`PreyDoe.ts` - Large Ground Prey / Food)

- **Description**: Large ground prey animal (deer model/placeholder) for ground swoop and fire stream testing.
- **Stats**: HP = 80, Speed = 8 units/s, Food Value = 50, Detection Radius = 25 units.
- **State Machine**:
  - `Grazing`: Idle animation, slow wandering path.
  - `Alert`: Head raised, eyes/gaze locked on wyvern when wyvern approaches within detection radius.
  - `Fleeing`: Sprinting away from wyvern / fire stream, herd alignment with nearby doe.
  - `Roasting`: Taking fire damage, particle smoke rising, skin texture transitioning to charred/cooked.
  - `Dead/Carcass`: Collapses into ragdoll/carcass prop; turns into consumable `FoodCarcass` with +50 Food value.

```typescript
export class PreyDoe extends PropBase {
  state: 'grazing' | 'alert' | 'fleeing' | 'roasting' | 'dead'
  fleeTarget: Vector3 | null
  herdId: string | null

  update(dt: number, wyvernPosition: Vector3, attacks: LabAttackInstance[]): void {
    // 1. Detect wyvern threat / incoming fire
    // 2. Update movement vector & herd cohesion
    // 3. Process fire burn & roasting transitions
  }
}
```

### 4.3 Small-Bird (`PreyBird.ts` - Flying Prey / Food)

- **Description**: Small, agile flying bird for testing aerial interception, air cannon accuracy, and mid-air snatching.
- **Stats**: HP = 15, Speed = 14 units/s, Food Value = 15, Detection Radius = 20 units.
- **State Machine**:
  - `Perched`: Resting on ground or rock prop.
  - `Flocking`: 3D flight using Boids flocking algorithm (cohesion, separation, alignment).
  - `Evasion`: Rapid diving/zig-zag maneuvers when wyvern swoops or fires projectiles.
  - `Seared/Falling`: Hit by fire or air cannon mid-air, tumbles downward with gravity physics.
  - `Dead/Food`: Drops to ground as a small roasted bird carcass (+15 Food value).

```typescript
export class PreyBird extends PropBase {
  state: 'perched' | 'flocking' | 'evasion' | 'falling' | 'dead'
  flockGroup: PreyBird[]

  update(dt: number, wyvernPosition: Vector3, attacks: LabAttackInstance[]): void {
    // 1. Evaluate Boids 3D flocking behavior
    // 2. Check aerial threat distance
    // 3. Fall under gravity when hit mid-air
  }
}
```

### 4.4 Target Dummy (`TargetDummy.ts`)

- Invulnerable static dummy used to measure continuous DPS, fire stream cone coverage, and knockback forces.
- Renders floating damage numbers, hit locations, and burn intensity heatmaps.

### 4.5 Prop Manager (`PropManager.ts`)

Manages life cycle, dynamic spawning, spatial indexing, and cleanup:

```typescript
export class PropManager {
  private props: Map<string, PropBase> = new Map()

  spawnDoe(position?: Vector3): PreyDoe
  spawnBird(position?: Vector3): PreyBird
  spawnDummy(position?: Vector3): TargetDummy
  clearAllProps(): void
  getPropsInRange(center: Vector3, radius: number): PropBase[]
  getFoodCarcasses(): FoodCarcass[]
  update(dt: number, wyvernPosition: Vector3, attacks: LabAttackInstance[]): void
}
```

---

## Part 5: Hunt Simulation & Food Interaction Mechanics

The lab provides a complete simulation loop for testing wyvern hunting interactions:

```
[Target Lock] ──> [Gaze Tracking] ──> [Aerial Swoop] ──> [Fire/Grab Attack] ──> [Food Carcass Drop] ──> [Wyvern Feed & Restore]
```

### 5.1 Hunting Sequence Steps

1. **Target Lock-On**:
   - Select prey prop (`big-doe` or `small-bird`) manually via UI or automatically via nearest-target selection.
2. **Gaze Tracking Integration**:
   - The Intelligent Head/Neck Gaze Controller (`gazeController.ts`) locks `headTarget` onto the selected prey's position.
3. **Swoop Trajectory Execution**:
   - Wyvern transitions to Dive/Swoop posture (legs extended, wings swept).
4. **Fire or Talon Interception**:
   - **Option A (Fire Hunt)**: Wyvern ignites Fire Breath or shoots Fireball; thermal damage roasts prey into cooked food (`FoodCarcass`).
   - **Option B (Talon Snatch)**: Wyvern swoops down to talon contact range; triggers snatch animation, killing target.
5. **Prey Consumption & Food Feedback**:
   - Wyvern lands near carcass or consumes bird mid-air.
   - Lab UI logs +Food gained, hunting duration, accuracy, and restores Wyvern stamina/hunger gauges.

### 5.2 Debug Overlays & Visual Feedback

- **Targeting Reticle**: 3D lock-on ring over selected prey with distance & HP bar.
- **Fire Cone & Hitbox Visualizer**: Wireframe cone showing exact 35° angle, 26 unit range, and intersected prey hitboxes.
- **Thermal Roast Meter**: Progress bar over burning prey indicating raw -> seared -> cooked food transformation.
- **Swoop Trajectory Spline**: Visual 3D curve showing wyvern approach path.

---

## Part 6: Implementation Phases & Schedule

### Phase 1: Modular Refactoring of Flight Lab (Step 1)
- [ ] Split `FlightLab.tsx` into `FlightLabCanvas`, `FlightLabUI`, `FlightLabRigContainer`.
- [ ] Create `systems/FlightLabController.ts` to manage animation loop without `setState` in `useFrame`.
- [ ] Implement clean Apple-styled tabbed control panel layout (`Animation`, `Rig`, `Readout/Logs`, `Combat`, `Props`, `Metrics`).

### Phase 2: Rig Inspection & Dedicated Readout Log Panel (Step 2)
- [ ] Build `RigBoneInspector.tsx` with 3D joint gizmos and live angle readouts.
- [ ] Build `ReadoutLogPanel.tsx` with real-time bone telemetry, historical log stream, and one-click copy buttons (`Copy Pose Code`, `Copy JSON`, `Copy Logs`).
- [ ] Implement speed-dependent Head, Neck, and Tail dynamics controls (0 to 60 u/s airspeed scaling).
- [ ] Implement procedural controller isolation toggles (Spine, Tail, Gaze, Legs, Wings, Jaw).

### Phase 3: Authoring New Animations (Step 3)
- [ ] Author **Scout Flight Mode** parameters (slow flap, wide glide, scanning gaze).
- [ ] Author **Aerial Attack Action** parameters (dive posture, talon flare, agape jaw).
- [ ] Author **Fire-Breath Charge Pose** & **Swoop Hunt** posture.
- [ ] Build parameter preset exporter to sync lab settings to `src/render/flightPose.ts`.

### Phase 4: Test Props & Food System (Step 4)
- [ ] Create `PropBase` and `PropManager`.
- [ ] Implement `PreyDoe` (`big-doe`) with grazing, alert, panic flee, and herd behavior.
- [ ] Implement `PreyBird` (`small-bird`) with 3D Boids flocking and perching behavior.
- [ ] Implement `TargetDummy` and `FoodCarcass` entity classes.

### Phase 5: Fire Attack Enhancements & Roasting Physics (Step 5)
- [ ] Create `CombatSimulator.ts` supporting Fire Breath, Fireball, Air Cannon, and Wing Gust.
- [ ] Implement thermal roasting logic turning prey into edible food carcasses upon fire kill.
- [ ] Add particle effects for charging, fire stream, fireball impact, and air cannon shockwave.

### Phase 6: Hunt Simulation & Gameplay Integration (Step 6)
- [ ] Implement `HuntSimulator.ts` (target lock, gaze tracking, swoop trajectory, grab/kill).
- [ ] Connect food ingestion feedback (+Food, stamina/hunger replenishment).
- [ ] Export battle-tested attack & hunt parameters to core combat logic (`src/core/combat/`).

---

## Verification & Quality Gates

After each phase, run the standard project quality checks:

```bash
pnpm typecheck && pnpm lint && pnpm test
```

For animation asset or rig changes, also run:

```bash
pnpm assets:validate-sidecar
```

And for combat/economy balance validation:

```bash
pnpm sim:battle
```

---

## Technical Invariants Checklist

- [x] **`src/core/**` purity**: All core data, prey types, and combat math added to `core` remain free of `three`, `react`, `zustand`, `Math.random()`, or `Date.now()`.
- [x] **No `setState` in `useFrame`**: Per-frame transformations in Flight Lab mutate `Object3D` instances directly.
- [x] **Skinned mesh safety**: Wyvern model cloning uses `SkeletonUtils.clone()`.
- [x] **Text rendering**: In-world labels use `WorldLabel.tsx` (canvas texture sprite) to avoid WebKit WebGL context crashes.
