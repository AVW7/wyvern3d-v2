import { clamp, damp } from '@/core/math/vec'

const MAX_PITCH = 0.38
const MAX_BANK = 0.58
const BANK_FROM_YAW_RATE = 0.65
const MIN_PITCH_SPEED = 10

const BANK_ANIMATION_ENTER = 0.14
const BANK_ANIMATION_EXIT = 0.07

const HOVER_ENTER_SPEED = 2.0
const HOVER_EXIT_SPEED = 4.0

/**
 * Where a descent stops being an attitude and becomes a mode.
 *
 * Procedural pitch is clamped at MAX_PITCH, so past a flight-path angle of 0.38
 * the runtime is saturated: the body physically cannot lean any further and the
 * authored nose-down clip is the only thing left that can carry the read. The
 * enter threshold therefore sits *at* saturation rather than near it, and the
 * exit at 0.26 is comfortably back inside the procedural range, so leaving the
 * dive hands the remaining descent to a pitch that can still express it.
 */
const DIVE_ENTER_ANGLE = 0.4
const DIVE_EXIT_ANGLE = 0.26

/**
 * A dive is fast. This floor exists so a slow sink can never read as a stoop:
 * the sanctuary's landing arc peaks at 7.07 units/s of pure descent (smooth01's
 * maximum derivative is 1.5, over 22 units in 4.67 s), which clears the angle
 * test on its own. `isCruisePhase` excluding `landing` is the primary defence;
 * this is the second one.
 */
const DIVE_ENTER_SPEED = 9
const DIVE_EXIT_SPEED = 7

/**
 * Speed is measured as a ratio, because the two scenes are not in the same
 * units: the sanctuary cruises at 18 and sprints at 28, while a battle actor's
 * own speed is `14 + stats.speed * 0.4`.
 *
 * 1.20 sits between the sanctuary's fastest cruise (transit, 18/18 = 1.00) and
 * its slowest sprint (the run key held with no throttle, 0.8 * 28 = 22.4, i.e.
 * 1.24). Battle AI is clamped to `actor.speed` by `steer`, so it can never
 * reach 1.20 from motion alone — an AI sprint has to come from `boosting`,
 * which is why the boosted bar is below 1.
 */
const SPEED_ENTER_RATIO = 1.2
const SPEED_EXIT_RATIO = 1.05

/**
 * Bounds on the airspeed-driven leg tuck offset, in radians of limb flexion.
 *
 * Sized against the authored carriage rather than picked: the clips span a tuck
 * of -0.7 (hover, `foot_drop` 4.15) to 1.6 (dive, 2.20), and a radian of tuck
 * moves the foot about 1.3 units. So -0.35 at a standstill and +0.30 at a
 * sustained sprint are each worth roughly 0.4 units of `foot_drop` — enough to
 * see the legs answer the throttle, not enough to turn a cruise into a stoop.
 */
/**
 * Bounds on the airspeed-driven leg tuck offset, in radians of limb flexion.
 *
 * Enhanced for AAA-quality flight (Meleys-style):
 * At hover/still: legs hang down alert, ready for landing or grabbing prey
 * At cruise: legs tucked slightly for reduced drag
 * At sprint/dive: legs fully tucked against body for aerodynamic streamlining
 *
 * One radian of tuck moves the foot about 1.3 units, so:
 * - -0.40 at hover = ~0.5 units leg drop (ready for ground/prey)
 * - +0.45 at sprint = ~0.6 units tighter tuck (aerodynamic)
 */
const LEG_TUCK_RELEASE = -0.40
const LEG_TUCK_MAX = 0.45
const BOOST_ENTER_RATIO = 0.80
const BOOST_EXIT_RATIO = 0.65

export type FlightLoopState =
  | 'cruise'
  | 'scout'
  | 'speed'
  | 'glide'
  | 'dive'
  | 'bankLeft'
  | 'bankRight'
  | 'hover'

export interface FlightPose {
  pitch: number
  bank: number
}

/**
 * What a caller measured this frame.
 *
 * Every field is optional and every mode is gated on the fields it needs, so a
 * caller that does not measure a channel cannot be handed a mode that channel
 * decides: no `horizontalSpeed` means hover and speed are unreachable, no
 * `verticalSpeed` means dive is, no `referenceSpeed` means speed is, and no
 * `powered` means glide is. Passing nothing at all is exactly the cruise/bank
 * behaviour this selector had before the other modes existed.
 *
 * `powered` and `boosting` are *intents*, not measurements, and must be
 * edge-stable — a key, a director phase, a latched AI state. A per-frame
 * boolean is the one input that can defeat the hysteresis below.
 */
export interface FlightMotion {
  /** Units per second in the XZ plane. Gates hover and speed. */
  horizontalSpeed?: number
  /** Units per second, signed; negative is descending. Gates dive. */
  verticalSpeed?: number
  /** This actor's own nominal cruise speed, in the same units. Gates speed. */
  referenceSpeed?: number
  /** False means the wings are not beating. Gates glide. */
  powered?: boolean
  /** Trying to go fast — a sprint key, or an AI closing or fleeing. */
  boosting?: boolean
  /** Looking for a target while loitering, rather than travelling somewhere. */
  searching?: boolean
}

/**
 * Returns the shortest signed turn from `previous` to `current`.
 *
 * Using a wrapped delta matters when yaw crosses ±π: the visual should see a
 * small continuing turn, not a full-circle snap in the opposite direction.
 */
export function angleDelta(current: number, previous: number): number {
  const delta = current - previous
  return Math.atan2(Math.sin(delta), Math.cos(delta))
}

/**
 * Signed flight-path angle, positive descending.
 *
 * Shared with `flightPoseTargets` on purpose: "the dive begins where procedural
 * pitch saturates" is then structural rather than two similar formulas that can
 * drift apart.
 */
export function flightPathAngle(
  verticalSpeed: number,
  horizontalSpeed: number,
): number {
  return -Math.atan2(verticalSpeed, Math.max(horizontalSpeed, MIN_PITCH_SPEED))
}

/**
 * Speed-dependent aerodynamic body pitch trim (Angle of Attack).
 *
 * At slow speeds (below cruise), the wyvern pitches slightly nose-up (+AoA)
 * to generate necessary lift at low airspeed.
 * At medium speeds (around nominal cruise), body trim stays nearly neutral.
 * At fast speeds (sprint/boost), the wyvern pitches forward (-AoA) into an
 * aggressive, aerodynamic nose-down posture - matching the Meleys diving/S-curve posture.
 *
 * Enhanced for AAA-quality flight:
 * - More dramatic nose-down at sprint for that aggressive predatory look
 * - Smooth transition curve that feels natural
 * - accounts for body position affecting speed perception
 */
export function speedPitchTrim(horizontalSpeed: number, referenceSpeed: number = 18): number {
  if (horizontalSpeed < 0.5) return 0
  const ratio = horizontalSpeed / Math.max(referenceSpeed, 1)
  if (ratio < 0.65) {
    // Slow speeds (e.g. < 11.7 u/s at ref 18): +0.04 to +0.12 rad nose-up (~2.3° to 6.9°)
    // More lift needed at slow speeds
    const t = clamp((0.65 - ratio) / 0.65, 0, 1)
    return t * 0.12
  } else if (ratio > 1.0) {
    // Fast speeds (sprint): -0.06 to -0.22 rad nose-down (~-3.4° to -12.6°)
    // Aggressive streamline position for maximum speed
    const t = clamp((ratio - 1.0) / 0.8, 0, 1)
    return -t * 0.22
  }
  // Medium cruise speed range (0.65 <= ratio <= 1.0): smooth gradient near neutral
  const t = (ratio - 0.65) / (1.0 - 0.65)
  return 0.04 * (1 - t) - 0.03 * t
}

/**
 * Dynamic biomechanical body undulation (wingbeat heave & air resistance wave).
 */
export function dynamicBodyUndulation(
  horizontalSpeed: number,
  time: number,
): { pitch: number; bank: number } {
  if (time <= 0) return { pitch: 0, bank: 0 }
  if (horizontalSpeed < 0.5) {
    // Subtle hover breathing / heave
    return {
      pitch: Math.sin(time * 2.2) * 0.015,
      bank: Math.cos(time * 1.5) * 0.01,
    }
  }
  const speedNorm = clamp(horizontalSpeed / 30, 0.2, 1.5)
  const freq = 1.4 + speedNorm * 1.6
  const pitchAmp = 0.012 + Math.min(speedNorm * 0.012, 0.02)
  const bankAmp = 0.006 + Math.min(speedNorm * 0.008, 0.012)

  return {
    pitch: Math.sin(time * freq * Math.PI * 2) * pitchAmp,
    bank: Math.cos(time * freq * 0.7 * Math.PI * 2) * bankAmp,
  }
}

/**
 * Head and neck offsets, in radians, about the rig's **own** local axes.
 *
 * These are offsets composed onto whatever the mixer produced, never absolute
 * orientations — see `render/boneOffsets.ts`. Naming them by intent rather than
 * by x/y/z matters here: the axes are not the ones an Euler triple would guess.
 * Measured on every bone in the chain, pitch is local **Z**, yaw is local **Y**
 * and roll is local **X**, so the obvious `rotation.set(pitch, yaw, roll)` puts
 * pitch on the axis the authoring script documents as inert and roll on the
 * sagittal one. Route these through `applyBoneOffset`, which owns the mapping.
 */
export interface HeadNeckPose {
  /** Individual pitch offset per neck bone (Neck, Neck1, Neck2) */
  neckPitch: number
  /** Individual yaw offset per neck bone */
  neckYaw: number
  /** Head bone pitch to align gaze with flight direction */
  headPitch: number
  /** Head bone yaw leading into turns */
  headYaw: number
  /** Head bone roll compensating steep body bank */
  headRoll: number
}

/**
 * Where the horizon hold gives way to following the flight path.
 *
 * `docs/FLIGHT_ANIMATION_DEVELOPMENT.md` gives the two behaviours to different
 * modes. Hover: "neck counter-pitches to keep eyes on the horizon". Every
 * forward mode: "reaches forward along direction of travel", and for speed and
 * dive specifically, "reaches forward / stoop line". They are opposites — one
 * cancels the body's pitch, the other rides it — and the previous version
 * applied the hover rule at every airspeed, so a stooping wyvern craned its head
 * *up* while its body went down.
 *
 * The band is the hover clip's own, so the pose and the clip hand over together:
 * full hold while hover is selectable, gone shortly after `HOVER_EXIT_SPEED`
 * releases it.
 */
const HORIZON_HOLD_FULL_SPEED = HOVER_ENTER_SPEED
const HORIZON_HOLD_ZERO_SPEED = HOVER_EXIT_SPEED * 2

/**
 * How far ahead of the body line the snout leads, as a share of flight-path
 * angle.
 *
 * Zero would already satisfy "reaches forward along direction of travel" — the
 * head is a child of the body, so it inherits the whole attitude for free. This
 * small positive share is the *lead*: in a stoop the snout arrives on the dive
 * line before the torso finishes rotating onto it, which is what makes the head
 * read as aiming the manoeuvre rather than being carried through it.
 */
const FLIGHT_PATH_LEAD = 0.25

/**
 * Calculates aerodynamic head and neck posture targets from airspeed, flight
 * path, and turn rate.
 *
 * The reference silhouette is the long forward flight line the concept art
 * holds: the neck leaves the chest and reaches down the direction of travel,
 * the snout leads the turn, and the eyes stay near level through a bank.
 *
 * Three layers, and the order matters:
 *
 * 1. **Neck straightening** cancels the rest pose's upward S-curve by airspeed,
 *    so the faster it goes the longer and flatter the neck reads.
 * 2. **Gaze pitch** blends between the two contract behaviours above.
 * 3. **Turn lead and roll compensation** put the head on the inside of the turn
 *    while the eyes stay near the horizon.
 */
export function headNeckTargets(
  horizontalSpeed: number,
  verticalSpeed: number,
  yawRate: number,
  bodyPitch: number,
  bodyBank: number,
  referenceSpeed: number = 18,
): HeadNeckPose {
  const speedRatio = horizontalSpeed / Math.max(referenceSpeed, 1)

  // 1. Neck Straightening (Matching Meleys reference: long horizontal neck out of chest)
  // At speed, the neck extends forward aggressively for aerodynamic streamlining
  let neckStraighten = 0
  if (horizontalSpeed < 0.5) {
    // Hover: alert posture, slight upward curve for scanning
    neckStraighten = 0.06
  } else if (speedRatio < 0.4) {
    // Very slow (loitering/scout): transitioning from hover alert to forward
    neckStraighten = clamp(-0.08 + (speedRatio - 0.1) * 0.2, -0.08, 0.04)
  } else {
    // Cruise and faster: aggressive forward extension
    // -0.12 rad at slow cruise, -0.28 rad at fast cruise, -0.40 rad at sprint
    const t = clamp((speedRatio - 0.4) / 1.0, 0, 1)
    neckStraighten = -0.12 - t * 0.28
  }

  // 2. Gaze pitch: hold the horizon near a standstill, follow the path in flight.
  const horizonHold =
    1 -
    clamp(
      (horizontalSpeed - HORIZON_HOLD_FULL_SPEED) /
        (HORIZON_HOLD_ZERO_SPEED - HORIZON_HOLD_FULL_SPEED),
      0,
      1,
    )

  // Shared with `flightPoseTargets`, so the head and the body read the same
  // descent — two similar formulas here would drift apart and put the snout off
  // the line the torso is actually on.
  const pathAngle =
    horizontalSpeed > 0.5 ? flightPathAngle(verticalSpeed, horizontalSpeed) : 0

  // `bodyPitch` and `pathAngle` are both positive nose-down. Cancelling the
  // first is the hover behaviour; adding a share of the second is the forward
  // one. They never both apply at full strength.
  const gazePitch = -bodyPitch * horizonHold + pathAngle * FLIGHT_PATH_LEAD * (1 - horizonHold)

  // Distribute neck pitch across the 3 neck bones (Neck_012, Neck1_013, Neck2_014)
  // Neck bones closer to body get more of the straightening
  const neckPitch = (neckStraighten * 1.2 + gazePitch * 0.40) / 3

  // Head pitch takes remaining compensation so snout points parallel to flight vector
  // Add slight downward tuck at high speeds for streamlined appearance
  const speedTuck = speedRatio > 1.0 ? -(speedRatio - 1.0) * 0.08 : 0
  const headPitch = gazePitch * 0.60 - neckStraighten * 0.20 + speedTuck

  // 3. Turn Leading & Roll Compensation (Head Anticipates Turns)
  // Head leads into turns more prominently at speed
  const turnLeadBase = 0.35
  const turnLeadEnhanced = turnLeadBase + (clamp(speedRatio, 0.5, 1.5) - 0.5) * 0.25
  // Sign measured, not assumed, and it was inverted here for as long as this
  // existed. Positive yaw on the neck's local Y turns the head toward the rig's
  // *right* (probed: 0.055 rad moves the head -0.13 in x, and +x is the rig's
  // left). `flightPoseTargets` banks left on a negative `yawRate`, so a left
  // turn needs a negative offset to reach the inside of it — and `-yawRate`
  // produced a positive one, sending the head to the outside. The authored
  // `neck_bank` carried the identical inversion; see `neck_lean` in
  // `scripts/author-drogon-sanctuary.py`.
  const turnLeadYaw = clamp(yawRate * turnLeadEnhanced, -0.45, 0.45)

  // Split to match `NECK_LEAN_WEIGHTS` in the authoring script, because the
  // runtime lean and the authored bank lean are one gesture: both put the
  // majority on the last neck bone and the rest on the skull.
  const neckYaw = turnLeadYaw * 0.55
  const headYaw = turnLeadYaw * 0.45

  // Head roll counteracts steep body bank so eyes stay near level with horizon
  // More aggressive roll compensation at speed for stable gaze
  const rollCompensation = 0.45 + clamp(speedRatio * 0.15, 0, 0.20)
  const headRoll = clamp(-bodyBank * rollCompensation, -0.30, 0.30)

  return {
    neckPitch,
    neckYaw,
    headPitch,
    headYaw,
    headRoll,
  }
}

/**
 * Airspeed's share of the leg tuck, in radians, on top of the mode's authored
 * carriage.
 *
 * The clips carry the per-mode base — cruise measures `foot_drop` 2.95, speed
 * 2.33, dive 2.20, hover 4.15 — so this is deliberately a *signed offset around
 * zero*, not the tuck itself. Without it the legs would only ever change when
 * the flight-mode selector swapped a clip, which steps; with it they retract
 * continuously as speed builds and settle back down as it bleeds off, and the
 * clip swap lands on a carriage the runtime has already been approaching.
 *
 * Zero at the reference speed, so a wyvern cruising at its nominal speed shows
 * exactly the authored pose and nothing else.
 *
 * Enhanced for Meleys-style aerodynamic streamlining:
 * - Legs extend more at hover for prey-grabbing readiness
 * - Faster tucking at sprint for reduced drag
 * - Smoother transition between speed regimes
 */
export function legTuckTarget(horizontalSpeed: number, referenceSpeed: number = 18): number {
  const ratio = horizontalSpeed / Math.max(referenceSpeed, 1e-4)

  // Hover/slow: legs hang down for landing readiness and prey grabbing
  if (ratio < 0.3) {
    return LEG_TUCK_RELEASE * (1 - clamp(ratio / 0.3, 0, 1))
  }

  // Cruise to sprint: progressive tuck
  if (ratio > 1.0) {
    // Above cruise speed: increasing tuck
    const speedExcess = clamp((ratio - 1.0) / 0.8, 0, 1)
    return LEG_TUCK_MAX * speedExcess
  }

  // Normal cruise range (0.3 <= ratio <= 1.0): smooth gradient
  return 0
}

/** Smoothly damps the leg tuck offset. Slower than the head: legs carry weight. */
export function dampLegTuck(current: number, target: number, dt: number, rate = 4): number {
  return damp(current, target, rate, dt)
}

/** Smoothly damps head and neck pose angles frame-by-frame. */
export function dampHeadNeckPose(
  current: HeadNeckPose,
  target: HeadNeckPose,
  dt: number,
  rate = 8,
): HeadNeckPose {
  return {
    neckPitch: damp(current.neckPitch, target.neckPitch, rate, dt),
    neckYaw: damp(current.neckYaw, target.neckYaw, rate, dt),
    headPitch: damp(current.headPitch, target.headPitch, rate, dt),
    headYaw: damp(current.headYaw, target.headYaw, rate, dt),
    headRoll: damp(current.headRoll, target.headRoll, rate, dt),
  }
}

/**
 * Converts movement into an aerodynamic pose. The model faces +Z, so a climb
 * needs negative X rotation (nose up), while a right turn needs negative Z
 * rotation (right wing down).
 */
export function flightPoseTargets(
  verticalSpeed: number,
  horizontalSpeed: number,
  yawRate: number,
  time: number = 0,
  referenceSpeed: number = 18,
): FlightPose {
  const rawVPitch = verticalSpeed === 0 ? 0 : flightPathAngle(verticalSpeed, horizontalSpeed)
  const trimPitch = speedPitchTrim(horizontalSpeed, referenceSpeed)
  const undulation = dynamicBodyUndulation(horizontalSpeed, time)

  const pitch = clamp(rawVPitch + trimPitch + undulation.pitch, -MAX_PITCH, MAX_PITCH)
  const bank =
    horizontalSpeed < 0.5
      ? undulation.bank
      : clamp(-yawRate * BANK_FROM_YAW_RATE + undulation.bank, -MAX_BANK, MAX_BANK)

  return { pitch, bank }
}

/** Smooths flight attitude without making it dependent on frame rate. */
export function dampFlightPose(
  current: FlightPose,
  target: FlightPose,
  dt: number,
): FlightPose {
  return {
    pitch: damp(current.pitch, target.pitch, 6, dt),
    bank: damp(current.bank, target.bank, 8, dt),
  }
}

/**
 * Picks the skeletal flight loop.
 *
 * The ladder is dive -> glide -> hover -> bank -> scout -> speed -> cruise, and the
 * order is physical rather than arbitrary:
 *
 * - **dive first**, because it is the only mode the runtime cannot express on
 *   its own. Past MAX_PITCH the procedural layer is saturated; every other mode
 *   still reads correctly with a generic body under it.
 * - **glide above hover**, because hover is the *most* powered mode on this rig
 *   — `Sanct_Hover` measures four wingbeats to cruise's three. A wyvern that has
 *   stopped beating cannot hover, so `powered: false` has to exclude it rather
 *   than fall through into it. That is also what keeps the sanctuary's soaring
 *   orbit, which dips below the hover threshold, out of the hover clip.
 * - **bank above scout and speed**, because turning is the more frequent and more legible
 *   event, and because the bank loops share cruise's `phaseGroup` — dropping
 *   them during a fast turn would regress the wingbeat phase preservation.
 * - **bank below dive, glide and hover**, because those three are
 *   attitude-defining silhouettes (hover measures 32.1 degrees nose-up, the dive
 *   its mirror). Substituting a level banking body fights the whole pose; the
 *   runtime's own roll still banks the model in every mode.
 *
 * Chatter is impossible for a fixed input. Every rung is a hysteresis band on a
 * monotone scalar whose hold set strictly contains its entry set, so entering
 * needs the strict boundary and staying needs the loose one, and no input
 * satisfies both at once. There is no feedback path either — nothing the mixer
 * plays moves the actor, since `pelvis.path` is contracted at or below 0.5 on
 * every flight clip — so the inputs cannot be perturbed by the choice made
 * here. `flightPose.test.ts` asserts this directly, as idempotence.
 */
export function flightAnimationState(
  current: FlightLoopState,
  targetBank: number,
  motion: FlightMotion = {},
): FlightLoopState {
  const { horizontalSpeed, verticalSpeed, referenceSpeed, powered, boosting, searching } = motion

  if (horizontalSpeed !== undefined && verticalSpeed !== undefined) {
    const held = current === 'dive'
    const angle = flightPathAngle(verticalSpeed, horizontalSpeed)
    const throughAir = Math.hypot(horizontalSpeed, verticalSpeed)
    if (
      angle >= (held ? DIVE_EXIT_ANGLE : DIVE_ENTER_ANGLE) &&
      throughAir >= (held ? DIVE_EXIT_SPEED : DIVE_ENTER_SPEED)
    ) {
      return 'dive'
    }
  }

  // An intent, so there is no band to apply and none needed. A caller must not
  // claim `powered: false` at a standstill — there is no unpowered way to hang.
  if (powered === false) return 'glide'

  if (horizontalSpeed !== undefined) {
    const held = current === 'hover'
    if (held ? horizontalSpeed <= HOVER_EXIT_SPEED : horizontalSpeed < HOVER_ENTER_SPEED) {
      return 'hover'
    }
  }

  // Unchanged thresholds and unchanged reversal behaviour. Only the
  // fall-through target moved: instead of returning cruise directly, a bank
  // that has relaxed now drops into the speed/cruise choice below.
  if (current === 'bankLeft') {
    if (targetBank <= -BANK_ANIMATION_ENTER) return 'bankRight'
    if (targetBank >= BANK_ANIMATION_EXIT) return 'bankLeft'
  } else if (current === 'bankRight') {
    if (targetBank >= BANK_ANIMATION_ENTER) return 'bankLeft'
    if (targetBank <= -BANK_ANIMATION_EXIT) return 'bankRight'
  } else {
    if (targetBank >= BANK_ANIMATION_ENTER) return 'bankLeft'
    if (targetBank <= -BANK_ANIMATION_ENTER) return 'bankRight'
  }

  // A search is a slow cruise variant, not an attitude change. It follows the
  // bank rung so a loitering wyvern still shows its turn, and yields to a boost
  // rather than making two incompatible intents fight over the loop.
  if (searching && !boosting) return 'scout'

  if (horizontalSpeed !== undefined && referenceSpeed !== undefined && referenceSpeed > 0) {
    const ratio = horizontalSpeed / referenceSpeed
    const enter = boosting ? BOOST_ENTER_RATIO : SPEED_ENTER_RATIO
    const exit = boosting ? BOOST_EXIT_RATIO : SPEED_EXIT_RATIO
    if (ratio >= (current === 'speed' ? exit : enter)) return 'speed'
  }

  return 'cruise'
}
