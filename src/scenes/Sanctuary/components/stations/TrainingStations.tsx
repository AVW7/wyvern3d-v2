'use client'

import { Prop } from '@/render/assets/props'
import { emissiveFor } from '../../atmosphere/fireSources'
import type { StationHeroProps } from './types'

const TAU = Math.PI * 2

/**
 * 1. Hunting Pen Hero Station: Palisade combat training arena stockade.
 * Replaces the isolated roadblock with a circular training pen and obstacle dummies.
 */
export function HuntingPenHeroStation({
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
}: StationHeroProps) {
  const fences = ['prop.fenceA', 'prop.fenceB']
  const count = Math.round((TAU * 4.6) / 1.8)

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {/* Palisade fence enclosure with entrance gap facing east toward campus spine */}
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * TAU
        // Gate clearance on keep-facing side [2.4, 3.9] rad
        if (angle > 2.4 && angle < 3.9) return null
        return (
          <Prop
            key={i}
            id={fences[i % fences.length]!}
            position={[Math.cos(angle) * 4.6, 0, Math.sin(angle) * 4.6]}
            rotationY={-angle + Math.PI / 2}
          />
        )
      })}
      {/* Obstacle hurdle trunk */}
      <Prop id="prop.perch.trunk" position={[-0.8, 0, 0.5]} rotationY={0.8} />
      {/* Strike training post stump */}
      <Prop id="prop.perch.stump" position={[1.2, 0, -1.0]} />
      {/* Carcass/feed staging pile */}
      <Prop id="prop.logPile" position={[1.4, 0, 1.6]} rotationY={-0.6} />
      {/* Trainer gear crate */}
      <Prop id="prop.crate" position={[-2.0, 0, -1.6]} rotationY={0.5} />
    </group>
  )
}

/**
 * 2. Burn Range Hero Station: Engineered dragon-fire proving ground.
 * Replaces the mini toy volcano with obsidian blast baffles and charred target columns.
 */
export function BurnRangeHeroStation({
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
}: StationHeroProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {/* Thermal blast deflection columns */}
      <Prop id="prop.burn.lavaColumn" position={[-3.5, 0, 3.2]} rotationY={0.9} />
      <Prop id="prop.burn.lavaColumnAlt" position={[4.2, 0, -2.4]} rotationY={-1.2} />
      {/* Scorched target tree stumps */}
      <Prop id="prop.burn.burnedTree" position={[-2.8, 0, -3.6]} rotationY={2.1} />
      <Prop id="prop.burn.burnedTreeAlt" position={[3.6, 0, 3.8]} rotationY={-0.7} />
      {/* Glowing basalt slag stones */}
      <Prop
        id="prop.burn.lavaStone"
        position={[0, 0, 2.0]}
        rotationY={1.4}
        emissive={emissiveFor('prop.burn.lavaStone')}
      />
      <Prop
        id="prop.burn.lavaStone"
        position={[2.4, 0, -1.5]}
        rotationY={-2.3}
        scale={0.8}
        emissive={emissiveFor('prop.burn.lavaStone')}
      />
      {/* Impact target rock */}
      <Prop id="prop.perch.rockB" position={[-0.5, 0, -3.0]} scale={0.75} rotationY={0.6} />
    </group>
  )
}

/**
 * 3. Endurance Run Hero Station: Highland mountain trailhead archway & cairn.
 * Replaces the small signpost with an imposing trailhead gateway.
 */
export function EnduranceRunHeroStation({
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
}: StationHeroProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {/* Trailhead Gateway Arch Uprights */}
      <Prop id="prop.ring.columnA" position={[-1.8, 0, 0]} rotationY={0.3} />
      <Prop id="prop.ring.columnB" position={[1.8, 0, 0]} rotationY={-0.3} />
      {/* Mountain Trail Guidance Sign */}
      <Prop id="prop.signpost" position={[1.6, 0, 1.2]} rotationY={-2.0} />
      {/* Milestone Waypoint Cairn */}
      <Prop id="prop.scatter.mysticStone" position={[-2.2, 0, 1.0]} rotationY={0.8} />
      {/* Ascent stone flagstone path */}
      <Prop id="prop.pathA" position={[0, 0, 0.8]} castShadow={false} />
      <Prop id="prop.pathB" position={[0.8, 0, -1.6]} rotationY={0.5} castShadow={false} />
      <Prop id="prop.pathA" position={[-1.2, 0, -3.2]} rotationY={1.2} castShadow={false} />
      {/* Rest log beside start apron */}
      <Prop id="prop.perch.trunk" position={[-3.0, 0, -1.0]} rotationY={0.9} />
    </group>
  )
}

/**
 * 4. Flight Ring Hero Station: Processional standing monolith ring.
 */
export function FlightRingHeroStation({
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
}: StationHeroProps) {
  const columns = ['prop.ring.columnA', 'prop.ring.columnB', 'prop.ring.columnC']

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * TAU
        return (
          <Prop
            key={i}
            id={columns[i % columns.length]!}
            position={[Math.cos(angle) * 5.4, 0, Math.sin(angle) * 5.4]}
            rotationY={-angle}
          />
        )
      })}
      {Array.from({ length: 4 }, (_, i) => {
        const angle = (i / 4) * TAU + 0.5
        return (
          <Prop
            key={`menhir-${i}`}
            id={i % 2 === 0 ? 'prop.ring.menhir' : 'prop.ring.menhirAlt'}
            position={[Math.cos(angle) * 3.2, 4.4 + (i % 3) * 0.7, Math.sin(angle) * 3.2]}
            rotationY={angle}
          />
        )
      })}
    </group>
  )
}
