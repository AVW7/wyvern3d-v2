import { Vector3 } from 'three'
import { PropBase } from '../props/PropBase'
import { PreyDoe } from '../props/PreyDoe'
import { PreyBird } from '../props/PreyBird'

export class PropManager {
  private props: Map<string, PropBase> = new Map()
  private idCounter: number = 0

  spawnDoe(position?: Vector3): PreyDoe {
    this.idCounter++
    const id = `doe_${this.idCounter}`
    const pos = position || new Vector3(
      (Math.sin(this.idCounter) * 15),
      0,
      (Math.cos(this.idCounter) * 15)
    )
    const doe = new PreyDoe(id, pos)
    this.props.set(id, doe)
    return doe
  }

  spawnBird(position?: Vector3): PreyBird {
    this.idCounter++
    const id = `bird_${this.idCounter}`
    const pos = position || new Vector3(
      (Math.cos(this.idCounter * 1.5) * 20),
      12.0,
      (Math.sin(this.idCounter * 1.5) * 20)
    )
    const bird = new PreyBird(id, pos)
    this.props.set(id, bird)
    return bird
  }

  clearAllProps(): void {
    this.props.clear()
  }

  getAllProps(): PropBase[] {
    return Array.from(this.props.values())
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

  applyFireDamage(center: Vector3, radius: number, damage: number, thermalEnergy: number = 0.2): PropBase[] {
    const hitProps = this.getPropsInRange(center, radius)
    for (const prop of hitProps) {
      prop.takeDamage(damage, true, thermalEnergy)
    }
    return hitProps
  }

  update(dt: number, wyvernPos: Vector3): void {
    for (const prop of this.props.values()) {
      prop.update(dt, wyvernPos)
    }
  }
}
