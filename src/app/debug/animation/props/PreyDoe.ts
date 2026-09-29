import { Vector3 } from 'three'
import { PropBase } from './PropBase'

export type DoeState = 'grazing' | 'alert' | 'fleeing' | 'roasting' | 'dead'

export class PreyDoe extends PropBase {
  state: DoeState = 'grazing'
  detectionRadius: number = 35.0
  runSpeed: number = 12.0
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
      this.velocity.set(0, 0, 0)
      return
    }

    // Wyvern ground projection (shadow)
    const wyvernShadow = new Vector3(wyvernPos.x, 0, wyvernPos.z)
    const distToShadow = this.position.distanceTo(wyvernShadow)
    const dist3D = this.position.distanceTo(wyvernPos)

    // State machine updates
    if (this.isRoasting && this.hp > 0) {
      this.state = 'roasting'
    } else if (distToShadow < 15.0 || dist3D < 18.0 || this.hp < this.maxHp) {
      this.state = 'fleeing'
    } else if (distToShadow < this.detectionRadius) {
      this.state = 'alert'
    } else {
      this.state = 'grazing'
    }

    // Movement logic per state
    if (this.state === 'fleeing' || this.state === 'roasting') {
      // Panic sprint directly away from wyvern ground shadow
      const fleeDir = new Vector3().subVectors(this.position, wyvernShadow)
      fleeDir.y = 0 // Keep to ground plane
      if (fleeDir.lengthSq() < 1e-4) {
        fleeDir.set(1, 0, 0)
      } else {
        fleeDir.normalize()
      }

      const currentSpeed = this.state === 'roasting' ? this.runSpeed * 1.25 : this.runSpeed
      this.velocity.copy(fleeDir).multiplyScalar(currentSpeed)
      this.position.addScaledVector(this.velocity, dt)

      // Orient toward flight direction
      this.rotation.y = Math.atan2(fleeDir.x, fleeDir.z)
    } else if (this.state === 'alert') {
      // Orient toward the threat, freeze/tread slowly
      const lookDir = new Vector3().subVectors(wyvernShadow, this.position)
      lookDir.y = 0
      if (lookDir.lengthSq() > 1e-4) {
        this.rotation.y = Math.atan2(lookDir.x, lookDir.z)
      }
      this.velocity.set(0, 0, 0)
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
      dir.y = 0
      if (dir.length() > 0.5) {
        dir.normalize().multiplyScalar(2.0)
        this.velocity.copy(dir)
        this.position.addScaledVector(dir, dt)
        this.rotation.y = Math.atan2(dir.x, dir.z)
      } else {
        this.velocity.set(0, 0, 0)
      }
    }

    // Keep doe grounded
    this.position.y = 0
  }
}
