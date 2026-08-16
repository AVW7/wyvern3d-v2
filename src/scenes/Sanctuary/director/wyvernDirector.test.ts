import { describe, expect, it, vi } from 'vitest'
import type { WyvernInstance } from '@/core/types'
import {
  createSanctuaryDirector,
  TAKEOFF_SECONDS,
  LAND_SECONDS,
  TRANSIT_ALTITUDE,
} from './wyvernDirector'

function createMockWyvern(id: string, stage: 'hatchling' | 'juvenile' | 'adult' = 'adult'): WyvernInstance {
  return {
    id,
    name: `Wyvern ${id}`,
    speciesId: 'drogon',
    stage,
    ageTicks: 1000,
    level: 1,
    xp: 0,
    hunger: 0,
    bond: 50,
    injury: 0,
    traits: [],
    preferredPerchIndex: 0,
    assignment: { kind: 'idle' },
    breedCooldown: 0,
    lastHuntTick: 0,
    origin: 'starter',
    stats: {
      power: 20,
      speed: 15,
      stamina: 100,
      firepower: 10,
      armor: 10,
    },
  }
}

describe('SanctuaryDirector', () => {
  it('synchronizes wyverns and initializes settled agent states', () => {
    const director = createSanctuaryDirector({ seed: 42 })
    const wyverns = [createMockWyvern('w1'), createMockWyvern('w2')]

    director.syncWyverns(wyverns)

    expect(director.agents.size).toBe(2)
    const agent1 = director.agents.get('w1')!
    expect(agent1).toBeDefined()
    expect(agent1.phase).toBe('settled')
    expect(agent1.airborne).toBe(false)
    expect(director.getVisual('w1').state).toBe('idle')
  })

  it('removes removed wyverns from agent tracking on sync', () => {
    const director = createSanctuaryDirector({ seed: 42 })
    const wyverns = [createMockWyvern('w1'), createMockWyvern('w2')]
    director.syncWyverns(wyverns)
    expect(director.agents.size).toBe(2)

    director.syncWyverns([wyverns[0]!])
    expect(director.agents.size).toBe(1)
    expect(director.agents.has('w2')).toBe(false)
    expect(director.visuals['w2']).toBeUndefined()
  })

  it('handles takeoff command and transitions to circle flight', () => {
    const director = createSanctuaryDirector({ seed: 42 })
    const wyvern = createMockWyvern('w1')
    director.syncWyverns([wyvern])

    const mockCommandsCtx = {
      setStatus: vi.fn(),
      movePlayer: vi.fn(),
      clearPlayerInteraction: vi.fn(),
    }

    director.dispatchCommand(
      {
        wyvernId: 'w1',
        kind: 'takeOff',
        token: 1,
      },
      [wyvern],
      [],
      mockCommandsCtx,
    )

    const agent = director.agents.get('w1')!
    expect(agent.phase).toBe('takeoff')
    expect(director.getVisual('w1').state).toBe('fly')

    // Step through takeoff duration in frame increments
    for (let t = 0; t < TAKEOFF_SECONDS + 0.5; t += 0.05) {
      director.step(0.05, { playerPosition: [0, 0] }, [wyvern], mockCommandsCtx)
    }

    expect(agent.airborne).toBe(true)
    expect(agent.phase).toBe('circle')
    expect(agent.position.y).toBeCloseTo(TRANSIT_ALTITUDE, 0)
  })

  it('transitions from airborne flight to landing on land command', () => {
    const director = createSanctuaryDirector({ seed: 42 })
    const wyvern = createMockWyvern('w1')
    director.syncWyverns([wyvern])
    const agent = director.agents.get('w1')!

    const mockCommandsCtx = {
      setStatus: vi.fn(),
      movePlayer: vi.fn(),
      clearPlayerInteraction: vi.fn(),
    }

    // Put into circle flight
    director.dispatchCommand({ wyvernId: 'w1', kind: 'circle', token: 1 }, [wyvern], [], mockCommandsCtx)
    for (let t = 0; t < TAKEOFF_SECONDS + 0.5; t += 0.05) {
      director.step(0.05, { playerPosition: [0, 0] }, [wyvern], mockCommandsCtx)
    }
    expect(agent.airborne).toBe(true)

    // Command land
    director.dispatchCommand({ wyvernId: 'w1', kind: 'land', token: 2 }, [wyvern], [], mockCommandsCtx)
    expect(agent.phase).toBe('transit') // transits to target perch first

    // Step until reaching destination and starting landing
    for (let i = 0; i < 30; i++) {
      director.step(0.1, { playerPosition: [0, 0] }, [wyvern], mockCommandsCtx)
      if (agent.phase === 'landing') break
    }

    expect(agent.phase).toBe('landing')

    // Complete landing
    director.step(LAND_SECONDS + 0.5, { playerPosition: [0, 0] }, [wyvern], mockCommandsCtx)
    expect(agent.phase).toBe('settled')
    expect(agent.airborne).toBe(false)
    expect(agent.position.y).toBe(0)
  })

  it('rejects takeoff for hatchlings with proper status message', () => {
    const director = createSanctuaryDirector({ seed: 42 })
    const hatchling = createMockWyvern('w1', 'hatchling')
    director.syncWyverns([hatchling])

    const setStatus = vi.fn()
    director.dispatchCommand(
      { wyvernId: 'w1', kind: 'takeOff', token: 1 },
      [hatchling],
      [],
      { setStatus, movePlayer: vi.fn(), clearPlayerInteraction: vi.fn() },
    )

    expect(setStatus).toHaveBeenCalledWith('Hatchlings are not ready to take off.')
    const agent = director.agents.get('w1')!
    expect(agent.phase).toBe('settled')
  })

  it('steps ambient idle schedule deterministically', () => {
    const director = createSanctuaryDirector({ seed: 12345 })
    const wyvern = createMockWyvern('w1')
    director.syncWyverns([wyvern])
    const agent = director.agents.get('w1')!

    // Step beyond ambient dwell
    director.step(10, { playerPosition: [0, 0] }, [wyvern])

    expect(agent.ambientRoll).toBeGreaterThan(0)
    expect(agent.ambientAction).not.toBeNull()
  })

  it('weights ambient idles based on nearby placed sanctuary props', () => {
    const director = createSanctuaryDirector({ seed: 999 })
    const wyvern = createMockWyvern('w1')
    director.syncWyverns([wyvern])
    const agent = director.agents.get('w1')!

    // Place a trough right next to the wyvern
    const placedProps = [
      {
        propId: 'prop.forge.trough',
        position: [agent.position.x, 0, agent.position.z] as [number, number, number],
      },
    ]

    director.step(10, { playerPosition: [0, 0], placedObjects: placedProps }, [wyvern])

    expect(agent.ambientRoll).toBeGreaterThan(0)
    expect(agent.ambientAction).not.toBeNull()
  })
})
