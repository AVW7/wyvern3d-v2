import { Vector3 } from 'three'
import { BREATH_CONE_HALF_ANGLE } from '@/core/combat/encounter'
import type { PropBase } from '../props/PropBase'

export interface ConeCollisionResult {
  hitProps: PropBase[]
  distances: Map<string, number>
}

export interface TalonGrabResult {
  grabbedProps: PropBase[]
  foot: 'left' | 'right' | 'both'
  distances: Map<string, number>
}

export class CombatSimulator {
  readonly breathRange: number
  readonly coneHalfAngle: number

  constructor(breathRange: number = 26, coneHalfAngle: number = BREATH_CONE_HALF_ANGLE) {
    this.breathRange = breathRange
    this.coneHalfAngle = coneHalfAngle
  }

  /**
   * Tests volumetric cone intersection between fire breath and physical props.
   *
   * @param origin - Mouth / breath socket world position.
   * @param forward - Normalized world forward vector of the breath jet.
   * @param props - List of active physical props.
   * @param customRange - Optional range override in world units.
   */
  checkFireBreathCone(
    origin: Vector3,
    forward: Vector3,
    props: PropBase[],
    customRange?: number
  ): ConeCollisionResult {
    const range = customRange ?? this.breathRange
    const tanHalfAngle = Math.tan(this.coneHalfAngle)
    const hitProps: PropBase[] = []
    const distances = new Map<string, number>()

    const toProp = new Vector3()
    const proj = new Vector3()

    for (const prop of props) {
      if (prop.isDead && prop.type !== 'food_carcass') continue

      // Target bounding sphere radius (doe is larger than bird)
      const sphereRadius = prop.type === 'prey_doe' ? 1.4 : 0.6
      toProp.subVectors(prop.position, origin)

      // Axial projection distance along the cone forward axis
      const axialDist = toProp.dot(forward)

      // Outside range along the jet axis
      if (axialDist < -sphereRadius || axialDist > range + sphereRadius) {
        continue
      }

      // Perpendicular distance to the cone center axis
      proj.copy(forward).multiplyScalar(axialDist)
      const perpDist = toProp.clone().sub(proj).length()

      // Cone radius at this distance from origin
      const coneRadiusAtDist = Math.max(0, axialDist) * tanHalfAngle
      if (perpDist <= coneRadiusAtDist + sphereRadius) {
        hitProps.push(prop)
        distances.set(prop.id, Math.max(0, axialDist))
      }
    }

    return { hitProps, distances }
  }

  /**
   * Evaluates talon swoop grabs against physical prey.
   *
   * @param leftFoot - Left foot world position.
   * @param rightFoot - Right foot world position.
   * @param props - List of physical props.
   * @param grabRadius - Grab reach radius in world metres (default 2.2m).
   */
  checkTalonSwoop(
    leftFoot: Vector3,
    rightFoot: Vector3,
    props: PropBase[],
    grabRadius: number = 2.2
  ): TalonGrabResult {
    const grabbedProps: PropBase[] = []
    const distances = new Map<string, number>()
    let leftCount = 0
    let rightCount = 0

    for (const prop of props) {
      if (prop.isDead) continue

      const dL = leftFoot.distanceTo(prop.position)
      const dR = rightFoot.distanceTo(prop.position)
      const hitL = dL <= grabRadius
      const hitR = dR <= grabRadius

      if (hitL || hitR) {
        grabbedProps.push(prop)
        const minDist = Math.min(dL, dR)
        distances.set(prop.id, minDist)
        if (hitL) leftCount++
        if (hitR) rightCount++
      }
    }

    let foot: 'left' | 'right' | 'both' = 'both'
    if (leftCount > 0 && rightCount === 0) foot = 'left'
    else if (rightCount > 0 && leftCount === 0) foot = 'right'

    return { grabbedProps, foot, distances }
  }
}
