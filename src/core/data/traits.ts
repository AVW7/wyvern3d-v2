import type { Trait } from '../types'

/**
 * Traits are the breeding payoff: inherited with a per-trait roll, so a
 * deliberate pairing can concentrate the good ones over generations.
 */
export const TRAITS: Record<string, Trait> = {
  hotblooded: {
    id: 'hotblooded',
    name: 'Hot-blooded',
    description: 'Fiercer breath, but harder to settle.',
    modifiers: { firepower: 6, armor: -2 },
    bondRate: 0.85,
  },
  loyal: {
    id: 'loyal',
    name: 'Loyal',
    description: 'Bonds quickly and obeys under pressure.',
    modifiers: {},
    bondRate: 1.4,
  },
  skittish: {
    id: 'skittish',
    name: 'Skittish',
    description: 'Fast on the wing, slow to trust.',
    modifiers: { speed: 5, stamina: -3 },
    bondRate: 0.7,
  },
  stonehide: {
    id: 'stonehide',
    name: 'Stonehide',
    description: 'Thick plating that shrugs off arrows.',
    modifiers: { armor: 8, speed: -3 },
  },
  stubborn: {
    id: 'stubborn',
    name: 'Stubborn',
    description: 'Strong, but takes orders on its own schedule.',
    modifiers: { power: 6 },
    bondRate: 0.6,
  },
  venomous: {
    id: 'venomous',
    name: 'Venomous',
    description: 'Caustic breath that eats through armour.',
    modifiers: { firepower: 7, stamina: -2 },
  },
  ancient: {
    id: 'ancient',
    name: 'Ancient Blood',
    description: 'A rare lineage. Better at everything, slower to mature.',
    modifiers: { power: 5, firepower: 5, stamina: 5, armor: 3 },
    bondRate: 0.9,
  },
}
