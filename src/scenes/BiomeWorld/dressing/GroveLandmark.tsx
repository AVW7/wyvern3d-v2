'use client'

import { useCallback, useMemo } from 'react'
import type { Group } from 'three'
import { GameModel } from '@/render/assets/GameModel'
import { PropInstances, type PropPlacement } from '@/render/assets/props'
import type { Collider } from '@/render/controllers/CharacterController'
import { biomeHeightAt } from '../terrain/BiomeTerrain'
import { footprintColliders } from './groveColliders'

/** Standing stones ring the clearing, so the grove reads as an old sanctuary. */
const STONE_COUNT = 9
const STONE_RADIUS = 26
/** Trunk footprint the player walks around rather than through. */
const TRUNK_HALF_WIDTH = 4.5

function stoneRing(): PropPlacement[] {
  return Array.from({ length: STONE_COUNT }, (_, index) => {
    const angle = (index / STONE_COUNT) * Math.PI * 2 + 0.16
    const x = Math.cos(angle) * STONE_RADIUS
    const z = Math.sin(angle) * STONE_RADIUS
    return {
      position: [x, biomeHeightAt('grove', x, z), z],
      rotationY: -angle,
      scale: 1.6 + ((index * 13) % 7) / 10,
    }
  })
}

/** How high off the ground still blocks the player, and the footprint grid. */
const BLOCKING_HEIGHT = 1.4
/** Buried root runs deeper than this are underground and do not block. */
const BLOCKING_DEPTH = 0.4
const FOOTPRINT_CELL = 2

const STONE_COLLIDERS: Collider[] = Array.from({ length: STONE_COUNT }, (_, index) => {
  const angle = (index / STONE_COUNT) * Math.PI * 2 + 0.16
  return {
    x: Math.cos(angle) * STONE_RADIUS,
    z: Math.sin(angle) * STONE_RADIUS,
    halfW: 0.9,
    halfD: 0.9,
  }
})

/**
 * Standing colliders before the tree GLB has loaded — a plain box around the
 * trunk. Once it loads, `GroveLandmark` replaces the trunk box with the model's
 * measured footprint.
 */
export const GROVE_COLLIDERS: Collider[] = [
  { x: 0, z: 0, halfW: TRUNK_HALF_WIDTH, halfD: TRUNK_HALF_WIDTH },
  ...STONE_COLLIDERS,
]

/**
 * The Elderroot Grove's hero: a 34 m world tree on the central mound, ringed by
 * standing stones. The tree is a static GLB, so it goes through `GameModel`
 * rather than the instanced scenery atlas.
 */
export function GroveLandmark({
  onColliders,
}: {
  /** Called once with the tree's measured footprint, plus the stone ring. */
  onColliders?: (colliders: Collider[]) => void
}) {
  const stones = useMemo(stoneRing, [])
  const groundY = biomeHeightAt('grove', 0, 0)

  const onReady = useCallback(
    (root: Group) => {
      onColliders?.([
        ...footprintColliders(root, {
          groundY,
          maxHeight: BLOCKING_HEIGHT,
          maxDepth: BLOCKING_DEPTH,
          cell: FOOTPRINT_CELL,
        }),
        ...STONE_COLLIDERS,
      ])
    },
    [onColliders, groundY],
  )

  return (
    <group>
      <group position={[0, groundY, 0]}>
        <GameModel
          id="library.ancientTree"
          state="idle"
          onReady={onReady}
          fallback={
            <mesh position={[0, 12, 0]} castShadow>
              <coneGeometry args={[10, 24, 8]} />
              <meshStandardMaterial color="#4a5f2c" roughness={0.9} />
            </mesh>
          }
        />
      </group>
      <PropInstances id="prop.scatter.mysticStone" items={stones} castShadow />
    </group>
  )
}
