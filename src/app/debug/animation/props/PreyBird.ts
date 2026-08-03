import { Vector3 } from 'three'
import { PropBase } from './PropBase'

export type BirdState = 'perched' | 'flocking' | 'evasion' | 'falling' | 'dead'

export class PreyBird extends PropBase {
  state: BirdState = 'flocking'
  flightSpeed: number = 14.0
  flightAltitude: number = 12.0
  flightAngle: number = 0

  constructor(id: string, initialPosition: Vector3) {
    super(id, 'prey_bird', initialPosition, 15, 15)
    this.flightAngle = (parseFloat(id.replace(/\D/g, '')) || 1) * 0.5
  }

  update(dt: number, wyvernPos: Vector3): void {
    if (this.isDead) {
      if (this.position.y > 0) {
        // Fall to ground
        this.velocity.y -= 15.0 * dt
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

    if (distToWyvern < 15.0 || this.hp < this.maxHp) {
      this.state = 'evasion'
    } else {
      this.state = 'flocking'
    }

    if (this.state === 'evasion') {
      // Rapid evasive 3D flight away and downward/upward
      const evadeDir = new Vector3().subVectors(this.position, wyvernPos).normalize()
      evadeDir.y += 0.2 // Ascend away
      this.velocity.copy(evadeDir).multiplyScalar(this.flightSpeed * 1.5)
      this.position.addScaledVector(this.velocity, dt)
    } else {
      // Circle flocking flight pattern
      this.flightAngle += 0.8 * dt
      const targetX = wyvernPos.x + Math.sin(this.flightAngle) * 18.0
      const targetZ = wyvernPos.z + Math.cos(this.flightAngle) * 18.0
      
      this.position.x += (targetX - this.position.x) * 2.0 * dt
      this.position.z += (targetZ - this.position.z) * 2.0 * dt
      this.position.y += (this.flightAltitude - this.position.y) * 1.5 * dt
    }
  }
}
