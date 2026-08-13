import { describe, expect, it } from 'vitest'

import { ASSETS, type ClipSpec, type ModelState } from './manifest'

const ALL_MODEL_STATES = [
  'idle',
  'fly',
  'airborne',
  'attack',
  'attackAir',
  'walk',
  'run',
  'death',
  'hop',
  'breathe',
  'breatheAir',
  'rest',
  'land',
  'sleep',
  'sit',
  'seated',
  'rise',
  'eat',
  'huntGrip',
  'huntCarry',
  'huntFinish',
  'drink',
  'groom',
  'perch',
  'cruise',
  'scout',
  'speed',
  'glide',
  'dive',
  'bankLeft',
  'bankRight',
  'hover',
  'nuzzle',
  'calm',
  'offer',
  'pet',
  'inspect',
  'pickUp',
  'drop',
] satisfies ModelState[]

const IDLE_STATES: ModelState[] = [
  'idle',
  'rest',
  'sleep',
  'sit',
  'seated',
  'rise',
  'eat',
  'drink',
  'groom',
  'perch',
  'nuzzle',
  'calm',
  'offer',
  'pet',
  'inspect',
]
const WALK_STATES: ModelState[] = ['walk', 'run', 'hop']
const CRUISE_STATES: ModelState[] = [
  'airborne',
  'huntCarry',
  'cruise',
  'scout',
  'speed',
  'glide',
  'dive',
  'bankLeft',
  'bankRight',
  'hover',
]
const ATTACK_STATES: ModelState[] = [
  'attack',
  'attackAir',
  'breathe',
  'breatheAir',
  'huntGrip',
  'huntFinish',
  'pickUp',
  'drop',
]
const GROUND_ATTACK_STATES: ModelState[] = [
  'attack',
  'breathe',
  'huntGrip',
  'huntFinish',
  'pickUp',
]
const AIR_ATTACK_STATES: ModelState[] = ['attackAir', 'breatheAir', 'drop']

const thornwing = ASSETS['wyvern.thornwing']!

function specFor(state: ModelState): ClipSpec {
  const mapped = thornwing.animations[state]
  if (!mapped || Array.isArray(mapped)) {
    throw new Error(`wyvern.thornwing.${state} must map to exactly one clip`)
  }
  return mapped
}

describe('Thornwing manifest', () => {
  it('loads the playable GLB at its approved runtime fit', () => {
    expect(thornwing.url).toBe('/models/thornwing.glb')
    expect(thornwing.scale).toBe(6)
    expect(thornwing.yOffset).toBe(0)
  })

  it('covers every ModelState without introducing clips outside the seven-clip slice', () => {
    const mappedStates = Object.keys(thornwing.animations)
    expect(new Set(mappedStates).size).toBe(ALL_MODEL_STATES.length)
    expect(mappedStates.sort()).toEqual([...ALL_MODEL_STATES].sort())

    const sourceClips = new Set(ALL_MODEL_STATES.map((state) => specFor(state).clip))
    expect([...sourceClips].sort()).toEqual([
      'attack',
      'cruise',
      'death',
      'idle',
      'land',
      'takeoff',
      'walk',
    ])
  })

  it('uses intentional loop reuse for social, ground-movement, and flight states', () => {
    for (const state of IDLE_STATES) {
      expect(specFor(state)).toMatchObject({ clip: 'idle', yOffset: 0 })
    }
    for (const state of WALK_STATES) {
      expect(specFor(state)).toMatchObject({ clip: 'walk', yOffset: 0 })
    }
    for (const state of CRUISE_STATES) {
      expect(specFor(state)).toMatchObject({
        clip: 'cruise',
        phaseGroup: 'thornwing-flight',
        yOffset: 0,
      })
    }
  })

  it('chains takeoff and landing while keeping every action-channel alias one-shot', () => {
    expect(specFor('fly')).toEqual({ clip: 'takeoff', loop: false, next: 'cruise', yOffset: 0 })
    expect(specFor('land')).toEqual({ clip: 'land', loop: false, next: 'idle', yOffset: 0 })
    expect(specFor('death')).toEqual({ clip: 'death', loop: false, yOffset: 0 })

    for (const state of GROUND_ATTACK_STATES) {
      expect(specFor(state)).toEqual({ clip: 'attack', loop: false, yOffset: 0 })
    }
    for (const state of AIR_ATTACK_STATES) {
      expect(specFor(state)).toEqual({
        clip: 'attack',
        loop: false,
        yOffset: -1.052532,
        fadeIn: 0.16,
      })
    }
    for (const state of ATTACK_STATES) {
      expect(specFor(state).loop).toBe(false)
    }
  })
})
