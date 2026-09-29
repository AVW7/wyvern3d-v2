import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { CombatSimulator } from './CombatSimulator'
import { PropManager } from './PropManager'
import { PreyDoe } from '../props/PreyDoe'
import { PreyBird } from '../props/PreyBird'
import { FoodCarcass } from '../props/FoodCarcass'

describe('CombatSimulator - Volumetric Cone & Talon Swoop', () => {
  const sim = new CombatSimulator(26, 0.62)

  it('detects physical target positioned directly in line of fire', () => {
    const origin = new Vector3(0, 10, 0)
    const forward = new Vector3(0, 0, 1)
    const target = new PreyDoe('doe_1', new Vector3(0, 10, 12))

    const { hitProps, distances } = sim.checkFireBreathCone(origin, forward, [target])
    expect(hitProps).toHaveLength(1)
    expect(hitProps[0]?.id).toBe('doe_1')
    expect(distances.get('doe_1')).toBeCloseTo(12, 1)
  })

  it('detects target within the lateral cone spread', () => {
    const origin = new Vector3(0, 10, 0)
    const forward = new Vector3(0, 0, 1)
    // At 10m forward, cone radius is 10 * tan(0.62) = ~7.1m
    const target = new PreyBird('bird_1', new Vector3(4, 10, 10))

    const { hitProps } = sim.checkFireBreathCone(origin, forward, [target])
    expect(hitProps).toHaveLength(1)
  })

  it('rejects target outside the lateral cone half-angle', () => {
    const origin = new Vector3(0, 10, 0)
    const forward = new Vector3(0, 0, 1)
    // At 10m forward, 12m lateral is well outside the cone
    const target = new PreyBird('bird_wide', new Vector3(12, 10, 10))

    const { hitProps } = sim.checkFireBreathCone(origin, forward, [target])
    expect(hitProps).toHaveLength(0)
  })

  it('rejects target positioned behind the mouth apex', () => {
    const origin = new Vector3(0, 10, 0)
    const forward = new Vector3(0, 0, 1)
    const target = new PreyDoe('doe_behind', new Vector3(0, 10, -5))

    const { hitProps } = sim.checkFireBreathCone(origin, forward, [target])
    expect(hitProps).toHaveLength(0)
  })

  it('rejects target beyond maximum breath range', () => {
    const origin = new Vector3(0, 10, 0)
    const forward = new Vector3(0, 0, 1)
    // Range is 26m
    const target = new PreyDoe('doe_far', new Vector3(0, 10, 35))

    const { hitProps } = sim.checkFireBreathCone(origin, forward, [target])
    expect(hitProps).toHaveLength(0)
  })

  it('evaluates talon swoop grab against prey bounding spheres', () => {
    const leftFoot = new Vector3(-1.5, 5, 0)
    const rightFoot = new Vector3(1.5, 5, 0)
    const closeLeft = new PreyBird('bird_l', new Vector3(-1.2, 5.2, 0.1))
    const farAway = new PreyBird('bird_far', new Vector3(10, 5, 0))

    const result = sim.checkTalonSwoop(leftFoot, rightFoot, [closeLeft, farAway], 2.2)
    expect(result.grabbedProps).toHaveLength(1)
    expect(result.grabbedProps[0]?.id).toBe('bird_l')
    expect(result.foot).toBe('left')
  })
})

describe('PreyDoe - Sensory AI & Thermal Roasting', () => {
  it('remains grazing at distance > 35m from wyvern ground projection', () => {
    const doe = new PreyDoe('doe_far', new Vector3(0, 0, 45))
    const wyvernPos = new Vector3(0, 20, 0) // Shadow at (0, 0, 0), distance 45m

    doe.update(0.1, wyvernPos)
    expect(doe.state).toBe('grazing')
  })

  it('transitions to alert when wyvern shadow enters 35m sensory radius', () => {
    const doe = new PreyDoe('doe_mid', new Vector3(0, 0, 30))
    const wyvernPos = new Vector3(0, 25, 0) // Shadow at (0, 0, 0), distance 30m

    doe.update(0.1, wyvernPos)
    expect(doe.state).toBe('alert')
  })

  it('panics and sprints directly away from wyvern ground shadow at close range', () => {
    const doe = new PreyDoe('doe_close', new Vector3(10, 0, 0))
    const wyvernPos = new Vector3(0, 15, 0) // Shadow at (0, 0, 0)

    doe.update(0.1, wyvernPos)
    expect(doe.state).toBe('fleeing')
    // Velocity must point away along +X
    expect(doe.velocity.x).toBeGreaterThan(5)
    expect(doe.velocity.y).toBe(0)
    expect(doe.position.x).toBeGreaterThan(10)
  })

  it('accumulates thermal energy and transitions to dead carcass state on fatal fire', () => {
    const doe = new PreyDoe('doe_roast', new Vector3(0, 0, 10))
    doe.takeDamage(100, true, 0.8)

    expect(doe.isDead).toBe(true)
    expect(doe.isRoasting).toBe(true)
    expect(doe.roastProgress).toBe(0.8)
    expect(doe.hp).toBe(0)

    doe.update(0.1, new Vector3(0, 10, 0))
    expect(doe.state).toBe('dead')
    expect(doe.velocity.length()).toBe(0)
  })
})

describe('PreyBird - 3D Boid Flocking & Gravity Death', () => {
  it('performs evasive flight away from nearby wyvern', () => {
    const bird = new PreyBird('bird_1', new Vector3(0, 10, 10))
    const wyvernPos = new Vector3(0, 10, 0) // 10m away

    bird.update(0.1, wyvernPos)
    expect(bird.state).toBe('evasion')
    // Velocity must steer away along +Z and upward
    expect(bird.velocity.z).toBeGreaterThan(0)
    expect(bird.velocity.y).toBeGreaterThan(0)
  })

  it('boid flockmates steer with separation when crowded', () => {
    const bird1 = new PreyBird('bird_b1', new Vector3(0, 12, 0))
    const bird2 = new PreyBird('bird_b2', new Vector3(1, 12, 0)) // 1m apart (crowded < 3.5m)
    const farWyvern = new Vector3(100, 100, 100)

    const initialVx = bird1.velocity.x
    bird1.updateFlock(0.1, farWyvern, [bird1, bird2])
    expect(bird1.state).toBe('flocking')
    // Bird 1 must steer away from Bird 2 along -X, decreasing Vx
    expect(bird1.velocity.x).toBeLessThan(initialVx)
  })

  it('falls under gravity when killed mid-air until reaching ground', () => {
    const bird = new PreyBird('bird_air', new Vector3(0, 10, 0))
    bird.takeDamage(50, false, 0)
    expect(bird.isDead).toBe(true)

    // Run several updates simulating fall
    for (let i = 0; i < 15; i++) {
      bird.update(0.1, new Vector3(0, 0, 0))
    }

    expect(bird.position.y).toBe(0)
    expect(bird.state).toBe('dead')
    expect(bird.velocity.length()).toBe(0)
  })
})

describe('PropManager - Complete Combat & Carcass Pipeline', () => {
  it('spawns does, birds, and evaluates fire cone roasting to carcass conversion', () => {
    const manager = new PropManager()
    const doe = manager.spawnDoe(new Vector3(0, 0, 10))
    const bird = manager.spawnBird(new Vector3(0, 5, 12))

    expect(manager.getAllProps()).toHaveLength(2)

    // Fire breath cone along +Z from (0, 2, 0)
    const origin = new Vector3(0, 2, 0)
    const forward = new Vector3(0, 0, 1)

    // Apply lethal fire cone
    const hit = manager.applyFireCone(origin, forward, 150, 1.0)
    const hitIds = hit.map((p) => p.id)
    expect(hitIds).toContain(doe.id)
    expect(hitIds).toContain(bird.id)
    expect(doe.isDead).toBe(true)
    expect(doe.isRoasting).toBe(true)

    // A food carcass must have been spawned
    const carcasses = manager.getAllProps().filter((p): p is FoodCarcass => p.type === 'food_carcass')
    expect(carcasses.length).toBeGreaterThanOrEqual(1)
    expect(carcasses[0]?.isDead).toBe(true)
    expect(carcasses[0]?.foodValue).toBe(doe.foodValue)
  })

  it('evaluates talon swoop damage and clears props cleanly', () => {
    const manager = new PropManager()
    const bird = manager.spawnBird(new Vector3(0, 5, 0))

    const result = manager.applyTalonSwoop(new Vector3(0, 5.2, 0), new Vector3(1, 5.2, 0), 20)
    expect(result.grabbed).toHaveLength(1)
    expect(bird.hp).toBe(0)
    expect(bird.isDead).toBe(true)

    manager.clearAllProps()
    expect(manager.getAllProps()).toHaveLength(0)
  })
})
