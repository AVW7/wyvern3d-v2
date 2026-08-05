import { Vector3 } from 'three'

/**
 * Trauma-based 3D camera shake model.
 * Decay is squared (trauma²) so intense hits feel sharp and decay naturally.
 */
export class CameraShake {
  private trauma = 0
  private offset = new Vector3()

  public addTrauma(amount: number): void {
    this.trauma = Math.min(1.0, this.trauma + amount)
  }

  public update(dt: number, time: number): Vector3 {
    if (this.trauma <= 0) {
      this.offset.set(0, 0, 0)
      return this.offset
    }

    // Quadratic decay curve
    const intensity = this.trauma * this.trauma
    const speed = 25

    // Perlin-like pseudo noise using sine offsets
    this.offset.set(
      (Math.sin(time * speed * 1.1) + Math.cos(time * speed * 1.7)) * 1.8 * intensity,
      (Math.cos(time * speed * 1.3) + Math.sin(time * speed * 1.9)) * 1.2 * intensity,
      (Math.sin(time * speed * 1.5) + Math.cos(time * speed * 2.1)) * 1.5 * intensity,
    )

    this.trauma = Math.max(0, this.trauma - dt * 1.8)
    return this.offset
  }
}
