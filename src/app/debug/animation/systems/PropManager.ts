import { Vector3 } from 'three'
import { PropBase } from '../props/PropBase'
import { PreyDoe } from '../props/PreyDoe'
import { PreyBird } from '../props/PreyBird'
import { FoodCarcass } from '../props/FoodCarcass'
import { CombatSimulator } from './CombatSimulator'

export class PropManager {
  private props: Map<string, PropBase> = new Map()
  private idCounter: number = 0
  readonly combatSim: CombatSimulator

  constructor(combatSim?: CombatSimulator) {
    this.combatSim = combatSim ?? new CombatSimulator()
  }

  spawnDoe(position?: Vector3): PreyDoe {
    this.idCounter++
    const id = `doe_${this.idCounter}`
    const pos = position ?? new Vector3(
      Math.sin(this.idCounter * 1.7) * 16,
      0,
      Math.cos(this.idCounter * 1.7) * 16,
    )
    const doe = new PreyDoe(id, pos)
    this.props.set(id, doe)
    return doe
  }

  spawnBird(position?: Vector3): PreyBird {
    this.idCounter++
    const id = `bird_${this.idCounter}`
    const pos = position ?? new Vector3(
      Math.cos(this.idCounter * 1.5) * 18,
      12.0 + (this.idCounter % 4),
      Math.sin(this.idCounter * 1.5) * 18,
    )
    const bird = new PreyBird(id, pos)
    this.props.set(id, bird)
    return bird
  }

  spawnCarcass(position: Vector3, foodValue: number = 100, sourcePreyId?: string): FoodCarcass {
    this.idCounter++
    const id = `carcass_${this.idCounter}`
    const carcass = new FoodCarcass(id, position, foodValue, sourcePreyId)
    this.props.set(id, carcass)
    return carcass
  }

  clearAllProps(): void {
    this.props.clear()
  }

  getAllProps(): PropBase[] {
    return Array.from(this.props.values())
  }

  getAllBirds(): PreyBird[] {
    return Array.from(this.props.values()).filter((p): p is PreyBird => p.type === 'prey_bird')
  }

  getAllDoes(): PreyDoe[] {
    return Array.from(this.props.values()).filter((p): p is PreyDoe => p.type === 'prey_doe')
  }

  getPropsInRange(center: Vector3, radius: number): PropBase[] {
    const result: PropBase[] = []
    const rSq = radius * radius
    for (const prop of this.props.values()) {
      if (prop.position.distanceToSquared(center) <= rSq) {
        result.push(prop)
      }
    }
    return result
  }

  /**
   * Evaluates volumetric fire breath cone collision, applies thermal damage,
   * triggers roasting reactions, and converts destroyed prey into edible carcasses.
   */
  applyFireCone(
    origin: Vector3,
    forward: Vector3,
    damage: number,
    thermalEnergy: number = 0.25,
    customRange?: number
  ): PropBase[] {
    const { hitProps } = this.combatSim.checkFireBreathCone(
      origin,
      forward,
      this.getAllProps(),
      customRange
    )

    const newlySpawnedCarcasses: FoodCarcass[] = []

    for (const prop of hitProps) {
      if (prop.isDead) continue

      prop.takeDamage(damage, true, thermalEnergy)

      // Thermal death: if the prop dies or reaches full roast, spawn edible carcass
      if (prop.isDead) {
        const carcassPos = prop.position.clone()
        carcassPos.y = 0 // Rest on ground
        const carcass = new FoodCarcass(
          `carcass_${prop.id}`,
          carcassPos,
          prop.foodValue,
          prop.id
        )
        newlySpawnedCarcasses.push(carcass)
      }
    }

    // Register spawned carcasses
    for (const c of newlySpawnedCarcasses) {
      this.props.set(c.id, c)
    }

    return hitProps
  }

  /**
   * Radial fire damage fallback (for point explosions/ground bursts).
   */
  applyFireDamage(center: Vector3, radius: number, damage: number, thermalEnergy: number = 0.2): PropBase[] {
    const hitProps = this.getPropsInRange(center, radius)
    for (const prop of hitProps) {
      prop.takeDamage(damage, true, thermalEnergy)
    }
    return hitProps
  }

  /**
   * Talon swoop grab check for snatching prey with talons during dive/attack actions.
   */
  applyTalonSwoop(
    leftFoot: Vector3,
    rightFoot: Vector3,
    damage: number = 50,
    grabRadius: number = 2.2
  ): { grabbed: PropBase[]; foot: 'left' | 'right' | 'both' } {
    const { grabbedProps, foot } = this.combatSim.checkTalonSwoop(
      leftFoot,
      rightFoot,
      this.getAllProps(),
      grabRadius
    )

    for (const prop of grabbedProps) {
      prop.takeDamage(damage, false, 0)
    }

    return { grabbed: grabbedProps, foot }
  }

  update(dt: number, wyvernPos: Vector3): void {
    const birds = this.getAllBirds()

    for (const prop of this.props.values()) {
      if (prop.type === 'prey_bird') {
        ;(prop as PreyBird).updateFlock(dt, wyvernPos, birds)
      } else {
        prop.update(dt, wyvernPos)
      }
    }
  }
}
