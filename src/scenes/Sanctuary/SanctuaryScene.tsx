'use client'

import { useEffect, useMemo, useRef } from 'react'
import { CharacterController, type CharacterState } from '@/render/controllers/CharacterController'
import {
  PlaceholderEgg,
  type CharacterGesture,
} from '@/render/placeholders/PlaceholderProps'
import { Prop, PropInstances } from '@/render/assets/props'
import { BIOME_PROP_ATLAS } from '@/render/assets/manifest'
import { CONTROLS, isDown } from '@/render/controllers/input'
import { useGame, useGameState } from '@/state/store'
import { useUi } from '@/state/uiStore'
import { SPECIES } from '@/core/data/species'
import { getInteractables, GROUND_RADIUS, ROOSTS, buildColliders } from './layout'
import {
  BIOME_SCATTER,
  HILLS,
  KEEP_FLOOR,
  KEEP_GATE,
  KEEP_PILLARS,
  KEEP_WALLS,
  PATHS,
  SCATTER,
} from './dressing'
import { SanctuaryWyverns } from './SanctuaryWyverns'
import { SanctuaryAtmosphere } from './atmosphere/SanctuaryAtmosphere'
import { Firelight } from './atmosphere/Firelight'
import { SanctuaryWind } from './atmosphere/SanctuaryWind'
import { Ambience, SmokePlumes } from './atmosphere/Ambience'
import { SanctuaryGround } from './atmosphere/SanctuaryGround'
import { SanctuaryWaterPools } from './atmosphere/SanctuaryWater'
import { outerHeightAt } from './atmosphere/terrain'
import { useSanctuaryCommands } from '@/state/sanctuaryCommands'
import { usePlayerControlStore } from '@/state/playerControlStore'
import { useSanctuaryEditor } from '@/state/sanctuaryEditorStore'
import { useSanctuaryColors } from '@/state/sanctuaryColorsStore'
import { SanctuaryEditorControls } from './components/SanctuaryEditorControls'
import { PlayerCharacter } from '@/render/player/PlayerCharacter'
import { ProductionBuildings3D } from './components/ProductionBuildings3D'
import { AcademyAndForge3D } from './components/AcademyAndForge3D'
import { EventFlourishManager } from './events/EventFlourishManager'
import {
  DynamicSanctuaryObjects,
  InteractableMarkers,
} from './components/StationHeroBuildings'
import { useContextActionStore } from '@/state/contextActions'
import { resolveContextAction } from './context/actionResolver'
import { CarriedItem } from './CarriedItem'
import { allocateStablePerches } from './commandLogic'
import { baseFor } from './director/wyvernDirector'
import { sanctuaryAudio } from './audio/sanctuaryAudio'
import type { PanelId } from '@/state/uiStore'

/**
 * The sanctuary hub: the player's walkable base inside the keep, and the
 * wyvern grounds outside it.
 */
export function SanctuaryScene() {
  const state = useGameState()
  const colliders = useMemo(() => buildColliders(state), [state.sanctuaryLayout?.objects])
  const interactables = useMemo(() => getInteractables(state), [state.sanctuaryLayout?.objects])

  const isEditing = useSanctuaryEditor((s) => s.isEditing)
  const moving = useRef(false)
  const gesture = useRef<CharacterGesture>('none')
  const interactLatch = useRef(false)
  const playerMove = useSanctuaryCommands((commands) => commands.playerMove)
  const playerGesture = useSanctuaryCommands((commands) => commands.playerGesture)
  const playerLocomotion = useSanctuaryCommands((commands) => commands.playerLocomotion)
  const targetMode = useSanctuaryCommands((commands) => commands.targetMode)
  gesture.current = playerGesture

  const wyverns = Object.values(state.wyverns)
  const incubating = Object.values(state.eggs).filter((e) => e.incubatingTicksLeft !== null)

  useEffect(() => {
    sanctuaryAudio.startAmbience()
    return () => {
      sanctuaryAudio.dispose()
    }
  }, [])

  /**
   * Runs every frame but only touches React state when the nearest station
   * actually changes — `setNearby` is a no-op for an unchanged id.
   */
  const onCharacterUpdate = (char: CharacterState) => {
    moving.current = char.moving
    const locomotion = char.running ? 'run' : char.moving ? 'walk' : 'idle'
    useSanctuaryCommands.getState().setPlayerLocomotion(locomotion)
    sanctuaryAudio.setPlayerLocomotion(locomotion)
    sanctuaryAudio.updateListenerPosition([char.position.x, char.position.z])
    useSanctuaryCommands
      .getState()
      .setPlayerPosition([char.position.x, char.position.z])

    const perchAssignments = allocateStablePerches(
      wyverns.map((w) => w.id),
      8,
    )
    const wyvernPositions: Record<string, [number, number]> = {}
    for (const w of wyverns) {
      const basePos = baseFor(w, perchAssignments).position
      wyvernPositions[w.id] = [basePos[0], basePos[1]]
    }

    const action = resolveContextAction({
      playerPosition: [char.position.x, char.position.z],
      state,
      interactables,
      wyvernPositions,
      isEditing,
      targetMode,
    })

    useContextActionStore.getState().setCurrentAction(action)

    const ui = useUi.getState()
    ui.setNearby(
      action
        ? {
            id: action.id,
            label: action.label,
            panel: (action.panel as PanelId) ?? 'roster',
          }
        : null,
    )

    // Edge-triggered: hold E must not re-trigger every frame.
    const pressed = isDown(...CONTROLS.interact)
    if (pressed && !interactLatch.current && action && !ui.openPanel && !isEditing) {
      if (action.intent) {
        if (action.intent.type === 'TAKE_DUTY_ITEM') {
          sanctuaryAudio.playCue('collect')
        } else if (action.intent.type === 'COMPLETE_DUTY') {
          sanctuaryAudio.playCue('delivery')
        }
        useGame.getState().dispatch(action.intent)
      } else if (action.panel) {
        ui.open(action.panel as PanelId, action.station)
        if (action.panel === 'warTable') useGame.getState().setMode('worldmap')
      }
    }
    interactLatch.current = pressed
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.code === 'Tab') {
        e.preventDefault()
        const wyvernIds = Object.keys(useGame.getState().state.wyverns)
        usePlayerControlStore.getState().toggleShift(wyvernIds)
      } else if (e.code === 'Space') {
        const commands = useSanctuaryCommands.getState()
        if (commands.targetMode) {
          e.preventDefault()
          commands.cancelTarget()
        }
        if (commands.playerMove) {
          e.preventDefault()
          commands.clearPlayerInteraction()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      useSanctuaryCommands.getState().close()
      useSanctuaryCommands.getState().clearPlayerInteraction()
    }
  }, [])

  return (
    <>
      <SanctuaryAtmosphere />
      <Firelight />
      <SanctuaryWind />
      <Ambience />
      <SmokePlumes />
      <SanctuaryGround />
      <SanctuaryWaterPools />
      <Scenery />
      <KeepWalls />
      <DynamicSanctuaryObjects />
      <ProductionBuildings3D />
      <AcademyAndForge3D />

      <SanctuaryEditorControls />

      <HatcheryNests />

      {/* Eggs warming on the hatchery roost pads. */}
      {incubating.slice(0, ROOSTS.length).map((egg, i) => {
        const pad = ROOSTS[i]!
        return (
          <group key={egg.id} position={[pad[0], NEST_TOP, pad[1]]}>
            <PlaceholderEgg color={SPECIES[egg.speciesId]?.color ?? '#cbbfa8'} scale={1.4} />
          </group>
        )
      })}

      <SanctuaryWyverns
        wyverns={wyverns}
        colliders={colliders}
        placedObjects={state.sanctuaryLayout?.objects}
        seed={state.seed}
      />
      <EventFlourishManager />
      <CarriedItem />

      <InteractableMarkers interactables={interactables} />

      <group userData={{ sanctuaryAttackBlocker: true }}>
        <CharacterController
          spawn={[0, 0, 6]}
          colliders={colliders}
          bounds={GROUND_RADIUS}
          onUpdate={onCharacterUpdate}
          moveCommand={playerMove}
          onCommandArrival={(token) =>
            useSanctuaryCommands.getState().finishPlayerMove(token, 'arrived')
          }
          onCommandCancel={(token) =>
            useSanctuaryCommands.getState().finishPlayerMove(token, 'cancelled')
          }
          acceptGroundClicks={!targetMode && !isEditing}
        >
          <PlayerCharacter
            locomotion={playerLocomotion}
            gesture={playerGesture}
            movingRef={moving}
            gestureRef={gesture}
          />
        </CharacterController>
      </group>
    </>
  )
}

/** Woodland, grass and horizon hills. All instanced — see dressing.ts. */
function Scenery() {
  const soil = useSanctuaryColors((s) => s.soil)
  // The hills were authored at y=-2 against a flat plane, so that they read as
  // emerging from the ground rather than sitting on it. The outer landform now
  // rises underneath them, so keep that -2 relative to the surface instead of
  // to zero, or they sink into the new relief.
  const seatedHills = useMemo(
    () =>
      HILLS.map((hill) => ({
        ...hill,
        position: [
          hill.position[0],
          outerHeightAt(hill.position[0], hill.position[2]) - 2,
          hill.position[2],
        ] as [number, number, number],
      })),
    [],
  )

  return (
    <group userData={{ sanctuaryAttackBlocker: true }}>
      {Object.entries(SCATTER).map(([id, items]) => (
        <PropInstances
          key={id}
          id={id}
          items={items}
          // Grass tufts are too small to read as shadows and there are hundreds
          // of them; leaving them out of the shadow pass costs nothing visually.
          castShadow={!id.startsWith('prop.scatter.grass')}
          wind={WIND_STRENGTH[id]}
        />
      ))}
      {Object.entries(BIOME_SCATTER).map(([id, items]) => (
        <PropInstances
          key={id}
          id={id}
          atlas={BIOME_PROP_ATLAS}
          items={items}
          castShadow={!id.startsWith('prop.biome.grass')}
          wind={WIND_STRENGTH[id]}
        />
      ))}
      {Object.entries(PATHS).map(([id, items]) => (
        <PropInstances key={id} id={id} items={items} castShadow={false} />
      ))}
      <PropInstances id="prop.scatter.hill" items={seatedHills} color={soil} />
    </group>
  )
}

function KeepWalls() {
  return (
    <group userData={{ sanctuaryAttackBlocker: true }}>
      <PropInstances id="prop.keep.wall" items={KEEP_WALLS.wallA} />
      <PropInstances id="prop.keep.wallAlt" items={KEEP_WALLS.wallB} />
      <PropInstances id="prop.keep.pillar" items={KEEP_PILLARS} />
      <PropInstances id="prop.keep.floorA" items={KEEP_FLOOR.floorA} castShadow={false} />
      <PropInstances id="prop.keep.floorB" items={KEEP_FLOOR.floorB} castShadow={false} />
      <PropInstances id="prop.keep.floorC" items={KEEP_FLOOR.floorC} castShadow={false} />
      <Prop id="prop.keep.gate" {...KEEP_GATE} />
    </group>
  )
}

/** Height of a roost pad's top, so eggs sit on it rather than in it. */
const NEST_TOP = 0.77

/**
 * The four roost pads inside the hatchery.
 *
 * These render at absolute `ROOSTS` coordinates rather than inside the
 * hatchery's compound group, because the eggs above them do too. Keeping both
 * in the same frame of reference is what guarantees an egg is never left
 * floating over bare ground — which is exactly what happened while the only
 * reference to this prop sat in an unreachable branch.
 */
function HatcheryNests() {
  return (
    <group userData={{ sanctuaryAttackBlocker: true }}>
      {ROOSTS.map(([x, z]) => (
        <Prop key={`${x},${z}`} id="prop.hatchery.nest" position={[x, 0, z]} />
      ))}
    </group>
  )
}

/**
 * Sway amplitude per metre of height, by prop id.
 *
 * Measured heights from the atlas: grass 0.70-0.78, firA 5.17, firB 3.76,
 * firC 7.40, deadTree 5.36. Short props need a larger factor to read at all,
 * tall ones need a smaller one or their crowns visibly slide. Anything absent
 * from this table stays rigid — walls, stone and furniture must not breathe.
 */
const WIND_STRENGTH: Record<string, number> = {
  // Grass is short — 0.70-0.78 — so a modest per-metre figure works out to only
  // a few centimetres of travel and reads as nothing at gameplay camera
  // distance. It is also excluded from the shadow pass, so unlike the firs it
  // can be pushed hard for free.
  'prop.scatter.grassA': 0.32,
  'prop.scatter.grassB': 0.34,
  'prop.scatter.firA': 0.028,
  'prop.scatter.firB': 0.032,
  'prop.scatter.firC': 0.022,
  'prop.scatter.deadTree': 0.014,
  'prop.biome.grass.tuftA': 0.32,
  'prop.biome.tree.conifer': 0.024,
  'prop.biome.tree.broadleaf': 0.02,
}

