'use client'

import { Prop } from '@/render/assets/props'
import { emissiveFor } from '../../atmosphere/fireSources'
import { useGameState } from '@/state/store'
import type { SanctuaryPlacedObject } from '@/core/types'
import {
  BarracksHeroStation,
  InfirmaryHeroStation,
  RosterHeroStation,
  WarTableHeroStation,
} from './KeepStations'
import {
  BurnRangeHeroStation,
  EnduranceRunHeroStation,
  FlightRingHeroStation,
  HuntingPenHeroStation,
} from './TrainingStations'
import {
  BreedingHeroStation,
  HatcheryHeroStation,
  ScaleForgeHeroStation,
} from './CareAndCraftStations'

/**
 * Dynamic Sanctuary layout objects rendered from GameState.
 */
export function DynamicSanctuaryObjects() {
  const state = useGameState()
  const objects = state.sanctuaryLayout?.objects

  if (!objects || objects.length === 0) return null

  return (
    <group userData={{ sanctuaryAttackBlocker: true }}>
      {objects.map((object) => (
        <DynamicSanctuaryObject key={object.id} object={object} />
      ))}
    </group>
  )
}

/**
 * All 11 functional sanctuary stations render with dedicated hero assemblies.
 * Placed props/furniture keep their ordinary catalog prop.
 */
export function DynamicSanctuaryObject({ object }: { object: SanctuaryPlacedObject }) {
  const heroProps = {
    position: object.position,
    rotationY: object.rotationY,
    scale: object.scale ?? 1,
  }

  switch (object.id) {
    case 'barracks':
      return <BarracksHeroStation {...heroProps} />
    case 'infirmary':
      return <InfirmaryHeroStation {...heroProps} />
    case 'huntingPen':
      return <HuntingPenHeroStation {...heroProps} />
    case 'burnRange':
      return <BurnRangeHeroStation {...heroProps} />
    case 'enduranceRun':
      return <EnduranceRunHeroStation {...heroProps} />
    case 'warTable':
      return <WarTableHeroStation {...heroProps} />
    case 'roster':
      return <RosterHeroStation {...heroProps} />
    case 'scaleForge':
      return <ScaleForgeHeroStation {...heroProps} />
    case 'hatchery':
      return <HatcheryHeroStation {...heroProps} />
    case 'breeding':
      return <BreedingHeroStation {...heroProps} />
    case 'flightRing':
      return <FlightRingHeroStation {...heroProps} />
    default:
      return (
        <group position={object.position} rotation={[0, object.rotationY, 0]}>
          <Prop
            id={object.propId}
            position={[0, 0, 0]}
            scale={object.scale ?? 1}
            emissive={emissiveFor(object.propId)}
          />
        </group>
      )
  }
}
