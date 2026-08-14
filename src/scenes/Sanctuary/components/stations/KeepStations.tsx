'use client'

import { Prop } from '@/render/assets/props'
import { emissiveFor } from '../../atmosphere/fireSources'
import type { StationHeroProps } from './types'

/**
 * 1. War Table Hero Station: Command stone plinth and council table.
 */
export function WarTableHeroStation({
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
}: StationHeroProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {/* Raised stone foundation */}
      <Prop id="prop.keep.floorC" position={[0, 0, 0]} castShadow={false} />
      {/* Strategic War Table */}
      <Prop id="prop.warTable" position={[0, 0, 0]} scale={1.8} />
      {/* Command Council Torches */}
      <Prop
        id="prop.torch"
        position={[-2.6, 0, 0]}
        emissive={emissiveFor('prop.torch')}
      />
      <Prop
        id="prop.torch"
        position={[2.6, 0, 0]}
        emissive={emissiveFor('prop.torch')}
      />
      {/* Campaign Map & Archive Chest */}
      <Prop id="prop.chest" position={[0, 0, -2.2]} rotationY={Math.PI} />
    </group>
  )
}

/**
 * 2. Roster Ledger Hero Station: Wyvern registry alcove.
 */
export function RosterHeroStation({
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
}: StationHeroProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <Prop id="prop.keep.floorA" position={[0, 0, 0]} castShadow={false} />
      <Prop id="prop.lectern" position={[0, 0, 0]} scale={1.1} rotationY={0.2} />
      <Prop id="prop.chest" position={[-1.4, 0, -0.8]} rotationY={-0.4} />
      <Prop
        id="prop.torch"
        position={[1.4, 0, 0.8]}
        emissive={emissiveFor('prop.torch')}
      />
    </group>
  )
}

/**
 * 3. Barracks Hero Station: Fortified troop quarters & guard post.
 * Replaces the spiked blockade with a credible garrison shelter.
 */
export function BarracksHeroStation({
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
}: StationHeroProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {/* Stone floor footing plinth */}
      <Prop id="prop.keep.floorA" position={[0, 0, 0]} castShadow={false} />
      {/* Rear protective dwarf wall */}
      <Prop id="prop.keep.wallAlt" position={[0, 0, -1.8]} rotationY={0} scale={0.7} />
      {/* Weapon & halberd rack */}
      <Prop id="prop.forge.toolHolder" position={[-1.4, 0, -0.6]} rotationY={Math.PI / 2} />
      {/* Heavy garrison equipment chest */}
      <Prop id="prop.chest" position={[1.4, 0, -1.0]} rotationY={-Math.PI / 2} />
      {/* Ration barrel & supply crate */}
      <Prop id="prop.barrel" position={[1.5, 0, 0.4]} />
      <Prop id="prop.crate" position={[-1.4, 0, 0.6]} rotationY={0.4} />
      {/* Standing watch torch */}
      <Prop
        id="prop.torch"
        position={[1.8, 0, 1.2]}
        emissive={emissiveFor('prop.torch')}
      />
    </group>
  )
}

/**
 * 4. Infirmary Hero Station: Covered healer's recovery pavilion.
 * Replaces the raw ground campfire with a sheltered healing alcove.
 */
export function InfirmaryHeroStation({
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
}: StationHeroProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {/* Clean stone platform */}
      <Prop id="prop.keep.floorB" position={[0, 0, 0]} castShadow={false} />
      {/* Warmth & cautery brazier */}
      <Prop
        id="prop.campfire"
        position={[0, 0, -0.6]}
        emissive={emissiveFor('prop.campfire')}
      />
      {/* Clean water / herbal wash trough */}
      <Prop id="prop.forge.trough" position={[-1.5, 0, 0.4]} rotationY={Math.PI / 2} />
      {/* Healer's examination stump */}
      <Prop id="prop.perch.stump" position={[1.3, 0, -0.4]} />
      {/* Firewood fuel stack */}
      <Prop id="prop.logPile" position={[-1.5, 0, -1.2]} rotationY={-0.4} />
      {/* Medicine & bandage supply box */}
      <Prop id="prop.crate" position={[1.4, 0, 0.8]} rotationY={0.3} />
      {/* Night lantern torch */}
      <Prop
        id="prop.torch"
        position={[-1.8, 0, 1.2]}
        emissive={emissiveFor('prop.torch')}
      />
    </group>
  )
}
