'use client'

import { useEffect, useRef } from 'react'
import { useCameraStore } from '@/state/cameraStore'
import { CharacterController, type Collider, type CharacterState } from '@/render/controllers/CharacterController'
import { PlayerCharacter } from '@/render/player/PlayerCharacter'
import type { CharacterGesture } from '@/render/placeholders/PlaceholderProps'
import { useSanctuaryCommands } from '@/state/sanctuaryCommands'
import { BIOME_WORLD_RADIUS, biomeHeightAt } from './terrain/BiomeTerrain'

/**
 * The walkable half of a biome region: the same third-person character the
 * sanctuary uses, dropped into the expedition terrain. The controller samples
 * the biome's relief every frame, so the player walks over the ground instead
 * of through it.
 */
export function BiomeExplorer({
  biome,
  regionId,
  seed = 42,
  colliders,
  spawn,
}: {
  biome: string
  regionId?: string
  seed?: number
  colliders: Collider[]
  spawn: [number, number]
}) {
  const moving = useRef(false)
  const gesture = useRef<CharacterGesture>('none')
  const locomotion = useSanctuaryCommands((commands) => commands.playerLocomotion)

  const groundHeightAt = (x: number, z: number) => biomeHeightAt(biome, x, z, regionId, seed)

  // The world map leaves its own distance and follow target in the shared
  // camera store; without this the expedition opens ~100 m out, with the player
  // a speck. Snap back to the sanctuary's over-the-shoulder framing.
  useEffect(() => {
    useCameraStore.getState().applyPreset('default')
  }, [])

  // Guarded setter: it only writes when the locomotion label actually changes,
  // so this per-frame callback does not re-render the HUD every frame.
  const onUpdate = (character: CharacterState) => {
    moving.current = character.moving
    useSanctuaryCommands.getState().setPlayerLocomotion(
      character.running ? 'run' : character.moving ? 'walk' : 'idle',
    )
    // Published for the discovery director's proximity checks; the setter is
    // change-guarded so this per-frame write never re-renders subscribers.
    useSanctuaryCommands
      .getState()
      .setPlayerPosition([character.position.x, character.position.z])
  }

  return (
    <CharacterController
      spawn={[spawn[0], groundHeightAt(spawn[0], spawn[1]), spawn[1]]}
      colliders={colliders}
      bounds={BIOME_WORLD_RADIUS - 12}
      groundHeightAt={groundHeightAt}
      onUpdate={onUpdate}
    >
      <PlayerCharacter
        locomotion={locomotion}
        gesture="none"
        movingRef={moving}
        gestureRef={gesture}
      />
    </CharacterController>
  )
}
