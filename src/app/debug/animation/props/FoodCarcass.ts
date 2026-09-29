import { Vector3 } from 'three'
import { PropBase } from './PropBase'

export class FoodCarcass extends PropBase {
  freshness: number = 1.0 // 1.0 down to 0
  consumed: boolean = false
  sourcePreyId?: string

  constructor(id: string, initialPosition: Vector3, foodValue: number = 100, sourcePreyId?: string) {
    super(id, 'food_carcass', initialPosition, 1, foodValue)
    this.isDead = true
    this.isRoasting = true
    this.roastProgress = 1.0
    this.sourcePreyId = sourcePreyId
  }

  update(dt: number, _wyvernPos: Vector3): void {
    // Sits firmly on ground
    if (this.position.y > 0) {
      this.position.y = Math.max(0, this.position.y - 12.0 * dt)
    }
    this.velocity.set(0, 0, 0)
    // Slowly decay freshness over 120 seconds if untouched
    if (this.freshness > 0) {
      this.freshness = Math.max(0, this.freshness - dt / 120)
    }
  }

  consume(): number {
    if (this.consumed) return 0
    this.consumed = true
    return this.foodValue
  }
}
