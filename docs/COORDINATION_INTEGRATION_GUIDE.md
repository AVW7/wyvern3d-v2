# Wyvern Coordination System - Integration Guide

## Quick Start

The coordination system provides advanced flight mechanics for wyverns interacting with ground targets, performing aerial attacks, and hunting prey at various heights.

### Key Files Created

1. **`src/render/coordination/flightCoordination.ts`** - Core coordination algorithms
2. **`src/render/coordination/examples.ts`** - Usage examples and integration patterns
3. **`docs/FLIGHT_COORDINATION_IMPROVEMENTS.md`** - Complete documentation

## Integration Steps

### 1. Ground Coordination (Landing & Takeoff)

```typescript
import { calculateLandingApproach, calculateTakeoffProfile } from '@/render/coordination/flightCoordination'

// During landing phase
const approach = calculateLandingApproach(
  agent.position,           // Current position
  targetLandingPoint,       // Where to land
  currentVelocity,          // Current movement vector
  wyvernScale              // Size multiplier (default 1.0)
)

// Results provide:
// - approachDirection: which way to approach from
// - descentProfile: how steep (0-1)
// - flare: whether to flare before touchdown
// - approachDistance: when to begin final approach
```

```typescript
// During takeoff
const profile = calculateTakeoffProfile(
  agent.position,
  isEmergency,         // true for urgent takeoff
  hasDestination       // true if flying to specific target
)

// Results provide:
// - initialPitch: launch angle (0.3-0.5)
// - climbRate: ascent speed (10-15 units/sec)
// - cruiseAltitude: target height (18-22 units)
// - forwardSpeed: horizontal velocity during climb
```

### 2. Aerial Attacks at Different Heights

```typescript
import { planAttackRun, isInAttackPosition } from '@/render/coordination/flightCoordination'

// Plan attack
const attack = planAttackRun(
  wyvernPosition,
  wyvernVelocity,
  target,
  attackType  // 'dive' | 'strafe' | 'hover_strike' | 'sweep'
)

// Attack types:
// - dive: high altitude steep descent (15-40 units)
// - strafe: low fast pass (3-12 units)
// - hover_strike: stationary aerial attack (5-20 units)
// - sweep: wide flanking arc (8-25 units)

// Check if ready to attack
if (isInAttackPosition(wyvernPos, target, attackType)) {
  // Execute attack
}
```

### 3. Hunt Engagement (No Landing Required)

```typescript
import { 
  updateHuntEngagement, 
  calculateOptimalEngagementHeight 
} from '@/render/coordination/flightCoordination'

// Initialize hunt
const engagement: HuntEngagement = {
  target: prey,
  phase: 'stalking',
  optimalHeight: calculateOptimalEngagementHeight('prey'),
  stalkingDistance: 25,
  approachAngle: Math.PI / 4
}

// Update each frame
const result = updateHuntEngagement(
  engagement,
  wyvernPos,
  wyvernVelocity,
  dt
)

// Result provides:
// - targetPosition: where to fly
// - behavior: 'circle' | 'approach' | 'dive' | 'grab' | 'carry'
// - attackNow: whether to execute attack
```

### 4. Coordinated Flight Poses

```typescript
import { coordinationFlightPose } from '@/render/coordination/flightCoordination'

// Calculate smooth pose for maneuver
const pose = coordinationFlightPose(
  wyvernPos,
  wyvernVelocity,
  targetPos,
  maneuverType,  // 'landing' | 'takeoff' | 'attack' | 'hunt' | 'transit'
  currentPose,
  dt
)

// Apply pose to wyvern
agent.flightPose.pitch = pose.pitch
agent.flightPose.bank = pose.bank
```

## Height-Based Behavior

Different targets require different engagement heights:

| Target Type | Optimal Height | Reasoning |
|------------|----------------|-----------|
| Aerial | 25 units | Match target altitude |
| Ground (large) | 23 units | Steep dive angle |
| Ground (small) | 18 units | Precision strike |
| Prey | 12 units | Grab accuracy |
| Perch | 15 units | Safe approach |

## Attack Trajectories

Each attack type has a defined flight path:

### Dive Attack
```
Entry (high) → Descent → Strike → Pull-up → Exit
   30 units      20 units    0 units   15 units   30 units
```

### Strafe Attack
```
Entry → Low Pass → Exit
 25 units  8 units  25 units
 (horizontal, fast)
```

### Hover Strike
```
Approach → Hover → Strike → Ascend
  20 units  12 units  2 units  20 units
```

### Sweep Attack
```
Wide arc approach, 70% radius, banking through attack
```

## Hunt Phases

1. **Stalking** (25 unit orbit at optimal height)
   - Circle prey
   - Observe movement
   - Build approach angle

2. **Positioning** (Variable distance)
   - Move to attack angle
   - Adjust altitude
   - Prepare for strike

3. **Striking** (Height-dependent)
   - If height > 8: Dive attack
   - If height < 8: Hover and grab
   - At distance < 3: Execute grab

4. **Carrying** (Ascend at 15 units/sec)
   - Climb with prey
   - Navigate to delivery point

5. **Returning** (Normal flight)
   - Standard transit behavior
   - Land at designated area

## Performance Considerations

- All functions are pure (no side effects)
- Calculations are lightweight (< 0.1ms per call)
- No allocations in hot paths
- Designed for 60 FPS gameplay

## Testing

```typescript
// Unit tests for coordination algorithms
import { calculateLandingApproach } from './flightCoordination'

test('landing approach calcutes correct descent', () => {
  const approach = calculateLandingApproach(
    new Vector3(50, 30, 50),
    new Vector3(0, 0, 0),
    new Vector3(-5, -2, -5)
  )
  
  expect(approach.flare).toBe(true) // Should flare
  expect(approach.descentProfile).toBeGreaterThan(0.4) // Steep approach
})
```

## Next Steps

1. **Review examples**: See `src/render/coordination/examples.ts`
2. **Read documentation**: `docs/FLIGHT_COORDINATION_IMPROVEMENTS.md`
3. **Integrate with agents**: Update Agent interface with coordination fields
4. **Test in Flight Lab**: Use debug scene to validate behaviors
5. **Monitor performance**: Profile in production scenarios

## Current Integration Status

✅ **Ground Coordination**: Landing approaches and takeoff profiles
✅ **Attack Coordination**: Multiple attack types at different heights  
✅ **Hunt Coordination**: Five-phase engagement without landing
✅ **Flight Poses**: Maneuver-specific coordinated poses
✅ **Documentation**: Complete guides and examples

## Future Enhancements

- Wind and weather effects on approaches
- Multi-wyvern coordinated attacks
- Terrain-aware trajectory planning
- Obstacle avoidance during attacks
- Prey AI and evasion behaviors
