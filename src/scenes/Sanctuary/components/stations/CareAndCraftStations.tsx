'use client'

import { Prop } from '@/render/assets/props'
import { emissiveFor } from '../../atmosphere/fireSources'
import { useSanctuaryColors } from '@/state/sanctuaryColorsStore'
import { InteractiveTrough } from '../interactive/InteractiveTrough'
import { InteractiveAnvil } from '../interactive/InteractiveAnvil'
import { InteractiveHatcheryNest } from '../interactive/InteractiveHatcheryNest'
import type { StationHeroProps } from './types'

/**
 * 1. Scale Forge Hero Station: Armory chimney furnace & smithing yard.
 */
export function ScaleForgeHeroStation({
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
}: StationHeroProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <Prop
        id="prop.forge.furnace"
        position={[0, 0, 0]}
        emissive={emissiveFor('prop.forge.furnace')}
      />
      <Prop id="prop.forge.chimney" position={[1.7, 0, -0.2]} />
      <Prop id="prop.forge.toolHolder" position={[-1.9, 0, 0.8]} rotationY={Math.PI / 2} />
      <Prop id="prop.forge.sign" position={[2.2, 0, 3.4]} rotationY={-0.6} />
      <InteractiveAnvil position={[0, 0, 2.2]} scale={0.55} rotationY={0.4} isWorking />
      <InteractiveTrough position={[-1.8, 0, 2.0]} isQuenching />
      <Prop id="prop.forge.grindstone" position={[1.8, 0, 1.8]} rotationY={-0.5} />
    </group>
  )
}

/**
 * 2. Hatchery Hero Station: Thermal brood cave entrance & ember hearth.
 */
export function HatcheryHeroStation({
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
}: StationHeroProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <InteractiveHatcheryNest
        position={[0, 0, 0]}
        rotationY={Math.PI}
        scale={0.75}
      />
      <Prop
        id="prop.torch"
        position={[-3.4, 0, 3.6]}
        emissive={emissiveFor('prop.torch')}
      />
      <Prop
        id="prop.torch"
        position={[3.4, 0, 3.6]}
        emissive={emissiveFor('prop.torch')}
      />
    </group>
  )
}

/**
 * 3. Breeding Roosts Hero Station: Twin elevated mating rock plateaus.
 */
export function BreedingHeroStation({
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
}: StationHeroProps) {
  const roost = useSanctuaryColors((s) => s.roost)
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <Prop id="prop.roost.plateau" position={[0, 0, 0]} color={roost} />
      <Prop id="prop.roost.plateau" position={[7.2, 0, 0.6]} rotationY={-1.5} color={roost} />
      <Prop id="prop.roost.runeStone" position={[0, 0, -3.2]} />
      <Prop id="prop.roost.runeStone" position={[7.2, 0, 3.4]} rotationY={0.9} />
    </group>
  )
}
