import { Vector3 } from 'three'
import { PropBase } from './PropBase'

export type DoeState = 'grazing' | 'alert' | 'fleeing' | 'roasting' | 'dead'

export class PreyDoe extends PropBase {
  state: DoeState = 'grazing'
  detectionRadius: number = 25.0
  runSpeed: number = 10.0
  wanderTimer: number = 0
  wanderSeed: number
  moveTarget: Vector3

  constructor(id: string, initialPosition: Vector3) {
    super(id, 'prey_doe', initialPosition, 80, 50)
    this.moveTarget = initialPosition.clone()
    this.wanderSeed = Number.parseInt(id.replace(/\D/g, ''), 10) || 1
  }

  update(dt: number, wyvernPos: Vector3): void {
    if (this.isDead) {
      this.state = 'dead'
      return
    }

    const distToWyvern = this.position.distanceTo(wyvernPos)

    // State machine updates
    if (this.isRoasting && this.hp > 0) {
      this.state = 'roasting'
    } else if (distToWyvern < 12.0 || this.hp < this.maxHp) {
      this.state = 'fleeing'
    } else if (distToWyvern < this.detectionRadius) {
      this.state = 'alert'
    } else {
      this.state = 'grazing'
    }

    // Movement logic per state
    if (this.state === 'fleeing') {
      // Flee directly away from wyvern
      const fleeDir = new Vector3().subVectors(this.position, wyvernPos).normalize()
      fleeDir.y = 0 // Ground travel
      this.velocity.copy(fleeDir).multiplyScalar(this.runSpeed)
      this.position.addScaledVector(this.velocity, dt)

      // Rotate toward fleeing direction
      this.rotation.y = Math.atan2(fleeDir.x, fleeDir.z)
    } else if (this.state === 'grazing') {
      // Slow wander
      this.wanderTimer -= dt
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 3 + ((this.wanderSeed % 20) / 10)
        this.moveTarget.set(
          this.position.x + (((this.wanderSeed * 3) % 60) / 10) - 3,
          this.position.y,
          this.position.z + (((this.wanderSeed * 7) % 60) / 10) - 3,
        )
        this.wanderSeed += 1
      }

      const dir = new Vector3().subVectors(this.moveTarget, this.position)
      if (dir.length() > 0.5) {
        dir.normalize().multiplyScalar(2.0)
        dir.y = 0
        this.position.addScaledVector(dir, dt)
        this.rotation.y = Math.atan2(dir.x, dir.z)
      }
    }
  }
}
