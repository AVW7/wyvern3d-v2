/** Compatibility facade. The spatial contract is the canonical source. */
export {
  SANCTUARY_SPATIAL_CONTRACT as SANCTUARY_STATIONS,
  sanctuaryPosition,
  sanctuaryPosition3,
  type SanctuaryStationContract as SanctuaryStationDefinition,
  type SanctuaryStationId,
  type SanctuaryStationPanel,
} from './sanctuarySpatialContract'

import type { SanctuaryStationId } from './sanctuarySpatialContract'

/** Version-1 positions, retained solely to migrate existing saves. */
export const LEGACY_SANCTUARY_STATION_POSITIONS = {
  warTable: [0, -30], roster: [-9, -30], barracks: [9, -30], infirmary: [-13, -22],
  hatchery: [16, -6], breeding: [24, 4], huntingPen: [-18, 2], flightRing: [-4, 14],
  burnRange: [14, 18], enduranceRun: [-24, 16], scaleForge: [26, -14],
} as const satisfies Record<SanctuaryStationId, readonly [number, number]>
