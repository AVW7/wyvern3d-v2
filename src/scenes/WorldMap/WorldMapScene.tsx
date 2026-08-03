'use client'

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { WorldLabel } from '@/render/labels/WorldLabel'
import { Vector3, type Mesh } from 'three'
import { REGIONS, REGION_LIST } from '@/core/data/regions'
import { SPECIES } from '@/core/data/species'
import { isAttackable } from '@/core/state/game'
import { useGame, useGameState } from '@/state/store'
import { useUi } from '@/state/uiStore'
import { consumeDrag, consumeWheel, isDown } from '@/render/controllers/input'
import { useCameraStore } from '@/state/cameraStore'

const OWNED = '#4e8f5a'
const ATTACKABLE = '#c9773a'
const LOCKED = '#5a5a63'

/**
 * The world map: a 3D board you orbit, with one node per region.
 *
 * A board rather than a seamless open world — selecting a target loads the
 * battle scene. That keeps the asset and streaming budget sane while still
 * reading as a 3D map you fly over.
 */
export function WorldMapScene() {
  const state = useGameState()
  const selected = useGame((s) => s.selectedRegion)
  const selectRegion = useGame((s) => s.selectRegion)
  const openPanel = useUi((s) => s.open)

  // Adjacency lines, deduplicated so each edge is drawn once.
  const edges = useMemo(() => {
    const seen = new Set<string>()
    const out: [Vector3, Vector3][] = []
    for (const region of REGION_LIST) {
      for (const id of region.neighbors) {
        const key = [region.id, id].sort().join('|')
        if (seen.has(key)) continue
        seen.add(key)
        const other = REGIONS[id]
        if (!other) continue
        out.push([
          new Vector3(region.position.x, 0.4, region.position.z),
          new Vector3(other.position.x, 0.4, other.position.z),
        ])
      }
    }
    return out
  }, [])

  return (
    <>
      <MapCamera />
      <hemisphereLight args={['#dfe7f0', '#3a3630', 0.9]} />
      <directionalLight position={[40, 60, 30]} intensity={1.5} castShadow />
      <color attach="background" args={['#1d232b']} />
      <fog attach="fog" args={['#1d232b', 180, 340]} />

      {/* The map board itself. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, -20]} receiveShadow>
        <planeGeometry args={[260, 240]} />
        <meshStandardMaterial color="#2f3a33" roughness={1} />
      </mesh>

      {edges.map((points, i) => (
        <Line key={i} points={points} color="#4a5560" lineWidth={1.5} />
      ))}

      {REGION_LIST.map((def) => {
        const region = state.regions[def.id]
        if (!region) return null
        const owned = region.owner === 'player'
        const attackable = isAttackable(state, def.id)
        const color = owned ? OWNED : attackable ? ATTACKABLE : LOCKED

        return (
          <RegionNode
            key={def.id}
            id={def.id}
            name={def.name}
            tier={def.tier}
            speciesColor={SPECIES[def.nativeSpecies]?.color ?? '#888'}
            position={[def.position.x, 0, def.position.z]}
            color={color}
            owned={owned}
            attackable={attackable}
            unrest={region.unrest}
            selected={selected === def.id}
            onSelect={() => {
              // Selecting on the map opens the war table directly. Requiring a
              // walk back to the keep to act on a selection is pure friction.
              selectRegion(def.id)
              openPanel('warTable')
            }}
          />
        )
      })}
    </>
  )
}

function RegionNode({
  id,
  name,
  tier,
  speciesColor,
  position,
  color,
  owned,
  attackable,
  unrest,
  selected,
  onSelect,
}: {
  id: string
  name: string
  tier: number
  speciesColor: string
  position: [number, number, number]
  color: string
  owned: boolean
  attackable: boolean
  unrest: number
  selected: boolean
  onSelect: () => void
}) {
  const ring = useRef<Mesh>(null)
  const radius = 5 + tier * 0.9

  useFrame((frameState) => {
    // Pulse the ring on attackable regions to draw the eye to legal moves.
    if (!ring.current) return
    const t = frameState.clock.elapsedTime
    const pulse = attackable && !owned ? 1 + Math.sin(t * 2.4) * 0.06 : 1
    ring.current.scale.setScalar(selected ? pulse * 1.15 : pulse)
  })

  return (
    <group position={position}>
      <mesh
        position={[0, 0.6, 0]}
        castShadow
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto'
        }}
      >
        <cylinderGeometry args={[radius, radius, 1.2, 24]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>

      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 1.3, 0]}>
        <ringGeometry args={[radius + 0.6, radius + 1.4, 32]} />
        <meshBasicMaterial color={selected ? '#ffe6a8' : speciesColor} transparent opacity={selected ? 0.95 : 0.5} />
      </mesh>

      {/* Unrest bar — only meaningful on regions you hold. */}
      {owned && unrest > 0 && (
        <mesh position={[0, 1.4, radius + 2.4]}>
          <boxGeometry args={[(unrest / 100) * radius * 1.6, 0.35, 0.35]} />
          <meshBasicMaterial color={unrest > 65 ? '#c94f3a' : '#c9a13a'} />
        </mesh>
      )}

      <WorldLabel text={name} position={[0, 8, 0]} size={3.4} variant="map" />
      <WorldLabel
        text={owned ? 'held' : attackable ? 'reachable' : `tier ${tier}`}
        position={[0, 5, 0]}
        size={2}
        variant="default"
        color={owned ? '#9fe0ab' : attackable ? '#f0c08a' : '#b9c2cc'}
      />
      <group name={id} />
    </group>
  )
}

/** Orbit-and-zoom camera driven by drag and W/S, no OrbitControls dependency. */
function MapCamera() {
  const camera = useThree((s) => s.camera)
  const yaw = useRef(0)
  const pitch = useRef(0.85)
  const distance = useRef(190)
  const target = useMemo(() => new Vector3(0, 0, -20), [])
  const desired = useRef(new Vector3())

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    const camSettings = useCameraStore.getState()

    if ('fov' in camera && typeof camera.fov === 'number' && camera.fov !== camSettings.fov) {
      camera.fov = camSettings.fov
      camera.updateProjectionMatrix()
    }

    const drag = consumeDrag()
    const dragXMultiplier = (camSettings.invertX ? -1 : 1) * camSettings.sensitivity
    const dragYMultiplier = (camSettings.invertY ? 1 : -1) * camSettings.sensitivity

    yaw.current += drag.x * 0.004 * dragXMultiplier
    pitch.current = Math.max(0.35, Math.min(1.25, pitch.current + drag.y * 0.003 * dragYMultiplier))

    if (isDown('KeyW', 'Equal')) distance.current -= 60 * dt * camSettings.zoomSpeed
    if (isDown('KeyS', 'Minus')) distance.current += 60 * dt * camSettings.zoomSpeed
    distance.current += consumeWheel() * 0.12 * camSettings.zoomSpeed
    distance.current = Math.max(90, Math.min(260, distance.current))

    desired.current.set(
      target.x + Math.sin(yaw.current) * distance.current * Math.cos(pitch.current),
      target.y + distance.current * Math.sin(pitch.current),
      target.z + Math.cos(yaw.current) * distance.current * Math.cos(pitch.current),
    )
    camera.position.lerp(desired.current, 1 - Math.exp(-camSettings.smoothing * dt))
    camera.lookAt(target)
  })

  return null
}

