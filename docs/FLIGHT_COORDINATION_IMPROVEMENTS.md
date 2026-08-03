# Wyvern Flight Coordination Improvements

## Overview
This document describes the comprehensive improvements made to wyvern coordination with ground targets, takeoff/landing mechanics, attack sequences, and hunting behavior at different heights.

## Implementation Details

### 1. Ground Coordination (`src/render/coordination/flightCoordination.ts`)

Created a new comprehensive coordination module that manages:

#### Landing Approach System
- **Calculated Glide Angles**: Approach angles adjust based on altitude and horizontal distance
- **Descent Profiles**: Steeper for short approaches (0.7), shallower for long glides (0.25)
- **Flare Mechanics**: Automatic flare when below 5 units altitude for smooth touchdowns
- **Approach Distances**: Final approach begins at 2.5x the altitude

```typescript
function calculateLandingApproach(
  currentPos: Vector3,
  targetLanding: Vector3,
  currentVelocity: Vector3,
  wyvernScale: number = 1.0
): LandingApproach
```

#### Takeoff Profiles
- **Adaptive Pitch**: Steeper initial pitch (0.5) for immediate threats, normal (0.3) otherwise
- **Variable Climb Rates**: 15 units/sec for urgent takeoffs, 10 units/sec for normal
- **Destination-Aware Altitudes**: Cruise to 18 units with a destination, 22 units without
- **Forward Speed Integration**: 12 units/sec with destination, 8 units/sec for free flight

```typescript
function calculateTakeoffProfile(
  currentPos: Vector3,
  immediate: boolean = false,
  hasDestination: boolean = false
): TakeoffProfile
```

### 2. Attack Coordination

Implemented multiple attack run types for different engagement scenarios:

#### Attack Types
- **Dive**: High-altitude steep descent attack
  - Entry point 20+ units behind target
  - Descent from 20 units above target
  - 1.4x speed multiplier
  - Pull-up after strike
  
- **Strafe**: Low, fast horizontal pass
  - Maintains 3-12 unit altitude
  - 1.6x speed multiplier
  - Straight line trajectory
  
- **Hover Strike**: Stationary aerial attack
  - Directly above or close approach
  - Normal speed (precision over power)
  
- **Sweep**: Wide arc approach
  - 0.7x radius arc
  - 1.2x speed multiplier
  - Flanking trajectory

#### Height-Aware Targeting
```typescript
function planAttackRun(
  wyvernPos: Vector3,
  wyvernVelocity: Vector3,
  target: CoordinationTarget,
  attackType: AttackRun['type'] = 'dive'
): AttackRun
```

Attack heights vary by target type:
- **Aerial targets**: Match target altitude (25 units)
- **Ground targets**: 18 + targetSize * 5 units
- **Prey**: 12 units for precision grab
- **Perches**: 15 units approach altitude

### 3. Hunt Coordination

Sophisticated hunting behavior with multi-phase engagement:

#### Hunt Phases
1. **Stalking**: Circle at stalkingDistance, maintain optimalHeight
2. **Positioning**: Move to approachAngle for strike
3. **Striking**: Dive or grab based on height differential
4. **Carrying**: Ascend with captured prey (15 units/sec climb)
5. **Returning**: Navigate to delivery point

```typescript
function updateHuntEngagement(
  engagement: HuntEngagement,
  wyvernPos: Vector3,
  wyvernVelocity: Vector3,
  dt: number
): HuntBehaviorResult
```

#### Dynamic Behavior Selection
- **Height > 8 units**: Dive attack (steep descent)
- **Height < 8 units**: Hover and grab (precision)
- **Distance < 3 units**: Execute grab action
- **Distance < 15 units**: Begin attack sequence

### 4. Flight Pose Coordination

Coordinated flight poses for different maneuvers:

#### Maneuver-Specific Poses
```typescript
function coordinationFlightPose(
  wyvernPos: Vector3,
  wyvernVelocity: Vector3,
  targetPos: Vector3,
  maneuverType: 'landing' | 'takeoff' | 'attack' | 'hunt' | 'transit',
  currentPose: FlightPose,
  dt: number
): FlightPose
```

- **Landing**: Pitch up to flare (up to 0.35), alignment bank
- **Takeoff**: Strong pitch up (0.4 initial, 0.15 during climb)
- **Attack**: Aggressive nose-down (up to -0.6), bank into turns (±0.7)
- **Hunt**: Upright stalking pose (0.1 pitch), subtle banking (±0.3)
- **Transit**: Neutral cruise attitude (±0.2)

### 5. Agent Integration

Updated the Agent interface to support coordination:

```typescript
interface Agent {
  // ... existing fields ...
  attackRun: AttackRun | null           // Active attack configuration
  huntEngagement: HuntEngagement | null // Hunt state tracking
}
```

## Benefits

### Improved Ground Coordination
- Smoother, more realistic landing animations
- Context-aware approach angles
- Automatic flare before touchdown
- Better alignment with landing targets

### Enhanced Aerial Combat
- Multiple attack styles for different situations
- Height-aware engagement strategies
- Dynamic trajectory planning
- Proper entry and exit vectors

### Sophisticated Hunting
- Five-phase engagement (stalk → position → strike → carry → return)
- Height-based attack selection
- Prey tracking without landing
- Multiple engagement heights (7-25 units)

### Realistic Flight Behavior
- Maneuver-specific flight poses
- Smooth transitions between poses
- Coordinated pitch and bank
- Context-aware flight dynamics

## Integration Points

The coordination system integrates with:
- **SanctuaryWyverns**: Main wyvern scene component
- **Battle AI**: Combat target selection and engagement
- **Highlands Hunt**: Prey tracking and hunting
- **Direct Flight**: Player-controlled wyvern coordination

## Future Enhancements

1. **Wind Effects**: Factor wind into approach calculations
2. **Obstacle Avoidance**: Dynamic trajectory adjustment
3. **Prey AI**: Coordinated simultaneous attacks
4. **Terrain Awareness**: Ground topology for attack approaches
5. **Formation Flying**: Multi-wyvern coordination

## Testing

The coordination system is designed to be testable:
- Pure functions for calculations
- Explicit state management
- No side effects in computation
- Clear input/output contracts

Run tests with:
```bash
pnpm test
```

Type checking:
```bash
pnpm typecheck
```

Build verification:
```bash
pnpm build
```
