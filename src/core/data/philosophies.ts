import type { PhilosophyId, Resources } from '../types'

export interface PhilosophyDef {
  id: PhilosophyId
  name: string
  subtitle: string
  description: string
  icon: string
  researchCost: Partial<Resources>
  researchDurationTicks: number
  effectDescription: string
}

export const PHILOSOPHIES: Record<PhilosophyId, PhilosophyDef> = {
  balance: {
    id: 'balance',
    name: 'Philosophy of Balance',
    subtitle: 'Harmonious Coexistence',
    description: 'Ancient teachings emphasizing equilibrium between human settlement, wild beasts, and nature.',
    icon: '☯️',
    researchCost: { arcane: 50, food: 100 },
    researchDurationTicks: 40,
    effectDescription: '+15% resource production yields across all biomes and -20% wyvern hunger accumulation rate.',
  },
  dominion: {
    id: 'dominion',
    name: 'Ethics of Dominion',
    subtitle: 'Sovereignty & Order',
    description: 'Codified laws of realm authority establishing strong garrison protocols and disciplined military drills.',
    icon: '👑',
    researchCost: { arcane: 80, gold: 150 },
    researchDurationTicks: 60,
    effectDescription: '+20% squad attack/defense power and +10% unrest suppression rate in conquered regions.',
  },
  stoicism: {
    id: 'stoicism',
    name: 'Stoic Endurance',
    subtitle: 'Fortitude of Mind',
    description: 'Mental and physical conditioning principles taught to withstand campaign hardship and trauma.',
    icon: '🏛️',
    researchCost: { arcane: 60, water: 120 },
    researchDurationTicks: 50,
    effectDescription: '+25% infirmary healing speed and injured wyverns retain high bond loyalty during recovery.',
  },
  hermetics: {
    id: 'hermetics',
    name: 'Dragon-Bonded Hermetics',
    subtitle: 'Arcane Lineage',
    description: 'Esoteric manuscripts detailing deep elemental resonance and wyvern lineage imprinting secret rites.',
    icon: '📜',
    researchCost: { arcane: 150, iron: 50 },
    researchDurationTicks: 80,
    effectDescription: '+30% egg incubation speed and unlocks elemental affinity bonuses for dragon battle stats.',
  },
}

export const PHILOSOPHY_LIST: PhilosophyDef[] = Object.values(PHILOSOPHIES)
