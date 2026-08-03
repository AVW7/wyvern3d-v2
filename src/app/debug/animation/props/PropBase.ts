import { Vector3, Sphere } from 'three'

export type PropType = 'prey_doe' | 'prey_bird' | 'target_dummy' | 'food_carcass'

export abstract class PropBase {
  id: string
  type: PropType
  position: Vector3
  rotation: Vector3
  velocity: Vector3
  hp: number
  maxHp: number
  isDead: boolean = false
  isRoasting: boolean = false
  roastProgress: number = 0 // 0 (raw) to 1 (cooked food)
  foodValue: number = 0

  constructor(id: string, type: PropType, initialPosition: Vector3, hp: number, foodValue: number) {
    this.id = id
    this.type = type
    this.position = initialPosition.clone()
    this.rotation = new Vector3(0, 0, 0)
    this.velocity = new Vector3(0, 0, 0)
    this.hp = hp
    this.maxHp = hp
    this.foodValue = foodValue
  }

  abstract update(dt: number, wyvernPos: Vector3): void

  takeDamage(amount: number, isFire: boolean = false, thermalEnergy: number = 0): void {
    if (this.isDead) return
    this.hp = Math.max(0, this.hp - amount)

    if (isFire) {
      this.isRoasting = true
      this.roastProgress = Math.min(1.0, this.roastProgress + thermalEnergy)
    }

    if (this.hp <= 0) {
      this.isDead = true
    }
  }

  getBoundingSphere(radius: number = 1.5): Sphere {
    return new Sphere(this.position.clone(), radius)
  }
}
