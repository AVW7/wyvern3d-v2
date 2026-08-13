'use client'

import { useEffect, useMemo, useRef } from 'react'
import { WorldLabel } from '@/render/labels/WorldLabel'
import { CharacterController, type CharacterState } from '@/render/controllers/CharacterController'
import {
  PlaceholderEgg,
  type CharacterGesture,
} from '@/render/placeholders/PlaceholderProps'
import { Prop, PropInstances } from '@/render/assets/props'
import { CONTROLS, isDown } from '@/render/controllers/input'
import { useGame, useGameState } from '@/state/store'
import { useUi } from '@/state/uiStore'
import { SPECIES } from '@/core/data/species'
import { getInteractables, GROUND_RADIUS, ROOSTS, buildColliders } from './layout'
import {
  HILLS,
  KEEP_FLOOR,
  KEEP_GATE,
  KEEP_PILLARS,
  KEEP_WALLS,
  PATHS,
  SCATTER,
} from './dressing'
import { SanctuaryWyverns } from './SanctuaryWyverns'
import { GROUND_DECAL } from './groundDecal'
import { SanctuaryAtmosphere } from './atmosphere/SanctuaryAtmosphere'
import { Firelight } from './atmosphere/Firelight'
import { SanctuaryWind } from './atmosphere/SanctuaryWind'
import { Ambience, SmokePlumes } from './atmosphere/Ambience'
import { SanctuaryGround } from './atmosphere/SanctuaryGround'
import { outerHeightAt } from './atmosphere/terrain'
import { emissiveFor } from './atmosphere/fireSources'
import { useSanctuaryCommands } from '@/state/sanctuaryCommands'
import { usePlayerControlStore } from '@/state/playerControlStore'
import { useSanctuaryEditor } from '@/state/sanctuaryEditorStore'
import { useSanctuaryColors } from '@/state/sanctuaryColorsStore'
import { SanctuaryEditorControls } from './components/SanctuaryEditorControls'
import { sanctuaryPosition3 } from '@/core/data/sanctuaryStations'
import { SanctuaryPlacedObject } from '@/core/types'
import { PlayerCharacter } from '@/render/player/PlayerCharacter'
import { ProductionBuildings3D } from './components/ProductionBuildings3D'
import { AcademyAndForge3D } from './components/AcademyAndForge3D'

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

  /**
   * Runs every frame but only touches React state when the nearest station
   * actually changes — `setNearby` is a no-op for an unchanged id.
   */
  const onCharacterUpdate = (char: CharacterState) => {
    moving.current = char.moving
    useSanctuaryCommands.getState().setPlayerLocomotion(
      char.running ? 'run' : char.moving ? 'walk' : 'idle',
    )
    useSanctuaryCommands
      .getState()
      .setPlayerPosition([char.position.x, char.position.z])

    let closest: (typeof interactables)[number] | null = null
    let closestDist = Infinity
    for (const item of interactables) {
      const d = Math.hypot(char.position.x - item.position[0], char.position.z - item.position[1])
      if (d <= item.radius && d < closestDist) {
        closestDist = d
        closest = item
      }
    }

    const ui = useUi.getState()
    ui.setNearby(
      closest ? { id: closest.id, label: closest.label, panel: closest.panel } : null,
    )

    // Edge-triggered: hold E must not re-open the panel every frame.
    const pressed = isDown(...CONTROLS.interact)
    if (pressed && !interactLatch.current && closest && !ui.openPanel && !isEditing) {
      ui.open(closest.panel, closest.station)
      if (closest.panel === 'warTable') useGame.getState().setMode('worldmap')
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
      <Scenery />
      <KeepWalls />
      <DynamicObjects />
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

      <SanctuaryWyverns wyverns={wyverns} colliders={colliders} seed={state.seed} />

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
}

const TAU = Math.PI * 2


/**
 * Dynamic Sanctuary layout objects rendered from GameState.
 */
function DynamicObjects() {
  const state = useGameState()
  const objects = state.sanctuaryLayout?.objects

  if (!objects || objects.length === 0) return null

  return (
    <group userData={{ sanctuaryAttackBlocker: true }}>
      {objects.map((object) => (
        <DynamicObject key={object.id} object={object} />
      ))}
    </group>
  )
}

/**
 * Training landmarks are compound silhouettes, even though the editor moves
 * each one as a single object. Other structures keep their ordinary catalog
 * prop so existing player-authored layouts remain backward-compatible.
 */
function DynamicObject({ object }: { object: SanctuaryPlacedObject }) {
  const groupProps: StationGroupProps = {
    position: object.position,
    rotationY: object.rotationY,
    scale: object.scale ?? 1,
  }

  switch (object.id) {
    case 'burnRange':
      return <BurnRange {...groupProps} />
    case 'flightRing':
      return <FlightRing {...groupProps} />
    case 'huntingPen':
      return <HuntingPen {...groupProps} />
    case 'enduranceRun':
      return <EnduranceRun {...groupProps} />
    case 'scaleForge':
      return <ScaleForge {...groupProps} />
    case 'breeding':
      return <BreedingRoosts {...groupProps} />
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

/**
 * The forge's fixed furniture. The anvil, trough and grindstone are separate
 * placed objects the player can rearrange; these three are part of the
 * building's silhouette and travel with the station itself.
 */
function ScaleForge({
  position = sanctuaryPosition3('scaleForge'),
  rotationY = 0,
  scale = 1,
}: StationGroupProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <Prop id="prop.forge.furnace" position={[0, 0, 0]} emissive={emissiveFor('prop.forge.furnace')} />
      <Prop id="prop.forge.chimney" position={[1.7, 0, -0.2]} />
      <Prop id="prop.forge.toolHolder" position={[-1.9, 0, 0.8]} rotationY={Math.PI / 2} />
      <Prop id="prop.forge.sign" position={[2.2, 0, 3.4]} rotationY={-0.6} />
    </group>
  )
}

interface StationGroupProps {
  position?: [number, number, number]
  rotationY?: number
  scale?: number
}

/** Scorched ground under a dead volcano — where wyverns practise their breath. */
function BurnRange({
  position = sanctuaryPosition3('burnRange'),
  rotationY = 0,
  scale = 1,
}: StationGroupProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <Prop
        id="prop.burn.volcano"
        position={[2, 0, 9]}
        rotationY={0.6}
        emissive={emissiveFor('prop.burn.volcano')}
      />
      <Prop id="prop.burn.lavaColumn" position={[-5.5, 0, 2.5]} rotationY={0.9} />
      <Prop id="prop.burn.lavaColumnAlt" position={[5.8, 0, -1.5]} rotationY={-1.2} />
      <Prop id="prop.burn.burnedTree" position={[-3.4, 0, -4.2]} rotationY={2.1} />
      <Prop id="prop.burn.burnedTreeAlt" position={[4.6, 0, 4.4]} rotationY={-0.7} />
      <Prop
        id="prop.burn.lavaStone"
        position={[-1.6, 0, 4.6]}
        rotationY={1.4}
        emissive={emissiveFor('prop.burn.lavaStone')}
      />
      <Prop
        id="prop.burn.lavaStone"
        position={[2.8, 0, -4.8]}
        rotationY={-2.3}
        scale={0.8}
        emissive={emissiveFor('prop.burn.lavaStone')}
      />
    </group>
  )
}

/**
 * A ring of standing stones with menhirs hanging above it — the only place in
 * the sanctuary where something is deliberately off the ground, to read as the
 * spot where wyverns are flown.
 */
function FlightRing({
  position = sanctuaryPosition3('flightRing'),
  rotationY = 0,
  scale = 1,
}: StationGroupProps) {
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

/**
 * The breeding station is a pair of plateaus, not one. Both are tinted from the
 * editor's roost colour, which had no renderer at all while this component was
 * unreachable.
 */
function BreedingRoosts({
  position = sanctuaryPosition3('breeding'),
  rotationY = 0,
  scale = 1,
}: StationGroupProps) {
  const roost = useSanctuaryColors((s) => s.roost)
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <Prop id="prop.roost.plateau" position={[0, 0, 0]} color={roost} />
      <Prop id="prop.roost.plateau" position={[7.2, 0, 0.6]} rotationY={-1.5} color={roost} />
    </group>
  )
}

function HuntingPen({
  position = sanctuaryPosition3('huntingPen'),
  rotationY = 0,
  scale = 1,
}: StationGroupProps) {
  const fences = ['prop.fenceA', 'prop.fenceB']
  // The fence prop is 1.86 m wide; step the ring by a shade less so the posts meet.
  const count = Math.round((TAU * 4.6) / 1.8)

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * TAU
        // Leave a gap on the keep-facing side so the pen reads as enterable.
        if (angle > 2.5 && angle < 3.8) return null
        return (
          <Prop
            key={i}
            id={fences[i % fences.length]!}
            position={[Math.cos(angle) * 4.6, 0, Math.sin(angle) * 4.6]}
            rotationY={-angle + Math.PI / 2}
          />
        )
      })}
      <Prop id="prop.blockade" position={[0, 0, 0]} rotationY={0.6} />
      <Prop id="prop.logPile" position={[-2.2, 0, 2.4]} rotationY={-0.5} />
    </group>
  )
}

function EnduranceRun({
  position = sanctuaryPosition3('enduranceRun'),
  rotationY = 0,
  scale = 1,
}: StationGroupProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <Prop id="prop.signpost" position={[0, 0, -3.4]} rotationY={0.4} />
      <Prop id="prop.signpost" position={[3.8, 0, 3.2]} rotationY={-2.2} />
      <Prop id="prop.pathA" position={[0, 0, 0]} />
      <Prop id="prop.pathB" position={[3.4, 0, 1.2]} rotationY={0.5} />
      <Prop id="prop.pathA" position={[-3.2, 0, 2.4]} rotationY={1.2} />
      <Prop id="prop.perch.trunk" position={[-3.6, 0, -2.6]} rotationY={0.9} />
    </group>
  )
}

function getStationSubtitle(id: string, panel?: string): string {
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

/** Floating labels so the player can find the stations without a tutorial. */
function InteractableMarkers({ interactables }: { interactables: ReturnType<typeof getInteractables> }) {
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
