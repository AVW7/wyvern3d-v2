import type { UnitType } from '../types'

/**
 * A rock-paper-scissors triangle: spears beat cavalry, archers beat spears,
 * cavalry beats archers. Siege is slow, outranges everything, and is what
 * actually cracks a fortified garrison — wyverns alone can't hold ground.
 */
export const UNITS: Record<string, UnitType> = {
  spearman: {
    id: 'spearman',
    name: 'Spearman',
    color: '#8a7a5c',
    tier: 1,
    attack: 1.0,
    defense: 1.2,
    range: 3,
    speed: 7,
    strongAgainst: ['rider'],
    cost: { gold: 40, timber: 20 },
    upkeep: 0.5,
  },
  archer: {
    id: 'archer',
    name: 'Archer',
    color: '#6b8a5c',
    tier: 1,
    attack: 1.3,
    defense: 0.7,
    range: 26,
    speed: 7,
    // The only ground unit that meaningfully threatens a wyvern in the air.
    strongAgainst: ['spearman'],
    cost: { gold: 55, timber: 30 },
    upkeep: 0.7,
  },
  rider: {
    id: 'rider',
    name: 'Rider',
    color: '#8a5c5c',
    tier: 2,
    attack: 1.6,
    defense: 1.0,
    range: 4,
    speed: 14,
    strongAgainst: ['archer'],
    cost: { gold: 90, food: 60, ore: 20 },
    upkeep: 1.2,
  },
  siege: {
    id: 'siege',
    name: 'Siege Engine',
    color: '#5c5c6b',
    tier: 3,
    attack: 2.4,
    defense: 0.6,
    range: 40,
    speed: 3,
    strongAgainst: [],
    cost: { gold: 140, timber: 90, ore: 70 },
    upkeep: 1.8,
  },
}

export const UNIT_LIST = Object.values(UNITS)
