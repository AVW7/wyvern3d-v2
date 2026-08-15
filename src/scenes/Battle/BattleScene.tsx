'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  Color,
  InstancedMesh,
  Object3D,
  Vector3,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
} from 'three'
import { WorldLabel } from '@/render/labels/WorldLabel'
import type { Actor, PilotInput } from '@/core/combat/types'
import type { EncounterSim } from '@/core/combat/encounter'
import { createEncounter } from '@/core/combat/encounter'
import { buildEncounterConfig } from '@/core/combat/setup'
import { CONFIG } from '@/core/data/config'
import { SPECIES } from '@/core/data/species'
import { UNITS } from '@/core/data/units'
import { PlaceholderWyvern } from '@/render/placeholders/PlaceholderWyvern'
import { BreathVFX } from '@/render/vfx/BreathVFX'
import { GameModel, type ModelActionRequest } from '@/render/assets/GameModel'
import type { ModelState } from '@/render/assets/manifest'
import { createWyvernFlightRig, type WyvernFlightRig } from '@/render/wyvernFlightRig'
import { GroundDustVFX } from '@/render/vfx/GroundDustVFX'
import { CameraShake } from '@/render/cameraShake'
import { CONTROLS, axis, isDown, pointer } from '@/render/controllers/input'
import { useCameraStore } from '@/state/cameraStore'
import {
  angleDelta,
  flightAnimationState,
  type FlightLoopState,
} from '@/render/flightPose'
import { getGameState, useGame, useGameState } from '@/state/store'
import { useBattle } from './battleStore'

/** Visual soldiers drawn per squad, regardless of troop count. */
const VISUALS_PER_SQUAD = 10
const ARENA = CONFIG.battle.arenaRadius

/**
 * The playable battle.
 *
 * The encounter sim lives in a ref and is stepped at a fixed dt inside
 * useFrame. Nothing about actor positions ever enters React state — meshes are
 * mutated directly each frame. The only React updates here are discrete
 * events: the battle ending, the command overlay opening, and an actor
 * switching animation state.
 */
export function BattleScene() {
  const state = useGameState()
  const dispatch = useGame((s) => s.dispatch)
  const setMode = useGame((s) => s.setMode)
  const setup = state.pendingBattle

  const sim = useRef<EncounterSim | null>(null)
  const accumulator = useRef(0)
  const settled = useRef(false)
  const tameLatch = useRef(false)

  // Built once per staged battle. World state is read through getGameState()
  // rather than the reactive `state` on purpose: `state` changes every tick,
  // and depending on it would rebuild — and so restart — the fight mid-flight.
  const encounter = useMemo(() => {
    if (!setup) return null
    return createEncounter(buildEncounterConfig(getGameState(), setup))
  }, [setup])

  useEffect(() => {
    sim.current = encounter
    accumulator.current = 0
    settled.current = false
    useBattle.getState().reset()

    // Dev-only handle for inspecting a live fight from the console:
    //   __wyvern.actors.map(a => [a.id, a.hp, a.position])
    // Balance problems are very hard to diagnose from the outside otherwise.
    if (process.env.NODE_ENV !== 'production') {
      ;(window as unknown as { __wyvern?: EncounterSim | null }).__wyvern = encounter
    }
  }, [encounter])

  useFrame((_, rawDelta) => {
    const active = sim.current
    if (!active || settled.current) return

    const dt = Math.min(rawDelta, 0.1)
    accumulator.current += dt

    // Fixed-step the sim so battle outcomes never depend on frame rate. This
    // is the same step size auto-resolve uses.
    const step = CONFIG.battle.step
    let steps = 0
    while (accumulator.current >= step && steps < 8) {
      accumulator.current -= step
      active.setPilotInput(readPilotInput())
      active.step(step)
      steps++
    }

    // Mirror a little sim state into the battle store for the HUD, but only
    // when it actually changes — this runs every frame.
    const piloted = active.piloted
    useBattle.getState().sync({
      time: active.time,
      hp: piloted ? piloted.hp / piloted.maxHp : 0,
      stamina: piloted ? piloted.stamina / piloted.maxStamina : 0,
      enemiesLeft: active.actors.filter((a) => a.alive && a.side === 'defender').length,
      alliesLeft: active.actors.filter((a) => a.alive && a.side === 'attacker').length,
      canTame: active.canTame(),
    })

    // --- command layer -----------------------------------------------------
    const battle = useBattle.getState()

    const order = battle.consumeOrder()
    if (order) active.issueOrder(order.allyId, { kind: 'attack', targetId: order.targetId })

    const broadcast = battle.consumeBroadcast()
    if (broadcast) {
      for (const ally of active.actors) {
        if (ally.side !== 'attacker' || !ally.alive || ally === active.piloted) continue
        active.issueOrder(
          ally.id,
          broadcast.kind === 'regroup'
            ? { kind: 'regroup' }
            : broadcast.kind === 'hold'
              ? { kind: 'hold' }
              : null,
        )
      }
    }

    // Edge-triggered so holding the key doesn't burn every tame candidate.
    const tamePressed = isDown(...CONTROLS.tame)
    if (tamePressed && !tameLatch.current && active.canTame()) {
      const ok = active.attemptTame()
      battle.setMessage(ok ? 'The wyvern submits!' : 'It breaks away — the moment is lost.')
    }
    tameLatch.current = tamePressed

    if (active.outcome !== 'ongoing') {
      settled.current = true
      dispatch({ type: 'RESOLVE_BATTLE', result: active.result() })
      setMode('worldmap')
    }
  })

  if (!setup || !encounter) return null

  return (
    <>
      <BattleLighting />
      <Terrain />
      <BattleCamera sim={sim} />
      <Actors sim={encounter} />
    </>
  )
}

/** Cursor distance from centre that counts as neutral. */
const DEAD_ZONE = 0.18

function readPilotInput(): PilotInput {
  return {
    throttle: axis([...CONTROLS.forward], [...CONTROLS.back]),
    // Mouse steers relative to screen centre — no pointer lock needed, which
    // keeps the browser out of the way. The dead zone matters: without it the
    // wyvern is always climbing or diving because the cursor is never exactly
    // centred, and level flight becomes impossible. R/F override for keyboard.
    pitch: isDown(...CONTROLS.climb)
      ? 1
      : isDown(...CONTROLS.descend)
        ? -1
        : withDeadZone(pointer.y) * 1.2,
    yaw: axis([...CONTROLS.right], [...CONTROLS.left]) || withDeadZone(pointer.x),
    breathing: isDown(...CONTROLS.breath),
    diving: isDown(...CONTROLS.dive),
  }
}

const clampUnit = (v: number): number => (v < -1 ? -1 : v > 1 ? 1 : v)

/** Rescales so the axis reads 0 inside the dead zone and 1 at the screen edge. */
function withDeadZone(value: number): number {
  const magnitude = Math.abs(value)
  if (magnitude <= DEAD_ZONE) return 0
  const scaled = (magnitude - DEAD_ZONE) / (1 - DEAD_ZONE)
  return clampUnit(scaled) * Math.sign(value)
}

/** Chase camera behind the piloted wyvern, or a wide shot if there isn't one. */
function BattleCamera({ sim }: { sim: React.RefObject<EncounterSim | null> }) {
  const camera = useThree((s) => s.camera)
  const desired = useRef(new Vector3())
  const look = useRef(new Vector3())
  const shake = useRef(new CameraShake())

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    const piloted = sim.current?.piloted
    const camSettings = useCameraStore.getState()

    if ('fov' in camera && typeof camera.fov === 'number' && camera.fov !== camSettings.fov) {
      camera.fov = camSettings.fov
      camera.updateProjectionMatrix()
    }

    if (piloted?.hitThisTick) {
      shake.current.addTrauma(0.35)
    }

    if (!piloted?.alive) {
      desired.current.set(0, 90, ARENA * 1.1)
      look.current.set(0, 0, 0)
    } else {
      // The authored cruise pose trails the full tail behind the body instead
      // of dropping it vertically like hover/takeoff. Keep the chase camera
      // beyond that silhouette at the runtime model scale.
      const back = 105
      const up = 32
      desired.current.set(
        piloted.position.x - Math.sin(piloted.yaw) * back,
        piloted.position.y + up,
        piloted.position.z - Math.cos(piloted.yaw) * back,
      )
      look.current.set(
        piloted.position.x + Math.sin(piloted.yaw) * 14,
        piloted.position.y,
        piloted.position.z + Math.cos(piloted.yaw) * 14,
      )
    }

    const shakeOffset = shake.current.update(dt, state.clock.elapsedTime)
    const targetCamPos = desired.current.clone().add(shakeOffset)
    camera.position.lerp(targetCamPos, 1 - Math.exp(-camSettings.smoothing * dt))
    camera.lookAt(look.current)
  })

  return null
}

/** Renders every actor and syncs transforms from the sim each frame. */
function Actors({ sim }: { sim: EncounterSim }) {
  const wyverns = sim.actors.filter((a) => a.kind === 'wyvern')
  const squads = sim.actors.filter((a) => a.kind === 'troop')

  return (
    <>
      {wyverns.map((actor, i) => (
        <WyvernActorView key={actor.id} actor={actor} index={i} piloted={actor === sim.piloted} />
      ))}
      {squads.map((actor) => (
        <SquadActorView key={actor.id} actor={actor} />
      ))}
    </>
  )
}

/** Distance beyond which a non-piloted wyvern's mixer stops advancing. */
const MIXER_FREEZE_DISTANCE = 150
/** Hit-flash timing — a bare emissiveIntensity pulse, no shader. */
/**
 * How long an `approach`/`retreat` AI intent keeps counting as "trying to go
 * fast" after it stops being reported. `updateAi` has no hysteresis at its
 * range boundary, so without this the sprint loop follows it frame for frame.
 */
const BOOST_LATCH_SECONDS = 0.5

const HIT_FLASH_SECONDS = 0.12
const HIT_FLASH_PEAK = 2.5

/** Walks a cloned model's meshes and collects their materials for direct mutation. */
function collectMaterials(root: Group): MeshStandardMaterial[] {
  const materials: MeshStandardMaterial[] = []
  root.traverse((child) => {
    const mesh = child as Mesh
    if (!mesh.isMesh) return
    const slots = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const slot of slots) materials.push(slot as MeshStandardMaterial)
  })
  return materials
}

function WyvernActorView({ actor, index, piloted }: { actor: Actor; index: number; piloted: boolean }) {
  const group = useRef<Group>(null)
  const lastYaw = useRef(actor.yaw)
  const rig = useRef<WyvernFlightRig>(createWyvernFlightRig(null, { referenceSpeed: actor.speed }))
  // The selector's own previous answer, kept out of React state so hysteresis
  // survives every frame rather than only the frames that re-render. The
  // sanctuary persists the same thing on its agent.
  const loopState = useRef<FlightLoopState>('cruise')
  const lastPosition = useRef({ x: actor.position.x, y: actor.position.y, z: actor.position.z })
  const boostHold = useRef(0)
  const selectCommand = useBattle((s) => s.select)
  const camera = useThree((s) => s.camera)
  // Battle wyverns are spawned at cruise altitude, so start on the authored
  // cruise loop. Replaying the eight-second ground takeoff in mid-air made the
  // opening of every battle read like a broken animation.
  const [anim, setAnim] = useState<ModelState>(actor.flying ? 'cruise' : 'idle')
  const wasAlive = useRef(true)
  const dissolveProgress = useRef(0)
  const lastCooldown = useRef(actor.cooldown)
  const lastBreathCooldown = useRef(actor.breathCooldown)
  const actionToken = useRef(0)
  const [action, setAction] = useState<ModelActionRequest | null>(null)
  const [frozen, setFrozen] = useState(false)
  const materials = useRef<MeshStandardMaterial[]>([])
  const flashElapsed = useRef<number | null>(null)
  const headBone = useRef<Object3D | null>(null)
  const neckBones = useRef<Object3D[]>([])

  const handleReady = useCallback((root: Group) => {
    materials.current = collectMaterials(root)
    rig.current.mount(root)
    headBone.current = rig.current.bones.head
    neckBones.current = rig.current.bones.neck
  }, [])

  useFrame((state, rawDelta) => {
    const g = group.current
    if (!g) return
    const dt = Math.min(rawDelta, 0.05)

    // Death is a discrete transition, accompanied by a gradual dissolve
    if (!actor.alive) {
      if (wasAlive.current) {
        wasAlive.current = false
        setAnim('death')
      }
      dissolveProgress.current = Math.min(1.0, dissolveProgress.current + dt * 0.5)
      const opacity = 1.0 - dissolveProgress.current
      for (const mat of materials.current) {
        mat.transparent = true
        mat.opacity = opacity
      }
      g.visible = dissolveProgress.current < 1.0
      return
    }
    g.visible = true

    g.position.set(actor.position.x, actor.position.y, actor.position.z)
    // Finite-difference the position rather than reading actor.velocity.
    // `applyMotion` clamps y into [3, 60] and the arena radius without zeroing
    // velocity, so an actor pinned against a limit keeps reporting a speed it
    // is not travelling — which would hold the dive clip indefinitely. The
    // sanctuary already measures this way.
    const horizontalSpeed =
      Math.hypot(actor.position.x - lastPosition.current.x, actor.position.z - lastPosition.current.z) /
      Math.max(dt, 1e-4)
    const verticalSpeed = (actor.position.y - lastPosition.current.y) / Math.max(dt, 1e-4)
    lastPosition.current.x = actor.position.x
    lastPosition.current.y = actor.position.y
    lastPosition.current.z = actor.position.z

    const yawRate = angleDelta(actor.yaw, lastYaw.current) / Math.max(dt, 1e-4)
    lastYaw.current = actor.yaw

    rig.current.step(dt, {
      position: actor.position,
      yaw: actor.yaw,
      airborne: actor.flying,
      flightMode: loopState.current,
      horizontalSpeed,
      verticalSpeed,
      yawRate,
      elapsedTime: state.clock.elapsedTime,
    })
    rig.current.sealJaw(action?.state ?? anim)

    // `updateAi` flips approach/engage at exactly `distance <= actor.range`
    // with no hysteresis, so at that boundary the intent alternates every tick.
    // Latching it for half a second keeps the sprint loop from chattering
    // against it; a band inside updateAi would be the deeper fix, but that is a
    // sim change with replay consequences.
    boostHold.current =
      actor.ai === 'approach' || actor.ai === 'retreat'
        ? BOOST_LATCH_SECONDS
        : Math.max(0, boostHold.current - dt)

    // Feed the selector its own previous answer. The version that laundered it
    // through `anim === 'bankLeft' || 'bankRight' ? anim : 'cruise'` discarded
    // every other mode on every frame, which made hover unreachable in battle
    // and would have done the same to speed, glide and dive.
    const next: ModelState = actor.flying
      ? flightAnimationState(loopState.current, rig.current.flightPose.bank, {
          horizontalSpeed,
          verticalSpeed,
          referenceSpeed: actor.speed,
          boosting: boostHold.current > 0,
          // `idle` has no range-boundary chatter, unlike approach/engage, so
          // it is safe to pass directly as the loitering-search intent.
          searching: actor.ai === 'idle',
        })
      : 'idle'
    if (actor.flying) loopState.current = next as FlightLoopState
    if (next !== anim) setAnim(next)

    // YXZ keeps bank and pitch relative to the wyvern after world-space yaw.
    g.rotation.order = 'YXZ'
    g.rotation.set(rig.current.flightPose.pitch, actor.yaw, rig.current.flightPose.bank)

    // Attack/breath tells: frame-diff the sim's own cooldown resets rather
    // than adding any event to the combat sim. One frame of lag behind the
    // actual hit, which is imperceptible.
    if (actor.cooldown > lastCooldown.current) {
      actionToken.current += 1
      setAction({ state: actor.flying ? 'attackAir' : 'attack', token: actionToken.current })
    }
    lastCooldown.current = actor.cooldown
    if (actor.breathCooldown > lastBreathCooldown.current) {
      actionToken.current += 1
      setAction({ state: 'breathe', token: actionToken.current })
    }
    lastBreathCooldown.current = actor.breathCooldown

    // Mixer LOD: never freeze the wyvern the player is piloting or looking
    // through; distant background wyverns stop advancing their pose.
    if (!piloted) {
      const shouldFreeze = camera.position.distanceTo(g.position) > MIXER_FREEZE_DISTANCE
      if (shouldFreeze !== frozen) setFrozen(shouldFreeze)
    }

    // Hit flash: a bare emissiveIntensity pulse on the materials GameModel
    // already clones per instance, captured once via onReady below.
    if (actor.hitThisTick) flashElapsed.current = 0
    if (flashElapsed.current !== null) {
      flashElapsed.current += dt
      const t = Math.min(1, flashElapsed.current / HIT_FLASH_SECONDS)
      const intensity = t >= 1 ? 1 : 1 + (HIT_FLASH_PEAK - 1) * (1 - t)
      for (const material of materials.current) material.emissiveIntensity = intensity
      if (t >= 1) flashElapsed.current = null
    }
  })

  const color = actor.feral
    ? '#8a2f2f'
    : actor.side === 'attacker'
      ? (SPECIES[actor.speciesId ?? '']?.color ?? '#d4562a')
      : '#7a4a8a'

  return (
    <group
      ref={group}
      onClick={(e) => {
        e.stopPropagation()
        selectCommand(actor.id, actor.side)
      }}
    >
      <GameModel
        id={`wyvern.${actor.speciesId}`}
        state={anim}
        action={action}
        scale={1.6}
        frozen={frozen}
        // Picks this wyvern's member of the `attack`/`attackAir` clip pools, so
        // a line of them does not strike in lockstep. Index within the wyvern
        // list, which is stable — dead actors stay in `sim.actors`.
        seed={index}
        onReady={handleReady}
        onActionFinished={(completed) => {
          setAction((current) => (current?.token === completed.token ? null : current))
        }}
        fallback={<PlaceholderWyvern color={color} scale={1.6} flapSpeed={7} phase={index * 1.3} />}
      >
        <BreathVFX
          range={actor.breathRange}
          active={actor.breathing || action?.state === 'breathe'}
          trigger={action?.state === 'breathe' ? action.token : 0}
          socketRef={headBone}
          neckRef={neckBones}
          seed={index}
        />
        <GroundDustVFX
          active={actor.alive && (anim === 'land' || anim === 'fly' || (actor.position.y < 5 && actor.flying))}
          position={[actor.position.x, actor.position.y, actor.position.z]}
        />
      </GameModel>
      {!piloted && (
        <WorldLabel
          text={actor.disobedient ? 'defiant' : actor.side === 'attacker' ? 'ally' : 'hostile'}
          position={[0, 3.6, 0]}
          size={1.5}
          color={actor.disobedient ? '#e8b04a' : actor.side === 'attacker' ? '#a9e0b0' : '#e0a9a9'}
        />
      )}
    </group>
  )
}

/**
 * A squad drawn as a fixed handful of instanced soldiers.
 *
 * Instanced and NOT skinned on purpose: instanced skinned meshes are not
 * workable in WebGL three.js. Ten static figures standing in for fifty troops
 * is both cheaper and more readable than a literal crowd.
 */
function SquadActorView({ actor }: { actor: Actor }) {
  const mesh = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const selectCommand = useBattle((s) => s.select)

  // Fixed jitter per soldier so the formation looks organic but never wobbles.
  const offsets = useMemo(
    () =>
      Array.from({ length: VISUALS_PER_SQUAD }, (_, i) => {
        const angle = (i / VISUALS_PER_SQUAD) * Math.PI * 2
        const radius = 2 + (i % 3) * 1.4
        return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius * 0.6 }
      }),
    [],
  )

  useFrame(() => {
    const m = mesh.current
    if (!m) return

    const fraction = actor.initialStrength > 0 ? actor.strength / actor.initialStrength : 0
    const showing = Math.ceil(fraction * VISUALS_PER_SQUAD)

    for (let i = 0; i < VISUALS_PER_SQUAD; i++) {
      const off = offsets[i]!
      dummy.position.set(actor.position.x + off.x, 0, actor.position.z + off.z)
      dummy.rotation.y = actor.yaw
      // Casualties are shown by retiring figures, not by shrinking the group.
      dummy.scale.setScalar(actor.alive && i < showing ? 1 : 0)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })

  const color = new Color(
    actor.side === 'attacker' ? (UNITS[actor.unitId ?? '']?.color ?? '#8a7a5c') : '#6a5560',
  )

  return (
    <group
      onClick={(e) => {
        e.stopPropagation()
        selectCommand(actor.id, actor.side)
      }}
    >
      <instancedMesh ref={mesh} args={[undefined, undefined, VISUALS_PER_SQUAD]} castShadow>
        <capsuleGeometry args={[0.35, 1.1, 4, 8]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </instancedMesh>
    </group>
  )
}

function BattleLighting() {
  return (
    <>
      <hemisphereLight args={['#9fb0c4', '#3a2f26', 0.7]} />
      <directionalLight
        position={[60, 80, 40]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-ARENA}
        shadow-camera-right={ARENA}
        shadow-camera-top={ARENA}
        shadow-camera-bottom={-ARENA}
      />
      <color attach="background" args={['#3c3b44']} />
      <fog attach="fog" args={['#3c3b44', 120, 300]} />
    </>
  )
}

function Terrain() {
  // Deterministic scatter, so the arena looks the same every time.
  const rocks = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => {
        const a = i * 2.399
        const r = ARENA * (0.25 + ((i * 37) % 60) / 100)
        return {
          x: Math.cos(a) * r,
          z: Math.sin(a) * r,
          s: 1 + ((i * 13) % 7) * 0.4,
        }
      }),
    [],
  )

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[ARENA, 64]} />
        <meshStandardMaterial color="#5d5a4a" roughness={1} />
      </mesh>
      {rocks.map((rock, i) => (
        <mesh key={i} position={[rock.x, rock.s * 0.4, rock.z]} rotation={[0, i, 0]} castShadow>
          <dodecahedronGeometry args={[rock.s, 0]} />
          <meshStandardMaterial color="#4a4740" roughness={0.95} />
        </mesh>
      ))}
      {/* Arena boundary. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
        <ringGeometry args={[ARENA - 1.5, ARENA, 64]} />
        <meshBasicMaterial color="#8a7a5c" transparent opacity={0.4} />
      </mesh>
    </group>
  )
}
