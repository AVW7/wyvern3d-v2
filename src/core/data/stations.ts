import type { TrainingStationDef } from '../types'

/**
 * Each station trades a different stat against time and food. Bond gain is
 * what makes the flight ring worth its long duration — bond is the stat that
 * decides whether a wyvern actually obeys you mid-battle.
 */
export const STATIONS: Record<string, TrainingStationDef> = {
  huntingPen: {
    id: 'huntingPen',
    name: 'Hunting Pen',
    stat: 'power',
    duration: 30,
    gain: 3,
    bond: 2,
    cost: { food: 40 },
  },
  flightRing: {
    id: 'flightRing',
    name: 'Flight Ring',
    stat: 'speed',
    duration: 26,
    gain: 3,
    bond: 5,
    cost: { food: 30 },
  },
  burnRange: {
    id: 'burnRange',
    name: 'Burn Range',
    stat: 'firepower',
    duration: 34,
    gain: 3,
    bond: 1,
    cost: { food: 30, arcane: 2 },
  },
  enduranceRun: {
    id: 'enduranceRun',
    name: 'Endurance Run',
    stat: 'stamina',
    duration: 28,
    gain: 3,
    bond: 2,
    cost: { food: 45 },
  },
  scaleForge: {
    id: 'scaleForge',
    name: 'Scale Forge',
    stat: 'armor',
    duration: 36,
    gain: 3,
    bond: 1,
    cost: { food: 25, ore: 25 },
  },
}

export const STATION_LIST = Object.values(STATIONS)
