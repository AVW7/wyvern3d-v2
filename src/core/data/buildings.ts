import type { BuildingDef } from '../types'

/**
 * Buildings exist to convert resources into *slots*. Slots are the real
 * constraint in the raising loop — you always have more wyverns than places
 * to train or incubate them, so every assignment is a choice.
 */
export const BUILDINGS: Record<string, BuildingDef> = {
  hatchery: {
    id: 'hatchery',
    name: 'Hatchery',
    description: 'Warm roosts. Each level adds an incubation slot.',
    maxLevel: 4,
    costPerLevel: [
      { timber: 60, ore: 20 },
      { timber: 140, ore: 60, gold: 80 },
      { timber: 260, ore: 140, gold: 200, arcane: 10 },
      { timber: 420, ore: 260, gold: 400, arcane: 30 },
    ],
    capacityPerLevel: [1, 2, 3, 4],
  },
  trainingGrounds: {
    id: 'trainingGrounds',
    name: 'Training Grounds',
    description: 'Pens and lures. Each level adds a training slot.',
    maxLevel: 4,
    costPerLevel: [
      { timber: 80, gold: 40 },
      { timber: 180, gold: 120, ore: 40 },
      { timber: 320, gold: 280, ore: 120, arcane: 15 },
      { timber: 500, gold: 500, ore: 240, arcane: 40 },
    ],
    capacityPerLevel: [1, 2, 3, 4],
  },
  barracks: {
    id: 'barracks',
    name: 'Barracks',
    description: 'Quarters for your armies. Each level raises the squad cap.',
    maxLevel: 4,
    costPerLevel: [
      { timber: 70, gold: 60 },
      { timber: 160, gold: 160, ore: 50 },
      { timber: 300, gold: 340, ore: 150 },
      { timber: 480, gold: 620, ore: 300, arcane: 25 },
    ],
    capacityPerLevel: [2, 4, 6, 8],
  },
  infirmary: {
    id: 'infirmary',
    name: 'Infirmary',
    description: 'Salves and splints. Each level speeds injury recovery.',
    maxLevel: 3,
    costPerLevel: [
      { timber: 50, arcane: 5 },
      { timber: 150, gold: 120, arcane: 20 },
      { timber: 300, gold: 300, arcane: 50 },
    ],
    capacityPerLevel: [1, 2, 3],
  },
}

export const BUILDING_LIST = Object.values(BUILDINGS)
