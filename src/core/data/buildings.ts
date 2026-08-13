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
  farm: {
    id: 'farm',
    name: 'Sanctuary Farm',
    description: 'Crop fields and grain silos. Consumes water and labor to grow food.',
    maxLevel: 4,
    costPerLevel: [
      { timber: 50, gold: 30 },
      { timber: 120, gold: 80, water: 40 },
      { timber: 220, gold: 180, water: 100 },
      { timber: 380, gold: 320, water: 200, arcane: 10 },
    ],
    capacityPerLevel: [4, 8, 12, 16],
  },
  aqueduct: {
    id: 'aqueduct',
    name: 'Well & Aqueduct',
    description: 'Stone wells and mountain runoff pipes. Collects fresh water per tick.',
    maxLevel: 4,
    costPerLevel: [
      { timber: 40, ore: 30 },
      { timber: 100, ore: 70, gold: 50 },
      { timber: 180, ore: 150, gold: 120 },
      { timber: 300, ore: 280, gold: 250, arcane: 15 },
    ],
    capacityPerLevel: [4, 8, 12, 16],
  },
  pasture: {
    id: 'pasture',
    name: 'Wildlife Pasture',
    description: 'Livestock pens. Houses and breeds deer, boar, and goats for food and hides.',
    maxLevel: 4,
    costPerLevel: [
      { timber: 60, gold: 40 },
      { timber: 140, gold: 100, hide: 10 },
      { timber: 250, gold: 200, hide: 25 },
      { timber: 400, gold: 350, hide: 50, arcane: 20 },
    ],
    capacityPerLevel: [5, 10, 15, 20],
  },
  foundry: {
    id: 'foundry',
    name: 'Iron Foundry',
    description: 'Smelters and forging anvils. Converts raw ore into refined iron and coins.',
    maxLevel: 4,
    costPerLevel: [
      { timber: 80, ore: 50 },
      { timber: 160, ore: 120, gold: 100 },
      { timber: 300, ore: 250, gold: 220, iron: 20 },
      { timber: 480, ore: 420, gold: 400, iron: 50, arcane: 30 },
    ],
    capacityPerLevel: [2, 4, 6, 8],
  },
  sawmill: {
    id: 'sawmill',
    name: 'Lumber Sawmill',
    description: 'Woodworking lodge. Speeds timber processing and produces building planks.',
    maxLevel: 3,
    costPerLevel: [
      { timber: 40, gold: 30 },
      { timber: 100, gold: 80, ore: 20 },
      { timber: 200, gold: 180, ore: 50 },
    ],
    capacityPerLevel: [2, 4, 6],
  },
  housing: {
    id: 'housing',
    name: 'Villager Cottages',
    description: 'Quarters for sanctuary population. Increases worker capacity.',
    maxLevel: 4,
    costPerLevel: [
      { timber: 50, gold: 30 },
      { timber: 110, gold: 70 },
      { timber: 200, gold: 150 },
      { timber: 350, gold: 280, iron: 15 },
    ],
    capacityPerLevel: [8, 16, 24, 32],
  },
  academy: {
    id: 'academy',
    name: 'Philosophy Academy',
    description: 'Lyceum of ancient scrolls. Unlocks treatises and governance philosophies.',
    maxLevel: 3,
    costPerLevel: [
      { timber: 100, gold: 80, arcane: 20 },
      { timber: 220, gold: 200, arcane: 60 },
      { timber: 400, gold: 400, arcane: 120 },
    ],
    capacityPerLevel: [1, 2, 3],
  },
  apothecary: {
    id: 'apothecary',
    name: 'Healing Apothecary',
    description: 'Herbal gardens and potion cauldrons. Crafts vitality salves and healing elixirs.',
    maxLevel: 3,
    costPerLevel: [
      { timber: 80, water: 60, arcane: 15 },
      { timber: 180, water: 150, arcane: 40 },
      { timber: 320, water: 300, arcane: 80 },
    ],
    capacityPerLevel: [2, 4, 6],
  },
  blacksmith: {
    id: 'blacksmith',
    name: 'Armory Forge',
    description: 'Dragon-scale blacksmith forge. Crafts wyvern armor, flame spears, and iron shields.',
    maxLevel: 3,
    costPerLevel: [
      { timber: 90, ore: 60, iron: 20 },
      { timber: 200, ore: 160, iron: 50, gold: 100 },
      { timber: 350, ore: 300, iron: 100, gold: 250 },
    ],
    capacityPerLevel: [2, 4, 6],
  },
}

export const BUILDING_LIST = Object.values(BUILDINGS)
