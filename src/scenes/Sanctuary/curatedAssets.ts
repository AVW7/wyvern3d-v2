import { FLIGHT_CORRIDOR, SANCTUARY_SPATIAL_CONTRACT, type SanctuaryVisualRole } from '@/core/data/sanctuarySpatialContract'

/** Runtime-safe, measured assets. Unlisted library assets remain preview-only. */
export interface CuratedAssetSpec {
  id: string
  url: string
  dimensions: readonly [number, number, number]
  pivot: 'bottom-center'
  forward: '+z' | '-z'
  triangles: number
  bytes: number
  collision: readonly [number, number, number]
  animation: 'none' | 'idle' | 'locomotion'
  roles: readonly SanctuaryVisualRole[]
  priority: 'initial' | 'nearby' | 'deferred'
}

export const CURATED_SANCTUARY_ASSETS: Record<string, CuratedAssetSpec> = {
  // Atlas-backed placeholders are intentionally not represented here. A GLB is
  // promoted only after measurement and can then use this adapter unchanged.
}

export function canPromoteCanonicalAsset(spec: CuratedAssetSpec, role: SanctuaryVisualRole): string | null {
  if (spec.triangles > 25_000) return `${spec.id}: triangle budget exceeded`
  if (spec.bytes > 3_000_000) return `${spec.id}: byte budget exceeded`
  if (!spec.roles.includes(role)) return `${spec.id}: role ${role} is not allowed`
  if (spec.pivot !== 'bottom-center' || !spec.collision.every((value) => value > 0)) return `${spec.id}: pivot or collision proxy is invalid`
  return null
}

export function validateSanctuaryVisualAnchors(): string[] {
  const errors: string[] = []
  for (const [id, station] of Object.entries(SANCTUARY_SPATIAL_CONTRACT)) {
    for (const anchor of station.visualAnchors) {
      const x = station.position[0] + anchor.position[0]
      const z = station.position[1] + anchor.position[2]
      if (x > FLIGHT_CORRIDOR.minX && x < FLIGHT_CORRIDOR.maxX && z > FLIGHT_CORRIDOR.minZ && z < FLIGHT_CORRIDOR.maxZ && station.zone !== 'keepCourt' && !anchor.flightApproved) errors.push(`${id}:${anchor.name} blocks the flight corridor`)
    }
  }
  return errors
}
