'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Collider } from '@/render/controllers/CharacterController'
import { REGIONS, REGION_LIST, STARTING_REGION } from '@/core/data/regions'
import { useGameState, useGame } from '@/state/store'
import { usePlayerControlStore } from '@/state/playerControlStore'
import { getBiomePalette } from './atmosphere/biomePalettes'
import { BiomeTerrain } from './terrain/BiomeTerrain'
import { BiomeDressing } from './dressing/BiomeDressing'
import { GROVE_COLLIDERS } from './dressing/GroveLandmark'
import { BiomeExplorer } from './BiomeExplorer'
import { BiomeFlightActor } from './flight/BiomeFlightActor'
import { WorldLabel } from '@/render/labels/WorldLabel'

/**
 * Where the player lands when they enter a region. Negative Z with the default
 * camera yaw puts the region's centre landmark straight ahead, and the radius
 * sits between the grove's trunk collider and its stone ring, so the arrival
 * frame is never a fir tree in the player's face.
 */
const SPAWN: [number, number] = [0, -18]

export function BiomeScene() {
  const state = useGameState()
  const selectedRegion = useGame((s) => s.selectedRegion)

  const regionId = selectedRegion ?? STARTING_REGION
  const regionDef = REGIONS[regionId] ?? REGION_LIST[0]!
  const biome = regionDef.biome

  const palette = useMemo(() => getBiomePalette(biome), [biome])
  const activeWyvern = useMemo(() => Object.values(state.wyverns)[0], [state.wyverns])
  const controlMode = usePlayerControlStore((control) => control.controlMode)
  // The grove's landmark measures its own footprint once its GLB loads; until
  // then the placeholder box keeps the player out of the trunk. This is a
  // load-time swap, not a per-frame one, so React state is the right home.
  const [measured, setMeasured] = useState<Collider[] | null>(null)
  const colliders = useMemo(
    () => (biome === 'grove' ? measured ?? GROVE_COLLIDERS : []),
    [biome, measured],
  )
  const onColliders = useCallback((next: Collider[]) => setMeasured(next), [])

  useEffect(() => setMeasured(null), [biome])

  // The expedition starts on foot; Tab shifts between the explorer and the
  // wyvern, exactly as it does in the sanctuary.
  useEffect(() => {
    usePlayerControlStore.getState().shiftToHuman()
    const handleKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (event.code !== 'Tab') return
      event.preventDefault()
      usePlayerControlStore.getState().toggleShift(Object.keys(useGame.getState().state.wyverns))
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      usePlayerControlStore.getState().shiftToHuman()
    }
  }, [])

  return (
    <>
      {/* Lighting & Fog */}
      <hemisphereLight
        args={[palette.hemiSky, palette.hemiGround, palette.hemiIntensity]}
      />
      <directionalLight
        position={palette.sunPosition}
        intensity={palette.sunIntensity}
        color={palette.sunColor}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-120}
        shadow-camera-right={120}
        shadow-camera-top={120}
        shadow-camera-bottom={-120}
      />
      <fog attach="fog" args={[palette.fogColor, palette.fogNear, palette.fogFar]} />
      <color attach="background" args={[palette.background]} />

      {/* Procedural Biome Terrain */}
      <BiomeTerrain biome={biome} />

      {/* Biome Scatter Props */}
      <BiomeDressing biome={biome} onColliders={onColliders} />

      {/* Region Landmark Title Banner */}
      <WorldLabel
        position={[0, 26, 0]}
        text={`${regionDef.name} — ${regionDef.biome.toUpperCase()} REALM`}
        size={4.2}
        color={palette.accentColor}
      />

      {/*
        One of these owns the camera at a time — mounting both would leave two
        `useFrame` callbacks fighting over `camera.position` every frame.
      */}
      {controlMode === 'human' || !activeWyvern ? (
        <BiomeExplorer biome={biome} colliders={colliders} spawn={SPAWN} />
      ) : (
        <BiomeFlightActor wyvern={activeWyvern} />
      )}
    </>
  )
}
