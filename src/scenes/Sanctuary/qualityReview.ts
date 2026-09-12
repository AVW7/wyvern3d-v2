import type { SanctuaryStationId } from '@/core/data/sanctuarySpatialContract'

/** Must remain in parity with Studio's Sanctuary review preset. */
export const SANCTUARY_REVIEW_SEED = 120_024
export const SANCTUARY_REVIEW_VIEWS = {
  keepGate: { station: 'warTable', anchor: 'keep-gate', camera: [0, 5.5, -17], target: [0, 1.4, -29] },
  hatchery: { station: 'hatchery', anchor: 'incubation-cave', camera: [14, 5, -14], target: [22, 1.4, -6] },
  flightRing: { station: 'flightRing', anchor: 'ring-center', camera: [0, 8, 12], target: [0, 1, 24] },
  forge: { station: 'scaleForge', anchor: 'forge-furnace', camera: [34, 5, -6], target: [42, 1.5, -14] },
  breedingRoost: { station: 'breeding', anchor: 'roost-plateau', camera: [22, 6, 5], target: [30, 1.5, 14] },
  juvenileRoost: { station: 'hatchery', anchor: 'juvenile-roost', camera: [29, 3.5, -12], target: [22, 1, -4] },
} as const satisfies Record<string, { station: SanctuaryStationId; anchor: string; camera: readonly [number, number, number]; target: readonly [number, number, number] }>

export const SANCTUARY_REVIEW_BUDGET = { maxDrawCalls: 220, maxTriangles: 180_000, maxInitialLoadMs: 4_000, maxFrameMs: 22 } as const
