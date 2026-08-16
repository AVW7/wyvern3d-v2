import type { WyvernSpecies } from '../types'

/**
 * Species are the collection axis: each region drops eggs of its native
 * species, so conquering outward is what widens the roster.
 */
export const SPECIES: Record<string, WyvernSpecies> = {
  emberback: {
    id: 'emberback',
    name: 'Emberback',
    color: '#d4562a',
    tier: 1,
    baseStats: { power: 22, speed: 26, stamina: 30, firepower: 24, armor: 16 },
    growth: { power: 2.4, speed: 1.8, stamina: 2.2, firepower: 2.6, armor: 1.4 },
    traitPool: ['hotblooded', 'loyal', 'skittish'],
  },
  cragwing: {
    id: 'cragwing',
    name: 'Cragwing',
    color: '#7d8a99',
    tier: 2,
    baseStats: { power: 30, speed: 18, stamina: 34, firepower: 18, armor: 30 },
    growth: { power: 3.0, speed: 1.1, stamina: 2.6, firepower: 1.6, armor: 2.8 },
    traitPool: ['stonehide', 'stubborn', 'loyal'],
  },
  mirefang: {
    id: 'mirefang',
    name: 'Mirefang',
    color: '#5d7a4a',
    tier: 2,
    baseStats: { power: 26, speed: 30, stamina: 26, firepower: 28, armor: 18 },
    growth: { power: 2.2, speed: 2.8, stamina: 1.9, firepower: 2.9, armor: 1.5 },
    traitPool: ['venomous', 'skittish', 'hotblooded'],
  },
  thornwing: {
    id: 'thornwing',
    name: 'Thornwing',
    color: '#688c4a',
    tier: 2,
    baseStats: { power: 29, speed: 34, stamina: 25, firepower: 22, armor: 17 },
    growth: { power: 2.7, speed: 3.1, stamina: 1.9, firepower: 2.1, armor: 1.4 },
    traitPool: ['skittish', 'venomous', 'loyal'],
  },
  frostmaw: {
    id: 'frostmaw',
    name: 'Frostmaw',
    color: '#6fa8c9',
    tier: 3,
    baseStats: { power: 34, speed: 24, stamina: 38, firepower: 32, armor: 26 },
    growth: { power: 3.1, speed: 1.9, stamina: 3.0, firepower: 3.2, armor: 2.2 },
    traitPool: ['stonehide', 'loyal', 'ancient'],
  },
  duskwyrm: {
    id: 'duskwyrm',
    name: 'Duskwyrm',
    color: '#6b4a8a',
    tier: 4,
    baseStats: { power: 40, speed: 34, stamina: 36, firepower: 42, armor: 24 },
    growth: { power: 3.6, speed: 3.0, stamina: 2.8, firepower: 3.8, armor: 2.0 },
    traitPool: ['ancient', 'venomous', 'stubborn'],
  },
}
