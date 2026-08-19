import { describe, expect, it } from 'vitest'
import {
  angleDelta,
  dampFlightPose,
  dampHeadNeckPose,
  dampLegTuck,
  dynamicBodyUndulation,
  flightAnimationState,
  flightPoseTargets,
  headNeckTargets,
  legTuckTarget,
  speedPitchTrim,
  type FlightLoopState,
  type FlightMotion,
} from './flightPose'

describe('flight pose', () => {
  it('pitches into climbs and dives', () => {
    expect(flightPoseTargets(8, 18, 0).pitch).toBeLessThan(0)
    expect(flightPoseTargets(-8, 18, 0).pitch).toBeGreaterThan(0)
  })

  it('straightens the neck when flying fast and compensates head pitch', () => {
    // Fast flight (32 u/s): neck pitch is negative (straightening forward into spearhead line)
    const fastHeadNeck = headNeckTargets(32, 0, 0, -0.1, 0, 18)
    expect(fastHeadNeck.neckPitch).toBeLessThan(0)

    const turnHeadNeck = headNeckTargets(18, 0, 0.5, 0, -0.2, 18)
    expect(turnHeadNeck.headRoll).toBeGreaterThan(0) // Counter-roll compensating bank

    const damped = dampHeadNeckPose(
      { neckPitch: 0, neckYaw: 0, headPitch: 0, headYaw: 0, headRoll: 0 },
      fastHeadNeck,
      1 / 60,
    )
    expect(damped.neckPitch).toBeLessThan(0)
  })

  /**
   * `flightPoseTargets` banks right on a positive `yawRate` (asserted below in
   * "banks into turns"), and a positive yaw offset turns the head toward the
   * rig's right — probed on the rig, 0.055 rad moves the head −0.13 in x, and
   * +x is the rig's left. So an inside-the-turn head is *same-signed* with the
   * yaw rate. It used to be negated, which put the head on the outside.
   */
  it('leads the turn with the head on the inside', () => {
    const right = headNeckTargets(18, 0, 0.5, 0, -0.2, 18)
    expect(right.headYaw).toBeGreaterThan(0)
    expect(right.neckYaw).toBeGreaterThan(0)

    const left = headNeckTargets(18, 0, -0.5, 0, 0.2, 18)
    expect(left.headYaw).toBeLessThan(0)
    expect(left.neckYaw).toBeLessThan(0)

    // The neck carries the larger share, matching NECK_LEAN_WEIGHTS in the
    // authoring script: runtime lean and authored bank lean are one gesture.
    expect(right.neckYaw).toBeGreaterThan(right.headYaw)

    // Straight flight does not lean.
    const straight = headNeckTargets(18, 0, 0, 0, 0, 18)
    expect(straight.headYaw).toBe(0)
    expect(straight.neckYaw).toBe(0)
  })

  /**
   * The pose contract gives the horizon hold to hover alone; every forward mode
   * reaches along the direction of travel, and speed and dive reach down the
   * stoop line. Both `bodyPitch` and the head offsets are positive nose-down.
   */
  it('follows the flight path in forward flight and holds the horizon near hover', () => {
    // Cruise speed, descending hard, body saturated nose-down: the snout leads
    // down the dive line rather than craning up to the horizon.
    const stooping = headNeckTargets(18, -10, 0, 0.35, 0, 18)
    expect(stooping.headPitch).toBeGreaterThan(0)

    // Climbing at cruise speed puts it the other way.
    const climbing = headNeckTargets(18, 10, 0, -0.35, 0, 18)
    expect(climbing.headPitch).toBeLessThan(stooping.headPitch)

    // Near a standstill the neck counter-pitches against the body instead.
    const hovering = headNeckTargets(1.5, 0, 0, 0.2, 0, 18)
    expect(hovering.headPitch).toBeLessThan(0)
    expect(hovering.neckPitch).toBeLessThan(0)

    // The hand-over itself is how much the head answers the *body's* pitch, so
    // measure that slope directly rather than reading `headPitch` across
    // speeds: the flight path shallows as airspeed rises for a fixed sink rate,
    // which moves the number for a reason that has nothing to do with the band.
    const horizonHold = (speed: number) =>
      headNeckTargets(speed, 0, 0, 0.4, 0, 18).headPitch -
      headNeckTargets(speed, 0, 0, 0, 0, 18).headPitch

    expect(horizonHold(1)).toBeLessThan(-0.2) // full cancel at a standstill
    expect(horizonHold(18)).toBeCloseTo(0, 6) // none at cruise

    const band = [2, 3.5, 5, 6.5, 8].map(horizonHold)
    for (let i = 1; i < band.length; i += 1) {
      expect(band[i]!).toBeGreaterThan(band[i - 1]!)
    }
  })

  it('adjusts body pitch level at different speeds (slow vs medium vs fast)', () => {
    // Slow flight (< 0.65x ref): Nose-up pitch (+AoA lift trim)
    const slowPose = flightPoseTargets(0, 6, 0)
    expect(slowPose.pitch).toBeGreaterThan(0)

    // Medium cruise flight (~1.0x ref): Neutral trim
    const mediumPose = flightPoseTargets(0, 18, 0)
    expect(Math.abs(mediumPose.pitch)).toBeLessThan(0.04)

    // Fast flight (> 1.1x ref): Nose-down forward pitch (-AoA aerodynamic sprint)
    const fastPose = flightPoseTargets(0, 32, 0)
    expect(fastPose.pitch).toBeLessThan(-0.05)

    expect(speedPitchTrim(6, 18)).toBeGreaterThan(0)
    expect(speedPitchTrim(32, 18)).toBeLessThan(0)
  })

  it('adds dynamic biomechanical undulation when time is passed', () => {
    const staticPose = flightPoseTargets(0, 18, 0, 0)
    const dynamicPose = flightPoseTargets(0, 18, 0, 0.25)
    expect(dynamicPose.pitch).not.toBe(staticPose.pitch)

    const undulation = dynamicBodyUndulation(18, 0.25)
    expect(undulation.pitch).not.toBe(0)
  })

  it('banks into turns and clamps abrupt direction changes', () => {
    expect(flightPoseTargets(0, 18, 0.5).bank).toBeLessThan(0)
    expect(flightPoseTargets(0, 18, -0.5).bank).toBeGreaterThan(0)
    expect(Math.abs(flightPoseTargets(0, 18, 20).bank)).toBeLessThanOrEqual(0.58)
  })

  it('does not bank a nearly stationary model', () => {
    expect(flightPoseTargets(0, 0.1, 20).bank).toBe(0)
  })

  it('wraps yaw across the negative-pi boundary', () => {
    expect(angleDelta(-Math.PI + 0.1, Math.PI - 0.1)).toBeCloseTo(0.2)
  })

  it('smooths toward the target without overshooting', () => {
    const pose = dampFlightPose(
      { pitch: 0, bank: 0 },
      { pitch: -0.3, bank: 0.5 },
      1 / 60,
    )
    expect(pose.pitch).toBeLessThan(0)
    expect(pose.pitch).toBeGreaterThan(-0.3)
    expect(pose.bank).toBeGreaterThan(0)
    expect(pose.bank).toBeLessThan(0.5)
  })

  it('enters bank loops only after the turn threshold', () => {
    expect(flightAnimationState('cruise', 0.13)).toBe('cruise')
    expect(flightAnimationState('cruise', 0.14)).toBe('bankLeft')
    expect(flightAnimationState('cruise', -0.14)).toBe('bankRight')
  })

  it('uses hysteresis when returning to straight flight', () => {
    expect(flightAnimationState('bankLeft', 0.08)).toBe('bankLeft')
    expect(flightAnimationState('bankLeft', 0.06)).toBe('cruise')
    expect(flightAnimationState('bankRight', -0.08)).toBe('bankRight')
    expect(flightAnimationState('bankRight', -0.06)).toBe('cruise')
  })

  it('switches directly when the turn reverses', () => {
    expect(flightAnimationState('bankLeft', -0.14)).toBe('bankRight')
    expect(flightAnimationState('bankRight', 0.14)).toBe('bankLeft')
  })
})

describe('leg tuck', () => {
  const REF = 18

  it('is zero at the reference speed, so the authored carriage shows through', () => {
    expect(legTuckTarget(REF, REF)).toBeCloseTo(0, 6)
  })

  it('lets the legs down toward the hover carriage at a standstill', () => {
    expect(legTuckTarget(0, REF)).toBeLessThan(0)
  })

  it('draws them tighter as speed builds past cruise', () => {
    expect(legTuckTarget(REF * 1.3, REF)).toBeGreaterThan(0)
    expect(legTuckTarget(REF * 2, REF)).toBeGreaterThan(legTuckTarget(REF * 1.3, REF))
  })

  it('is monotonic in airspeed', () => {
    let previous = -Infinity
    for (let speed = 0; speed <= REF * 3; speed += REF / 8) {
      const value = legTuckTarget(speed, REF)
      expect(value).toBeGreaterThanOrEqual(previous)
      previous = value
    }
  })

  it('stays inside bounds that cannot overpower the mode it decorates', () => {
    for (const speed of [-50, 0, 1, REF, REF * 10, 1e6]) {
      const value = legTuckTarget(speed, REF)
      expect(value).toBeGreaterThanOrEqual(-0.40)
      expect(value).toBeLessThanOrEqual(0.45)
    }
  })

  it('survives a zero reference speed rather than returning NaN', () => {
    expect(Number.isFinite(legTuckTarget(12, 0))).toBe(true)
  })

  it('converges on its target under damping', () => {
    const target = legTuckTarget(REF * 2, REF)
    let current = 0
    for (let i = 0; i < 200; i += 1) current = dampLegTuck(current, target, 1 / 60)
    expect(current).toBeCloseTo(target, 4)
  })
})

describe('dive selection', () => {
  /**
   * The load-bearing assertion behind DIVE_ENTER_ANGLE. The dive clip exists
   * because procedural pitch runs out, so the mode has to begin exactly where
   * the clamp bites — not at a number that merely looks steep.
   */
  it('begins where procedural pitch saturates, and not before', () => {
    expect(flightPoseTargets(-8, 18, 0).pitch).toBeCloseTo(0.38, 5)
    expect(flightPoseTargets(-7, 18, 0).pitch).toBeLessThan(0.38)

    expect(
      flightAnimationState('cruise', 0, { horizontalSpeed: 18, verticalSpeed: -8 }),
    ).toBe('dive')
    expect(
      flightAnimationState('cruise', 0, { horizontalSpeed: 18, verticalSpeed: -7 }),
    ).toBe('cruise')
  })

  it('holds the dive through a shallower angle than it entered on', () => {
    expect(
      flightAnimationState('dive', 0, { horizontalSpeed: 18, verticalSpeed: -5 }),
    ).toBe('dive')
    expect(
      flightAnimationState('dive', 0, { horizontalSpeed: 18, verticalSpeed: -4.5 }),
    ).toBe('cruise')
  })

  /**
   * A sanctuary landing descends steeply but with no forward speed, so it
   * clears the angle test on its own and only the speed floor stops it.
   *
   * That floor covers a landing from transit altitude and nothing beyond it.
   * `smooth01`'s maximum derivative is 1.5, so a 4.67 s descent peaks at
   * 1.5 * y / 4.67 — which is 7.07 units/s from TRANSIT_ALTITUDE 22, under the
   * floor, but 12.85 from the 40-unit soaring altitude, over it. The second
   * case is caught only by `isCruisePhase` excluding the landing phase, so that
   * predicate is load-bearing rather than incidental. Both are asserted here so
   * that widening it fails loudly.
   */
  it('does not read a slow steep sink as a stoop, up to the speed floor', () => {
    expect(
      flightAnimationState('cruise', 0, { horizontalSpeed: 0, verticalSpeed: -7.07 }),
    ).toBe('hover')
    // Above the floor the angle wins, which is why the phase gate exists.
    expect(
      flightAnimationState('cruise', 0, { horizontalSpeed: 0, verticalSpeed: -12.85 }),
    ).toBe('dive')
  })

  it('never dives on a climb', () => {
    expect(
      flightAnimationState('cruise', 0, { horizontalSpeed: 18, verticalSpeed: 20 }),
    ).not.toBe('dive')
  })

  it('outranks bank and hover', () => {
    expect(
      flightAnimationState('cruise', 0.5, { horizontalSpeed: 18, verticalSpeed: -20 }),
    ).toBe('dive')
    expect(
      flightAnimationState('cruise', 0, { horizontalSpeed: 2, verticalSpeed: -20 }),
    ).toBe('dive')
  })

  it('is unreachable for a caller that does not measure vertical speed', () => {
    expect(flightAnimationState('cruise', 0, { horizontalSpeed: 18 })).toBe('cruise')
  })
})

describe('climb selection', () => {
  it('enters on steep ascending flight path with sufficient speed', () => {
    // 18 hspeed, +8 vspeed -> climb angle is atan2(8, 18) = 0.418 rad > 0.35
    expect(
      flightAnimationState('cruise', 0, { horizontalSpeed: 18, verticalSpeed: 8 }),
    ).toBe('climb')
    // Slower climb angle below 0.35 stays in cruise
    expect(
      flightAnimationState('cruise', 0, { horizontalSpeed: 18, verticalSpeed: 4 }),
    ).toBe('cruise')
  })

  it('holds climb through a shallower angle than it entered on (hysteresis)', () => {
    // Already in climb: exit angle is 0.22 rad. atan2(5, 18) = 0.27 rad > 0.22 -> holds climb
    expect(
      flightAnimationState('climb', 0, { horizontalSpeed: 18, verticalSpeed: 5 }),
    ).toBe('climb')
    // When climb angle drops below exit angle: atan2(3, 18) = 0.165 rad < 0.22 -> exits climb
    expect(
      flightAnimationState('climb', 0, { horizontalSpeed: 18, verticalSpeed: 3 }),
    ).toBe('cruise')
  })

  it('outranks bank and speed during climb', () => {
    expect(
      flightAnimationState('cruise', 0.5, { horizontalSpeed: 18, verticalSpeed: 10 }),
    ).toBe('climb')
    expect(
      flightAnimationState('cruise', 0, { horizontalSpeed: 25, verticalSpeed: 15, referenceSpeed: 18 }),
    ).toBe('climb')
  })

  it('does not climb when descending or at level flight', () => {
    expect(
      flightAnimationState('cruise', 0, { horizontalSpeed: 18, verticalSpeed: 0 }),
    ).toBe('cruise')
    expect(
      flightAnimationState('cruise', 0, { horizontalSpeed: 18, verticalSpeed: -5 }),
    ).not.toBe('climb')
  })
})

describe('hover selection', () => {
  it('enters and leaves on measured speed', () => {
    expect(flightAnimationState('cruise', 0, { horizontalSpeed: 1.9 })).toBe('hover')
    expect(flightAnimationState('cruise', 0, { horizontalSpeed: 2.0 })).toBe('cruise')
    expect(flightAnimationState('hover', 0, { horizontalSpeed: 4.0 })).toBe('hover')
    expect(flightAnimationState('hover', 0, { horizontalSpeed: 4.1 })).toBe('cruise')
  })

  it('outranks bank, and hands back to bank on exit', () => {
    expect(flightAnimationState('cruise', 0.5, { horizontalSpeed: 1.0 })).toBe('hover')
    expect(flightAnimationState('hover', 0.2, { horizontalSpeed: 4.1 })).toBe('bankLeft')
    // Leaving hover is not leaving a bank, so it uses the enter threshold.
    expect(flightAnimationState('hover', 0.1, { horizontalSpeed: 4.1 })).toBe('cruise')
  })

  it('is unreachable for a caller that does not measure horizontal speed', () => {
    expect(flightAnimationState('cruise', 0, {})).toBe('cruise')
    expect(flightAnimationState('cruise', 0, { verticalSpeed: -30 })).toBe('cruise')
  })
})

describe('speed selection', () => {
  it('needs a reference to compare against', () => {
    expect(flightAnimationState('cruise', 0, { horizontalSpeed: 28 })).toBe('cruise')
    expect(
      flightAnimationState('cruise', 0, { horizontalSpeed: 28, referenceSpeed: 18 }),
    ).toBe('speed')
    expect(
      flightAnimationState('cruise', 0, { horizontalSpeed: 18, referenceSpeed: 18 }),
    ).toBe('cruise')
  })

  it('holds down to a lower ratio than it entered on', () => {
    expect(
      flightAnimationState('speed', 0, { horizontalSpeed: 19, referenceSpeed: 18 }),
    ).toBe('speed')
    expect(
      flightAnimationState('speed', 0, { horizontalSpeed: 18.5, referenceSpeed: 18 }),
    ).toBe('cruise')
  })

  /**
   * Battle AI is clamped to `actor.speed` by `steer`, so it can never reach the
   * unboosted ratio from motion alone. An AI sprint has to come from intent.
   */
  it('lowers the bar when the caller says it is trying to go fast', () => {
    const closing = { horizontalSpeed: 24, referenceSpeed: 26 }
    expect(flightAnimationState('cruise', 0, closing)).toBe('cruise')
    expect(flightAnimationState('cruise', 0, { ...closing, boosting: true })).toBe('speed')
  })

  it('yields to bank, and is picked up again when the bank relaxes', () => {
    const fast = { horizontalSpeed: 28, referenceSpeed: 18 }
    expect(flightAnimationState('cruise', 0.2, fast)).toBe('bankLeft')
    expect(flightAnimationState('bankLeft', 0.05, fast)).toBe('speed')
  })
})

describe('scout selection', () => {
  it('uses the slow search loop when loitering', () => {
    expect(flightAnimationState('cruise', 0, { searching: true })).toBe('scout')
    expect(flightAnimationState('scout', 0, { searching: true })).toBe('scout')
  })

  it('yields to a visible turn and to a boost', () => {
    expect(flightAnimationState('cruise', 0.2, { searching: true })).toBe('bankLeft')
    expect(
      flightAnimationState('cruise', 0, {
        searching: true,
        boosting: true,
        horizontalSpeed: 24,
        referenceSpeed: 26,
      }),
    ).toBe('speed')
  })
})

describe('glide selection', () => {
  it('is an intent, and outranks hover', () => {
    expect(flightAnimationState('cruise', 0, { powered: false })).toBe('glide')
    // The sanctuary's soaring orbit dips under the hover threshold mid-figure.
    // A wyvern that has stopped beating its wings must not snap into the most
    // powered clip in the family.
    expect(
      flightAnimationState('cruise', 0, { powered: false, horizontalSpeed: 1.2 }),
    ).toBe('glide')
  })

  it('yields to a dive but outranks bank', () => {
    expect(
      flightAnimationState('cruise', 0, {
        powered: false,
        horizontalSpeed: 18,
        verticalSpeed: -12,
      }),
    ).toBe('dive')
    expect(flightAnimationState('cruise', 0.5, { powered: false })).toBe('glide')
  })

  it('is unreachable unless the caller says so', () => {
    expect(flightAnimationState('cruise', 0, { powered: true })).toBe('cruise')
    expect(flightAnimationState('cruise', 0, {})).toBe('cruise')
  })
})

describe('selector invariants', () => {
  const STATES: FlightLoopState[] = [
    'cruise',
    'speed',
    'glide',
    'dive',
    'bankLeft',
    'bankRight',
    'hover',
  ]

  /**
   * Chatter is a two-cycle under a constant input. If every state reachable in
   * one step is a fixed point of that same input, no two-cycle can exist — so
   * this keeps holding as modes are added, unlike a table of hand-picked cases.
   */
  it('never chatters: one step from any state is a fixed point', () => {
    let seed = 1
    const next = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)

    for (let i = 0; i < 3000; i += 1) {
      const motion: FlightMotion = {
        horizontalSpeed: next() < 0.15 ? undefined : next() * 45,
        verticalSpeed: next() < 0.15 ? undefined : (next() - 0.5) * 60,
        referenceSpeed: next() < 0.15 ? undefined : 14 + next() * 20,
        powered: next() < 0.3 ? next() < 0.5 : undefined,
        boosting: next() < 0.5,
      }
      const bank = (next() - 0.5) * 1.2
      for (const start of STATES) {
        const once = flightAnimationState(start, bank, motion)
        expect(flightAnimationState(once, bank, motion)).toBe(once)
      }
    }
  })

  /**
   * The compatibility contract from the docstring, asserted rather than
   * promised: a caller that measures nothing gets exactly the cruise/bank
   * behaviour this selector had before the other modes existed.
   */
  it('gives a caller that measures nothing only cruise and banks', () => {
    const legacy = new Set<FlightLoopState>(['cruise', 'bankLeft', 'bankRight'])
    for (const start of STATES) {
      for (let bank = -0.6; bank <= 0.6; bank += 0.02) {
        const bare = flightAnimationState(start, bank)
        expect(bare).toBe(flightAnimationState(start, bank, {}))
        expect(legacy.has(bare)).toBe(true)
      }
    }
  })
})
