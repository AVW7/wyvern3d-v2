'use client'

import { WorldLabel } from '@/render/labels/WorldLabel'
import { GROUND_DECAL } from '../../groundDecal'
import type { getInteractables } from '../../layout'

export function getStationSubtitle(id: string, panel?: string): string {
  switch (id) {
    case 'warTable':
      return 'Command Center'
    case 'roster':
      return 'Roster Ledger'
    case 'barracks':
      return 'Troop Quarters'
    case 'infirmary':
      return 'Healing Sanctuary'
    case 'hatchery':
      return 'Brood Cave'
    case 'breeding':
      return 'Breeding Roosts'
    case 'huntingPen':
      return 'Hunting Grounds'
    case 'flightRing':
      return 'Flight Arena'
    case 'burnRange':
      return 'Firepower Range'
    case 'enduranceRun':
      return 'Stamina Trail'
    case 'scaleForge':
      return 'Armory Forge'
    default:
      return panel === 'training' ? 'Training Ground' : 'Sanctuary Facility'
  }
}

/** Floating labels and ground decal rings so the player can find stations. */
export function InteractableMarkers({
  interactables,
}: {
  interactables: ReturnType<typeof getInteractables>
}) {
  return (
    <group>
      {interactables.map((item) => {
        const subtitle = getStationSubtitle(item.id, item.panel)
        return (
          <group key={item.id} position={[item.position[0], 0, item.position[1]]}>
            {/* Outer Ground Ring */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} renderOrder={2}>
              <ringGeometry args={[item.radius - 0.35, item.radius, 32]} />
              <meshBasicMaterial {...GROUND_DECAL} color="#f0d9a8" opacity={0.4} />
            </mesh>
            {/* Inner Accent Ring */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} renderOrder={3}>
              <ringGeometry args={[item.radius - 0.7, item.radius - 0.55, 32]} />
              <meshBasicMaterial {...GROUND_DECAL} color="#d4af37" opacity={0.25} />
            </mesh>
            {/* Floating Station Plaque Label */}
            <WorldLabel
              text={item.label}
              subtitle={subtitle}
              variant="station"
              position={[0, 3.8, 0]}
              size={1.5}
              color="#fff4e0"
            />
          </group>
        )
      })}
    </group>
  )
}
