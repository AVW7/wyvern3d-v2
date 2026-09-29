import { Vector3 } from 'three'
import { PropBase } from './PropBase'

export type BirdState = 'perched' | 'flocking' | 'evasion' | 'falling' | 'dead'

export class PreyBird extends PropBase {
  state: BirdState = 'flocking'
  flightSpeed: number = 14.0
  flightAltitude: number = 12.0
  flightAngle: number = 0
  maxForce: number = 10.0

  constructor(id: string, initialPosition: Vector3) {
    super(id, 'prey_bird', initialPosition, 15, 15)
    this.flightAngle = (Number.parseFloat(id.replace(/\D/g, '')) || 1) * 0.5
    // Initialize velocity along flight angle
    this.velocity.set(
      Math.cos(this.flightAngle) * this.flightSpeed,
      0,
      Math.sin(this.flightAngle) * this.flightSpeed
    )
  }

  update(dt: number, wyvernPos: Vector3): void {
    this.updateFlock(dt, wyvernPos, [])
  }

  updateFlock(dt: number, wyvernPos: Vector3, flockmates: PreyBird[] = []): void {
    if (this.isDead) {
      if (this.position.y > 0) {
        // Fall to ground with gravity
        this.velocity.y -= 20.0 * dt
        this.position.addScaledVector(this.velocity, dt)
        if (this.position.y <= 0) {
          this.position.y = 0
          this.velocity.set(0, 0, 0)
        }
      }
      this.state = 'dead'
      return
    }

    const distToWyvern = this.position.distanceTo(wyvernPos)

    // Evasion check against predator (wyvern)
    if (distToWyvern < 20.0 || this.hp < this.maxHp || this.isRoasting) {
      this.state = 'evasion'
      const evadeDir = new Vector3().subVectors(this.position, wyvernPos)
      if (evadeDir.lengthSq() < 1e-4) {
        evadeDir.set(0, 1, 0)
      } else {
        evadeDir.normalize()
      }
      // Bias evasion upward to escape ground/breath
      evadeDir.y = Math.max(0.3, evadeDir.y + 0.3)
      evadeDir.normalize()

      const targetVel = evadeDir.multiplyScalar(this.flightSpeed * 1.6)
      this.velocity.lerp(targetVel, Math.min(1, dt * 5.0))
      this.position.addScaledVector(this.velocity, dt)

      // Orient toward velocity
      this.rotation.y = Math.atan2(this.velocity.x, this.velocity.z)
      return
    }

    this.state = 'flocking'

    // Boid steering vectors: Separation, Alignment, Cohesion
    const separation = new Vector3()
    const alignment = new Vector3()
    const cohesion = new Vector3()
    let neighborCount = 0
    let sepCount = 0

    const SEPARATION_DIST = 3.5
    const NEIGHBOR_RADIUS = 15.0

    for (const mate of flockmates) {
      if (mate === this || mate.isDead) continue
      const d = this.position.distanceTo(mate.position)

      if (d > 0 && d < SEPARATION_DIST) {
        // Separation: push away inversely proportional to distance
        const diff = new Vector3().subVectors(this.position, mate.position).normalize().divideScalar(d)
        separation.add(diff)
        sepCount++
      }

      if (d > 0 && d < NEIGHBOR_RADIUS) {
        alignment.add(mate.velocity)
        cohesion.add(mate.position)
        neighborCount++
      }
    }

    const steer = new Vector3()

    if (sepCount > 0) {
      separation.divideScalar(sepCount).normalize().multiplyScalar(this.flightSpeed)
      const sepSteer = new Vector3().subVectors(separation, this.velocity).clampLength(0, this.maxForce * 1.5)
      steer.addScaledVector(sepSteer, 1.5)
    }

    if (neighborCount > 0) {
      // Alignment: match average heading
      alignment.divideScalar(neighborCount).normalize().multiplyScalar(this.flightSpeed)
      const alignSteer = new Vector3().subVectors(alignment, this.velocity).clampLength(0, this.maxForce)
      steer.addScaledVector(alignSteer, 1.0)

      // Cohesion: steer toward center of mass
      cohesion.divideScalar(neighborCount)
      const cohDir = new Vector3().subVectors(cohesion, this.position).normalize().multiplyScalar(this.flightSpeed)
      const cohSteer = new Vector3().subVectors(cohDir, this.velocity).clampLength(0, this.maxForce)
      steer.addScaledVector(cohSteer, 0.8)
    } else {
      // Wander in loiter circle around wyvern anchor
      this.flightAngle += 0.8 * dt
      const targetPos = new Vector3(
        wyvernPos.x + Math.sin(this.flightAngle) * 22.0,
        this.flightAltitude,
        wyvernPos.z + Math.cos(this.flightAngle) * 22.0,
      )
      const wanderDir = new Vector3().subVectors(targetPos, this.position).normalize().multiplyScalar(this.flightSpeed)
      const wanderSteer = new Vector3().subVectors(wanderDir, this.velocity).clampLength(0, this.maxForce)
      steer.add(wanderSteer)
    }

    // Altitude spring: return to flightAltitude
    const altDelta = this.flightAltitude - this.position.y
    steer.y += altDelta * 2.0

    // Boundary repulsion if straying too far (> 60m from wyvern)
    const distCenter = new Vector3(this.position.x - wyvernPos.x, 0, this.position.z - wyvernPos.z).length()
    if (distCenter > 50.0) {
      const returnDir = new Vector3(wyvernPos.x - this.position.x, 0, wyvernPos.z - this.position.z).normalize()
      steer.addScaledVector(returnDir, this.maxForce * 1.2)
    }

    // Apply accumulated steering
    this.velocity.addScaledVector(steer, dt)
    // Clamp speed
    if (this.velocity.length() > this.flightSpeed) {
      this.velocity.normalize().multiplyScalar(this.flightSpeed)
    }
    this.position.addScaledVector(this.velocity, dt)

    // Floor clamp
    if (this.position.y < 1.0) {
      this.position.y = 1.0
      this.velocity.y = Math.max(0, this.velocity.y)
    }

    // Orient toward velocity
    if (this.velocity.lengthSq() > 0.1) {
      this.rotation.y = Math.atan2(this.velocity.x, this.velocity.z)
    }
  }
}
